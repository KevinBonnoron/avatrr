import type { ChatMessagePart, ChatRequestMessage, ConversationMessage, Expression } from '@avatrr/shared';
import { getConversationDb, isConversationDbInitialized } from '../lib/conversation-db';

/** Max hot conversations kept in memory. */
const MAX_CACHE = 50;
/** Sliding window size for mood history. */
const MOOD_WINDOW = 10;
/** Decay factor applied per turn to intensity. */
const MOOD_DECAY = 0.85;

interface CacheEntry {
  messages: ChatRequestMessage[];
  lastUsed: number;
  moodHistory: Expression[];
}

const cache = new Map<string, CacheEntry>();
const cacheOrder: string[] = [];

function evictCache(): void {
  while (cacheOrder.length > MAX_CACHE) {
    const id = cacheOrder.shift();
    if (id) {
      cache.delete(id);
    }
  }
}

function touchCache(id: string, entry: CacheEntry): void {
  const idx = cacheOrder.indexOf(id);
  if (idx !== -1) {
    cacheOrder.splice(idx, 1);
  }
  cacheOrder.push(id);
  entry.lastUsed = Date.now();
  evictCache();
}

function loadFromDb(id: string): CacheEntry | undefined {
  if (!isConversationDbInitialized()) {
    return undefined;
  }
  const db = getConversationDb();
  const conv = db.query('SELECT id FROM conversations WHERE id = ?').get(id) as { id: string } | null;
  if (!conv) {
    return undefined;
  }
  const rows = db.query('SELECT role, parts_json FROM messages WHERE conversation_id = ? ORDER BY id ASC').all(id) as Array<{ role: string; parts_json: string }>;
  const messages: ChatRequestMessage[] = rows.map((r) => ({
    role: r.role as ChatRequestMessage['role'],
    parts: JSON.parse(r.parts_json) as ChatMessagePart[],
  }));
  return { messages, lastUsed: Date.now(), moodHistory: [] };
}

/**
 * Get conversation messages by id. Checks cache first, then SQLite.
 */
export function getConversation(id: string): ChatRequestMessage[] | undefined {
  let entry = cache.get(id);
  if (entry) {
    touchCache(id, entry);
    return entry.messages;
  }
  entry = loadFromDb(id);
  if (entry) {
    cache.set(id, entry);
    touchCache(id, entry);
    return entry.messages;
  }
  return undefined;
}

/**
 * Append a message to a conversation (creates the conversation if missing).
 * Persists to SQLite if the conversation DB is initialized.
 */
export function appendToConversation(id: string, message: ChatRequestMessage, avatarId?: string): void {
  let entry = cache.get(id);
  if (!entry) {
    entry = loadFromDb(id) ?? { messages: [], lastUsed: Date.now(), moodHistory: [] };
    cache.set(id, entry);
  }
  entry.messages.push(message);
  touchCache(id, entry);

  if (isConversationDbInitialized()) {
    const db = getConversationDb();
    const existing = db.query('SELECT id FROM conversations WHERE id = ?').get(id);
    if (!existing) {
      db.run('INSERT INTO conversations (id, avatar_id) VALUES (?, ?)', [id, avatarId ?? null]);
    } else {
      db.run('UPDATE conversations SET updated_at = unixepoch() WHERE id = ?', [id]);
    }
    db.run('INSERT INTO messages (conversation_id, role, parts_json) VALUES (?, ?, ?)', [id, message.role, JSON.stringify(message.parts ?? [])]);
  }
}

/**
 * List all conversations with summary metadata.
 */
export function getAllConversations(): { id: string; avatarId: string | null; messageCount: number; lastUsed: number }[] {
  if (isConversationDbInitialized()) {
    const db = getConversationDb();
    const rows = db.query(`
      SELECT c.id, c.avatar_id, COUNT(m.id) as message_count, c.updated_at
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all() as Array<{ id: string; avatar_id: string | null; message_count: number; updated_at: number }>;
    return rows.map((r) => ({ id: r.id, avatarId: r.avatar_id, messageCount: r.message_count, lastUsed: r.updated_at * 1000 }));
  }
  // Fallback: in-memory only
  const result: { id: string; avatarId: string | null; messageCount: number; lastUsed: number }[] = [];
  for (const [id, entry] of cache) {
    result.push({ id, avatarId: null, messageCount: entry.messages.length, lastUsed: entry.lastUsed });
  }
  result.sort((a, b) => b.lastUsed - a.lastUsed);
  return result;
}

/**
 * Get conversation messages with their database IDs (for admin editing).
 */
export function getConversationMessages(id: string): ConversationMessage[] | undefined {
  if (isConversationDbInitialized()) {
    const db = getConversationDb();
    const conv = db.query('SELECT id FROM conversations WHERE id = ?').get(id) as { id: string } | null;
    if (!conv) {
      return undefined;
    }
    const rows = db.query('SELECT id, role, parts_json FROM messages WHERE conversation_id = ? ORDER BY id ASC').all(id) as Array<{ id: number; role: string; parts_json: string }>;
    return rows.map((r) => ({
      id: r.id,
      role: r.role as ChatRequestMessage['role'],
      parts: JSON.parse(r.parts_json) as ChatMessagePart[],
    }));
  }
  return getConversation(id)?.map((m, i) => ({ ...m, id: i }));
}

/**
 * Update a single message's text content by its database ID.
 */
export function updateConversationMessage(messageId: number, text: string): boolean {
  if (!isConversationDbInitialized()) {
    return false;
  }
  const db = getConversationDb();
  const parts = JSON.stringify([{ type: 'text', content: text }]);
  const result = db.run('UPDATE messages SET parts_json = ? WHERE id = ?', [parts, messageId]);
  if (result.changes > 0) {
    // Invalidate cache for the conversation containing this message
    const row = db.query('SELECT conversation_id FROM messages WHERE id = ?').get(messageId) as { conversation_id: string } | null;
    if (row) {
      cache.delete(row.conversation_id);
    }
  }
  return result.changes > 0;
}

/**
 * Delete all conversations. Returns the number deleted.
 */
export function deleteAllConversations(): number {
  cache.clear();
  cacheOrder.length = 0;
  if (isConversationDbInitialized()) {
    const db = getConversationDb();
    const result = db.run('DELETE FROM conversations');
    return result.changes;
  }
  return 0;
}

/**
 * Delete a conversation by id. Returns true if it existed.
 */
export function deleteConversation(id: string): boolean {
  const idx = cacheOrder.indexOf(id);
  if (idx !== -1) {
    cacheOrder.splice(idx, 1);
  }
  const wasInCache = cache.delete(id);

  if (isConversationDbInitialized()) {
    const db = getConversationDb();
    const result = db.run('DELETE FROM conversations WHERE id = ?', [id]);
    return result.changes > 0 || wasInCache;
  }
  return wasInCache;
}

/**
 * Create a new conversation id.
 */
export function createConversationId(): string {
  return crypto.randomUUID();
}

/**
 * Push an expression into the conversation's mood sliding window and return the current mood.
 */
export function updateConversationMood(id: string, expression: Expression): { mood: Expression; intensity: number } {
  let entry = cache.get(id);
  if (!entry) {
    entry = loadFromDb(id) ?? { messages: [], lastUsed: Date.now(), moodHistory: [] };
    cache.set(id, entry);
  }
  entry.moodHistory.push(expression);
  if (entry.moodHistory.length > MOOD_WINDOW) {
    entry.moodHistory.splice(0, entry.moodHistory.length - MOOD_WINDOW);
  }
  return computeMood(entry.moodHistory);
}

/**
 * Get the current mood for a conversation (without modifying history).
 */
export function getConversationMood(id: string): { mood: Expression; intensity: number } {
  const entry = cache.get(id);
  if (!entry || entry.moodHistory.length === 0) {
    return { mood: 'neutral', intensity: 0 };
  }
  return computeMood(entry.moodHistory);
}

function computeMood(history: Expression[]): { mood: Expression; intensity: number } {
  if (history.length === 0) {
    return { mood: 'neutral', intensity: 0 };
  }
  const counts = new Map<Expression, number>();
  for (let i = 0; i < history.length; i++) {
    const expr = history[i] as Expression;
    const weight = MOOD_DECAY ** (history.length - 1 - i);
    counts.set(expr, (counts.get(expr) ?? 0) + weight);
  }
  let dominant: Expression = 'neutral';
  let maxCount = 0;
  for (const [expr, count] of counts) {
    if (expr !== 'neutral' && count > maxCount) {
      dominant = expr;
      maxCount = count;
    }
  }
  if (dominant === 'neutral') {
    return { mood: 'neutral', intensity: 0 };
  }
  let totalWeight = 0;
  for (const count of counts.values()) {
    totalWeight += count;
  }
  const intensity = Math.min(1, maxCount / totalWeight);
  return { mood: dominant, intensity };
}

import { closeDb, getDb, initDb, isDbInitialized } from './db';
import { getEmbeddingDimension } from './embedding';

const VEC_EXTENSION_NAME = 'vec0';
const MAX_CANDIDATES = 50;

/** Prefix for the single "system prompt" memory per avatar (character definition). */
export const SYSTEM_MEMORY_PREFIX = '[SYSTEM]\n';

export interface StoredMemory {
  id: number;
  text: string;
  distance: number;
}

/**
 * Initialize the memory DB: open database (via db.ts), load vec0 extension, create tables if needed.
 * Safe to call multiple times; subsequent calls no-op if already initialized.
 */
export function initMemory(dbPath: string): void {
  if (!dbPath.trim()) {
    return;
  }

  const database = initDb(dbPath);

  const embeddingDimension = getEmbeddingDimension();
  database.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avatar_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  try {
    database.run(`CREATE VIRTUAL TABLE IF NOT EXISTS vec_memories USING ${VEC_EXTENSION_NAME}(embedding float[${embeddingDimension}])`);
  } catch (e) {
    closeDb();
    throw e;
  }
}

/**
 * Add a memory for an avatar: store text and its embedding. The embedding must match
 * the dimension from getEmbeddingDimension() (e.g. 768 for nomic-embed-text).
 */
export function addMemory(avatarId: string, text: string, embedding: number[]): void {
  const database = getDb();
  const dim = getEmbeddingDimension();
  if (embedding.length !== dim) {
    throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected ${dim}`);
  }

  const insertMeta = database.prepare('INSERT INTO memories (avatar_id, text) VALUES (?, ?)');
  const insertVec = database.prepare(`INSERT INTO vec_memories (rowid, embedding) VALUES (?, vec_f32(?))`);

  const run = database.transaction(() => {
    const r = insertMeta.run(avatarId, text);
    const id = r.lastInsertRowid;
    insertVec.run(id, new Float32Array(embedding));
  });

  run();
}

/**
 * Search memories by similarity for the given avatar. Returns up to `k` memories
 * ordered by distance (nearest first).
 */
export function searchMemories(avatarId: string, queryEmbedding: number[], k: number): StoredMemory[] {
  const database = getDb();
  const dim = getEmbeddingDimension();
  if (queryEmbedding.length !== dim) {
    throw new Error(`Embedding dimension mismatch: got ${queryEmbedding.length}, expected ${dim}`);
  }

  const stmt = database.prepare(
    `
    SELECT m.id, m.text, v.distance
    FROM memories m
    INNER JOIN (
      SELECT rowid AS id, distance
      FROM vec_memories
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    ) v ON m.id = v.id
    WHERE m.avatar_id = ?
    ORDER BY v.distance
    LIMIT ?
  `,
  );

  const rows = stmt.all(new Float32Array(queryEmbedding), MAX_CANDIDATES, avatarId, k) as Array<{ id: number; text: string; distance: number }>;

  return rows;
}

/**
 * Search memories by keyword (LIKE). Use with vector search to improve recall
 * for paraphrased questions (e.g. "name" catches "User said: My name is Kevin").
 */
export function searchMemoriesByKeywords(avatarId: string, keywords: string[], limit: number): StoredMemory[] {
  if (keywords.length === 0) {
    return [];
  }
  const database = getDb();
  const placeholders = keywords.map(() => 'text LIKE ?').join(' OR ');
  const params = [avatarId, ...keywords.map((k) => `%${k}%`)];
  const rows = database.prepare(`SELECT id, text FROM memories WHERE avatar_id = ? AND (${placeholders}) AND text NOT LIKE ? ORDER BY id DESC LIMIT ?`).all(...params, `${SYSTEM_MEMORY_PREFIX}%`, limit) as Array<{ id: number; text: string }>;
  return rows.map((r) => ({ id: r.id, text: r.text, distance: 0 }));
}

/**
 * Get the stored system prompt (character context) for an avatar, if any.
 * Returns the text without the internal prefix.
 */
export function getSystemMemory(avatarId: string): string | null {
  const database = getDb();
  const row = database.prepare('SELECT text FROM memories WHERE avatar_id = ? AND text LIKE ? LIMIT 1').get(avatarId, `${SYSTEM_MEMORY_PREFIX}%`) as { text: string } | undefined;
  if (!row?.text) {
    return null;
  }
  return row.text.startsWith(SYSTEM_MEMORY_PREFIX) ? row.text.slice(SYSTEM_MEMORY_PREFIX.length) : row.text;
}

/** Return true when the memory DB is available (initialized). */
export function isMemoryInitialized(): boolean {
  return isDbInitialized();
}

/** List all memories for an avatar, newest first. Excludes system memories. */
export function getMemoriesForAvatar(avatarId: string): Array<{ id: number; avatarId: string; text: string; createdAt: number }> {
  const database = getDb();
  return database.prepare('SELECT id, avatar_id as avatarId, text, created_at as createdAt FROM memories WHERE avatar_id = ? AND text NOT LIKE ? ORDER BY id DESC').all(avatarId, `${SYSTEM_MEMORY_PREFIX}%`) as Array<{ id: number; avatarId: string; text: string; createdAt: number }>;
}

/** List all memories across all avatars, newest first. Excludes system memories. */
export function getAllMemories(): Array<{ id: number; avatarId: string; text: string; createdAt: number }> {
  const database = getDb();
  return database.prepare('SELECT id, avatar_id as avatarId, text, created_at as createdAt FROM memories WHERE text NOT LIKE ? ORDER BY id DESC').all(`${SYSTEM_MEMORY_PREFIX}%`) as Array<{ id: number; avatarId: string; text: string; createdAt: number }>;
}

/** Delete a single memory by id. Also removes the corresponding vector row. */
export function deleteMemory(memoryId: number): boolean {
  const database = getDb();
  const del = database.transaction(() => {
    database.prepare('DELETE FROM vec_memories WHERE rowid = ?').run(memoryId);
    const r = database.prepare('DELETE FROM memories WHERE id = ?').run(memoryId);
    return r.changes > 0;
  });
  return del();
}

/** Delete all memories for an avatar (excluding system memories). Also removes corresponding vector rows. */
export function deleteAllMemoriesForAvatar(avatarId: string): number {
  const database = getDb();
  const ids = database.prepare('SELECT id FROM memories WHERE avatar_id = ? AND text NOT LIKE ?').all(avatarId, `${SYSTEM_MEMORY_PREFIX}%`) as Array<{ id: number }>;
  if (ids.length === 0) {
    return 0;
  }
  const del = database.transaction(() => {
    for (const { id } of ids) {
      database.prepare('DELETE FROM vec_memories WHERE rowid = ?').run(id);
    }
    return database.prepare('DELETE FROM memories WHERE avatar_id = ? AND text NOT LIKE ?').run(avatarId, `${SYSTEM_MEMORY_PREFIX}%`).changes;
  });
  return del();
}

/** Update the text of a memory. Does NOT update the embedding (vector stays the same). */
export function updateMemoryText(memoryId: number, text: string): boolean {
  const database = getDb();
  const r = database.prepare('UPDATE memories SET text = ? WHERE id = ?').run(text, memoryId);
  return r.changes > 0;
}

/**
 * Close the database connection. Used for tests or graceful shutdown.
 */
export function closeMemory(): void {
  closeDb();
}

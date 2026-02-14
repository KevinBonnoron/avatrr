import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Database } from 'bun:sqlite';

let db: Database | null = null;

export function initConversationDb(dbPath: string): void {
  if (db != null) {
    return;
  }
  const resolved = resolve(dbPath);
  const dir = dirname(resolved);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  db = new Database(resolved);
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      avatar_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      parts_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
}

export function getConversationDb(): Database {
  if (db == null) {
    throw new Error('Conversation DB not initialized. Call initConversationDb() first.');
  }
  return db;
}

export function isConversationDbInitialized(): boolean {
  return db != null;
}

export function closeConversationDb(): void {
  if (db != null) {
    db.close();
    db = null;
  }
}

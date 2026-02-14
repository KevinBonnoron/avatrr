import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Database } from 'bun:sqlite';

let db: Database | null = null;

/**
 * Return the current database instance. Throws if not initialized.
 */
export function getDb(): Database {
  if (db == null) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  return db;
}

/**
 * Initialize the SQLite database: create directory if needed, open DB, load vec0 extension.
 * Safe to call multiple times; subsequent calls no-op if already initialized.
 * Does not create tables; the caller (e.g. memory) is responsible for schema.
 */
export function initDb(dbPath: string): Database {
  if (db != null) {
    return db;
  }

  if (!dbPath.trim()) {
    throw new Error('Database path cannot be empty.');
  }

  const resolved = resolve(dbPath);
  const dir = dirname(resolved);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const vecPath = join(dirname(import.meta.dir), 'vec0');
  db = new Database(resolved);

  try {
    db.loadExtension(vecPath);
  } catch (e) {
    db.close();
    db = null;
    throw new Error(`Failed to load sqlite-vec extension at ${vecPath}: ${e instanceof Error ? e.message : e}`);
  }

  return getDb();
}

/**
 * Return true when the database has been initialized (initDb was called successfully).
 */
export function isDbInitialized(): boolean {
  return db != null;
}

/**
 * Close the database connection. Used for tests or graceful shutdown.
 */
export function closeDb(): void {
  if (db != null) {
    db.close();
    db = null;
  }
}

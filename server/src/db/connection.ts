import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../config/env.js';
import pg from 'pg';

const { Pool } = pg;

/** Minimal async DB interface shared by both drivers. */
export interface Db {
  run(sql: string, params?: unknown[]): Promise<{ lastId: number; changes: number }>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

/* ------------------------- SQLite driver ------------------------- */

class SqliteDriver implements Db {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }

  run(sql: string, params: unknown[] = []) {
    const res = this.db.prepare(sql).run(...(params as never[]));
    return Promise.resolve({ lastId: Number(res.lastInsertRowid), changes: Number(res.changes) });
  }

  get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const row = this.db.prepare(sql).get(...(params as never[])) as T | undefined;
    return Promise.resolve(row);
  }

  all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const rows = this.db.prepare(sql).all(...(params as never[])) as T[];
    return Promise.resolve(rows);
  }

  close() {
    this.db.close();
    return Promise.resolve();
  }
}

/* ------------------------- Postgres driver ------------------------ */

class PostgresDriver implements Db {
  private pool: pg.Pool;
  constructor(url: string) {
    this.pool = new Pool({ connectionString: url });
  }

  /** Rewrite ? placeholders to $1..$n for Postgres. */
  private rewrite(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  run(sql: string, params: unknown[] = []) {
    return this.pool.query(this.rewrite(sql), params).then((r) => ({
      lastId: Number(r.rows[0]?.id ?? 0),
      changes: r.rowCount ?? 0,
    }));
  }

  async get<T>(sql: string, params: unknown[] = []) {
    const r = await this.pool.query<Record<string, unknown>>(this.rewrite(sql), params);
    return r.rows[0] as T | undefined;
  }

  async all<T>(sql: string, params: unknown[] = []) {
    const r = await this.pool.query<Record<string, unknown>>(this.rewrite(sql), params);
    return r.rows as T[];
  }

  close() {
    return this.pool.end();
  }
}

/* --------------------------- singleton ---------------------------- */

let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  db = env.dbDriver === 'postgres' ? new PostgresDriver(env.databaseUrl) : new SqliteDriver(env.dbPath);
  return db;
}

export function createMemoryDb(): Db {
  return new SqliteDriver(':memory:');
}

export function resetDbForTests(): void {
  db = null;
}

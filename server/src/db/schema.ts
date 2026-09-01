/**
 * Schema — SQLite flavour (used by default). A Postgres migration with the
 * same tables lives in `server/migrations/001_init.sql`.
 * Use TEXT ids as UUIDs; timestamps stored as ISO strings for portability.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  username TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  suspended INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free',
  plan TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 0,
  approved_at TEXT,
  approved_by TEXT,
  updated_at TEXT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS entitlements (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  premium_effect_credits_remaining INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);`,
  `CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);`,
  `CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_date TEXT,
  note TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  decline_reason TEXT,
  created_at TEXT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS payment_proofs (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL DEFAULT '',
  file_type TEXT NOT NULL DEFAULT 'image/png',
  data TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target_user_id TEXT,
  payment_id TEXT,
  previous_state TEXT,
  new_state TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS payment_settings (
  id INTEGER PRIMARY KEY,
  bank_name TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  payment_instructions TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'NGN',
  monthly_price INTEGER NOT NULL DEFAULT 6000,
  yearly_price INTEGER NOT NULL DEFAULT 60000,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);`,
  `INSERT OR IGNORE INTO payment_settings (id, bank_name, account_name, account_number, payment_instructions, currency, monthly_price, yearly_price, updated_at)
   VALUES (1, '', '', '', '', 'NGN', 6000, 60000, '1970-01-01T00:00:00.000Z');`,
];

/** Columns added to pre-existing tables after the initial schema shipped. */
const ADDED_COLUMNS: Record<string, [string, string][]> = {
  users: [
    ['username', 'TEXT'],
    ['role', "TEXT NOT NULL DEFAULT 'user'"],
    ['suspended', 'INTEGER NOT NULL DEFAULT 0'],
  ],
  subscriptions: [
    ['approved_at', 'TEXT'],
    ['approved_by', 'TEXT'],
  ],
  payments: [
    ['payment_date', 'TEXT'],
    ['note', 'TEXT'],
    ['reviewed_at', 'TEXT'],
    ['reviewed_by', 'TEXT'],
    ['decline_reason', 'TEXT'],
  ],
};

interface ColumnInfo {
  columnExists(table: string, column: string): Promise<boolean>;
  run(sql: string): Promise<unknown>;
}

async function sqliteColumnInfo(db: {
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}): Promise<ColumnInfo> {
  const tables = await db.all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  const existing = new Map<string, Set<string>>();
  for (const t of tables) {
    const cols = await db.all<{ name: string }>(`PRAGMA table_info(${t.name})`);
    existing.set(t.name, new Set(cols.map((c) => c.name)));
  }
  return {
    async columnExists(table, column) {
      return existing.get(table)?.has(column) ?? false;
    },
    async run(sql) {
      await db.all(sql);
    },
  };
}

async function postgresColumnInfo(db: {
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}): Promise<ColumnInfo> {
  const rows = await db.all<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  const existing = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!existing.has(r.table_name)) existing.set(r.table_name, new Set());
    existing.get(r.table_name)!.add(r.column_name);
  }
  return {
    async columnExists(table, column) {
      return existing.get(table)?.has(column) ?? false;
    },
    async run(sql) {
      await db.all(sql);
    },
  };
}

export async function migrate(db: {
  run(sql: string, params?: unknown[]): Promise<{ lastId: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.run(stmt);
  }

  // Bring pre-existing tables up to date (dev databases created before these columns).
  const info = await sqliteColumnInfo(db).catch(() => postgresColumnInfo(db));

  for (const [table, cols] of Object.entries(ADDED_COLUMNS)) {
    for (const [column, ddl] of cols) {
      const exists = await info.columnExists(table, column);
      if (!exists) {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
      }
    }
  }

  await seedPaymentSettingsFromEnv(db);
}

/**
 * Seed the bank-transfer destination from environment variables on first boot.
 * Only fills values when the configured row is still empty, so administrator
 * edits made through the Admin panel are never overwritten on restart.
 */
export async function seedPaymentSettingsFromEnv(db: {
  run(sql: string, params?: unknown[]): Promise<{ lastId: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
}): Promise<void> {
  const envVars = await import('../config/env.js').then((m) => m.env);
  if (!envVars.bankName && !envVars.bankAccountName && !envVars.bankAccountNumber) return;
  const row = await db.get<{ bank_name: string; account_name: string }>(
    'SELECT bank_name, account_name FROM payment_settings WHERE id = 1',
  );
  if (!row || row.bank_name || row.account_name) return;

  const now = new Date().toISOString();
  await db.run(
    `UPDATE payment_settings
       SET bank_name = ?, account_name = ?, account_number = ?, payment_instructions = ?, currency = ?, updated_at = ?
     WHERE id = 1`,
    [
      envVars.bankName,
      envVars.bankAccountName,
      envVars.bankAccountNumber,
      envVars.bankInstructions,
      envVars.currency,
      now,
    ],
  );
  console.info('[veyra:server] seeded bank transfer details from environment.');
}

/**
 * New-user defaults: 1 free premium effect experience + free subscription row.
 */
export async function ensureUserRows(
  db: {
    run(sql: string, params?: unknown[]): Promise<{ lastId: number; changes: number }>;
  },
  userId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.run(
    `INSERT OR IGNORE INTO subscriptions (user_id, tier, plan, status, updated_at) VALUES (?, 'free', NULL, 'active', ?)`,
    [userId, now],
  );
  await db.run(
    `INSERT OR IGNORE INTO entitlements (user_id, premium_effect_credits_remaining, updated_at) VALUES (?, 1, ?)`,
    [userId, now],
  );
}

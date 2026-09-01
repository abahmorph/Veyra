import { createApp, initDb } from './app.js';
import { env } from './config/env.js';
import { getDb } from './db/connection.js';
import { ensureUserRows } from './db/schema.js';
import { sweepSubscriptions } from './db/services.js';
import { hashPassword, newId } from './auth/passwords.js';

await initDb();

if (!env.jwtSecret) {
  console.error('[veyra:server] JWT_SECRET is not configured. The server will not start without it.');
  process.exit(1);
}

/** Optional env-configured first administrator (VEYRA_ADMIN_EMAIL/PASSWORD). */
async function bootstrapAdminFromEnv(): Promise<void> {
  if (!env.adminEmail || !env.adminPassword) return;
  const db = getDb();
  const existing = await db.get<{ id: string }>('SELECT id FROM users WHERE role = ?', ['admin']);
  if (existing) return;
  const id = newId();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?, ?)`,
    [id, env.adminEmail, env.adminName || 'Administrator', await hashPassword(env.adminPassword), now, now],
  );
  await ensureUserRows(db, id);
  console.info(`[veyra:server] bootstrapped administrator ${env.adminEmail}`);
}

await bootstrapAdminFromEnv();

/** Background maintenance: expire subscriptions and send boundary notifications. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
async function sweep(): Promise<void> {
  try {
    await sweepSubscriptions(getDb());
  } catch (err) {
    console.error('[veyra:server] subscription sweep failed:', err);
  }
}
void sweep();
setInterval(() => void sweep(), SWEEP_INTERVAL_MS);

const app = createApp();
app.listen(env.port, () => {
  console.log(`[veyra:server] listening on http://localhost:${env.port} (db=${env.dbDriver})`);
});

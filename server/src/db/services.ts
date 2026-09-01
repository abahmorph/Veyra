/**
 * Shared backend services: notifications, audit log, subscription lifecycle.
 * These are the ONLY places that mutate subscription/payment state.
 */
import { newId } from '../auth/passwords.js';
import type { Db } from './connection.js';

export interface AuditInput {
  actorId?: string | null;
  actorName?: string;
  action: string;
  targetUserId?: string | null;
  paymentId?: string | null;
  previousState?: unknown;
  newState?: unknown;
  detail?: string;
}

export async function createNotification(
  db: Db,
  userId: string,
  kind: string,
  title: string,
  message = '',
): Promise<void> {
  await db.run(
    `INSERT INTO notifications (id, user_id, kind, title, message, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [newId(), userId, kind, title, message, new Date().toISOString()],
  );
}

export async function createAudit(db: Db, entry: AuditInput): Promise<void> {
  await db.run(
    `INSERT INTO audit_logs
       (id, actor_id, actor_name, action, target_user_id, payment_id, previous_state, new_state, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      entry.actorId ?? null,
      entry.actorName ?? '',
      entry.action,
      entry.targetUserId ?? null,
      entry.paymentId ?? null,
      entry.previousState !== undefined ? JSON.stringify(entry.previousState) : null,
      entry.newState !== undefined ? JSON.stringify(entry.newState) : null,
      entry.detail ?? null,
      new Date().toISOString(),
    ],
  );
}

export function subscriptionExpiry(plan: 'monthly' | 'yearly', from = new Date()): string {
  const d = new Date(from);
  if (plan === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export async function isPremiumActive(db: Db, userId: string): Promise<boolean> {
  const row = await db.get<{ tier: string; status: string; expires_at: string | null }>(
    'SELECT tier, status, expires_at FROM subscriptions WHERE user_id = ?',
    [userId],
  );
  return (
    row?.tier === 'premium' &&
    row.status === 'active' &&
    (!row.expires_at || row.expires_at > new Date().toISOString())
  );
}

/**
 * Activate premium for a user and record the audit trail.
 * Expiry is calculated from the selected plan (calendar month / calendar year).
 */
export async function activatePremium(
  db: Db,
  userId: string,
  plan: 'monthly' | 'yearly',
  byUserId: string | null,
  byName = '',
): Promise<string> {
  const expiresAt = subscriptionExpiry(plan);
  const now = new Date().toISOString();
  await db.run(
    `UPDATE subscriptions
       SET tier = 'premium', plan = ?, status = 'active', auto_renew = 0, expires_at = ?,
           approved_at = ?, approved_by = ?, updated_at = ?
     WHERE user_id = ?`,
    [plan, expiresAt, now, byUserId, now, userId],
  );
  await createNotification(
    db,
    userId,
    'premium_activated',
    'Premium activated 🎉',
    `Your Veyra Premium (${plan}) subscription is active until ${expiresAt.slice(0, 10)}.`,
  );
  await createAudit(db, {
    actorId: byUserId,
    actorName: byName,
    action: 'PREMIUM_GRANTED',
    targetUserId: userId,
    newState: { plan, expiresAt },
  });
  return expiresAt;
}

export async function revokePremium(
  db: Db,
  userId: string,
  byUserId: string | null,
  byName = '',
  detail = 'Administrator revoked premium access.',
): Promise<void> {
  const prev = await db.get<{ tier: string; plan: string | null; status: string; expires_at: string | null }>(
    'SELECT tier, plan, status, expires_at FROM subscriptions WHERE user_id = ?',
    [userId],
  );
  const now = new Date().toISOString();
  await db.run(
    `UPDATE subscriptions
       SET tier = 'free', plan = NULL, status = 'active', expires_at = NULL, approved_at = NULL, approved_by = NULL, updated_at = ?
     WHERE user_id = ?`,
    [now, userId],
  );
  await createNotification(
    db,
    userId,
    'premium_revoked',
    'Premium ended',
    'Your premium access has been ended. Contact support if this was unexpected.',
  );
  await createAudit(db, {
    actorId: byUserId,
    actorName: byName,
    action: 'PREMIUM_REVOKED',
    targetUserId: userId,
    previousState: prev,
    newState: { tier: 'free' },
    detail,
  });
}

/**
 * Background sweep: notify about expiring / expired subscriptions.
 * Runs idempotently — only fires notifications when the boundary state changes.
 */
export async function sweepSubscriptions(db: Db): Promise<void> {
  const now = Date.now();
  const soonThreshold = now + 3 * 24 * 60 * 60 * 1000; // 3 days
  const rows = await db.all<{ user_id: string; expires_at: string | null; plan: string | null }>(
    `SELECT user_id, expires_at, plan FROM subscriptions WHERE tier = 'premium' AND status = 'active' AND expires_at IS NOT NULL`,
  );
  for (const row of rows) {
    const expires = new Date(row.expires_at!).getTime();
    if (expires <= now) {
      // Expired — mark as free (notification fired once on transition).
      await db.run(`UPDATE subscriptions SET tier = 'free', status = 'expired', updated_at = ? WHERE user_id = ? AND tier = 'premium'`, [
        new Date().toISOString(),
        row.user_id,
      ]);
      await createNotification(
        db,
        row.user_id,
        'premium_expired',
        'Premium expired',
        'Your Veyra Premium subscription has expired. Renew to keep premium features.',
      );
      await createAudit(db, { action: 'PREMIUM_EXPIRED', targetUserId: row.user_id, previousState: row, newState: { tier: 'free' } });
    } else if (expires <= soonThreshold) {
      const expiryDay = row.expires_at!.slice(0, 10);
      await createNotification(
        db,
        row.user_id,
        'premium_expiring',
        'Premium expiring soon',
        `Your Veyra Premium expires on ${expiryDay}. Renew before it ends.`,
      );
    }
  }
}

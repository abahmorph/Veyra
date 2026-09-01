import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { ApiError } from '../middleware/errors.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { revokeSession } from '../auth/jwt.js';
import { createAudit } from '../db/services.js';

export const user = Router();

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  username: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{3,24}$/i, 'Username must be 3–24 characters (letters, numbers, underscores).')
    .nullable()
    .optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(256)
    .regex(/[A-Z]/, 'Password must include an uppercase letter.')
    .regex(/[a-z]/, 'Password must include a lowercase letter.')
    .regex(/[0-9]/, 'Password must include a number.'),
});

/** Full account payload — the frontend refreshes from here after login. */
async function fullUserResponse(db: ReturnType<typeof getDb>, userId: string) {
  const row = await db.get<{ id: string; email: string; name: string; username: string | null; role: string; created_at: string }>(
    'SELECT id, email, name, username, role, created_at FROM users WHERE id = ?',
    [userId],
  );
  if (!row) return null;

  const iso = new Date().toISOString();
  const sub = await db.get<{ tier: string; status: string; plan: string | null; expires_at: string | null; auto_renew: number }>(
    'SELECT tier, status, plan, expires_at, auto_renew FROM subscriptions WHERE user_id = ?',
    [userId],
  );
  const premiumActive = sub?.tier === 'premium' && sub.status === 'active' && (!sub.expires_at || sub.expires_at > iso);
  const credit = await db.get<{ premium_effect_credits_remaining: number }>(
    'SELECT premium_effect_credits_remaining FROM entitlements WHERE user_id = ?',
    [userId],
  );
  const latestPayment = await db.get<{ status: string; plan: string | null; created_at: string }>(
    'SELECT status, plan, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId],
  );

  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      username: row.username,
      role: row.role,
      createdAt: row.created_at,
      subscription: {
        tier: premiumActive ? 'premium' : 'free',
        plan: premiumActive ? (sub?.plan ?? null) : null,
        status: premiumActive ? 'active' : (sub?.status ?? 'none'),
        expiresAt: premiumActive ? (sub?.expires_at ?? null) : null,
        autoRenew: sub?.auto_renew === 1,
      },
      premiumEffectCreditsRemaining: credit?.premium_effect_credits_remaining ?? 1,
      latestPayment: latestPayment
        ? { status: latestPayment.status, plan: latestPayment.plan, createdAt: latestPayment.created_at }
        : null,
    },
  };
}

user.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const payload = await fullUserResponse(getDb(), req.userId!);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json(payload);
});

user.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
  const body = updateSchema.parse(req.body);
  const db = getDb();
  const username = body.username === undefined ? undefined : (body.username ?? null);
  if (body.name !== undefined) {
    await db.run('UPDATE users SET name = ?, updated_at = ? WHERE id = ?', [body.name, new Date().toISOString(), req.userId!]);
  }
  if (username !== undefined) {
    const dup = await db.get<{ id: string }>('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.userId]);
    if (dup) throw new ApiError(409, 'That username is already taken.');
    await db.run('UPDATE users SET username = ?, updated_at = ? WHERE id = ?', [username, new Date().toISOString(), req.userId!]);
  }
  const payload = await fullUserResponse(db, req.userId!);
  res.json(payload);
});

user.post('/password', requireAuth, async (req: AuthedRequest, res) => {
  const body = passwordSchema.parse(req.body);
  const db = getDb();
  const row = await db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [req.userId!]);
  if (!row || !(await verifyPassword(body.currentPassword, row.password_hash))) {
    throw new ApiError(401, 'Current password is incorrect.');
  }
  await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    await hashPassword(body.newPassword),
    new Date().toISOString(),
    req.userId!,
  ]);
  res.status(204).end();
});

user.delete('/account', requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  await createAudit(db, { action: 'ACCOUNT_DELETED', targetUserId: req.userId! });
  await db.run('DELETE FROM users WHERE id = ?', [req.userId!]);
  res.status(204).end();
});

user.get('/me/sessions', requireAuth, async (req: AuthedRequest, res) => {
  const rows = await getDb().all<{ id: string; device: string; created_at: string; expires_at: string }>(
    'SELECT id, device, created_at, expires_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC',
    [req.userId!],
  );
  res.json({ sessions: rows.map((r) => ({ id: r.id, device: r.device, createdAt: r.created_at, expiresAt: r.expires_at })) });
});

user.delete('/me/sessions/:sessionId', requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const row = await db.get<{ id: string; user_id: string }>('SELECT id, user_id FROM sessions WHERE id = ?', [req.params.sessionId]);
  if (!row || row.user_id !== req.userId) throw new ApiError(404, 'Session not found.');
  await revokeSession(db, row.id);
  res.status(204).end();
});

/* -------------------------- Notifications -------------------------- */

user.get('/notifications', requireAuth, async (req: AuthedRequest, res) => {
  const rows = await getDb().all<{ id: string; kind: string; title: string; message: string; read: number; created_at: string }>(
    'SELECT id, kind, title, message, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60',
    [req.userId!],
  );
  const unread = await getDb().get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0',
    [req.userId!],
  );
  res.json({
    notifications: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      message: r.message,
      read: r.read === 1,
      createdAt: r.created_at,
    })),
    unread: unread?.n ?? 0,
  });
});

user.post('/notifications/read', requireAuth, async (req: AuthedRequest, res) => {
  const body = z.object({ id: z.string().optional() }).parse(req.body ?? {});
  const db = getDb();
  if (body.id) {
    await db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [body.id, req.userId!]);
  } else {
    await db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.userId!]);
  }
  res.status(204).end();
});

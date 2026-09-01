import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const subscription = Router();

function tierFor(db: ReturnType<typeof getDb>, userId: string) {
  return db.get<{ tier: string; plan: string | null; status: string; expires_at: string | null; auto_renew: number }>(
    'SELECT tier, plan, status, expires_at, auto_renew FROM subscriptions WHERE user_id = ?',
    [userId],
  );
}

subscription.get('/status', requireAuth, async (req: AuthedRequest, res) => {
  const row = await tierFor(getDb(), req.userId!);
  const active = row?.tier === 'premium' && row.status === 'active' && (!row.expires_at || row.expires_at > new Date().toISOString());
  res.json({
    tier: active ? 'premium' : 'free',
    plan: active ? (row?.plan ?? null) : null,
    status: row?.status ?? 'none',
    expiresAt: row?.expires_at ?? null,
    autoRenew: row?.auto_renew === 1,
  });
});

/** Alias kept for API compatibility — same as /status. */
subscription.get('/verify', requireAuth, async (req: AuthedRequest, res) => {
  const row = await tierFor(getDb(), req.userId!);
  const active = row?.tier === 'premium' && row.status === 'active' && (!row.expires_at || row.expires_at > new Date().toISOString());
  res.json({
    tier: active ? 'premium' : 'free',
    plan: active ? (row?.plan ?? null) : null,
    status: row?.status ?? 'none',
    expiresAt: row?.expires_at ?? null,
    autoRenew: row?.auto_renew === 1,
  });
});

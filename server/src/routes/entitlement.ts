import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { FREE_TIER } from '../config/pricing.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const entitlement = Router();

const consumeSchema = z.object({ effectId: z.string().min(1).optional().default('') });

/**
 * Consumers call this when they start a premium effect they can't otherwise
 * afford. Server decrements the free trial credit, or rejects if none left
 * and the user isn't a paying subscriber.
 */
entitlement.post('/consume-premium-effect', requireAuth, async (req: AuthedRequest, res) => {
  const body = consumeSchema.parse(req.body);
  const db = getDb();
  const userId = req.userId!;

  const sub = await db.get<{ tier: string; status: string; expires_at: string | null }>(
    'SELECT tier, status, expires_at FROM subscriptions WHERE user_id = ?',
    [userId],
  );
  const premiumActive =
    sub?.tier === 'premium' && sub.status === 'active' && (!sub.expires_at || sub.expires_at > new Date().toISOString());
  if (premiumActive) {
    res.json({ allowed: true, reason: 'subscribed', effectId: body.effectId, creditsRemaining: null });
    return;
  }

  const credit = await db.get<{ premium_effect_credits_remaining: number }>(
    'SELECT premium_effect_credits_remaining FROM entitlements WHERE user_id = ?',
    [userId],
  );
  const remaining = credit?.premium_effect_credits_remaining ?? FREE_TIER.initialPremiumEffectCredits;
  if (remaining <= 0) {
    res.status(402).json({ allowed: false, reason: 'no-credits', effectId: body.effectId });
    return;
  }
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO entitlements (user_id, premium_effect_credits_remaining, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET premium_effect_credits_remaining = premium_effect_credits_remaining - 1, updated_at = ?`,
    [userId, remaining - 1, now, now],
  );
  res.json({ allowed: true, reason: 'trial-credit', effectId: body.effectId, creditsRemaining: remaining - 1 });
});

entitlement.get('/status', requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const userId = req.userId!;
  const sub = await db.get<{ tier: string; status: string; expires_at: string | null }>(
    'SELECT tier, status, expires_at FROM subscriptions WHERE user_id = ?',
    [userId],
  );
  const premiumActive =
    sub?.tier === 'premium' && sub.status === 'active' && (!sub.expires_at || sub.expires_at > new Date().toISOString());
  const credit = await db.get<{ premium_effect_credits_remaining: number }>(
    'SELECT premium_effect_credits_remaining FROM entitlements WHERE user_id = ?',
    [userId],
  );
  res.json({
    tier: premiumActive ? 'premium' : 'free',
    creditsRemaining: premiumActive ? null : (credit?.premium_effect_credits_remaining ?? FREE_TIER.initialPremiumEffectCredits),
  });
});

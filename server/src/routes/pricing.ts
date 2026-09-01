import { Router } from 'express';
import { PRICING, FREE_TIER, yearlySavings } from '../config/pricing.js';

export const pricing = Router();

/** Public pricing the desktop app shows. Server config is the source of truth. */
pricing.get('/', (_req, res) => {
  res.json({
    currency: 'NGN',
    monthly: PRICING.monthly,
    yearly: PRICING.yearly,
    yearlySavings: yearlySavings(),
    freeTier: { premiumEffectCredits: FREE_TIER.initialPremiumEffectCredits },
  });
});

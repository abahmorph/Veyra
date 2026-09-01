/**
 * Pricing + entitlement configuration.
 *
 * NOTE: This file is for CLIENT-SIDE DISPLAY ONLY.
 * The server (`server/src/config/pricing.ts`) is the source of truth for
 * billing amounts and entitlements. The backend ALWAYS verifies subscription
 * state; never trust the frontend to determine premium access.
 */

export const CURRENCY = 'NGN';

export interface PriceConfig {
  monthly: number;
  yearly: number;
  yearlySavingsPercent: number;
}

export const PRICING: PriceConfig = {
  monthly: 6000,
  yearly: 60000,
  yearlySavingsPercent: 17,
};

export const FREE_TIER = {
  /** Every new account starts with one free premium effect experience. */
  initialPremiumEffectCredits: 1,
  freeEffectId: 'beauty',
};

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export function yearlyEquivalentMonthly(yearly: number): number {
  return Math.round(yearly / 12);
}

export function computeYearlySavings(config: PriceConfig = PRICING): number {
  return config.monthly * 12 - config.yearly;
}

export interface SubscriptionInfo {
  tier: 'free' | 'premium';
  plan: 'monthly' | 'yearly' | null;
  expiresAt: string | null;
  autoRenew: boolean;
}

export function isPremium(subscription: SubscriptionInfo | null | undefined): boolean {
  if (!subscription) return false;
  if (subscription.tier === 'premium' && subscription.expiresAt) {
    return new Date(subscription.expiresAt).getTime() > Date.now();
  }
  return subscription.tier === 'premium';
}

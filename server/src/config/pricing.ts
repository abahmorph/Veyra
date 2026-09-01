/**
 * Pricing + entitlements — SINGLE SOURCE OF TRUTH on the backend.
 * Prices live in the `payment_settings` row (editable from the admin panel),
 * falling back to environment overrides, then the defaults below.
 * The client display mirrors this, but the server always enforces it.
 */

import { getDb } from '../db/connection.js';
import { env } from './env.js';

export interface PriceConfig {
  monthly: number;
  yearly: number;
  currency: string;
}

export const PRICING: PriceConfig = {
  monthly: env.priceMonthly,
  yearly: env.priceYearly,
  currency: 'NGN',
};

export const FREE_TIER = {
  /** New accounts begin with one free premium-effect experience. */
  initialPremiumEffectCredits: 1,
};

export interface PaymentSettingsRow {
  id: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  payment_instructions: string;
  currency: string;
  monthly_price: number;
  yearly_price: number;
  updated_at: string;
  updated_by: string | null;
}

export async function getPaymentSettingsRow(db = getDb()): Promise<PaymentSettingsRow | null> {
  return (await db.get<PaymentSettingsRow>('SELECT * FROM payment_settings WHERE id = 1')) ?? null;
}

/** Server-authoritative pricing read from the payment_settings row. */
export async function getPricingConfig(db = getDb()): Promise<PriceConfig> {
  const row = await getPaymentSettingsRow(db);
  if (!row) return { ...PRICING };
  return {
    monthly: Number(row.monthly_price) || PRICING.monthly,
    yearly: Number(row.yearly_price) || PRICING.yearly,
    currency: row.currency || 'NGN',
  };
}

export function yearlySavings(pricing: PriceConfig = PRICING): number {
  return pricing.monthly * 12 - pricing.yearly;
}

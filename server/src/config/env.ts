import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 8787),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpirySeconds: Number(process.env.JWT_EXPIRY_SECONDS ?? 60 * 60 * 24 * 14),
  dbDriver: (process.env.DB_DRIVER ?? 'sqlite') as 'sqlite' | 'postgres',
  dbPath: process.env.DB_PATH ?? './data/veyra.sqlite',
  databaseUrl: process.env.DATABASE_URL ?? '',
  /** Fallback prices used only when no payment_settings row exists yet. */
  priceMonthly: Number(process.env.VEYRA_PRICE_MONTHLY ?? 6000),
  priceYearly: Number(process.env.VEYRA_PRICE_YEARLY ?? 60000),
  /** Secret that authorises POST /api/admin/bootstrap (creating the first admin). */
  adminBootstrapToken: process.env.VEYRA_ADMIN_BOOTSTRAP_TOKEN ?? '',
  /** Optional env-based initial administrator. Never used when empty. */
  adminEmail: process.env.VEYRA_ADMIN_EMAIL ?? '',
  adminPassword: process.env.VEYRA_ADMIN_PASSWORD ?? '',
  adminName: process.env.VEYRA_ADMIN_NAME ?? 'Administrator',
  /** Bank transfer destination shown on the Premium screen (seeded into
   *  payment_settings on boot when no destination is configured yet). */
  bankName: process.env.VEYRA_BANK_NAME ?? '',
  bankAccountName: process.env.VEYRA_BANK_ACCOUNT_NAME ?? '',
  bankAccountNumber: process.env.VEYRA_BANK_ACCOUNT_NUMBER ?? '',
  bankInstructions: process.env.VEYRA_BANK_INSTRUCTIONS ?? '',
  currency: process.env.VEYRA_CURRENCY ?? 'NGN',
};

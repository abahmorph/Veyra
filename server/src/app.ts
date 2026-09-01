import express from 'express';
import cors from 'cors';
import { migrate } from './db/schema.js';
import { getDb } from './db/connection.js';
import { auth } from './routes/auth.js';
import { user } from './routes/user.js';
import { pricing } from './routes/pricing.js';
import { subscription } from './routes/subscription.js';
import { entitlement } from './routes/entitlement.js';
import { payments } from './routes/payments.js';
import { admin } from './routes/admin.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { apiRateLimit } from './middleware/rateLimit.js';

export function createApp(): express.Express {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'veyra-server' }));

  app.use('/api', apiRateLimit);
  app.use('/api/pricing', pricing);
  app.use('/api/auth', auth);
  app.use('/api/user', user);
  app.use('/api/subscription', subscription);
  app.use('/api/entitlement', entitlement);
  app.use('/api/payments', payments);
  app.use('/api/admin', admin);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export async function initDb(): Promise<void> {
  await migrate(getDb());
}

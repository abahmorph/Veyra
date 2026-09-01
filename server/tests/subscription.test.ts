import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { PRICING } from '../src/config/pricing.js';
import { createApp, initDb } from '../src/app.js';
import { getDb, resetDbForTests } from '../src/db/connection.js';

env.dbPath = ':memory:';
env.adminBootstrapToken = 'test-admin-token';

const app = createApp();

beforeAll(async () => {
  await initDb();
});
beforeEach(async () => {
  resetDbForTests();
  await initDb();
});
afterAll(async () => {
  await getDb().close();
});

describe('pricing', () => {
  it('returns server-owned pricing', async () => {
    const res = await request(app).get('/api/pricing');
    expect(res.status).toBe(200);
    expect(res.body.monthly).toBe(PRICING.monthly);
    expect(res.body.yearly).toBe(PRICING.yearly);
    expect(res.body.yearlySavings).toBe(PRICING.monthly * 12 - PRICING.yearly);
    expect(res.body.freeTier.premiumEffectCredits).toBe(1);
  });
});

describe('subscription (manual payment flow)', () => {
  function bootstrapAdmin() {
    return request(app)
      .post('/api/admin/bootstrap')
      .set('x-admin-bootstrap-token', 'test-admin-token')
      .send({ email: 'admin@example.com', password: 'Admin1234', name: 'Admin' });
  }

  async function signupUser(email: string) {
    const s = await request(app).post('/api/auth/signup').send({ email, password: 'Password123', name: 'User' });
    return s.body.token as string;
  }

  async function adminLogin() {
    const r = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'Admin1234' });
    return r.body.token as string;
  }

  it('submits a payment, admin approves it, user becomes premium', async () => {
    await bootstrapAdmin().expect(201);
    const token = await signupUser('sub@example.com');

    const status = await request(app).get('/api/subscription/status').set('Authorization', `Bearer ${token}`);
    expect(status.body.tier).toBe('free');

    const details = await request(app).get('/api/payments/details').set('Authorization', `Bearer ${token}`);
    expect(details.status).toBe(200);
    expect(details.body.monthly).toBe(PRICING.monthly);

    const submitted = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'monthly', reference: 'TRX-MANUAL-001', paymentDate: '2026-08-01' });
    expect(submitted.status).toBe(201);
    expect(submitted.body.payment.status).toBe('pending');
    const paymentId = submitted.body.payment.id;

    const adminToken = await adminLogin();
    const approve = await request(app)
      .post(`/api/admin/payments/${paymentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.expiresAt).toBeTruthy();

    const after = await request(app).get('/api/subscription/status').set('Authorization', `Bearer ${token}`);
    expect(after.body.tier).toBe('premium');
    expect(after.body.plan).toBe('monthly');

    const consume = await request(app)
      .post('/api/entitlement/consume-premium-effect')
      .set('Authorization', `Bearer ${token}`)
      .send({ effectId: 'horror' });
    expect(consume.status).toBe(200);
    expect(consume.body.reason).toBe('subscribed');
  });

  it('rejects an invalid plan', async () => {
    const token = await signupUser('badplan@example.com');
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'weekly', reference: 'TRX-BAD', paymentDate: '2026-08-01' });
    expect(res.status).toBe(422);
  });

  it('rejects a duplicate transaction reference', async () => {
    const token = await signupUser('dup@example.com');
    const body = { plan: 'yearly', reference: 'TRX-DUP-001', paymentDate: '2026-08-01' };
    await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send(body).expect(201);
    const dup = await request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send(body);
    expect(dup.status).toBe(409);
  });

  it('a declined payment does not grant premium', async () => {
    await bootstrapAdmin().expect(201);
    const token = await signupUser('decl@example.com');
    const submitted = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'monthly', reference: 'TRX-DEC-001', paymentDate: '2026-08-01' })
      .expect(201);

    const adminToken = await adminLogin();
    await request(app)
      .post(`/api/admin/payments/${submitted.body.payment.id}/decline`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Reference could not be verified.' })
      .expect(204);

    const after = await request(app).get('/api/subscription/status').set('Authorization', `Bearer ${token}`);
    expect(after.body.tier).toBe('free');
  });

  it('requires a valid payment date', async () => {
    const token = await signupUser('nodate@example.com');
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'monthly', reference: 'TRX-NODATE', paymentDate: 'not-a-date' });
    expect(res.status).toBe(422);
  });
});

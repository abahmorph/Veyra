import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { createApp, initDb } from '../src/app.js';
import { getDb, resetDbForTests } from '../src/db/connection.js';

env.dbPath = ':memory:';

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

async function signup(email = 'e@example.com') {
  return request(app).post('/api/auth/signup').send({ email, password: 'Password123', name: 'E' });
}

describe('entitlement', () => {
  it('gives a fresh account one trial credit', async () => {
    const s = await signup();
    const res = await request(app).get('/api/entitlement/status').set('Authorization', `Bearer ${s.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('free');
    expect(res.body.creditsRemaining).toBe(1);
  });

  it('consumes the trial credit once', async () => {
    const s = await signup('consume@example.com');
    const token = s.body.token;
    const first = await request(app)
      .post('/api/entitlement/consume-premium-effect')
      .set('Authorization', `Bearer ${token}`)
      .send({ effectId: 'horror' });
    expect(first.status).toBe(200);
    expect(first.body.allowed).toBe(true);
    expect(first.body.reason).toBe('trial-credit');
    expect(first.body.creditsRemaining).toBe(0);

    const second = await request(app)
      .post('/api/entitlement/consume-premium-effect')
      .set('Authorization', `Bearer ${token}`)
      .send({ effectId: 'horror' });
    expect(second.status).toBe(402);
    expect(second.body.allowed).toBe(false);
  });

  it('rejects unauthenticated consumption', async () => {
    const res = await request(app).post('/api/entitlement/consume-premium-effect').send({ effectId: 'horror' });
    expect(res.status).toBe(401);
  });
});

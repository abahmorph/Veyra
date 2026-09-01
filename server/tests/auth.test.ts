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

describe('auth', () => {
  it('signs up, logs in, and returns the user', async () => {
    const signup = await request(app).post('/api/auth/signup').send({ email: 'ada@example.com', password: 'Password123', name: 'Ada' });
    expect(signup.status).toBe(201);
    expect(signup.body.user.email).toBe('ada@example.com');
    expect(signup.body.token).toBeTruthy();

    const me = await request(app).get('/api/user/me').set('Authorization', `Bearer ${signup.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.name).toBe('Ada');

    const login = await request(app).post('/api/auth/login').send({ email: 'ada@example.com', password: 'Password123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it('rejects duplicate email', async () => {
    const body = { email: 'dup@example.com', password: 'Password123', name: 'Dup' };
    await request(app).post('/api/auth/signup').send(body).expect(201);
    const dup = await request(app).post('/api/auth/signup').send(body);
    expect(dup.status).toBe(409);
  });

  it('rejects wrong password', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'w@example.com', password: 'Password123', name: 'W' }).expect(201);
    const bad = await request(app).post('/api/auth/login').send({ email: 'w@example.com', password: 'wrong-pass' });
    expect(bad.status).toBe(401);
  });

  it('validates password length', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'short@example.com', password: 'abc' });
    expect(res.status).toBe(422);
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  it('logs out and revokes the session', async () => {
    const s = await request(app).post('/api/auth/signup').send({ email: 'out@example.com', password: 'Password123', name: 'Out' });
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${s.body.token}`).expect(204);
    const me = await request(app).get('/api/user/me').set('Authorization', `Bearer ${s.body.token}`);
    expect(me.status).toBe(401);
  });
});

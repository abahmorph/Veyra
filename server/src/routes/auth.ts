import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { ensureUserRows } from '../db/schema.js';
import { ApiError } from '../middleware/errors.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { createSession, hashToken, revokeSession } from '../auth/jwt.js';
import { hashPassword, newId, newToken, verifyPassword } from '../auth/passwords.js';
import { env } from '../config/env.js';

export const auth = Router();

const EMAIL = z.string().trim().toLowerCase().email().max(255);
const NAME = z.string().trim().min(1).max(80);
const USERNAME = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{3,24}$/i, 'Username must be 3–24 characters (letters, numbers, underscores).')
  .optional();
const PASSWORD = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(256)
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[0-9]/, 'Password must include a number.');

const signupSchema = z.object({ email: EMAIL, password: PASSWORD, name: NAME, username: USERNAME });
const loginSchema = z.object({ email: EMAIL, password: z.string().min(1) });
const passwordResetRequestSchema = z.object({ email: EMAIL });
const passwordResetConfirmSchema = z.object({ token: z.string().min(16), password: PASSWORD });

interface PublicUserRow {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: string;
  created_at: string;
}

function publicUser(u: PublicUserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    username: u.username,
    role: u.role,
    createdAt: u.created_at,
  };
}

auth.post('/signup', authRateLimit, async (req, res) => {
  const body = signupSchema.parse(req.body);
  const db = getDb();
  const existing = await db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', [body.email]);
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  const id = newId();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO users (id, email, name, username, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`,
    [id, body.email, body.name, body.username ?? null, await hashPassword(body.password), now, now],
  );
  await ensureUserRows(db, id);

  const { token, sessionId } = await createSession(db, id, req.headers['user-agent']?.slice(0, 120) ?? 'unknown');
  const user: PublicUserRow = { id, email: body.email, name: body.name, username: body.username ?? null, role: 'user', created_at: now };
  res.status(201).json({ user: publicUser(user), token, sessionId });
});

auth.post('/login', authRateLimit, async (req, res) => {
  const body = loginSchema.parse(req.body);
  const db = getDb();
  const user = await db.get<PublicUserRow & { password_hash: string }>(
    'SELECT * FROM users WHERE email = ?',
    [body.email],
  );
  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  const { token, sessionId } = await createSession(db, user.id, req.headers['user-agent']?.slice(0, 120) ?? 'unknown');
  res.json({ user: publicUser(user), token, sessionId });
});

auth.post('/logout', requireAuth, async (req: AuthedRequest, res) => {
  if (req.sessionId) await revokeSession(getDb(), req.sessionId);
  res.status(204).end();
});

auth.post('/password/reset', authRateLimit, async (req, res) => {
  const body = passwordResetRequestSchema.parse(req.body);
  const db = getDb();
  const user = await db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', [body.email]);
  if (!user) {
    // Do not reveal whether an account exists.
    res.status(202).json({ message: 'If that account exists, a reset link was sent.' });
    return;
  }
  const token = newToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.run(
    `INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
    [newId(), user.id, hashToken(token), expiresAt],
  );
  // In production, email a URL like https://app.veyra.example/reset?token=….
  if (env.nodeEnv !== 'production') {
    console.info(`[veyra:server] password reset token for ${body.email}: ${token}`);
  }
  res.status(202).json({ message: 'If that account exists, a reset link was sent.' });
});

auth.post('/password/reset/confirm', authRateLimit, async (req, res) => {
  const body = passwordResetConfirmSchema.parse(req.body);
  const db = getDb();
  const row = await db.get<{ id: string; user_id: string; expires_at: string; used: number }>(
    `SELECT * FROM password_resets WHERE token_hash = ?`,
    [hashToken(body.token)],
  );
  if (!row || row.used === 1 || row.expires_at < new Date().toISOString()) {
    throw new ApiError(400, 'This reset link is invalid or expired.');
  }
  const now = new Date().toISOString();
  await db.run(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [
    await hashPassword(body.password),
    now,
    row.user_id,
  ]);
  await db.run(`UPDATE password_resets SET used = 1 WHERE id = ?`, [row.id]);
  await db.run(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [now, row.user_id]);
  res.status(204).end();
});

/** Revoke any session by id (device management). */
auth.delete('/sessions/:sessionId', requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const row = await db.get<{ id: string; user_id: string }>('SELECT id, user_id FROM sessions WHERE id = ?', [req.params.sessionId]);
  if (!row || row.user_id !== req.userId) throw new ApiError(404, 'Session not found.');
  await revokeSession(db, row.id);
  res.status(204).end();
});

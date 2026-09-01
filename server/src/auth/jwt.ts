import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Db } from '../db/connection.js';
import { newToken } from './passwords.js';

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  device: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function signJwt(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpirySeconds });
}

export function verifyJwt(token: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    return payload;
  } catch {
    return null;
  }
}

/** Create an opaque session token persisted (hashed) for device management. */
export async function createSession(db: Db, userId: string, device = 'unknown'): Promise<{ token: string; sessionId: string }> {
  const token = newToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.jwtExpirySeconds * 1000);
  const id = randomUUID();
  await db.run(
    `INSERT INTO sessions (id, user_id, token_hash, device, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, hashToken(token), device, now.toISOString(), expiresAt.toISOString()],
  );
  return { token, sessionId: id };
}

export async function findSessionByToken(db: Db, token: string): Promise<SessionRow | undefined> {
  return db.get<SessionRow>(
    `SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    [hashToken(token), new Date().toISOString()],
  );
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db.run(`UPDATE sessions SET revoked_at = ? WHERE id = ?`, [new Date().toISOString(), sessionId]);
}

import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { findSessionByToken } from '../auth/jwt.js';

export interface AuthedRequest extends Request {
  userId?: string;
  sessionId?: string;
  role?: 'user' | 'admin';
}

/** Require a valid session token (Authorization: Bearer <token>). */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = await findSessionByToken(getDb(), token);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await getDb().get<{ role: string; suspended: number }>(
    'SELECT role, suspended FROM users WHERE id = ?',
    [session.user_id],
  );
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (user.suspended === 1) {
    res.status(403).json({ error: 'This account has been suspended.' });
    return;
  }
  req.userId = session.user_id;
  req.sessionId = session.id;
  req.role = user.role === 'admin' ? 'admin' : 'user';
  next();
}

/** Require an authenticated administrator. Frontend guards are never enough. */
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.role !== 'admin') {
      res.status(403).json({ error: 'Administrator access required.' });
      return;
    }
    next();
  });
}

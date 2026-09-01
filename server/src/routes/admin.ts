import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/errors.js';
import { requireAdmin, type AuthedRequest } from '../middleware/auth.js';
import { hashPassword, newId } from '../auth/passwords.js';
import { ensureUserRows } from '../db/schema.js';
import { getPricingConfig } from '../config/pricing.js';
import {
  activatePremium,
  createAudit,
  createNotification,
  revokePremium,
} from '../db/services.js';

export const admin = Router();

/* ------------------------------------------------------------------ */
/* Bootstrap: create the very first administrator. Only enabled while  */
/* VEYRA_ADMIN_BOOTSTRAP_TOKEN is set; the header must match it.       */
/* ------------------------------------------------------------------ */
const bootstrapSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(256),
  name: z.string().trim().min(1).max(80).default('Administrator'),
});

admin.post('/bootstrap', async (req, res) => {
  if (!env.adminBootstrapToken) throw new ApiError(403, 'Admin bootstrap is not enabled on this server.');
  const provided = (req.headers['x-admin-bootstrap-token'] ?? '') as string;
  if (provided !== env.adminBootstrapToken) throw new ApiError(403, 'Invalid bootstrap token.');

  const body = bootstrapSchema.parse(req.body);
  const db = getDb();
  const existing = await db.get<{ id: string }>('SELECT id FROM users WHERE role = ?', ['admin']);
  if (existing) throw new ApiError(409, 'An administrator already exists.');

  const id = newId();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?, ?)`,
    [id, body.email, body.name, await hashPassword(body.password), now, now],
  );
  await ensureUserRows(db, id);
  await createAudit(db, { action: 'ADMIN_CREATED', targetUserId: id, newState: { email: body.email } });
  res.status(201).json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Everything below requires an authenticated administrator.           */
/* ------------------------------------------------------------------ */
admin.use(requireAdmin);

function now(): string {
  return new Date().toISOString();
}

async function adminName(db: ReturnType<typeof getDb>, id: string): Promise<string> {
  const row = await db.get<{ name: string }>('SELECT name FROM users WHERE id = ?', [id]);
  return row?.name ?? '';
}

const PREMIUM_ACTIVE_SQL = `tier = 'premium' AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)`;

admin.get('/dashboard', async (_req: AuthedRequest, res) => {
  const db = getDb();
  const iso = now();
  const [totalUsers, premiumUsers, pending, approved, declined, monthlyRev, yearlyRev] = await Promise.all([
    db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users'),
    db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM subscriptions WHERE ${PREMIUM_ACTIVE_SQL}`, [iso]),
    db.get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE status = 'pending'"),
    db.get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE status = 'approved'"),
    db.get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE status = 'declined'"),
    db.get<{ n: number }>(`SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE status = 'approved' AND plan = 'monthly'`),
    db.get<{ n: number }>(`SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE status = 'approved' AND plan = 'yearly'`),
  ]);

  const recent = await db.all<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    plan: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
  }>(
    `SELECT p.id, p.user_id, u.name, u.email, p.plan, p.amount, p.currency, p.status, p.created_at
     FROM payments p JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC LIMIT 8`,
  );

  res.json({
    stats: {
      totalUsers: totalUsers?.n ?? 0,
      freeUsers: (totalUsers?.n ?? 0) - (premiumUsers?.n ?? 0),
      premiumUsers: premiumUsers?.n ?? 0,
      pendingPayments: pending?.n ?? 0,
      approvedPayments: approved?.n ?? 0,
      declinedPayments: declined?.n ?? 0,
      monthlyRevenue: monthlyRev?.n ?? 0,
      yearlyRevenue: yearlyRev?.n ?? 0,
    },
    recentPayments: recent.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      email: r.email,
      plan: r.plan,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      createdAt: r.created_at,
    })),
  });
});

/* ------------------------------ Users ------------------------------ */

admin.get('/users', async (req: AuthedRequest, res) => {
  const db = getDb();
  const iso = now();
  const search = ((req.query.search as string | undefined) ?? '').trim();
  const where = search
    ? `AND (u.name LIKE ? OR u.email LIKE ? OR COALESCE(u.username,'') LIKE ?)`
    : '';
  const params: unknown[] = [];
  if (search) {
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const rows = await db.all<{
    id: string;
    name: string;
    email: string;
    username: string | null;
    role: string;
    suspended: number;
    created_at: string;
    tier: string | null;
    sub_status: string | null;
    plan: string | null;
    expires_at: string | null;
  }>(
    `SELECT u.id, u.name, u.email, u.username, u.role, u.suspended, u.created_at,
            s.tier, s.status AS sub_status, s.plan, s.expires_at
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE 1=1 ${where}
     ORDER BY u.created_at DESC LIMIT 200`,
    params,
  );

  const users = [];
  for (const r of rows) {
    const premiumActive = r.tier === 'premium' && r.sub_status === 'active' && (!r.expires_at || r.expires_at > iso);
    const latest = await db.get<{ status: string }>(
      'SELECT status FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [r.id],
    );
    users.push({
      id: r.id,
      name: r.name,
      email: r.email,
      username: r.username,
      role: r.role,
      suspended: r.suspended === 1,
      createdAt: r.created_at,
      plan: premiumActive ? r.plan : null,
      premiumStatus: premiumActive ? 'active' : r.tier === 'premium' ? 'expired' : 'free',
      premiumExpiresAt: r.expires_at,
      paymentStatus: latest?.status ?? 'none',
    });
  }
  res.json({ users });
});

admin.get('/users/:id', async (req: AuthedRequest, res) => {
  const db = getDb();
  const row = await db.get<{
    id: string;
    name: string;
    email: string;
    username: string | null;
    role: string;
    suspended: number;
    created_at: string;
  }>('SELECT id, name, email, username, role, suspended, created_at FROM users WHERE id = ?', [req.params.id]);
  if (!row) throw new ApiError(404, 'User not found.');

  const sub = await db.get<{ tier: string; status: string; plan: string | null; expires_at: string | null; approved_at: string | null; approved_by: string | null }>(
    'SELECT tier, status, plan, expires_at, approved_at, approved_by FROM subscriptions WHERE user_id = ?',
    [row.id],
  );
  const payments = await db.all<{
    id: string;
    plan: string;
    amount: number;
    currency: string;
    reference: string;
    status: string;
    created_at: string;
  }>('SELECT id, plan, amount, currency, reference, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC', [row.id]);

  res.json({ user: { ...row, suspended: row.suspended === 1 }, subscription: sub ?? null, payments });
});

const suspendSchema = z.object({ reason: z.string().trim().max(500).optional().default('') });
admin.post('/users/:id/suspend', async (req: AuthedRequest, res) => {
  const body = suspendSchema.parse(req.body);
  const db = getDb();
  const target = await db.get<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = ?', [req.params.id]);
  if (!target) throw new ApiError(404, 'User not found.');
  await db.run('UPDATE users SET suspended = 1, updated_at = ? WHERE id = ?', [now(), target.id]);
  await createNotification(db, target.id, 'account_suspended', 'Account suspended', body.reason || 'Your account was suspended. Contact support for details.');
  await createAudit(db, {
    actorId: req.userId,
    actorName: await adminName(db, req.userId!),
    action: 'USER_SUSPENDED',
    targetUserId: target.id,
    newState: { suspended: true },
    detail: body.reason || undefined,
  });
  res.status(204).end();
});

admin.post('/users/:id/restore', async (req: AuthedRequest, res) => {
  const db = getDb();
  const target = await db.get<{ id: string }>('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!target) throw new ApiError(404, 'User not found.');
  await db.run('UPDATE users SET suspended = 0, updated_at = ? WHERE id = ?', [now(), target.id]);
  await createAudit(db, {
    actorId: req.userId,
    actorName: await adminName(db, req.userId!),
    action: 'USER_RESTORED',
    targetUserId: target.id,
    newState: { suspended: false },
  });
  res.status(204).end();
});

const grantSchema = z.object({ plan: z.enum(['monthly', 'yearly']) });
admin.post('/users/:id/grant-premium', async (req: AuthedRequest, res) => {
  const body = grantSchema.parse(req.body);
  const db = getDb();
  const target = await db.get<{ id: string }>('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!target) throw new ApiError(404, 'User not found.');
  const expiresAt = await activatePremium(db, target.id, body.plan, req.userId!, await adminName(db, req.userId!));
  res.json({ ok: true, expiresAt });
});

admin.post('/users/:id/revoke-premium', async (req: AuthedRequest, res) => {
  const db = getDb();
  const target = await db.get<{ id: string }>('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!target) throw new ApiError(404, 'User not found.');
  await revokePremium(db, target.id, req.userId!, await adminName(db, req.userId!));
  res.status(204).end();
});

/* ---------------------------- Payments ----------------------------- */

admin.get('/payments', async (req: AuthedRequest, res) => {
  const db = getDb();
  const status = (req.query.status as string | undefined) ?? '';
  const where = status ? 'WHERE p.status = ?' : '';
  const params = status ? [status] : [];
  const rows = await db.all<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    plan: string;
    amount: number;
    currency: string;
    reference: string;
    status: string;
    payment_date: string | null;
    note: string | null;
    decline_reason: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
    has_proof: number;
  }>(
    `SELECT p.id, p.user_id, u.name, u.email, p.plan, p.amount, p.currency, p.reference, p.status,
            p.payment_date, p.note, p.decline_reason, p.reviewed_by, p.reviewed_at, p.created_at,
            EXISTS(SELECT 1 FROM payment_proofs pr WHERE pr.payment_id = p.id) AS has_proof
     FROM payments p JOIN users u ON u.id = p.user_id
     ${where}
     ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, p.created_at DESC
     LIMIT 300`,
    params,
  );
  res.json({
    payments: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      email: r.email,
      plan: r.plan,
      amount: r.amount,
      currency: r.currency,
      reference: r.reference,
      status: r.status,
      paymentDate: r.payment_date,
      note: r.note,
      declineReason: r.decline_reason,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      createdAt: r.created_at,
      hasProof: r.has_proof === 1,
    })),
  });
});

admin.get('/payments/:id', async (req: AuthedRequest, res) => {
  const db = getDb();
  const row = await db.get<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    plan: string;
    amount: number;
    currency: string;
    reference: string;
    status: string;
    payment_date: string | null;
    note: string | null;
    decline_reason: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
  }>(
    `SELECT p.id, p.user_id, u.name, u.email, p.plan, p.amount, p.currency, p.reference, p.status,
            p.payment_date, p.note, p.decline_reason, p.reviewed_by, p.reviewed_at, p.created_at
     FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    [req.params.id],
  );
  if (!row) throw new ApiError(404, 'Payment not found.');

  const proof = await db.get<{ id: string; file_name: string; file_type: string; data: string; size: number; created_at: string }>(
    'SELECT id, file_name, file_type, data, size, created_at FROM payment_proofs WHERE payment_id = ? LIMIT 1',
    [row.id],
  );

  res.json({
    payment: {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      plan: row.plan,
      amount: row.amount,
      currency: row.currency,
      reference: row.reference,
      status: row.status,
      paymentDate: row.payment_date,
      note: row.note,
      declineReason: row.decline_reason,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
    },
    proof: proof
      ? {
          id: proof.id,
          fileName: proof.file_name,
          fileType: proof.file_type,
          data: proof.data,
          size: proof.size,
          createdAt: proof.created_at,
        }
      : null,
  });
});

const approveSchema = z.object({ plan: z.enum(['monthly', 'yearly']).optional() });
admin.post('/payments/:id/approve', async (req: AuthedRequest, res) => {
  const body = approveSchema.parse(req.body ?? {});
  const db = getDb();
  const payment = await db.get<{ id: string; user_id: string; plan: string; amount: number; currency: string; reference: string; status: string }>(
    'SELECT id, user_id, plan, amount, currency, reference, status FROM payments WHERE id = ?',
    [req.params.id],
  );
  if (!payment) throw new ApiError(404, 'Payment not found.');
  if (payment.status !== 'pending') throw new ApiError(409, 'Only pending payments can be approved.');

  const plan = (body.plan ?? payment.plan) as 'monthly' | 'yearly';
  const expiresAt = await activatePremium(db, payment.user_id, plan, req.userId!, await adminName(db, req.userId!));

  const reviewedAt = now();
  await db.run(
    `UPDATE payments SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
    [reviewedAt, req.userId, payment.id],
  );
  await createNotification(
    db,
    payment.user_id,
    'payment_approved',
    'Payment Approved 🎉',
    'Your Veyra Premium subscription is now active.',
  );
  await createAudit(db, {
    actorId: req.userId,
    actorName: await adminName(db, req.userId!),
    action: 'PAYMENT_APPROVED',
    targetUserId: payment.user_id,
    paymentId: payment.id,
    previousState: { status: 'pending', plan: payment.plan, reference: payment.reference },
    newState: { status: 'approved', plan, expiresAt },
  });
  res.json({ ok: true, expiresAt });
});

const declineSchema = z.object({ reason: z.string().trim().min(3).max(500) });
admin.post('/payments/:id/decline', async (req: AuthedRequest, res) => {
  const body = declineSchema.parse(req.body);
  const db = getDb();
  const payment = await db.get<{ id: string; user_id: string; plan: string; amount: number; currency: string; reference: string; status: string }>(
    'SELECT id, user_id, plan, amount, currency, reference, status FROM payments WHERE id = ?',
    [req.params.id],
  );
  if (!payment) throw new ApiError(404, 'Payment not found.');
  if (payment.status !== 'pending') throw new ApiError(409, 'Only pending payments can be declined.');

  const reviewedAt = now();
  await db.run(
    `UPDATE payments SET status = 'declined', reviewed_at = ?, reviewed_by = ?, decline_reason = ? WHERE id = ?`,
    [reviewedAt, req.userId, body.reason, payment.id],
  );
  await createNotification(
    db,
    payment.user_id,
    'payment_declined',
    'Payment Declined',
    `Your payment could not be confirmed. Reason: ${body.reason}`,
  );
  await createAudit(db, {
    actorId: req.userId,
    actorName: await adminName(db, req.userId!),
    action: 'PAYMENT_DECLINED',
    targetUserId: payment.user_id,
    paymentId: payment.id,
    previousState: { status: 'pending', plan: payment.plan, reference: payment.reference },
    newState: { status: 'declined', reason: body.reason },
  });
  res.status(204).end();
});

/* ------------------------ Settings: payments ----------------------- */

const settingsSchema = z.object({
  bankName: z.string().trim().max(120).default(''),
  accountName: z.string().trim().max(120).default(''),
  accountNumber: z.string().trim().max(40).default(''),
  paymentInstructions: z.string().trim().max(2000).default(''),
  currency: z.string().trim().max(8).default('NGN'),
  monthly: z.number().int().min(1).max(100_000_000),
  yearly: z.number().int().min(1).max(1_000_000_000),
});

admin.get('/settings/payment', async (_req: AuthedRequest, res) => {
  const db = getDb();
  const pricing = await getPricingConfig(db);
  const row = await db.get<{
    bank_name: string;
    account_name: string;
    account_number: string;
    payment_instructions: string;
    currency: string;
    updated_at: string;
    updated_by: string | null;
  }>('SELECT bank_name, account_name, account_number, payment_instructions, currency, updated_at, updated_by FROM payment_settings WHERE id = 1');
  res.json({
    bankName: row?.bank_name ?? '',
    accountName: row?.account_name ?? '',
    accountNumber: row?.account_number ?? '',
    paymentInstructions: row?.payment_instructions ?? '',
    currency: row?.currency ?? pricing.currency,
    monthly: pricing.monthly,
    yearly: pricing.yearly,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  });
});

admin.put('/settings/payment', async (req: AuthedRequest, res) => {
  const body = settingsSchema.parse(req.body);
  const db = getDb();
  const by = await adminName(db, req.userId!);
  await db.run(
    `UPDATE payment_settings
     SET bank_name = ?, account_name = ?, account_number = ?, payment_instructions = ?,
         currency = ?, monthly_price = ?, yearly_price = ?, updated_at = ?, updated_by = ?
     WHERE id = 1`,
    [
      body.bankName,
      body.accountName,
      body.accountNumber,
      body.paymentInstructions,
      body.currency,
      body.monthly,
      body.yearly,
      now(),
      by,
    ],
  );
  await createAudit(db, {
    actorId: req.userId,
    actorName: by,
    action: 'PAYMENT_SETTINGS_CHANGED',
    previousState: { action: 'before' },
    newState: { monthly: body.monthly, yearly: body.yearly, currency: body.currency },
  });
  res.json({ ok: true });
});

/* ----------------------------- Audit log --------------------------- */

admin.get('/audit', async (req: AuthedRequest, res) => {
  const db = getDb();
  const action = ((req.query.action as string | undefined) ?? '').trim();
  const where = action ? 'WHERE action = ?' : '';
  const params = action ? [action] : [];
  const rows = await db.all<{
    id: string;
    actor_name: string;
    action: string;
    target_user_id: string | null;
    payment_id: string | null;
    previous_state: string | null;
    new_state: string | null;
    detail: string | null;
    created_at: string;
  }>(
    `SELECT id, actor_name, action, target_user_id, payment_id, previous_state, new_state, detail, created_at
     FROM audit_logs ${where} ORDER BY created_at DESC LIMIT 300`,
    params,
  );
  res.json({
    entries: rows.map((r) => ({
      id: r.id,
      actorName: r.actor_name,
      action: r.action,
      targetUserId: r.target_user_id,
      paymentId: r.payment_id,
      previousState: r.previous_state ? JSON.parse(r.previous_state) : null,
      newState: r.new_state ? JSON.parse(r.new_state) : null,
      detail: r.detail,
      createdAt: r.created_at,
    })),
  });
});

/** Convenience check for the frontend to decide whether to show the Admin UI. */
admin.get('/ping', async (_req: AuthedRequest, res) => {
  res.json({ ok: true, role: 'admin' });
});

import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { getPricingConfig } from '../config/pricing.js';
import { ApiError } from '../middleware/errors.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { newId } from '../auth/passwords.js';
import { createNotification, createAudit } from '../db/services.js';

export const payments = Router();

const MAX_PROOF_BYTES = 1_500_000;

const proofSchema = z.object({
  fileName: z.string().max(255).optional().default('proof'),
  fileType: z.string().max(100).optional().default('image/png'),
  data: z.string().min(20).max(MAX_PROOF_BYTES),
});

const submitSchema = z.object({
  plan: z.enum(['monthly', 'yearly']),
  reference: z.string().trim().min(4).max(120),
  paymentDate: z.string().min(1).max(32),
  note: z.string().trim().max(500).optional().default(''),
  proof: proofSchema.optional(),
});

/** Payment destination + pricing shown to users before they pay. */
payments.get('/details', requireAuth, async (_req, res) => {
  const db = getDb();
  const row = await db.get<{
    bank_name: string;
    account_name: string;
    account_number: string;
    payment_instructions: string;
    currency: string;
  }>('SELECT bank_name, account_name, account_number, payment_instructions, currency FROM payment_settings WHERE id = 1');
  const pricing = await getPricingConfig(db);
  res.json({
    bankName: row?.bank_name ?? '',
    accountName: row?.account_name ?? '',
    accountNumber: row?.account_number ?? '',
    paymentInstructions: row?.payment_instructions ?? '',
    currency: row?.currency ?? pricing.currency,
    monthly: pricing.monthly,
    yearly: pricing.yearly,
  });
});

/** The signed-in user's own payment history. */
payments.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const rows = await db.all<{
    id: string;
    plan: string;
    amount: number;
    currency: string;
    reference: string;
    status: string;
    payment_date: string | null;
    note: string | null;
    reviewed_at: string | null;
    decline_reason: string | null;
    created_at: string;
    has_proof: number;
  }>(
    `SELECT p.id, p.plan, p.amount, p.currency, p.reference, p.status, p.payment_date, p.note,
            p.reviewed_at, p.decline_reason, p.created_at,
            EXISTS(SELECT 1 FROM payment_proofs pr WHERE pr.payment_id = p.id) AS has_proof
     FROM payments p WHERE p.user_id = ? ORDER BY p.created_at DESC`,
    [req.userId!],
  );
  res.json({
    payments: rows.map((r) => ({
      id: r.id,
      plan: r.plan,
      amount: r.amount,
      currency: r.currency,
      reference: r.reference,
      status: r.status,
      paymentDate: r.payment_date,
      note: r.note,
      reviewedAt: r.reviewed_at,
      declineReason: r.decline_reason,
      createdAt: r.created_at,
      hasProof: r.has_proof === 1,
    })),
  });
});

/**
 * Manual payment submission. Creates a PENDING payment that an administrator
 * must independently verify. A screenshot is supporting evidence only — it
 * never marks a payment as approved.
 */
payments.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const body = submitSchema.parse(req.body);
  const db = getDb();
  const userId = req.userId!;

  if (!/^\d{4}-\d{2}-\d{2}/.test(body.paymentDate) || Number.isNaN(Date.parse(body.paymentDate))) {
    throw new ApiError(422, 'Provide a valid payment date.');
  }
  const duplicateRef = await db.get<{ id: string }>('SELECT id FROM payments WHERE reference = ?', [body.reference]);
  if (duplicateRef) throw new ApiError(409, 'This transaction reference was already submitted.');

  const pricing = await getPricingConfig(db);
  const amount = body.plan === 'monthly' ? pricing.monthly : pricing.yearly;
  const currency = pricing.currency;

  const paymentId = newId();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO payments (id, user_id, plan, amount, currency, reference, status, payment_date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [paymentId, userId, body.plan, amount, currency, body.reference, body.paymentDate, body.note || null, now],
  );

  if (body.proof) {
    await db.run(
      `INSERT INTO payment_proofs (id, payment_id, file_name, file_type, data, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId(), paymentId, body.proof.fileName, body.proof.fileType, body.proof.data, body.proof.data.length, now],
    );
  }

  await createNotification(
    db,
    userId,
    'payment_submitted',
    'Payment submitted',
    `Your ${body.plan} payment of ${currency} ${amount.toLocaleString()} is awaiting administrator confirmation.`,
  );
  await createAudit(db, {
    targetUserId: userId,
    paymentId,
    action: 'PAYMENT_SUBMITTED',
    newState: { plan: body.plan, amount, reference: body.reference, status: 'pending' },
  });

  res.status(201).json({
    payment: {
      id: paymentId,
      plan: body.plan,
      amount,
      currency,
      reference: body.reference,
      status: 'pending',
      createdAt: now,
    },
  });
});

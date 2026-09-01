import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3, Landmark, ShieldCheck, Sparkles, XCircle, Zap } from 'lucide-react';
import { PRICING, computeYearlySavings, yearlyEquivalentMonthly } from '@veyra/shared';
import { api, type PaymentDetails, type PaymentRecord } from '../lib/api';
import { useApp } from '../store/useApp';
import { useNav } from '../store/useNav';
import { Badge, Button, cx, SectionTitle } from '../components/ui';
import GlassCard from '../components/GlassCard';

const MAX_PROOF_BYTES = 1_500_000;

export function Premium() {
  const { session, toast, checkBackend, refreshUser } = useApp();
  const { setScreen } = useNav();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [proofName, setProofName] = useState('');
  const [proofData, setProofData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isPremium = session?.user.subscription.tier === 'premium';
  const hasPending = history.some((p) => p.status === 'pending');

  useEffect(() => {
    void checkBackend();
    if (session) {
      void refreshUser();
      void loadPaymentState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPaymentState() {
    try {
      const [d, h] = await Promise.all([api.payments.details(), api.payments.list()]);
      setDetails(d);
      setHistory(h.payments);
    } catch {
      /* server-owned prices fall back to shared defaults */
    }
  }

  const pickProof = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_PROOF_BYTES) {
      toast('warn', 'Screenshot must be under 1.5 MB.');
      return;
    }
    const data = await file.arrayBuffer().then((buf) => {
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    });
    setProofData(data);
    setProofName(file.name);
  };

  const submit = async () => {
    if (!session) {
      toast('info', 'Sign in to subscribe.');
      setScreen('settings');
      return;
    }
    if (reference.trim().length < 4) {
      toast('warn', 'Enter the transaction reference from your transfer.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      toast('warn', 'Pick the date you made the transfer.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.payments.submit({
        plan: billing,
        reference: reference.trim(),
        paymentDate,
        note: note.trim() || undefined,
        proof: proofData ? { fileName: proofName || 'proof', fileType: 'image/png', data: proofData } : undefined,
      });
      toast('success', `Payment submitted (${res.payment.reference}). We'll confirm it shortly.`);
      setReference('');
      setNote('');
      setProofName('');
      setProofData('');
      await loadPaymentState();
      await refreshUser();
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const monthly = details?.monthly ?? PRICING.monthly;
  const yearly = details?.yearly ?? PRICING.yearly;
  const currency = details?.currency ?? 'NGN';
  const fmt = (n: number) => `${currency === 'NGN' ? '₦' : currency + ' '}${n.toLocaleString()}`;

  const yearlySavings = computeYearlySavings({ monthly, yearly, yearlySavingsPercent: 17 });
  const yearlyMonthly = yearlyEquivalentMonthly(yearly);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-4xl h-full overflow-y-auto px-4 pt-4 pb-2"
    >
      <div className="text-center py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-pink shadow-lg"
        >
          <Sparkles size={22} className="text-white" />
        </motion.div>
        <h1 className="font-display text-3xl font-bold text-ink">
          Veyra <span className="text-gradient">Premium</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-dim">
          Unlock the full AI effects library, premium backgrounds, voice studio presets and more.
        </p>
      </div>

      {isPremium ? (
        <div className="mx-auto max-w-lg">
          <GlassCard className="p-6 text-center">
            <CheckCircle2 size={36} className="mx-auto mb-3 text-veyra" />
            <h2 className="font-display text-xl font-bold text-ink">You're premium 🎉</h2>
            <p className="mt-2 text-sm text-ink-dim">
              {session?.user.subscription.plan} plan{session?.user.subscription.expiresAt ? ` · expires ${session.user.subscription.expiresAt.slice(0, 10)}` : ''}
            </p>
          </GlassCard>
        </div>
      ) : null}

      {/* Billing toggle */}
      <div className="mx-auto mt-6 flex w-fit items-center rounded-full border border-edge bg-panel2 p-1">
        <button
          onClick={() => setBilling('monthly')}
          className={cx('rounded-full px-5 py-2 text-sm transition-colors cursor-pointer', billing === 'monthly' ? 'bg-white/10 text-ink' : 'text-ink-dim')}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling('yearly')}
          className={cx('flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-colors cursor-pointer', billing === 'yearly' ? 'bg-veyra text-[#05241a] font-semibold' : 'text-ink-dim')}
        >
          Yearly
          <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-bold', billing === 'yearly' ? 'bg-[#05241a]/20 text-[#05241a]' : 'bg-veyra/15 text-veyra')}>
            Save {fmt(yearlySavings)} / yr
          </span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <GlassCard className="p-6">
          <div className="text-sm font-semibold text-ink">Monthly</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-4xl font-bold text-ink">{fmt(monthly)}</span>
            <span className="text-sm text-ink-faint">/month</span>
          </div>
          <p className="mt-1 text-xs text-ink-dim">Cancel anytime. Billed monthly.</p>
          <Button variant={billing === 'monthly' ? 'primary' : 'outline'} className="mt-5 w-full" size="lg" onClick={() => setBilling('monthly')}>
            Pay {fmt(monthly)}
          </Button>
        </GlassCard>

        <motion.div whileHover={{ y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
          <GlassCard className="p-6 border-accent/40 relative">
            <div className="absolute -top-2.5 left-6 rounded-full bg-gradient-to-r from-accent to-pink px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              Best value
            </div>
            <div className="text-sm font-semibold text-ink">Yearly</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold text-gradient">{fmt(yearly)}</span>
              <span className="text-sm text-ink-faint">/year</span>
            </div>
            <div className="mt-1 text-xs text-ink-dim">
              ≈ {fmt(yearlyMonthly)}/month · saves {fmt(yearlySavings)} vs monthly
            </div>
            <Button variant="premium" className="mt-5 w-full" size="lg" onClick={() => setBilling('yearly')} disabled={busy}>
              Pay {fmt(yearly)} <ArrowRight size={15} />
            </Button>
          </GlassCard>
        </motion.div>
      </div>

      {/* Bank transfer instructions */}
      <GlassCard className="mt-6 p-5">
        <SectionTitle hint="Transfer the exact amount, then submit the details below. An administrator verifies every payment manually.">
          <span className="flex items-center gap-2"><Landmark size={15} /> Pay by bank transfer</span>
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-edge bg-panel2/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">Amount due</div>
            <div className="mt-1 font-display text-xl font-bold text-ink">{fmt(billing === 'monthly' ? monthly : yearly)}</div>
          </div>
          <div className="rounded-xl border border-edge bg-panel2/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">Account name</div>
            <div className="mt-1 text-sm font-semibold text-ink">{details?.accountName || '—'}</div>
          </div>
          <div className="rounded-xl border border-edge bg-panel2/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">Account number · bank</div>
            <div className="mt-1 text-sm font-semibold text-ink">
              {details?.accountNumber || '—'}{details?.bankName ? ` · ${details.bankName}` : ''}
            </div>
          </div>
        </div>
        {details?.paymentInstructions ? (
          <p className="mt-3 text-xs leading-relaxed text-ink-dim">{details.paymentInstructions}</p>
        ) : null}
      </GlassCard>

      {/* Submission form */}
      {!isPremium ? (
        <GlassCard className="mt-4 p-5">
          <SectionTitle hint="Keep your reference safe — it proves your transfer.">Confirm your payment</SectionTitle>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">Transaction reference</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. VEYR12345678"
                className="w-full rounded-xl border border-edge bg-panel2 px-3 py-2 text-sm text-ink outline-none focus:border-veyra"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">Payment date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-edge bg-panel2 px-3 py-2 text-sm text-ink outline-none focus:border-veyra"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">Note (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="Anything we should know?"
                className="w-full rounded-xl border border-edge bg-panel2 px-3 py-2 text-sm text-ink outline-none focus:border-veyra"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="cursor-pointer rounded-xl border border-edge bg-panel2/60 px-3 py-2 text-xs text-ink-dim hover:border-veyra">
                {proofName || 'Attach transfer screenshot (optional)'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickProof(e.target.files?.[0])} />
              </label>
              {proofData ? (
                <button onClick={() => { setProofData(null); setProofName(''); }} className="text-xs text-danger hover:underline cursor-pointer">
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => void submit()} disabled={busy || hasPending}>
            {busy ? 'Submitting…' : hasPending ? 'Payment awaiting confirmation' : `Submit ${billing} payment`}
          </Button>
        </GlassCard>
      ) : null}

      {/* Payment history */}
      {history.length > 0 ? (
        <GlassCard className="mt-4 p-5">
          <SectionTitle>Payment history</SectionTitle>
          <div className="mt-2 space-y-2">
            {history.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-edge bg-panel2/60 px-3 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-ink">{p.reference}</span>
                  <span className="ml-2 text-xs text-ink-faint">{p.plan} · {fmt(p.amount)} · {p.createdAt.slice(0, 10)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.status === 'approved' ? <Badge tone="green"><CheckCircle2 size={11} /> Approved</Badge>
                    : p.status === 'declined' ? <Badge tone="red"><XCircle size={11} /> Declined</Badge>
                    : <Badge tone="amber"><Clock3 size={11} /> Pending</Badge>}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}

      {/* Benefits */}
      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { icon: <Zap size={18} />, title: 'Full effects library', desc: 'All premium face, character and glitch effects.' },
          { icon: <BadgeCheck size={18} />, title: 'Premium backgrounds', desc: 'Cinematic built-in scenes and unlimited uploads.' },
          { icon: <ShieldCheck size={18} />, title: 'Honest & private', desc: 'Local processing, clear AI labels, no hidden fees.' },
        ].map((b, i) => (
          <motion.div
            key={b.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <GlassCard className="p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-[#b9a7ff]">{b.icon}</div>
              <div className="mt-3 text-sm font-semibold text-ink">{b.title}</div>
              <p className="mt-1 text-xs text-ink-dim">{b.desc}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-faint">
        Prices are configured server-side. Premium activates once an administrator confirms your transfer. Cancel anytime from Settings.
      </p>
    </motion.div>
  );
}

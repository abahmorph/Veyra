import { useCallback } from 'react';
import { isPremium as isPremiumSub, isPremiumEffect } from '@veyra/shared';
import { api } from './api';
import { useApp } from '../store/useApp';
import { useStudio } from '../store/useStudio';

const GUEST_CREDIT_KEY = 'veyra.guest-premium-credit';

function readGuestCredit(): number {
  try {
    return Number(localStorage.getItem(GUEST_CREDIT_KEY) ?? '1');
  } catch {
    return 1;
  }
}

function spendGuestCredit(): number {
  const next = Math.max(0, readGuestCredit() - 1);
  localStorage.setItem(GUEST_CREDIT_KEY, String(next));
  return next;
}

/**
 * Entitlement resolution. The server is the source of truth whenever it is
 * reachable; the guest credit is a clearly-labelled offline fallback so the
 * free "1 premium effect" experience works without a backend.
 */
export function useEntitlement() {
  const { session, backendReachable, toast } = useApp();
  const setEffect = useStudio((s) => s.setEffect);

  const subscription = session?.user.subscription ?? null;
  const premium = isPremiumSub(subscription);
  const creditsRemaining = backendReachable
    ? (session?.user.premiumEffectCreditsRemaining ?? 0)
    : readGuestCredit();

  const isLocked = useCallback(
    (effectId: string | null): boolean => {
      if (!isPremiumEffect(effectId)) return false;
      if (premium) return false;
      return creditsRemaining <= 0;
    },
    [premium, creditsRemaining],
  );

  const canUse = useCallback(
    (effectId: string | null): boolean => {
      if (!isPremiumEffect(effectId)) return true;
      if (premium) return true;
      return creditsRemaining > 0;
    },
    [premium, creditsRemaining],
  );

  /** Select an effect, consuming a free premium credit if needed. */
  const activate = useCallback(
    async (effectId: string | null): Promise<boolean> => {
      if (effectId == null || !isPremiumEffect(effectId)) {
        setEffect(effectId ?? 'none');
        return true;
      }
      if (premium) {
        setEffect(effectId);
        return true;
      }
      if (creditsRemaining <= 0) {
        toast('warn', 'This is a premium effect. Unlock Veyra Premium to use it.');
        return false;
      }
      const consumed = await consumePremiumCredit(toast, backendReachable);
      if (!consumed) return false;
      setEffect(effectId);
      return true;
    },
    [premium, creditsRemaining, backendReachable, setEffect, toast],
  );

  /** Consume one free premium entitlement for a non-effect premium feature. */
  const consumePremium = useCallback(async (): Promise<boolean> => {
    if (premium) return true;
    if (creditsRemaining <= 0) {
      toast('warn', 'This is a premium feature. Unlock Veyra Premium to use it.');
      return false;
    }
    return consumePremiumCredit(toast, backendReachable);
  }, [premium, creditsRemaining, backendReachable, toast]);

  return { premium, creditsRemaining, isLocked, canUse, activate, consumePremium, subscription, backendReachable };
}

async function consumePremiumCredit(
  toast: (kind: 'info' | 'success' | 'error' | 'warn', message: string) => void,
  backendReachable: boolean | null,
): Promise<boolean> {
  try {
    if (backendReachable) {
      const { creditsRemaining } = await api.entitlement.consumePremiumEffect();
      const remaining = creditsRemaining ?? 0;
      const s = useApp.getState().session;
      if (s) useApp.setState({ session: { ...s, user: { ...s.user, premiumEffectCreditsRemaining: remaining } } });
      toast('success', `Premium unlocked — ${remaining} free trial use${remaining === 1 ? '' : 's'} left.`);
    } else {
      const remaining = spendGuestCredit();
      toast('info', `Offline trial use spent. ${remaining} free premium use${remaining === 1 ? '' : 's'} left (offline mode).`);
    }
    return true;
  } catch (err) {
    toast('error', (err as Error).message);
    return false;
  }
}

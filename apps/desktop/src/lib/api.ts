import type { PriceConfig, SubscriptionInfo } from '@veyra/shared';

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  role: 'user' | 'admin';
  createdAt: string;
  subscription: SubscriptionInfo;
  premiumEffectCreditsRemaining: number;
  latestPayment?: {
    status: string;
    plan: string | null;
    createdAt: string;
  } | null;
}

export interface Session {
  token: string;
  user: User;
}

export interface PaymentDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  paymentInstructions: string;
  currency: string;
  monthly: number;
  yearly: number;
}

export interface PaymentRecord {
  id: string;
  plan: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  reference: string;
  status: 'pending' | 'approved' | 'declined';
  paymentDate: string | null;
  note: string | null;
  declineReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  hasProof: boolean;
}

export interface SubmissionResponse {
  payment: {
    id: string;
    plan: 'monthly' | 'yearly';
    amount: number;
    currency: string;
    reference: string;
    status: 'pending';
    createdAt: string;
  };
}

const DEFAULT_API = 'http://localhost:8787';

export function apiBase(): string {
  return import.meta.env.VITE_VEYRA_API || DEFAULT_API;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${apiBase()}${path.startsWith('/health') ? path : `/api${path}`}`, { ...init, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  ping: () => request<{ ok: true; service: string }>('/health', { method: 'GET' }, false),

  auth: {
    signup: (email: string, password: string, name: string) =>
      request<Session>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) }, false),
    login: (email: string, password: string) =>
      request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    requestPasswordReset: (email: string) =>
      request<{ ok: true }>('/auth/password/reset', { method: 'POST', body: JSON.stringify({ email }) }, false),
    resetPassword: (token: string, password: string) =>
      request<{ ok: true }>('/auth/password/reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) }, false),
  },

  user: {
    me: () => request<{ user: User }>('/user/me'),
    updateProfile: (patch: { name?: string; username?: string | null }) =>
      request<{ user: User }>('/user/me', { method: 'PATCH', body: JSON.stringify(patch) }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: true }>('/user/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
    deleteAccount: () => request<{ ok: true }>('/user/account', { method: 'DELETE' }),
    sessions: () => request<{ sessions: { id: string; device: string; createdAt: string; expiresAt: string }[] }>('/user/me/sessions'),
    revokeSession: (id: string) => request<{ ok: true }>(`/user/me/sessions/${id}`, { method: 'DELETE' }),
    notifications: () =>
      request<{
        notifications: { id: string; kind: string; title: string; message: string; read: boolean; createdAt: string }[];
        unread: number;
      }>('/user/notifications'),
    readNotifications: (id?: string) =>
      request<{ ok: true }>('/user/notifications/read', { method: 'POST', body: JSON.stringify(id ? { id } : {}) }),
  },

  subscription: {
    status: () => request<SubscriptionInfo>('/subscription/status'),
  },

  payments: {
    details: () => request<PaymentDetails>('/payments/details'),
    list: () => request<{ payments: PaymentRecord[] }>('/payments'),
    submit: (input: {
      plan: 'monthly' | 'yearly';
      reference: string;
      paymentDate: string;
      note?: string;
      proof?: { fileName: string; fileType: string; data: string };
    }) => request<SubmissionResponse>('/payments', { method: 'POST', body: JSON.stringify(input) }),
  },

  entitlement: {
    consumePremiumEffect: () =>
      request<{ allowed: boolean; reason: 'subscribed' | 'trial-credit' | 'no-credits'; creditsRemaining: number | null }>(
        '/entitlement/consume-premium-effect',
        { method: 'POST', body: JSON.stringify({}) },
      ),
  },

  pricing: () => request<PriceConfig>('/pricing', { method: 'GET' }, false),
};

export function isBackendReachable(): Promise<boolean> {
  return api
    .ping()
    .then(() => true)
    .catch(() => false);
}

export type { ApiError };

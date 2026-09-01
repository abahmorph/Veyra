import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../store/useApp';
import { Button } from './ui';

export function AuthPanel({ onClose }: { onClose: () => void }) {
  const { login, signup } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, name || email.split('@')[0] || 'Creator');
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-6 shadow-2xl animate-rise">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">
          {mode === 'login' ? 'Welcome back' : 'Create your Veyra account'}
        </h2>
        <button onClick={onClose} className="text-ink-faint hover:text-ink cursor-pointer" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-dim">
        {mode === 'signup'
          ? 'New accounts start with 1 free premium effect experience.'
          : 'Sign in to sync your subscription and entitlement.'}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        {mode === 'signup' ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded-xl border border-edge bg-panel2 px-3 py-2.5 text-sm text-ink outline-none focus:border-veyra"
          />
        ) : null}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border border-edge bg-panel2 px-3 py-2.5 text-sm text-ink outline-none focus:border-veyra"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 characters)"
          className="w-full rounded-xl border border-edge bg-panel2 px-3 py-2.5 text-sm text-ink outline-none focus:border-veyra"
        />
        {error ? <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div> : null}
        {resetSent ? (
          <div className="rounded-xl border border-veyra/30 bg-veyra/10 px-3 py-2 text-xs text-veyra">
            If that email exists, a reset link has been sent.
          </div>
        ) : null}
        <Button type="submit" disabled={busy} className="w-full" size="lg">
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-xs">
        <button
          className="text-ink-dim hover:text-ink cursor-pointer"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
        {mode === 'login' ? (
          <button
            className="text-ink-dim hover:text-ink cursor-pointer"
            onClick={async () => {
              if (!email) return;
              const { api } = await import('../lib/api');
              await api.auth.requestPasswordReset(email);
              setResetSent(true);
            }}
          >
            Forgot password?
          </button>
        ) : null}
      </div>
    </div>
  );
}

import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import { useApp } from '../store/useApp';
import { cx } from './ui';

const ICONS = {
  info: <Info size={16} className="text-cyan" />,
  success: <CheckCircle2 size={16} className="text-veyra" />,
  error: <XCircle size={16} className="text-danger" />,
  warn: <TriangleAlert size={16} className="text-warn" />,
};

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={cx(
            'glass-strong pointer-events-auto flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-left text-xs text-ink shadow-xl animate-rise',
            t.kind === 'error' ? 'border-danger/40' : t.kind === 'warn' ? 'border-warn/40' : '',
          )}
        >
          <span className="mt-0.5">{ICONS[t.kind]}</span>
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}

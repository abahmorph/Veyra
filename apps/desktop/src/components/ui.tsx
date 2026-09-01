import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Sparkles } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'premium';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
}) {
  const styles: Record<ButtonVariant, string> = {
    primary:
      'bg-veyra text-[#05241a] font-semibold hover:bg-[#31f5a7] shadow-[0_0_24px_-6px_rgba(20,241,149,0.7)]',
    premium:
      'bg-gradient-to-r from-veyra via-cyan to-accent text-white font-semibold hover:brightness-110 shadow-[0_0_28px_-8px_rgba(124,92,255,0.9)]',
    ghost: 'bg-transparent text-ink-dim hover:text-ink hover:bg-white/5',
    outline: 'border border-edge2 text-ink hover:bg-white/5 hover:border-veyra/50',
    danger: 'bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button
      className={cx(
        'rounded-xl transition-all duration-150 ring-focus disabled:opacity-40 disabled:pointer-events-none cursor-pointer inline-flex items-center gap-2 justify-center',
        styles[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-edge bg-panel/80 p-4', className)}>{children}</div>;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 cursor-pointer group"
    >
      <span
        className={cx(
          'relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors',
          checked ? 'bg-veyra' : 'bg-edge2',
        )}
      >
        <span
          className={cx(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1',
          )}
        />
      </span>
      {label ? <span className="text-sm text-ink-dim group-hover:text-ink">{label}</span> : null}
    </button>
  );
}

export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {label ? <span className="w-28 text-xs text-ink-dim shrink-0">{label}</span> : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-veyra"
      />
      <span className="w-10 text-right text-xs text-ink-dim tabular-nums">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'rounded-xl border border-edge bg-panel2 text-sm text-ink px-3 py-2 outline-none ring-focus cursor-pointer hover:border-edge2 focus:border-veyra',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'purple' | 'red' | 'amber';
}) {
  const tones = {
    neutral: 'bg-white/5 text-ink-dim border-edge2',
    green: 'bg-veyra/10 text-veyra border-veyra/30',
    purple: 'bg-accent/10 text-[#b9a7ff] border-accent/30',
    red: 'bg-danger/10 text-danger border-danger/30',
    amber: 'bg-warn/10 text-warn border-warn/30',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone])}>
      {children}
    </span>
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent/30 to-pink/30 border border-accent/40 px-2 py-0.5 text-[10px] font-semibold text-[#d9ccff]">
      <Sparkles size={11} /> PREMIUM
    </span>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-display text-sm font-semibold tracking-wide text-ink">{children}</h3>
      {hint ? <p className="mt-0.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-edge bg-panel2/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={cx('mt-0.5 font-display text-sm font-semibold tabular-nums', accent ? 'text-veyra' : 'text-ink')}>
        {value}
      </div>
    </div>
  );
}

export function LockOverlay({ onClick, description }: { onClick: () => void; description?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#05050b]/72 backdrop-blur-[3px]">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 border border-accent/40">
        <Sparkles size={20} className="text-[#b9a7ff]" />
      </div>
      <div className="text-center px-4">
        <div className="font-display text-sm font-semibold text-ink">Premium Effect</div>
        {description ? <p className="mt-1 text-xs text-ink-dim max-w-[220px]">{description}</p> : null}
      </div>
      <Button variant="premium" size="sm" onClick={onClick}>
        Unlock Premium
      </Button>
    </div>
  );
}

import { LucideIcon } from 'lucide-react';

export default function SectionHeader({ title, subtitle, icon: Icon }: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={22} className="text-accent" strokeWidth={2} />}
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-ink-dim mt-1 ml-[30px]">{subtitle}</p>}
    </div>
  );
}

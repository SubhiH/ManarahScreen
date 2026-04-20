import { DateTime } from 'luxon';
import { cn } from '@/lib/cn';

type Props = {
  now: DateTime;
  action: { kind: 'adhan' | 'iqamah'; label: string; at: DateTime } | null;
  variant?: 'block' | 'pill';
  className?: string;
};

export default function NextPrayerTicker({ now, action, variant = 'block', className }: Props) {
  if (!action) return null;
  const totalSec = Math.max(0, Math.floor(action.at.diff(now).as('seconds')));
  const isIqama = action.kind === 'iqamah';

  if (variant === 'pill') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-full border px-4 py-1.5',
          isIqama
            ? 'border-theme-next/40 bg-theme-next/10 text-theme-next'
            : 'border-theme-accent/40 bg-theme-accent/10 text-theme-accent',
          className,
        )}
      >
        <span className="text-[0.8vw] uppercase tracking-wider opacity-80">
          {isIqama ? 'Iqama in' : 'Next'}
        </span>
        <span className="text-[1.1vw] font-semibold">{action.label}</span>
        <span className="font-mono text-[1.2vw] tabular-nums">
          {fmtDuration(totalSec)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border px-4 py-3',
        isIqama
          ? 'border-theme-next/40 bg-theme-next/10'
          : 'border-theme-accent/40 bg-theme-accent/10',
        className,
      )}
    >
      <div
        className={cn(
          'text-[0.85vw] uppercase tracking-[0.25em]',
          isIqama ? 'text-theme-next' : 'text-theme-accent/80',
        )}
      >
        {isIqama ? `${action.label} · Iqama in` : `Next Adhan · ${action.label}`}
      </div>
      <div
        className={cn(
          'font-mono text-[2.2vw] font-bold leading-none tabular-nums',
          isIqama ? 'text-theme-next' : 'text-theme-text',
        )}
      >
        {fmtDuration(totalSec)}
      </div>
    </div>
  );
}

function fmtDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

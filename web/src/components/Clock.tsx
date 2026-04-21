import { DateTime } from 'luxon';
import { fmtClock, hijriForDate } from '@/lib/time';
import { cn } from '@/lib/cn';

type Props = {
  now: DateTime;
  withSeconds: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export default function Clock({ now, withSeconds, size = 'lg', className }: Props) {
  const h = hijriForDate(now);
  const main = size === 'lg' ? '4.2vw' : size === 'md' ? '2.8vw' : '1.6vw';
  const date = size === 'lg' ? '1.3vw' : size === 'md' ? '1.1vw' : '0.9vw';
  const hijri = size === 'lg' ? '1vw' : size === 'md' ? '0.9vw' : '0.8vw';
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div
        className="whitespace-nowrap tabular-nums font-mono font-bold leading-none tracking-tight text-theme-accent drop-shadow"
        style={{ fontSize: `calc(${main} * var(--scale-clock, 1))` }}
      >
        {fmtClock(now, withSeconds)}
      </div>
      <div
        className="mt-2 font-medium text-theme-text"
        style={{ fontSize: `calc(${date} * var(--scale-clock, 1))` }}
      >
        {now.toFormat('cccc, LLLL d, yyyy')}
      </div>
      <div
        className="mt-1 text-theme-text-dim"
        style={{ fontSize: `calc(${hijri} * var(--scale-clock, 1))` }}
      >
        {h.dDay} {h.month} {h.y} AH
      </div>
    </div>
  );
}

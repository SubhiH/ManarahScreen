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
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div
        className={cn(
          'whitespace-nowrap tabular-nums font-mono font-bold leading-none tracking-tight text-theme-accent drop-shadow',
          size === 'lg' && 'text-[4.2vw]',
          size === 'md' && 'text-[2.8vw]',
          size === 'sm' && 'text-[1.6vw]',
        )}
      >
        {fmtClock(now, withSeconds)}
      </div>
      <div
        className={cn(
          'mt-2 font-medium text-theme-text',
          size === 'lg' && 'text-[1.3vw]',
          size === 'md' && 'text-[1.1vw]',
          size === 'sm' && 'text-[0.9vw]',
        )}
      >
        {now.toFormat('cccc, LLLL d, yyyy')}
      </div>
      <div
        className={cn(
          'mt-1 text-theme-text-dim',
          size === 'lg' && 'text-[1vw]',
          size === 'md' && 'text-[0.9vw]',
          size === 'sm' && 'text-[0.8vw]',
        )}
      >
        {h.dDay} {h.month} {h.y} AH
      </div>
    </div>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { mmss } from '@/lib/time';
import { cn } from '@/lib/cn';

type Position = 'slide-area' | 'top-banner' | 'sidebar-inline';

type Props = {
  show: boolean;
  label: string;
  secondsRemaining: number;
  totalSeconds: number;
  position: Position;
  /** Wall-clock end of the post-Sunrise window (e.g. "6:38 AM"). */
  endTime?: string;
};

const RING_RADIUS = 44;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

export default function SunriseCounter(props: Props) {
  const { show, position } = props;
  return (
    <AnimatePresence>
      {show &&
        (position === 'slide-area' ? <SlideAreaVariant {...props} /> : <CardVariant {...props} />)}
    </AnimatePresence>
  );
}

/* ---------------- Big slide-area takeover ---------------- */

function SlideAreaVariant({ label, secondsRemaining, totalSeconds, endTime }: Props) {
  const safeTotal = Math.max(1, totalSeconds);
  const progress = Math.max(0, Math.min(1, secondsRemaining / safeTotal));
  const dashOffset = RING_CIRC * (1 - progress);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-[3cqh] bg-theme-bg/80 p-[6cqw] backdrop-blur-md"
    >
      {/* Title */}
      <div
        className="text-center font-bold uppercase tracking-[0.2em] text-theme-accent"
        style={{ fontSize: 'min(4.5cqw, 7cqh)' }}
      >
        ☀ {label}
      </div>

      {/* Ring with countdown */}
      <div
        className="relative shrink-0"
        style={{ width: 'min(34cqw, 55cqh)', height: 'min(34cqw, 55cqh)' }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            className="text-theme-border/15"
            stroke="currentColor"
            strokeWidth={6}
            fill="none"
          />
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            className="text-theme-accent"
            stroke="currentColor"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="font-mono font-bold tabular-nums leading-none text-theme-accent"
            style={{ fontSize: 'min(8cqw, 13cqh)' }}
          >
            {mmss(secondsRemaining)}
          </div>
          <div
            className="mt-[1cqh] uppercase tracking-widest text-theme-text-dim"
            style={{ fontSize: 'min(1.4cqw, 2.2cqh)' }}
          >
            remaining
          </div>
        </div>
      </div>

      {/* Prohibition message */}
      {endTime && (
        <div
          className="max-w-[80%] text-center font-medium leading-snug text-theme-text"
          style={{ fontSize: 'min(3cqw, 5cqh)' }}
        >
          Prohibited to pray until{' '}
          <span className="font-bold text-theme-accent">{endTime}</span>
        </div>
      )}
    </motion.div>
  );
}

/* ---------------- Compact card (top-banner / sidebar-inline) ---------------- */

function CardVariant({ label, secondsRemaining, totalSeconds, endTime, position }: Props) {
  const safeTotal = Math.max(1, totalSeconds);
  const progress = Math.max(0, Math.min(1, secondsRemaining / safeTotal));
  const dashOffset = RING_CIRC * (1 - progress);
  const isInline = position === 'sidebar-inline';

  return (
    <motion.div
      initial={{ opacity: 0, y: position === 'top-banner' ? -20 : 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: position === 'top-banner' ? -20 : 8, scale: 0.96 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'z-30 flex items-center gap-4 rounded-2xl border border-theme-accent/30 bg-theme-bg/85 px-5 py-4 text-theme-text shadow-2xl backdrop-blur-xl',
        position === 'top-banner'
          ? 'absolute left-1/2 top-4 -translate-x-1/2'
          : 'mx-3 w-[calc(100%-1.5rem)]',
      )}
    >
      <div
        className="relative shrink-0"
        style={{
          width: isInline ? 'min(18cqw, 90px)' : '6.5vw',
          height: isInline ? 'min(18cqw, 90px)' : '6.5vw',
          minWidth: '64px',
          minHeight: '64px',
        }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            className="text-theme-border/15"
            stroke="currentColor"
            strokeWidth={8}
            fill="none"
          />
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            className="text-theme-accent"
            stroke="currentColor"
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-mono font-bold tabular-nums text-theme-accent"
          style={{ fontSize: isInline ? '1.6vw' : '1.4vw' }}
        >
          {mmss(secondsRemaining)}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <div
          className="font-semibold uppercase tracking-[0.18em] text-theme-text-dim"
          style={{ fontSize: '0.85vw' }}
        >
          ☀ Sunrise · now
        </div>
        <div
          className="font-bold leading-tight text-theme-accent"
          style={{ fontSize: isInline ? '1.7vw' : '1.5vw' }}
        >
          {label}
        </div>
        {endTime && (
          <div className="text-theme-text-dim" style={{ fontSize: '0.8vw' }}>
            until <span className="font-semibold text-theme-text">{endTime}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

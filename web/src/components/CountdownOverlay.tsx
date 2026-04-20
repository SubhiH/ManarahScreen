import { AnimatePresence, motion } from 'framer-motion';
import { mmss } from '@/lib/time';

type Props = {
  show: boolean;
  prayerLabel?: string;
  secondsRemaining: number;
};

export default function CountdownOverlay({ show, prayerLabel, secondsRemaining }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
            className="relative flex flex-col items-center gap-6 rounded-3xl border border-theme-accent/50 bg-black/60 px-16 py-12 shadow-[0_0_120px_-10px_rgb(var(--t-accent-rgb)/0.55)] animate-pulse-glow"
          >
            <div className="text-[2.5vw] font-medium uppercase tracking-[0.3em] text-theme-accent">
              {prayerLabel ?? 'Adhan'} in
            </div>
            <div className="font-mono text-[14vw] leading-none font-black text-white tabular-nums">
              {mmss(secondsRemaining)}
            </div>
            <div className="flex items-center gap-3 text-[1.5vw] font-light tracking-wide text-slate-300">
              <span aria-hidden="true">📵</span>
              <span>Please silence your phones · الرجاء إغلاق الهواتف</span>
              <span aria-hidden="true">🔕</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

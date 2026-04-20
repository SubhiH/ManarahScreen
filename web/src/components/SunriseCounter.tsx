import { AnimatePresence, motion } from 'framer-motion';
import { mmss } from '@/lib/time';
import { cn } from '@/lib/cn';

type Props = {
  show: boolean;
  label: string;
  secondsRemaining: number;
  position: 'top-banner' | 'sidebar-inline';
};

export default function SunriseCounter({ show, label, secondsRemaining, position }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: position === 'top-banner' ? -20 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top-banner' ? -20 : 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            'z-30 flex items-center gap-3 rounded-full border border-theme-accent/30 bg-theme-accent/10 px-5 py-2 text-theme-accent shadow-lg backdrop-blur-md',
            position === 'top-banner'
              ? 'absolute left-1/2 top-4 -translate-x-1/2'
              : 'w-full justify-between',
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-[1.2vw]">☀️</span>
            <span className="text-[1vw] font-medium tracking-wide">{label}</span>
          </div>
          <div className="font-mono text-[1.3vw] font-bold tabular-nums">
            {mmss(secondsRemaining)}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import DhikrCanvas from './DhikrCanvas';
import { adhkarIndexAt } from '@/lib/adhkar';
import { DEFAULT_ADHKAR_PALETTE, paletteVars, resolvePalette } from '@/lib/dhikrPalettes';
import type { PostPrayerDhikr } from '@/lib/types';

type Props = {
  active: boolean;
  /** Seconds since the adhkar window opened (i.e. since the dim ended). */
  secondsElapsed: number;
  /** Full length of the adhkar window, in seconds. */
  totalSeconds: number;
  items: PostPrayerDhikr[];
  title: string;
};

/**
 * Full-screen adhkar shown in the slide area once the post-Iqama dim ends.
 * Cycles the adhkar off `secondsElapsed`, so every screen on the LAN shows the
 * same dhikr at the same moment without any shared state.
 */
export default function PostPrayerAdhkar({
  active,
  secondsElapsed,
  totalSeconds,
  items,
  title,
}: Props) {
  const index = adhkarIndexAt(secondsElapsed, totalSeconds, items.length);
  const item = items[index];
  const progress =
    totalSeconds > 0 ? Math.min(1, Math.max(0, secondsElapsed / totalSeconds)) : 0;

  if (!item) return null;

  const palette = resolvePalette(item.palette, DEFAULT_ADHKAR_PALETTE);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
          style={paletteVars(palette)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${index}:${palette}:${item.arabic.slice(0, 24)}`}
              initial={{ opacity: 0, scale: 1.015 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              <DhikrCanvas
                palette={palette}
                title={title}
                arabic={item.arabic}
                transliteration={item.transliteration}
                translation={item.translation}
                source={item.source}
                footerRight={
                  items.length > 1 ? (
                    <div className="flex items-center gap-1.5">
                      {items.map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 rounded-full transition-all ${
                            i === index
                              ? 'w-6 bg-[rgb(var(--dhikr-accent-rgb))]'
                              : 'w-1.5 bg-[rgb(var(--dhikr-text-rgb)/0.3)]'
                          }`}
                        />
                      ))}
                    </div>
                  ) : null
                }
              />
            </motion.div>
          </AnimatePresence>

          {/* Window progress — thin bar along the bottom edge. */}
          <div className="absolute bottom-0 left-0 h-[3px] w-full bg-black/30">
            <div
              className="h-full bg-[rgb(var(--dhikr-accent-rgb)/0.75)] transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

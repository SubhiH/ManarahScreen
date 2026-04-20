import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { UnifiedSlide } from '@/lib/types';
import { cn } from '@/lib/cn';

type Props = {
  slides: UnifiedSlide[];
  className?: string;
};

export default function SlideCarousel({ slides, className }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!slides.length) return;
    const duration = Math.max(3, slides[index % slides.length]?.duration ?? 10) * 1000;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), duration);
    return () => window.clearTimeout(id);
  }, [index, slides]);

  useEffect(() => {
    // Reset index if slide list shrinks past current position.
    if (index >= slides.length && slides.length > 0) setIndex(0);
  }, [slides.length, index]);

  if (!slides.length) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center', className)}>
        <div className="rounded-xl border border-theme-border/10 bg-theme-border/5 px-6 py-4 text-center text-theme-text-dim">
          <div className="text-[1.2vw] font-semibold">No slides yet</div>
          <div className="text-[0.9vw]">
            Drop images into <code className="text-theme-accent">/slides</code> or run a sync.
          </div>
        </div>
      </div>
    );
  }

  const current = slides[index % slides.length];

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {current.kind === 'video' ? (
            <video
              key={current.id}
              src={current.url}
              className="h-full w-full object-contain"
              autoPlay
              muted
              playsInline
            />
          ) : (
            <img
              src={current.url}
              alt={current.name}
              className="h-full w-full object-contain"
              draggable={false}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* progress dots */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === index % slides.length
                ? 'w-6 bg-theme-accent'
                : 'w-1.5 bg-theme-border/30',
            )}
          />
        ))}
      </div>
    </div>
  );
}

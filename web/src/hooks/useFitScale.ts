import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Options = {
  /** Smallest allowed scale — content is clipped rather than shrinking past this. */
  min?: number;
  /** Largest allowed scale — keeps a two-word dhikr from becoming absurd. */
  max?: number;
  /** Fraction of the box height the content may occupy (breathing room top/bottom). */
  fill?: number;
  /** Binary-search steps; 16 lands within ~0.006% of the ideal scale. */
  steps?: number;
};

/**
 * Binary-searches the largest `--fit` multiplier at which the content element
 * still fits inside the box element, on both axes.
 *
 * Sizes inside the content are written as `calc(var(--fit) * <base>)`, so one
 * multiplier scales type and spacing together: a short dua grows to fill the
 * screen, a long one shrinks just enough to fit.
 */
export function useFitScale<B extends HTMLElement, C extends HTMLElement>(
  deps: unknown[],
  { min = 0.25, max = 4, fill = 1, steps = 16 }: Options = {},
) {
  const boxRef = useRef<B>(null);
  const contentRef = useRef<C>(null);
  const [scale, setScale] = useState(min);

  const measure = useCallback(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;

    const availH = box.clientHeight * fill;
    // The content is laid out at the box's full width, so only a genuine
    // horizontal overflow (an unbreakable word) should fail this check.
    const availW = box.clientWidth + 1;
    if (availH <= 0 || box.clientWidth <= 0) return;

    const fits = (s: number) => {
      content.style.setProperty('--fit', String(s));
      // Reading scrollHeight forces the layout we just invalidated.
      return content.scrollHeight <= availH && content.scrollWidth <= availW;
    };

    let best = min;
    if (fits(max)) {
      best = max;
    } else {
      let lo = min;
      let hi = max;
      for (let i = 0; i < steps; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      best = lo;
    }

    content.style.setProperty('--fit', String(best));
    setScale(best);
  }, [fill, max, min, steps]);

  // Re-fit whenever the content changes, before the browser paints.
  useLayoutEffect(measure, [measure, ...deps]);

  // Re-fit when the available box changes (layout resize, sidebar drag, rotation).
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(box);
    return () => ro.disconnect();
  }, [measure]);

  // Amiri usually lands after first paint; metrics change when it does.
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
  }, [measure]);

  return { boxRef, contentRef, scale };
}

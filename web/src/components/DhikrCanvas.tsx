import type { CSSProperties, ReactNode } from 'react';
import { useFitScale } from '@/hooks/useFitScale';
import {
  DEFAULT_DUA_PALETTE,
  DHIKR_PALETTES,
  paletteVars,
  type DhikrPalette,
} from '@/lib/dhikrPalettes';

type Props = {
  title: string;
  arabic: string;
  transliteration?: string;
  translation?: string;
  source?: string;
  category?: string;
  repeat?: number;
  palette?: DhikrPalette;
  /** Rendered at the right end of the footer (progress dots, timers, …). */
  footerRight?: ReactNode;
};

export default function DhikrCanvas({
  title,
  arabic,
  transliteration,
  translation,
  source,
  category,
  repeat,
  palette = DEFAULT_DUA_PALETTE,
  footerRight,
}: Props) {
  const p = DHIKR_PALETTES[palette];
  const { boxRef, contentRef, scale } = useFitScale<HTMLElement, HTMLDivElement>(
    [arabic, transliteration, translation, palette],
    { min: 0.3, max: 4.5, fill: 0.97 },
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden text-[rgb(var(--dhikr-text-rgb))]"
      style={{
        ...paletteVars(palette),
        backgroundColor: p.backgroundColor,
        backgroundImage: p.backgroundImage,
      }}
    >
      <div className="dua-pattern-motion pointer-events-none absolute inset-0 opacity-[0.16]" />

      <div className="pointer-events-none absolute inset-[clamp(10px,1.2vw,24px)] rounded-[clamp(18px,2vw,38px)] border border-[rgb(var(--dhikr-accent-rgb)/0.3)]" />
      <div className="pointer-events-none absolute left-[3%] top-[6%] h-[clamp(60px,7vw,130px)] w-[clamp(60px,7vw,130px)] rotate-45 rounded-[22%] border border-[rgb(var(--dhikr-accent-rgb)/0.2)]" />
      <div className="pointer-events-none absolute bottom-[6%] right-[3%] h-[clamp(60px,7vw,130px)] w-[clamp(60px,7vw,130px)] rotate-45 rounded-[22%] border border-[rgb(var(--dhikr-accent-rgb)/0.2)]" />

      <div className="relative z-10 flex h-full flex-col px-[clamp(22px,3vw,64px)] py-[clamp(16px,2vw,36px)]">
        <header className="flex shrink-0 items-center justify-between gap-4">
          <div className="flex items-center gap-[clamp(8px,0.8vw,16px)]">
            <div className="flex h-[clamp(30px,2.4vw,50px)] w-[clamp(30px,2.4vw,50px)] items-center justify-center rounded-full border border-[rgb(var(--dhikr-accent-rgb)/0.5)] bg-[rgb(var(--dhikr-accent-rgb)/0.1)] text-[clamp(0.9rem,1.2vw,1.6rem)] text-[rgb(var(--dhikr-accent-rgb))]">
              ۞
            </div>
            <div className="text-[clamp(0.9rem,1.2vw,1.7rem)] font-semibold text-[rgb(var(--dhikr-text-rgb)/0.95)]">
              {title}
            </div>
          </div>
          {category && (
            <div className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-[clamp(10px,1vw,20px)] py-[clamp(4px,0.4vw,8px)] text-[clamp(0.6rem,0.7vw,0.95rem)] uppercase tracking-[0.18em] text-[rgb(var(--dhikr-text-rgb)/0.65)]">
              {category}
            </div>
          )}
        </header>

        {/* Fit box: fixed height, content is measured and scaled to fill it. */}
        <main
          ref={boxRef}
          className="relative mx-auto min-h-0 w-full max-w-[1800px] flex-1 overflow-hidden"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              ref={contentRef}
              className="flex w-full flex-col items-center text-center"
              style={
                {
                  '--fit': scale,
                  gap: 'calc(var(--fit) * 0.75rem)',
                } as CSSProperties
              }
            >
              <div
                className="arabic w-full text-balance font-arabic font-medium text-[rgb(var(--dhikr-text-rgb))] drop-shadow-[0_2px_18px_rgb(var(--dhikr-accent-rgb)/0.12)]"
                dir="rtl"
                lang="ar"
                style={{ fontSize: 'calc(var(--fit) * 3.3rem)', lineHeight: 1.75 }}
              >
                {arabic}
              </div>

              {(transliteration || translation) && (
                <div
                  className="flex items-center justify-center gap-[calc(var(--fit)*0.5rem)]"
                  style={{ width: 'min(34%, calc(var(--fit) * 13rem))' }}
                  aria-hidden="true"
                >
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgb(var(--dhikr-accent-rgb)/0.7)]" />
                  <span
                    className="text-[rgb(var(--dhikr-accent-rgb))]"
                    style={{ fontSize: 'calc(var(--fit) * 0.75rem)' }}
                  >
                    ◆
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgb(var(--dhikr-accent-rgb)/0.7)]" />
                </div>
              )}

              {transliteration && (
                <div
                  className="w-[94%] text-pretty italic text-[rgb(var(--dhikr-text-rgb)/0.78)]"
                  style={{ fontSize: 'calc(var(--fit) * 1.05rem)', lineHeight: 1.55 }}
                >
                  {transliteration}
                </div>
              )}

              {translation && (
                <div
                  className="w-[92%] text-pretty font-medium text-[rgb(var(--dhikr-text-rgb)/0.95)]"
                  style={{ fontSize: 'calc(var(--fit) * 1.3rem)', lineHeight: 1.5 }}
                >
                  “{translation}”
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-4 pt-[clamp(6px,0.8vh,14px)] text-[clamp(0.6rem,0.7vw,0.95rem)] text-[rgb(var(--dhikr-text-rgb)/0.55)]">
          <div className="flex flex-wrap items-center gap-3">
            {source && <span>{source}</span>}
            {repeat && (
              <span className="rounded-full border border-[rgb(var(--dhikr-accent-rgb)/0.3)] bg-[rgb(var(--dhikr-accent-rgb)/0.1)] px-3 py-1 font-semibold text-[rgb(var(--dhikr-accent-rgb))]">
                Repeat ×{repeat}
              </span>
            )}
          </div>
          {footerRight}
        </footer>
      </div>
    </div>
  );
}

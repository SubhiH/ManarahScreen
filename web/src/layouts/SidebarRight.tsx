import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Clock from '@/components/Clock';
import PrayerTable from '@/components/PrayerTable';
import SlideCarousel from '@/components/SlideCarousel';
import DimOverlay from '@/components/DimOverlay';
import CountdownOverlay from '@/components/CountdownOverlay';
import SunriseCounter from '@/components/SunriseCounter';
import NextPrayerTicker from '@/components/NextPrayerTicker';
import { api } from '@/lib/api';
import type { DisplayProps } from './types';

const MIN_PCT = 18;
const MAX_PCT = 50;

export default function SidebarRight(p: DisplayProps) {
  const qc = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [localPct, setLocalPct] = useState(clamp(p.settings.sidebarPercent));
  const [dragging, setDragging] = useState(false);
  const latestRef = useRef(localPct);
  latestRef.current = localPct;

  // Sync local value with settings when not actively dragging.
  useEffect(() => {
    if (!dragging) setLocalPct(clamp(p.settings.sidebarPercent));
  }, [p.settings.sidebarPercent, dragging]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();

    const onMove = (ev: PointerEvent) => {
      const pct = ((rect.right - ev.clientX) / rect.width) * 100;
      setLocalPct(clamp(pct));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const finalPct = Math.round(latestRef.current);
      api
        .cosmeticSettings({ sidebarPercent: finalPct })
        .then(() => qc.invalidateQueries({ queryKey: ['public-settings'] }))
        .catch(() => {
          /* silently ignore — local value already applied */
        });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const pct = localPct;

  return (
    <div ref={rootRef} className="relative flex h-full w-full select-none">
      <div className="relative flex-1">
        <SlideCarousel slides={p.slides} />
        <DimOverlay show={p.dim.active} opacity={p.settings.dimOpacity} />
        <CountdownOverlay
          show={p.countdown.active}
          prayerLabel={p.countdown.label}
          secondsRemaining={p.countdown.secondsRemaining}
        />
        {p.settings.sunriseCounterPosition === 'top-banner' && (
          <SunriseCounter
            show={p.sunrise.active}
            label={p.settings.sunriseCounterLabel}
            secondsRemaining={p.sunrise.secondsRemaining}
            position="top-banner"
          />
        )}
      </div>

      {/* Draggable divider */}
      <div
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize sidebar"
        className={`group relative z-10 w-1.5 cursor-col-resize touch-none transition-colors ${
          dragging ? 'bg-theme-accent/50' : 'bg-theme-border/10 hover:bg-theme-accent/40'
        }`}
      >
        <div
          className={`absolute left-1/2 top-1/2 flex h-14 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-theme-border/20 bg-theme-bg/70 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100 ${
            dragging ? 'opacity-100' : ''
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <span className="h-1 w-1 rounded-full bg-theme-text-dim" />
            <span className="h-1 w-1 rounded-full bg-theme-text-dim" />
            <span className="h-1 w-1 rounded-full bg-theme-text-dim" />
          </div>
        </div>
      </div>

      <aside
        className="flex h-full flex-col border-l border-theme-border/10 bg-theme-bg/80 backdrop-blur"
        style={{ width: `${pct}%` }}
      >
        <div className="flex flex-col items-center gap-4 border-b border-theme-border/10 py-6">
          <Clock now={p.now} withSeconds={p.settings.clockSeconds} size="md" />
          <NextPrayerTicker now={p.now} action={p.nextAction} variant="block" />
        </div>
        {p.settings.sunriseCounterPosition === 'sidebar-inline' && (
          <div className="flex justify-center py-3">
            <SunriseCounter
              show={p.sunrise.active}
              label={p.settings.sunriseCounterLabel}
              secondsRemaining={p.sunrise.secondsRemaining}
              position="sidebar-inline"
            />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden py-[1vh]">
          <PrayerTable
            rows={p.rows}
            currentKey={p.currentKey}
            nextKey={p.nextKey}
            showSunrise={p.settings.showSunrise}
            jumuah={p.jumuah}
            jumuahCount={p.settings.jumuahCount}
          />
        </div>
      </aside>

      {dragging && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-theme-bg/85 px-3 py-1 text-xs font-semibold text-theme-accent shadow-lg">
          {Math.round(pct)}%
        </div>
      )}
    </div>
  );
}

function clamp(n: number): number {
  return Math.max(MIN_PCT, Math.min(MAX_PCT, n));
}

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import Clock from '@/components/Clock';
import PrayerTable from '@/components/PrayerTable';
import SlideCarousel from '@/components/SlideCarousel';
import DimOverlay from '@/components/DimOverlay';
import CountdownOverlay from '@/components/CountdownOverlay';
import SunriseCounter from '@/components/SunriseCounter';
import { api } from '@/lib/api';
import type { DisplayProps } from './types';

const MIN_PCT = 18;
const MAX_PCT = 55;

export default function SidebarBottom(p: DisplayProps) {
  const qc = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [localPct, setLocalPct] = useState(clamp(p.settings.sidebarPercent));
  const [dragging, setDragging] = useState(false);
  const latestRef = useRef(localPct);
  latestRef.current = localPct;

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
      const pct = ((rect.bottom - ev.clientY) / rect.height) * 100;
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
        .catch(() => {});
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const pct = localPct;

  return (
    <div ref={rootRef} className="relative flex h-full w-full select-none flex-col">
      <div className="relative flex-1 [container-type:size]">
        <SlideCarousel slides={p.slides} />
        <DimOverlay show={p.dim.active} opacity={p.settings.dimOpacity} />
        <CountdownOverlay
          show={p.countdown.active}
          prayerLabel={p.countdown.label}
          secondsRemaining={p.countdown.secondsRemaining}
        />
        {(p.settings.sunriseCounterPosition === 'top-banner' ||
          p.settings.sunriseCounterPosition === 'slide-area') && (
          <SunriseCounter
            show={p.sunrise.active}
            label={p.settings.sunriseCounterLabel}
            secondsRemaining={p.sunrise.secondsRemaining}
            totalSeconds={p.sunrise.totalSeconds}
            endTime={p.sunrise.endTime}
            position={p.settings.sunriseCounterPosition === 'slide-area' ? 'slide-area' : 'top-banner'}
          />
        )}
      </div>

      {/* Draggable divider */}
      <div
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation="horizontal"
        title="Drag to resize bottom bar"
        className={`group relative z-10 h-1.5 cursor-row-resize touch-none transition-colors ${
          dragging ? 'bg-theme-accent/50' : 'bg-theme-border/10 hover:bg-theme-accent/40'
        }`}
      >
        <div
          className={`absolute left-1/2 top-1/2 flex h-5 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-theme-border/20 bg-theme-bg/70 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100 ${
            dragging ? 'opacity-100' : ''
          }`}
        >
          <div className="flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-theme-text-dim" />
            <span className="h-1 w-1 rounded-full bg-theme-text-dim" />
            <span className="h-1 w-1 rounded-full bg-theme-text-dim" />
          </div>
        </div>
      </div>

      {/* Bottom strip — container-type:size enables cqh/cqw units inside, so
          text scales with the strip's actual dimensions (not the viewport). */}
      <div
        className="flex min-h-0 items-stretch gap-3 border-t border-theme-border/10 bg-theme-bg/85 px-4 py-[3cqh] backdrop-blur [container-type:size]"
        style={{ height: `${pct}%` }}
      >
        <div className="flex w-[18%] min-w-[180px] flex-col items-center justify-center gap-[2cqh] border-r border-theme-border/10 pr-3">
          <Clock now={p.now} withSeconds={p.settings.clockSeconds} size="sm" />
          {p.settings.sunriseCounterPosition === 'sidebar-inline' && (
            <div className="w-full">
              <SunriseCounter
                show={p.sunrise.active}
                label={p.settings.sunriseCounterLabel}
                secondsRemaining={p.sunrise.secondsRemaining}
                totalSeconds={p.sunrise.totalSeconds}
                position="sidebar-inline"
              />
            </div>
          )}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-2">
          {p.nextAction && <NextActionCell now={p.now} action={p.nextAction} />}
          <PrayerTable
            rows={p.rows}
            currentKey={p.currentKey}
            nextKey={p.nextKey}
            showSunrise={p.settings.showSunrise}
            jumuah={p.jumuah}
            jumuahCount={p.settings.jumuahCount}
            orientation="horizontal"
          />
        </div>
      </div>

      {dragging && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-theme-bg/85 px-3 py-1 text-xs font-semibold text-theme-accent shadow-lg">
          {Math.round(pct)}%
        </div>
      )}
    </div>
  );
}

function clamp(n: number): number {
  return Math.max(MIN_PCT, Math.min(MAX_PCT, n));
}

function NextActionCell({
  now,
  action,
}: {
  now: DateTime;
  action: NonNullable<DisplayProps['nextAction']>;
}) {
  const totalSec = Math.max(0, Math.floor(action.at.diff(now).as('seconds')));
  const isIqama = action.kind === 'iqamah';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const countdown =
    h > 0
      ? `${h}h ${m.toString().padStart(2, '0')}m`
      : `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <div
      className={
        'flex shrink-0 flex-col items-center justify-center gap-[1.2cqh] rounded-xl border px-[1.4cqw] py-[2cqh] ' +
        (isIqama
          ? 'border-theme-next/40 bg-theme-next/10 text-theme-next'
          : 'border-theme-accent/40 bg-theme-accent/10 text-theme-accent')
      }
    >
      <div className="whitespace-nowrap uppercase tracking-widest opacity-80 text-[min(14cqh,1.2cqw)]">
        {isIqama ? 'Iqama in' : 'Next Adhan'}
      </div>
      <div className="whitespace-nowrap font-semibold text-[min(16cqh,1.4cqw)]">
        {action.label}
      </div>
      <div className="whitespace-nowrap font-mono font-bold tabular-nums text-[min(18cqh,1.6cqw)]">
        {countdown}
      </div>
    </div>
  );
}

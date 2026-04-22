import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import SlideCarousel from '@/components/SlideCarousel';
import DimOverlay from '@/components/DimOverlay';
import CountdownOverlay from '@/components/CountdownOverlay';
import SunriseCounter from '@/components/SunriseCounter';
import { addMinutesHm, fmtTimeShort, hijriForDate } from '@/lib/time';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import type { PrayerRow } from '@/lib/types';
import type { DisplayProps } from './types';

/*
 * FlyerBoard layout — derived from SidebarRight, optimized for 1920x1080.
 *
 * Geometry:
 *   - Right column width  = `pct` vw (sidebar-percent setting)
 *   - Bottom row height   = `pct` vh
 *   On a 16:9 viewport, the remaining slide area is naturally 16:9, so the
 *   1920x1080 flyers fit without letterboxing — the "wasted" margins above
 *   and below the slide in SidebarRight are now occupied by the bottom bar
 *   and right column.
 *
 *   +---------------------------+----------+
 *   |                           |          |
 *   |   SLIDE (16:9, top-left)  | RIGHT    |
 *   |                           | PANEL    |
 *   |                           |          |
 *   +---------------------------+----------+
 *   |    BOTTOM BAR (5 prayer cells)       |
 *   +--------------------------------------+
 */

const MIN_PCT = 18;
const MAX_PCT = 40;

function clamp(n: number) {
  return Math.max(MIN_PCT, Math.min(MAX_PCT, n));
}

export default function FlyerBoard(p: DisplayProps) {
  const qc = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(clamp(p.settings.sidebarPercent));
  const [dragging, setDragging] = useState(false);
  const latestRef = useRef(pct);
  latestRef.current = pct;

  useEffect(() => {
    if (!dragging) setPct(clamp(p.settings.sidebarPercent));
  }, [p.settings.sidebarPercent, dragging]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();

    const onMove = (ev: PointerEvent) => {
      // Slide area's bottom-right corner sits where right column begins (x)
      // and where bottom row begins (y). Use the larger of the two scale
      // factors so the user's drag intent is honored on either axis even when
      // the viewport isn't exactly 16:9.
      const rightVw = ((rect.right - ev.clientX) / rect.width) * 100;
      const bottomVh = ((rect.bottom - ev.clientY) / rect.height) * 100;
      setPct(clamp(Math.max(rightVw, bottomVh)));
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

  return (
    <div
      ref={rootRef}
      className="relative grid h-full w-full select-none"
      style={
        {
          gridTemplateColumns: `1fr ${pct}vw`,
          gridTemplateRows: `1fr ${pct}vh`,
          '--scale-prayer': p.settings.fontScalePrayer ?? 1,
          '--scale-clock': p.settings.fontScaleClock ?? 1,
          '--scale-jumuah': p.settings.fontScaleJumuah ?? 1,
          '--scale-next': p.settings.fontScaleNextPrayer ?? 1,
        } as React.CSSProperties
      }
    >
      {/* SLIDE AREA (top-left) */}
      <div className="relative overflow-hidden bg-black [container-type:size]">
        <SlideCarousel slides={p.slides} />
        <DimOverlay show={p.dim.active} opacity={p.settings.dimOpacity} />
        <CountdownOverlay
          show={p.countdown.active}
          prayerLabel={p.countdown.label}
          secondsRemaining={p.countdown.secondsRemaining}
        />
        {(p.settings.sunriseCounterPosition === 'slide-area' ||
          p.settings.sunriseCounterPosition === 'top-banner') && (
          <SunriseCounter
            show={p.sunrise.active}
            label={p.settings.sunriseCounterLabel}
            secondsRemaining={p.sunrise.secondsRemaining}
            totalSeconds={p.sunrise.totalSeconds}
            endTime={p.sunrise.endTime}
            position={p.settings.sunriseCounterPosition}
          />
        )}
      </div>

      {/* RIGHT PANEL — grid with weighted rows so sections fill the entire
          height; each section is its own container so fonts can scale to it. */}
      <aside
        className="grid gap-[1.2cqh] overflow-hidden border-l border-theme-border/10 bg-theme-bg/85 p-[1.4cqh] backdrop-blur [container-type:size]"
        style={{
          gridTemplateRows: p.settings.jumuahCount >= 1
            ? '3fr 1.4fr 3.2fr 1.7fr 2.4fr'
            : '3fr 1.4fr 3.2fr 1.7fr',
        }}
      >
        <Section><BigClock now={p.now} withSeconds={p.settings.clockSeconds} /></Section>
        <Section><DateBlock now={p.now} /></Section>
        <Section><NextPrayerBig now={p.now} action={p.nextAction} /></Section>
        <Section>
          <SunriseDuhaBlock
            rows={p.rows}
            duhaMinutes={p.settings.sunriseCounterMinutes}
          />
        </Section>
        {p.settings.jumuahCount >= 1 && (
          <Section>
            <JumuahBlock jumuah={p.jumuah} count={p.settings.jumuahCount} />
          </Section>
        )}
      </aside>

      {/* BOTTOM PRAYER BAR (full width) */}
      <div className="col-span-2 border-t border-theme-border/10 bg-theme-bg/90 backdrop-blur [container-type:size]">
        <BottomPrayerBar
          rows={p.rows}
          currentKey={p.currentKey}
          nextKey={p.nextKey}
        />
      </div>

      {/* Corner drag handle — sits at the slide's bottom-right corner.
          Dragging it diagonally resizes the right column AND bottom row in
          lockstep so the slide region stays 16:9. */}
      <div
        onPointerDown={onPointerDown}
        role="separator"
        aria-label="Resize slide area"
        title="Drag to resize"
        className={cn(
          'absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none items-center justify-center rounded-full border border-theme-border/30 bg-theme-bg/85 text-theme-text-dim shadow-lg backdrop-blur transition-opacity',
          dragging ? 'opacity-100' : 'opacity-30 hover:opacity-100',
        )}
        style={{
          left: `calc(100% - ${pct}vw)`,
          top: `calc(100% - ${pct}vh)`,
        }}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
          <path
            d="M2 14L14 2M6 14L14 6M10 14L14 10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {dragging && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-theme-bg/85 px-3 py-1 text-xs font-semibold text-theme-accent shadow-lg">
          slide {Math.round(100 - pct)}% · panels {Math.round(pct)}%
        </div>
      )}
    </div>
  );
}

/* ============================ Right Panel ============================ */

/** Each row of the right-panel grid is its own size container, so the
 *  contents inside use cqh/cqw relative to *their own row*, not the aside. */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 items-center justify-center [container-type:size]">
      {children}
    </div>
  );
}

function BigClock({ now, withSeconds }: { now: DateTime; withSeconds: boolean }) {
  const hm = now.toFormat('h:mm');
  const ss = now.toFormat('ss');
  const am = now.toFormat('a');
  return (
    <div className="flex w-full items-baseline justify-center overflow-hidden whitespace-nowrap font-mono font-bold tracking-tight text-theme-accent drop-shadow">
      <span
        className="leading-none tabular-nums"
        style={{ fontSize: 'calc(min(58cqh, 24cqw) * var(--scale-clock, 1))' }}
      >
        {hm}
      </span>
      {withSeconds && (
        <span
          className="ml-[0.8cqw] leading-none tabular-nums opacity-50"
          style={{ fontSize: 'calc(min(20cqh, 8cqw) * var(--scale-clock, 1))' }}
        >
          :{ss}
        </span>
      )}
      <span
        className="ml-[1cqw] leading-none opacity-80"
        style={{ fontSize: 'calc(min(18cqh, 7cqw) * var(--scale-clock, 1))' }}
      >
        {am}
      </span>
    </div>
  );
}

function DateBlock({ now }: { now: DateTime }) {
  const h = hijriForDate(now);
  return (
    <div className="flex w-full flex-col items-center justify-center text-center">
      <div
        className="font-semibold leading-tight text-theme-text"
        style={{ fontSize: 'calc(min(38cqh, 7cqw) * var(--scale-clock, 1))' }}
      >
        {now.toFormat('cccc, LLL d, yyyy')}
      </div>
      <div
        className="mt-[3cqh] leading-tight text-theme-text-dim"
        style={{ fontSize: 'calc(min(32cqh, 6cqw) * var(--scale-clock, 1))' }}
      >
        {h.dDay} {h.month} {h.y} AH
      </div>
    </div>
  );
}

function NextPrayerBig({
  now,
  action,
}: {
  now: DateTime;
  action: DisplayProps['nextAction'];
}) {
  if (!action) return null;
  const totalSec = Math.max(0, Math.floor(action.at.diff(now).as('seconds')));
  const isIqama = action.kind === 'iqamah';
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-[2cqh] rounded-2xl border-2 px-[2cqw] py-[3cqh] text-center',
        isIqama
          ? 'border-theme-next/60 bg-theme-next/10 text-theme-next'
          : 'border-theme-accent/60 bg-theme-accent/10 text-theme-accent',
      )}
    >
      <div
        className="uppercase leading-none tracking-[0.18em] opacity-80"
        style={{ fontSize: 'calc(min(15cqh, 5.5cqw) * var(--scale-next, 1))' }}
      >
        {isIqama ? `${action.label} · Iqama in` : `Next · ${action.label}`}
      </div>
      <div
        className="font-mono font-bold leading-none tabular-nums"
        style={{ fontSize: 'calc(min(50cqh, 18cqw) * var(--scale-next, 1))' }}
      >
        {fmtDuration(totalSec)}
      </div>
    </div>
  );
}

function SunriseDuhaBlock({
  rows,
  duhaMinutes,
}: {
  rows: PrayerRow[];
  duhaMinutes: number;
}) {
  const sunriseHm = rows.find((r) => r.key === 'sunrise')?.adhan;
  if (!sunriseHm) return null;
  const duhaHm = duhaMinutes > 0 ? addMinutesHm(sunriseHm, duhaMinutes) : undefined;
  return (
    <div className="grid h-full w-full grid-cols-2 gap-[1.5cqw]">
      <StatCard label="Sunrise" time={fmtTimeShort(sunriseHm)} />
      <StatCard label="Duha" time={duhaHm ? fmtTimeShort(duhaHm) : '—'} accent />
    </div>
  );
}

function StatCard({
  label,
  time,
  accent,
  scaleVar = '--scale-prayer',
}: {
  label: string;
  time: string;
  accent?: boolean;
  scaleVar?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-[1.5cqh] rounded-xl border px-[1cqw] py-[1.5cqh] text-center [container-type:size]',
        accent
          ? 'border-theme-accent/40 bg-theme-accent/5'
          : 'border-theme-border/15 bg-theme-border/5',
      )}
    >
      <div
        className={cn(
          'uppercase leading-none tracking-wider',
          accent ? 'text-theme-accent' : 'text-theme-text-dim',
        )}
        style={{ fontSize: `calc(min(20cqh, 14cqw) * var(${scaleVar}, 1))` }}
      >
        {label}
      </div>
      <div
        className="whitespace-nowrap font-mono font-bold leading-none tabular-nums text-theme-text"
        style={{ fontSize: `calc(min(34cqh, 18cqw) * var(${scaleVar}, 1))` }}
      >
        {time}
      </div>
    </div>
  );
}

function JumuahBlock({
  jumuah,
  count,
}: {
  jumuah: { j1?: string; j2?: string; j3?: string };
  count: 1 | 2 | 3;
}) {
  // Convention: 1st khutbah is in Arabic, 2nd in English, 3rd extra slot.
  const items: { time?: string; label: string }[] = [
    { time: jumuah.j1, label: 'Jumaa AR' },
    { time: jumuah.j2, label: 'Jumaa En' },
    { time: jumuah.j3, label: 'Jumaa 3' },
  ].slice(0, count);

  return (
    <div
      className="grid h-full w-full gap-[1.5cqw]"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((row, i) => (
        <StatCard
          key={i}
          label={row.label}
          time={fmtTimeShort(row.time)}
          accent={i === 0}
          scaleVar="--scale-jumuah"
        />
      ))}
    </div>
  );
}

/* ============================ Bottom Bar ============================ */

function BottomPrayerBar({
  rows,
  currentKey,
  nextKey,
}: {
  rows: PrayerRow[];
  currentKey: PrayerRow['key'] | null;
  nextKey: PrayerRow['key'] | null;
}) {
  const items = rows.filter((r) => r.key !== 'sunrise');
  return (
    <div className="flex h-full w-full items-stretch gap-[1cqw] px-[1cqw] py-[1.5cqh]">
      {items.map((r) => (
        <PrayerCell
          key={r.key}
          row={r}
          highlight={
            r.key === currentKey ? 'current' : r.key === nextKey ? 'next' : 'none'
          }
        />
      ))}
    </div>
  );
}

function PrayerCell({
  row,
  highlight,
}: {
  row: PrayerRow;
  highlight: 'current' | 'next' | 'none';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-stretch justify-between gap-[1cqh] overflow-hidden rounded-2xl border-2 px-[1cqw] py-[2cqh] transition-colors [container-type:size]',
        highlight === 'current' &&
          'border-theme-accent bg-theme-accent/15 text-theme-accent shadow-[0_0_30px_-8px_rgb(var(--t-accent-rgb)/0.6)]',
        highlight === 'next' && 'border-theme-next/60 bg-theme-next/10 text-theme-next',
        highlight === 'none' && 'border-theme-border/20 bg-theme-border/5 text-theme-text',
      )}
    >
      {/* Prayer name */}
      <div className="flex items-center justify-center gap-[0.6cqw]">
        {highlight === 'current' && (
          <span className="h-[1.4cqh] w-[1.4cqh] shrink-0 animate-ping rounded-full bg-theme-accent" />
        )}
        <div
          className="text-center font-bold uppercase leading-none tracking-wide opacity-90"
          style={{ fontSize: 'calc(min(16cqh, 11cqw) * var(--scale-prayer, 1))' }}
        >
          {row.label}
        </div>
      </div>

      {/* Adhan row */}
      <TimeRow label="Adhan" time={row.adhan} sizeCap="adhan" />

      {/* Iqama row */}
      <TimeRow label="Iqama" time={row.iqamah} sizeCap="iqama" emphasized />
    </div>
  );
}

function TimeRow({
  label,
  time,
  sizeCap,
  emphasized,
}: {
  label: string;
  time?: string;
  sizeCap: 'adhan' | 'iqama';
  emphasized?: boolean;
}) {
  // cqh / cqw caps tuned for full-cell-width usage (no longer split into 2 cols).
  const labelSize = 'calc(min(7cqh, 4.5cqw) * var(--scale-prayer, 1))';
  const timeSize =
    sizeCap === 'iqama'
      ? 'calc(min(30cqh, 18cqw) * var(--scale-prayer, 1))'
      : 'calc(min(26cqh, 17cqw) * var(--scale-prayer, 1))';
  return (
    <div className="flex flex-col items-center gap-[0.5cqh]">
      <div
        className="uppercase leading-none tracking-[0.2em] text-theme-text-dim"
        style={{ fontSize: labelSize }}
      >
        {label}
      </div>
      <div
        className={cn(
          'whitespace-nowrap font-mono leading-none tabular-nums',
          emphasized ? 'font-extrabold' : 'opacity-90',
        )}
        style={{ fontSize: timeSize }}
      >
        {fmtTimeShort(time)}
      </div>
    </div>
  );
}

function fmtDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

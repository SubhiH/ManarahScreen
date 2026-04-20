import { fmtClock, fmtTimeShort, hijriForDate } from '@/lib/time';
import { cn } from '@/lib/cn';
import SlideCarousel from '@/components/SlideCarousel';
import DimOverlay from '@/components/DimOverlay';
import CountdownOverlay from '@/components/CountdownOverlay';
import SunriseCounter from '@/components/SunriseCounter';
import NextPrayerTicker from '@/components/NextPrayerTicker';
import type { DisplayProps } from './types';
import type { PrayerRow } from '@/lib/types';

type Highlight = 'current' | 'next' | 'none';

export default function TopBar(p: DisplayProps) {
  const h = hijriForDate(p.now);
  const hl = (k: PrayerRow['key']): Highlight =>
    p.currentKey === k ? 'current' : p.nextKey === k ? 'next' : 'none';

  return (
    <div className="relative flex h-full w-full flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-theme-border/10 bg-theme-bg/80 px-6 py-3 backdrop-blur">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[2.2vw] font-bold leading-none tabular-nums text-theme-accent whitespace-nowrap">
            {fmtClock(p.now, p.settings.clockSeconds)}
          </span>
          <div className="flex flex-col leading-tight text-theme-text/90">
            <span className="text-[1vw] font-semibold">{p.now.toFormat('ccc, LLL d yyyy')}</span>
            <span className="text-[0.85vw] text-theme-text-dim">
              {h.dDay} {h.month} {h.y} AH
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {p.settings.showSunrise && (
            <Pill
              label="Sunrise"
              time={p.rows.find((r) => r.key === 'sunrise')?.adhan}
              highlight="none"
            />
          )}
          <Pill
            label="Fajr"
            time={p.rows.find((r) => r.key === 'fajr')?.iqamah}
            highlight={hl('fajr')}
          />
          <Pill
            label="Dhuhr"
            time={p.rows.find((r) => r.key === 'dhuhr')?.iqamah}
            highlight={hl('dhuhr')}
          />
          <Pill
            label="Asr"
            time={p.rows.find((r) => r.key === 'asr')?.iqamah}
            highlight={hl('asr')}
          />
          <Pill
            label="Maghrib"
            time={p.rows.find((r) => r.key === 'maghrib')?.iqamah}
            highlight={hl('maghrib')}
          />
          <Pill
            label="Isha"
            time={p.rows.find((r) => r.key === 'isha')?.iqamah}
            highlight={hl('isha')}
          />
        </div>

        <NextPrayerTicker now={p.now} action={p.nextAction} variant="pill" />
      </header>

      <div className="relative flex-1">
        <SlideCarousel slides={p.slides} />
        <DimOverlay show={p.dim.active} opacity={p.settings.dimOpacity} />
        <CountdownOverlay
          show={p.countdown.active}
          prayerLabel={p.countdown.label}
          secondsRemaining={p.countdown.secondsRemaining}
        />
        <SunriseCounter
          show={p.sunrise.active}
          label={p.settings.sunriseCounterLabel}
          secondsRemaining={p.sunrise.secondsRemaining}
          position={p.settings.sunriseCounterPosition}
        />
      </div>

      {p.settings.jumuahCount >= 1 && (
        <div className="flex items-center justify-center gap-6 border-t border-theme-border/10 bg-theme-bg/80 px-6 py-2 text-theme-text/90">
          <span className="text-[0.85vw] uppercase tracking-wider text-theme-text-dim">
            Jumu'ah
          </span>
          <Pill label="1" time={p.jumuah.j1} highlight="none" />
          {p.settings.jumuahCount >= 2 && <Pill label="2" time={p.jumuah.j2} highlight="none" />}
          {p.settings.jumuahCount >= 3 && <Pill label="3" time={p.jumuah.j3} highlight="none" />}
        </div>
      )}
    </div>
  );
}

function Pill({
  label,
  time,
  highlight,
}: {
  label: string;
  time?: string;
  highlight: Highlight;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1 text-[1vw] transition-colors',
        highlight === 'current' &&
          'border-theme-accent/50 bg-theme-accent/10 text-theme-accent',
        highlight === 'next' && 'border-theme-next/50 bg-theme-next/10 text-theme-next',
        highlight === 'none' && 'border-transparent text-theme-text-dim',
      )}
    >
      <span
        className={cn(
          'uppercase tracking-wider',
          highlight === 'none' ? 'text-theme-text-dim' : 'opacity-80',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'font-mono font-semibold tabular-nums',
          highlight === 'none' && 'text-theme-text',
        )}
      >
        {fmtTimeShort(time)}
      </span>
    </div>
  );
}

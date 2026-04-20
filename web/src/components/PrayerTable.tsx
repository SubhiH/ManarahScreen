import { cn } from '@/lib/cn';
import { fmtTimeShort } from '@/lib/time';
import type { PrayerRow } from '@/lib/types';

type Props = {
  rows: PrayerRow[];
  currentKey: PrayerRow['key'] | null;
  nextKey: PrayerRow['key'] | null;
  showSunrise: boolean;
  jumuah: { j1?: string; j2?: string; j3?: string };
  jumuahCount: 1 | 2 | 3;
  compact?: boolean;
  orientation?: 'vertical' | 'horizontal';
};

export default function PrayerTable({
  rows,
  currentKey,
  nextKey,
  showSunrise,
  jumuah,
  jumuahCount,
  compact,
  orientation = 'vertical',
}: Props) {
  const visible = showSunrise ? rows : rows.filter((r) => r.key !== 'sunrise');

  if (orientation === 'horizontal') {
    return (
      <div className="flex h-full w-full items-stretch justify-between gap-[0.6cqw]">
        {visible.map((r) => (
          <PrayerCell
            key={r.key}
            row={r}
            highlight={r.key === currentKey ? 'current' : r.key === nextKey ? 'next' : 'none'}
          />
        ))}
        {jumuahCount >= 1 && (
          <JumuahCombinedCell
            count={jumuahCount}
            times={[jumuah.j1, jumuah.j2, jumuah.j3]}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Column header — aligned with each row's two time columns */}
      <div className="mx-2 shrink-0 grid grid-cols-2 gap-2 px-3 pb-[0.4vh] text-[min(1.1vh,0.9vw)] uppercase tracking-[0.25em] text-theme-text-dim">
        <span className="text-center">Adhan</span>
        <span className="text-center">Iqama</span>
      </div>

      {/* Rows take all remaining space; each row gets an equal share via flex-1 */}
      <div className="flex min-h-0 flex-1 flex-col gap-[0.4vh] px-2">
        {visible.map((r) => (
          <PrayerRowVertical
            key={r.key}
            row={r}
            highlight={r.key === currentKey ? 'current' : r.key === nextKey ? 'next' : 'none'}
          />
        ))}
      </div>

      {/* Jumu'ah strip — natural height, sized with vh so it scales with monitor */}
      <div className="mx-2 shrink-0 border-t border-theme-border/10 pt-[0.8vh]">
        <div className="mb-[0.4vh] text-[min(1vh,0.85vw)] uppercase tracking-widest text-theme-text-dim">
          Jumu'ah
        </div>
        <div className="flex flex-col gap-[0.3vh] pb-[0.4vh]">
          {jumuahCount >= 1 && <JumuahRow label="Jumu'ah 1" time={jumuah.j1} />}
          {jumuahCount >= 2 && <JumuahRow label="Jumu'ah 2" time={jumuah.j2} />}
          {jumuahCount >= 3 && <JumuahRow label="Jumu'ah 3" time={jumuah.j3} />}
        </div>
      </div>
    </div>
  );
}

function PrayerRowVertical({
  row,
  highlight,
}: {
  row: PrayerRow;
  highlight: 'current' | 'next' | 'none';
}) {
  return (
    <div
      className={cn(
        // flex-1 + min-h-0 makes each row take an equal share of the list's height
        'flex min-h-0 flex-1 flex-col justify-center gap-[0.2vh] rounded-lg border border-transparent px-3 py-[0.5vh] transition-colors',
        highlight === 'current' &&
          'border-theme-accent/40 bg-theme-accent/10 text-theme-accent shadow-[0_0_30px_-10px_rgb(var(--t-accent-rgb)/0.6)]',
        highlight === 'next' && 'border-theme-next/30 bg-theme-next/10 text-theme-next',
        highlight === 'none' && 'text-theme-text hover:bg-theme-border/5',
      )}
    >
      <div className="flex items-center gap-2 font-semibold uppercase tracking-wide text-[min(1.8vh,1.2vw)]">
        {highlight === 'current' && (
          <span className="h-2 w-2 animate-ping rounded-full bg-theme-accent" />
        )}
        {row.label}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <span className="text-center font-mono tabular-nums opacity-85 text-[min(2.6vh,1.7vw)]">
          {fmtTimeShort(row.adhan)}
        </span>
        <span
          className={cn(
            'text-center font-mono font-bold tabular-nums text-[min(2.6vh,1.7vw)]',
            row.key === 'sunrise' && 'opacity-30',
          )}
        >
          {row.key === 'sunrise' ? '—' : fmtTimeShort(row.iqamah)}
        </span>
      </div>
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
        // content-sized width (no flex-1): each cell hugs its text
        'flex shrink-0 flex-col items-center justify-center gap-[1.5cqh] rounded-xl border border-theme-border/10 bg-theme-border/5 px-[1.4cqw] py-[2cqh]',
        highlight === 'current' && 'border-theme-accent/50 bg-theme-accent/10 text-theme-accent',
        highlight === 'next' && 'border-theme-next/40 bg-theme-next/10 text-theme-next',
      )}
    >
      <div className="whitespace-nowrap font-semibold uppercase tracking-wide text-[min(14cqh,1.2cqw)]">
        {row.label}
      </div>
      <div className="whitespace-nowrap font-mono tabular-nums text-theme-text-dim text-[min(16cqh,1.4cqw)]">
        {fmtTimeShort(row.adhan)}
      </div>
      {row.key !== 'sunrise' && (
        <div className="whitespace-nowrap font-mono font-bold tabular-nums text-theme-text text-[min(18cqh,1.6cqw)]">
          {fmtTimeShort(row.iqamah)}
        </div>
      )}
    </div>
  );
}

function JumuahRow({ label, time }: { label: string; time?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-theme-border/5 px-3 py-[0.4vh] text-[min(1.8vh,1.2vw)]">
      <div className="font-medium text-theme-text/90">{label}</div>
      <div className="font-mono tabular-nums font-semibold text-theme-text">
        {fmtTimeShort(time)}
      </div>
    </div>
  );
}

function JumuahCombinedCell({
  count,
  times,
}: {
  count: 1 | 2 | 3;
  times: [string | undefined, string | undefined, string | undefined];
}) {
  const rows = times.slice(0, count).map((t, i) => ({ n: i + 1, t }));
  return (
    <div className="flex shrink-0 flex-col justify-center gap-[1cqh] rounded-xl border border-theme-accent/40 bg-theme-accent/10 px-[1.4cqw] py-[2cqh] text-theme-accent">
      <div className="whitespace-nowrap text-center font-semibold uppercase tracking-widest text-[min(14cqh,1.2cqw)]">
        Jumu'ah
      </div>
      <div className="flex flex-col gap-[0.6cqh]">
        {rows.map(({ n, t }) => (
          <div
            key={n}
            className="flex items-baseline justify-between gap-[0.8cqw] whitespace-nowrap font-mono tabular-nums text-[min(16cqh,1.4cqw)]"
          >
            <span className="opacity-70">{n}</span>
            <span className="font-bold">{fmtTimeShort(t)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

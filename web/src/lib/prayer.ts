import { DateTime } from 'luxon';
import type { PrayerRow, TodayPrayerPayload } from './types';
import { parseTodayHm } from './time';

const PRAYER_KEYS: { key: PrayerRow['key']; label: string; source: string }[] = [
  { key: 'fajr', label: 'Fajr', source: 'fajr' },
  { key: 'sunrise', label: 'Sunrise', source: 'sunrise' },
  { key: 'dhuhr', label: 'Dhuhr', source: 'dhuhr' },
  { key: 'asr', label: 'Asr', source: 'asr' },
  { key: 'maghrib', label: 'Maghrib', source: 'maghrib' },
  { key: 'isha', label: 'Isha', source: 'isha' },
];

function pick(obj: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Normalise the loose Masjidal payload into clean rows. */
export function rowsFromPayload(payload: TodayPrayerPayload | undefined): PrayerRow[] {
  if (!payload) return PRAYER_KEYS.map((p) => ({ key: p.key, label: p.label }));
  const adhan = (payload.data.adhan ?? {}) as Record<string, string>;
  const iqamah = (payload.data.iqamah ?? {}) as Record<string, string>;
  return PRAYER_KEYS.map((p) => ({
    key: p.key,
    label: p.label,
    adhan: pick(adhan, [p.source, p.source.toLowerCase(), p.source.toUpperCase()]),
    iqamah:
      p.key === 'sunrise'
        ? undefined
        : pick(iqamah, [p.source, p.source.toLowerCase(), p.source.toUpperCase()]),
  }));
}

export function jumuahFromPayload(payload: TodayPrayerPayload | undefined): {
  j1?: string;
  j2?: string;
  j3?: string;
} {
  const iq = (payload?.data.iqamah ?? {}) as Record<string, string>;
  return {
    j1: iq.jummah1 ?? iq.jumuah1 ?? iq.jummuah1,
    j2: iq.jummah2 ?? iq.jumuah2 ?? iq.jummuah2,
    j3: iq.jummah3 ?? iq.jumuah3 ?? iq.jummuah3,
  };
}

export type PrayerEvent = {
  kind: 'adhan' | 'iqamah';
  key: PrayerRow['key'];
  label: string;
  at: DateTime;
};

export function todayEvents(rows: PrayerRow[], tz: string): PrayerEvent[] {
  const out: PrayerEvent[] = [];
  for (const r of rows) {
    const a = parseTodayHm(r.adhan, tz);
    if (a && r.key !== 'sunrise') out.push({ kind: 'adhan', key: r.key, label: r.label, at: a });
    if (r.key === 'sunrise' && a) out.push({ kind: 'adhan', key: r.key, label: r.label, at: a });
    const i = parseTodayHm(r.iqamah, tz);
    if (i) out.push({ kind: 'iqamah', key: r.key, label: r.label, at: i });
  }
  out.sort((x, y) => x.at.toMillis() - y.at.toMillis());
  return out;
}

export function findNextAdhan(
  rows: PrayerRow[],
  tz: string,
  now: DateTime,
): PrayerEvent | null {
  const events = todayEvents(rows, tz);
  const upcoming = events.find(
    (e) => e.kind === 'adhan' && e.key !== 'sunrise' && e.at > now,
  );
  if (upcoming) return upcoming;
  // Past Isha — wrap to tomorrow's Fajr (approx using today's Fajr time +1 day).
  const fajrToday = events.find((e) => e.kind === 'adhan' && e.key === 'fajr');
  if (fajrToday) return { ...fajrToday, at: fajrToday.at.plus({ days: 1 }) };
  return null;
}

type PrayerWindows = Partial<Record<PrayerRow['key'], { adhan?: DateTime; iqamah?: DateTime }>>;

function groupByPrayer(rows: PrayerRow[], tz: string): PrayerWindows {
  const out: PrayerWindows = {};
  for (const e of todayEvents(rows, tz)) {
    if (e.key === 'sunrise') continue;
    out[e.key] ??= {};
    if (e.kind === 'adhan') out[e.key]!.adhan = e.at;
    else out[e.key]!.iqamah = e.at;
  }
  return out;
}

/**
 * A prayer is "current" only while it's actively happening:
 * from its Adhan up to Iqama + 15 min grace (or Adhan + 30 min if no Iqama).
 * Outside that window no prayer is highlighted — "next" takes over.
 */
export function findCurrentPrayer(
  rows: PrayerRow[],
  tz: string,
  now: DateTime,
  graceMinutes = 15,
): PrayerRow['key'] | null {
  const groups = groupByPrayer(rows, tz);
  for (const key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
    const p = groups[key];
    if (!p?.adhan) continue;
    const end = p.iqamah
      ? p.iqamah.plus({ minutes: graceMinutes })
      : p.adhan.plus({ minutes: graceMinutes * 2 });
    if (p.adhan <= now && now <= end) return key;
  }
  return null;
}

/**
 * The next thing to count down to:
 * - If an Adhan has just passed and its Iqama is still ahead → count to Iqama.
 * - Otherwise → count to the next Adhan (wrapping to tomorrow's Fajr after Isha).
 */
export function findNextAction(
  rows: PrayerRow[],
  tz: string,
  now: DateTime,
): { kind: 'adhan' | 'iqamah'; key: PrayerRow['key']; label: string; at: DateTime } | null {
  const groups = groupByPrayer(rows, tz);
  for (const key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
    const p = groups[key];
    if (p?.adhan && p.adhan <= now && p.iqamah && p.iqamah > now) {
      const label = rows.find((r) => r.key === key)?.label ?? key;
      return { kind: 'iqamah', key, label, at: p.iqamah };
    }
  }
  const nextA = findNextAdhan(rows, tz, now);
  return nextA ? { kind: 'adhan', key: nextA.key, label: nextA.label, at: nextA.at } : null;
}

export function findIqamahJustPassed(
  rows: PrayerRow[],
  tz: string,
  now: DateTime,
  windowSeconds: number,
): PrayerEvent | null {
  return (
    todayEvents(rows, tz).find(
      (e) =>
        e.kind === 'iqamah' &&
        e.at <= now &&
        now.diff(e.at).as('seconds') <= windowSeconds,
    ) ?? null
  );
}

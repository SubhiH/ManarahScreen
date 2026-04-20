import { DateTime } from 'luxon';
import { toHijri } from 'hijri-converter';

export function nowIn(tz: string): DateTime {
  return DateTime.now().setZone(tz);
}

export function parseTodayHm(hm: string | undefined, tz: string): DateTime | null {
  if (!hm) return null;
  const m = hm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return DateTime.now().setZone(tz).set({ hour, minute, second: 0, millisecond: 0 });
}

export function hijriForDate(d: DateTime): { y: number; m: number; dDay: number; month: string } {
  const jd = d.toJSDate();
  const { hy, hm, hd } = toHijri(jd.getFullYear(), jd.getMonth() + 1, jd.getDate());
  return { y: hy, m: hm, dDay: hd, month: HIJRI_MONTHS[hm - 1] ?? String(hm) };
}

export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhul-Qi'dah",
  'Dhul-Hijjah',
];

export function fmtClock(d: DateTime, withSeconds: boolean): string {
  // 12-hour with AM/PM: "3:42:07 PM" / "3:42 PM"
  return d.toFormat(withSeconds ? 'h:mm:ss a' : 'h:mm a');
}

export function fmtTimeShort(hm?: string): string {
  if (!hm) return '—';
  const m = hm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hm;
  const h24 = Number(m[1]);
  const mm = m[2];
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${mm} ${period}`;
}

export function diffSeconds(from: DateTime, to: DateTime): number {
  return Math.floor(to.diff(from).as('seconds'));
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

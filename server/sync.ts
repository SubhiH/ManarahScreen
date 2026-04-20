import cron, { ScheduledTask } from 'node-cron';
import { cacheWrite, getSettings } from './db';
import { fetchPrayerTimesForToday } from './masjidal';
import { refreshMasjidalSlides } from './slides';

export type SyncResult = {
  ok: boolean;
  at: number;
  prayerTimes: 'ok' | string;
  slides: 'ok' | string;
  slideCount?: number;
  slideErrors?: string[];
};

let lastResult: SyncResult | null = null;

export function getLastSync(): SyncResult | null {
  return lastResult;
}

export async function runSync(): Promise<SyncResult> {
  const at = Date.now();
  let prayerOk = true;
  let prayerErr: string | undefined;
  let slideCount: number | undefined;
  let slideErrors: string[] = [];
  let slideOk = true;
  let slideErr: string | undefined;

  try {
    const pt = await fetchPrayerTimesForToday();
    cacheWrite('prayer:today', { data: pt, fetchedAt: at });
  } catch (e) {
    prayerOk = false;
    prayerErr = e instanceof Error ? e.message : String(e);
  }

  try {
    const r = await refreshMasjidalSlides();
    slideCount = r.count;
    slideErrors = r.errors;
  } catch (e) {
    slideOk = false;
    slideErr = e instanceof Error ? e.message : String(e);
  }

  const res: SyncResult = {
    ok: prayerOk && slideOk,
    at,
    prayerTimes: prayerOk ? 'ok' : prayerErr ?? 'error',
    slides: slideOk ? 'ok' : slideErr ?? 'error',
    slideCount,
    slideErrors,
  };
  lastResult = res;
  return res;
}

let job: ScheduledTask | null = null;

export function scheduleDailySync() {
  if (job) {
    job.stop();
    job = null;
  }
  const { dailySyncTime } = getSettings();
  const [hh, mm] = dailySyncTime.split(':').map((x) => Number(x));
  const expr = `${isNaN(mm) ? 0 : mm} ${isNaN(hh) ? 3 : hh} * * *`;
  job = cron.schedule(expr, () => {
    runSync().catch((e) => console.error('[sync] failed', e));
  });
  console.log(`[sync] scheduled daily at ${dailySyncTime} (cron: ${expr})`);
}

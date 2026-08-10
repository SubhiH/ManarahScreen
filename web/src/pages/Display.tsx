import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { DateTime } from 'luxon';
import { api } from '@/lib/api';
import { resolveAdhkar, resolveAdhkarTitle } from '@/lib/adhkar';
import { duaPreviewSlides } from '@/lib/duaPreview';
import { useNow } from '@/hooks/useNow';
import { fmtTimeShort, parseTodayHm } from '@/lib/time';
import {
  findCurrentPrayer,
  findIqamahInRange,
  findNextAction,
  findNextAdhan,
  jumuahFromPayload,
  rowsFromPayload,
} from '@/lib/prayer';
import SidebarRight from '@/layouts/SidebarRight';
import SidebarBottom from '@/layouts/SidebarBottom';
import TopBar from '@/layouts/TopBar';
import FlyerBoard from '@/layouts/FlyerBoard';
import type { DisplayProps } from '@/layouts/types';

export default function Display() {
  const [searchParams] = useSearchParams();
  const settingsQ = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.publicSettings(),
    refetchInterval: 30_000,
  });
  const prayerQ = useQuery({
    queryKey: ['prayer-times'],
    queryFn: () => api.prayerTimes().catch(() => null),
    refetchInterval: 5 * 60_000,
  });
  const slidesQ = useQuery({
    queryKey: ['slides'],
    queryFn: () => api.slides(),
    refetchInterval: 60_000,
  });

  const tz = settingsQ.data?.timezone ?? 'America/New_York';
  const now = useNow(tz, 1000);

  const rows = useMemo(
    () => rowsFromPayload(prayerQ.data ?? undefined),
    [prayerQ.data],
  );
  const jumuah = useMemo(
    () => jumuahFromPayload(prayerQ.data ?? undefined),
    [prayerQ.data],
  );

  // All hooks must run before any early return.
  const testStartRef = useRef<DateTime>(now);

  if (!settingsQ.data) {
    return (
      <div className="flex h-full w-full items-center justify-center text-theme-text-dim">
        Loading…
      </div>
    );
  }

  const s = settingsQ.data;

  const nextAdhan = findNextAdhan(rows, tz, now);
  const currentKey = findCurrentPrayer(rows, tz, now);

  const countdownActive =
    nextAdhan !== null &&
    nextAdhan.at.diff(now).as('seconds') <= s.adhanCountdownSeconds &&
    nextAdhan.at.diff(now).as('seconds') > 0;

  const sunriseAt = parseTodayHm(rows.find((r) => r.key === 'sunrise')?.adhan, tz);
  const sunriseWindowSec = s.sunriseCounterMinutes * 60;
  const sunriseActive =
    !!sunriseAt && now >= sunriseAt && now.diff(sunriseAt).as('seconds') <= sunriseWindowSec;
  const sunriseRemaining = sunriseAt
    ? sunriseWindowSec - Math.floor(now.diff(sunriseAt).as('seconds'))
    : 0;
  const sunriseEndTime = sunriseAt
    ? fmtTimeShort(sunriseAt.plus({ minutes: s.sunriseCounterMinutes }).toFormat('HH:mm'))
    : undefined;

  // Post-Iqama phases run back to back: dim first, then (optionally) adhkar.
  const dimSeconds = Math.max(0, s.dimMinutes) * 60;
  const adhkarSeconds = s.postPrayerAdhkarEnabled
    ? Math.max(0, s.postPrayerAdhkarMinutes) * 60
    : 0;
  const iqamahJust = findIqamahInRange(rows, tz, now, 0, dimSeconds);
  const adhkarIqamah = findIqamahInRange(
    rows,
    tz,
    now,
    dimSeconds,
    dimSeconds + adhkarSeconds,
  );
  const adhkarElapsed = adhkarIqamah
    ? Math.floor(now.diff(adhkarIqamah.at).as('seconds')) - dimSeconds
    : 0;
  const nextAction = findNextAction(rows, tz, now);

  // Optional preview mode: /?test=countdown|sunrise|dim|adhkar|dua
  const testMode = searchParams.get('test');
  const elapsed = Math.floor(now.diff(testStartRef.current).as('seconds'));
  const test = testMode
    ? applyTestMode(testMode, elapsed, s.adhanCountdownSeconds, s.sunriseCounterMinutes * 60)
    : null;

  const slides = slidesQ.data?.slides ?? [];

  const props: DisplayProps = {
    now,
    settings: s,
    rows,
    currentKey,
    nextKey: nextAdhan?.key ?? null,
    jumuah,
    slides: testMode === 'dua' ? duaPreviewSlides(slides) : slides,
    countdown: test?.countdown ?? {
      active: countdownActive,
      label: nextAdhan?.label,
      secondsRemaining: nextAdhan ? Math.floor(nextAdhan.at.diff(now).as('seconds')) : 0,
    },
    sunrise: test?.sunrise ?? {
      active: sunriseActive,
      secondsRemaining: Math.max(0, sunriseRemaining),
      totalSeconds: sunriseWindowSec,
      endTime: sunriseEndTime,
    },
    dim: test?.dim ?? { active: !!iqamahJust },
    postAdhkar: {
      ...(test?.postAdhkar ?? {
        active: !!adhkarIqamah,
        secondsElapsed: Math.max(0, adhkarElapsed),
        totalSeconds: adhkarSeconds,
      }),
      items: resolveAdhkar(s.postPrayerAdhkarItems),
      title: resolveAdhkarTitle(s.postPrayerAdhkarTitle),
    },
    nextAction,
  };

  const child =
    s.layout === 'sidebar-bottom' ? (
      <SidebarBottom {...props} />
    ) : s.layout === 'top-bar' ? (
      <TopBar {...props} />
    ) : s.layout === 'flyer-board' ? (
      <FlyerBoard {...props} />
    ) : (
      <SidebarRight {...props} />
    );

  return (
    <>
      {child}
      {testMode && <TestBanner mode={testMode} elapsed={elapsed} test={test} />}
    </>
  );
}

/* ---------- test mode helpers ---------- */

function applyTestMode(
  mode: string,
  elapsed: number,
  adhanCountdownSec: number,
  sunriseTotalSec: number,
): {
  countdown?: DisplayProps['countdown'];
  sunrise?: DisplayProps['sunrise'];
  dim?: DisplayProps['dim'];
  postAdhkar?: Omit<DisplayProps['postAdhkar'], 'items' | 'title'>;
} | null {
  if (mode === 'countdown') {
    const total = Math.max(15, adhanCountdownSec);
    const remaining = Math.max(0, total - elapsed);
    return {
      countdown: {
        active: remaining > 0,
        label: 'Fajr (test)',
        secondsRemaining: remaining,
      },
    };
  }
  if (mode === 'sunrise') {
    // Cap preview at 60s so you don't wait the full configured window.
    const total = Math.min(60, sunriseTotalSec);
    const remaining = Math.max(0, total - elapsed);
    const endHm = DateTime.now().plus({ seconds: remaining });
    return {
      sunrise: {
        active: remaining > 0,
        secondsRemaining: remaining,
        totalSeconds: total,
        endTime: endHm.toFormat('h:mm a'),
      },
    };
  }
  if (mode === 'dim') {
    // Fixed 30s preview.
    return { dim: { active: elapsed < 30 } };
  }
  if (mode === 'adhkar') {
    // Fixed 90s preview — long enough to cycle through every dhikr once.
    const total = 90;
    return {
      postAdhkar: {
        active: elapsed < total,
        secondsElapsed: elapsed,
        totalSeconds: total,
      },
    };
  }
  return null;
}

function TestBanner({
  mode,
  elapsed,
  test,
}: {
  mode: string;
  elapsed: number;
  test: ReturnType<typeof applyTestMode>;
}) {
  const active =
    mode === 'dua' || // the dua preview simply stays on screen
    (mode === 'countdown' && test?.countdown?.active) ||
    (mode === 'sunrise' && test?.sunrise?.active) ||
    (mode === 'dim' && test?.dim?.active) ||
    (mode === 'adhkar' && test?.postAdhkar?.active);
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-[60] -translate-x-1/2 rounded-full border border-theme-accent/50 bg-black/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-theme-accent">
      Test mode · {mode} · {active ? `${elapsed}s elapsed` : 'ended (reload to replay)'}
    </div>
  );
}

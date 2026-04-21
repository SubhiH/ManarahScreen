import { DateTime } from 'luxon';
import type { PrayerRow, PublicSettings, UnifiedSlide } from '@/lib/types';

export type DisplayProps = {
  now: DateTime;
  settings: PublicSettings;
  rows: PrayerRow[];
  currentKey: PrayerRow['key'] | null;
  nextKey: PrayerRow['key'] | null;
  jumuah: { j1?: string; j2?: string; j3?: string };
  slides: UnifiedSlide[];
  countdown: { active: boolean; label?: string; secondsRemaining: number };
  sunrise: {
    active: boolean;
    secondsRemaining: number;
    totalSeconds: number;
    /** Wall-clock time when the post-Sunrise window ends, formatted (e.g. "6:38 AM"). */
    endTime?: string;
  };
  dim: { active: boolean };
  nextAction: { kind: 'adhan' | 'iqamah'; label: string; at: DateTime } | null;
};

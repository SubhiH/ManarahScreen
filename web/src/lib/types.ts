export type LayoutName = 'sidebar-right' | 'sidebar-bottom' | 'top-bar' | 'flyer-board';
export type ThemeName =
  | 'midnight'
  | 'forest'
  | 'royal'
  | 'navy'
  | 'graphite'
  | 'cream'
  | 'parchment';

export type PublicSettings = {
  masjidId: string;
  prayerTimesSource: 'masjidal' | 'disabled';
  slidesSource: 'masjidal' | 'custom-api' | 'disabled';
  customSlidesApiUrl: string;
  duaSlideEnabled: boolean;
  duaCacheDays: number;
  timezone: string;
  layout: LayoutName;
  theme: ThemeName;
  sidebarPercent: number;
  showSunrise: boolean;
  jumuahCount: 1 | 2 | 3;
  adhanCountdownSeconds: number;
  dimMinutes: number;
  dimOpacity: number;
  sunriseCounterMinutes: number;
  sunriseCounterLabel: string;
  sunriseCounterPosition: 'slide-area' | 'top-banner' | 'sidebar-inline';
  dailySyncTime: string;
  locale: string;
  clockSeconds: boolean;
  fontScalePrayer: number;
  fontScaleClock: number;
  fontScaleJumuah: number;
  fontScaleNextPrayer: number;
  liveMode: boolean;
  masjidalConfigured: boolean;
  liveCameraLabel: string;
};

export type UnifiedSlide = {
  id: string;
  source: 'masjidal' | 'custom-api' | 'local' | 'dua';
  name: string;
  url: string;
  originalUrl?: string;
  enabled: boolean;
  sortOrder: number;
  duration: number;
  kind: 'image' | 'video' | 'dua';
  dua?: DuaContent;
};

export type DuaContent = {
  id: string;
  title: string;
  arabic: string;
  transliteration?: string;
  translation: string;
  source?: string;
  category?: string;
  repeat?: number;
};

export type PrayerRow = {
  key: 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
  label: string;
  adhan?: string;   // 'HH:mm' local
  iqamah?: string;  // 'HH:mm' local
};

export type TodayPrayerPayload = {
  data: {
    adhan?: Record<string, string>;
    iqamah?: Record<string, string>;
  } & Record<string, unknown>;
  updatedAt: number;
};

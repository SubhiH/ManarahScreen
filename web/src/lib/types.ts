export type LayoutName = 'sidebar-right' | 'sidebar-bottom' | 'top-bar';
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
  sunriseCounterPosition: 'top-banner' | 'sidebar-inline';
  dailySyncTime: string;
  locale: string;
  clockSeconds: boolean;
  masjidalConfigured: boolean;
};

export type UnifiedSlide = {
  id: string;
  source: 'masjidal' | 'local';
  name: string;
  url: string;
  originalUrl?: string;
  enabled: boolean;
  sortOrder: number;
  duration: number;
  kind: 'image' | 'video';
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

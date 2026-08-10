import type { PostPrayerDhikr } from './types';

export const DEFAULT_ADHKAR_TITLE = 'أذكار بعد الصلاة · Adhkar after Salah';

/** Shown when the admin hasn't customised the list (settings store an empty array). */
export const DEFAULT_POST_PRAYER_ADHKAR: PostPrayerDhikr[] = [
  {
    arabic:
      'أَسْتَغْفِرُ اللَّهَ (ثَلاَثَاً) اللَّهُمَّ أَنْتَ السَّلاَمُ، وَمِنْكَ السَّلاَمُ، تَبَارَكْتَ يَا ذَا الْجَلاَلِ وَالْإِكْرَامِ',
    transliteration:
      'Astaghfirullāh (three times). Allāhumma anta-s-Salām, wa minka-s-salām, tabārakta yā Dhā-l-Jalāli wa-l-Ikrām.',
    translation:
      'I seek the forgiveness of Allah (three times). O Allah, You are Peace and from You comes peace. Blessed are You, O Owner of Majesty and Honour.',
    source: 'Muslim 591',
  },
  {
    arabic:
      'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَاللَّهُ أَكْبَرُ (ثلاثاً وثلاثين) لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration:
      'Subḥānallāh, wal-ḥamdu lillāh, wallāhu akbar (thirty-three times each). Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa lahu-l-ḥamdu wa huwa ʿalā kulli shay’in qadīr.',
    translation:
      'Glory is to Allah, praise is to Allah, and Allah is the Most Great (thirty-three times each). None has the right to be worshipped but Allah alone, He has no partner, His is the dominion and His is the praise, and He is Able to do all things.',
    source: 'Muslim 597',
  },
];

/** Configured adhkar, falling back to the built-in list while none are saved. */
export function resolveAdhkar(items: PostPrayerDhikr[] | undefined): PostPrayerDhikr[] {
  return items && items.length > 0 ? items : DEFAULT_POST_PRAYER_ADHKAR;
}

export function resolveAdhkarTitle(title: string | undefined): string {
  return title?.trim() || DEFAULT_ADHKAR_TITLE;
}

/** Seconds each dhikr stays on screen inside a window of `totalSeconds`. */
export function adhkarSlotSeconds(totalSeconds: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(45, Math.max(15, Math.round(totalSeconds / count)));
}

/** Which dhikr is on screen `elapsed` seconds into the window — same on every display. */
export function adhkarIndexAt(elapsed: number, totalSeconds: number, count: number): number {
  if (count <= 0) return 0;
  const slot = adhkarSlotSeconds(totalSeconds, count);
  if (slot <= 0) return 0;
  return Math.floor(Math.max(0, elapsed) / slot) % count;
}

import type { DuaContent, UnifiedSlide } from './types';

/** Stand-in used by `/?test=dua` before the first dua has synced. */
const SAMPLE_DUA: DuaContent = {
  id: 'dua:sample',
  title: 'Sayyid al-Istighfar',
  category: 'Sample',
  arabic:
    'اللَّهُمَّ أَنْتَ رَبِّي لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ',
  transliteration:
    'Allāhumma anta Rabbī lā ilāha illā anta, khalaqtanī wa anā ʿabduka, wa anā ʿalā ʿahdika wa waʿdika mā-staṭaʿt.',
  translation:
    'O Allah, You are my Lord, there is none worthy of worship but You. You created me and I am Your servant, and I abide by Your covenant and promise as best I can.',
  source: 'Bukhari 6306',
};

/**
 * The dua slide on its own, so the preview shows it full-screen instead of
 * waiting for the carousel to reach it. Falls back to a sample when no dua
 * has been fetched yet.
 */
export function duaPreviewSlides(slides: UnifiedSlide[]): UnifiedSlide[] {
  const existing = slides.find((s) => s.kind === 'dua' && s.dua);
  if (existing) return [{ ...existing, duration: 3600 }];
  return [
    {
      id: 'dua:sample',
      source: 'dua',
      name: `Dua · ${SAMPLE_DUA.title}`,
      url: '',
      enabled: true,
      sortOrder: 0,
      duration: 3600,
      kind: 'dua',
      dua: SAMPLE_DUA,
    },
  ];
}

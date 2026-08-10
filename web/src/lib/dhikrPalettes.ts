import type { CSSProperties } from 'react';

export type DhikrPalette = 'emerald' | 'royal' | 'midnight' | 'maroon' | 'teal' | 'charcoal';

export type DhikrPaletteSpec = {
  label: string;
  backgroundColor: string;
  backgroundImage: string;
  /** `R G B` triplets so Tailwind arbitrary values can apply alpha. */
  accentRgb: string;
  textRgb: string;
  /** Miniature of the background, for the admin swatch buttons. */
  swatch: string;
};

export const DHIKR_PALETTES: Record<DhikrPalette, DhikrPaletteSpec> = {
  emerald: {
    label: 'Emerald',
    backgroundColor: '#061d1a',
    backgroundImage:
      'radial-gradient(circle at 50% 38%, rgba(214, 179, 92, 0.17), transparent 32%), radial-gradient(circle at 12% 12%, rgba(39, 134, 112, 0.26), transparent 28%), radial-gradient(circle at 88% 90%, rgba(147, 101, 45, 0.2), transparent 30%), linear-gradient(145deg, #041512 0%, #0a3129 50%, #061b18 100%)',
    accentRgb: '231 200 121',
    textRgb: '255 250 240',
    swatch: 'linear-gradient(135deg, #041512 0%, #0a3129 60%, #e7c879 160%)',
  },
  royal: {
    label: 'Royal',
    backgroundColor: '#0f0a26',
    backgroundImage:
      'radial-gradient(circle at 50% 36%, rgba(226, 191, 108, 0.18), transparent 34%), radial-gradient(circle at 14% 14%, rgba(104, 82, 205, 0.32), transparent 30%), radial-gradient(circle at 86% 88%, rgba(152, 84, 150, 0.22), transparent 30%), linear-gradient(150deg, #0b0620 0%, #241a55 52%, #100a2c 100%)',
    accentRgb: '240 215 149',
    textRgb: '248 244 255',
    swatch: 'linear-gradient(135deg, #0b0620 0%, #241a55 60%, #f0d795 160%)',
  },
  midnight: {
    label: 'Midnight',
    backgroundColor: '#050d1f',
    backgroundImage:
      'radial-gradient(circle at 50% 36%, rgba(198, 178, 120, 0.16), transparent 34%), radial-gradient(circle at 14% 14%, rgba(46, 86, 168, 0.30), transparent 30%), radial-gradient(circle at 86% 88%, rgba(38, 120, 150, 0.20), transparent 30%), linear-gradient(150deg, #030a18 0%, #12294f 52%, #061027 100%)',
    accentRgb: '226 205 140',
    textRgb: '240 246 255',
    swatch: 'linear-gradient(135deg, #030a18 0%, #12294f 60%, #e2cd8c 160%)',
  },
  maroon: {
    label: 'Maroon',
    backgroundColor: '#210711',
    backgroundImage:
      'radial-gradient(circle at 50% 36%, rgba(226, 186, 110, 0.18), transparent 34%), radial-gradient(circle at 14% 14%, rgba(150, 40, 66, 0.32), transparent 30%), radial-gradient(circle at 86% 88%, rgba(96, 30, 60, 0.24), transparent 30%), linear-gradient(150deg, #1a0510 0%, #4a1024 52%, #23070f 100%)',
    accentRgb: '240 206 143',
    textRgb: '255 242 240',
    swatch: 'linear-gradient(135deg, #1a0510 0%, #4a1024 60%, #f0ce8f 160%)',
  },
  teal: {
    label: 'Teal',
    backgroundColor: '#04202a',
    backgroundImage:
      'radial-gradient(circle at 50% 36%, rgba(214, 200, 150, 0.15), transparent 34%), radial-gradient(circle at 14% 14%, rgba(22, 132, 162, 0.32), transparent 30%), radial-gradient(circle at 86% 88%, rgba(18, 92, 138, 0.24), transparent 30%), linear-gradient(150deg, #02161d 0%, #0a4a5e 52%, #04222d 100%)',
    accentRgb: '224 216 176',
    textRgb: '238 250 255',
    swatch: 'linear-gradient(135deg, #02161d 0%, #0a4a5e 60%, #e0d8b0 160%)',
  },
  charcoal: {
    label: 'Charcoal',
    backgroundColor: '#101012',
    backgroundImage:
      'radial-gradient(circle at 50% 36%, rgba(220, 170, 90, 0.14), transparent 34%), radial-gradient(circle at 14% 14%, rgba(80, 80, 90, 0.30), transparent 30%), radial-gradient(circle at 86% 88%, rgba(60, 60, 70, 0.24), transparent 30%), linear-gradient(150deg, #0b0b0d 0%, #24242a 52%, #121216 100%)',
    accentRgb: '232 186 112',
    textRgb: '245 245 248',
    swatch: 'linear-gradient(135deg, #0b0b0d 0%, #24242a 60%, #e8ba70 160%)',
  },
};

export const DHIKR_PALETTE_KEYS = Object.keys(DHIKR_PALETTES) as DhikrPalette[];

/** Used for the dua slide and for adhkar that don't pick a colour. */
export const DEFAULT_DUA_PALETTE: DhikrPalette = 'emerald';
export const DEFAULT_ADHKAR_PALETTE: DhikrPalette = 'royal';

export function isDhikrPalette(value: unknown): value is DhikrPalette {
  return typeof value === 'string' && value in DHIKR_PALETTES;
}

export function resolvePalette(value: unknown, fallback: DhikrPalette): DhikrPalette {
  return isDhikrPalette(value) ? value : fallback;
}

/** Palette colours as CSS custom properties, for elements outside the canvas. */
export function paletteVars(palette: DhikrPalette): CSSProperties {
  const spec = DHIKR_PALETTES[palette];
  return {
    '--dhikr-accent-rgb': spec.accentRgb,
    '--dhikr-text-rgb': spec.textRgb,
  } as CSSProperties;
}

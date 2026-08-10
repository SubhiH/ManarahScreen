import type { DuaContent } from '@/lib/types';
import DhikrCanvas from './DhikrCanvas';

export default function DuaSlide({ dua }: { dua: DuaContent }) {
  return (
    <DhikrCanvas
      palette="emerald"
      title={dua.title}
      category={dua.category}
      arabic={dua.arabic}
      transliteration={dua.transliteration}
      translation={dua.translation}
      source={dua.source}
      repeat={dua.repeat}
    />
  );
}

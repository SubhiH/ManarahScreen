import type { DuaContent } from '@/lib/types';

export default function DuaSlide({ dua }: { dua: DuaContent }) {
  const textLength =
    dua.arabic.length + dua.translation.length + (dua.transliteration?.length ?? 0);
  const arabicSize =
    textLength > 900
      ? 'clamp(1.35rem, 2vw, 3.2rem)'
      : textLength > 560
        ? 'clamp(1.65rem, 2.5vw, 4rem)'
        : 'clamp(2rem, 3.2vw, 5.2rem)';
  const bodySize =
    textLength > 900
      ? 'clamp(0.8rem, 1vw, 1.45rem)'
      : textLength > 560
        ? 'clamp(0.9rem, 1.2vw, 1.7rem)'
        : 'clamp(1rem, 1.4vw, 2rem)';

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#061d1a] text-[#fff9e9]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 38%, rgba(214, 179, 92, 0.17), transparent 32%), radial-gradient(circle at 12% 12%, rgba(39, 134, 112, 0.26), transparent 28%), radial-gradient(circle at 88% 90%, rgba(147, 101, 45, 0.2), transparent 30%), linear-gradient(145deg, #041512 0%, #0a3129 50%, #061b18 100%)',
      }}
    >
      <div className="dua-pattern-motion pointer-events-none absolute inset-0 opacity-[0.16]" />

      <div className="pointer-events-none absolute inset-[clamp(12px,1.5vw,28px)] rounded-[clamp(18px,2vw,38px)] border border-[#e7c879]/30" />
      <div className="pointer-events-none absolute left-[4%] top-[7%] h-[clamp(70px,8vw,150px)] w-[clamp(70px,8vw,150px)] rotate-45 rounded-[22%] border border-[#e7c879]/20" />
      <div className="pointer-events-none absolute bottom-[7%] right-[4%] h-[clamp(70px,8vw,150px)] w-[clamp(70px,8vw,150px)] rotate-45 rounded-[22%] border border-[#e7c879]/20" />

      <div className="relative z-10 flex h-full flex-col px-[clamp(32px,6vw,120px)] py-[clamp(25px,4vw,70px)]">
        <header className="flex shrink-0 items-center justify-between gap-4">
          <div className="flex items-center gap-[clamp(10px,1vw,18px)]">
            <div className="flex h-[clamp(36px,3vw,58px)] w-[clamp(36px,3vw,58px)] items-center justify-center rounded-full border border-[#e7c879]/50 bg-[#e7c879]/10 text-[clamp(1rem,1.5vw,1.8rem)] text-[#efd58e]">
              ۞
            </div>
            <div>
              <div className="text-[clamp(1rem,1.35vw,1.9rem)] font-semibold text-white/95">
                {dua.title}
              </div>
            </div>
          </div>
          {dua.category && (
            <div className="rounded-full border border-white/15 bg-white/[0.06] px-[clamp(12px,1.2vw,22px)] py-[clamp(5px,0.5vw,9px)] text-[clamp(0.65rem,0.75vw,1rem)] uppercase tracking-[0.18em] text-white/65">
              {dua.category}
            </div>
          )}
        </header>

        <main className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col items-center justify-center gap-[clamp(10px,1.6vh,24px)] text-center">
          <div
            className="arabic max-w-[96%] font-arabic font-medium text-[#fffaf0] drop-shadow-[0_2px_18px_rgba(231,200,121,0.12)]"
            dir="rtl"
            lang="ar"
            style={{ fontSize: arabicSize, lineHeight: 1.7 }}
          >
            {dua.arabic}
          </div>

          <div className="flex w-[min(430px,34%)] items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e7c879]/70" />
            <span className="text-[clamp(0.7rem,0.9vw,1.15rem)] text-[#e7c879]">◆</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e7c879]/70" />
          </div>

          {dua.transliteration && (
            <div
              className="max-w-[92%] italic leading-relaxed text-[#dcebe5]/80"
              style={{ fontSize: bodySize }}
            >
              {dua.transliteration}
            </div>
          )}

          <div
            className="max-w-[90%] font-medium leading-relaxed text-white/95"
            style={{ fontSize: bodySize }}
          >
            “{dua.translation}”
          </div>
        </main>

        <footer className="flex shrink-0 items-end gap-5 text-[clamp(0.65rem,0.75vw,1rem)] text-white/55">
          <div className="flex flex-wrap items-center gap-3">
            {dua.source && <span>{dua.source}</span>}
            {dua.repeat && (
              <span className="rounded-full border border-[#e7c879]/30 bg-[#e7c879]/10 px-3 py-1 font-semibold text-[#efd58e]">
                Repeat ×{dua.repeat}
              </span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

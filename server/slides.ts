import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { allSlideStates, cacheRead, cacheWrite, getSlideState, upsertSlideState } from './db';
import { fetchSlides, MasjidalSlide } from './masjidal';

const ROOT = path.resolve(__dirname, '..');
const LOCAL_SLIDES_DIR = path.join(ROOT, 'slides');
const CACHE_DIR = path.join(ROOT, 'slides-cache');
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4', '.webm']);

if (!fs.existsSync(LOCAL_SLIDES_DIR)) fs.mkdirSync(LOCAL_SLIDES_DIR, { recursive: true });
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

export type UnifiedSlide = {
  id: string;
  source: 'masjidal' | 'local';
  name: string;
  url: string;            // served to frontend
  originalUrl?: string;   // upstream (masjidal) source, for debugging
  enabled: boolean;
  sortOrder: number;
  duration: number;       // seconds
  kind: 'image' | 'video';
};

export const LOCAL_SLIDES_ROOT = LOCAL_SLIDES_DIR;
export const SLIDE_CACHE_ROOT = CACHE_DIR;

/* ---------- local folder ---------- */

let localFiles: string[] = [];

function rescanLocal() {
  try {
    localFiles = fs
      .readdirSync(LOCAL_SLIDES_DIR)
      .filter((n) => !n.startsWith('.') && IMG_EXT.has(path.extname(n).toLowerCase()));
  } catch {
    localFiles = [];
  }
}
rescanLocal();

chokidar
  .watch(LOCAL_SLIDES_DIR, { ignoreInitial: true, depth: 0 })
  .on('all', () => rescanLocal());

function localAsSlides(): UnifiedSlide[] {
  return localFiles.map((name, i) => {
    const id = `local:${name}`;
    const st = getSlideState(id);
    const ext = path.extname(name).toLowerCase();
    const kind: 'image' | 'video' = ext === '.mp4' || ext === '.webm' ? 'video' : 'image';
    return {
      id,
      source: 'local',
      name,
      url: `/slides-files/local/${encodeURIComponent(name)}`,
      enabled: st ? !!st.enabled : true,
      sortOrder: st ? st.sort_order : 1000 + i,
      duration: st ? st.duration : 10,
      kind,
    };
  });
}

/* ---------- masjidal (cached) ---------- */

async function downloadCached(slide: MasjidalSlide): Promise<string> {
  const safeId = slide.id.replace(/[^a-zA-Z0-9:_-]/g, '_');
  const ext = path.extname(new URL(slide.imageUrl).pathname) || '.jpg';
  const localName = `${safeId}${ext}`;
  const localPath = path.join(CACHE_DIR, localName);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) return localName;
  const res = await fetch(slide.imageUrl);
  if (!res.ok) throw new Error(`download failed ${slide.imageUrl}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(localPath, buf);
  return localName;
}

const CACHE_KEY = 'slides:masjidal';

type CachedMasjidal = {
  id: string;
  name: string;
  localFile: string;
  originalUrl: string;
  kind: 'image' | 'video';
  defaultDuration: number;
  defaultSortOrder: number;
};

export async function refreshMasjidalSlides(): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  const remote = await fetchSlides();
  const cached: CachedMasjidal[] = [];
  for (const s of remote) {
    try {
      const localFile = await downloadCached(s);
      cached.push({
        id: s.id,
        name: s.name,
        localFile,
        originalUrl: s.imageUrl,
        kind: s.kind,
        defaultDuration: s.duration,
        defaultSortOrder: s.sortOrder,
      });
    } catch (e) {
      errors.push(`${s.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  cacheWrite(CACHE_KEY, cached);
  return { count: cached.length, errors };
}

function masjidalAsSlides(): UnifiedSlide[] {
  const c = cacheRead<CachedMasjidal[]>(CACHE_KEY);
  const list = c?.value ?? [];
  return list.map((row) => {
    const st = getSlideState(row.id);
    return {
      id: row.id,
      source: 'masjidal',
      name: row.name,
      url: `/slides-files/cache/${encodeURIComponent(row.localFile)}`,
      originalUrl: row.originalUrl,
      enabled: st ? !!st.enabled : true,
      sortOrder: st ? st.sort_order : row.defaultSortOrder,
      duration: st ? st.duration : row.defaultDuration,
      kind: row.kind,
    };
  });
}

/* ---------- merged ---------- */

export function listSlides(): UnifiedSlide[] {
  const all = [...masjidalAsSlides(), ...localAsSlides()];
  all.sort((a, b) => a.sortOrder - b.sortOrder);
  return all;
}

export function updateSlide(id: string, patch: Partial<Pick<UnifiedSlide, 'enabled' | 'sortOrder' | 'duration'>>) {
  const existing =
    getSlideState(id) ??
    (() => {
      const current = listSlides().find((s) => s.id === id);
      return current
        ? { id, enabled: current.enabled ? 1 : 0, sort_order: current.sortOrder, duration: current.duration }
        : { id, enabled: 1, sort_order: 0, duration: 10 };
    })();
  upsertSlideState({
    id,
    enabled: patch.enabled === undefined ? existing.enabled : patch.enabled ? 1 : 0,
    sort_order: patch.sortOrder ?? existing.sort_order,
    duration: patch.duration ?? existing.duration,
  });
}

export function reorderSlides(orderedIds: string[]) {
  orderedIds.forEach((id, i) => updateSlide(id, { sortOrder: i }));
}

export function deleteLocalSlide(name: string): boolean {
  const target = path.join(LOCAL_SLIDES_DIR, name);
  const norm = path.normalize(target);
  if (!norm.startsWith(LOCAL_SLIDES_DIR + path.sep)) return false;
  if (!fs.existsSync(norm)) return false;
  fs.unlinkSync(norm);
  rescanLocal();
  return true;
}

export function listLocalNames(): string[] {
  return [...localFiles];
}

export function dumpStateSnapshot() {
  return { localFiles: [...localFiles], slideStates: allSlideStates() };
}

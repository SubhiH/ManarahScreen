import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import {
  allSlideStates,
  cacheRead,
  cacheWrite,
  getSettings,
  getSlideState,
  upsertSlideState,
} from './db';
import { DuaContent, fetchRandomDua, isDuaCacheFresh } from './dua';
import { fetchSlides } from './masjidal';
import { fetchPublicSlidesFromUrl, PublicApiSlide } from './public-slides';

const ROOT = path.resolve(__dirname, '..');
const LOCAL_SLIDES_DIR = path.join(ROOT, 'slides');
const CACHE_DIR = path.join(ROOT, 'slides-cache');
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4', '.webm']);

if (!fs.existsSync(LOCAL_SLIDES_DIR)) fs.mkdirSync(LOCAL_SLIDES_DIR, { recursive: true });
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

export type UnifiedSlide = {
  id: string;
  source: 'masjidal' | 'custom-api' | 'local' | 'dua';
  name: string;
  url: string;            // served to frontend
  originalUrl?: string;   // upstream source, for debugging
  enabled: boolean;
  sortOrder: number;
  duration: number;       // seconds
  kind: 'image' | 'video' | 'dua';
  dua?: DuaContent;
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

async function downloadCachedAsset(id: string, imageUrl: string, force = false): Promise<string> {
  const safeId = id.replace(/[^a-zA-Z0-9:_-]/g, '_');
  const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
  const localName = `${safeId}${ext}`;
  const localPath = path.join(CACHE_DIR, localName);
  if (!force && fs.existsSync(localPath) && fs.statSync(localPath).size > 0) return localName;
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`download failed ${imageUrl}: ${res.status}`);
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
      const localFile = await downloadCachedAsset(s.id, s.imageUrl);
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

/* ---------- custom public API (cached) ---------- */

const CUSTOM_API_CACHE_KEY = 'slides:custom-api';

type CachedPublicApi = {
  id: string;
  name: string;
  localFile: string;
  originalUrl: string;
  kind: 'image' | 'video';
  defaultDuration: number;
  defaultSortOrder: number;
  upstreamUpdatedAt?: string;
};

function cachedFileExists(localFile: string): boolean {
  const full = path.join(CACHE_DIR, localFile);
  return fs.existsSync(full) && fs.statSync(full).size > 0;
}

function publicApiCacheRow(slide: PublicApiSlide, localFile: string): CachedPublicApi {
  return {
    id: slide.id,
    name: slide.name,
    localFile,
    originalUrl: slide.imageUrl,
    kind: slide.kind,
    defaultDuration: slide.duration,
    defaultSortOrder: slide.sortOrder,
    upstreamUpdatedAt: slide.updatedAt,
  };
}

export async function refreshPublicApiSlides(): Promise<{
  count: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const { customSlidesApiUrl, timezone } = getSettings();
  const { slides: remote } = await fetchPublicSlidesFromUrl(customSlidesApiUrl, timezone);
  const previous = cacheRead<CachedPublicApi[]>(CUSTOM_API_CACHE_KEY)?.value ?? [];
  const previousById = new Map(previous.map((row) => [row.id, row]));
  const cached: CachedPublicApi[] = [];

  for (const slide of remote) {
    const old = previousById.get(slide.id);
    const unchanged =
      !!old &&
      old.originalUrl === slide.imageUrl &&
      old.upstreamUpdatedAt === slide.updatedAt &&
      cachedFileExists(old.localFile);
    try {
      const localFile = unchanged
        ? old.localFile
        : await downloadCachedAsset(slide.id, slide.imageUrl, true);
      cached.push(publicApiCacheRow(slide, localFile));
    } catch (error) {
      errors.push(`${slide.name}: ${error instanceof Error ? error.message : String(error)}`);
      if (old && cachedFileExists(old.localFile)) cached.push(old);
    }
  }

  cacheWrite(CUSTOM_API_CACHE_KEY, cached);
  return { count: cached.length, errors };
}

function publicApiAsSlides(): UnifiedSlide[] {
  const cached = cacheRead<CachedPublicApi[]>(CUSTOM_API_CACHE_KEY)?.value ?? [];
  return cached.map((row) => {
    const state = getSlideState(row.id);
    return {
      id: row.id,
      source: 'custom-api',
      name: row.name,
      url: `/slides-files/cache/${encodeURIComponent(row.localFile)}`,
      originalUrl: row.originalUrl,
      enabled: state ? !!state.enabled : true,
      sortOrder: state ? state.sort_order : row.defaultSortOrder,
      duration: state ? state.duration : row.defaultDuration,
      kind: row.kind,
    };
  });
}

export async function refreshConfiguredSlides(): Promise<{
  count: number;
  errors: string[];
  source: 'masjidal' | 'custom-api' | 'disabled';
}> {
  const { slidesSource } = getSettings();
  if (slidesSource === 'disabled') return { count: 0, errors: [], source: slidesSource };
  const result =
    slidesSource === 'custom-api'
      ? await refreshPublicApiSlides()
      : await refreshMasjidalSlides();
  return { ...result, source: slidesSource };
}

/* ---------- generated Dua slide (cached) ---------- */

const DUA_CACHE_KEY = 'dua:current';
const DUA_SLIDE_ID = 'dua:current';

type CachedDua = {
  dua: DuaContent;
};

export type DuaRefreshResult = {
  status: 'disabled' | 'cached' | 'refreshed';
  cachedAt?: number;
};

export async function refreshDuaSlide(): Promise<DuaRefreshResult> {
  const { duaSlideEnabled, duaCacheDays } = getSettings();
  if (!duaSlideEnabled) return { status: 'disabled' };

  const cached = cacheRead<CachedDua>(DUA_CACHE_KEY);
  if (cached && isDuaCacheFresh(cached.updatedAt, duaCacheDays)) {
    return { status: 'cached', cachedAt: cached.updatedAt };
  }

  const dua = await fetchRandomDua();
  cacheWrite(DUA_CACHE_KEY, { dua });
  return { status: 'refreshed', cachedAt: Date.now() };
}

function duaAsSlides(): UnifiedSlide[] {
  if (!getSettings().duaSlideEnabled) return [];
  const cached = cacheRead<CachedDua>(DUA_CACHE_KEY);
  if (!cached) return [];

  const state = getSlideState(DUA_SLIDE_ID);
  return [
    {
      id: DUA_SLIDE_ID,
      source: 'dua',
      name: `Dua · ${cached.value.dua.title}`,
      url: '',
      enabled: true,
      sortOrder: state ? state.sort_order : 900,
      duration: state ? state.duration : 22,
      kind: 'dua',
      dua: cached.value.dua,
    },
  ];
}

/* ---------- merged ---------- */

export function listSlides(): UnifiedSlide[] {
  const { slidesSource } = getSettings();
  const remote =
    slidesSource === 'custom-api'
      ? publicApiAsSlides()
      : slidesSource === 'masjidal'
        ? masjidalAsSlides()
        : [];
  const all = [...remote, ...duaAsSlides(), ...localAsSlides()];
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

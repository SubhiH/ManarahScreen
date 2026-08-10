import 'dotenv/config';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import {
  cacheRead,
  DhikrPalette,
  DHIKR_PALETTES,
  getSettings,
  PostPrayerDhikr,
  saveSettings,
  SettingsShape,
} from './db';
import {
  adminConfigured,
  changePin,
  clearSession,
  issueSession,
  requireAdmin,
  setInitialPin,
  verifyPin,
} from './auth';
import { fetchIqamaTimingsRaw, fetchPrayerTimesRaw, fetchSlidesRaw, testLogin } from './masjidal';
import { fetchPublicSlidesFromUrl, validatePublicSlidesApiUrl } from './public-slides';
import {
  LOCAL_SLIDES_ROOT,
  SLIDE_CACHE_ROOT,
  deleteLocalSlide,
  listSlides,
  reorderSlides,
  updateSlide,
} from './slides';
import { getLastSync, runSync, scheduleDailySync } from './sync';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const PORT = Number(process.env.PORT ?? 4000);

/* ---------- public API ---------- */

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/settings/public', (_req, res) => {
  const s = getSettings();
  const { masjidalEmail, masjidalPassword, adminPinHash, ...publicBits } = s;
  res.json({
    ...publicBits,
    masjidalConfigured: !!masjidalEmail && !!masjidalPassword,
    liveCameraLabel: process.env.LIVE_CAMERA_LABEL ?? '',
  });
});

// Cosmetic settings writable without PIN (LAN-trusted device).
// Whitelist only visual-layout fields the display lets the user drag/adjust.
app.put('/api/settings/cosmetic', (req, res) => {
  const patch: Partial<SettingsShape> = {};
  const { sidebarPercent, liveMode } = req.body ?? {};
  if (sidebarPercent !== undefined) {
    const n = Number(sidebarPercent);
    if (!Number.isFinite(n) || n < 15 || n > 55) {
      res.status(400).json({ error: 'invalid sidebarPercent (expected 15..55)' });
      return;
    }
    patch.sidebarPercent = Math.round(n);
  }
  if (liveMode !== undefined) {
    patch.liveMode = !!liveMode;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'no writable fields provided' });
    return;
  }
  saveSettings(patch);
  res.json(patch);
});

app.get('/api/prayer-times/today', (_req, res) => {
  if (getSettings().prayerTimesSource === 'disabled') {
    res.status(404).json({ error: 'prayer times are disabled' });
    return;
  }
  const c = cacheRead<{ data: unknown; fetchedAt: number }>('prayer:today');
  if (!c) {
    res.status(404).json({ error: 'no cached prayer times yet — run sync' });
    return;
  }
  res.json({ data: c.value.data, updatedAt: c.value.fetchedAt });
});

app.get('/api/slides', (_req, res) => {
  res.json({ slides: listSlides().filter((s) => s.enabled) });
});

app.get('/slides-files/local/:name', (req, res) => {
  const name = decodeURIComponent(String(req.params.name));
  const full = path.normalize(path.join(LOCAL_SLIDES_ROOT, name));
  if (!full.startsWith(LOCAL_SLIDES_ROOT + path.sep)) {
    res.status(400).end();
    return;
  }
  if (!fs.existsSync(full)) {
    res.status(404).end();
    return;
  }
  res.sendFile(full);
});
app.get('/slides-files/cache/:name', (req, res) => {
  const name = decodeURIComponent(String(req.params.name));
  const full = path.normalize(path.join(SLIDE_CACHE_ROOT, name));
  if (!full.startsWith(SLIDE_CACHE_ROOT + path.sep)) {
    res.status(400).end();
    return;
  }
  if (!fs.existsSync(full)) {
    res.status(404).end();
    return;
  }
  res.sendFile(full);
});

/* ---------- admin auth ---------- */

app.get('/api/admin/status', (_req, res) => {
  res.json({ configured: adminConfigured() });
});

app.post('/api/admin/setup', (req: Request, res: Response) => {
  if (adminConfigured()) {
    res.status(400).json({ error: 'already configured' });
    return;
  }
  const pin = String(req.body?.pin ?? '');
  if (pin.length < 4) {
    res.status(400).json({ error: 'PIN must be at least 4 characters' });
    return;
  }
  setInitialPin(pin);
  issueSession(res);
  res.json({ ok: true });
});

app.post('/api/admin/login', (req: Request, res: Response) => {
  if (!adminConfigured()) {
    res.status(400).json({ error: 'not configured' });
    return;
  }
  const pin = String(req.body?.pin ?? '');
  if (!verifyPin(pin, getSettings().adminPinHash)) {
    res.status(401).json({ error: 'invalid PIN' });
    return;
  }
  issueSession(res);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

app.get('/api/admin/session', requireAdmin, (_req, res) => res.json({ ok: true }));

/* ---------- admin API ---------- */

const MAX_ADHKAR_ITEMS = 20;
const MAX_ADHKAR_FIELD = 2000;

/** Keeps only the known fields, and only entries that actually carry Arabic text. */
function sanitizeAdhkarItems(raw: unknown): PostPrayerDhikr[] {
  if (!Array.isArray(raw)) throw new Error('postPrayerAdhkarItems must be an array');
  if (raw.length > MAX_ADHKAR_ITEMS) {
    throw new Error(`postPrayerAdhkarItems is limited to ${MAX_ADHKAR_ITEMS} entries`);
  }
  const field = (value: unknown, name: string): string => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') throw new Error(`dhikr ${name} must be a string`);
    if (value.length > MAX_ADHKAR_FIELD) {
      throw new Error(`dhikr ${name} is limited to ${MAX_ADHKAR_FIELD} characters`);
    }
    return value.trim();
  };

  const items: PostPrayerDhikr[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('each dhikr must be an object');
    }
    const e = entry as Record<string, unknown>;
    const arabic = field(e.arabic, 'arabic');
    if (!arabic) continue; // blank rows from the editor are dropped, not an error
    if (e.palette !== undefined && !DHIKR_PALETTES.includes(e.palette as DhikrPalette)) {
      throw new Error(`dhikr palette must be one of: ${DHIKR_PALETTES.join(', ')}`);
    }
    items.push({
      arabic,
      transliteration: field(e.transliteration, 'transliteration') || undefined,
      translation: field(e.translation, 'translation') || undefined,
      source: field(e.source, 'source') || undefined,
      palette: e.palette as DhikrPalette | undefined,
    });
  }
  return items;
}

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  const s = getSettings();
  // never send hash
  const { adminPinHash, ...safe } = s;
  res.json({ ...safe, adminConfigured: adminPinHash !== '' });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const body = req.body as Partial<SettingsShape>;
  // Never allow directly writing the PIN hash via this endpoint.
  if ('adminPinHash' in body) delete (body as Record<string, unknown>).adminPinHash;
  if (
    body.prayerTimesSource !== undefined &&
    !['masjidal', 'disabled'].includes(body.prayerTimesSource)
  ) {
    res.status(400).json({ error: 'invalid prayerTimesSource' });
    return;
  }
  if (
    body.slidesSource !== undefined &&
    !['masjidal', 'custom-api', 'disabled'].includes(body.slidesSource)
  ) {
    res.status(400).json({ error: 'invalid slidesSource' });
    return;
  }
  if (body.customSlidesApiUrl !== undefined) {
    if (typeof body.customSlidesApiUrl !== 'string') {
      res.status(400).json({ error: 'customSlidesApiUrl must be a string' });
      return;
    }
    const trimmed = body.customSlidesApiUrl.trim();
    try {
      body.customSlidesApiUrl = trimmed ? validatePublicSlidesApiUrl(trimmed) : '';
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
  }
  if (body.duaSlideEnabled !== undefined && typeof body.duaSlideEnabled !== 'boolean') {
    res.status(400).json({ error: 'duaSlideEnabled must be a boolean' });
    return;
  }
  if (
    body.postPrayerAdhkarEnabled !== undefined &&
    typeof body.postPrayerAdhkarEnabled !== 'boolean'
  ) {
    res.status(400).json({ error: 'postPrayerAdhkarEnabled must be a boolean' });
    return;
  }
  if (body.postPrayerAdhkarMinutes !== undefined) {
    const minutes = Number(body.postPrayerAdhkarMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 30) {
      res.status(400).json({ error: 'postPrayerAdhkarMinutes must be from 1 to 30' });
      return;
    }
    body.postPrayerAdhkarMinutes = Math.round(minutes);
  }
  if (body.postPrayerAdhkarTitle !== undefined) {
    if (typeof body.postPrayerAdhkarTitle !== 'string') {
      res.status(400).json({ error: 'postPrayerAdhkarTitle must be a string' });
      return;
    }
    body.postPrayerAdhkarTitle = body.postPrayerAdhkarTitle.trim().slice(0, 200);
  }
  if (body.postPrayerAdhkarItems !== undefined) {
    try {
      body.postPrayerAdhkarItems = sanitizeAdhkarItems(body.postPrayerAdhkarItems);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
  }
  if (body.duaCacheDays !== undefined) {
    const days = Number(body.duaCacheDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      res.status(400).json({ error: 'duaCacheDays must be an integer from 1 to 365' });
      return;
    }
    body.duaCacheDays = days;
  }
  const next = saveSettings(body);
  scheduleDailySync(); // cron may need to be re-registered if dailySyncTime changed
  const { adminPinHash, ...safe } = next;
  res.json(safe);
});

app.post('/api/admin/change-pin', requireAdmin, (req, res) => {
  const { oldPin, newPin } = req.body ?? {};
  if (typeof newPin !== 'string' || newPin.length < 4) {
    res.status(400).json({ error: 'newPin must be at least 4 characters' });
    return;
  }
  if (!changePin(String(oldPin ?? ''), newPin)) {
    res.status(401).json({ error: 'invalid current PIN' });
    return;
  }
  res.json({ ok: true });
});

app.post('/api/admin/test-login', requireAdmin, async (_req, res) => {
  const result = await testLogin();
  res.json(result);
});

app.post('/api/admin/test-custom-slides-api', requireAdmin, async (req, res) => {
  try {
    const url = String(req.body?.url ?? getSettings().customSlidesApiUrl);
    const result = await fetchPublicSlidesFromUrl(url, getSettings().timezone);
    res.json({
      ok: true,
      totalCount: result.totalCount,
      screenCount: result.slides.length,
    });
  } catch (error) {
    res.json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/api/admin/debug/slides-raw', requireAdmin, async (_req, res) => {
  try {
    const raw = await fetchSlidesRaw();
    res.json({ ok: true, raw });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.get('/api/admin/debug/prayer-raw', requireAdmin, async (_req, res) => {
  try {
    const raw = await fetchPrayerTimesRaw();
    res.json({ ok: true, raw });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.get('/api/admin/debug/iqama-raw', requireAdmin, async (_req, res) => {
  try {
    const ymd = new Date().toLocaleDateString('en-CA', {
      timeZone: getSettings().timezone,
    });
    const raw = await fetchIqamaTimingsRaw(ymd);
    res.json({ ok: true, date: ymd, raw });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.post('/api/admin/sync', requireAdmin, async (_req, res) => {
  const result = await runSync();
  res.json(result);
});

app.get('/api/admin/sync', requireAdmin, (_req, res) => {
  res.json({ last: getLastSync() });
});

app.get('/api/admin/slides', requireAdmin, (_req, res) => {
  res.json({ slides: listSlides() });
});

app.put('/api/admin/slides/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id);
  updateSlide(id, req.body ?? {});
  res.json({ ok: true });
});

app.post('/api/admin/slides/reorder', requireAdmin, (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids)) {
    res.status(400).json({ error: 'ids must be an array' });
    return;
  }
  reorderSlides(ids.map(String));
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, LOCAL_SLIDES_ROOT),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.post('/api/admin/slides/upload', requireAdmin, upload.array('files', 20), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  res.json({ uploaded: files.map((f) => f.filename) });
});

app.delete('/api/admin/slides/local/:name', requireAdmin, (req, res) => {
  const ok = deleteLocalSlide(decodeURIComponent(String(req.params.name)));
  if (!ok) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ ok: true });
});

/* ---------- static web (production) ---------- */

// Try both compiled (dist/server → ../web === dist/web) and source-tree layouts.
// We only attach the static handler when there is a real built bundle, so dev
// mode (running via tsx from source) falls through to Vite on :5173 instead
// of serving raw .tsx files with octet-stream.
const CANDIDATES = [
  path.resolve(__dirname, '../web'),
  path.resolve(__dirname, '../dist/web'),
  path.resolve(process.cwd(), 'dist/web'),
];
const WEB_DIST = CANDIDATES.find(
  (p) => fs.existsSync(path.join(p, 'index.html')) && fs.existsSync(path.join(p, 'assets')),
);

if (WEB_DIST) {
  app.use(express.static(WEB_DIST));
  app.get(/^(?!\/api\/|\/slides-files\/).*/, (_req, res) => {
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
  console.log(`[manarah-screen] serving web bundle from ${WEB_DIST}`);
} else {
  console.log('[manarah-screen] no web bundle found — in dev, open http://localhost:5173/');
}

/* ---------- start ---------- */

app.listen(PORT, () => {
  console.log(`[manarah-screen] listening on http://localhost:${PORT}`);
  scheduleDailySync();
  const settings = getSettings();
  const hasConfiguredSource =
    ((settings.prayerTimesSource === 'masjidal' || settings.slidesSource === 'masjidal') &&
      !!settings.masjidalEmail) ||
    (settings.slidesSource === 'custom-api' && !!settings.customSlidesApiUrl) ||
    settings.duaSlideEnabled;
  if (adminConfigured() && hasConfiguredSource) {
    runSync().catch((e) => console.error('[sync] startup run failed', e));
  }
});

import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import {
  cacheRead,
  getSettings,
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
  res.json({ ...publicBits, masjidalConfigured: !!masjidalEmail && !!masjidalPassword });
});

// Cosmetic settings writable without PIN (LAN-trusted device).
// Whitelist only visual-layout fields the display lets the user drag/adjust.
app.put('/api/settings/cosmetic', (req, res) => {
  const patch: Partial<SettingsShape> = {};
  const { sidebarPercent } = req.body ?? {};
  if (sidebarPercent !== undefined) {
    const n = Number(sidebarPercent);
    if (!Number.isFinite(n) || n < 15 || n > 55) {
      res.status(400).json({ error: 'invalid sidebarPercent (expected 15..55)' });
      return;
    }
    patch.sidebarPercent = Math.round(n);
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'no writable fields provided' });
    return;
  }
  saveSettings(patch);
  res.json(patch);
});

app.get('/api/prayer-times/today', (_req, res) => {
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
  if (adminConfigured() && getSettings().masjidalEmail) {
    runSync().catch((e) => console.error('[sync] startup run failed', e));
  }
});

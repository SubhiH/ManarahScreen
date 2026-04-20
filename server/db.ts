import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cache (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS slide_state (
    id         TEXT PRIMARY KEY,
    enabled    INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    duration   INTEGER NOT NULL DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

export type SettingsShape = {
  masjidalEmail: string;
  masjidalPassword: string;
  masjidId: string;
  timezone: string;
  layout: 'sidebar-right' | 'sidebar-bottom' | 'top-bar';
  theme: 'midnight' | 'forest' | 'royal' | 'navy' | 'graphite' | 'cream' | 'parchment';
  sidebarPercent: number;           // 20..50 for sidebar layouts
  showSunrise: boolean;
  jumuahCount: 1 | 2 | 3;
  adhanCountdownSeconds: number;    // default 60
  dimMinutes: number;               // default 10
  dimOpacity: number;               // 0..1 (default 0.85)
  sunriseCounterMinutes: number;    // default 15
  sunriseCounterLabel: string;      // default "Ishraq in"
  sunriseCounterPosition: 'top-banner' | 'sidebar-inline';
  dailySyncTime: string;            // 'HH:MM', default '03:00'
  adminPinHash: string;             // scrypt hash; empty = unconfigured
  locale: string;                   // 'en' default; for hijri display
  clockSeconds: boolean;            // show seconds
};

export const DEFAULT_SETTINGS: SettingsShape = {
  masjidalEmail: '',
  masjidalPassword: '',
  masjidId: '1501',
  timezone: 'America/New_York',
  layout: 'sidebar-right',
  theme: 'midnight',
  sidebarPercent: 30,
  showSunrise: true,
  jumuahCount: 2,
  adhanCountdownSeconds: 60,
  dimMinutes: 10,
  dimOpacity: 0.85,
  sunriseCounterMinutes: 15,
  sunriseCounterLabel: 'Ishraq in',
  sunriseCounterPosition: 'top-banner',
  dailySyncTime: '03:00',
  adminPinHash: '',
  locale: 'en',
  clockSeconds: true,
};

const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
);

export function getSettings(): SettingsShape {
  const row = getStmt.get('all') as { value: string } | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<SettingsShape>): SettingsShape {
  const next = { ...getSettings(), ...patch };
  setStmt.run('all', JSON.stringify(next));
  return next;
}

const cacheGet = db.prepare('SELECT value, updated_at FROM cache WHERE key = ?');
const cacheSet = db.prepare(
  'INSERT INTO cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
);

export function cacheRead<T>(key: string): { value: T; updatedAt: number } | null {
  const row = cacheGet.get(key) as { value: string; updated_at: number } | undefined;
  if (!row) return null;
  try {
    return { value: JSON.parse(row.value) as T, updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

export function cacheWrite<T>(key: string, value: T) {
  cacheSet.run(key, JSON.stringify(value), Date.now());
}

const slideStateGet = db.prepare('SELECT * FROM slide_state WHERE id = ?');
const slideStateUpsert = db.prepare(
  `INSERT INTO slide_state (id, enabled, sort_order, duration)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     enabled    = excluded.enabled,
     sort_order = excluded.sort_order,
     duration   = excluded.duration`,
);
const slideStateAll = db.prepare('SELECT * FROM slide_state');

export type SlideState = {
  id: string;
  enabled: number;
  sort_order: number;
  duration: number;
};

export function getSlideState(id: string): SlideState | undefined {
  return slideStateGet.get(id) as SlideState | undefined;
}
export function upsertSlideState(s: SlideState) {
  slideStateUpsert.run(s.id, s.enabled, s.sort_order, s.duration);
}
export function allSlideStates(): SlideState[] {
  return slideStateAll.all() as SlideState[];
}

const sessionInsert = db.prepare('INSERT INTO sessions (id, created_at, expires_at) VALUES (?, ?, ?)');
const sessionGet = db.prepare('SELECT expires_at FROM sessions WHERE id = ?');
const sessionDelete = db.prepare('DELETE FROM sessions WHERE id = ?');
const sessionGC = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

export function createSession(id: string, ttlMs: number) {
  const now = Date.now();
  sessionGC.run(now);
  sessionInsert.run(id, now, now + ttlMs);
}
export function isSessionValid(id: string): boolean {
  const row = sessionGet.get(id) as { expires_at: number } | undefined;
  if (!row) return false;
  if (row.expires_at < Date.now()) {
    sessionDelete.run(id);
    return false;
  }
  return true;
}
export function destroySession(id: string) {
  sessionDelete.run(id);
}

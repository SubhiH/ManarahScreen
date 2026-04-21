import { getSettings } from './db';

const API_BASE = 'https://api.prod.portal.masjidal.com';
const UPLOAD_BASE = 'https://uploads.prod.portal.masjidal.com';
const ORIGIN_HEADERS = {
  Origin: 'https://portal.masjidal.com',
  Referer: 'https://portal.masjidal.com/',
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function login(): Promise<string> {
  const { masjidalEmail: email, masjidalPassword: password } = getSettings();
  if (!email || !password) throw new Error('Masjidal credentials not configured');

  const res = await fetch(`${API_BASE}/users/login/v2`, {
    method: 'POST',
    headers: {
      ...ORIGIN_HEADERS,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Masjidal login failed: ${res.status} ${await safeText(res)}`);
  }

  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/auth_token=([^;]+)/);
  if (!match) throw new Error('auth_token not present in Set-Cookie');
  const token = decodeURIComponent(match[1]);
  cachedToken = { token, expiresAt: Date.now() + 1000 * 60 * 60 * 6 }; // 6h optimistic
  return token;
}

async function getToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  return login();
}

async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const doFetch = (t: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...ORIGIN_HEADERS,
        Accept: 'application/json',
        Authorization: `Bearer ${t}`,
        ...(init.headers ?? {}),
      },
    });
  let res = await doFetch(token);
  if (res.status === 401) {
    const fresh = await getToken(true);
    res = await doFetch(fresh);
  }
  return res;
}

async function safeText(r: Response): Promise<string> {
  try {
    return (await r.text()).slice(0, 300);
  } catch {
    return '';
  }
}

export type SalahByDate = Record<string, unknown> & {
  // Shape is generally { adhan: {...}, iqamah: {...}, ...} but we keep it loose.
  adhan?: Record<string, string>;
  iqamah?: Record<string, string>;
};

export async function fetchPrayerTimesRaw(): Promise<unknown> {
  const { masjidId, timezone } = getSettings();
  const qs = new URLSearchParams({ time_zone: timezone });
  const res = await authed(`/salah-timings/get-salah-by-date/${masjidId}/?${qs.toString()}`);
  if (!res.ok) throw new Error(`prayer times fetch failed: ${res.status} ${await safeText(res)}`);
  return res.json();
}

export async function fetchIqamaTimingsRaw(dateYmd: string): Promise<unknown> {
  const { masjidId } = getSettings();
  const res = await authed(`/iqama-timings/get-current-timings/${masjidId}/${dateYmd}`);
  if (!res.ok) throw new Error(`iqama fetch failed: ${res.status} ${await safeText(res)}`);
  return res.json();
}

function todayYmdInTz(tz: string): string {
  // 'en-CA' locale produces YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

function addMinutesToHHmm(hm: string, offset: number): string {
  const m = hm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hm;
  const total = Number(m[1]) * 60 + Number(m[2]) + offset;
  const normalized = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

/** Masjidal iqama values: setting=1 → fixed "HH:mm[:ss]"; setting=0 → minutes-after-adhan. */
function resolveIqama(setting: unknown, value: unknown, adhanHm?: string): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  if (!s || s === '-') return undefined;
  const settingNum = Number(setting);
  if (settingNum === 1) {
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
  }
  if (settingNum === 0) {
    const offset = Number(s);
    if (!adhanHm || !Number.isFinite(offset)) return undefined;
    return addMinutesToHHmm(adhanHm, offset);
  }
  return undefined;
}

function unixToHHmmInTz(ts: number, _tz: string): string {
  // Masjidal encodes the LOCAL time-of-day as if it were UTC (server-side bug).
  // E.g. 5:55 AM Boston sunrise comes back as ts=2026-04-21T05:55:00Z, not 09:55Z.
  // Reading the timestamp's UTC HH:mm therefore yields the correct local clock value.
  return new Date(ts * 1000).toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toHHmm(v: unknown, tz: string): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return unixToHHmmInTz(v, tz);
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  // "04:35 AM" / "7:29 PM"
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const mm = ampm[2];
    const period = ampm[3].toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${mm}`;
  }
  // already 24h "HH:mm" (possibly with seconds)
  const h24 = s.match(/^(\d{1,2}):(\d{2})/);
  if (h24) return `${h24[1].padStart(2, '0')}:${h24[2]}`;
  return undefined;
}

export async function fetchPrayerTimesForToday(): Promise<SalahByDate> {
  const { timezone } = getSettings();
  const raw = (await fetchPrayerTimesRaw()) as Record<string, unknown>;
  // Walk candidate containers to find the object that holds mst_* keys.
  const candidates: unknown[] = [
    raw,
    (raw as { data?: unknown }).data,
    (raw as { response?: unknown }).response,
  ];
  let row: Record<string, unknown> | null = null;
  for (const c of candidates) {
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      const rec = c as Record<string, unknown>;
      if (Object.keys(rec).some((k) => k.startsWith('mst_'))) {
        row = rec;
        break;
      }
    }
  }
  if (!row) {
    const top = Object.keys(raw);
    console.warn('[masjidal] prayer-times: no mst_* keys found. Top-level:', top);
    throw new Error('prayer times: unexpected shape');
  }
  console.log('[masjidal] prayer-times keys:', Object.keys(row));

  // Adhan times — note zuhr -> dhuhr mapping.
  const adhan: Record<string, string> = {};
  const addA = (key: string, v: unknown) => {
    const hm = toHHmm(v, timezone);
    if (hm) adhan[key] = hm;
  };
  addA('fajr', row.mst_fajr);
  addA('sunrise', row.mst_sunrise);
  addA('dhuhr', row.mst_zuhr ?? row.mst_dhuhr);
  addA('asr', row.mst_asr);
  addA('maghrib', row.mst_maghrib);
  addA('isha', row.mst_isha);

  // Iqamah comes from a separate endpoint, /iqama-timings/get-current-timings.
  const iqamah: Record<string, string> = {};
  try {
    const ymd = todayYmdInTz(timezone);
    const iqRaw = (await fetchIqamaTimingsRaw(ymd)) as {
      status?: boolean;
      response?: Record<string, unknown>;
    };
    const r = iqRaw?.response ?? {};
    const set = (key: string, sKey: string, vKey: string, adhanKey?: string) => {
      const hm = resolveIqama(r[sKey], r[vKey], adhanKey ? adhan[adhanKey] : undefined);
      if (hm) iqamah[key] = hm;
    };
    set('fajr', 'mit_fajr_setting', 'mit_fajr_value', 'fajr');
    set('dhuhr', 'mit_zuhr_setting', 'mit_zuhr_value', 'dhuhr');
    set('asr', 'mit_asr_setting', 'mit_asr_value', 'asr');
    set('maghrib', 'mit_maghrib_setting', 'mit_maghrib_value', 'maghrib');
    set('isha', 'mit_isha_setting', 'mit_isha_value', 'isha');
    set('jummah1', 'mit_jummah1_setting', 'mit_jummah1_value');
    set('jummah2', 'mit_jummah2_setting', 'mit_jummah2_value');
    set('jummah3', 'mit_jummah3_setting', 'mit_jummah3_value');
    console.log('[masjidal] iqama resolved for', ymd, ':', iqamah);
  } catch (e) {
    console.warn('[masjidal] iqama fetch failed:', e instanceof Error ? e.message : e);
  }

  return {
    adhan,
    iqamah,
    meta: { date: row.mst_date, m_id: row.m_id },
  } as SalahByDate;
}

export type MasjidalSlide = {
  id: string;
  source: 'masjidal';
  name: string;
  imageUrl: string;
  rawPath: string;
  status: number;
  kind: 'image' | 'video';
  duration: number;       // seconds, from Masjidal si_duration
  sortOrder: number;      // from Masjidal si_sort_order
  startDate?: string;     // si_start_date
  endDate?: string;       // si_end_date
  createdAt?: string;
};

export async function fetchSlidesRaw(): Promise<unknown> {
  const { masjidId } = getSettings();
  const qs = new URLSearchParams({
    library_type: '',
    skip: '0',
    page_size: '50',
    name: '',
    status: '1',
    display: '',
    zones: '',
  });
  const res = await authed(`/libraries/getAll/${masjidId}?${qs.toString()}`);
  if (!res.ok) throw new Error(`slides fetch failed: ${res.status} ${await safeText(res)}`);
  return res.json();
}

type MasjidalRawRow = {
  si_id: number;
  si_name?: string;
  si_img_name?: string;
  si_url?: string;
  si_type?: string;            // 'image' | 'video'
  si_status?: number;
  si_duration?: number;        // seconds
  si_sort_order?: number;
  si_start_date?: string;      // 'YYYY-MM-DD' or empty
  si_end_date?: string;
  si_created_at?: number;      // unix seconds
};

/** Is the slide active today according to si_start_date/si_end_date? */
function isActiveToday(row: MasjidalRawRow, today = new Date()): boolean {
  const ymd = today.toISOString().slice(0, 10);
  if (row.si_start_date && ymd < row.si_start_date) return false;
  if (row.si_end_date && ymd > row.si_end_date) return false;
  return (row.si_status ?? 1) === 1;
}

export async function fetchSlides(): Promise<MasjidalSlide[]> {
  const payload = (await fetchSlidesRaw()) as {
    status?: boolean;
    response?: { total_count?: number; list?: MasjidalRawRow[] };
  };
  const list = payload?.response?.list ?? [];
  console.log(`[masjidal] library returned ${list.length} rows (total_count=${payload?.response?.total_count ?? '?'})`);
  const slides: MasjidalSlide[] = [];
  for (const row of list) {
    if (!row || typeof row.si_id !== 'number') continue;
    if (!isActiveToday(row)) continue;

    // Prefer uploaded image path; fall back to external URL.
    const rawPath = row.si_img_name?.trim() || row.si_url?.trim() || '';
    if (!rawPath) continue;
    const imageUrl = rawPath.startsWith('http')
      ? rawPath
      : `${UPLOAD_BASE}/${rawPath.replace(/^\/+/, '')}`;

    const kind: 'image' | 'video' =
      (row.si_type ?? '').toLowerCase() === 'video' ? 'video' : 'image';

    slides.push({
      id: `masjidal:${row.si_id}`,
      source: 'masjidal',
      name: row.si_name?.trim() || `Slide ${row.si_id}`,
      imageUrl,
      rawPath,
      status: row.si_status ?? 1,
      kind,
      duration: Math.max(3, Number(row.si_duration) || 10),
      sortOrder: Number(row.si_sort_order) || 0,
      startDate: row.si_start_date || undefined,
      endDate: row.si_end_date || undefined,
      createdAt:
        typeof row.si_created_at === 'number'
          ? new Date(row.si_created_at * 1000).toISOString()
          : undefined,
    });
  }
  // Masjidal sort order matches what the portal uses.
  slides.sort((a, b) => a.sortOrder - b.sortOrder);
  console.log(`[masjidal] ${slides.length} slides active today after date filter`);
  return slides;
}

export async function testLogin(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await login();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function uploadBaseUrl() {
  return UPLOAD_BASE;
}

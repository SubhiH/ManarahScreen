export type PublicApiSlide = {
  id: string;
  source: 'custom-api';
  name: string;
  imageUrl: string;
  kind: 'image' | 'video';
  duration: number;
  sortOrder: number;
  startDate?: string;
  endDate?: string;
  updatedAt?: string;
};

type PublicSlideRow = {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  kind?: unknown;
  duration?: unknown;
  sortOrder?: unknown;
  enabled?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  updatedAt?: unknown;
  display?: unknown;
  displayTargets?: unknown;
};

type PublicSlidesPayload = {
  updatedAt?: unknown;
  slides?: unknown;
};

export type PublicSlidesFetchResult = {
  slides: PublicApiSlide[];
  totalCount: number;
};

export function validatePublicSlidesApiUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Custom slides API URL is not configured');
  if (trimmed.length > 2_048) throw new Error('Custom slides API URL is too long');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Custom slides API URL is invalid');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Custom slides API URL must use HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Custom slides API URL cannot contain credentials');
  }
  return url.toString();
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function hasScreenTarget(row: PublicSlideRow): boolean {
  if (Array.isArray(row.displayTargets)) {
    return row.displayTargets.some(
      (target) => typeof target === 'string' && target.trim().toLowerCase() === 'screen',
    );
  }
  return String(row.display ?? '')
    .split(',')
    .some((target) => target.trim().toLowerCase() === 'screen');
}

function todayYmdInTz(timezone: string, now: Date): string {
  return now.toLocaleDateString('en-CA', { timeZone: timezone });
}

function isActiveToday(row: PublicSlideRow, timezone: string, now: Date): boolean {
  if (row.enabled === false) return false;
  const today = todayYmdInTz(timezone, now);
  const startDate = stringValue(row.startDate);
  const endDate = stringValue(row.endDate);
  if (startDate && today < startDate) return false;
  if (endDate && today > endDate) return false;
  return true;
}

function mediaUrl(value: unknown, apiUrl: string): string | undefined {
  const raw = stringValue(value);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw, apiUrl);
    return parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function parsePublicSlidesPayload(
  raw: unknown,
  apiUrl: string,
  timezone: string,
  now = new Date(),
): PublicSlidesFetchResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Custom slides API returned an invalid response');
  }
  const payload = raw as PublicSlidesPayload;
  if (!Array.isArray(payload.slides)) {
    throw new Error('Custom slides API response must contain a slides array');
  }

  const feedUpdatedAt = stringValue(payload.updatedAt);
  const slides: PublicApiSlide[] = [];
  payload.slides.forEach((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const row = value as PublicSlideRow;
    const rawId =
      typeof row.id === 'number' || typeof row.id === 'string' ? String(row.id).trim() : '';
    const kind = stringValue(row.kind)?.toLowerCase();
    const url = mediaUrl(row.url, apiUrl);
    if (!rawId || (kind !== 'image' && kind !== 'video') || !url) return;
    if (!hasScreenTarget(row) || !isActiveToday(row, timezone, now)) return;

    const rawDuration = Number(row.duration);
    const rawSortOrder = Number(row.sortOrder);
    slides.push({
      id: `custom-api:${rawId}`,
      source: 'custom-api',
      name: stringValue(row.name) ?? `Slide ${rawId}`,
      imageUrl: url,
      kind,
      duration: Math.max(3, Number.isFinite(rawDuration) ? rawDuration : 10),
      sortOrder: Number.isFinite(rawSortOrder) ? rawSortOrder : index,
      startDate: stringValue(row.startDate),
      endDate: stringValue(row.endDate),
      updatedAt: stringValue(row.updatedAt) ?? feedUpdatedAt,
    });
  });

  slides.sort((a, b) => a.sortOrder - b.sortOrder);
  return { slides, totalCount: payload.slides.length };
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return '';
  }
}

export async function fetchPublicSlidesFromUrl(
  urlValue: string,
  timezone: string,
): Promise<PublicSlidesFetchResult> {
  const url = validatePublicSlidesApiUrl(urlValue);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Custom slides API request failed: ${response.status} ${await safeText(response)}`,
      );
    }
    const raw = (await response.json()) as unknown;
    return parsePublicSlidesPayload(raw, url, timezone);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Custom slides API request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

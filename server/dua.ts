const UMMAH_API_RANDOM_DUA_URL = 'https://ummahapi.com/api/duas/random';

export type DuaContent = {
  id: string;
  title: string;
  arabic: string;
  transliteration?: string;
  translation: string;
  source?: string;
  category?: string;
  repeat?: number;
};

type UmmahApiDuaPayload = {
  success?: unknown;
  data?: unknown;
};

type UmmahApiDuaData = {
  id?: unknown;
  title?: unknown;
  arabic?: unknown;
  transliteration?: unknown;
  translation?: unknown;
  source?: unknown;
  category?: unknown;
  repeat?: unknown;
  category_info?: unknown;
};

function textValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function parseUmmahApiDua(raw: unknown): DuaContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('UmmahAPI returned an invalid response');
  }
  const payload = raw as UmmahApiDuaPayload;
  if (payload.success === false || !payload.data || typeof payload.data !== 'object') {
    throw new Error('UmmahAPI response does not contain a dua');
  }

  const data = payload.data as UmmahApiDuaData;
  const title = textValue(data.title);
  const arabic = textValue(data.arabic);
  const translation = textValue(data.translation);
  if (!title || !arabic || !translation) {
    throw new Error('UmmahAPI dua is missing title, Arabic, or translation text');
  }

  const categoryInfo =
    data.category_info && typeof data.category_info === 'object'
      ? (data.category_info as { name?: unknown })
      : undefined;
  const repeat = Number(data.repeat);

  return {
    id:
      typeof data.id === 'string' || typeof data.id === 'number'
        ? String(data.id)
        : `${title}:${arabic.slice(0, 24)}`,
    title,
    arabic,
    transliteration: textValue(data.transliteration),
    translation,
    source: textValue(data.source),
    category: textValue(categoryInfo?.name) ?? textValue(data.category),
    repeat: Number.isFinite(repeat) && repeat > 0 ? Math.round(repeat) : undefined,
  };
}

export function isDuaCacheFresh(
  cachedAt: number,
  cacheDays: number,
  now = Date.now(),
): boolean {
  const ttlMs = Math.max(1, cacheDays) * 24 * 60 * 60 * 1000;
  return now - cachedAt < ttlMs;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return '';
  }
}

export async function fetchRandomDua(): Promise<DuaContent> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(UMMAH_API_RANDOM_DUA_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`UmmahAPI request failed: ${response.status} ${await safeText(response)}`);
    }
    return parseUmmahApiDua((await response.json()) as unknown);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('UmmahAPI request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

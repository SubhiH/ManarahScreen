import type { PublicSettings, TodayPrayerPayload, UnifiedSlide } from './types';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  publicSettings: () => j<PublicSettings>('/api/settings/public'),
  cosmeticSettings: (patch: { sidebarPercent?: number }) =>
    j<{ sidebarPercent?: number }>('/api/settings/cosmetic', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  prayerTimes: () => j<TodayPrayerPayload>('/api/prayer-times/today'),
  slides: () => j<{ slides: UnifiedSlide[] }>('/api/slides'),

  // admin
  adminStatus: () => j<{ configured: boolean }>('/api/admin/status'),
  adminSetup: (pin: string) =>
    j<{ ok: true }>('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    }),
  adminLogin: (pin: string) =>
    j<{ ok: true }>('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    }),
  adminSession: () => j<{ ok: true }>('/api/admin/session'),
  adminLogout: () => j<{ ok: true }>('/api/admin/logout', { method: 'POST' }),

  adminGetSettings: () =>
    j<
      Omit<PublicSettings, 'masjidalConfigured'> & {
        masjidalEmail: string;
        masjidalPassword: string;
        adminConfigured: boolean;
      }
    >('/api/admin/settings'),
  adminPutSettings: (patch: Record<string, unknown>) =>
    j<Record<string, unknown>>('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  adminChangePin: (oldPin: string, newPin: string) =>
    j<{ ok: true }>('/api/admin/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPin, newPin }),
    }),
  adminTestLogin: () =>
    j<{ ok: boolean; error?: string }>('/api/admin/test-login', { method: 'POST' }),
  adminSyncNow: () =>
    j<{
      ok: boolean;
      at: number;
      prayerTimes: string;
      slides: string;
      slideCount?: number;
      slideErrors?: string[];
    }>('/api/admin/sync', { method: 'POST' }),
  adminLastSync: () =>
    j<{ last: { ok: boolean; at: number; prayerTimes: string; slides: string } | null }>(
      '/api/admin/sync',
    ),
  adminSlides: () => j<{ slides: UnifiedSlide[] }>('/api/admin/slides'),
  adminUpdateSlide: (
    id: string,
    patch: Partial<Pick<UnifiedSlide, 'enabled' | 'sortOrder' | 'duration'>>,
  ) =>
    j<{ ok: true }>(`/api/admin/slides/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  adminReorderSlides: (ids: string[]) =>
    j<{ ok: true }>('/api/admin/slides/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }),
  adminUploadSlides: async (files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    const res = await fetch('/api/admin/slides/upload', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    return res.json() as Promise<{ uploaded: string[] }>;
  },
  adminDeleteLocalSlide: (name: string) =>
    j<{ ok: true }>(`/api/admin/slides/local/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),
};

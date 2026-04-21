import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { UnifiedSlide } from '@/lib/types';

export default function Admin() {
  const statusQ = useQuery({ queryKey: ['admin-status'], queryFn: () => api.adminStatus() });
  const sessionQ = useQuery({
    queryKey: ['admin-session'],
    queryFn: () => api.adminSession().then(() => true).catch(() => false),
    retry: false,
  });

  if (statusQ.isLoading || sessionQ.isLoading) {
    return <FullScreenCenter>Loading…</FullScreenCenter>;
  }

  if (!statusQ.data?.configured) return <SetupPin />;
  if (!sessionQ.data) return <LoginPin />;
  return <AdminPanel />;
}

/* ---------- gates ---------- */

function FullScreenCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8 text-theme-text">
      {children}
    </div>
  );
}

function PinBox(props: { onSubmit: (pin: string) => void; title: string; cta: string; error?: string }) {
  const [pin, setPin] = useState('');
  return (
    <FullScreenCenter>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit(pin);
        }}
        className="flex w-[min(380px,92vw)] flex-col gap-4 rounded-2xl border border-theme-border/10 bg-theme-surface/80 p-8 shadow-2xl backdrop-blur"
      >
        <div className="text-xl font-bold text-theme-accent">{props.title}</div>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          className="rounded-lg border border-theme-border/10 bg-theme-bg px-4 py-3 text-lg tabular-nums text-theme-text focus:border-theme-accent focus:outline-none"
        />
        {props.error && <div className="text-sm text-red-400">{props.error}</div>}
        <button
          type="submit"
          className="rounded-lg bg-theme-accent px-4 py-2 font-semibold text-theme-accent-contrast hover:brightness-110"
        >
          {props.cta}
        </button>
      </form>
    </FullScreenCenter>
  );
}

function SetupPin() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string>();
  const m = useMutation({
    mutationFn: (pin: string) => api.adminSetup(pin),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-status'] });
      qc.invalidateQueries({ queryKey: ['admin-session'] });
    },
    onError: (e: Error) => setErr(e.message),
  });
  return (
    <PinBox
      title="Set an admin PIN"
      cta="Create PIN"
      error={err}
      onSubmit={(pin) => {
        setErr(undefined);
        if (pin.length < 4) {
          setErr('PIN must be at least 4 characters');
          return;
        }
        m.mutate(pin);
      }}
    />
  );
}

function LoginPin() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string>();
  const m = useMutation({
    mutationFn: (pin: string) => api.adminLogin(pin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-session'] }),
    onError: (e: Error) => setErr(e.message || 'Invalid PIN'),
  });
  return (
    <PinBox
      title="Enter admin PIN"
      cta="Unlock"
      error={err}
      onSubmit={(pin) => {
        setErr(undefined);
        m.mutate(pin);
      }}
    />
  );
}

/* ---------- main panel ---------- */

type Tab = 'masjidal' | 'layout' | 'prayer' | 'slides' | 'sync' | 'security';
const TABS: { key: Tab; label: string }[] = [
  { key: 'masjidal', label: 'Masjidal' },
  { key: 'layout', label: 'Layout' },
  { key: 'prayer', label: 'Prayer Display' },
  { key: 'slides', label: 'Slides' },
  { key: 'sync', label: 'Sync' },
  { key: 'security', label: 'Security' },
];

function AdminPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('masjidal');
  const settingsQ = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.adminGetSettings(),
  });

  const saveM = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.adminPutSettings(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      qc.invalidateQueries({ queryKey: ['public-settings'] });
    },
  });

  const logout = useMutation({
    mutationFn: () => api.adminLogout(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-session'] }),
  });

  if (!settingsQ.data) return <FullScreenCenter>Loading…</FullScreenCenter>;
  const s = settingsQ.data;
  const save = (patch: Record<string, unknown>) => saveM.mutate(patch);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-theme-border/10 bg-theme-bg px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-theme-accent">ManarahScreen Admin</span>
          <a href="/" className="text-sm text-theme-text-dim hover:text-theme-text">
            ← Display
          </a>
        </div>
        <button
          onClick={() => logout.mutate()}
          className="rounded-md border border-theme-border/10 px-3 py-1 text-sm text-theme-text-dim hover:bg-theme-border/5"
        >
          Log out
        </button>
      </header>

      <nav className="flex gap-1 border-b border-theme-border/10 bg-theme-surface px-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors',
              tab === t.key ? 'text-theme-accent' : 'text-theme-text-dim hover:text-theme-text',
            )}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-theme-accent" />
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto bg-theme-bg p-6">
        {tab === 'masjidal' && <MasjidalTab s={s} save={save} />}
        {tab === 'layout' && <LayoutTab s={s} save={save} />}
        {tab === 'prayer' && <PrayerTab s={s} save={save} />}
        {tab === 'slides' && <SlidesTab />}
        {tab === 'sync' && <SyncTab s={s} save={save} />}
        {tab === 'security' && <SecurityTab />}
      </main>
    </div>
  );
}

/* ---------- helpers ---------- */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-xl border border-theme-border/10 bg-theme-surface/60 p-5">
      <h2 className="mb-4 text-base font-semibold text-theme-accent">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-theme-text-dim">{label}</span>
      {children}
      {hint && <span className="text-xs text-theme-text-dim/70">{hint}</span>}
    </label>
  );
}

const inputCls =
  'rounded-md border border-theme-border/10 bg-theme-bg px-3 py-2 text-theme-text focus:border-theme-accent focus:outline-none';

type SettingsState = Awaited<ReturnType<typeof api.adminGetSettings>>;
type SaveFn = (patch: Record<string, unknown>) => void;

/* ---------- tabs ---------- */

function MasjidalTab({ s, save }: { s: SettingsState; save: SaveFn }) {
  const [email, setEmail] = useState(s.masjidalEmail);
  const [password, setPassword] = useState(s.masjidalPassword);
  const [masjidId, setMasjidId] = useState(s.masjidId);
  const [tz, setTz] = useState(s.timezone);
  const [testResult, setTestResult] = useState<string>();
  const testM = useMutation({
    mutationFn: () => api.adminTestLogin(),
    onSuccess: (r) => setTestResult(r.ok ? '✓ Login successful' : `✗ ${r.error}`),
  });

  return (
    <>
      <Card title="Masjidal portal credentials">
        <Field label="Email">
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input
            className={inputCls}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Masjid ID" hint="Your masjid's numeric ID in the Masjidal portal.">
          <input
            className={inputCls}
            value={masjidId}
            onChange={(e) => setMasjidId(e.target.value)}
          />
        </Field>
        <Field label="Timezone" hint="IANA tz, e.g. America/New_York">
          <input className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              save({
                masjidalEmail: email,
                masjidalPassword: password,
                masjidId,
                timezone: tz,
              })
            }
            className="rounded-md bg-theme-accent px-4 py-2 font-semibold text-theme-accent-contrast hover:brightness-110"
          >
            Save
          </button>
          <button
            onClick={() => testM.mutate()}
            className="rounded-md border border-theme-border/10 px-4 py-2 text-theme-text/90 hover:bg-theme-border/5"
            disabled={testM.isPending}
          >
            {testM.isPending ? 'Testing…' : 'Test login'}
          </button>
          {testResult && (
            <span
              className={cn(
                'text-sm',
                testResult.startsWith('✓') ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {testResult}
            </span>
          )}
        </div>
      </Card>
    </>
  );
}

function LayoutTab({ s, save }: { s: SettingsState; save: SaveFn }) {
  return (
    <Card title="Display layout">
      <Field label="Layout style">
        <div className="flex flex-wrap gap-2">
          {(['sidebar-right', 'sidebar-bottom', 'top-bar'] as const).map((k) => (
            <button
              key={k}
              onClick={() => save({ layout: k })}
              className={cn(
                'rounded-md border px-4 py-2 text-sm',
                s.layout === k
                  ? 'border-theme-accent bg-theme-accent/10 text-theme-accent'
                  : 'border-theme-border/10 text-theme-text/90 hover:bg-theme-border/5',
              )}
            >
              {k === 'sidebar-right' && 'Sidebar (right)'}
              {k === 'sidebar-bottom' && 'Sidebar (bottom)'}
              {k === 'top-bar' && 'Top bar'}
            </button>
          ))}
        </div>
      </Field>
      <Field
        label={`Sidebar size: ${s.sidebarPercent}%`}
        hint="Applies to sidebar layouts (right / bottom)."
      >
        <input
          type="range"
          min={18}
          max={45}
          value={s.sidebarPercent}
          onChange={(e) => save({ sidebarPercent: Number(e.target.value) })}
        />
      </Field>
      <Field label="Clock shows seconds">
        <Toggle
          value={s.clockSeconds}
          onChange={(v) => save({ clockSeconds: v })}
        />
      </Field>
      <Field label="Color theme" hint="Applies to the whole app (display + admin).">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { k: 'midnight', label: 'Midnight Gold', sub: 'dark' },
              { k: 'forest', label: 'Forest Emerald', sub: 'dark' },
              { k: 'royal', label: 'Royal Plum', sub: 'dark' },
              { k: 'navy', label: 'Deep Navy', sub: 'dark' },
              { k: 'graphite', label: 'Graphite', sub: 'dark' },
              { k: 'cream', label: 'Masjid Cream', sub: 'bright' },
              { k: 'parchment', label: 'Parchment Rose', sub: 'bright' },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => save({ theme: t.k })}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-md border px-4 py-2 text-sm transition-colors',
                s.theme === t.k
                  ? 'border-theme-accent bg-theme-accent/10 text-theme-accent'
                  : 'border-theme-border/10 text-theme-text/90 hover:bg-theme-border/5',
              )}
            >
              <span className="font-semibold">{t.label}</span>
              <span className="text-xs opacity-60">{t.sub}</span>
            </button>
          ))}
        </div>
      </Field>
    </Card>
  );
}

function PrayerTab({ s, save }: { s: SettingsState; save: SaveFn }) {
  return (
    <>
      <Card title="Prayer table">
        <Field label="Show Sunrise row">
          <Toggle value={s.showSunrise} onChange={(v) => save({ showSunrise: v })} />
        </Field>
        <Field label="Jumu'ah count">
          <select
            className={inputCls}
            value={s.jumuahCount}
            onChange={(e) => save({ jumuahCount: Number(e.target.value) })}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </Field>
      </Card>

      <Card title="Adhan countdown overlay">
        <Field
          label={`Show overlay when next Adhan is ≤ ${s.adhanCountdownSeconds}s away`}
          hint="Full-screen overlay. Default 60 seconds."
        >
          <input
            type="range"
            min={15}
            max={600}
            step={15}
            value={s.adhanCountdownSeconds}
            onChange={(e) => save({ adhanCountdownSeconds: Number(e.target.value) })}
          />
        </Field>
        <PreviewButton mode="countdown" label="Preview countdown overlay" />
      </Card>

      <Card title="Time for Duha (post-Sunrise) counter">
        <Field
          label={`Duration: ${s.sunriseCounterMinutes} minutes`}
          hint="Card with circular progress shown after Sunrise. Also drives the Duha time on the prayer table."
        >
          <input
            type="range"
            min={5}
            max={45}
            step={1}
            value={s.sunriseCounterMinutes}
            onChange={(e) => save({ sunriseCounterMinutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Label text">
          <input
            className={inputCls}
            value={s.sunriseCounterLabel}
            onChange={(e) => save({ sunriseCounterLabel: e.target.value })}
          />
        </Field>
        <Field label="Position">
          <select
            className={inputCls}
            value={s.sunriseCounterPosition}
            onChange={(e) => save({ sunriseCounterPosition: e.target.value })}
          >
            <option value="slide-area">Slide area (large takeover)</option>
            <option value="top-banner">Top banner (over slides)</option>
            <option value="sidebar-inline">Sidebar inline</option>
          </select>
        </Field>
        <PreviewButton
          mode="sunrise"
          label="Preview Duha countdown"
          hint="Capped to 60s for preview."
        />
      </Card>

      <Card title="Sidebar-right font sizes">
        <div className="text-xs text-theme-text-dim/70">
          Multiplier on the baseline size for each block in the right sidebar. 1.00 is the
          built-in default; lower for cramped screens, higher for big monitors.
        </div>
        <FontScaleSlider
          label="Prayer + Iqama"
          value={s.fontScalePrayer}
          onChange={(v) => save({ fontScalePrayer: v })}
        />
        <FontScaleSlider
          label="Main clock"
          value={s.fontScaleClock}
          onChange={(v) => save({ fontScaleClock: v })}
        />
        <FontScaleSlider
          label="Jumu'ah"
          value={s.fontScaleJumuah}
          onChange={(v) => save({ fontScaleJumuah: v })}
        />
        <FontScaleSlider
          label="Time for next prayer"
          value={s.fontScaleNextPrayer}
          onChange={(v) => save({ fontScaleNextPrayer: v })}
        />
      </Card>

      <Card title="Dim after Iqama">
        <Field
          label={`Dim duration: ${s.dimMinutes} min`}
          hint="Keeps slides dark for this many minutes after each Iqama; prayer sidebar stays visible."
        >
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={s.dimMinutes}
            onChange={(e) => save({ dimMinutes: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Dim opacity: ${Math.round(s.dimOpacity * 100)}%`}>
          <input
            type="range"
            min={0.5}
            max={0.98}
            step={0.02}
            value={s.dimOpacity}
            onChange={(e) => save({ dimOpacity: Number(e.target.value) })}
          />
        </Field>
        <PreviewButton mode="dim" label="Preview dim overlay" hint="30s preview." />
      </Card>
    </>
  );
}

function PreviewButton({
  mode,
  label,
  hint,
}: {
  mode: 'countdown' | 'sunrise' | 'dim';
  label: string;
  hint?: string;
}) {
  const open = () => window.open(`/?test=${mode}`, '_blank', 'noopener');
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={open}
        className="rounded-md border border-theme-accent/40 bg-theme-accent/10 px-3 py-1.5 text-sm font-medium text-theme-accent hover:bg-theme-accent/20"
      >
        {label} ↗
      </button>
      {hint && <span className="text-xs text-theme-text-dim">{hint}</span>}
    </div>
  );
}

function SyncTab({ s, save }: { s: SettingsState; save: SaveFn }) {
  const [lastMsg, setLastMsg] = useState<string>();
  const lastQ = useQuery({
    queryKey: ['admin-last-sync'],
    queryFn: () => api.adminLastSync(),
    refetchInterval: 30_000,
  });
  const syncM = useMutation({
    mutationFn: () => api.adminSyncNow(),
    onSuccess: (r) => {
      setLastMsg(
        r.ok
          ? `Synced ${r.slideCount ?? 0} slides at ${new Date(r.at).toLocaleString()}`
          : `Sync had errors — prayer: ${r.prayerTimes}, slides: ${r.slides}`,
      );
      lastQ.refetch();
    },
  });

  return (
    <>
      <Card title="Daily sync">
        <Field label="Time of day (HH:MM, 24h)" hint="Runs once per day in server time.">
          <input
            className={inputCls}
            value={s.dailySyncTime}
            onChange={(e) => save({ dailySyncTime: e.target.value })}
          />
        </Field>
        <div className="flex items-center gap-3">
          <button
            onClick={() => syncM.mutate()}
            disabled={syncM.isPending}
            className="rounded-md bg-theme-accent px-4 py-2 font-semibold text-theme-accent-contrast hover:brightness-110 disabled:opacity-50"
          >
            {syncM.isPending ? 'Syncing…' : 'Sync now'}
          </button>
          {lastMsg && <span className="text-sm text-theme-text-dim">{lastMsg}</span>}
        </div>
        {lastQ.data?.last && (
          <div className="rounded-md border border-theme-border/10 bg-theme-bg/50 p-3 text-sm text-theme-text-dim">
            <div>Last run: {new Date(lastQ.data.last.at).toLocaleString()}</div>
            <div>Prayer times: {lastQ.data.last.prayerTimes}</div>
            <div>Slides: {lastQ.data.last.slides}</div>
          </div>
        )}
      </Card>
    </>
  );
}

function SlidesTab() {
  const qc = useQueryClient();
  const slidesQ = useQuery({
    queryKey: ['admin-slides'],
    queryFn: () => api.adminSlides(),
    refetchInterval: 15_000,
  });
  const toggleM = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.adminUpdateSlide(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-slides'] }),
  });
  const durM = useMutation({
    mutationFn: ({ id, duration }: { id: string; duration: number }) =>
      api.adminUpdateSlide(id, { duration }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-slides'] }),
  });
  const reorderM = useMutation({
    mutationFn: (ids: string[]) => api.adminReorderSlides(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-slides'] }),
  });
  const uploadM = useMutation({
    mutationFn: (files: File[]) => api.adminUploadSlides(files),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-slides'] }),
  });
  const deleteM = useMutation({
    mutationFn: (name: string) => api.adminDeleteLocalSlide(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-slides'] }),
  });

  const slides = slidesQ.data?.slides ?? [];

  const move = (i: number, dir: -1 | 1) => {
    const arr = [...slides];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    reorderM.mutate(arr.map((x) => x.id));
  };

  return (
    <>
      <Card title="Upload local slides">
        <input
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) uploadM.mutate(files);
            e.currentTarget.value = '';
          }}
          className="text-theme-text/90"
        />
        <div className="text-xs text-theme-text-dim/70">
          Also any files dropped into the <code className="text-theme-accent">slides/</code> folder
          appear automatically.
        </div>
      </Card>

      <Card title={`Slides (${slides.length})`}>
        <div className="flex flex-col gap-2">
          {slides.map((sl: UnifiedSlide, i: number) => (
            <div
              key={sl.id}
              className="flex items-center gap-3 rounded-lg border border-theme-border/10 bg-theme-bg/60 p-2"
            >
              <img
                src={sl.url}
                alt={sl.name}
                className="h-16 w-28 rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-theme-text">{sl.name}</div>
                <div className="text-xs text-theme-text-dim/70">{sl.source}</div>
              </div>
              <label className="flex items-center gap-1 text-xs text-theme-text-dim">
                Seconds
                <input
                  type="number"
                  min={3}
                  max={120}
                  className="w-16 rounded-md border border-theme-border/10 bg-theme-bg px-2 py-1 text-theme-text"
                  value={sl.duration}
                  onChange={(e) =>
                    durM.mutate({ id: sl.id, duration: Number(e.target.value) })
                  }
                />
              </label>
              <Toggle
                value={sl.enabled}
                onChange={(v) => toggleM.mutate({ id: sl.id, enabled: v })}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => move(i, -1)}
                  className="rounded bg-theme-border/5 px-2 py-1 text-sm text-theme-text/90 hover:bg-theme-border/10"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  className="rounded bg-theme-border/5 px-2 py-1 text-sm text-theme-text/90 hover:bg-theme-border/10"
                >
                  ↓
                </button>
              </div>
              {sl.source === 'local' && (
                <button
                  onClick={() => {
                    if (confirm(`Delete ${sl.name}?`)) {
                      const name = sl.id.slice('local:'.length);
                      deleteM.mutate(name);
                    }
                  }}
                  className="rounded bg-red-500/10 px-2 py-1 text-sm text-red-300 hover:bg-red-500/20"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          {!slides.length && (
            <div className="rounded-md border border-dashed border-theme-border/10 p-6 text-center text-theme-text-dim/70">
              No slides yet.
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function SecurityTab() {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [msg, setMsg] = useState<string>();
  const m = useMutation({
    mutationFn: () => api.adminChangePin(oldPin, newPin),
    onSuccess: () => {
      setMsg('PIN changed');
      setOldPin('');
      setNewPin('');
    },
    onError: (e: Error) => setMsg(e.message),
  });
  return (
    <Card title="Change admin PIN">
      <Field label="Current PIN">
        <input
          type="password"
          className={inputCls}
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value)}
        />
      </Field>
      <Field label="New PIN">
        <input
          type="password"
          className={inputCls}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
        />
      </Field>
      <button
        onClick={() => m.mutate()}
        disabled={newPin.length < 4}
        className="self-start rounded-md bg-theme-accent px-4 py-2 font-semibold text-theme-accent-contrast hover:brightness-110 disabled:opacity-50"
      >
        Change PIN
      </button>
      {msg && <div className="text-sm text-theme-text-dim">{msg}</div>}
    </Card>
  );
}

function FontScaleSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const v = value ?? 1;
  const step = (delta: number) => {
    const next = Math.round((v + delta) * 100) / 100;
    onChange(Math.max(0.6, Math.min(1.8, next)));
  };
  return (
    <Field label={`${label}: ${v.toFixed(2)}×`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-0.05)}
          className="rounded-md border border-theme-border/10 px-3 py-1 text-sm text-theme-text/90 hover:bg-theme-border/5"
        >
          −
        </button>
        <input
          type="range"
          min={0.6}
          max={1.8}
          step={0.05}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => step(0.05)}
          className="rounded-md border border-theme-border/10 px-3 py-1 text-sm text-theme-text/90 hover:bg-theme-border/5"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onChange(1)}
          className="rounded-md border border-theme-border/10 px-2 py-1 text-xs text-theme-text-dim hover:bg-theme-border/5"
          title="Reset to 1.00"
        >
          Reset
        </button>
      </div>
    </Field>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        value ? 'bg-theme-accent' : 'bg-theme-border/10',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-theme-accent-contrast transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

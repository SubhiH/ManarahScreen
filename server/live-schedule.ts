import { DateTime } from 'luxon';
import { cacheRead, cacheWrite, getSettings, LiveSlot, saveSettings } from './db';

/**
 * Weekly live-feed schedule.
 *
 * The schedule "presses the Live/Slides button" for the operator: at the start
 * of each slot it turns `liveMode` on, at the end it turns it off. Between
 * those two moments the button works as usual, so an operator can switch back
 * to slides mid-slot and it stays that way until the next edge.
 *
 * The last edge applied is persisted, which makes this restart-safe: a server
 * that comes back up mid-slot goes live, and one that was down across the end
 * of a slot switches back to slides as soon as it starts.
 *
 * Whether the camera actually has a picture is only knowable in the browser,
 * so the display falls back to slides on its own while a scheduled feed is
 * unavailable (see `liveModeSource`).
 */

const APPLIED_KEY = 'live-schedule:applied-edge';
const TICK_MS = 5_000;
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_SLOTS = 20;

type Edge = { id: string; at: DateTime; live: boolean };

/** Validates admin input; throws with a message suitable for a 400 response. */
export function sanitizeLiveSchedule(raw: unknown): LiveSlot[] {
  if (!Array.isArray(raw)) throw new Error('liveSchedule must be an array');
  if (raw.length > MAX_SLOTS) throw new Error(`liveSchedule is limited to ${MAX_SLOTS} slots`);
  return raw.map((entry, i) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const day = Number(e.day);
    const start = String(e.start ?? '');
    const end = String(e.end ?? '');
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      throw new Error(`slot ${i + 1}: day must be 1 (Monday) to 7 (Sunday)`);
    }
    if (!HM.test(start) || !HM.test(end)) {
      throw new Error(`slot ${i + 1}: start and end must be HH:MM (24h)`);
    }
    if (end <= start) throw new Error(`slot ${i + 1}: end must be after start`);
    return { day, start, end };
  });
}

/** Overlapping or touching slots on the same day become one, so a mid-window "off" edge can't fire. */
function mergeSlots(slots: LiveSlot[]): LiveSlot[] {
  const sorted = [...slots].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  const out: LiveSlot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.day === s.day && s.start <= last.end) {
      if (s.end > last.end) last.end = s.end;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

function at(day: DateTime, hm: string): DateTime {
  const [hour, minute] = hm.split(':').map(Number);
  return day.set({ hour, minute, second: 0, millisecond: 0 });
}

/** The most recent schedule edge at or before `now` (looking back one week). */
function latestEdge(slots: LiveSlot[], now: DateTime): Edge | null {
  const merged = mergeSlots(slots);
  let best: Edge | null = null;
  for (let back = 0; back <= 7; back++) {
    const day = now.minus({ days: back }).startOf('day');
    for (const slot of merged) {
      if (slot.day !== day.weekday) continue;
      for (const [hm, live] of [
        [slot.start, true],
        [slot.end, false],
      ] as const) {
        const t = at(day, hm);
        if (t > now || (best && t <= best.at)) continue;
        best = { id: `${t.toFormat("yyyy-LL-dd'T'HH:mm")}|${live ? 'on' : 'off'}`, at: t, live };
      }
    }
  }
  return best;
}

function currentEdge(): Edge | null {
  const s = getSettings();
  if (!s.liveScheduleEnabled || !s.liveSchedule.length) return null;
  return latestEdge(s.liveSchedule, DateTime.now().setZone(s.timezone));
}

/**
 * Call after the schedule (or timezone) changes. Marks a past "off" edge as
 * already handled so editing the schedule mid-week doesn't knock a manually
 * started feed off the screen — but leaves an "on" edge pending, so editing
 * during a slot (or starting up inside one) goes live right away.
 */
export function rebaselineLiveSchedule() {
  const edge = currentEdge();
  if (edge && !edge.live) cacheWrite(APPLIED_KEY, edge.id);
}

export function tickLiveSchedule() {
  const edge = currentEdge();
  if (!edge) return;
  if (cacheRead<string>(APPLIED_KEY)?.value === edge.id) return;
  saveSettings({ liveMode: edge.live, liveModeSource: 'schedule' });
  cacheWrite(APPLIED_KEY, edge.id);
  console.log(
    `[live-schedule] ${edge.at.toFormat('ccc HH:mm')} — ${edge.live ? 'slot started, live feed on' : 'slot ended, back to slides'}`,
  );
}

let timer: NodeJS.Timeout | null = null;

export function startLiveScheduler() {
  if (timer) return;
  if (!cacheRead<string>(APPLIED_KEY)) rebaselineLiveSchedule();
  const tick = () => {
    try {
      tickLiveSchedule();
    } catch (e) {
      console.error('[live-schedule] tick failed', e);
    }
  };
  tick();
  timer = setInterval(tick, TICK_MS);
}

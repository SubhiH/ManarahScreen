import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Radio, Images } from 'lucide-react';
import { api } from '@/lib/api';
import type { FeedState } from './LiveStream';

type Props = {
  /** Whether the area is currently showing the feed (not just whether live mode is on). */
  showingLive: boolean;
  /** Live mode was turned on by the weekly schedule. */
  scheduled: boolean;
  /** Says why a scheduled feed is still waiting behind the slides. */
  feed: FeedState;
};

/** Short label + tooltip detail for a scheduled feed that isn't showing yet. */
function waitingReason(feed: FeedState): { text: string; detail: string } {
  switch (feed.kind) {
    case 'needs-permission':
      return {
        text: 'allow camera access',
        detail: 'Chrome is waiting for camera permission, and its prompt is hidden behind the slides.',
      };
    case 'error':
      return { text: 'live feed unavailable', detail: feed.message };
    case 'no-picture':
      return {
        text: 'live feed has no picture',
        detail: `The camera is connected but its picture is blank (brightness spread ${feed.spread.toFixed(1)}).`,
      };
    default:
      return { text: 'starting live feed', detail: 'Opening the camera and checking for a picture.' };
  }
}

export default function LiveToggle({ showingLive, scheduled, feed }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const onClick = () => {
    if (busy) return;
    setBusy(true);
    api
      .cosmeticSettings({ liveMode: !showingLive })
      .then(() => qc.invalidateQueries({ queryKey: ['public-settings'] }))
      .finally(() => setBusy(false));
  };
  const Icon = showingLive ? Images : Radio;
  // Scheduled but still on slides = no picture yet; a click shows the camera regardless.
  const waiting = scheduled && !showingLive ? waitingReason(feed) : null;
  const label = showingLive
    ? 'Show slides'
    : waiting
      ? `${waiting.detail} Click to show the camera anyway.`
      : 'Show live feed';
  const text = showingLive
    ? scheduled
      ? 'Live · auto'
      : 'Live'
    : waiting
      ? `Slides · ${waiting.text}`
      : 'Slides';
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`absolute right-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-theme-border/20 bg-theme-bg/70 px-3 py-1.5 text-xs font-medium text-theme-text-dim shadow-lg backdrop-blur transition-opacity hover:text-theme-accent ${
        showingLive ? 'opacity-100' : 'opacity-30 hover:opacity-100'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{text}</span>
    </button>
  );
}

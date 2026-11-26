import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Radio, Images } from 'lucide-react';
import { api } from '@/lib/api';

type Props = {
  /** Whether the area is currently showing the feed (not just whether live mode is on). */
  showingLive: boolean;
  /** Live mode was turned on by the weekly schedule. */
  scheduled: boolean;
};

export default function LiveToggle({ showingLive, scheduled }: Props) {
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
  // Scheduled but still on slides = the camera has no picture yet; a click shows it regardless.
  const label = showingLive
    ? 'Show slides'
    : scheduled
      ? 'Scheduled live feed has no picture — show the camera anyway'
      : 'Show live feed';
  const text = showingLive
    ? scheduled
      ? 'Live · auto'
      : 'Live'
    : scheduled
      ? 'Slides · waiting for live feed'
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

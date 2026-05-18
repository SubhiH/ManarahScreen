import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Radio, Images } from 'lucide-react';
import { api } from '@/lib/api';

export default function LiveToggle({ active }: { active: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const onClick = () => {
    if (busy) return;
    setBusy(true);
    api
      .cosmeticSettings({ liveMode: !active })
      .then(() => qc.invalidateQueries({ queryKey: ['public-settings'] }))
      .finally(() => setBusy(false));
  };
  const Icon = active ? Images : Radio;
  const label = active ? 'Show slides' : 'Show live feed';
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-theme-border/20 bg-theme-bg/70 px-3 py-1.5 text-xs font-medium text-theme-text-dim shadow-lg backdrop-blur transition-opacity hover:text-theme-accent ${
        active ? 'opacity-100' : 'opacity-30 hover:opacity-100'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{active ? 'Live' : 'Slides'}</span>
    </button>
  );
}

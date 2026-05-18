import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import LiveStream from '@/components/LiveStream';
import { api } from '@/lib/api';

export default function Live() {
  const [params] = useSearchParams();
  const settingsQ = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.publicSettings(),
  });
  if (!settingsQ.data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
        Loading…
      </div>
    );
  }
  // ?device=… overrides the env value for quick testing.
  const label = params.get('device') ?? settingsQ.data.liveCameraLabel;
  return (
    <div className="fixed inset-0 bg-black">
      <LiveStream cameraLabel={label} />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Substring matched (case-insensitive) against the camera label. Empty = use system default camera. */
  cameraLabel?: string;
};

type Status =
  | { kind: 'starting' }
  | { kind: 'playing'; deviceLabel: string }
  | { kind: 'error'; message: string };

export default function LiveStream({ cameraLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'starting' });
  const target = (cameraLabel ?? '').trim();

  useEffect(() => {
    let stopped = false;
    let activeStream: MediaStream | null = null;

    (async () => {
      try {
        // Browsers hide device labels until the user has granted camera access.
        // Open a default stream once just to unlock labels, then re-open with
        // the matched deviceId.
        const primingStream = await navigator.mediaDevices.getUserMedia({ video: true });
        primingStream.getTracks().forEach((t) => t.stop());

        let constraints: MediaStreamConstraints = { video: true, audio: false };
        let matchedLabel = '(default camera)';

        if (target) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === 'videoinput');
          const needle = target.toLowerCase();
          const match = cams.find((d) => d.label.toLowerCase().includes(needle));
          if (!match) {
            const available = cams.map((d) => d.label).join(', ') || '(none)';
            throw new Error(`No camera matched "${target}". Available: ${available}`);
          }
          constraints = { video: { deviceId: { exact: match.deviceId } }, audio: false };
          matchedLabel = match.label;
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus({ kind: 'playing', deviceLabel: matchedLabel });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ kind: 'error', message });
      }
    })();

    return () => {
      stopped = true;
      activeStream?.getTracks().forEach((t) => t.stop());
    };
  }, [target]);

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-contain"
      />
      {status.kind !== 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          {status.kind === 'starting' && <span>Starting live feed…</span>}
          {status.kind === 'error' && (
            <div className="max-w-2xl px-6 text-center">
              <div className="mb-2 text-2xl font-semibold">Live feed unavailable</div>
              <div className="text-sm opacity-80">{status.message}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

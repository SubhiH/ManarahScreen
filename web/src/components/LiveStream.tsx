import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Substring matched (case-insensitive) against the camera label. Empty = use system default camera. */
  cameraLabel?: string;
  /**
   * Called when the feed starts or stops showing a real picture. An opened
   * camera isn't enough: a capture card with nothing plugged into it still
   * opens fine and sends black frames.
   */
  onPictureChange?: (hasPicture: boolean) => void;
};

type Status =
  | { kind: 'starting' }
  | { kind: 'playing'; deviceLabel: string }
  | { kind: 'error'; message: string };

const RETRY_MS = 30_000;
const SAMPLE_MS = 2_000;
/** Consecutive samples with a picture before it counts as live (~4s). */
const SAMPLES_TO_SHOW = 2;
/** Consecutive samples without one before it counts as gone (~10s) — rides out a fade to black. */
const SAMPLES_TO_DROP = 5;
const SAMPLE_W = 32;
const SAMPLE_H = 18;
/** Brightness spread (0-255) below which a frame is one flat colour: black, or a "no signal" fill. */
const FLAT_STDDEV = 4;

export default function LiveStream({ cameraLabel, onPictureChange }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const target = (cameraLabel ?? '').trim();
  const onPictureRef = useRef(onPictureChange);
  useEffect(() => {
    onPictureRef.current = onPictureChange;
  }, [onPictureChange]);

  useEffect(() => {
    let stopped = false;
    let activeStream: MediaStream | null = null;
    let retryTimer: number | undefined;
    let sampleTimer: number | undefined;
    let reported = false;

    const report = (hasPicture: boolean) => {
      if (reported === hasPicture) return;
      reported = hasPicture;
      onPictureRef.current?.(hasPicture);
    };

    const fail = (message: string) => {
      if (stopped) return;
      window.clearInterval(sampleTimer);
      report(false);
      setStatus({ kind: 'error', message });
      // The camera may be plugged in (or the source switched on) later.
      retryTimer = window.setTimeout(() => setAttempt((n) => n + 1), RETRY_MS);
    };

    const startSampling = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SAMPLE_W;
      canvas.height = SAMPLE_H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let good = 0;
      let bad = 0;
      sampleTimer = window.setInterval(() => {
        if (hasPicture(videoRef.current, ctx)) {
          bad = 0;
          if (++good >= SAMPLES_TO_SHOW) report(true);
        } else {
          good = 0;
          if (++bad >= SAMPLES_TO_DROP) report(false);
        }
      }, SAMPLE_MS);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices) {
          throw new Error('Camera access needs the display to be opened over https or localhost.');
        }

        let constraints: MediaStreamConstraints = { video: true, audio: false };
        let matchedLabel = '(default camera)';

        if (target) {
          let cams = await videoInputs();
          if (!cams.some((d) => d.label)) {
            // Browsers hide device labels until camera access is granted. Open
            // the default camera once to unlock them, then match by label.
            const primingStream = await navigator.mediaDevices.getUserMedia({ video: true });
            primingStream.getTracks().forEach((t) => t.stop());
            cams = await videoInputs();
          }
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
        // Fires when the device is unplugged or the capture source goes away.
        stream.getVideoTracks().forEach((t) =>
          t.addEventListener('ended', () => fail('The camera stopped sending video.'), {
            once: true,
          }),
        );
        startSampling();
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(sampleTimer);
      activeStream?.getTracks().forEach((t) => t.stop());
      if (reported) onPictureRef.current?.(false);
    };
  }, [target, attempt]);

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
              <div className="mt-2 text-xs opacity-60">Retrying every 30 seconds.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function videoInputs(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

/** True when the current frame has actual content rather than one flat colour. */
function hasPicture(
  video: HTMLVideoElement | null,
  ctx: CanvasRenderingContext2D | null,
): boolean {
  if (!video || !ctx || video.readyState < video.HAVE_CURRENT_DATA || !video.videoWidth) {
    return false;
  }
  ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
  const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
  const n = data.length / 4;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean)) >= FLAT_STDDEV;
}

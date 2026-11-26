import { useEffect, useRef, useState } from 'react';

/** What the feed is doing right now. Only 'live' means there is a real picture. */
export type FeedState =
  | { kind: 'starting' }
  | { kind: 'needs-permission' }
  | { kind: 'error'; message: string }
  /** The camera is open; waiting for a couple of frames to confirm there's a picture. */
  | { kind: 'checking' }
  /** Open, but no frames or one flat colour — a capture card with nothing plugged into it. */
  | { kind: 'no-picture'; spread: number }
  | { kind: 'live' };

type Props = {
  /** Substring matched (case-insensitive) against the camera label. Empty = use system default camera. */
  cameraLabel?: string;
  /** Called on every FeedState change, and with 'starting' on unmount. */
  onFeedChange?: (feed: FeedState) => void;
};

const RETRY_MS = 30_000;
const SAMPLE_MS = 2_000;
/** Consecutive samples with a picture before it counts as live (~4s). */
const SAMPLES_TO_SHOW = 2;
/** Consecutive samples without one before it counts as gone (~10s) — rides out a fade to black. */
const SAMPLES_TO_DROP = 5;
const SAMPLE_W = 64;
const SAMPLE_H = 36;
/**
 * Brightness spread (standard deviation, 0-255) below which a frame counts as
 * blank. A dead input is one exact colour (~0); a real room, even a dim one,
 * stays well above this. Kept low on purpose: wrongly hiding a working feed
 * during Jumu'ah is worse than briefly showing a black one.
 */
const FLAT_SPREAD = 1.5;

export default function LiveStream({ cameraLabel, onFeedChange }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [feed, setFeed] = useState<FeedState>({ kind: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const target = (cameraLabel ?? '').trim();
  const onFeedRef = useRef(onFeedChange);
  useEffect(() => {
    onFeedRef.current = onFeedChange;
  }, [onFeedChange]);
  useEffect(() => {
    onFeedRef.current?.(feed);
  }, [feed]);
  // So a parent never keeps a stale 'live' after the feed is gone.
  useEffect(() => () => onFeedRef.current?.({ kind: 'starting' }), []);

  useEffect(() => {
    let stopped = false;
    let activeStream: MediaStream | null = null;
    let retryTimer: number | undefined;
    let sampleTimer: number | undefined;

    const fail = (err: unknown) => {
      if (stopped) return;
      window.clearInterval(sampleTimer);
      setFeed({ kind: 'error', message: describeError(err) });
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
        const spread = pictureSpread(videoRef.current, ctx);
        if (spread >= FLAT_SPREAD) {
          bad = 0;
          if (++good === SAMPLES_TO_SHOW) setFeed({ kind: 'live' });
        } else {
          good = 0;
          if (++bad === SAMPLES_TO_DROP) setFeed({ kind: 'no-picture', spread });
        }
      }, SAMPLE_MS);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices) {
          throw new Error('Camera access needs the display to be opened over https or localhost.');
        }
        // A pending permission prompt never resolves on its own, and behind
        // the slides nobody sees it — so say so instead of "starting" forever.
        const permission = await navigator.permissions
          ?.query({ name: 'camera' as PermissionName })
          .catch(() => null);
        if (permission?.state === 'prompt' && !stopped) setFeed({ kind: 'needs-permission' });

        let constraints: MediaStreamConstraints = { video: true, audio: false };

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
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setFeed({ kind: 'checking' });
        // Fires when the device is unplugged or the capture source goes away.
        stream.getVideoTracks().forEach((t) =>
          t.addEventListener('ended', () => fail(new Error('The camera stopped sending video.')), {
            once: true,
          }),
        );
        startSampling();
      } catch (err) {
        fail(err);
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(sampleTimer);
      activeStream?.getTracks().forEach((t) => t.stop());
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
      {(feed.kind === 'starting' || feed.kind === 'needs-permission' || feed.kind === 'error') && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          {feed.kind === 'starting' && <span>Starting live feed…</span>}
          {feed.kind === 'needs-permission' && (
            <div className="max-w-2xl px-6 text-center">
              <div className="mb-2 text-2xl font-semibold">Waiting for camera permission</div>
              <div className="text-sm opacity-80">
                Allow camera access from the prompt in Chrome's address bar.
              </div>
            </div>
          )}
          {feed.kind === 'error' && (
            <div className="max-w-2xl px-6 text-center">
              <div className="mb-2 text-2xl font-semibold">Live feed unavailable</div>
              <div className="text-sm opacity-80">{feed.message}</div>
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

function describeError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') {
    return "Camera access is blocked. Allow it from the camera icon in Chrome's address bar, and check the computer's camera privacy settings.";
  }
  if (name === 'NotFoundError') return 'No camera is connected.';
  if (name === 'NotReadableError') {
    return 'The camera is busy or not responding — another app may be using it.';
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Brightness spread of the current frame. 0 means no frame yet or one flat
 * colour. Infinity means the frame couldn't be read back, which says nothing
 * about the camera, so it must not keep a working feed off the screen.
 */
function pictureSpread(video: HTMLVideoElement | null, ctx: CanvasRenderingContext2D | null): number {
  if (!video || video.readyState < video.HAVE_CURRENT_DATA || !video.videoWidth) return 0;
  if (!ctx) return Infinity;
  try {
    ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
    const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
    let n = 0;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue; // a real frame, even a black one, is opaque
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n++;
      sum += y;
      sumSq += y * y;
    }
    if (n === 0) return Infinity;
    const mean = sum / n;
    return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  } catch {
    return Infinity;
  }
}

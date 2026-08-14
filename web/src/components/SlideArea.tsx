import SlideCarousel from './SlideCarousel';
import LiveStream from './LiveStream';
import LiveToggle from './LiveToggle';
import DimOverlay from './DimOverlay';
import PostPrayerAdhkar from './PostPrayerAdhkar';
import CountdownOverlay from './CountdownOverlay';
import SunriseCounter from './SunriseCounter';
import type { DisplayProps } from '@/layouts/types';

/**
 * Slide area for the layouts that can show the live camera feed.
 *
 * In live mode the feed owns the area: dim, adhkar, the Adhan countdown and
 * the Duha takeover all exist to dress up *slides*, and every one of them
 * would cover the picture — so none of them render. The sidebar keeps showing
 * prayer times either way, and a `sidebar-inline` Duha counter is unaffected
 * since it lives outside this area.
 */
export default function SlideArea(p: DisplayProps) {
  const live = p.settings.liveMode;
  const sunrisePosition = p.settings.sunriseCounterPosition;

  return (
    <>
      {live ? (
        <LiveStream cameraLabel={p.settings.liveCameraLabel} />
      ) : (
        <>
          <SlideCarousel slides={p.slides} />
          <DimOverlay show={p.dim.active} opacity={p.settings.dimOpacity} />
          <PostPrayerAdhkar {...p.postAdhkar} />
          <CountdownOverlay
            show={p.countdown.active}
            prayerLabel={p.countdown.label}
            secondsRemaining={p.countdown.secondsRemaining}
          />
          {(sunrisePosition === 'slide-area' || sunrisePosition === 'top-banner') && (
            <SunriseCounter
              show={p.sunrise.active}
              label={p.settings.sunriseCounterLabel}
              secondsRemaining={p.sunrise.secondsRemaining}
              totalSeconds={p.sunrise.totalSeconds}
              endTime={p.sunrise.endTime}
              position={sunrisePosition}
            />
          )}
        </>
      )}

      {/* Last, and above the overlays, so the operator can always switch back. */}
      <LiveToggle active={live} />
    </>
  );
}

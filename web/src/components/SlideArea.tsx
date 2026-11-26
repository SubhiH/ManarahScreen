import { useState } from 'react';
import { cn } from '@/lib/cn';
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
 *
 * When the weekly schedule turned live mode on, nobody is standing at the
 * screen to notice a dead camera, so the feed only takes over once it has a
 * real picture; until then (and whenever the picture drops out) the slides
 * stay up, with the camera kept open underneath so it can step in. A live
 * mode the operator turned on by hand shows the feed as-is, errors included.
 */
export default function SlideArea(p: DisplayProps) {
  const live = p.settings.liveMode;
  const scheduled = live && p.settings.liveModeSource === 'schedule';
  const [hasPicture, setHasPicture] = useState(false);
  const showLive = live && (!scheduled || hasPicture);
  const sunrisePosition = p.settings.sunriseCounterPosition;

  return (
    <>
      {live && (
        <LiveStream cameraLabel={p.settings.liveCameraLabel} onPictureChange={setHasPicture} />
      )}
      {!showLive && (
        // Opaque while the feed waits underneath, so it can't show through an empty slide area.
        <div className={cn('absolute inset-0', live && 'bg-theme-bg')}>
          <SlideCarousel slides={p.slides} />
          <DimOverlay show={p.dim.active} opacity={p.settings.dimOpacity} />
          <PostPrayerAdhkar {...p.postAdhkar} />
          <CountdownOverlay {...p.countdown} />
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
        </div>
      )}

      {/* Last, and above the overlays, so the operator can always switch back. */}
      <LiveToggle showingLive={showLive} scheduled={scheduled} />
    </>
  );
}

import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';

/** Returns a DateTime in the given tz that ticks every `intervalMs`. */
export function useNow(tz: string, intervalMs = 1000): DateTime {
  const [now, setNow] = useState<DateTime>(() => DateTime.now().setZone(tz));
  useEffect(() => {
    setNow(DateTime.now().setZone(tz));
    const id = window.setInterval(() => {
      setNow(DateTime.now().setZone(tz));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [tz, intervalMs]);
  return now;
}

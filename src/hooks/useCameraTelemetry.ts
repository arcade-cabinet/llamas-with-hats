import { useEffect, useRef, useState } from 'react';
import type { CameraTelemetry } from '../components/game/GameRenderer';

export function useCameraTelemetry(enabled: boolean, isPlaying: boolean) {
  const cameraTelemetryRef = useRef<CameraTelemetry | null>(null);
  const [cameraTelemetry, setCameraTelemetry] = useState<CameraTelemetry | null>(null);

  // Poll camera telemetry ref at 5Hz so the overlay re-renders with fresh data
  useEffect(() => {
    if (!enabled || !isPlaying) return;
    const id = setInterval(() => {
      const val = cameraTelemetryRef.current;
      if (val) setCameraTelemetry(val);
    }, 200);
    return () => clearInterval(id);
  }, [enabled, isPlaying]);

  return { cameraTelemetryRef, cameraTelemetry };
}

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { clsx } from 'clsx';

interface HorrorEffectsProps {
  /** Horror intensity level (0-3). Controls which visual effects are active. */
  horrorLevel: number;
  /** When true, render a blood splatter animation that fades in then out. */
  bloodSplatter?: boolean;
  /** When true, apply a CSS transform shake animation to the wrapper. */
  screenShake?: boolean;
}

/** Generate deterministic-ish splatter positions so they stay stable across renders. */
const SPLATTER_CONFIGS = [
  { top: '12%', left: '8%', size: 120 },
  { top: '45%', left: '78%', size: 90 },
  { top: '70%', left: '25%', size: 110 },
  { top: '20%', left: '55%', size: 80 },
  { top: '85%', left: '65%', size: 100 },
  { top: '30%', left: '90%', size: 70 },
  { top: '60%', left: '15%', size: 95 },
] as const;

/**
 * HorrorEffects -- layers atmospheric visual effects on top of the game scene.
 *
 * Sits at z-index 9, below the FilmGrainOverlay at z-index 10.
 * All elements are pointer-events-none so gameplay input passes through.
 *
 * Horror levels:
 *   0 -- No effects (returns null)
 *   1 -- Subtle red vignette edges, very faint screen flicker
 *   2 -- Stronger vignette, periodic text-glitch on overlay, red edge pulses every ~8s
 *   3 -- Heavy vignette-horror, blood-red border pulses, occasional full-screen flash, flicker
 */
export const HorrorEffects: React.FC<HorrorEffectsProps> = ({
  horrorLevel,
  bloodSplatter = false,
  screenShake = false,
}) => {
  const level = Math.max(0, Math.min(3, Math.round(horrorLevel)));

  // --- Periodic red pulse for level 2+ (fires every ~8s) ---
  const [redPulseActive, setRedPulseActive] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (level < 2) {
      setRedPulseActive(false);
      return;
    }

    pulseTimerRef.current = setInterval(() => {
      setRedPulseActive(true);
      pulseTimeoutRef.current = setTimeout(() => {
        setRedPulseActive(false);
      }, 600);
    }, 8000);

    return () => {
      if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    };
  }, [level]);

  // --- Occasional full-screen flash for level 3 (random interval 4-10s) ---
  const [flashActive, setFlashActive] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (level < 3) {
      setFlashActive(false);
      return;
    }

    const scheduleFlash = () => {
      const delay = 4000 + Math.random() * 6000; // 4-10s
      flashTimerRef.current = setTimeout(() => {
        setFlashActive(true);
        setTimeout(() => {
          setFlashActive(false);
        }, 200); // 0.2s flash
        scheduleFlash();
      }, delay);
    };

    scheduleFlash();

    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [level]);

  // --- Blood splatter positions (memoized so they don't shift on re-render) ---
  const splatters = useMemo(() => {
    if (!bloodSplatter) return [];
    return SPLATTER_CONFIGS.map((cfg, i) => ({
      ...cfg,
      id: i,
    }));
  }, [bloodSplatter]);

  // Level 0 -- no effects at all
  if (level === 0 && !bloodSplatter && !screenShake) {
    return null;
  }

  // Vignette intensity by level
  const vignetteStyle: React.CSSProperties =
    level === 1
      ? {
          background:
            'radial-gradient(ellipse at center, transparent 60%, rgba(139, 0, 0, 0.15) 100%)',
        }
      : level === 2
        ? {
            background:
              'radial-gradient(ellipse at center, transparent 45%, rgba(139, 0, 0, 0.3) 100%)',
          }
        : level >= 3
          ? {
              background:
                'radial-gradient(ellipse at center, transparent 30%, rgba(74, 0, 0, 0.45) 85%, rgba(139, 0, 0, 0.6) 100%)',
            }
          : {};

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: 9,
        animation: screenShake
          ? 'screen-shake 0.15s ease-in-out infinite'
          : undefined,
      }}
    >
      {/* Vignette layer */}
      {level >= 1 && (
        <div
          className={clsx('absolute inset-0', level >= 1 && 'animate-[flicker_3s_ease-in-out_infinite]')}
          style={vignetteStyle}
        />
      )}

      {/* Level 2+: text-glitch effect on an overlay div */}
      {level >= 2 && (
        <div
          className="absolute inset-0 animate-[text-glitch_4s_ease-in-out_infinite]"
        />
      )}

      {/* Level 2+: periodic red edge pulse */}
      {level >= 2 && redPulseActive && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            boxShadow: 'inset 0 0 80px 20px var(--color-blood)',
            opacity: 1,
          }}
        />
      )}

      {/* Level 3: blood-red border pulse via glow-pulse animation */}
      {level >= 3 && (
        <div
          className="absolute inset-0 animate-[glow-pulse_2s_ease-in-out_infinite]"
          style={{
            color: 'var(--color-blood)',
            border: '2px solid var(--color-blood-dark)',
          }}
        />
      )}

      {/* Level 3: full-screen flash */}
      {level >= 3 && flashActive && (
        <div
          className="absolute inset-0"
          style={{
            background: 'var(--color-crimson)',
            opacity: 0.15,
          }}
        />
      )}

      {/* Level 3: persistent heavy flicker */}
      {level >= 3 && (
        <div
          className="absolute inset-0 animate-[flicker_0.5s_ease-in-out_infinite]"
          style={{
            background: 'rgba(10, 10, 12, 0.08)',
          }}
        />
      )}

      {/* Blood splatter overlay */}
      {bloodSplatter &&
        splatters.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full animate-[splatter-fade_1s_ease-out_forwards]"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              background: `radial-gradient(circle, var(--color-blood) 0%, var(--color-blood-dark) 60%, transparent 100%)`,
              opacity: 0,
            }}
          />
        ))}
    </div>
  );
};

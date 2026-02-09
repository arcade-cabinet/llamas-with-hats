import React, { useRef, useEffect, useCallback } from 'react';

interface FilmGrainOverlayProps {
  /** Horror intensity level (0-3). Controls noise opacity and vignette redness. */
  horrorLevel: number;
  /** Whether the overlay is rendered. Defaults to true. */
  enabled?: boolean;
}

/** Alpha value per horror level: 0 = subtle, 3 = heavy grain. */
const ALPHA_BY_LEVEL: Record<number, number> = {
  0: 8,
  1: 12,
  2: 18,
  3: 25,
};

/** Noise canvas resolution — stretched via CSS to fill the viewport. */
const NOISE_SIZE = 1024;

/** Only repaint every Nth animation frame to keep GPU load low. */
const FRAME_SKIP = 3;

export const FilmGrainOverlay: React.FC<FilmGrainOverlayProps> = ({
  horrorLevel,
  enabled = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafId = useRef<number>(0);
  const frameCount = useRef<number>(0);

  const clampedLevel = Math.max(0, Math.min(3, Math.round(horrorLevel)));
  const noiseAlpha = ALPHA_BY_LEVEL[clampedLevel] ?? ALPHA_BY_LEVEL[0];

  /**
   * Draw a single frame of random greyscale noise followed by a red-tinted
   * radial vignette whose intensity tracks the horror level.
   */
  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      // --- noise pass ---
      const imageData = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
      const data = imageData.data;
      const len = data.length;

      for (let i = 0; i < len; i += 4) {
        const grey = (Math.random() * 256) | 0;
        data[i] = grey;     // R
        data[i + 1] = grey; // G
        data[i + 2] = grey; // B
        data[i + 3] = noiseAlpha; // A
      }

      ctx.putImageData(imageData, 0, 0);

      // --- vignette pass ---
      // Red intensity ramps with horror level: 0 → very faint, 3 → pronounced.
      const redBase = 20 + clampedLevel * 25;        // 20 .. 95
      const edgeAlpha = 0.15 + clampedLevel * 0.12;  // 0.15 .. 0.51

      const cx = NOISE_SIZE / 2;
      const cy = NOISE_SIZE / 2;
      const radius = NOISE_SIZE * 0.7;

      const gradient = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.6, `rgba(${redBase}, 0, 0, ${edgeAlpha * 0.3})`);
      gradient.addColorStop(1, `rgba(${redBase}, 0, 0, ${edgeAlpha})`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, NOISE_SIZE, NOISE_SIZE);
    },
    [noiseAlpha, clampedLevel],
  );

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    frameCount.current = 0;

    const loop = () => {
      frameCount.current += 1;

      if (frameCount.current % FRAME_SKIP === 0) {
        drawFrame(ctx);
      }

      rafId.current = requestAnimationFrame(loop);
    };

    // Paint the first frame immediately so the overlay isn't blank.
    drawFrame(ctx);
    rafId.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId.current);
    };
  }, [enabled, drawFrame]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      width={NOISE_SIZE}
      height={NOISE_SIZE}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        width: '100vw',
        height: '100vh',
        imageRendering: 'pixelated',
        zIndex: 10,
      }}
    />
  );
};

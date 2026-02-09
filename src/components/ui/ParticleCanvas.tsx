/**
 * Particle Canvas
 * ===============
 *
 * A performant canvas-based particle system for the main menu background.
 * Creates an atmospheric "charcoal dust" effect with slow-drifting particles,
 * subtle color variation (white/rose/pumpkin), and a central radial glow pulse.
 *
 * Performance target: < 0.5ms per frame on mid-range hardware.
 * Strategy: Canvas 2D, skip every 2 of 3 frames for movement, batch draw calls.
 */

import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  /** Color index: 0 = white, 1 = rose, 2 = pumpkin */
  colorIdx: number;
}

const PARTICLE_COUNT = 600;
const COLORS = [
  [255, 255, 255],   // white
  [221, 123, 187],   // dusty rose
  [245, 129, 12],    // pumpkin
  [132, 181, 255],   // cold blue
];

/** Central glow pulse period in ms */
const GLOW_PERIOD = 6000;
const GLOW_MIN_ALPHA = 0.04;
const GLOW_MAX_ALPHA = 0.09;

function createParticles(w: number, h: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15 - 0.05, // slight upward bias
      radius: Math.random() * 1.2 + 0.3,
      alpha: Math.random() * 0.3 + 0.05,
      colorIdx: Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? 1 : Math.random() < 0.5 ? 2 : 3,
    });
  }
  return particles;
}

export const ParticleCanvas: React.FC<{ className?: string }> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const frameCountRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = sizeRef.current;
    const particles = particlesRef.current;
    const frame = frameCountRef.current++;

    // Update positions every 3rd frame for perf
    if (frame % 3 === 0) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -2) p.x = w + 2;
        if (p.x > w + 2) p.x = -2;
        if (p.y < -2) p.y = h + 2;
        if (p.y > h + 2) p.y = -2;
      }
    }

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Central radial glow pulse
    const now = performance.now();
    const glowAlpha = GLOW_MIN_ALPHA + (GLOW_MAX_ALPHA - GLOW_MIN_ALPHA) *
      (0.5 + 0.5 * Math.sin((now / GLOW_PERIOD) * Math.PI * 2));
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
    gradient.addColorStop(0, `rgba(221, 123, 187, ${glowAlpha})`);
    gradient.addColorStop(0.5, `rgba(245, 129, 12, ${glowAlpha * 0.3})`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Draw particles — batch by color for fewer state changes
    for (let ci = 0; ci < COLORS.length; ci++) {
      const [r, g, b] = COLORS[ci];
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.colorIdx !== ci) continue;

        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;

    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      sizeRef.current = { w, h };

      // Re-init particles on first render or resize
      if (particlesRef.current.length === 0) {
        particlesRef.current = createParticles(w, h);
      } else {
        // Re-distribute particles that fell outside bounds
        for (const p of particlesRef.current) {
          if (p.x > w) p.x = Math.random() * w;
          if (p.y > h) p.y = Math.random() * h;
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
};

export default ParticleCanvas;

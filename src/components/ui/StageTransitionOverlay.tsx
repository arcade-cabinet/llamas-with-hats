import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';

interface StageTransitionOverlayProps {
  stageName: string;
  stageDescription?: string;
  onDismiss: () => void;
}

/**
 * Cinematic stage-transition overlay with a circular clip-path reveal,
 * staggered content fade-ins, and a pulsing continue button.
 *
 * Uses only CSS animations (no framer-motion). Color tokens reference
 * the production palette defined in index.css.
 */
export const StageTransitionOverlay: React.FC<StageTransitionOverlayProps> = ({
  stageName,
  stageDescription,
  onDismiss,
}) => {
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    // The circle-expand reveal runs for 0.6s.
    // Wait 0.5s after it completes before showing inner content.
    const timer = setTimeout(() => setContentVisible(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-8"
      style={{
        animation: 'clip-circle-expand 0.6s ease-out forwards',
        background:
          'radial-gradient(ellipse at center, var(--color-void) 40%, var(--color-blood-dark) 100%)',
      }}
    >
      {/* Subtle blood-red vignette from edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(139,0,0,0.18) 100%)',
        }}
      />

      <div
        className={clsx(
          'text-center max-w-lg relative transition-opacity duration-500',
          contentVisible ? 'opacity-100' : 'opacity-0',
        )}
      >
        {/* --- "Stage Complete" subtitle --- */}
        <p
          className="text-sm uppercase tracking-[0.25em] mb-3 font-sans"
          style={{
            color: 'var(--color-hud-muted)',
            animation: contentVisible
              ? 'stage-subtitle-in 0.6s ease-out forwards'
              : 'none',
            opacity: 0,
          }}
        >
          Stage Complete
        </p>

        {/* --- Stage name with blood glow --- */}
        <h1
          className="text-3xl md:text-5xl font-serif mb-5"
          style={{
            color: 'var(--color-pumpkin)',
            textShadow:
              '0 0 24px rgba(139,0,0,0.7), 0 0 48px rgba(139,0,0,0.35), 2px 2px 6px rgba(0,0,0,0.9)',
            animation: contentVisible
              ? 'stage-title-in 0.7s ease-out 0.15s forwards'
              : 'none',
            opacity: 0,
            transform: 'scale(1.05)',
          }}
        >
          {stageName}
        </h1>

        {/* --- Description --- */}
        {stageDescription && (
          <p
            className="mb-6 font-serif italic leading-relaxed"
            style={{
              color: 'var(--color-hud-muted)',
              animation: contentVisible
                ? 'stage-desc-in 0.6s ease-out 0.45s forwards'
                : 'none',
              opacity: 0,
            }}
          >
            {stageDescription}
          </p>
        )}

        {/* --- Divider --- */}
        <div
          className="my-6 mx-auto"
          style={{
            height: '1px',
            maxWidth: '12rem',
            background:
              'linear-gradient(90deg, transparent, var(--color-blood), transparent)',
            animation: contentVisible
              ? 'stage-desc-in 0.5s ease-out 0.55s forwards'
              : 'none',
            opacity: 0,
          }}
        />

        {/* --- Continue button with gentle pulse --- */}
        <button
          onClick={handleDismiss}
          className="px-8 py-3 rounded-lg font-serif cursor-pointer transition-colors"
          style={{
            background: 'rgba(139,0,0,0.2)',
            color: 'var(--color-pumpkin)',
            border: '1px solid rgba(139,0,0,0.5)',
            animation: contentVisible
              ? 'stage-btn-in 0.5s ease-out 0.7s forwards, stage-btn-pulse 2s ease-in-out 1.2s infinite'
              : 'none',
            opacity: 0,
          }}
        >
          Continue
        </button>
      </div>

      {/* Scoped keyframes for the staggered content animations */}
      <style>{`
        @keyframes stage-subtitle-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes stage-title-in {
          from {
            opacity: 0;
            transform: scale(1.05);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes stage-desc-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes stage-btn-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes stage-btn-pulse {
          0%, 100% {
            box-shadow: 0 0 6px rgba(139,0,0,0.3), 0 0 12px rgba(139,0,0,0.1);
          }
          50% {
            box-shadow: 0 0 14px rgba(139,0,0,0.5), 0 0 28px rgba(139,0,0,0.2);
          }
        }
      `}</style>
    </div>
  );
};

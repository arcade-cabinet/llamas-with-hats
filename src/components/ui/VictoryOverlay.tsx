import React from 'react';
import type { CharacterType, WorldSeed } from '../../types/game';

interface VictoryOverlayProps {
  selectedCharacter: CharacterType;
  worldSeed: WorldSeed | null;
  onReturnToMenu: () => void;
}

export const VictoryOverlay: React.FC<VictoryOverlayProps> = ({
  selectedCharacter, worldSeed, onReturnToMenu,
}) => {
  const isCurl = selectedCharacter === 'carl';
  const accent = isCurl ? '#8B0000' : '#cd853f';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-8"
      style={{
        background: `radial-gradient(ellipse at center, rgba(10,10,12,0.85) 40%, ${isCurl ? 'rgba(80,0,0,0.5)' : 'rgba(139,69,19,0.25)'} 100%)`,
        animation: 'clip-circle-expand 0.8s ease-out both',
      }}
    >
      <div className="text-center max-w-lg">
        {/* Subtitle */}
        <p
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: 'var(--color-hud-muted)',
            animation: 'count-up 0.6s ease-out 0.8s both',
          }}
        >
          All Three Stages Complete
        </p>

        {/* Title */}
        <h1
          className="font-serif mb-6"
          style={{
            fontSize: 'clamp(2rem, 8vw, 4rem)',
            color: accent,
            textShadow: `0 0 30px ${accent}80, 0 0 60px ${accent}40, 2px 2px 6px rgba(0,0,0,0.8)`,
            animation: 'count-up 0.8s ease-out 1.0s both',
          }}
        >
          {isCurl ? 'CAAAAARL!' : 'Oh hey Paul.'}
        </h1>

        {/* Tagline */}
        <p
          className="font-serif italic mb-4"
          style={{
            fontSize: 'clamp(1rem, 3vw, 1.25rem)',
            color: 'var(--color-hud-text)',
            animation: 'count-up 0.6s ease-out 1.4s both',
          }}
        >
          {isCurl
            ? 'I had the rumblies that only hands could satisfy.'
            : 'That kills people, Carl!'}
        </p>

        {/* Divider */}
        <div
          style={{
            height: 1,
            margin: '24px auto',
            width: '60%',
            background: `linear-gradient(to right, transparent, ${accent}40, transparent)`,
            animation: 'count-up 0.4s ease-out 1.8s both',
          }}
        />

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            color: 'var(--color-hud-text)',
            lineHeight: 1.6,
            marginBottom: 8,
            animation: 'count-up 0.6s ease-out 2.0s both',
          }}
        >
          {isCurl
            ? "You embraced Carl's ecstatic artistry across all three stages."
            : "You navigated Paul through Carl's escalating madness and lived to tell the tale."}
        </p>

        <p
          className="font-serif italic"
          style={{
            fontSize: 13,
            color: 'var(--color-hud-muted)',
            marginBottom: 32,
            animation: 'count-up 0.6s ease-out 2.3s both',
          }}
        >
          The {worldSeed?.adjective1} {worldSeed?.adjective2} {worldSeed?.noun} will never be the same.
        </p>

        {/* Return button */}
        <div style={{ animation: 'count-up 0.6s ease-out 2.6s both' }}>
          <button
            onClick={onReturnToMenu}
            className="font-serif transition-all"
            style={{
              padding: '12px 32px',
              background: `${accent}20`,
              border: `1px solid ${accent}60`,
              borderRadius: 8,
              color: accent,
              fontSize: 16,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${accent}40`;
              e.currentTarget.style.boxShadow = `0 0 20px ${accent}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${accent}20`;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Return to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

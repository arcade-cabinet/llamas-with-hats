import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { getAudioManager, SoundEffects } from '../../../systems/AudioManager';

interface PauseMenuProps {
  onResume: () => void;
  onSave: () => void;
  onMainMenu: () => void;
  isCompact: boolean;
}

// ---------------------------------------------------------------------------
// PauseButton — glow-border button matching the main menu style
// ---------------------------------------------------------------------------

interface PauseButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  delay?: number;
}

const PauseButton: React.FC<PauseButtonProps> = ({ onClick, children, danger = false, delay = 0 }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [glowAngle, setGlowAngle] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    setGlowAngle(angle);
  };

  const glowGradient = isHovered
    ? danger
      ? `conic-gradient(from ${glowAngle}deg, var(--color-crimson), var(--color-blood), var(--color-pumpkin), var(--color-crimson))`
      : `conic-gradient(from ${glowAngle}deg, var(--color-rose), var(--color-pumpkin), var(--color-teal), var(--color-rose))`
    : undefined;

  return (
    <div
      style={{
        animation: `menu-btn-entrance 0.35s ease-out ${delay}s both`,
      }}
    >
      <div
        className="rounded-xl p-[1px] transition-opacity duration-200"
        style={{
          background: glowGradient || 'var(--color-hud-border)',
          opacity: isHovered ? 1 : 0.4,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => { setIsHovered(true); getAudioManager().playSound(SoundEffects.UI_HOVER); }}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          ref={btnRef}
          onClick={() => { getAudioManager().playSound(SoundEffects.UI_CLICK); onClick(); }}
          onFocus={() => { setIsHovered(true); getAudioManager().playSound(SoundEffects.UI_HOVER); }}
          onBlur={() => setIsHovered(false)}
          className="w-full py-3 rounded-[11px] font-serif text-sm tracking-wide transition-colors cursor-pointer"
          style={{
            background: danger ? 'rgba(139, 0, 0, 0.25)' : 'rgba(10, 10, 12, 0.9)',
            color: isHovered
              ? '#ffffff'
              : danger
                ? 'var(--color-crimson)'
                : 'var(--color-hud-text)',
            border: isHovered ? 'none' : `1px solid ${danger ? 'rgba(139, 0, 0, 0.4)' : 'var(--color-hud-border)'}`,
          }}
        >
          {children}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PauseMenu
// ---------------------------------------------------------------------------

export const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onSave, onMainMenu, isCompact }) => (
  <div
    className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50"
    style={{
      background: 'radial-gradient(ellipse at center, rgba(10,10,12,0.92) 40%, rgba(80,0,0,0.2) 100%)',
      backdropFilter: 'blur(6px)',
      animation: 'pause-fade-in 0.25s ease-out both',
    }}
  >
    <div
      className={clsx(
        'rounded-xl border',
        isCompact ? 'p-4 w-64' : 'p-6 w-80'
      )}
      style={{
        background: 'linear-gradient(135deg, rgba(26,26,46,0.95), rgba(10,10,12,0.95))',
        borderColor: 'var(--color-hud-border)',
        animation: 'pause-panel-in 0.3s ease-out 0.05s both',
      }}
    >
      {/* Decorative top line */}
      <div
        style={{
          height: 1,
          margin: '0 auto 16px',
          width: '60%',
          background: 'linear-gradient(to right, transparent, var(--color-blood), transparent)',
        }}
      />

      <h2
        className="font-serif text-center mb-1"
        style={{
          fontSize: isCompact ? 20 : 24,
          color: 'var(--color-pumpkin)',
          textShadow: '0 0 20px rgba(139,0,0,0.5), 2px 2px 4px rgba(0,0,0,0.8)',
          animation: 'count-up 0.4s ease-out 0.15s both',
        }}
      >
        Paused
      </h2>
      <p
        className="text-center mb-5"
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: 'var(--color-hud-muted)',
          animation: 'count-up 0.3s ease-out 0.25s both',
        }}
      >
        Press ESC to resume
      </p>

      <div className="space-y-2">
        <PauseButton onClick={onResume} delay={0.15}>Resume</PauseButton>
        <PauseButton onClick={onSave} delay={0.2}>Save Game</PauseButton>
        <PauseButton onClick={onMainMenu} danger delay={0.25}>Main Menu</PauseButton>
      </div>

      {/* Decorative bottom line */}
      <div
        style={{
          height: 1,
          margin: '16px auto 0',
          width: '40%',
          background: 'linear-gradient(to right, transparent, rgba(139,0,0,0.3), transparent)',
          animation: 'count-up 0.3s ease-out 0.35s both',
        }}
      />
    </div>
  </div>
);

import React, { useEffect, useRef, useState } from 'react';
import type { CharacterType, WorldSeed, Achievement } from '../../types/game';
import { getAchievementSystem } from '../../systems/AchievementSystem';
import { getAudioManager, SoundEffects } from '../../systems/AudioManager';

// ---------------------------------------------------------------------------
// Epilogue Text
// ---------------------------------------------------------------------------

const CARL_EPILOGUE = [
  "Carl went on to open several more 'galleries.' His art was never truly understood in his lifetime. Or anyone's lifetime, really.",
  "The house, the station, the island — each was a canvas, and Carl painted them all in his signature shade of crimson.",
  "He never did understand why Paul kept running. Art appreciation takes time, he always said. Some people just aren't ready.",
  "His cookbook, 'Locally Sourced: A Memoir,' became the most seized book in publishing history. Carl considered this a form of critical acclaim.",
  "To this day, if you listen carefully in certain basements, you can still hear cheerful humming. And the sound of something being arranged. Symmetrically.",
];

const PAUL_EPILOGUE = [
  "Paul moved to a quiet farm upstate. He never mentioned Carl again. Though sometimes, late at night, he'd check the closets. Just in case.",
  "He started a support group: 'Survivors of Artistic Roommates.' Attendance was lower than expected, for reasons no one discussed.",
  "The therapist bills were substantial. The therapist needed their own therapist after hearing about the basement, the station, and the island.",
  "Paul never ate cranberry sauce again. Or anything that could be described as 'artisanal.' Or 'locally sourced.' Or 'hand-crafted.'",
  "He wrote a memoir titled 'That Kills People: A Story of Survival.' It was shelved in the horror section. Paul felt this was appropriate.",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VictoryOverlayProps {
  selectedCharacter: CharacterType;
  worldSeed: WorldSeed | null;
  onReturnToMenu: () => void;
  playTimeSeconds?: number;
  roomsExplored?: number;
  totalRooms?: number;
  itemsCollected?: number;
  totalItems?: number;
  beatsTriggered?: number;
  totalBeats?: number;
  horrorPeak?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VictoryOverlay: React.FC<VictoryOverlayProps> = ({
  selectedCharacter, worldSeed, onReturnToMenu,
  playTimeSeconds = 0, roomsExplored = 0, totalRooms = 0,
  itemsCollected = 0, totalItems = 0, beatsTriggered = 0,
  totalBeats = 0, horrorPeak = 0,
}) => {
  const isCarl = selectedCharacter === 'carl';
  const accent = isCarl ? '#8B0000' : '#cd853f';
  const [revealedLines, setRevealedLines] = useState(0);
  const [sessionAchievements, setSessionAchievements] = useState<Array<Achievement & { unlocked: boolean }>>([]);

  const epilogue = isCarl ? CARL_EPILOGUE : PAUL_EPILOGUE;

  // Typewriter effect for epilogue
  useEffect(() => {
    if (revealedLines >= epilogue.length) return;
    const timer = setTimeout(() => {
      setRevealedLines(prev => prev + 1);
    }, 1200 + revealedLines * 600);
    return () => clearTimeout(timer);
  }, [revealedLines, epilogue.length]);

  // Get session achievements and play victory fanfare
  useEffect(() => {
    const system = getAchievementSystem();
    const unlocks = system.getSessionUnlocks();
    setSessionAchievements(unlocks.map(a => ({ ...a, unlocked: true })));
    // Victory fanfare — staggered ascending chimes
    const audio = getAudioManager();
    audio.playSound(SoundEffects.ITEM_PICKUP, { volume: 0.6, pitch: 0.8 });
    const t2 = setTimeout(() => audio.playSound(SoundEffects.ITEM_PICKUP, { volume: 0.7, pitch: 1.0 }), 300);
    const t3 = setTimeout(() => audio.playSound(SoundEffects.ITEM_PICKUP, { volume: 0.8, pitch: 1.2 }), 600);
    return () => { clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{
        background: `radial-gradient(ellipse at center, rgba(10,10,12,0.92) 40%, ${isCarl ? 'rgba(80,0,0,0.5)' : 'rgba(139,69,19,0.25)'} 100%)`,
        animation: 'clip-circle-expand 0.8s ease-out both',
      }}
    >
      <div className="text-center max-w-2xl w-full py-8">
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
          className="font-serif mb-4"
          style={{
            fontSize: 'clamp(2rem, 8vw, 3.5rem)',
            color: accent,
            textShadow: `0 0 30px ${accent}80, 0 0 60px ${accent}40, 2px 2px 6px rgba(0,0,0,0.8)`,
            animation: 'count-up 0.8s ease-out 1.0s both',
          }}
        >
          {isCarl ? 'CAAAAARL!' : 'Oh hey Paul.'}
        </h1>

        {/* Tagline */}
        <p
          className="font-serif italic mb-2"
          style={{
            fontSize: 'clamp(0.9rem, 3vw, 1.15rem)',
            color: 'var(--color-hud-text)',
            animation: 'count-up 0.6s ease-out 1.4s both',
          }}
        >
          {isCarl
            ? 'I had the rumblies that only hands could satisfy.'
            : 'That kills people, Carl!'}
        </p>

        {/* World name */}
        <p
          className="font-serif italic"
          style={{
            fontSize: 13,
            color: 'var(--color-hud-muted)',
            marginBottom: 16,
            animation: 'count-up 0.6s ease-out 1.6s both',
          }}
        >
          The {worldSeed?.adjective1} {worldSeed?.adjective2} {worldSeed?.noun} will never be the same.
        </p>

        {/* Divider */}
        <div
          style={{
            height: 1,
            margin: '16px auto',
            width: '60%',
            background: `linear-gradient(to right, transparent, ${accent}40, transparent)`,
            animation: 'count-up 0.4s ease-out 1.8s both',
          }}
        />

        {/* Statistics Panel */}
        <div
          style={{ animation: 'count-up 0.6s ease-out 2.0s both' }}
        >
          <h2
            className="font-serif mb-3"
            style={{ fontSize: 16, color: accent, textTransform: 'uppercase', letterSpacing: '0.15em' }}
          >
            Run Statistics
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginBottom: 20,
            }}
          >
            <StatCard label="Play Time" value={formatTime(playTimeSeconds)} accent={accent} />
            <StatCard label="Rooms" value={`${roomsExplored}/${totalRooms}`} accent={accent} />
            <StatCard label="Items" value={`${itemsCollected}/${totalItems}`} accent={accent} />
            <StatCard label="Story Beats" value={`${beatsTriggered}/${totalBeats}`} accent={accent} />
            <StatCard label="Horror Peak" value={`${horrorPeak}/10`} accent={accent} />
            <StatCard label="Achievements" value={`${sessionAchievements.length}`} accent={accent} icon="+" />
          </div>
        </div>

        {/* Epilogue */}
        <div
          style={{ animation: 'count-up 0.6s ease-out 2.4s both' }}
        >
          <div
            style={{
              height: 1,
              margin: '16px auto',
              width: '40%',
              background: `linear-gradient(to right, transparent, ${accent}30, transparent)`,
            }}
          />
          <h2
            className="font-serif mb-3"
            style={{ fontSize: 16, color: accent, textTransform: 'uppercase', letterSpacing: '0.15em' }}
          >
            Epilogue
          </h2>
          <div style={{ minHeight: 120, marginBottom: 16 }}>
            {epilogue.slice(0, revealedLines).map((line, i) => (
              <p
                key={i}
                className="font-serif italic"
                style={{
                  fontSize: 13,
                  color: 'var(--color-hud-text)',
                  lineHeight: 1.7,
                  marginBottom: 8,
                  opacity: 0,
                  animation: `count-up 0.8s ease-out ${0.1 * i}s both`,
                }}
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Achievements Unlocked This Run */}
        {sessionAchievements.length > 0 && (
          <div style={{ animation: 'count-up 0.6s ease-out 3.0s both' }}>
            <div
              style={{
                height: 1,
                margin: '16px auto',
                width: '40%',
                background: `linear-gradient(to right, transparent, #ffd70040, transparent)`,
              }}
            />
            <h2
              className="font-serif mb-3"
              style={{ fontSize: 16, color: '#ffd700', textTransform: 'uppercase', letterSpacing: '0.15em' }}
            >
              Achievements Unlocked
            </h2>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 20,
              }}
            >
              {sessionAchievements.map((achievement, i) => (
                <div
                  key={achievement.id}
                  style={{
                    background: 'rgba(255, 215, 0, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: 0,
                    animation: `count-up 0.5s ease-out ${0.15 * i}s both`,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{achievement.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 12, color: '#ffd700', fontWeight: 600 }}>{achievement.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--color-hud-muted)' }}>{achievement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Return button */}
        <div style={{ animation: 'count-up 0.6s ease-out 3.4s both' }}>
          <button
            onClick={() => { getAudioManager().playSound(SoundEffects.UI_CLICK); onReturnToMenu(); }}
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
              getAudioManager().playSound(SoundEffects.UI_HOVER);
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

// ---------------------------------------------------------------------------
// Stat Card Component
// ---------------------------------------------------------------------------

/** Ease-out cubic: fast start, slow finish */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * AnimatedNumber — counts from 0 to `target` over `duration` ms.
 * Handles integer targets only; formatted values (time/ratios) use AnimatedValue instead.
 */
const AnimatedNumber: React.FC<{ target: number; duration?: number; pad?: number }> = ({ target, duration = 1500, pad }) => {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }
    startRef.current = null;

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setDisplay(Math.round(easeOutCubic(progress) * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  const str = pad ? String(display).padStart(pad, '0') : String(display);
  return <>{str}</>;
};

const StatCard: React.FC<{
  label: string;
  value: string;
  accent: string;
  icon?: string;
}> = ({ label, value, accent, icon }) => {
  // Parse "X/Y" fraction format
  const fractionMatch = value.match(/^(\d+)\/(\d+)$/);
  // Parse "M:SS" time format
  const timeMatch = value.match(/^(\d+):(\d{2})$/);

  return (
    <div
      style={{
        background: 'rgba(10, 10, 12, 0.6)',
        border: `1px solid ${accent}30`,
        borderRadius: 8,
        padding: '10px 8px',
      }}
    >
      <p style={{ fontSize: 18, color: accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {icon && <span style={{ fontSize: 12, verticalAlign: 'super' }}>{icon}</span>}
        {fractionMatch ? (
          <>
            <AnimatedNumber target={parseInt(fractionMatch[1])} />
            /{fractionMatch[2]}
          </>
        ) : timeMatch ? (
          <>
            <AnimatedNumber target={parseInt(timeMatch[1])} duration={1000} />
            :<AnimatedNumber target={parseInt(timeMatch[2])} duration={1000} pad={2} />
          </>
        ) : (
          value
        )}
      </p>
      <p style={{ fontSize: 10, color: 'var(--color-hud-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </p>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { getAudioManager, SoundEffects } from '../../../systems/AudioManager';

interface DialogueBoxProps {
  speaker: 'carl' | 'paul';
  text: string;
  isLast: boolean;
  onAdvance: () => void;
  isCompact: boolean;
}

/* Characters that trigger a longer dramatic pause. */
const PUNCTUATION_SLOW = new Set(['.', '!', '?']);
const PUNCTUATION_MED = new Set([',', '\u2014']);

const CHAR_SPEED = 30;
const SLOW_PAUSE = 80;
const MED_PAUSE = 50;

/**
 * Cinematic dialogue box with character-by-character text reveal.
 *
 * Each letter crystallises from a 4px blur into sharp focus as it appears,
 * with longer pauses after punctuation for dramatic cadence. The entire
 * animation is driven by pure CSS transitions and a setTimeout chain.
 */
export const DialogueBox: React.FC<DialogueBoxProps> = ({
  speaker,
  text,
  isLast,
  onAdvance,
  isCompact,
}) => {
  const [revealedCount, setRevealedCount] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalChars = text.length;

  /* ── Cleanup helper ── */
  const clearPending = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /* Reset the reveal counter whenever the text prop changes. */
  useEffect(() => {
    clearPending();
    setRevealedCount(0);
  }, [text, clearPending]);

  /* Drive the character-by-character reveal chain. */
  useEffect(() => {
    if (revealedCount >= totalChars) return;

    const prevChar = revealedCount > 0 ? text[revealedCount - 1] : null;
    let delay = CHAR_SPEED;
    if (prevChar !== null) {
      if (PUNCTUATION_SLOW.has(prevChar)) delay = SLOW_PAUSE;
      else if (PUNCTUATION_MED.has(prevChar)) delay = MED_PAUSE;
    }

    timeoutRef.current = setTimeout(() => {
      setRevealedCount((c) => {
        // Play blip every 3rd visible character for typewriter cadence
        if ((c + 1) % 3 === 0 && text[c] !== ' ') {
          getAudioManager().playSound(SoundEffects.DIALOGUE_BLIP, { volume: 0.15 });
        }
        return c + 1;
      });
    }, delay);

    return clearPending;
  }, [revealedCount, totalChars, text, clearPending]);

  /* Unmount cleanup. */
  useEffect(() => clearPending, [clearPending]);

  const isCarlSpeaker = speaker === 'carl';
  const speakerLabel = isCarlSpeaker ? 'Carl' : 'Paul';

  /*
   * Speaker-specific CSS custom-property values.
   * --speaker-color drives the border, badge glow, and prompt glow so we
   * keep a single source of truth per speaker.
   */
  const speakerColor = isCarlSpeaker
    ? 'var(--color-carl)'
    : 'var(--color-paul)';

  return (
    <div
      className="absolute inset-x-0 bottom-0 pointer-events-auto z-40"
      onClick={() => { getAudioManager().playSound(SoundEffects.UI_CLICK); onAdvance(); }}
      style={{ animation: 'dialogue-slide-up 350ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
    >
      {/* Gradient vignette above the box */}
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background: 'linear-gradient(to bottom, transparent, var(--color-void))',
        }}
      />

      {/* Main dialogue panel */}
      <div
        className={clsx(
          'relative border-t-2 backdrop-blur-sm',
          isCompact ? 'p-4' : 'p-6',
        )}
        style={{
          background: 'linear-gradient(to bottom, var(--color-hud-bg), var(--color-void))',
          borderColor: speakerColor,
        }}
      >
        {/* Speaker badge with glow */}
        <div
          className="absolute -top-4 left-4 px-3 py-1 rounded-full font-serif font-bold"
          style={{
            backgroundColor: speakerColor,
            color: 'var(--color-void)',
            boxShadow: `0 0 8px ${speakerColor}, 0 0 20px ${speakerColor}`,
          }}
        >
          {speakerLabel}
        </div>

        {/* Character-by-character text reveal */}
        <p
          className={clsx(
            'leading-relaxed mt-2',
            isCompact ? 'text-sm' : 'text-base',
          )}
          style={{ color: 'var(--color-hud-text)' }}
        >
          {text.split('').map((char, i) => {
            const isJustRevealed = i === revealedCount - 1;
            const isHidden = i >= revealedCount;

            return (
              <span
                key={`${i}-${char}`}
                style={{
                  visibility: isHidden ? 'hidden' : 'visible',
                  filter: isJustRevealed ? 'blur(4px)' : 'blur(0)',
                  opacity: isJustRevealed ? 0.3 : isHidden ? 0 : 1,
                  transition: 'filter 150ms ease-out, opacity 150ms ease-out',
                }}
              >
                {char}
              </span>
            );
          })}
        </p>

        {/* Pulsing continue / close prompt */}
        <div
          className="absolute bottom-2 right-4 text-xs"
          style={{
            color: 'var(--color-hud-muted)',
            animation: 'dialogue-prompt-glow 2s ease-in-out infinite',
            textShadow: `0 0 6px ${speakerColor}`,
          }}
        >
          {isLast ? 'Click to close' : 'Click to continue'}
        </div>
      </div>
    </div>
  );
};

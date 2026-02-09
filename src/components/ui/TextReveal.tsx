import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TextRevealProps {
  /** The text to reveal character-by-character. */
  text: string;
  /** Milliseconds per character (default 30). */
  speed?: number;
  /** Milliseconds for the pause after punctuation characters (default 80). */
  dramaticSpeed?: number;
  /** Additional CSS class applied to the container span. */
  className?: string;
  /** Called once all characters have been revealed. */
  onComplete?: () => void;
  /** When true, start revealing. Transitioning from false to true resets and replays. */
  trigger?: boolean;
  /** When true, skip animation and show all text immediately. */
  instant?: boolean;
}

/** Punctuation characters that trigger the slower dramatic delay. */
const DRAMATIC_CHARS = new Set(['.', '!', '?', ',', '\u2014']);

/**
 * Cinematic text-reveal component.
 *
 * Each character crystallises from a 4 px blur into sharp focus as it appears,
 * with a longer pause after punctuation for dramatic cadence. The entire
 * animation is driven by pure CSS transitions and a `setTimeout` chain --
 * no motion library required.
 */
export const TextReveal: React.FC<TextRevealProps> = ({
  text,
  speed = 30,
  dramaticSpeed = 80,
  className,
  onComplete,
  trigger = true,
  instant = false,
}) => {
  const [revealedCount, setRevealedCount] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const totalChars = text.length;

  // Keep the callback ref up to date without re-triggering effects.
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Clear any running timeout.
  const clearPending = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Reset when `text` or `trigger` changes.
  useEffect(() => {
    clearPending();
    setRevealedCount(0);
  }, [text, trigger, clearPending]);

  // Drive the reveal chain.
  useEffect(() => {
    // Nothing to do when paused, instant, or already done.
    if (!trigger || instant) return;
    if (revealedCount >= totalChars) {
      if (revealedCount > 0) onCompleteRef.current?.();
      return;
    }

    // Determine delay: use dramatic speed if the character we just revealed
    // (the one at revealedCount - 1) is punctuation, otherwise normal speed.
    // On the very first tick (revealedCount === 0) use normal speed.
    const prevChar = revealedCount > 0 ? text[revealedCount - 1] : null;
    const delay = prevChar !== null && DRAMATIC_CHARS.has(prevChar)
      ? dramaticSpeed
      : speed;

    timeoutRef.current = setTimeout(() => {
      setRevealedCount(c => c + 1);
    }, delay);

    return clearPending;
  }, [revealedCount, trigger, instant, totalChars, text, speed, dramaticSpeed, clearPending]);

  // When instant, fire onComplete immediately (once).
  useEffect(() => {
    if (instant && trigger && totalChars > 0) {
      onCompleteRef.current?.();
    }
  }, [instant, trigger, totalChars]);

  // Determine the effective count for rendering.
  const visibleCount = instant ? totalChars : revealedCount;

  return (
    <span className={className}>
      {text.split('').map((char, i) => {
        const isJustRevealed = !instant && i === visibleCount - 1;
        const isHidden = i >= visibleCount;

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
    </span>
  );
};

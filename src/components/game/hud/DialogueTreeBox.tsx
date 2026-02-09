import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import type { NpcDialogueTree } from '../../../systems/StoryManager';
import { getAudioManager, SoundEffects } from '../../../systems/AudioManager';

interface DialogueTreeBoxProps {
  tree: NpcDialogueTree;
  nodeId: string;
  lineIndex: number;
  showOptions: boolean;
  onAdvanceLine: () => void;
  onSelectOption: (nextNodeId: string) => void;
  isCompact: boolean;
}

// ---------------------------------------------------------------------------
// Typewriter constants — match DialogueBox cadence
// ---------------------------------------------------------------------------

const PUNCTUATION_SLOW = new Set(['.', '!', '?']);
const PUNCTUATION_MED = new Set([',', '\u2014']);
const CHAR_SPEED = 30;
const SLOW_PAUSE = 80;
const MED_PAUSE = 50;

// ---------------------------------------------------------------------------
// DialogueTreeBox
// ---------------------------------------------------------------------------

export const DialogueTreeBox: React.FC<DialogueTreeBoxProps> = ({
  tree, nodeId, lineIndex, showOptions, onAdvanceLine, onSelectOption, isCompact,
}) => {
  const node = tree.tree[nodeId];
  if (!node) return null;

  const line = node.lines[lineIndex];
  if (!line && !showOptions) return null;

  const isCarlSpeaker = line?.speaker === 'carl';
  const speakerColor = isCarlSpeaker ? 'var(--color-carl)' : 'var(--color-paul)';
  const speakerNameMap: Record<string, string | null> = { narrator: null, carl: 'Carl', paul: 'Paul' };
  const speakerName = speakerNameMap[line?.speaker ?? ''] ?? 'Paul';

  return (
    <div
      className="absolute inset-x-0 bottom-0 pointer-events-auto z-40"
      style={{ animation: 'dialogue-slide-up 350ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
    >
      {/* Gradient vignette above the box */}
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--color-void))' }}
      />

      {/* Main dialogue panel */}
      <div
        className={clsx('relative border-t-2 backdrop-blur-sm', isCompact ? 'p-4' : 'p-6')}
        style={{
          background: 'linear-gradient(to bottom, var(--color-hud-bg), var(--color-void))',
          borderColor: speakerColor,
        }}
      >
        {/* Speaker badge with glow */}
        {speakerName && (
          <div
            className="absolute -top-4 left-4 px-3 py-1 rounded-full font-serif font-bold"
            style={{
              backgroundColor: speakerColor,
              color: 'var(--color-void)',
              boxShadow: `0 0 8px ${speakerColor}, 0 0 20px ${speakerColor}`,
            }}
          >
            {speakerName}
          </div>
        )}

        {/* Current line — character-by-character text reveal */}
        {!showOptions && line && (
          <TreeLineReveal
            text={line.text}
            onAdvance={onAdvanceLine}
            isCompact={isCompact}
            speakerColor={speakerColor}
          />
        )}

        {/* Options — glow-border cards after all lines in a node */}
        {showOptions && node.options.length > 0 && (
          <div className="mt-2 space-y-2">
            {node.options.map((option, i) => (
              <TreeOptionCard
                key={option.next}
                text={option.text}
                index={i}
                isCompact={isCompact}
                speakerColor={speakerColor}
                onClick={() => onSelectOption(option.next)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TreeLineReveal — character-by-character typewriter matching DialogueBox
// ---------------------------------------------------------------------------

const TreeLineReveal: React.FC<{
  text: string;
  onAdvance: () => void;
  isCompact: boolean;
  speakerColor: string;
}> = ({ text, onAdvance, isCompact, speakerColor }) => {
  const [revealedCount, setRevealedCount] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearPending();
    setRevealedCount(0);
  }, [text, clearPending]);

  useEffect(() => {
    if (revealedCount >= text.length) return;

    const prevChar = revealedCount > 0 ? text[revealedCount - 1] : null;
    let delay = CHAR_SPEED;
    if (prevChar !== null) {
      if (PUNCTUATION_SLOW.has(prevChar)) delay = SLOW_PAUSE;
      else if (PUNCTUATION_MED.has(prevChar)) delay = MED_PAUSE;
    }

    timeoutRef.current = setTimeout(() => {
      setRevealedCount((c) => {
        if ((c + 1) % 3 === 0 && text[c] !== ' ') {
          getAudioManager().playSound(SoundEffects.DIALOGUE_BLIP, { volume: 0.15 });
        }
        return c + 1;
      });
    }, delay);

    return clearPending;
  }, [revealedCount, text, clearPending]);

  useEffect(() => clearPending, [clearPending]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { getAudioManager().playSound(SoundEffects.UI_CLICK); onAdvance(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { getAudioManager().playSound(SoundEffects.UI_CLICK); onAdvance(); } }}
      className="cursor-pointer"
    >
      <p
        className={clsx('leading-relaxed mt-2', isCompact ? 'text-sm' : 'text-base')}
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

      <div
        className="absolute bottom-2 right-4 text-xs"
        style={{
          color: 'var(--color-hud-muted)',
          animation: 'dialogue-prompt-glow 2s ease-in-out infinite',
          textShadow: `0 0 6px ${speakerColor}`,
        }}
      >
        Click to continue
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TreeOptionCard — hover-glow dialogue option
// ---------------------------------------------------------------------------

const TreeOptionCard: React.FC<{
  text: string;
  index: number;
  isCompact: boolean;
  speakerColor: string;
  onClick: () => void;
}> = ({ text, index, isCompact, speakerColor, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={() => { getAudioManager().playSound(SoundEffects.UI_CLICK); onClick(); }}
      onMouseEnter={() => { setIsHovered(true); getAudioManager().playSound(SoundEffects.UI_HOVER); }}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => { setIsHovered(true); getAudioManager().playSound(SoundEffects.UI_HOVER); }}
      onBlur={() => setIsHovered(false)}
      className={clsx(
        'w-full text-left px-4 py-2 rounded-lg border transition-all cursor-pointer',
        isCompact ? 'text-sm' : 'text-base',
      )}
      style={{
        background: isHovered ? 'rgba(255,255,255,0.06)' : 'rgba(10, 10, 12, 0.6)',
        borderColor: isHovered ? speakerColor : 'var(--color-hud-border)',
        color: isHovered ? '#ffffff' : 'var(--color-hud-text)',
        boxShadow: isHovered ? `0 0 10px ${speakerColor}40, inset 0 0 10px ${speakerColor}10` : 'none',
        animation: `quest-goal-in 0.3s ease-out ${0.08 * index}s both`,
      }}
    >
      {text}
    </button>
  );
};

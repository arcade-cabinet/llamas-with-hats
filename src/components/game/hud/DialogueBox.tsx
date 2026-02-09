import React from 'react';
import { clsx } from 'clsx';

interface DialogueBoxProps {
  speaker: 'carl' | 'paul';
  text: string;
  isLast: boolean;
  onAdvance: () => void;
  isCompact: boolean;
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({ speaker, text, isLast, onAdvance, isCompact }) => (
  <div
    className="absolute inset-x-0 bottom-0 pointer-events-auto z-40"
    onClick={onAdvance}
  >
    {/* Darkened background above dialogue */}
    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-transparent to-black/60" />

    {/* Dialogue container */}
    <div className={clsx(
      'relative bg-shadow-light border-t-2',
      speaker === 'carl' ? 'border-carl' : 'border-paul',
      isCompact ? 'p-4' : 'p-6'
    )}>
      {/* Speaker name */}
      <div className={clsx(
        'absolute -top-4 left-4 px-3 py-1 rounded-full font-serif font-bold',
        speaker === 'carl'
          ? 'bg-carl text-shadow'
          : 'bg-paul text-shadow'
      )}>
        {speaker === 'carl' ? 'Carl' : 'Paul'}
      </div>

      {/* Dialogue text */}
      <p className={clsx(
        'text-gray-200 leading-relaxed mt-2',
        isCompact ? 'text-sm' : 'text-base'
      )}>
        {text}
      </p>

      {/* Continue prompt */}
      <div className="absolute bottom-2 right-4 text-gray-500 text-xs animate-pulse">
        {isLast ? 'Click to close' : 'Click to continue'}
      </div>
    </div>
  </div>
);

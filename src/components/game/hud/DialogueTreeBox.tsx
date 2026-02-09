import React from 'react';
import { clsx } from 'clsx';
import type { NpcDialogueTree } from '../../../systems/StoryManager';

interface DialogueTreeBoxProps {
  tree: NpcDialogueTree;
  nodeId: string;
  lineIndex: number;
  showOptions: boolean;
  onAdvanceLine: () => void;
  onSelectOption: (nextNodeId: string) => void;
  isCompact: boolean;
}

export const DialogueTreeBox: React.FC<DialogueTreeBoxProps> = ({
  tree, nodeId, lineIndex, showOptions, onAdvanceLine, onSelectOption, isCompact,
}) => {
  const node = tree.tree[nodeId];
  if (!node) return null;

  const line = node.lines[lineIndex];
  if (!line && !showOptions) return null;

  const speakerColor = line?.speaker === 'carl' ? 'border-carl' : 'border-paul';
  const speakerBg = line?.speaker === 'carl' ? 'bg-carl' : 'bg-paul';
  const speakerNameMap: Record<string, string | null> = { narrator: null, carl: 'Carl', paul: 'Paul' };
  const speakerName = speakerNameMap[line?.speaker ?? ''] ?? 'Paul';

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-auto z-40">
      {/* Darkened background above dialogue */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-transparent to-black/60" />

      {/* Dialogue container */}
      <div className={clsx(
        'relative bg-shadow-light border-t-2',
        speakerColor,
        isCompact ? 'p-4' : 'p-6'
      )}>
        {/* Speaker name */}
        {speakerName && (
          <div className={clsx(
            'absolute -top-4 left-4 px-3 py-1 rounded-full font-serif font-bold',
            speakerBg, 'text-shadow'
          )}>
            {speakerName}
          </div>
        )}

        {/* Show current line text, or options */}
        {!showOptions && line && (
          <div
            role="button"
            tabIndex={0}
            onClick={onAdvanceLine}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAdvanceLine(); }}
            className="cursor-pointer"
          >
            <p className={clsx(
              'text-gray-200 leading-relaxed mt-2',
              isCompact ? 'text-sm' : 'text-base'
            )}>
              {line.text}
            </p>
            <div className="absolute bottom-2 right-4 text-gray-500 text-xs animate-pulse">
              Click to continue
            </div>
          </div>
        )}

        {/* Options — shown after all lines in a node have been read */}
        {showOptions && node.options.length > 0 && (
          <div className="mt-2 space-y-2">
            {node.options.map((option) => (
              <button
                key={option.next}
                onClick={() => onSelectOption(option.next)}
                className={clsx(
                  'w-full text-left px-4 py-2 rounded-lg border transition-colors',
                  'border-wood-dark/50 bg-shadow hover:bg-wood/20 hover:border-wood',
                  'text-gray-300 hover:text-white',
                  isCompact ? 'text-sm' : 'text-base'
                )}
              >
                {option.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

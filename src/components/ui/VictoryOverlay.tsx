import React from 'react';
import type { CharacterType, WorldSeed } from '../../types/game';

interface VictoryOverlayProps {
  selectedCharacter: CharacterType;
  worldSeed: WorldSeed | null;
  onReturnToMenu: () => void;
}

export const VictoryOverlay: React.FC<VictoryOverlayProps> = ({
  selectedCharacter, worldSeed, onReturnToMenu,
}) => (
  <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-8">
    <div className="text-center max-w-lg">
      <h1 className="text-4xl md:text-6xl font-serif text-blood mb-6">
        {selectedCharacter === 'carl' ? 'CAAAAARL!' : 'Oh hey Paul.'}
      </h1>
      <p className="text-xl text-wood mb-4 font-serif">
        {selectedCharacter === 'carl'
          ? 'I had the rumblies that only hands could satisfy.'
          : 'That kills people, Carl!'}
      </p>
      <div className="border-t border-wood/30 my-6" />
      <p className="text-gray-400 mb-2">
        {selectedCharacter === 'carl'
          ? 'You embraced Carl\'s ecstatic artistry across all three stages.'
          : 'You navigated Paul through Carl\'s escalating madness and lived to tell the tale.'}
      </p>
      <p className="text-gray-500 text-sm mb-2">
        The {worldSeed?.adjective1} {worldSeed?.adjective2} {worldSeed?.noun} will never be the same.
      </p>
      <p className="text-gray-600 text-xs mb-8">
        All three stages complete
      </p>
      <div className="flex flex-col gap-3 items-center">
        <button
          onClick={onReturnToMenu}
          className="px-8 py-3 bg-wood/20 hover:bg-wood/40 text-wood border border-wood/50 rounded-lg font-serif transition-colors"
        >
          Return to Main Menu
        </button>
      </div>
    </div>
  </div>
);

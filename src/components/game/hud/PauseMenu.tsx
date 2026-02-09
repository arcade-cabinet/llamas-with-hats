import React from 'react';
import { clsx } from 'clsx';

interface PauseMenuProps {
  onResume: () => void;
  onSave: () => void;
  onMainMenu: () => void;
  isCompact: boolean;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onSave, onMainMenu, isCompact }) => (
  <div className="absolute inset-0 bg-black/85 flex items-center justify-center pointer-events-auto z-50">
    <div className={clsx(
      'bg-gradient-to-br from-shadow-light to-shadow border-2 border-wood-dark/50 rounded-xl',
      isCompact ? 'p-4 w-64' : 'p-6 w-80'
    )}>
      <h2 className="text-wood font-serif text-2xl text-center mb-6">Paused</h2>

      <div className="space-y-3">
        <button
          onClick={onResume}
          className="w-full py-3 bg-shadow border border-wood-dark/50 rounded-lg text-gray-300 hover:text-white hover:border-wood transition-colors"
        >
          Resume
        </button>
        <button
          onClick={onSave}
          className="w-full py-3 bg-shadow border border-wood-dark/50 rounded-lg text-gray-300 hover:text-white hover:border-wood transition-colors"
        >
          Save Game
        </button>
        <button
          onClick={onMainMenu}
          className="w-full py-3 bg-blood/30 border border-blood/50 rounded-lg text-gray-300 hover:text-white hover:border-blood transition-colors"
        >
          Main Menu
        </button>
      </div>
    </div>
  </div>
);

/**
 * Menu Overlay
 * ============
 * 
 * Overlay UI that appears on top of the game scene.
 * The 3D scene is always visible (dimmed) underneath.
 * 
 * States:
 * - main: New Game / Continue / Settings buttons
 * - newGame: Character selection + world seed
 * - loadGame: Save file list
 * - settings: Volume sliders, toggles
 */

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { CharacterType, WorldSeed, MenuScreen, SavedGame, GameSettings } from '../../types/game';
import { parseWorldSeed } from '../../utils/worldGenerator';
import { DeviceType } from '../../hooks/useDeviceInfo';

interface MenuOverlayProps {
  currentScreen: MenuScreen;
  onNavigate: (screen: MenuScreen) => void;
  
  // Game data
  savedGames: SavedGame[];
  settings: GameSettings;
  
  // Character selection
  selectedCharacter: CharacterType | null;
  onSelectCharacter: (char: CharacterType) => void;
  
  // World seed
  worldSeed: WorldSeed | null;
  onSetWorldSeed: (seed: WorldSeed) => void;
  onShuffleSeed: () => void;
  
  // Actions
  onStartGame: () => void;
  onLoadGame: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  
  // Device
  deviceType: DeviceType;
}

export const MenuOverlay: React.FC<MenuOverlayProps> = ({
  currentScreen,
  onNavigate,
  savedGames,
  settings,
  selectedCharacter,
  onSelectCharacter,
  worldSeed,
  onSetWorldSeed,
  onShuffleSeed,
  onStartGame,
  onLoadGame,
  onDeleteSave,
  onUpdateSettings,
  deviceType
}) => {
  const isCompact = deviceType === 'phone' || deviceType === 'foldable-folded';
  const hasSaves = savedGames.length > 0;
  
  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      {/* Dim overlay - darkens the game scene underneath */}
      <div className="absolute inset-0 bg-black/75 pointer-events-auto" />
      
      {/* Content container */}
      <div className={clsx(
        'absolute inset-0 flex flex-col items-center justify-center',
        'pointer-events-none'
      )}>
        {/* Title - always visible */}
        <div className={clsx(
          'text-center pointer-events-auto mb-8',
          isCompact ? 'mb-4' : 'mb-8'
        )}>
          <h1 className={clsx(
            'font-serif font-bold leading-tight',
            isCompact ? 'text-3xl' : 'text-5xl'
          )}>
            <span className="text-wood tracking-widest drop-shadow-lg">LLAMAS</span>
            <span className={clsx(
              'mx-3 text-gray-500 italic',
              isCompact ? 'text-lg' : 'text-2xl'
            )}>with</span>
            <span className="text-blood tracking-[0.2em] drop-shadow-lg">HATS</span>
          </h1>
          <p className={clsx(
            'text-gray-500 mt-2',
            isCompact ? 'text-xs' : 'text-sm'
          )}>
            A Dark Comedy RPG
          </p>
        </div>
        
        {/* Menu panel */}
        <div className={clsx(
          'pointer-events-auto',
          'bg-gradient-to-br from-shadow-light/95 to-shadow/95',
          'border-2 border-wood-dark/50 rounded-2xl shadow-2xl',
          'backdrop-blur-sm',
          isCompact ? 'w-80 p-4' : 'w-96 p-6'
        )}>
          {currentScreen === 'main' && (
            <MainMenuPanel
              hasSaves={hasSaves}
              isCompact={isCompact}
              onNewGame={() => onNavigate('newGame')}
              onContinue={() => onNavigate('loadGame')}
              onSettings={() => onNavigate('settings')}
            />
          )}
          
          {currentScreen === 'newGame' && (
            <NewGamePanel
              selectedCharacter={selectedCharacter}
              onSelectCharacter={onSelectCharacter}
              worldSeed={worldSeed}
              onSetWorldSeed={onSetWorldSeed}
              onShuffleSeed={onShuffleSeed}
              onBack={() => onNavigate('main')}
              onStart={onStartGame}
              isCompact={isCompact}
            />
          )}
          
          {currentScreen === 'loadGame' && (
            <LoadGamePanel
              savedGames={savedGames}
              onLoad={onLoadGame}
              onDelete={onDeleteSave}
              onBack={() => onNavigate('main')}
              isCompact={isCompact}
            />
          )}
          
          {currentScreen === 'settings' && (
            <SettingsPanel
              settings={settings}
              onUpdate={onUpdateSettings}
              onBack={() => onNavigate('main')}
              isCompact={isCompact}
            />
          )}
        </div>
        
        {/* Warning text */}
        {currentScreen === 'main' && (
          <p className={clsx(
            'text-center text-gray-600 max-w-sm pointer-events-auto mt-6',
            isCompact ? 'text-xs px-4' : 'text-sm'
          )}>
            Warning: Contains absurdist dark comedy and questionable life choices by llamas.
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================
// Panel Components
// ============================================

const MainMenuPanel: React.FC<{
  hasSaves: boolean;
  isCompact: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onSettings: () => void;
}> = ({ hasSaves, isCompact: _isCompact, onNewGame, onContinue, onSettings }) => (
  <div className="flex flex-col gap-3">
    <MenuButton onClick={onNewGame} primary>
      New Game
    </MenuButton>
    <MenuButton onClick={onContinue} disabled={!hasSaves}>
      Continue
      {!hasSaves && (
        <span className="block text-xs text-gray-600 mt-1 normal-case font-normal">
          No saved games
        </span>
      )}
    </MenuButton>
    <MenuButton onClick={onSettings}>
      Settings
    </MenuButton>
  </div>
);

const NewGamePanel: React.FC<{
  selectedCharacter: CharacterType | null;
  onSelectCharacter: (char: CharacterType) => void;
  worldSeed: WorldSeed | null;
  onSetWorldSeed: (seed: WorldSeed) => void;
  onShuffleSeed: () => void;
  onBack: () => void;
  onStart: () => void;
  isCompact: boolean;
}> = ({ selectedCharacter, onSelectCharacter, worldSeed, onSetWorldSeed, onShuffleSeed, onBack, onStart, isCompact: _isCompact }) => {
  const [seedInput, setSeedInput] = useState('');
  const [seedValid, setSeedValid] = useState(true);
  
  useEffect(() => {
    if (!worldSeed) {
      onShuffleSeed();
    }
  }, []);
  
  useEffect(() => {
    if (worldSeed) {
      setSeedInput(worldSeed.seedString);
      setSeedValid(true);
    }
  }, [worldSeed]);
  
  const handleSeedChange = (value: string) => {
    setSeedInput(value);
    const parsed = parseWorldSeed(value);
    if (parsed) {
      setSeedValid(true);
      onSetWorldSeed(parsed);
    } else {
      setSeedValid(false);
    }
  };
  
  const canStart = selectedCharacter && worldSeed;
  
  return (
    <div className="space-y-5">
      <h2 className="text-wood font-serif text-center text-xl">Choose Your Llama</h2>
      
      {/* Character selection */}
      <div className="flex justify-center gap-4">
        <CharacterButton
          name="Carl"
          description="Order path"
          selected={selectedCharacter === 'carl'}
          onClick={() => onSelectCharacter('carl')}
          color="carl"
        />
        <CharacterButton
          name="Paul"
          description="Chaos path"
          selected={selectedCharacter === 'paul'}
          onClick={() => onSelectCharacter('paul')}
          color="paul"
        />
      </div>
      
      {/* World seed */}
      <div>
        <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">World Seed</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={seedInput}
            onChange={(e) => handleSeedChange(e.target.value)}
            className={clsx(
              'flex-1 px-3 py-2 bg-shadow border-2 rounded-lg text-center font-serif text-white',
              seedValid ? 'border-wood-dark/50 focus:border-wood' : 'border-red-800'
            )}
            placeholder="Enter seed..."
          />
          <button
            onClick={onShuffleSeed}
            className="px-4 py-2 bg-shadow border-2 border-wood-dark/50 rounded-lg text-wood hover:border-wood hover:text-white transition-colors text-lg"
            title="Shuffle seed"
          >
            ↻
          </button>
        </div>
        {worldSeed && (
          <p className="text-wood font-serif italic text-center mt-2 text-sm">
            The {worldSeed.adjective1} {worldSeed.adjective2} {worldSeed.noun}
          </p>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-shadow border-2 border-wood-dark/50 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onStart}
          disabled={!canStart}
          className={clsx(
            'flex-1 py-3 rounded-lg font-serif text-lg transition-all',
            canStart
              ? 'bg-blood/80 border-2 border-blood text-white hover:bg-blood shadow-lg shadow-blood/30'
              : 'bg-gray-800 border-2 border-gray-700 text-gray-500 cursor-not-allowed'
          )}
        >
          Begin
        </button>
      </div>
    </div>
  );
};

const CharacterButton: React.FC<{
  name: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  color: 'carl' | 'paul';
}> = ({ name, description, selected, onClick, color }) => (
  <button
    onClick={onClick}
    className={clsx(
      'flex flex-col items-center px-6 py-4 rounded-xl border-2 transition-all',
      selected
        ? color === 'carl'
          ? 'border-carl bg-carl/20 text-carl shadow-lg shadow-carl/20'
          : 'border-paul bg-paul/20 text-paul shadow-lg shadow-paul/20'
        : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400'
    )}
  >
    <span className="text-2xl mb-1">{color === 'carl' ? '🎩' : '🌸'}</span>
    <span className="font-serif font-bold">{name}</span>
    <span className="text-xs opacity-70">{description}</span>
  </button>
);

const LoadGamePanel: React.FC<{
  savedGames: SavedGame[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  isCompact: boolean;
}> = ({ savedGames, onLoad, onDelete, onBack, isCompact }) => (
  <div className="space-y-4">
    <h2 className="text-wood font-serif text-center text-xl">Load Game</h2>
    
    <div className={clsx(
      'space-y-2 overflow-y-auto',
      isCompact ? 'max-h-48' : 'max-h-64'
    )}>
      {savedGames.slice().reverse().map(save => (
        <div 
          key={save.id} 
          className="flex items-center justify-between p-3 bg-shadow/50 rounded-lg border border-wood-dark/30"
        >
          <div className="flex-1 min-w-0">
            <p className="text-wood font-medium truncate text-sm">
              {save.worldSeed.adjective1} {save.worldSeed.adjective2} {save.worldSeed.noun}
            </p>
            <p className="text-gray-500 text-xs">
              {save.playerCharacter === 'carl' ? 'Carl' : 'Paul'} · {new Date(save.timestamp).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 ml-2">
            <button 
              onClick={() => onLoad(save.id)} 
              className="px-3 py-1.5 bg-blood/60 rounded text-white text-sm hover:bg-blood transition-colors"
            >
              Load
            </button>
            <button 
              onClick={() => onDelete(save.id)} 
              className="px-2 py-1.5 border border-gray-700 rounded text-gray-500 text-sm hover:text-red-500 hover:border-red-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      {savedGames.length === 0 && (
        <p className="text-center text-gray-600 py-8">No saved games</p>
      )}
    </div>
    
    <button 
      onClick={onBack} 
      className="w-full py-3 bg-shadow border-2 border-wood-dark/50 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
    >
      Back
    </button>
  </div>
);

const SettingsPanel: React.FC<{
  settings: GameSettings;
  onUpdate: (settings: Partial<GameSettings>) => void;
  onBack: () => void;
  isCompact?: boolean;
}> = ({ settings, onUpdate, onBack }) => (
  <div className="space-y-4">
    <h2 className="text-wood font-serif text-center text-xl">Settings</h2>
    
    <div className="space-y-3">
      <SettingSlider 
        label="Music" 
        value={settings.musicVolume} 
        onChange={v => onUpdate({ musicVolume: v })} 
      />
      <SettingSlider 
        label="SFX" 
        value={settings.sfxVolume} 
        onChange={v => onUpdate({ sfxVolume: v })} 
      />
      <SettingToggle 
        label="Minimap" 
        value={settings.showMinimap} 
        onChange={v => onUpdate({ showMinimap: v })} 
      />
    </div>
    
    <button 
      onClick={onBack} 
      className="w-full py-3 bg-shadow border-2 border-wood-dark/50 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
    >
      Back
    </button>
  </div>
);

// ============================================
// UI Components
// ============================================

const MenuButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}> = ({ onClick, children, primary, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'w-full py-3 px-6 rounded-lg font-serif text-lg uppercase tracking-wider',
      'transition-all duration-200 active:scale-[0.98]',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      primary
        ? 'bg-blood/80 border-2 border-blood text-white shadow-lg shadow-blood/30 hover:bg-blood hover:shadow-xl'
        : 'bg-shadow border-2 border-wood-dark/50 text-gray-300 hover:border-wood hover:text-white'
    )}
  >
    {children}
  </button>
);

const SettingSlider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between p-3 bg-shadow/30 rounded-lg">
    <span className="text-gray-400">{label}</span>
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-24 accent-wood"
      />
      <span className="text-wood w-12 text-right">{Math.round(value * 100)}%</span>
    </div>
  </div>
);

const SettingToggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between p-3 bg-shadow/30 rounded-lg">
    <span className="text-gray-400">{label}</span>
    <button
      onClick={() => onChange(!value)}
      className={clsx(
        'px-4 py-1.5 rounded transition-colors',
        value 
          ? 'bg-wood/80 text-white' 
          : 'bg-shadow border border-gray-700 text-gray-500 hover:border-gray-500'
      )}
    >
      {value ? 'ON' : 'OFF'}
    </button>
  </div>
);

export default MenuOverlay;

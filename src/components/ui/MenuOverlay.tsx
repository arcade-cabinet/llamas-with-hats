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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { CharacterType, WorldSeed, MenuScreen, SavedGame, GameSettings } from '../../types/game';
import { parseWorldSeed } from '../../utils/worldGenerator';
import { DeviceType } from '../../hooks/useDeviceInfo';
import { getAchievementSystem } from '../../systems/AchievementSystem';
import { getUnlockableSystem } from '../../systems/UnlockableSystem';
import { getAudioManager } from '../../systems/AudioManager';
import { SoundEffects } from '../../systems/AudioManager';
import { ParticleCanvas } from './ParticleCanvas';

/** Lazy-init audio (user gesture required) and play a UI sound */
function playUI(sfx: string) {
  const audio = getAudioManager();
  if (!audio.isInitialized()) {
    audio.init().catch(() => {});
  }
  audio.playSound(sfx);
}

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
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(10,10,12,0.85) 40%, rgba(26,26,46,0.92) 100%)',
        }}
      />

      {/* Atmospheric particle field (behind all UI) */}
      {currentScreen === 'main' && <ParticleCanvas className="z-0" />}
      
      {/* Content container */}
      <div className={clsx(
        'absolute inset-0 flex flex-col items-center justify-center',
        'pointer-events-none'
      )}>
        {/* Title - always visible, with entrance animation */}
        <div className={clsx(
          'text-center pointer-events-auto mb-8',
          isCompact ? 'mb-4' : 'mb-8'
        )} style={{
          animation: 'title-entrance 0.8s ease-out both',
        }}>
          <h1 className={clsx(
            'font-serif font-bold leading-tight tracking-tighter',
            isCompact ? 'text-4xl' : 'text-6xl'
          )} style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.4) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
          }}>
            LLAMAS<span className={clsx(
              'mx-2 italic font-normal',
              isCompact ? 'text-lg' : 'text-2xl'
            )} style={{
              WebkitTextFillColor: 'rgba(255,255,255,0.25)',
            }}>with</span>HATS
          </h1>
          <p className={clsx(
            'mt-3 uppercase tracking-[0.25em]',
            isCompact ? 'text-[10px]' : 'text-xs'
          )} style={{
            color: 'var(--color-rose)',
            textShadow: '0 0 12px rgba(221,123,187,0.3)',
          }}>
            A Dark Comedy RPG
          </p>
        </div>
        
        {/* Menu panel */}
        <div className={clsx(
          'pointer-events-auto',
          'rounded-2xl shadow-2xl',
          'backdrop-blur-sm',
          isCompact ? 'w-80 p-4' : 'w-96 p-6'
        )} style={{
          background: 'linear-gradient(135deg, rgba(26,26,46,0.95), rgba(10,10,12,0.95))',
          border: '1px solid var(--color-hud-border)',
        }}>
          {currentScreen === 'main' && (
            <MainMenuPanel
              hasSaves={hasSaves}
              isCompact={isCompact}
              onNewGame={() => onNavigate('newGame')}
              onContinue={() => onNavigate('loadGame')}
              onSettings={() => onNavigate('settings')}
              onAchievements={() => onNavigate('achievements')}
              onStats={() => onNavigate('stats')}
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
              onUpdateSettings={onUpdateSettings}
              settings={settings}
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

          {currentScreen === 'achievements' && (
            <AchievementsPanel
              onBack={() => onNavigate('main')}
              isCompact={isCompact}
            />
          )}

          {currentScreen === 'stats' && (
            <StatsPanel
              onBack={() => onNavigate('main')}
              isCompact={isCompact}
            />
          )}
        </div>
        
        {/* Warning text */}
        {currentScreen === 'main' && (
          <p className={clsx(
            'text-center max-w-sm pointer-events-auto mt-6',
            isCompact ? 'text-xs px-4' : 'text-sm'
          )} style={{ color: 'var(--color-hud-muted)', animation: 'flicker 4s linear infinite' }}>
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
  onAchievements: () => void;
  onStats: () => void;
}> = ({ hasSaves, isCompact: _isCompact, onNewGame, onContinue, onSettings, onAchievements, onStats }) => {
  const buttons = [
    { label: 'New Game', onClick: onNewGame, primary: true },
    { label: 'Continue', onClick: onContinue, disabled: !hasSaves, sub: !hasSaves ? 'No saved games' : undefined },
    { label: 'Settings', onClick: onSettings },
    { label: 'Achievements', onClick: onAchievements },
    { label: 'Statistics', onClick: onStats },
  ];

  return (
    <div className="flex flex-col gap-3">
      {buttons.map((btn, i) => (
        <div key={btn.label} style={{
          animation: `menu-btn-entrance 0.4s ease-out ${0.1 + i * 0.06}s both`,
        }}>
          <MenuButton onClick={btn.onClick} primary={btn.primary} disabled={btn.disabled}>
            {btn.label}
            {btn.sub && (
              <span className="block text-xs mt-1 normal-case font-normal" style={{ color: 'var(--color-hud-muted)' }}>
                {btn.sub}
              </span>
            )}
          </MenuButton>
        </div>
      ))}
    </div>
  );
};

const NewGamePanel: React.FC<{
  selectedCharacter: CharacterType | null;
  onSelectCharacter: (char: CharacterType) => void;
  worldSeed: WorldSeed | null;
  onSetWorldSeed: (seed: WorldSeed) => void;
  onShuffleSeed: () => void;
  onBack: () => void;
  onStart: () => void;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  settings: GameSettings;
  isCompact: boolean;
}> = ({ selectedCharacter, onSelectCharacter, worldSeed, onSetWorldSeed, onShuffleSeed, onBack, onStart, onUpdateSettings, settings, isCompact: _isCompact }) => {
  const [seedInput, setSeedInput] = useState('');
  const [seedValid, setSeedValid] = useState(true);
  const unlockables = useMemo(() => getUnlockableSystem().getState(), []);
  
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
    const parsed = parseWorldSeed(value, {
      adjectives: unlockables.bonusAdjectives,
      nouns: unlockables.bonusNouns,
    });
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
      <h2 className="font-serif text-center text-xl" style={{ color: 'var(--color-pumpkin)' }}>Choose Your Llama</h2>
      
      {/* Character selection */}
      <div className="flex justify-center gap-4">
        <CharacterButton
          name="Carl"
          description="Chaos path"
          selected={selectedCharacter === 'carl'}
          onClick={() => onSelectCharacter('carl')}
          color="carl"
        />
        <CharacterButton
          name="Paul"
          description="Order path"
          selected={selectedCharacter === 'paul'}
          onClick={() => onSelectCharacter('paul')}
          color="paul"
        />
      </div>
      
      {/* World seed */}
      <div>
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--color-hud-muted)' }}>World Seed</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={seedInput}
            onChange={(e) => handleSeedChange(e.target.value)}
            className="flex-1 px-3 py-2 border-2 rounded-lg text-center font-serif text-white transition-colors"
            style={{
              background: 'var(--color-shadow)',
              borderColor: seedValid ? 'var(--color-hud-border)' : 'var(--color-crimson)',
              outline: 'none',
            }}
            onFocus={e => { if (seedValid) e.currentTarget.style.borderColor = 'var(--color-pumpkin)'; }}
            onBlur={e => { if (seedValid) e.currentTarget.style.borderColor = 'var(--color-hud-border)'; }}
            placeholder="Enter seed..."
          />
          <button
            onClick={onShuffleSeed}
            className="px-4 py-2 border-2 rounded-lg text-lg transition-colors hover:text-white"
            style={{
              background: 'var(--color-shadow)',
              borderColor: 'var(--color-hud-border)',
              color: 'var(--color-pumpkin)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-pumpkin)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-hud-border)'; }}
            title="Shuffle seed"
          >
            ↻
          </button>
        </div>
        {worldSeed && (
          <p className="font-serif italic text-center mt-2 text-sm" style={{ color: 'var(--color-pumpkin)' }}>
            The {worldSeed.adjective1} {worldSeed.adjective2} {worldSeed.noun}
          </p>
        )}
      </div>

      {/* Difficulty & NG+ (unlockable) */}
      {(unlockables.nightmareUnlocked || unlockables.newGamePlusAvailable) && (
        <div className="space-y-3">
          {unlockables.nightmareUnlocked && (
            <div>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--color-hud-muted)' }}>Difficulty</p>
              <div className="flex gap-2">
                {(['normal', 'nightmare'] as const).map(d => {
                  const active = settings.difficulty === d;
                  const isNightmare = d === 'nightmare';
                  return (
                    <button
                      key={d}
                      onClick={() => onUpdateSettings({ difficulty: d })}
                      className="flex-1 py-2 rounded-lg font-serif text-sm border-2 transition-all capitalize"
                      style={active
                        ? isNightmare
                          ? { borderColor: 'var(--color-crimson)', background: 'rgba(244,63,94,0.15)', color: 'var(--color-crimson)', boxShadow: '0 0 12px rgba(244,63,94,0.15)' }
                          : { borderColor: 'var(--color-pumpkin)', background: 'rgba(245,129,12,0.15)', color: 'var(--color-pumpkin)' }
                        : { borderColor: 'rgba(255,255,255,0.1)', color: 'var(--color-hud-muted)' }
                      }
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              {settings.difficulty === 'nightmare' && (
                <p className="text-xs text-center mt-1 italic" style={{ color: 'rgba(244,63,94,0.7)' }}>All rooms horror 7+. Carl is relentless.</p>
              )}
            </div>
          )}

          {unlockables.newGamePlusAvailable && (
            <SettingToggle
              label="New Game+"
              value={settings.showTimer}
              onChange={v => onUpdateSettings({ showTimer: v })}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => { playUI(SoundEffects.UI_BACK); onBack(); }}
          className="flex-1 py-3 border-2 rounded-lg transition-colors hover:text-white"
          style={{
            background: 'rgba(10,10,12,0.6)',
            borderColor: 'var(--color-hud-border)',
            color: 'var(--color-hud-muted)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-hud-border)'; }}
        >
          Back
        </button>
        <button
          onClick={() => { if (canStart) playUI(SoundEffects.UI_CLICK); onStart(); }}
          disabled={!canStart}
          className="flex-1 py-3 rounded-lg font-serif text-lg border-2 transition-all disabled:cursor-not-allowed"
          style={canStart
            ? { background: 'linear-gradient(135deg, #8B0000, #4a0000)', borderColor: 'var(--color-blood)', color: '#fff', boxShadow: '0 0 16px rgba(139,0,0,0.3)' }
            : { background: 'rgba(20,20,20,0.8)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--color-hud-muted)' }
          }
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
}> = ({ name, description, selected, onClick, color }) => {
  const charColor = color === 'carl' ? 'var(--color-pumpkin)' : 'var(--color-teal)';
  const charRgb = color === 'carl' ? '245,129,12' : '0,188,212';
  return (
    <button
      onClick={() => { playUI(SoundEffects.UI_CLICK); onClick(); }}
      className="flex flex-col items-center px-6 py-4 rounded-xl border-2 transition-all"
      style={selected
        ? { borderColor: charColor, background: `rgba(${charRgb},0.12)`, color: charColor, boxShadow: `0 0 16px rgba(${charRgb},0.2)` }
        : { borderColor: 'rgba(255,255,255,0.1)', color: 'var(--color-hud-muted)' }
      }
    >
      <span className="text-2xl mb-1">{color === 'carl' ? '🎩' : '🌸'}</span>
      <span className="font-serif font-bold">{name}</span>
      <span className="text-xs opacity-70">{description}</span>
    </button>
  );
};

const LoadGamePanel: React.FC<{
  savedGames: SavedGame[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  isCompact: boolean;
}> = ({ savedGames, onLoad, onDelete, onBack, isCompact }) => (
  <div className="space-y-4">
    <h2 className="font-serif text-center text-xl" style={{ color: 'var(--color-pumpkin)' }}>Load Game</h2>
    
    <div className={clsx(
      'space-y-2 overflow-y-auto',
      isCompact ? 'max-h-48' : 'max-h-64'
    )}>
      {savedGames.slice().reverse().map(save => (
        <div
          key={save.id}
          className="flex items-center justify-between p-3 rounded-lg border"
          style={{ background: 'rgba(10,10,12,0.4)', borderColor: 'var(--color-hud-border)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm" style={{ color: 'var(--color-pumpkin)' }}>
              {save.worldSeed.adjective1} {save.worldSeed.adjective2} {save.worldSeed.noun}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-hud-muted)' }}>
              {save.playerCharacter === 'carl' ? 'Carl' : 'Paul'} · {new Date(save.timestamp).toLocaleDateString()}
              {save.score > 0 && ` · Score: ${save.score}`}
            </p>
          </div>
          <div className="flex gap-2 ml-2">
            <button
              onClick={() => { playUI(SoundEffects.UI_CLICK); onLoad(save.id); }}
              className="px-3 py-1.5 rounded text-white text-sm transition-colors"
              style={{ background: 'rgba(139,0,0,0.6)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-blood)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,0,0,0.6)'; }}
            >
              Load
            </button>
            <button
              onClick={() => onDelete(save.id)}
              className="px-2 py-1.5 border rounded text-sm transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'var(--color-hud-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-crimson)'; e.currentTarget.style.color = 'var(--color-crimson)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--color-hud-muted)'; }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      {savedGames.length === 0 && (
        <p className="text-center py-8" style={{ color: 'var(--color-hud-muted)' }}>No saved games</p>
      )}
    </div>
    
    <button 
      onClick={() => { playUI(SoundEffects.UI_BACK); onBack(); }}
      className="w-full py-3 border-2 rounded-lg transition-colors hover:text-white"
      style={{ background: 'rgba(10,10,12,0.6)', borderColor: 'var(--color-hud-border)', color: 'var(--color-hud-muted)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-hud-border)'; }}
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
    <h2 className="font-serif text-center text-xl" style={{ color: 'var(--color-pumpkin)' }}>Settings</h2>
    
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
      onClick={() => { playUI(SoundEffects.UI_BACK); onBack(); }}
      className="w-full py-3 border-2 rounded-lg transition-colors hover:text-white"
      style={{ background: 'rgba(10,10,12,0.6)', borderColor: 'var(--color-hud-border)', color: 'var(--color-hud-muted)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-hud-border)'; }}
    >
      Back
    </button>
  </div>
);

const AchievementsPanel: React.FC<{
  onBack: () => void;
  isCompact: boolean;
}> = ({ onBack, isCompact }) => {
  const achievements = useMemo(() => getAchievementSystem().getAll(), []);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-center text-xl" style={{ color: 'var(--color-pumpkin)' }}>Achievements</h2>

      <p className="text-center text-sm" style={{ color: '#ffd700' }}>
        {unlockedCount} / {totalCount} Unlocked
      </p>

      <div className={clsx(
        'overflow-y-auto pr-1',
        isCompact ? 'max-h-48' : 'max-h-72'
      )} style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--color-hud-border) transparent',
      }}>
        <div className="grid grid-cols-1 gap-2">
          {achievements.map(achievement => {
            const isLocked = !achievement.unlocked;
            const isSecret = achievement.secret && isLocked;

            return (
              <div
                key={achievement.id}
                className="flex items-start gap-3 p-3 rounded-lg border transition-colors"
                style={achievement.unlocked ? {
                  borderColor: 'rgba(255, 215, 0, 0.25)',
                  background: 'rgba(10,10,12,0.4)',
                  boxShadow: '0 0 8px rgba(255, 215, 0, 0.06)',
                } : {
                  borderColor: 'rgba(255,255,255,0.06)',
                  background: 'rgba(10,10,12,0.25)',
                }}
              >
                {/* Icon */}
                <span className={clsx(
                  'text-xl flex-shrink-0 mt-0.5',
                  isLocked && 'grayscale opacity-40'
                )}>
                  {isSecret ? '?' : achievement.icon}
                </span>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-sm font-medium truncate"
                    style={{ color: achievement.unlocked ? '#ffd700' : isLocked ? 'rgba(255,255,255,0.2)' : 'var(--color-pumpkin)' }}>
                    {isSecret ? '???' : achievement.name}
                  </p>
                  <p className="text-xs mt-0.5 leading-snug"
                    style={{ color: isLocked ? 'rgba(255,255,255,0.12)' : 'var(--color-hud-muted)' }}>
                    {isSecret ? 'Secret achievement' : achievement.description}
                  </p>
                </div>

                {/* Unlocked indicator */}
                {achievement.unlocked && (
                  <span className="flex-shrink-0 text-xs mt-1" style={{ color: '#ffd700' }}>
                    &#10003;
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => { playUI(SoundEffects.UI_BACK); onBack(); }}
        className="w-full py-3 border-2 rounded-lg transition-colors hover:text-white"
      style={{ background: 'rgba(10,10,12,0.6)', borderColor: 'var(--color-hud-border)', color: 'var(--color-hud-muted)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-hud-border)'; }}
      >
        Back
      </button>
    </div>
  );
};

const StatsPanel: React.FC<{
  onBack: () => void;
  isCompact: boolean;
}> = ({ onBack, isCompact }) => {
  const stats = useMemo(() => getAchievementSystem().getStats(), []);

  const formatPlayTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  };

  const formatFastestTime = (seconds: number | null): string => {
    if (seconds === null) return '---';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const statEntries: Array<{ label: string; value: string | number }> = [
    { label: 'Games Started', value: stats.gamesStarted },
    { label: 'Games Completed', value: stats.gamesCompleted },
    { label: 'Carl Completions', value: stats.carlCompletions },
    { label: 'Paul Completions', value: stats.paulCompletions },
    { label: 'Total Play Time', value: formatPlayTime(stats.totalPlayTimeSeconds) },
    { label: 'Fastest Completion', value: formatFastestTime(stats.fastestCompletionSeconds) },
    { label: 'Rooms Explored', value: stats.roomsExplored.length },
    { label: 'Items Collected', value: stats.itemsCollected.length },
    { label: 'Highest Horror Reached', value: `${stats.highestHorrorReached}/10` },
    { label: 'Props Examined', value: stats.propsExamined.length },
    { label: 'NPC Interactions', value: stats.npcInteractions },
    { label: 'World Seeds Used', value: stats.worldSeedsUsed.length },
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-center text-xl" style={{ color: 'var(--color-pumpkin)' }}>Statistics</h2>

      <div className={clsx(
        'overflow-y-auto pr-1',
        isCompact ? 'max-h-56' : 'max-h-80'
      )} style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--color-hud-border) transparent',
      }}>
        <div className="space-y-2">
          {statEntries.map(entry => (
            <div
              key={entry.label}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'rgba(10,10,12,0.3)' }}
            >
              <span className="text-sm" style={{ color: 'var(--color-hud-text)' }}>{entry.label}</span>
              <span
                className="font-serif font-bold text-sm tabular-nums"
                style={{ color: 'var(--color-pumpkin)' }}
              >
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => { playUI(SoundEffects.UI_BACK); onBack(); }}
        className="w-full py-3 border-2 rounded-lg transition-colors hover:text-white"
      style={{ background: 'rgba(10,10,12,0.6)', borderColor: 'var(--color-hud-border)', color: 'var(--color-hud-muted)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-hud-border)'; }}
      >
        Back
      </button>
    </div>
  );
};

// ============================================
// UI Components
// ============================================

/**
 * MenuButton with animated conic-gradient glow border on hover.
 * Uses a ref to track mouse angle relative to button center, then applies
 * a CSS conic-gradient positioned at that angle for a "follow the cursor" effect.
 */
const MenuButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}> = ({ onClick, children, primary, disabled }) => {
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
    ? `conic-gradient(from ${glowAngle}deg, var(--color-rose), var(--color-pumpkin), var(--color-teal), var(--color-rose))`
    : undefined;

  return (
    <div
      className="relative rounded-xl p-[1px] transition-opacity duration-300"
      style={{
        background: isHovered && !disabled ? glowGradient : 'var(--color-hud-border)',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => { setIsHovered(true); if (!disabled) playUI(SoundEffects.UI_HOVER); }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        ref={btnRef}
        onClick={() => { if (!disabled) playUI(SoundEffects.UI_CLICK); onClick(); }}
        onFocus={() => { setIsHovered(true); if (!disabled) playUI(SoundEffects.UI_HOVER); }}
        onBlur={() => setIsHovered(false)}
        disabled={disabled}
        className={clsx(
          'w-full py-3 px-6 rounded-[11px] font-serif text-lg uppercase tracking-wider',
          'transition-all duration-200 active:scale-[0.98]',
          'disabled:cursor-not-allowed',
        )}
        style={primary ? {
          background: 'linear-gradient(135deg, #8B0000 0%, #4a0000 100%)',
          color: '#fff',
          boxShadow: isHovered ? '0 4px 24px rgba(139,0,0,0.4)' : '0 4px 16px rgba(139,0,0,0.25)',
        } : {
          background: 'rgba(10,10,12,0.85)',
          color: isHovered ? '#fff' : 'var(--color-hud-text)',
        }}
      >
        {children}
      </button>
    </div>
  );
};

const SettingSlider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(10,10,12,0.3)' }}>
    <span style={{ color: 'var(--color-hud-text)' }}>{label}</span>
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-24"
        style={{ accentColor: 'var(--color-pumpkin)' }}
      />
      <span className="w-12 text-right font-bold tabular-nums" style={{ color: 'var(--color-pumpkin)' }}>{Math.round(value * 100)}%</span>
    </div>
  </div>
);

const SettingToggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(10,10,12,0.3)' }}>
    <span style={{ color: 'var(--color-hud-text)' }}>{label}</span>
    <button
      onClick={() => onChange(!value)}
      className="px-4 py-1.5 rounded transition-colors"
      style={value
        ? { background: 'rgba(245,129,12,0.7)', color: '#fff' }
        : { background: 'var(--color-shadow)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-hud-muted)' }
      }
    >
      {value ? 'ON' : 'OFF'}
    </button>
  </div>
);

export default MenuOverlay;

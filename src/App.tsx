// Llamas With Hats - The Dark Comedy RPG
// Data-driven game using JSON stage definitions
import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useRPGGameState } from './hooks/useRPGGameState';
import { useDeviceInfo } from './hooks/useDeviceInfo';
import { MenuOverlay } from './components/ui/MenuOverlay';
import { GameView } from './components/game/GameView';
import { LlamaAI, AIState, createLlamaAI } from './systems/AIController';
import { initializeGame } from './systems/GameInitializer';
import { getStoryManager } from './systems/StoryManager';
import { getAudioManager } from './systems/AudioManager';
import { getStartingStage } from './data';
import { DevAIOverlay } from './components/game/DevAIOverlay';
import type { GeneratedLayout } from './systems/LayoutGenerator';
import type { RoomConfig, WorldSeed } from './types/game';

// Fixed seed for menu background — deterministic so the menu always looks the same
const MENU_SEED: WorldSeed = {
  adjective1: 'Dark',
  adjective2: 'Twisted',
  noun: 'House',
  seedString: 'Dark-Twisted-House'
};

// Check URL params for dev mode
const urlParams = new URLSearchParams(window.location.search);
const devAIMode = urlParams.get('dev') === 'ai';

const App: React.FC = () => {
  const {
    state,
    navigateTo,
    selectCharacter,
    setWorldSeed,
    shuffleWorldSeed,
    startNewGame,
    saveGame,
    loadGame,
    deleteSave,
    updateSettings,
    updatePlayerPosition,
    updateOpponent,
    togglePause,
    returnToMainMenu,
    transitionToRoom,
    handleRoomChange,
    addToInventory,
    unlockExit,
    advanceStage,
    dismissStageTransition
  } = useRPGGameState();

  const device = useDeviceInfo();

  // Menu preview layout — loaded on mount from the starting stage
  const [menuLayout, setMenuLayout] = useState<GeneratedLayout | null>(null);
  const [menuAllRoomConfigs, setMenuAllRoomConfigs] = useState<Map<string, RoomConfig> | null>(null);
  const [menuRoom, setMenuRoom] = useState<RoomConfig | null>(null);

  // Initialize layout on mount for menu background
  useEffect(() => {
    const stageId = getStartingStage();
    initializeGame(stageId, 'carl', MENU_SEED).then(game => {
      if (!game.layout) {
        throw new Error(`Stage "${stageId}" failed to generate a layout — every stage must have a layout`);
      }
      setMenuLayout(game.layout);
      setMenuAllRoomConfigs(game.allRoomConfigs);
      setMenuRoom(game.getCurrentRoom());
    }).catch(e => {
      console.error('[App] Failed to initialize menu layout:', e);
      throw e;
    });
  }, []);

  // AI controller refs
  const aiRef = useRef<LlamaAI | null>(null);
  const playerAIRef = useRef<LlamaAI | null>(null);
  const lastUpdateRef = useRef<number>(performance.now());

  // AI state tracking for dev overlay
  const [playerAIState, setPlayerAIState] = useState<AIState>('idle');
  const [opponentAIState, setOpponentAIState] = useState<AIState>('idle');

  // Wire settings volume to AudioManager
  useEffect(() => {
    const audio = getAudioManager();
    audio.setMusicVolume(state.settings.musicVolume);
    audio.setSFXVolume(state.settings.sfxVolume);
  }, [state.settings.musicVolume, state.settings.sfxVolume]);

  // Lock to landscape and fullscreen when entering game on phone/folded foldable
  useEffect(() => {
    if (state.isPlaying && device.requiresLandscape) {
      device.lockToLandscape();
      device.enterFullscreen();
    }

    return () => {
      if (device.requiresLandscape) {
        device.unlockOrientation();
      }
    };
  }, [state.isPlaying, device.requiresLandscape]);

  // Initialize AI when game starts
  useEffect(() => {
    if (state.isPlaying && state.currentRoom) {
      // Opponent AI (always active)
      aiRef.current = createLlamaAI(
        state.opponentPosition.x,
        state.opponentPosition.z,
        state.currentRoom.width,
        state.currentRoom.height,
        (x, z, rotation) => {
          updateOpponent(x, 0, z, rotation);
        }
      );
      if (devAIMode) {
        aiRef.current.setStateCallback(setOpponentAIState);
      }

      // Player AI (dev mode only)
      if (devAIMode) {
        playerAIRef.current = createLlamaAI(
          state.player.position.x,
          state.player.position.z,
          state.currentRoom.width,
          state.currentRoom.height,
          (x, z, rotation) => {
            updatePlayerPosition(x, 0, z, rotation);
          }
        );
        playerAIRef.current.setStateCallback(setPlayerAIState);
      }

      return () => {
        aiRef.current?.dispose();
        aiRef.current = null;
        if (playerAIRef.current) {
          playerAIRef.current.dispose();
          playerAIRef.current = null;
        }
      };
    }
  }, [state.isPlaying, state.currentRoom?.id]);

  // Update AI with player position — opponent tracks player, player AI tracks opponent
  useEffect(() => {
    if (aiRef.current) {
      aiRef.current.updatePlayerPosition(
        state.player.position.x,
        state.player.position.z
      );
    }
    if (playerAIRef.current) {
      playerAIRef.current.updatePlayerPosition(
        state.opponentPosition.x,
        state.opponentPosition.z
      );
    }
  }, [state.player.position.x, state.player.position.z, state.opponentPosition.x, state.opponentPosition.z]);

  // AI update loop
  useEffect(() => {
    if (!state.isPlaying || state.isPaused) return;

    let animationId: number;

    const updateLoop = () => {
      const now = performance.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      // Sync horror level from story manager to AI — drives Paul's escalating behavior
      const horrorLevel = getStoryManager().getHorrorLevel();
      if (aiRef.current) {
        aiRef.current.setHorrorLevel(horrorLevel);
        aiRef.current.update(deltaTime);
      }
      if (playerAIRef.current) {
        playerAIRef.current.update(deltaTime);
      }

      animationId = requestAnimationFrame(updateLoop);
    };

    animationId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [state.isPlaying, state.isPaused]);

  // Update AI bounds on room change
  useEffect(() => {
    if (state.currentRoom) {
      if (aiRef.current) {
        aiRef.current.updateBounds(
          state.currentRoom.width,
          state.currentRoom.height
        );
        aiRef.current.teleport(0, -2);
      }
      if (playerAIRef.current) {
        playerAIRef.current.updateBounds(
          state.currentRoom.width,
          state.currentRoom.height
        );
        playerAIRef.current.teleport(0, 2);
      }
    }
  }, [state.currentRoom?.id]);

  // Get world name
  const getWorldName = () => {
    if (state.worldSeed) {
      return `The ${state.worldSeed.adjective1} ${state.worldSeed.adjective2} ${state.worldSeed.noun}`;
    }
    return 'Unknown World';
  };

  // Show landscape requirement overlay for phones in portrait
  const showLandscapeOverlay = device.requiresLandscape &&
    device.orientation === 'portrait' &&
    state.isPlaying;

  // Whether to show the menu overlay
  const showMenu = !state.isPlaying;

  // Use game layout when playing, menu layout when on menu
  const activeLayout = state.isPlaying ? state.layout : menuLayout;
  const activeAllRoomConfigs = state.isPlaying ? state.allRoomConfigs : menuAllRoomConfigs;
  const activeRoom = state.isPlaying ? state.currentRoom : menuRoom;
  const activeSeed = state.isPlaying ? state.worldSeed?.seedString : 'menu-preview';

  return (
    <div className={clsx(
      'fixed inset-0 bg-shadow overflow-hidden',
      'safe-area-inset'
    )}>
      {/* Game View - ALWAYS rendered as background (menu is an overlay) */}
      {activeLayout && activeAllRoomConfigs && activeRoom && (
        <GameView
          playerCharacter={state.selectedCharacter || 'carl'}
          currentRoom={activeRoom}
          worldName={showMenu ? 'The Apartment' : getWorldName()}
          playerPosition={state.player.position}
          playerRotation={state.player.rotation}
          playerHealth={state.player.health}
          playerMaxHealth={state.player.maxHealth}
          playerInventory={state.player.inventory}
          opponentPosition={state.opponentPosition}
          opponentRotation={state.opponentRotation}
          cameraZoom={state.settings.cameraZoom}
          showMinimap={state.settings.showMinimap && state.isPlaying}
          isPaused={showMenu || state.isPaused}
          deviceType={device.deviceType}
          isTouchDevice={device.isTouchDevice}
          onPlayerMove={updatePlayerPosition}
          onRoomTransition={transitionToRoom}
          onPause={togglePause}
          onSave={saveGame}
          onMainMenu={returnToMainMenu}
          hideHUD={showMenu}
          onItemPickup={addToInventory}
          onUnlockExit={unlockExit}
          onStageComplete={advanceStage}
          devAIEnabled={devAIMode}
          layout={activeLayout}
          allRoomConfigs={activeAllRoomConfigs}
          seed={activeSeed}
          onRoomChange={handleRoomChange}
          stageAtmosphere={state.isPlaying ? state.stageAtmosphere ?? undefined : undefined}
          stageGoals={state.isPlaying ? state.stageGoals : undefined}
        />
      )}

      {/* Dev AI overlay */}
      {devAIMode && state.isPlaying && (
        <DevAIOverlay
          playerAIState={playerAIState}
          opponentAIState={opponentAIState}
          playerPosition={{ x: state.player.position.x, z: state.player.position.z }}
          opponentPosition={{ x: state.opponentPosition.x, z: state.opponentPosition.z }}
          currentRoomName={state.currentRoom?.name ?? ''}
        />
      )}

      {/* Loading state while layout initializes */}
      {!activeLayout && (
        <div className="fixed inset-0 bg-shadow flex items-center justify-center">
          <p className="text-wood font-serif">Loading...</p>
        </div>
      )}

      {/* Menu Overlay - shown on top of game scene */}
      {showMenu && (
        <MenuOverlay
          currentScreen={state.menuScreen}
          onNavigate={navigateTo}
          savedGames={state.savedGames}
          settings={state.settings}
          selectedCharacter={state.selectedCharacter}
          onSelectCharacter={selectCharacter}
          worldSeed={state.worldSeed}
          onSetWorldSeed={setWorldSeed}
          onShuffleSeed={shuffleWorldSeed}
          onStartGame={startNewGame}
          onLoadGame={loadGame}
          onDeleteSave={deleteSave}
          onUpdateSettings={updateSettings}
          deviceType={device.deviceType}
        />
      )}

      {/* Stage Transition Screen — shown between stages */}
      {state.showStageTransition && (
        <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-8">
          <div className="text-center max-w-lg">
            <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">
              Stage Complete
            </p>
            <h1 className="text-3xl md:text-5xl font-serif text-wood mb-4">
              {state.stageName || 'Next Stage'}
            </h1>
            {state.stageDescription && (
              <p className="text-gray-400 mb-6 font-serif italic leading-relaxed">
                {state.stageDescription}
              </p>
            )}
            <div className="border-t border-wood/20 my-6" />
            <button
              onClick={dismissStageTransition}
              className="px-8 py-3 bg-wood/20 hover:bg-wood/40 text-wood border border-wood/50 rounded-lg font-serif transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Victory Screen Overlay */}
      {state.showVictory && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-8">
          <div className="text-center max-w-lg">
            <h1 className="text-4xl md:text-6xl font-serif text-blood mb-6">
              {state.selectedCharacter === 'carl' ? 'CAAAAARL!' : 'Oh hey Paul.'}
            </h1>
            <p className="text-xl text-wood mb-4 font-serif">
              {state.selectedCharacter === 'carl'
                ? 'I had the rumblies that only hands could satisfy.'
                : 'That kills people, Carl!'}
            </p>
            <div className="border-t border-wood/30 my-6" />
            <p className="text-gray-400 mb-2">
              {state.selectedCharacter === 'carl'
                ? 'You embraced Carl\'s ecstatic artistry across all three stages.'
                : 'You navigated Paul through Carl\'s escalating madness and lived to tell the tale.'}
            </p>
            <p className="text-gray-500 text-sm mb-2">
              The {state.worldSeed?.adjective1} {state.worldSeed?.adjective2} {state.worldSeed?.noun} will never be the same.
            </p>
            <p className="text-gray-600 text-xs mb-8">
              All three stages complete
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={returnToMainMenu}
                className="px-8 py-3 bg-wood/20 hover:bg-wood/40 text-wood border border-wood/50 rounded-lg font-serif transition-colors"
              >
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Landscape requirement overlay */}
      {showLandscapeOverlay && (
        <div className="fixed inset-0 z-[9999] bg-shadow flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">📱</div>
            <p className="text-wood text-xl font-serif">
              Please rotate your device to landscape mode
            </p>
            <p className="text-gray-500 text-sm mt-2">
              For the best gameplay experience
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

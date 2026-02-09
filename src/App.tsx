// Llamas With Hats - The Dark Comedy RPG
// Data-driven game using JSON stage definitions
import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { useRPGGameState } from './hooks/useRPGGameState';
import { useDeviceInfo } from './hooks/useDeviceInfo';
import { useMenuPreview } from './hooks/useMenuPreview';
import { useAIOrchestration } from './hooks/useAIOrchestration';
import { useCameraTelemetry } from './hooks/useCameraTelemetry';
import { MenuOverlay } from './components/ui/MenuOverlay';
import { StageTransitionOverlay } from './components/ui/StageTransitionOverlay';
import { VictoryOverlay } from './components/ui/VictoryOverlay';
import { LandscapeOverlay } from './components/ui/LandscapeOverlay';
import { GameView } from './components/game/GameView';
import { DevAIOverlay } from './components/game/DevAIOverlay';
import { FilmGrainOverlay } from './components/ui/FilmGrainOverlay';
import { HorrorEffects } from './components/ui/HorrorEffects';
import { GameToastProvider } from './components/ui/GameToast';
import { getAudioManager } from './systems/AudioManager';
import { getGoalTracker } from './systems/GoalTracker';

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
  const { menuLayout, menuAllRoomConfigs, menuRoom } = useMenuPreview();

  // AI orchestration — ObjectiveAI, LlamaAI, pathfinding, difficulty, goal tracking
  const ai = useAIOrchestration({
    isPlaying: state.isPlaying,
    isPaused: state.isPaused,
    currentRoom: state.currentRoom,
    layout: state.layout,
    selectedCharacter: state.selectedCharacter as 'carl' | 'paul' | null,
    playerPosition: state.player.position,
    opponentPosition: state.opponentPosition,
    stageGoals: state.stageGoals,
    devAIMode,
    updatePlayerPosition,
    updateOpponent,
  });

  // Camera telemetry — ref written by render loop, polled at 5Hz for overlay
  const { cameraTelemetryRef, cameraTelemetry } = useCameraTelemetry(devAIMode, state.isPlaying);

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

  const showMenu = !state.isPlaying;

  // Use game layout when playing, menu layout when on menu
  const activeLayout = state.isPlaying ? state.layout : menuLayout;
  const activeAllRoomConfigs = state.isPlaying ? state.allRoomConfigs : menuAllRoomConfigs;
  const activeRoom = state.isPlaying ? state.currentRoom : menuRoom;
  const activeSeed = state.isPlaying ? state.worldSeed?.seedString : 'menu-preview';

  // Compute horror level from atmosphere (0-3)
  const horrorLevel = state.stageAtmosphere?.baseHorrorLevel ?? 0;

  return (
    <GameToastProvider>
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
          onItemPickup={(itemId) => {
            addToInventory(itemId);
            getGoalTracker().checkGoalCompletion({
              type: 'item_pickup',
              character: (state.selectedCharacter as 'carl' | 'paul') || 'carl',
              params: { itemId },
            });
          }}
          onUnlockExit={(lockId) => {
            unlockExit(lockId);
            ai.objectiveAIRef.current?.onDoorUnlocked(lockId);
            ai.playerObjectiveAIRef.current?.onDoorUnlocked(lockId);
          }}
          onStageComplete={advanceStage}
          devAIEnabled={devAIMode}
          layout={activeLayout}
          allRoomConfigs={activeAllRoomConfigs}
          seed={activeSeed}
          onRoomChange={handleRoomChange}
          stageAtmosphere={state.isPlaying ? state.stageAtmosphere ?? undefined : undefined}
          stageGoals={state.isPlaying ? state.stageGoals : undefined}
          cameraTelemetryRef={devAIMode ? cameraTelemetryRef : undefined}
        />
      )}

      {/* Dev AI overlay */}
      {devAIMode && state.isPlaying && (
        <DevAIOverlay
          playerAIState={ai.playerAIState}
          opponentAIState={ai.opponentAIState}
          playerPosition={{ x: state.player.position.x, z: state.player.position.z }}
          opponentPosition={{ x: state.opponentPosition.x, z: state.opponentPosition.z }}
          currentRoomName={state.currentRoom?.name ?? ''}
          playerObjectiveState={ai.playerObjectiveState}
          opponentObjectiveState={ai.opponentObjectiveState}
          playerGoal={ai.playerObjectiveAIRef.current?.getCurrentGoal()?.def.description}
          opponentGoal={ai.objectiveAIRef.current?.getCurrentGoal()?.def.description}
          opponentRoom={ai.objectiveAIRef.current?.getCurrentRoom()}
          difficultyLevel={ai.difficultyRef.current?.getDifficultyLevel()}
          difficultyTuning={ai.difficultyRef.current?.getTuning()}
          carlGoals={getGoalTracker().getGoalsForCharacter('carl')}
          paulGoals={getGoalTracker().getGoalsForCharacter('paul')}
          triggerLog={ai.dualStoryRef.current?.getTriggerLog()}
          cameraTelemetry={cameraTelemetry}
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

      {/* Stage Transition Screen */}
      {state.showStageTransition && (
        <StageTransitionOverlay
          stageName={state.stageName || 'Next Stage'}
          stageDescription={state.stageDescription}
          onDismiss={dismissStageTransition}
        />
      )}

      {/* Victory Screen */}
      {state.showVictory && (
        <VictoryOverlay
          selectedCharacter={state.selectedCharacter || 'carl'}
          worldSeed={state.worldSeed}
          onReturnToMenu={returnToMainMenu}
        />
      )}

      {/* Horror escalation effects — z-index 9 (below film grain) */}
      {state.isPlaying && horrorLevel > 0 && (
        <HorrorEffects horrorLevel={horrorLevel} />
      )}

      {/* Film grain overlay — horror-responsive, z-index 10 */}
      {state.isPlaying && (
        <FilmGrainOverlay horrorLevel={horrorLevel} />
      )}

      {/* Landscape requirement overlay */}
      {showLandscapeOverlay && <LandscapeOverlay />}
    </div>
    </GameToastProvider>
  );
};

export default App;

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
import { getAudioManager, SoundEffects } from './systems/AudioManager';
import { getGoalTracker } from './systems/GoalTracker';
import { getAchievementSystem } from './systems/AchievementSystem';
import { getStoryManager } from './systems/StoryManager';
import { useGameToast } from './components/ui/GameToast';

// Check URL params for dev mode
const urlParams = new URLSearchParams(window.location.search);
const devAIMode = urlParams.get('dev') === 'ai';

// Bridge: wires AchievementSystem unlock events to the toast notification system.
// Must live inside GameToastProvider to access the toast context.
const AchievementToastBridge: React.FC = () => {
  const { addToast } = useGameToast();

  useEffect(() => {
    getAchievementSystem().setCallbacks({
      onUnlock: (achievement) => {
        addToast('achievement', `${achievement.name} — ${achievement.description}`, achievement.icon);
        // Play ascending sparkle chime for achievement unlock
        getAudioManager().playSound(SoundEffects.ITEM_PICKUP, { pitch: 1.2 });
      },
    });
    return () => getAchievementSystem().setCallbacks({});
  }, [addToast]);

  return null;
};

// ---------------------------------------------------------------------------
// Loading Screen — cinematic loading state with animated progressive bar
// ---------------------------------------------------------------------------

const LoadingScreen: React.FC = () => (
  <div
    className="fixed inset-0 flex flex-col items-center justify-center"
    style={{ background: 'var(--color-void)' }}
  >
    {/* Title */}
    <h1
      className="font-serif mb-2"
      style={{
        fontSize: 'clamp(1.5rem, 6vw, 2.5rem)',
        background: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.4) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
        animation: 'count-up 0.6s ease-out both',
      }}
    >
      Llamas With Hats
    </h1>

    <p
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        color: 'var(--color-hud-muted)',
        marginBottom: 24,
        animation: 'count-up 0.4s ease-out 0.2s both',
      }}
    >
      Preparing the scene
    </p>

    {/* Progressive bar */}
    <div
      style={{
        width: 'min(280px, 60vw)',
        height: 4,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        animation: 'count-up 0.4s ease-out 0.3s both',
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 2,
          background: 'linear-gradient(90deg, var(--color-pumpkin), var(--color-gold))',
          animation: 'loading-bar 2s ease-in-out infinite',
          width: '40%',
        }}
      />
    </div>

    {/* Loading dots */}
    <div
      style={{
        display: 'flex',
        gap: 4,
        marginTop: 16,
        animation: 'count-up 0.4s ease-out 0.4s both',
      }}
    >
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--color-pumpkin)',
            animation: `loading-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  </div>
);

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
    currentStageId: state.currentStageId,
    layout: state.layout,
    selectedCharacter: state.selectedCharacter as 'carl' | 'paul' | null,
    playerPosition: state.player.position,
    opponentPosition: state.opponentPosition,
    stageGoals: state.stageGoals,
    devAIMode,
    difficulty: state.settings.difficulty,
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
    <AchievementToastBridge />
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
            getAudioManager().playSound(SoundEffects.ITEM_PICKUP);
            getGoalTracker().checkGoalCompletion({
              type: 'item_pickup',
              character: (state.selectedCharacter as 'carl' | 'paul') || 'carl',
              params: { itemId },
            });
          }}
          onUnlockExit={(lockId) => {
            unlockExit(lockId);
            getAudioManager().playSound(SoundEffects.DOOR_UNLOCK);
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

      {/* Loading state while layout initializes or stage loads */}
      {(!activeLayout || state.isLoadingStage) && <LoadingScreen />}

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
          playTimeSeconds={state.playTimeSeconds}
          roomsExplored={getAchievementSystem().getStats().roomsExplored.length}
          totalRooms={state.allRoomConfigs?.size ?? 0}
          itemsCollected={state.player.inventory.length}
          beatsTriggered={getStoryManager().getCompletedBeats().length}
          horrorPeak={Math.round(getStoryManager().getHorrorLevel())}
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

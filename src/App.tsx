// Llamas With Hats - The Dark Comedy RPG
// Data-driven game using JSON stage definitions
import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useRPGGameState } from './hooks/useRPGGameState';
import { useDeviceInfo } from './hooks/useDeviceInfo';
import { MenuOverlay } from './components/ui/MenuOverlay';
import { GameView } from './components/game/GameView';
import { LayoutGameRenderer } from './components/game/LayoutGameRenderer';
import { LlamaAI, createLlamaAI } from './systems/AIController';
import { createMenuRoom } from './systems/GameInitializer';
import { RoomConfig } from './types/game';

// Check if we should show the new layout demo
const urlParams = new URLSearchParams(window.location.search);
const showLayoutDemo = urlParams.get('layout') === 'true';

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
    transitionToRoom
  } = useRPGGameState();
  
  const device = useDeviceInfo();
  
  // Menu preview room - generated from stage definition
  const [menuRoom, setMenuRoom] = useState<RoomConfig | null>(null);
  
  // Initialize menu preview room on mount
  useEffect(() => {
    try {
      const room = createMenuRoom();
      setMenuRoom(room);
    } catch (e) {
      console.error('Failed to create menu room:', e);
      // Fallback room
      setMenuRoom({
        id: 'fallback',
        name: 'The Apartment',
        width: 10,
        height: 10,
        exits: [],
        props: [],
        enemies: []
      });
    }
  }, []);
  
  // AI controller ref
  const aiRef = useRef<LlamaAI | null>(null);
  const lastUpdateRef = useRef<number>(performance.now());
  
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
      aiRef.current = createLlamaAI(
        state.opponentPosition.x,
        state.opponentPosition.z,
        state.currentRoom.width,
        state.currentRoom.height,
        (x, z, rotation) => {
          updateOpponent(x, 0, z, rotation);
        }
      );
      
      return () => {
        aiRef.current?.dispose();
        aiRef.current = null;
      };
    }
  }, [state.isPlaying, state.currentRoom?.id]);
  
  // Update AI with player position
  useEffect(() => {
    if (aiRef.current) {
      aiRef.current.updatePlayerPosition(
        state.player.position.x,
        state.player.position.z
      );
    }
  }, [state.player.position.x, state.player.position.z]);
  
  // AI update loop
  useEffect(() => {
    if (!state.isPlaying || state.isPaused) return;
    
    let animationId: number;
    
    const updateLoop = () => {
      const now = performance.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;
      
      if (aiRef.current) {
        aiRef.current.update(deltaTime);
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
    if (aiRef.current && state.currentRoom) {
      aiRef.current.updateBounds(
        state.currentRoom.width,
        state.currentRoom.height
      );
      aiRef.current.teleport(0, -2);
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
  
  // The room to display - either the game room or menu preview
  const displayRoom = state.isPlaying ? state.currentRoom : menuRoom;
  
  // If layout demo mode, show the new layout renderer
  if (showLayoutDemo) {
    return (
      <div className={clsx(
        'fixed inset-0 bg-shadow overflow-hidden',
        'safe-area-inset'
      )}>
        <LayoutGameRenderer
          playerCharacter="carl"
          playerPosition={{ x: 0, y: 0, z: 2 }}
          playerRotation={0}
          opponentPosition={{ x: 2, y: 0, z: 0 }}
          opponentRotation={Math.PI}
          onPlayerMove={(x, y, z, r) => console.log('Move:', x, y, z, r)}
          onRoomChange={(roomId) => console.log('Room changed:', roomId)}
          isPaused={false}
          seed={state.worldSeed?.seedString || 'demo-seed'}
        />
        
        {/* Demo mode indicator */}
        <div className="absolute bottom-4 right-4 bg-shadow-light/90 px-4 py-2 rounded-lg border border-wood/50">
          <p className="text-wood text-sm font-mono">Layout Demo Mode</p>
          <p className="text-gray-500 text-xs">Remove ?layout=true to exit</p>
        </div>
        
        {/* Instructions */}
        <div className="absolute top-20 left-4 bg-shadow-light/90 px-4 py-3 rounded-lg border border-wood/30 max-w-xs">
          <p className="text-gray-300 text-sm mb-2">Multi-floor procedural layout:</p>
          <ul className="text-gray-400 text-xs space-y-1">
            <li>- Main Floor: Living room, kitchen, bedroom, bathroom</li>
            <li>- Basement: Story-critical rooms with horror elements</li>
            <li>- WASD to move, explore different rooms</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      'fixed inset-0 bg-shadow overflow-hidden',
      'safe-area-inset'
    )}>
      {/* Game View - ALWAYS rendered as background */}
      {displayRoom && (
        <GameView
          playerCharacter={state.selectedCharacter || 'carl'}
          currentRoom={displayRoom}
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
        />
      )}
      
      {/* Loading state while menu room generates */}
      {!displayRoom && (
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

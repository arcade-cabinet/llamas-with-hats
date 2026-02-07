// RPG Game State Management
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  CharacterType,
  WorldSeed,
  SavedGame,
  GameSettings,
  MenuScreen,
  PlayerState,
  RoomConfig
} from '../types/game';
import { generateWorldSeed } from '../utils/worldGenerator';
import { getStartingStage } from '../data';
import { getStoryManager, StoryState } from '../systems/StoryManager';
import { initializeGame, getSpawnPosition, GameInstance } from '../systems/GameInitializer';

const STORAGE_KEY = 'llamas-rpg-saves';
const SETTINGS_KEY = 'llamas-rpg-settings';

export interface RPGGameState {
  // Menu state
  menuScreen: MenuScreen;
  selectedCharacter: CharacterType | null;
  worldSeed: WorldSeed | null;
  savedGames: SavedGame[];
  settings: GameSettings;

  // Active game state
  isPlaying: boolean;
  currentStageId: string | null;
  currentStageDefinition: Record<string, unknown> | null;
  currentRoom: RoomConfig | null;
  player: PlayerState;
  opponentPosition: { x: number; y: number; z: number };
  opponentRotation: number;

  // UI state
  isPaused: boolean;
  showInventory: boolean;
  isLoadingStage: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.7,
  sfxVolume: 0.8,
  cameraZoom: 12,
  showMinimap: true
};

const DEFAULT_PLAYER: PlayerState = {
  position: { x: 0, y: 0, z: 2 },
  rotation: 0,
  velocity: { x: 0, z: 0 },
  health: 100,
  maxHealth: 100,
  inventory: [],
  currentRoom: 'living_room',
  currentFloor: 0
};

export function useRPGGameState() {
  const [state, setState] = useState<RPGGameState>({
    menuScreen: 'main',
    selectedCharacter: null,
    worldSeed: null,
    savedGames: [],
    settings: DEFAULT_SETTINGS,
    isPlaying: false,
    currentStageId: null,
    currentStageDefinition: null,
    currentRoom: null,
    player: DEFAULT_PLAYER,
    opponentPosition: { x: 0, y: 0, z: -2 },
    opponentRotation: Math.PI,
    isPaused: false,
    showInventory: false,
    isLoadingStage: false
  });

  const gameInstanceRef = useRef<GameInstance | null>(null);

  // Load saved games and settings on mount
  useEffect(() => {
    try {
      const savedGamesJson = localStorage.getItem(STORAGE_KEY);
      const settingsJson = localStorage.getItem(SETTINGS_KEY);

      setState(prev => ({
        ...prev,
        savedGames: savedGamesJson ? JSON.parse(savedGamesJson) : [],
        settings: settingsJson ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) } : DEFAULT_SETTINGS
      }));
    } catch {
      console.warn('Failed to load saved data');
    }
  }, []);

  // Navigation
  const navigateTo = useCallback((screen: MenuScreen) => {
    setState(prev => ({ ...prev, menuScreen: screen }));
  }, []);

  // Character selection
  const selectCharacter = useCallback((character: CharacterType) => {
    setState(prev => ({ ...prev, selectedCharacter: character }));
  }, []);

  // World seed management
  const setWorldSeed = useCallback((seed: WorldSeed) => {
    setState(prev => ({ ...prev, worldSeed: seed }));
  }, []);

  const shuffleWorldSeed = useCallback(() => {
    const newSeed = generateWorldSeed();
    setState(prev => ({ ...prev, worldSeed: newSeed }));
  }, []);

  // Start new game — loads the starting stage from game.json's progression
  const startNewGame = useCallback(async () => {
    const { selectedCharacter, worldSeed } = state;

    if (!selectedCharacter || !worldSeed) return;

    setState(prev => ({ ...prev, isLoadingStage: true }));

    const stageId = getStartingStage();

    // Initialize game from stage definition DDL
    const game = await initializeGame(stageId, selectedCharacter, worldSeed);
    gameInstanceRef.current = game;

    const startRoom = game.getCurrentRoom();

    // Initialize story manager for new game
    const storyManager = getStoryManager();
    storyManager.reset();
    storyManager.setCharacterPath(selectedCharacter === 'carl' ? 'order' : 'chaos');
    await storyManager.loadStage(stageId);

    setState(prev => ({
      ...prev,
      isPlaying: true,
      isLoadingStage: false,
      menuScreen: 'inGame',
      currentStageId: stageId,
      currentStageDefinition: null,
      currentRoom: startRoom,
      player: {
        ...DEFAULT_PLAYER,
        position: { x: 0, y: 0, z: 2 },
        currentRoom: startRoom.id
      },
      opponentPosition: { x: 2, y: 0, z: 0 },
      opponentRotation: Math.PI
    }));

    // Fire scene_enter trigger for the starting room
    storyManager.checkTrigger('scene_enter', { sceneId: startRoom.id });
  }, [state.selectedCharacter, state.worldSeed]);

  // Ref to latest state for callbacks that shouldn't trigger re-renders
  const stateRef = useRef(state);
  stateRef.current = state;

  // Save game — includes currentStageId and story state
  const saveGame = useCallback(() => {
    const { worldSeed, selectedCharacter, currentRoom, player, currentStageId } = stateRef.current;

    if (!worldSeed || !selectedCharacter || !currentRoom || !currentStageId) return;

    // Capture story state from the story manager singleton
    const storyManager = getStoryManager();
    const storyState = storyManager.getState();

    const save: SavedGame = {
      id: `save_${Date.now()}`,
      worldSeed,
      playerCharacter: selectedCharacter,
      currentStageId,
      currentRoom: player.currentRoom || currentRoom.id,
      currentFloor: player.currentFloor || 0,
      playerPosition: player.position,
      playerRotation: player.rotation,
      collectedItems: player.inventory,
      completedQuests: [],
      completedBeats: storyState.completedBeats,
      horrorLevel: storyState.horrorLevel,
      score: 0,
      timestamp: Date.now()
    };

    setState(prev => {
      const newSaves = [...prev.savedGames, save].slice(-10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaves));
      return { ...prev, savedGames: newSaves };
    });
  }, []);

  // Load game — restores stageId, stage definition, and story state
  const loadGame = useCallback(async (saveId: string) => {
    const save = state.savedGames.find(s => s.id === saveId);
    if (!save) return;

    setState(prev => ({ ...prev, isLoadingStage: true }));

    // Load the stage definition for the saved stage
    const stageId = save.currentStageId || getStartingStage();

    // Initialize game from stage definition DDL (same seed = same stage)
    const game = await initializeGame(stageId, save.playerCharacter, save.worldSeed);
    gameInstanceRef.current = game;

    // Transition to the saved room within the generated stage
    game.transitionTo(save.currentRoom);
    const room = game.getCurrentRoom();

    // Restore story manager state
    const storyManager = getStoryManager();
    storyManager.reset();
    storyManager.setCharacterPath(save.playerCharacter === 'carl' ? 'order' : 'chaos');
    await storyManager.loadStage(stageId);

    // Rebuild story state from saved data
    const savedStoryState: StoryState = {
      completedBeats: save.completedBeats,
      currentBeat: null,
      horrorLevel: save.horrorLevel,
      characterPath: save.playerCharacter === 'carl' ? 'order' : 'chaos',
    };
    storyManager.loadState(savedStoryState);

    setState(prev => ({
      ...prev,
      isPlaying: true,
      isLoadingStage: false,
      menuScreen: 'inGame',
      worldSeed: save.worldSeed,
      selectedCharacter: save.playerCharacter,
      currentStageId: stageId,
      currentStageDefinition: null,
      currentRoom: room,
      player: {
        ...DEFAULT_PLAYER,
        position: save.playerPosition,
        rotation: save.playerRotation,
        inventory: save.collectedItems,
        currentRoom: room.id
      },
      opponentPosition: { x: 0, y: 0, z: -2 },
      opponentRotation: Math.PI
    }));
  }, [state.savedGames]);

  // Delete save
  const deleteSave = useCallback((saveId: string) => {
    setState(prev => {
      const newSaves = prev.savedGames.filter(s => s.id !== saveId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaves));
      return { ...prev, savedGames: newSaves };
    });
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<GameSettings>) => {
    setState(prev => {
      const updated = { ...prev.settings, ...newSettings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return { ...prev, settings: updated };
    });
  }, []);

  // Player movement (supports 3D with y for floor levels)
  const updatePlayerPosition = useCallback((x: number, y: number, z: number, rotation: number) => {
    setState(prev => ({
      ...prev,
      player: {
        ...prev.player,
        position: { x, y, z },
        rotation
      }
    }));
  }, []);

  const setPlayerVelocity = useCallback((vx: number, vz: number) => {
    setState(prev => ({
      ...prev,
      player: {
        ...prev.player,
        velocity: { x: vx, z: vz }
      }
    }));
  }, []);

  // Update opponent (AI) - supports 3D
  const updateOpponent = useCallback((x: number, y: number, z: number, rotation: number) => {
    setState(prev => ({
      ...prev,
      opponentPosition: { x, y, z },
      opponentRotation: rotation
    }));
  }, []);

  // Pause/Resume
  const togglePause = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  // Return to main menu
  const returnToMainMenu = useCallback(() => {
    // Reset singleton managers to avoid stale state on next game start
    getStoryManager().reset();
    gameInstanceRef.current = null;
    setState(prev => ({
      ...prev,
      isPlaying: false,
      menuScreen: 'main',
      currentRoom: null,
      currentStageId: null,
      currentStageDefinition: null,
      selectedCharacter: null,
      worldSeed: null
    }));
  }, []);

  // Inventory management
  const addToInventory = useCallback((itemId: string) => {
    setState(prev => {
      if (prev.player.inventory.includes(itemId)) return prev;
      return {
        ...prev,
        player: {
          ...prev.player,
          inventory: [...prev.player.inventory, itemId]
        }
      };
    });
  }, []);

  const removeFromInventory = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      player: {
        ...prev.player,
        inventory: prev.player.inventory.filter(id => id !== itemId)
      }
    }));
  }, []);

  const hasItem = useCallback((itemId: string): boolean => {
    return stateRef.current.player.inventory.includes(itemId);
  }, []);

  // Unlock an exit by its ID in the current room
  const unlockExit = useCallback((lockId: string) => {
    setState(prev => {
      if (!prev.currentRoom) return prev;
      const updatedExits = prev.currentRoom.exits.map(exit =>
        exit.id === lockId ? { ...exit, locked: false } : exit
      );
      return {
        ...prev,
        currentRoom: {
          ...prev.currentRoom,
          exits: updatedExits
        }
      };
    });
  }, []);

  // Room transitions — uses GameInstance to move between stage scenes
  const transitionToRoom = useCallback((roomId: string, entryDirection: 'north' | 'south' | 'east' | 'west') => {
    const game = gameInstanceRef.current;
    if (!game) return;

    // Transition to the target scene in the generated stage
    game.transitionTo(roomId);
    const newRoom = game.getCurrentRoom();

    // Get spawn position from the scene definition
    const scene = game.getCurrentScene();
    const spawnPos = getSpawnPosition(scene, entryDirection);

    setState(prev => ({
      ...prev,
      currentRoom: newRoom,
      player: {
        ...prev.player,
        position: { x: spawnPos.x, y: prev.player.position.y, z: spawnPos.z },
        currentRoom: newRoom.id
      }
    }));

    // Fire scene_enter story trigger for the new room
    getStoryManager().checkTrigger('scene_enter', { sceneId: newRoom.id });
  }, []);

  return {
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
    setPlayerVelocity,
    updateOpponent,
    togglePause,
    returnToMainMenu,
    transitionToRoom,
    addToInventory,
    removeFromInventory,
    hasItem,
    unlockExit
  };
}

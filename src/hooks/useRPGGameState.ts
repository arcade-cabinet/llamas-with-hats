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
import { WorldGenerator, generateWorldSeed } from '../utils/worldGenerator';

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
  currentRoom: RoomConfig | null;
  worldGenerator: WorldGenerator | null;
  player: PlayerState;
  opponentPosition: { x: number; y: number; z: number };
  opponentRotation: number;
  
  // UI state
  isPaused: boolean;
  showInventory: boolean;
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
    currentRoom: null,
    worldGenerator: null,
    player: DEFAULT_PLAYER,
    opponentPosition: { x: 0, y: 0, z: -2 },
    opponentRotation: Math.PI,
    isPaused: false,
    showInventory: false
  });
  
  const worldGenRef = useRef<WorldGenerator | null>(null);
  
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
  
  // Start new game
  const startNewGame = useCallback(() => {
    const { selectedCharacter, worldSeed } = state;
    
    if (!selectedCharacter || !worldSeed) return;
    
    const generator = new WorldGenerator(worldSeed);
    const startRoom = generator.generateStartRoom();
    
    worldGenRef.current = generator;
    
    setState(prev => ({
      ...prev,
      isPlaying: true,
      menuScreen: 'inGame',
      worldGenerator: generator,
      currentRoom: startRoom,
      player: {
        ...DEFAULT_PLAYER,
        position: { x: 0, y: 0, z: 2 }
      },
      opponentPosition: { x: 2, y: 0, z: 0 },
      opponentRotation: Math.PI
    }));
  }, [state.selectedCharacter, state.worldSeed]);
  
  // Save game
  const saveGame = useCallback(() => {
    const { worldSeed, selectedCharacter, currentRoom, player } = state;
    
    if (!worldSeed || !selectedCharacter || !currentRoom) return;
    
    const save: SavedGame = {
      id: `save_${Date.now()}`,
      worldSeed,
      playerCharacter: selectedCharacter,
      currentRoom: player.currentRoom || currentRoom.id,
      currentFloor: player.currentFloor || 0,
      playerPosition: player.position,
      playerRotation: player.rotation,
      collectedItems: player.inventory,
      completedQuests: [],
      completedBeats: [],
      horrorLevel: 0,
      score: 0,
      timestamp: Date.now()
    };
    
    setState(prev => {
      const newSaves = [...prev.savedGames, save].slice(-10); // Keep last 10 saves
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaves));
      return { ...prev, savedGames: newSaves };
    });
  }, [state]);
  
  // Load game
  const loadGame = useCallback((saveId: string) => {
    const save = state.savedGames.find(s => s.id === saveId);
    if (!save) return;
    
    const generator = new WorldGenerator(save.worldSeed);
    const room = generator.generateRoomFromId(save.currentRoom);
    
    worldGenRef.current = generator;
    
    setState(prev => ({
      ...prev,
      isPlaying: true,
      menuScreen: 'inGame',
      worldSeed: save.worldSeed,
      selectedCharacter: save.playerCharacter,
      worldGenerator: generator,
      currentRoom: room,
      player: {
        ...DEFAULT_PLAYER,
        position: save.playerPosition,
        rotation: save.playerRotation,
        inventory: save.collectedItems
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
  
  // Legacy 2D version for backward compatibility  
  const updateOpponent2D = useCallback((x: number, z: number, rotation: number) => {
    setState(prev => ({
      ...prev,
      opponentPosition: { x, y: prev.opponentPosition.y, z },
      opponentRotation: rotation
    }));
  }, []);
  // Export the 2D version explicitly
  void updateOpponent2D; // Mark as intentionally unused (for future use)
  
  // Pause/Resume
  const togglePause = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);
  
  // Return to main menu
  const returnToMainMenu = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPlaying: false,
      menuScreen: 'main',
      currentRoom: null,
      worldGenerator: null,
      selectedCharacter: null,
      worldSeed: null
    }));
  }, []);
  
  // Room transitions
  const transitionToRoom = useCallback((roomId: string, entryDirection: 'north' | 'south' | 'east' | 'west') => {
    if (!worldGenRef.current) return;
    
    const newRoom = worldGenRef.current.generateRoomFromId(roomId);
    
    // Calculate entry position based on direction
    let entryX = 0;
    let entryZ = 0;
    
    switch (entryDirection) {
      case 'north':
        entryZ = newRoom.height / 2 - 2;
        break;
      case 'south':
        entryZ = -newRoom.height / 2 + 2;
        break;
      case 'east':
        entryX = -newRoom.width / 2 + 2;
        break;
      case 'west':
        entryX = newRoom.width / 2 - 2;
        break;
    }
    
    setState(prev => ({
      ...prev,
      currentRoom: newRoom,
      player: {
        ...prev.player,
        position: { x: entryX, y: prev.player.position.y, z: entryZ }
      }
    }));
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
    transitionToRoom
  };
}

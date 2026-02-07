// Core game types for the Llamas With Hats RPG

export type CharacterType = 'carl' | 'paul';

export interface WorldSeed {
  adjective1: string;
  adjective2: string;
  noun: string;
  seedString: string;
}

export interface SavedGame {
  id: string;
  worldSeed: WorldSeed;
  playerCharacter: CharacterType;
  currentStageId: string;
  currentRoom: string;
  currentFloor: number;
  playerPosition: { x: number; y: number; z: number };
  playerRotation: number;
  collectedItems: string[];
  completedQuests: string[];
  completedBeats: string[];
  horrorLevel: number;
  score: number;
  timestamp: number;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  cameraZoom: number;
  showMinimap: boolean;
}

export interface RoomConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  exits: RoomExit[];
  props: PropConfig[];
  enemies: EnemySpawn[];
}

export interface RoomExit {
  id?: string;
  direction: 'north' | 'south' | 'east' | 'west';
  targetRoom: string;
  position: { x: number; z: number };
  locked?: boolean;
  requiredItem?: string;
}

export interface PropConfig {
  type: string;
  position: { x: number; z: number };
  rotation: number;
  scale: number;
  interactive: boolean;
  itemDrop?: string;
}

export interface EnemySpawn {
  id?: string;
  type?: string;
  character?: CharacterType;
  position: { x: number; z: number };
  patrolRadius?: number;
  behavior?: string;
}

export interface PlayerState {
  position: { x: number; y: number; z: number };
  rotation: number;
  velocity: { x: number; z: number };
  health: number;
  maxHealth: number;
  inventory: string[];
  currentRoom?: string;  // Which room the player is in
  currentFloor?: number; // Which floor level (-1, 0, 1, etc.)
}

export interface AIEntity {
  id: string;
  type: CharacterType;
  position: { x: number; z: number };
  rotation: number;
  state: 'idle' | 'patrol' | 'chase' | 'flee';
  targetPosition: { x: number; z: number } | null;
}

// Word pools for procedural world generation
export const ADJECTIVES = [
  'Crimson', 'Shadowy', 'Whispering', 'Cursed', 'Ancient',
  'Haunted', 'Twisted', 'Forgotten', 'Sinister', 'Peculiar',
  'Mysterious', 'Desolate', 'Eerie', 'Macabre', 'Ghostly',
  'Murky', 'Gloomy', 'Dreary', 'Ominous', 'Forlorn',
  'Wretched', 'Blighted', 'Withered', 'Hollow', 'Frostbitten',
  'Sunken', 'Crumbling', 'Rotting', 'Venomous', 'Spectral'
];

export const NOUNS = [
  'Manor', 'Catacombs', 'Asylum', 'Tomb', 'Dungeon',
  'Fortress', 'Sanctum', 'Labyrinth', 'Caverns', 'Monastery',
  'Castle', 'Ruins', 'Lair', 'Temple', 'Prison',
  'Crypt', 'Basement', 'Warehouse', 'Chapel', 'Cellar',
  'Tower', 'Pit', 'Chamber', 'Vault', 'Depths'
];

// Menu states
export type MenuScreen = 
  | 'main'
  | 'newGame'
  | 'loadGame'
  | 'settings'
  | 'inGame';

export interface MenuState {
  currentScreen: MenuScreen;
  selectedCharacter: CharacterType | null;
  worldSeed: WorldSeed | null;
  savedGames: SavedGame[];
  settings: GameSettings;
}

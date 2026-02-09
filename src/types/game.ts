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
  difficulty: Difficulty;
  showTimer: boolean;
  hudColorScheme: HudColorScheme;
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
  | 'achievements'
  | 'stats'
  | 'inGame'
  | 'victory';

export interface MenuState {
  currentScreen: MenuScreen;
  selectedCharacter: CharacterType | null;
  worldSeed: WorldSeed | null;
  savedGames: SavedGame[];
  settings: GameSettings;
}

// Achievement system types
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: AchievementCondition;
  secret?: boolean;
  characterRequired?: CharacterType;
}

export type AchievementCondition =
  | { type: 'complete_stage'; stageId: string }
  | { type: 'complete_game' }
  | { type: 'collect_item'; itemId: string }
  | { type: 'visit_room'; roomPurpose: string; stageId: string }
  | { type: 'complete_as'; character: CharacterType }
  | { type: 'speed_run'; maxMinutes: number }
  | { type: 'completionist'; allItems: true }
  | { type: 'explore_all_rooms'; stageId: string }
  | { type: 'horror_max'; level: number }
  | { type: 'dialogue_branch'; dialogueId: string; branchId: string }
  | { type: 'play_count'; count: number }
  | { type: 'both_characters' }
  | { type: 'prop_examine_count'; count: number }
  | { type: 'npc_interact_count'; count: number }
  | { type: 'world_seed_count'; count: number }
  | { type: 'horror_below'; maxLevel: number; stageId: string };

export interface PlayerStats {
  gamesStarted: number;
  gamesCompleted: number;
  carlCompletions: number;
  paulCompletions: number;
  totalPlayTimeSeconds: number;
  fastestCompletionSeconds: number | null;
  roomsExplored: string[];
  itemsCollected: string[];
  beatsTriggered: string[];
  dialogueBranchesExplored: string[];
  encountersWitnessed: number;
  highestHorrorReached: number;
  propsExamined: string[];
  npcInteractions: number;
  worldSeedsUsed: string[];
}

export type Difficulty = 'normal' | 'nightmare';

export type HudColorScheme = 'default' | 'blood' | 'ocean' | 'void';

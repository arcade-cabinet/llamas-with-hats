/**
 * Achievement System
 * ==================
 *
 * Tracks achievement progress and unlocks across playthroughs.
 * Persists to localStorage. Emits events when achievements unlock
 * so the toast system can display notifications.
 */

import type { Achievement, AchievementCondition, PlayerStats, CharacterType } from '../types/game';

// ---------------------------------------------------------------------------
// Storage Keys
// ---------------------------------------------------------------------------

const ACHIEVEMENTS_KEY = 'llamas-rpg-achievements';
const STATS_KEY = 'llamas-rpg-stats';

// ---------------------------------------------------------------------------
// Default Stats
// ---------------------------------------------------------------------------

function defaultStats(): PlayerStats {
  return {
    gamesStarted: 0,
    gamesCompleted: 0,
    carlCompletions: 0,
    paulCompletions: 0,
    totalPlayTimeSeconds: 0,
    fastestCompletionSeconds: null,
    roomsExplored: [],
    itemsCollected: [],
    beatsTriggered: [],
    dialogueBranchesExplored: [],
    encountersWitnessed: 0,
    highestHorrorReached: 0,
    propsExamined: [],
    npcInteractions: 0,
    worldSeedsUsed: [],
  };
}

// ---------------------------------------------------------------------------
// Achievement Definitions
// ---------------------------------------------------------------------------

export const ACHIEVEMENTS: Achievement[] = [
  // Story achievements
  { id: 'morning_after', name: 'The Morning After', description: 'Complete Stage 1', icon: '🏠', condition: { type: 'complete_stage', stageId: 'stage1_house' } },
  { id: 'lost_in_space', name: 'Lost in Space', description: 'Complete Stage 2', icon: '🚀', condition: { type: 'complete_stage', stageId: 'stage2_space' } },
  { id: 'island_getaway', name: 'Island Getaway', description: 'Complete Stage 3', icon: '🏝️', condition: { type: 'complete_stage', stageId: 'stage3_pirate' } },
  { id: 'caaaaarl', name: 'CAAAAARL!', description: 'Complete the game as Carl', icon: '🎩', condition: { type: 'complete_as', character: 'carl' } },
  { id: 'that_kills_people', name: 'That Kills People!', description: 'Complete the game as Paul', icon: '🌸', condition: { type: 'complete_as', character: 'paul' } },
  { id: 'both_sides', name: 'Both Sides', description: 'Complete as both characters', icon: '🎭', condition: { type: 'both_characters' } },

  // Exploration achievements
  { id: 'nosy_neighbor', name: 'Nosy Neighbor', description: 'Visit every room in Stage 1', icon: '🔍', condition: { type: 'explore_all_rooms', stageId: 'stage1_house' } },
  { id: 'station_sweep', name: 'Station Sweep', description: 'Visit every room in Stage 2', icon: '🛸', condition: { type: 'explore_all_rooms', stageId: 'stage2_space' } },
  { id: 'island_explorer', name: 'Island Explorer', description: 'Visit every room in Stage 3', icon: '🗺️', condition: { type: 'explore_all_rooms', stageId: 'stage3_pirate' } },

  // Collection achievements
  { id: 'kleptomaniac', name: 'Kleptomaniac', description: 'Collect all items in a single stage', icon: '🎒', condition: { type: 'completionist', allItems: true } },

  // Speed achievements
  { id: 'speed_run', name: 'Speed Run', description: 'Complete all 3 stages in under 20 minutes', icon: '⚡', condition: { type: 'speed_run', maxMinutes: 20 } },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Complete all stages in under 15 minutes', icon: '💨', condition: { type: 'speed_run', maxMinutes: 15 } },

  // Horror achievements
  { id: 'desensitized', name: 'Desensitized', description: 'Reach max horror level (10)', icon: '😈', condition: { type: 'horror_max', level: 10 } },
  { id: 'brave_face', name: 'Brave Face', description: 'Complete Stage 1 without horror exceeding 5', icon: '😎', condition: { type: 'horror_below', maxLevel: 5, stageId: 'stage1_house' } },

  // Dialogue achievements
  { id: 'good_listener', name: 'Good Listener', description: 'Exhaust all dialogue branches in one NPC conversation', icon: '👂', condition: { type: 'dialogue_branch', dialogueId: 'any', branchId: 'all' } },
  { id: 'the_interrogator', name: 'The Interrogator', description: 'Talk to the opponent 5+ times in one stage', icon: '🗣️', condition: { type: 'npc_interact_count', count: 5 } },

  // Secret achievements
  { id: 'hands_on', name: 'Hands-On Experience', description: 'Find the broken phone in Stage 1', icon: '📱', condition: { type: 'collect_item', itemId: 'broken_phone' }, secret: true },
  { id: 'music_critic', name: 'Music Critic', description: "Pick up Carl's mixtape in Stage 2", icon: '💿', condition: { type: 'collect_item', itemId: 'carl_mixtape' }, secret: true },
  { id: 'fashion_forward', name: 'Fashion Forward', description: 'Pick up the bone necklace in Stage 3', icon: '📿', condition: { type: 'collect_item', itemId: 'bone_necklace' }, secret: true },
  { id: 'always_watching', name: 'Always Watching', description: 'Pick up the cursed compass', icon: '🧭', condition: { type: 'collect_item', itemId: 'cursed_compass' }, secret: true },

  // Replay achievements
  { id: 'frequent_flyer', name: 'Frequent Flyer', description: 'Start 5 games', icon: '✈️', condition: { type: 'play_count', count: 5 } },
  { id: 'dedicated', name: 'Dedicated', description: 'Start 10 games', icon: '🏆', condition: { type: 'play_count', count: 10 } },

  // Misc achievements
  { id: 'interior_decorator', name: 'Interior Decorator', description: 'Examine 20 different props in one playthrough', icon: '🪑', condition: { type: 'prop_examine_count', count: 20 } },
  { id: 'world_traveler', name: 'World Traveler', description: 'Play with 3 different world seeds', icon: '🌍', condition: { type: 'world_seed_count', count: 3 } },
];

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

export interface AchievementCallbacks {
  onUnlock?: (achievement: Achievement) => void;
}

// ---------------------------------------------------------------------------
// Achievement System Interface
// ---------------------------------------------------------------------------

export interface AchievementSystem {
  /** Set callbacks */
  setCallbacks(callbacks: AchievementCallbacks): void;

  /** Get all achievements with their unlock status */
  getAll(): Array<Achievement & { unlocked: boolean; unlockedAt?: number }>;

  /** Get unlocked achievement IDs */
  getUnlockedIds(): string[];

  /** Check if a specific achievement is unlocked */
  isUnlocked(id: string): boolean;

  /** Get player stats */
  getStats(): PlayerStats;

  /** Track a game start */
  trackGameStart(character: CharacterType, worldSeed: string): void;

  /** Track a stage completion */
  trackStageComplete(stageId: string, character: CharacterType): void;

  /** Track game completion */
  trackGameComplete(character: CharacterType, playTimeSeconds: number): void;

  /** Track an item collection */
  trackItemCollected(itemId: string): void;

  /** Track a room visit */
  trackRoomExplored(stageId: string, roomPurpose: string): void;

  /** Track a beat triggered */
  trackBeatTriggered(beatId: string): void;

  /** Track a prop examination */
  trackPropExamined(propId: string): void;

  /** Track an NPC interaction */
  trackNpcInteraction(): void;

  /** Track horror level */
  trackHorrorLevel(level: number): void;

  /** Track a dialogue branch explored */
  trackDialogueBranch(dialogueId: string, branchId: string): void;

  /** Track an encounter witnessed */
  trackEncounter(): void;

  /** Track play time (call periodically) */
  trackPlayTime(deltaSeconds: number): void;

  /** Get achievements unlocked during the current session */
  getSessionUnlocks(): Achievement[];

  /** Clear session unlocks (call on new game start) */
  clearSessionUnlocks(): void;

  /** Reset all stats and achievements (dangerous!) */
  resetAll(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createAchievementSystem(): AchievementSystem {
  let callbacks: AchievementCallbacks = {};
  let unlockedMap: Map<string, number> = new Map(); // achievementId -> timestamp
  let stats: PlayerStats = defaultStats();
  let sessionUnlocks: Achievement[] = [];

  // Per-run tracking (reset on new game)
  let currentRunPropsExamined = new Set<string>();
  let currentRunNpcInteractions = 0;
  let currentRunMaxHorror = 0;
  let currentRunStageHorrorPeaks = new Map<string, number>(); // stageId -> maxHorror
  let currentRunStageItems = new Map<string, Set<string>>(); // stageId -> collected items
  let currentRunStageRooms = new Map<string, Set<string>>(); // stageId -> visited rooms
  let currentRunCurrentStage = '';

  // Load from localStorage
  function load() {
    try {
      const achievementsJson = localStorage.getItem(ACHIEVEMENTS_KEY);
      if (achievementsJson) {
        const parsed = JSON.parse(achievementsJson);
        if (typeof parsed === 'object' && parsed !== null) {
          unlockedMap = new Map(Object.entries(parsed));
        }
      }
    } catch { /* ignore */ }

    try {
      const statsJson = localStorage.getItem(STATS_KEY);
      if (statsJson) {
        stats = { ...defaultStats(), ...JSON.parse(statsJson) };
      }
    } catch { /* ignore */ }
  }

  function saveAchievements() {
    const obj: Record<string, number> = {};
    for (const [id, ts] of unlockedMap) {
      obj[id] = ts;
    }
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(obj));
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function tryUnlock(achievement: Achievement): boolean {
    if (unlockedMap.has(achievement.id)) return false;

    unlockedMap.set(achievement.id, Date.now());
    sessionUnlocks.push(achievement);
    saveAchievements();
    callbacks.onUnlock?.(achievement);
    return true;
  }

  function checkCondition(condition: AchievementCondition): boolean {
    switch (condition.type) {
      case 'complete_stage':
        return stats.beatsTriggered.some(b => b.endsWith('_escape') || b.endsWith('_escape_station') || b.endsWith('_escape_island'));
      case 'complete_game':
        return stats.gamesCompleted > 0;
      case 'collect_item':
        return stats.itemsCollected.includes(condition.itemId);
      case 'complete_as':
        return condition.character === 'carl' ? stats.carlCompletions > 0 : stats.paulCompletions > 0;
      case 'both_characters':
        return stats.carlCompletions > 0 && stats.paulCompletions > 0;
      case 'speed_run':
        return stats.fastestCompletionSeconds !== null && stats.fastestCompletionSeconds <= condition.maxMinutes * 60;
      case 'play_count':
        return stats.gamesStarted >= condition.count;
      case 'horror_max':
        return stats.highestHorrorReached >= condition.level;
      case 'prop_examine_count':
        return currentRunPropsExamined.size >= condition.count;
      case 'npc_interact_count':
        return currentRunNpcInteractions >= condition.count;
      case 'world_seed_count':
        return stats.worldSeedsUsed.length >= condition.count;
      case 'horror_below': {
        const peak = currentRunStageHorrorPeaks.get(condition.stageId) ?? 0;
        return peak <= condition.maxLevel && stats.beatsTriggered.length > 0;
      }
      case 'explore_all_rooms': {
        const rooms = currentRunStageRooms.get(condition.stageId);
        if (!rooms) return false;
        // Check against known room counts per stage
        const requiredCounts: Record<string, number> = {
          'stage1_house': 6,  // entry_hall, living_room, kitchen, dining_room, master_bedroom, bathroom, basement_main, basement_storage minus optionals
          'stage2_space': 7,  // docking_bay, corridor_a, mess_hall, crew_quarters, medical_bay, engine_room, airlock
          'stage3_pirate': 7, // beach, dock, jungle_path, cave, captain_quarters, crow_nest, lighthouse
        };
        const required = requiredCounts[condition.stageId] ?? 5;
        return rooms.size >= required;
      }
      case 'completionist': {
        // Check if all items in current stage were collected
        const items = currentRunStageItems.get(currentRunCurrentStage);
        if (!items) return false;
        const requiredItems: Record<string, number> = {
          'stage1_house': 4,  // basement_key, bloody_note, carl_journal, broken_phone
          'stage2_space': 4,  // crew_log, medical_report, override_key, carl_mixtape
          'stage3_pirate': 4, // captain_log, bone_necklace, cursed_compass, carl_flag
        };
        const required = requiredItems[currentRunCurrentStage] ?? 3;
        return items.size >= required;
      }
      case 'dialogue_branch':
        // Checked externally when dialogue tree exhausted
        return false;
      case 'visit_room':
        return stats.roomsExplored.includes(`${condition.stageId}:${condition.roomPurpose}`);
      default:
        return false;
    }
  }

  /** Run through all achievements and try to unlock any that match */
  function checkAll() {
    for (const achievement of ACHIEVEMENTS) {
      if (unlockedMap.has(achievement.id)) continue;
      if (checkCondition(achievement.condition)) {
        tryUnlock(achievement);
      }
    }
  }

  // Initialize
  load();

  return {
    setCallbacks(cb: AchievementCallbacks) {
      callbacks = cb;
    },

    getAll() {
      return ACHIEVEMENTS.map(a => ({
        ...a,
        unlocked: unlockedMap.has(a.id),
        unlockedAt: unlockedMap.get(a.id),
      }));
    },

    getUnlockedIds() {
      return Array.from(unlockedMap.keys());
    },

    isUnlocked(id: string) {
      return unlockedMap.has(id);
    },

    getStats() {
      return { ...stats };
    },

    trackGameStart(_character: CharacterType, worldSeed: string) {
      stats.gamesStarted++;
      if (!stats.worldSeedsUsed.includes(worldSeed)) {
        stats.worldSeedsUsed.push(worldSeed);
      }
      // Reset per-run tracking
      currentRunPropsExamined = new Set();
      currentRunNpcInteractions = 0;
      currentRunMaxHorror = 0;
      currentRunStageHorrorPeaks = new Map();
      currentRunStageItems = new Map();
      currentRunStageRooms = new Map();
      currentRunCurrentStage = '';
      saveStats();
      checkAll();
    },

    trackStageComplete(stageId: string, _character: CharacterType) {
      // Check stage-specific achievements
      const stageAchievements: Record<string, string> = {
        'stage1_house': 'morning_after',
        'stage2_space': 'lost_in_space',
        'stage3_pirate': 'island_getaway',
      };
      const achievementId = stageAchievements[stageId];
      if (achievementId) {
        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (achievement) tryUnlock(achievement);
      }
      checkAll();
    },

    trackGameComplete(character: CharacterType, playTimeSeconds: number) {
      stats.gamesCompleted++;
      if (character === 'carl') stats.carlCompletions++;
      else stats.paulCompletions++;

      if (stats.fastestCompletionSeconds === null || playTimeSeconds < stats.fastestCompletionSeconds) {
        stats.fastestCompletionSeconds = playTimeSeconds;
      }
      saveStats();
      checkAll();
    },

    trackItemCollected(itemId: string) {
      if (!stats.itemsCollected.includes(itemId)) {
        stats.itemsCollected.push(itemId);
      }
      // Track per-stage
      if (!currentRunStageItems.has(currentRunCurrentStage)) {
        currentRunStageItems.set(currentRunCurrentStage, new Set());
      }
      currentRunStageItems.get(currentRunCurrentStage)!.add(itemId);
      saveStats();
      checkAll();
    },

    trackRoomExplored(stageId: string, roomPurpose: string) {
      currentRunCurrentStage = stageId;
      const key = `${stageId}:${roomPurpose}`;
      if (!stats.roomsExplored.includes(key)) {
        stats.roomsExplored.push(key);
      }
      if (!currentRunStageRooms.has(stageId)) {
        currentRunStageRooms.set(stageId, new Set());
      }
      currentRunStageRooms.get(stageId)!.add(roomPurpose);
      saveStats();
      checkAll();
    },

    trackBeatTriggered(beatId: string) {
      if (!stats.beatsTriggered.includes(beatId)) {
        stats.beatsTriggered.push(beatId);
      }
      saveStats();
    },

    trackPropExamined(propId: string) {
      currentRunPropsExamined.add(propId);
      if (!stats.propsExamined.includes(propId)) {
        stats.propsExamined.push(propId);
      }
      saveStats();
      checkAll();
    },

    trackNpcInteraction() {
      currentRunNpcInteractions++;
      stats.npcInteractions++;
      saveStats();
      checkAll();
    },

    trackHorrorLevel(level: number) {
      if (level > stats.highestHorrorReached) {
        stats.highestHorrorReached = level;
      }
      if (level > currentRunMaxHorror) {
        currentRunMaxHorror = level;
      }
      const currentPeak = currentRunStageHorrorPeaks.get(currentRunCurrentStage) ?? 0;
      if (level > currentPeak) {
        currentRunStageHorrorPeaks.set(currentRunCurrentStage, level);
      }
      saveStats();
      checkAll();
    },

    trackDialogueBranch(dialogueId: string, branchId: string) {
      const key = `${dialogueId}:${branchId}`;
      if (!stats.dialogueBranchesExplored.includes(key)) {
        stats.dialogueBranchesExplored.push(key);
      }
      saveStats();
    },

    trackEncounter() {
      stats.encountersWitnessed++;
      saveStats();
    },

    trackPlayTime(deltaSeconds: number) {
      stats.totalPlayTimeSeconds += deltaSeconds;
      // Only save periodically (every ~10 seconds) to avoid excessive writes
      if (Math.floor(stats.totalPlayTimeSeconds) % 10 === 0) {
        saveStats();
      }
    },

    getSessionUnlocks() {
      return [...sessionUnlocks];
    },

    clearSessionUnlocks() {
      sessionUnlocks = [];
    },

    resetAll() {
      unlockedMap.clear();
      stats = defaultStats();
      sessionUnlocks = [];
      localStorage.removeItem(ACHIEVEMENTS_KEY);
      localStorage.removeItem(STATS_KEY);
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: AchievementSystem | null = null;

export function getAchievementSystem(): AchievementSystem {
  if (!instance) {
    instance = createAchievementSystem();
  }
  return instance;
}

export function resetAchievementSystem(): void {
  instance = null;
}

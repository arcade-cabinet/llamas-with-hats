/**
 * Unlockable System
 * =================
 *
 * Tracks cross-playthrough unlockables: world seed modifiers,
 * stage mutators, HUD color schemes, and New Game+ state.
 *
 * Persists to localStorage under 'llamas-rpg-unlockables'.
 */

import type { CharacterType, HudColorScheme, Difficulty } from '../types/game';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const UNLOCKABLES_KEY = 'llamas-rpg-unlockables';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnlockableState {
  /** Has completed the game at least once */
  hasCompletedGame: boolean;
  /** Characters that have completed the game */
  completedAsCarl: boolean;
  completedAsPaul: boolean;
  /** Unlocked HUD color schemes */
  unlockedSchemes: HudColorScheme[];
  /** Unlocked world seed adjectives (bonus pool) */
  bonusAdjectives: string[];
  /** Unlocked world seed nouns (bonus pool) */
  bonusNouns: string[];
  /** New Game+ available */
  newGamePlusAvailable: boolean;
  /** Nightmare mode unlocked */
  nightmareUnlocked: boolean;
  /** Total completions */
  totalCompletions: number;
}

export interface NewGamePlusConfig {
  enabled: boolean;
  startingHorrorLevel: number;
  aiSpeedMultiplier: number;
  extraDialogueEnabled: boolean;
  extraQuestItems: boolean;
}

// ---------------------------------------------------------------------------
// Default State
// ---------------------------------------------------------------------------

function defaultState(): UnlockableState {
  return {
    hasCompletedGame: false,
    completedAsCarl: false,
    completedAsPaul: false,
    unlockedSchemes: ['default'],
    bonusAdjectives: [],
    bonusNouns: [],
    newGamePlusAvailable: false,
    nightmareUnlocked: false,
    totalCompletions: 0,
  };
}

// ---------------------------------------------------------------------------
// Bonus Word Pools (unlocked through play)
// ---------------------------------------------------------------------------

const BONUS_ADJECTIVES_CARL = ['Bloodsoaked', 'Artistic', 'Gourmet', 'Creative', 'Enthusiastic'];
const BONUS_ADJECTIVES_PAUL = ['Traumatized', 'Exhausted', 'Bewildered', 'Resilient', 'Scarred'];
const BONUS_NOUNS = ['Abattoir', 'Gallery', 'Kitchen', 'Workshop', 'Paradise'];

// ---------------------------------------------------------------------------
// Unlockable System Interface
// ---------------------------------------------------------------------------

export interface UnlockableSystem {
  /** Get current unlockable state */
  getState(): UnlockableState;

  /** Check if New Game+ is available */
  isNewGamePlusAvailable(): boolean;

  /** Check if nightmare mode is unlocked */
  isNightmareUnlocked(): boolean;

  /** Get unlocked HUD color schemes */
  getUnlockedSchemes(): HudColorScheme[];

  /** Get bonus word pool for world seed generation */
  getBonusAdjectives(): string[];
  getBonusNouns(): string[];

  /** Get New Game+ config based on previous completion */
  getNewGamePlusConfig(previousHorrorLevel: number): NewGamePlusConfig;

  /** Track a game completion — triggers unlocks */
  trackCompletion(character: CharacterType, finalHorrorLevel: number, difficulty: Difficulty): void;

  /** Reset all unlockables (dangerous!) */
  resetAll(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createUnlockableSystem(): UnlockableSystem {
  let state: UnlockableState;

  // Load from localStorage
  function load(): UnlockableState {
    try {
      const json = localStorage.getItem(UNLOCKABLES_KEY);
      if (json) {
        return { ...defaultState(), ...JSON.parse(json) };
      }
    } catch { /* ignore */ }
    return defaultState();
  }

  function save() {
    localStorage.setItem(UNLOCKABLES_KEY, JSON.stringify(state));
  }

  state = load();

  return {
    getState() {
      return { ...state };
    },

    isNewGamePlusAvailable() {
      return state.newGamePlusAvailable;
    },

    isNightmareUnlocked() {
      return state.nightmareUnlocked;
    },

    getUnlockedSchemes() {
      return [...state.unlockedSchemes];
    },

    getBonusAdjectives() {
      return [...state.bonusAdjectives];
    },

    getBonusNouns() {
      return [...state.bonusNouns];
    },

    getNewGamePlusConfig(previousHorrorLevel: number): NewGamePlusConfig {
      if (!state.newGamePlusAvailable) {
        return { enabled: false, startingHorrorLevel: 0, aiSpeedMultiplier: 1, extraDialogueEnabled: false, extraQuestItems: false };
      }

      return {
        enabled: true,
        startingHorrorLevel: Math.min(previousHorrorLevel, 7),
        aiSpeedMultiplier: 1.3,
        extraDialogueEnabled: true,
        extraQuestItems: true,
      };
    },

    trackCompletion(character: CharacterType, _finalHorrorLevel: number, difficulty: Difficulty) {
      state.hasCompletedGame = true;
      state.totalCompletions++;

      // Character-specific unlocks
      if (character === 'carl') {
        state.completedAsCarl = true;
        // Unlock Carl-themed scheme + adjectives
        if (!state.unlockedSchemes.includes('blood')) {
          state.unlockedSchemes.push('blood');
        }
        for (const adj of BONUS_ADJECTIVES_CARL) {
          if (!state.bonusAdjectives.includes(adj)) {
            state.bonusAdjectives.push(adj);
          }
        }
      } else {
        state.completedAsPaul = true;
        // Unlock Paul-themed scheme + adjectives
        if (!state.unlockedSchemes.includes('ocean')) {
          state.unlockedSchemes.push('ocean');
        }
        for (const adj of BONUS_ADJECTIVES_PAUL) {
          if (!state.bonusAdjectives.includes(adj)) {
            state.bonusAdjectives.push(adj);
          }
        }
      }

      // Both characters completed — unlock void scheme
      if (state.completedAsCarl && state.completedAsPaul) {
        if (!state.unlockedSchemes.includes('void')) {
          state.unlockedSchemes.push('void');
        }
      }

      // Unlock bonus nouns after first completion
      for (const noun of BONUS_NOUNS) {
        if (!state.bonusNouns.includes(noun)) {
          state.bonusNouns.push(noun);
        }
      }

      // New Game+ after first completion
      state.newGamePlusAvailable = true;

      // Nightmare mode after completing on normal
      if (difficulty === 'normal') {
        state.nightmareUnlocked = true;
      }

      save();
    },

    resetAll() {
      state = defaultState();
      localStorage.removeItem(UNLOCKABLES_KEY);
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: UnlockableSystem | null = null;

export function getUnlockableSystem(): UnlockableSystem {
  if (!instance) {
    instance = createUnlockableSystem();
  }
  return instance;
}

export function resetUnlockableSystem(): void {
  instance = null;
}

/**
 * Encounter System
 * ================
 *
 * Fires context-aware dialogue when the AI-controlled opponent enters
 * the same room as the player. Encounters are filtered by stage, room
 * purpose, prerequisite beats, probability, and per-encounter cooldowns.
 *
 * Data source: `src/data/global/encounters.json`
 */

import encounterData from '../data/global/encounters.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EncounterLine {
  speaker: string;
  text: string;
}

interface EncounterEffect {
  type: string;
  intensity: number;
}

interface EncounterDef {
  id: string;
  character: string;
  stageId: string;
  roomPurpose: string;
  requiredBeat?: string;
  probability: number;
  cooldown: number;
  lines: EncounterLine[];
  effects?: EncounterEffect[];
}

export interface EncounterResult {
  id: string;
  lines: EncounterLine[];
  effects?: EncounterEffect[];
}

export interface EncounterCallbacks {
  onEncounter?: (result: EncounterResult) => void;
}

export interface EncounterSystem {
  /** Set callbacks */
  setCallbacks(callbacks: EncounterCallbacks): void;

  /** Check for an encounter when opponent enters a room.
   * Returns the encounter result if one fires, null otherwise. */
  check(roomPurpose: string, stageId: string, opponentCharacter: string, completedBeats: string[]): EncounterResult | null;

  /** Update cooldowns — call each frame with deltaTime in seconds */
  update(deltaTime: number): void;

  /** Reset all cooldowns */
  reset(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createEncounterSystem(): EncounterSystem {
  const encounters: EncounterDef[] = encounterData.encounters as EncounterDef[];
  const cooldowns = new Map<string, number>(); // encounterId -> remaining seconds
  let callbacks: EncounterCallbacks = {};

  return {
    setCallbacks(cb: EncounterCallbacks) {
      callbacks = cb;
    },

    check(roomPurpose: string, stageId: string, opponentCharacter: string, completedBeats: string[]): EncounterResult | null {
      // Find matching encounters
      const eligible = encounters.filter(e => {
        if (e.stageId !== stageId) return false;
        if (e.roomPurpose !== roomPurpose) return false;
        if (e.character !== opponentCharacter) return false;
        if (e.requiredBeat && !completedBeats.includes(e.requiredBeat)) return false;
        if ((cooldowns.get(e.id) ?? 0) > 0) return false;
        return true;
      });

      if (eligible.length === 0) return null;

      // Pick a random eligible encounter
      const encounter = eligible[Math.floor(Math.random() * eligible.length)];

      // Probability check
      if (Math.random() > encounter.probability) return null;

      // Set cooldown
      cooldowns.set(encounter.id, encounter.cooldown);

      const result: EncounterResult = {
        id: encounter.id,
        lines: encounter.lines,
        effects: encounter.effects,
      };

      callbacks.onEncounter?.(result);
      return result;
    },

    update(deltaTime: number) {
      for (const [id, cd] of cooldowns) {
        const remaining = cd - deltaTime;
        if (remaining <= 0) {
          cooldowns.delete(id);
        } else {
          cooldowns.set(id, remaining);
        }
      }
    },

    reset() {
      cooldowns.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: EncounterSystem | null = null;

export function getEncounterSystem(): EncounterSystem {
  if (!instance) {
    instance = createEncounterSystem();
  }
  return instance;
}

export function resetEncounterSystem(): void {
  instance = null;
}

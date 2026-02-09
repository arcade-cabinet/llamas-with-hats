/**
 * Ambient Event System
 * ====================
 *
 * Fires random atmospheric events (dialogue, sound effects, visual effects)
 * during gameplay to add texture and replayability. Events are filtered by
 * current room purpose and horror level, with individual cooldowns to
 * prevent repetition.
 *
 * ## How It Works
 *
 * Every 15-30 seconds (randomized), the system picks a random eligible
 * event for the current room and horror level. If the event passes its
 * probability check and cooldown, it fires — showing dialogue, playing
 * a sound, or triggering a visual effect.
 */

import type { CharacterType } from '../types/game';
import ambientEventsData from '../data/global/ambient-events.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AmbientEventDef {
  id: string;
  type: 'dialogue' | 'sound' | 'effect';
  roomPurpose?: string;
  minHorrorLevel?: number;
  maxHorrorLevel?: number;
  probability: number;
  cooldown: number;
  carl?: string[];
  paul?: string[];
  narrator?: string[];
  sound?: string;
  effect?: 'screen_shake' | 'horror_pulse' | 'flicker';
}

export interface AmbientEventCallbacks {
  onDialogue?: (lines: string[], speaker: string) => void;
  onSound?: (soundId: string) => void;
  onEffect?: (effectType: string) => void;
}

export interface AmbientEventSystem {
  /** Set callbacks */
  setCallbacks(callbacks: AmbientEventCallbacks): void;

  /** Update the system — call every frame with deltaTime in seconds */
  update(deltaTime: number): void;

  /** Set the current room purpose (e.g., 'kitchen', 'medical_bay') */
  setRoom(roomPurpose: string): void;

  /** Set the current horror level (0-10) */
  setHorrorLevel(level: number): void;

  /** Set the player character */
  setCharacter(character: CharacterType): void;

  /** Pause/resume the system */
  setPaused(paused: boolean): void;

  /** Reset all cooldowns */
  reset(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createAmbientEventSystem(): AmbientEventSystem {
  const events: AmbientEventDef[] = ambientEventsData.events as AmbientEventDef[];
  let callbacks: AmbientEventCallbacks = {};

  let currentRoom = '';
  let horrorLevel = 0;
  let character: CharacterType = 'paul';
  let paused = false;

  // Timing
  let timer = randomInterval();
  const cooldowns = new Map<string, number>(); // eventId -> remaining cooldown seconds

  function randomInterval(): number {
    return 15 + Math.random() * 15; // 15-30 seconds
  }

  function isEligible(event: AmbientEventDef): boolean {
    // Room check
    if (event.roomPurpose && event.roomPurpose !== currentRoom) return false;

    // Horror range check
    const minH = event.minHorrorLevel ?? 0;
    const maxH = event.maxHorrorLevel ?? 10;
    if (horrorLevel < minH || horrorLevel > maxH) return false;

    // Cooldown check
    const cd = cooldowns.get(event.id) ?? 0;
    if (cd > 0) return false;

    return true;
  }

  function pickRandomLine(lines?: string[]): string | null {
    if (!lines || lines.length === 0) return null;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function fireEvent(event: AmbientEventDef) {
    // Set cooldown
    cooldowns.set(event.id, event.cooldown);

    switch (event.type) {
      case 'dialogue': {
        // Pick character-appropriate or narrator line
        const charLines = character === 'carl' ? event.carl : event.paul;
        const narratorLine = pickRandomLine(event.narrator);
        const charLine = pickRandomLine(charLines);

        // Prefer character line with some probability, otherwise narrator
        if (charLine && Math.random() < 0.5) {
          callbacks.onDialogue?.([`${character}: ${charLine}`], character);
        } else if (narratorLine) {
          callbacks.onDialogue?.([narratorLine], 'narrator');
        } else if (charLine) {
          callbacks.onDialogue?.([`${character}: ${charLine}`], character);
        }
        break;
      }
      case 'sound': {
        if (event.sound) {
          callbacks.onSound?.(event.sound);
        }
        // Also show dialogue if available
        const narratorLine = pickRandomLine(event.narrator);
        if (narratorLine) {
          callbacks.onDialogue?.([narratorLine], 'narrator');
        }
        break;
      }
      case 'effect': {
        if (event.effect) {
          callbacks.onEffect?.(event.effect);
        }
        // Also show dialogue if available
        const narratorLine = pickRandomLine(event.narrator);
        if (narratorLine) {
          callbacks.onDialogue?.([narratorLine], 'narrator');
        }
        break;
      }
    }
  }

  return {
    setCallbacks(cb: AmbientEventCallbacks) {
      callbacks = cb;
    },

    update(deltaTime: number) {
      if (paused) return;

      // Decrement all cooldowns
      for (const [id, cd] of cooldowns) {
        const remaining = cd - deltaTime;
        if (remaining <= 0) {
          cooldowns.delete(id);
        } else {
          cooldowns.set(id, remaining);
        }
      }

      // Decrement main timer
      timer -= deltaTime;
      if (timer > 0) return;

      // Reset timer
      timer = randomInterval();

      // Collect eligible events
      const eligible = events.filter(e => isEligible(e));
      if (eligible.length === 0) return;

      // Pick a random event
      const event = eligible[Math.floor(Math.random() * eligible.length)];

      // Probability check
      if (Math.random() > event.probability) return;

      fireEvent(event);
    },

    setRoom(roomPurpose: string) {
      currentRoom = roomPurpose;
    },

    setHorrorLevel(level: number) {
      horrorLevel = level;
    },

    setCharacter(char: CharacterType) {
      character = char;
    },

    setPaused(p: boolean) {
      paused = p;
    },

    reset() {
      cooldowns.clear();
      timer = randomInterval();
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: AmbientEventSystem | null = null;

export function getAmbientEventSystem(): AmbientEventSystem {
  if (!instance) {
    instance = createAmbientEventSystem();
  }
  return instance;
}

export function resetAmbientEventSystem(): void {
  instance = null;
}

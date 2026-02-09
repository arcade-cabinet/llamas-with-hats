/**
 * Tests for UnlockableSystem
 * ==========================
 *
 * Tests for default state, character-specific unlocks, HUD schemes,
 * bonus words, New Game+, nightmare mode, and resetAll.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createUnlockableSystem,
  UnlockableSystem,
} from './UnlockableSystem';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function mockLocalStorage() {
  const store: Record<string, string> = {};
  const mock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
  vi.stubGlobal('localStorage', mock);
  return mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createUnlockableSystem', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create a system with default state', () => {
    const sys = createUnlockableSystem();
    const state = sys.getState();

    expect(state.hasCompletedGame).toBe(false);
    expect(state.completedAsCarl).toBe(false);
    expect(state.completedAsPaul).toBe(false);
    expect(state.unlockedSchemes).toEqual(['default']);
    expect(state.bonusAdjectives).toEqual([]);
    expect(state.bonusNouns).toEqual([]);
    expect(state.newGamePlusAvailable).toBe(false);
    expect(state.nightmareUnlocked).toBe(false);
    expect(state.totalCompletions).toBe(0);
  });
});

describe('trackCompletion — Carl', () => {
  let sys: UnlockableSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createUnlockableSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should unlock blood scheme and Carl adjectives', () => {
    sys.trackCompletion('carl', 5, 'normal');

    const state = sys.getState();
    expect(state.completedAsCarl).toBe(true);
    expect(state.unlockedSchemes).toContain('blood');
    expect(state.bonusAdjectives).toContain('Bloodsoaked');
    expect(state.bonusAdjectives).toContain('Artistic');
    expect(state.bonusAdjectives).toContain('Gourmet');
    expect(state.bonusAdjectives).toContain('Creative');
    expect(state.bonusAdjectives).toContain('Enthusiastic');
  });

  it('should not unlock ocean scheme when completing as Carl', () => {
    sys.trackCompletion('carl', 5, 'normal');

    const state = sys.getState();
    expect(state.unlockedSchemes).not.toContain('ocean');
  });

  it('should unlock bonus nouns after completion', () => {
    sys.trackCompletion('carl', 5, 'normal');

    const state = sys.getState();
    expect(state.bonusNouns).toContain('Abattoir');
    expect(state.bonusNouns).toContain('Gallery');
    expect(state.bonusNouns).toContain('Kitchen');
    expect(state.bonusNouns).toContain('Workshop');
    expect(state.bonusNouns).toContain('Paradise');
  });

  it('should not duplicate adjectives on repeat completions', () => {
    sys.trackCompletion('carl', 5, 'normal');
    sys.trackCompletion('carl', 5, 'normal');

    const state = sys.getState();
    const bloodsoakedCount = state.bonusAdjectives.filter(a => a === 'Bloodsoaked').length;
    expect(bloodsoakedCount).toBe(1);
  });
});

describe('trackCompletion — Paul', () => {
  let sys: UnlockableSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createUnlockableSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should unlock ocean scheme and Paul adjectives', () => {
    sys.trackCompletion('paul', 3, 'normal');

    const state = sys.getState();
    expect(state.completedAsPaul).toBe(true);
    expect(state.unlockedSchemes).toContain('ocean');
    expect(state.bonusAdjectives).toContain('Traumatized');
    expect(state.bonusAdjectives).toContain('Exhausted');
    expect(state.bonusAdjectives).toContain('Bewildered');
    expect(state.bonusAdjectives).toContain('Resilient');
    expect(state.bonusAdjectives).toContain('Scarred');
  });

  it('should not unlock blood scheme when completing as Paul', () => {
    sys.trackCompletion('paul', 3, 'normal');

    const state = sys.getState();
    expect(state.unlockedSchemes).not.toContain('blood');
  });
});

describe('trackCompletion — both characters unlock void scheme', () => {
  let sys: UnlockableSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createUnlockableSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should not unlock void scheme after only one character completion', () => {
    sys.trackCompletion('carl', 5, 'normal');
    expect(sys.getState().unlockedSchemes).not.toContain('void');
  });

  it('should unlock void scheme after both character completions', () => {
    sys.trackCompletion('carl', 5, 'normal');
    sys.trackCompletion('paul', 3, 'normal');

    expect(sys.getState().unlockedSchemes).toContain('void');
  });

  it('should unlock void scheme regardless of completion order', () => {
    sys.trackCompletion('paul', 3, 'normal');
    sys.trackCompletion('carl', 5, 'normal');

    expect(sys.getState().unlockedSchemes).toContain('void');
  });
});

describe('isNewGamePlusAvailable', () => {
  let sys: UnlockableSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createUnlockableSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return false before any completion', () => {
    expect(sys.isNewGamePlusAvailable()).toBe(false);
  });

  it('should return true after first completion', () => {
    sys.trackCompletion('carl', 5, 'normal');
    expect(sys.isNewGamePlusAvailable()).toBe(true);
  });
});

describe('isNightmareUnlocked', () => {
  let sys: UnlockableSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createUnlockableSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return false before any completion', () => {
    expect(sys.isNightmareUnlocked()).toBe(false);
  });

  it('should return true after normal difficulty completion', () => {
    sys.trackCompletion('carl', 5, 'normal');
    expect(sys.isNightmareUnlocked()).toBe(true);
  });

  it('should remain false after nightmare difficulty completion only', () => {
    sys.trackCompletion('carl', 5, 'nightmare');
    expect(sys.isNightmareUnlocked()).toBe(false);
  });

  it('should return true if at least one normal completion exists', () => {
    sys.trackCompletion('carl', 5, 'nightmare');
    expect(sys.isNightmareUnlocked()).toBe(false);

    sys.trackCompletion('paul', 3, 'normal');
    expect(sys.isNightmareUnlocked()).toBe(true);
  });
});

describe('getNewGamePlusConfig', () => {
  let sys: UnlockableSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createUnlockableSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return disabled config when NG+ is not available', () => {
    const config = sys.getNewGamePlusConfig(5);

    expect(config.enabled).toBe(false);
    expect(config.startingHorrorLevel).toBe(0);
    expect(config.aiSpeedMultiplier).toBe(1);
    expect(config.extraDialogueEnabled).toBe(false);
    expect(config.extraQuestItems).toBe(false);
  });

  it('should return proper config when NG+ is available', () => {
    sys.trackCompletion('carl', 5, 'normal');

    const config = sys.getNewGamePlusConfig(5);

    expect(config.enabled).toBe(true);
    expect(config.startingHorrorLevel).toBe(5);
    expect(config.aiSpeedMultiplier).toBe(1.3);
    expect(config.extraDialogueEnabled).toBe(true);
    expect(config.extraQuestItems).toBe(true);
  });

  it('should clamp starting horror level to 7', () => {
    sys.trackCompletion('carl', 10, 'normal');

    const config = sys.getNewGamePlusConfig(10);

    expect(config.startingHorrorLevel).toBe(7);
  });

  it('should use previous horror level when below cap', () => {
    sys.trackCompletion('carl', 3, 'normal');

    const config = sys.getNewGamePlusConfig(3);
    expect(config.startingHorrorLevel).toBe(3);
  });
});

describe('getBonusAdjectives / getBonusNouns', () => {
  let sys: UnlockableSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createUnlockableSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return empty arrays by default', () => {
    expect(sys.getBonusAdjectives()).toEqual([]);
    expect(sys.getBonusNouns()).toEqual([]);
  });

  it('should return unlocked words after completion', () => {
    sys.trackCompletion('carl', 5, 'normal');

    const adjectives = sys.getBonusAdjectives();
    expect(adjectives.length).toBe(5);
    expect(adjectives).toContain('Bloodsoaked');

    const nouns = sys.getBonusNouns();
    expect(nouns.length).toBe(5);
    expect(nouns).toContain('Abattoir');
  });

  it('should return combined adjectives after both character completions', () => {
    sys.trackCompletion('carl', 5, 'normal');
    sys.trackCompletion('paul', 3, 'normal');

    const adjectives = sys.getBonusAdjectives();
    expect(adjectives.length).toBe(10); // 5 Carl + 5 Paul
    expect(adjectives).toContain('Bloodsoaked');
    expect(adjectives).toContain('Traumatized');
  });

  it('should return defensive copies (not mutable references)', () => {
    sys.trackCompletion('carl', 5, 'normal');

    const adj1 = sys.getBonusAdjectives();
    adj1.push('MUTATED');

    const adj2 = sys.getBonusAdjectives();
    expect(adj2).not.toContain('MUTATED');
  });
});

describe('resetAll', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should clear everything back to defaults', () => {
    const sys = createUnlockableSystem();
    sys.trackCompletion('carl', 5, 'normal');
    sys.trackCompletion('paul', 3, 'normal');

    expect(sys.isNewGamePlusAvailable()).toBe(true);
    expect(sys.getState().unlockedSchemes).toContain('void');

    sys.resetAll();

    const state = sys.getState();
    expect(state.hasCompletedGame).toBe(false);
    expect(state.completedAsCarl).toBe(false);
    expect(state.completedAsPaul).toBe(false);
    expect(state.unlockedSchemes).toEqual(['default']);
    expect(state.bonusAdjectives).toEqual([]);
    expect(state.bonusNouns).toEqual([]);
    expect(state.newGamePlusAvailable).toBe(false);
    expect(state.nightmareUnlocked).toBe(false);
    expect(state.totalCompletions).toBe(0);

    expect(localStorage.removeItem).toHaveBeenCalledWith('llamas-rpg-unlockables');
  });

  it('should allow re-tracking after reset', () => {
    const sys = createUnlockableSystem();
    sys.trackCompletion('carl', 5, 'normal');
    sys.resetAll();

    expect(sys.isNewGamePlusAvailable()).toBe(false);

    sys.trackCompletion('paul', 3, 'normal');
    expect(sys.isNewGamePlusAvailable()).toBe(true);
    expect(sys.getState().completedAsPaul).toBe(true);
    expect(sys.getState().completedAsCarl).toBe(false);
  });
});

describe('persistence', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should persist state to localStorage on completion', () => {
    const sys = createUnlockableSystem();
    sys.trackCompletion('carl', 5, 'normal');

    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('should load persisted state on creation', () => {
    const sys1 = createUnlockableSystem();
    sys1.trackCompletion('carl', 5, 'normal');

    // Create new system — should load from localStorage
    const sys2 = createUnlockableSystem();
    const state = sys2.getState();

    expect(state.completedAsCarl).toBe(true);
    expect(state.newGamePlusAvailable).toBe(true);
    expect(state.unlockedSchemes).toContain('blood');
  });
});

/**
 * Tests for AchievementSystem
 * ===========================
 *
 * Tests for achievement creation, stat tracking, unlock conditions,
 * session unlock management, callbacks, and secret achievement visibility.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createAchievementSystem,
  ACHIEVEMENTS,
  AchievementSystem,
} from './AchievementSystem';

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

describe('createAchievementSystem', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return a valid system with the full interface', () => {
    const sys = createAchievementSystem();

    expect(typeof sys.setCallbacks).toBe('function');
    expect(typeof sys.getAll).toBe('function');
    expect(typeof sys.getUnlockedIds).toBe('function');
    expect(typeof sys.isUnlocked).toBe('function');
    expect(typeof sys.getStats).toBe('function');
    expect(typeof sys.trackGameStart).toBe('function');
    expect(typeof sys.trackStageComplete).toBe('function');
    expect(typeof sys.trackGameComplete).toBe('function');
    expect(typeof sys.trackItemCollected).toBe('function');
    expect(typeof sys.trackRoomExplored).toBe('function');
    expect(typeof sys.trackBeatTriggered).toBe('function');
    expect(typeof sys.trackPropExamined).toBe('function');
    expect(typeof sys.trackNpcInteraction).toBe('function');
    expect(typeof sys.trackHorrorLevel).toBe('function');
    expect(typeof sys.trackDialogueBranch).toBe('function');
    expect(typeof sys.trackEncounter).toBe('function');
    expect(typeof sys.trackPlayTime).toBe('function');
    expect(typeof sys.getSessionUnlocks).toBe('function');
    expect(typeof sys.clearSessionUnlocks).toBe('function');
    expect(typeof sys.resetAll).toBe('function');
  });

  it('should start with zero stats and no unlocks', () => {
    const sys = createAchievementSystem();
    const stats = sys.getStats();

    expect(stats.gamesStarted).toBe(0);
    expect(stats.gamesCompleted).toBe(0);
    expect(stats.itemsCollected).toEqual([]);
    expect(stats.roomsExplored).toEqual([]);
    expect(sys.getUnlockedIds()).toEqual([]);
  });
});

describe('trackGameStart', () => {
  let sys: AchievementSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createAchievementSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should increment gamesStarted stat', () => {
    sys.trackGameStart('carl', 'seed-abc');
    expect(sys.getStats().gamesStarted).toBe(1);

    sys.trackGameStart('paul', 'seed-def');
    expect(sys.getStats().gamesStarted).toBe(2);
  });

  it('should track unique world seeds', () => {
    sys.trackGameStart('carl', 'seed-abc');
    sys.trackGameStart('carl', 'seed-abc'); // duplicate
    sys.trackGameStart('carl', 'seed-def');

    expect(sys.getStats().worldSeedsUsed).toEqual(['seed-abc', 'seed-def']);
  });

  it('should unlock frequent_flyer after 5 game starts', () => {
    for (let i = 0; i < 5; i++) {
      sys.trackGameStart('carl', `seed-${i}`);
    }
    expect(sys.isUnlocked('frequent_flyer')).toBe(true);
  });
});

describe('trackItemCollected', () => {
  let sys: AchievementSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createAchievementSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should add items to stats', () => {
    sys.trackItemCollected('key_a');
    sys.trackItemCollected('key_b');

    const stats = sys.getStats();
    expect(stats.itemsCollected).toContain('key_a');
    expect(stats.itemsCollected).toContain('key_b');
  });

  it('should not add duplicate items', () => {
    sys.trackItemCollected('key_a');
    sys.trackItemCollected('key_a');

    expect(sys.getStats().itemsCollected).toEqual(['key_a']);
  });

  it('should trigger unlock check for secret item achievements', () => {
    sys.trackItemCollected('broken_phone');
    expect(sys.isUnlocked('hands_on')).toBe(true);
  });

  it('should trigger unlock check for carl_mixtape', () => {
    sys.trackItemCollected('carl_mixtape');
    expect(sys.isUnlocked('music_critic')).toBe(true);
  });
});

describe('trackRoomExplored', () => {
  let sys: AchievementSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createAchievementSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should record room visits in stats', () => {
    sys.trackRoomExplored('stage1_house', 'kitchen');
    sys.trackRoomExplored('stage1_house', 'bedroom');

    const stats = sys.getStats();
    expect(stats.roomsExplored).toContain('stage1_house:kitchen');
    expect(stats.roomsExplored).toContain('stage1_house:bedroom');
  });

  it('should not add duplicate room visits', () => {
    sys.trackRoomExplored('stage1_house', 'kitchen');
    sys.trackRoomExplored('stage1_house', 'kitchen');

    expect(sys.getStats().roomsExplored).toEqual(['stage1_house:kitchen']);
  });
});

describe('trackGameComplete', () => {
  let sys: AchievementSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createAchievementSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should increment gamesCompleted', () => {
    sys.trackGameComplete('carl', 600);
    expect(sys.getStats().gamesCompleted).toBe(1);
  });

  it('should increment character-specific completions', () => {
    sys.trackGameComplete('carl', 600);
    expect(sys.getStats().carlCompletions).toBe(1);
    expect(sys.getStats().paulCompletions).toBe(0);

    sys.trackGameComplete('paul', 500);
    expect(sys.getStats().paulCompletions).toBe(1);
  });

  it('should track fastest completion time', () => {
    sys.trackGameComplete('carl', 900);
    expect(sys.getStats().fastestCompletionSeconds).toBe(900);

    sys.trackGameComplete('carl', 600);
    expect(sys.getStats().fastestCompletionSeconds).toBe(600);

    // Slower time should not overwrite
    sys.trackGameComplete('carl', 1200);
    expect(sys.getStats().fastestCompletionSeconds).toBe(600);
  });

  it('should check speed run achievements', () => {
    // Under 20 minutes = 1200 seconds
    sys.trackGameComplete('carl', 1100);
    expect(sys.isUnlocked('speed_run')).toBe(true);
    expect(sys.isUnlocked('speed_demon')).toBe(false);
  });

  it('should unlock speed_demon for under 15 minutes', () => {
    sys.trackGameComplete('carl', 800); // under 900 seconds (15 min)
    expect(sys.isUnlocked('speed_demon')).toBe(true);
    expect(sys.isUnlocked('speed_run')).toBe(true);
  });

  it('should unlock caaaaarl after completing as carl', () => {
    sys.trackGameComplete('carl', 600);
    expect(sys.isUnlocked('caaaaarl')).toBe(true);
  });

  it('should unlock that_kills_people after completing as paul', () => {
    sys.trackGameComplete('paul', 600);
    expect(sys.isUnlocked('that_kills_people')).toBe(true);
  });

  it('should unlock both_sides after completing as both characters', () => {
    sys.trackGameComplete('carl', 600);
    expect(sys.isUnlocked('both_sides')).toBe(false);

    sys.trackGameComplete('paul', 600);
    expect(sys.isUnlocked('both_sides')).toBe(true);
  });
});

describe('trackHorrorLevel', () => {
  let sys: AchievementSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createAchievementSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should update highest horror reached', () => {
    sys.trackHorrorLevel(5);
    expect(sys.getStats().highestHorrorReached).toBe(5);

    sys.trackHorrorLevel(8);
    expect(sys.getStats().highestHorrorReached).toBe(8);
  });

  it('should not lower highest horror reached', () => {
    sys.trackHorrorLevel(8);
    sys.trackHorrorLevel(3);
    expect(sys.getStats().highestHorrorReached).toBe(8);
  });

  it('should unlock desensitized at horror level 10', () => {
    sys.trackHorrorLevel(10);
    expect(sys.isUnlocked('desensitized')).toBe(true);
  });

  it('should not unlock desensitized at horror level 9', () => {
    sys.trackHorrorLevel(9);
    expect(sys.isUnlocked('desensitized')).toBe(false);
  });
});

describe('getAll', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return all achievements with unlock status', () => {
    const sys = createAchievementSystem();
    const all = sys.getAll();

    expect(all).toHaveLength(ACHIEVEMENTS.length);
    for (const a of all) {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('name');
      expect(a).toHaveProperty('description');
      expect(a).toHaveProperty('unlocked');
      expect(typeof a.unlocked).toBe('boolean');
    }
  });

  it('should show unlocked status after achievement is earned', () => {
    const sys = createAchievementSystem();
    sys.trackHorrorLevel(10);

    const all = sys.getAll();
    const desensitized = all.find(a => a.id === 'desensitized');
    expect(desensitized?.unlocked).toBe(true);
    expect(desensitized?.unlockedAt).toBeTypeOf('number');
  });
});

describe('getSessionUnlocks', () => {
  let sys: AchievementSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createAchievementSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return achievements unlocked in current session', () => {
    expect(sys.getSessionUnlocks()).toEqual([]);

    sys.trackHorrorLevel(10);
    const unlocks = sys.getSessionUnlocks();
    expect(unlocks.length).toBeGreaterThan(0);
    expect(unlocks.some(a => a.id === 'desensitized')).toBe(true);
  });

  it('should not re-add achievements already unlocked in a prior session', () => {
    sys.trackHorrorLevel(10);
    const firstUnlocks = sys.getSessionUnlocks();
    expect(firstUnlocks.some(a => a.id === 'desensitized')).toBe(true);

    // Create new system (simulating new session) that loads from storage
    const sys2 = createAchievementSystem();
    expect(sys2.isUnlocked('desensitized')).toBe(true);
    expect(sys2.getSessionUnlocks()).toEqual([]);

    // Tracking again should not re-unlock
    sys2.trackHorrorLevel(10);
    expect(sys2.getSessionUnlocks()).toEqual([]);
  });
});

describe('clearSessionUnlocks', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should clear the session unlock list', () => {
    const sys = createAchievementSystem();
    sys.trackHorrorLevel(10);
    expect(sys.getSessionUnlocks().length).toBeGreaterThan(0);

    sys.clearSessionUnlocks();
    expect(sys.getSessionUnlocks()).toEqual([]);
  });
});

describe('setCallbacks', () => {
  let sys: AchievementSystem;

  beforeEach(() => {
    mockLocalStorage();
    sys = createAchievementSystem();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fire onUnlock when an achievement triggers', () => {
    const onUnlock = vi.fn();
    sys.setCallbacks({ onUnlock });

    sys.trackHorrorLevel(10);

    expect(onUnlock).toHaveBeenCalled();
    const calledWith = onUnlock.mock.calls[0][0];
    expect(calledWith.id).toBe('desensitized');
  });

  it('should not fire onUnlock for already-unlocked achievements', () => {
    sys.trackHorrorLevel(10); // unlock without callback

    const onUnlock = vi.fn();
    sys.setCallbacks({ onUnlock });

    sys.trackHorrorLevel(10); // try again
    expect(onUnlock).not.toHaveBeenCalled();
  });
});

describe('secret achievements', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should have secret achievements in the definitions', () => {
    const secrets = ACHIEVEMENTS.filter(a => a.secret === true);
    expect(secrets.length).toBeGreaterThan(0);
  });

  it('should mark secret achievements as secret in getAll before unlock', () => {
    const sys = createAchievementSystem();
    const all = sys.getAll();

    const handsOn = all.find(a => a.id === 'hands_on');
    expect(handsOn?.secret).toBe(true);
    expect(handsOn?.unlocked).toBe(false);
  });

  it('should show secret achievements once unlocked', () => {
    const sys = createAchievementSystem();
    sys.trackItemCollected('broken_phone');

    const all = sys.getAll();
    const handsOn = all.find(a => a.id === 'hands_on');
    expect(handsOn?.unlocked).toBe(true);
    expect(handsOn?.secret).toBe(true); // still marked secret, but now unlocked
  });
});

describe('resetAll', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should clear all achievements, stats, and session unlocks', () => {
    const sys = createAchievementSystem();
    sys.trackGameStart('carl', 'seed-1');
    sys.trackHorrorLevel(10);
    expect(sys.isUnlocked('desensitized')).toBe(true);
    expect(sys.getStats().gamesStarted).toBe(1);

    sys.resetAll();

    expect(sys.getUnlockedIds()).toEqual([]);
    expect(sys.getStats().gamesStarted).toBe(0);
    expect(sys.getSessionUnlocks()).toEqual([]);
    expect(localStorage.removeItem).toHaveBeenCalled();
  });
});

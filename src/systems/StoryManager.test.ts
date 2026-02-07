/**
 * Tests for StoryManager
 * ======================
 *
 * Tests for story progression, beat triggers, callbacks, consequences,
 * serialization, prerequisite ordering, and duplicate activation prevention.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createStoryManager,
  StoryManager,
  StoryCallbacks,
} from './StoryManager';
import type { StoryBeat } from './StageDefinition';

// ---------------------------------------------------------------------------
// Helpers: reusable mock story beats
// ---------------------------------------------------------------------------

function makeBeat(overrides: Partial<StoryBeat> & { id: string }): StoryBeat {
  return {
    description: `Beat ${overrides.id}`,
    dialogueId: `dlg_${overrides.id}`,
    trigger: { type: 'scene_enter', params: { sceneId: 'room_a' } },
    ...overrides,
  };
}

function makeSceneEnterBeat(id: string, sceneId: string, consequences?: StoryBeat['consequences']): StoryBeat {
  return makeBeat({
    id,
    trigger: { type: 'scene_enter', params: { sceneId } },
    consequences,
  });
}

function makeItemPickupBeat(id: string, itemId: string, consequences?: StoryBeat['consequences']): StoryBeat {
  return makeBeat({
    id,
    trigger: { type: 'item_pickup', params: { itemId } },
    consequences,
  });
}

function makeNpcInteractBeat(id: string, npcId: string, consequences?: StoryBeat['consequences']): StoryBeat {
  return makeBeat({
    id,
    trigger: { type: 'npc_interact', params: { npcId } },
    consequences,
  });
}

function makeTimeElapsedBeat(id: string, seconds: number, consequences?: StoryBeat['consequences']): StoryBeat {
  return makeBeat({
    id,
    trigger: { type: 'time_elapsed', params: { seconds } },
    consequences,
  });
}

function makeKillsReachedBeat(id: string, count: number, consequences?: StoryBeat['consequences']): StoryBeat {
  return makeBeat({
    id,
    trigger: { type: 'kills_reached', params: { count } },
    consequences,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createStoryManager', () => {
  it('should return an object with the full StoryManager interface', () => {
    const sm = createStoryManager();

    expect(typeof sm.setCallbacks).toBe('function');
    expect(typeof sm.setCharacterPath).toBe('function');
    expect(typeof sm.loadBeats).toBe('function');
    expect(typeof sm.loadStage).toBe('function');
    expect(typeof sm.checkTrigger).toBe('function');
    expect(typeof sm.activateBeat).toBe('function');
    expect(typeof sm.getCurrentBeat).toBe('function');
    expect(typeof sm.getCompletedBeats).toBe('function');
    expect(typeof sm.isCompleted).toBe('function');
    expect(typeof sm.getHorrorLevel).toBe('function');
    expect(typeof sm.getState).toBe('function');
    expect(typeof sm.loadState).toBe('function');
    expect(typeof sm.reset).toBe('function');
  });

  it('should start with no current beat and horror level 0', () => {
    const sm = createStoryManager();
    expect(sm.getCurrentBeat()).toBeNull();
    expect(sm.getHorrorLevel()).toBe(0);
    expect(sm.getCompletedBeats()).toEqual([]);
  });
});

describe('loadBeats', () => {
  let sm: StoryManager;

  beforeEach(() => {
    sm = createStoryManager();
  });

  it('should load beats and make them activatable', () => {
    const beats: StoryBeat[] = [
      makeSceneEnterBeat('beat_1', 'kitchen'),
      makeSceneEnterBeat('beat_2', 'bedroom'),
    ];

    sm.loadBeats(beats);
    expect(sm.isCompleted('beat_1')).toBe(false);
    expect(sm.isCompleted('beat_2')).toBe(false);
  });

  it('should clear previous beats when loading new ones', () => {
    sm.loadBeats([makeSceneEnterBeat('old_beat', 'room')]);
    sm.activateBeat('old_beat');
    expect(sm.isCompleted('old_beat')).toBe(true);

    sm.loadBeats([makeSceneEnterBeat('new_beat', 'room')]);
    expect(sm.isCompleted('old_beat')).toBe(false);
    expect(sm.isCompleted('new_beat')).toBe(false);
  });
});

describe('checkTrigger - scene_enter', () => {
  let sm: StoryManager;

  beforeEach(() => {
    sm = createStoryManager();
  });

  it('should activate beat when scene_enter trigger matches', () => {
    sm.loadBeats([makeSceneEnterBeat('enter_kitchen', 'kitchen')]);
    sm.checkTrigger('scene_enter', { sceneId: 'kitchen' });

    expect(sm.isCompleted('enter_kitchen')).toBe(true);
  });

  it('should not activate beat when sceneId does not match', () => {
    sm.loadBeats([makeSceneEnterBeat('enter_kitchen', 'kitchen')]);
    sm.checkTrigger('scene_enter', { sceneId: 'bedroom' });

    expect(sm.isCompleted('enter_kitchen')).toBe(false);
  });
});

describe('checkTrigger - item_pickup', () => {
  let sm: StoryManager;

  beforeEach(() => {
    sm = createStoryManager();
  });

  it('should activate beat when item_pickup trigger matches', () => {
    sm.loadBeats([makeItemPickupBeat('pickup_key', 'basement_key')]);
    sm.checkTrigger('item_pickup', { itemId: 'basement_key' });

    expect(sm.isCompleted('pickup_key')).toBe(true);
  });

  it('should not activate beat when itemId does not match', () => {
    sm.loadBeats([makeItemPickupBeat('pickup_key', 'basement_key')]);
    sm.checkTrigger('item_pickup', { itemId: 'gold_key' });

    expect(sm.isCompleted('pickup_key')).toBe(false);
  });
});

describe('checkTrigger - npc_interact', () => {
  let sm: StoryManager;

  beforeEach(() => {
    sm = createStoryManager();
  });

  it('should activate beat when npc_interact trigger matches', () => {
    sm.loadBeats([makeNpcInteractBeat('talk_carl', 'carl')]);
    sm.checkTrigger('npc_interact', { npcId: 'carl' });

    expect(sm.isCompleted('talk_carl')).toBe(true);
  });

  it('should not activate beat when npcId does not match', () => {
    sm.loadBeats([makeNpcInteractBeat('talk_carl', 'carl')]);
    sm.checkTrigger('npc_interact', { npcId: 'paul' });

    expect(sm.isCompleted('talk_carl')).toBe(false);
  });
});

describe('checkTrigger - time_elapsed', () => {
  let sm: StoryManager;

  beforeEach(() => {
    sm = createStoryManager();
  });

  it('should activate beat when time_elapsed threshold is met', () => {
    sm.loadBeats([makeTimeElapsedBeat('timeout_30', 30)]);
    sm.checkTrigger('time_elapsed', { timeSeconds: 30 });

    expect(sm.isCompleted('timeout_30')).toBe(true);
  });

  it('should activate beat when time exceeds threshold', () => {
    sm.loadBeats([makeTimeElapsedBeat('timeout_30', 30)]);
    sm.checkTrigger('time_elapsed', { timeSeconds: 60 });

    expect(sm.isCompleted('timeout_30')).toBe(true);
  });

  it('should not activate beat when time is below threshold', () => {
    sm.loadBeats([makeTimeElapsedBeat('timeout_30', 30)]);
    sm.checkTrigger('time_elapsed', { timeSeconds: 20 });

    expect(sm.isCompleted('timeout_30')).toBe(false);
  });
});

describe('checkTrigger - kills_reached', () => {
  let sm: StoryManager;

  beforeEach(() => {
    sm = createStoryManager();
  });

  it('should activate beat when kills_reached threshold is met', () => {
    sm.loadBeats([makeKillsReachedBeat('rampage_5', 5)]);
    sm.checkTrigger('kills_reached', { killCount: 5 });

    expect(sm.isCompleted('rampage_5')).toBe(true);
  });

  it('should activate beat when kill count exceeds threshold', () => {
    sm.loadBeats([makeKillsReachedBeat('rampage_5', 5)]);
    sm.checkTrigger('kills_reached', { killCount: 10 });

    expect(sm.isCompleted('rampage_5')).toBe(true);
  });

  it('should not activate beat when kill count is below threshold', () => {
    sm.loadBeats([makeKillsReachedBeat('rampage_5', 5)]);
    sm.checkTrigger('kills_reached', { killCount: 3 });

    expect(sm.isCompleted('rampage_5')).toBe(false);
  });
});

describe('beat activation and consequences', () => {
  let sm: StoryManager;

  beforeEach(() => {
    sm = createStoryManager();
  });

  it('should apply horrorLevelChange consequence', () => {
    sm.loadBeats([
      makeSceneEnterBeat('scary', 'cellar', { horrorLevelChange: 3 }),
    ]);
    sm.checkTrigger('scene_enter', { sceneId: 'cellar' });

    expect(sm.getHorrorLevel()).toBe(3);
  });

  it('should clamp horror level between 0 and 10', () => {
    sm.loadBeats([
      makeSceneEnterBeat('b1', 'a', { horrorLevelChange: 8 }),
      makeSceneEnterBeat('b2', 'b', { horrorLevelChange: 5 }),
    ]);

    sm.checkTrigger('scene_enter', { sceneId: 'a' });
    expect(sm.getHorrorLevel()).toBe(8);

    sm.checkTrigger('scene_enter', { sceneId: 'b' });
    expect(sm.getHorrorLevel()).toBe(10); // clamped at 10, not 13
  });

  it('should not go below 0 for horror level', () => {
    sm.loadBeats([
      makeSceneEnterBeat('calm', 'spa', { horrorLevelChange: -5 }),
    ]);

    sm.checkTrigger('scene_enter', { sceneId: 'spa' });
    expect(sm.getHorrorLevel()).toBe(0);
  });

  it('should call onUnlock for unlockExits consequences', () => {
    const onUnlock = vi.fn();
    sm.setCallbacks({ onUnlock });

    sm.loadBeats([
      makeSceneEnterBeat('discover', 'kitchen', {
        unlockExits: ['door_1', 'door_2'],
      }),
    ]);

    sm.checkTrigger('scene_enter', { sceneId: 'kitchen' });

    expect(onUnlock).toHaveBeenCalledTimes(2);
    expect(onUnlock).toHaveBeenCalledWith('door_1');
    expect(onUnlock).toHaveBeenCalledWith('door_2');
  });

  it('should call onSpawn for spawnItems consequences', () => {
    const onSpawn = vi.fn();
    sm.setCallbacks({ onSpawn });

    sm.loadBeats([
      makeSceneEnterBeat('reveal', 'bedroom', {
        spawnItems: ['key_item', 'potion'],
      }),
    ]);

    sm.checkTrigger('scene_enter', { sceneId: 'bedroom' });

    expect(onSpawn).toHaveBeenCalledTimes(2);
    expect(onSpawn).toHaveBeenCalledWith('key_item');
    expect(onSpawn).toHaveBeenCalledWith('potion');
  });

  it('should call onDespawn for despawnItems consequences', () => {
    const onDespawn = vi.fn();
    sm.setCallbacks({ onDespawn });

    sm.loadBeats([
      makeSceneEnterBeat('cleanup', 'room_x', {
        despawnItems: ['evidence'],
      }),
    ]);

    sm.checkTrigger('scene_enter', { sceneId: 'room_x' });

    expect(onDespawn).toHaveBeenCalledTimes(1);
    expect(onDespawn).toHaveBeenCalledWith('evidence');
  });
});

describe('callback firing', () => {
  let sm: StoryManager;
  let callbacks: StoryCallbacks;

  beforeEach(() => {
    sm = createStoryManager();
    callbacks = {
      onDialogue: vi.fn(),
      onHorrorChange: vi.fn(),
      onUnlock: vi.fn(),
      onSpawn: vi.fn(),
      onDespawn: vi.fn(),
      onBeatComplete: vi.fn(),
    };
    sm.setCallbacks(callbacks);
  });

  it('should fire onDialogue with beat description and speaker carl for order path', () => {
    sm.setCharacterPath('order');
    sm.loadBeats([makeSceneEnterBeat('b1', 'room')]);
    sm.checkTrigger('scene_enter', { sceneId: 'room' });

    expect(callbacks.onDialogue).toHaveBeenCalledTimes(1);
    expect(callbacks.onDialogue).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(String)]),
      'carl'
    );
  });

  it('should fire onDialogue with speaker paul for chaos path', () => {
    sm.setCharacterPath('chaos');
    sm.loadBeats([makeSceneEnterBeat('b1', 'room')]);
    sm.checkTrigger('scene_enter', { sceneId: 'room' });

    expect(callbacks.onDialogue).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(String)]),
      'paul'
    );
  });

  it('should fire onHorrorChange with new level and delta', () => {
    sm.loadBeats([
      makeSceneEnterBeat('scare', 'dungeon', { horrorLevelChange: 4 }),
    ]);
    sm.checkTrigger('scene_enter', { sceneId: 'dungeon' });

    expect(callbacks.onHorrorChange).toHaveBeenCalledWith(4, 4);
  });

  it('should fire onBeatComplete with beat id', () => {
    sm.loadBeats([makeSceneEnterBeat('my_beat', 'room')]);
    sm.checkTrigger('scene_enter', { sceneId: 'room' });

    expect(callbacks.onBeatComplete).toHaveBeenCalledWith('my_beat');
  });
});

describe('beat prerequisite ordering (nextBeat chain)', () => {
  let sm: StoryManager;

  beforeEach(() => {
    sm = createStoryManager();
  });

  it('should set currentBeat via nextBeat consequence', () => {
    sm.loadBeats([
      makeSceneEnterBeat('step_1', 'room_a', { nextBeat: 'step_2' }),
      makeItemPickupBeat('step_2', 'key'),
    ]);

    expect(sm.getCurrentBeat()).toBeNull();

    sm.checkTrigger('scene_enter', { sceneId: 'room_a' });
    expect(sm.getCurrentBeat()).toBe('step_2');
  });

  it('should chain multiple beats via nextBeat', () => {
    sm.loadBeats([
      makeSceneEnterBeat('a', 'r1', { nextBeat: 'b' }),
      makeSceneEnterBeat('b', 'r2', { nextBeat: 'c' }),
      makeSceneEnterBeat('c', 'r3'),
    ]);

    sm.checkTrigger('scene_enter', { sceneId: 'r1' });
    expect(sm.getCurrentBeat()).toBe('b');

    sm.checkTrigger('scene_enter', { sceneId: 'r2' });
    expect(sm.getCurrentBeat()).toBe('c');

    sm.checkTrigger('scene_enter', { sceneId: 'r3' });
    // After c completes with no nextBeat, currentBeat stays as c
    // because the last executed nextBeat was c (set during b's activation)
    // and c itself has no nextBeat consequence to change it further
    expect(sm.isCompleted('c')).toBe(true);
  });
});

describe('getState / loadState serialization round-trip', () => {
  it('should serialize and restore full state', () => {
    const sm1 = createStoryManager();
    sm1.loadBeats([
      makeSceneEnterBeat('beat_a', 'room_1', { horrorLevelChange: 2, nextBeat: 'beat_b' }),
      makeSceneEnterBeat('beat_b', 'room_2'),
    ]);

    sm1.setCharacterPath('chaos');
    sm1.checkTrigger('scene_enter', { sceneId: 'room_1' });

    const state = sm1.getState();

    expect(state.completedBeats).toContain('beat_a');
    expect(state.horrorLevel).toBe(2);
    expect(state.currentBeat).toBe('beat_b');
    expect(state.characterPath).toBe('chaos');

    // Create a fresh manager, load same beats, then restore state
    const sm2 = createStoryManager();
    sm2.loadBeats([
      makeSceneEnterBeat('beat_a', 'room_1', { horrorLevelChange: 2, nextBeat: 'beat_b' }),
      makeSceneEnterBeat('beat_b', 'room_2'),
    ]);
    sm2.loadState(state);

    expect(sm2.isCompleted('beat_a')).toBe(true);
    expect(sm2.isCompleted('beat_b')).toBe(false);
    expect(sm2.getHorrorLevel()).toBe(2);
    expect(sm2.getCurrentBeat()).toBe('beat_b');
  });

  it('should round-trip through JSON', () => {
    const sm = createStoryManager();
    sm.loadBeats([
      makeSceneEnterBeat('x', 'room', { horrorLevelChange: 5 }),
    ]);
    sm.checkTrigger('scene_enter', { sceneId: 'room' });

    const json = JSON.stringify(sm.getState());
    const restored = JSON.parse(json);

    const sm2 = createStoryManager();
    sm2.loadBeats([makeSceneEnterBeat('x', 'room', { horrorLevelChange: 5 })]);
    sm2.loadState(restored);

    expect(sm2.isCompleted('x')).toBe(true);
    expect(sm2.getHorrorLevel()).toBe(5);
  });
});

describe('reset', () => {
  it('should clear all completed beats and reset horror level', () => {
    const sm = createStoryManager();
    sm.loadBeats([
      makeSceneEnterBeat('a', 'room', { horrorLevelChange: 3 }),
    ]);

    sm.checkTrigger('scene_enter', { sceneId: 'room' });
    expect(sm.isCompleted('a')).toBe(true);
    expect(sm.getHorrorLevel()).toBe(3);

    sm.reset();

    expect(sm.isCompleted('a')).toBe(false);
    expect(sm.getCompletedBeats()).toEqual([]);
    expect(sm.getCurrentBeat()).toBeNull();
    expect(sm.getHorrorLevel()).toBe(0);
  });

  it('should allow beats to be triggered again after reset', () => {
    const onBeatComplete = vi.fn();
    const sm = createStoryManager();
    sm.setCallbacks({ onBeatComplete });
    sm.loadBeats([makeSceneEnterBeat('repeatable', 'room')]);

    sm.checkTrigger('scene_enter', { sceneId: 'room' });
    expect(onBeatComplete).toHaveBeenCalledTimes(1);

    sm.reset();
    sm.checkTrigger('scene_enter', { sceneId: 'room' });
    expect(onBeatComplete).toHaveBeenCalledTimes(2);
  });
});

describe('duplicate beat activation prevention', () => {
  it('should not activate a beat that is already completed', () => {
    const onBeatComplete = vi.fn();
    const sm = createStoryManager();
    sm.setCallbacks({ onBeatComplete });
    sm.loadBeats([makeSceneEnterBeat('once_only', 'room')]);

    sm.checkTrigger('scene_enter', { sceneId: 'room' });
    sm.checkTrigger('scene_enter', { sceneId: 'room' });

    expect(onBeatComplete).toHaveBeenCalledTimes(1);
    expect(sm.getCompletedBeats()).toEqual(['once_only']);
  });

  it('should not activate via activateBeat if already completed', () => {
    const onDialogue = vi.fn();
    const sm = createStoryManager();
    sm.setCallbacks({ onDialogue });
    sm.loadBeats([makeSceneEnterBeat('b', 'room')]);

    sm.activateBeat('b');
    sm.activateBeat('b');

    expect(onDialogue).toHaveBeenCalledTimes(1);
  });

  it('should ignore activateBeat for unknown beat ids', () => {
    const onBeatComplete = vi.fn();
    const sm = createStoryManager();
    sm.setCallbacks({ onBeatComplete });
    sm.loadBeats([makeSceneEnterBeat('real', 'room')]);

    sm.activateBeat('nonexistent');

    expect(onBeatComplete).not.toHaveBeenCalled();
  });
});

describe('cross-trigger type isolation', () => {
  it('should not activate scene_enter beat from item_pickup trigger', () => {
    const sm = createStoryManager();
    sm.loadBeats([makeSceneEnterBeat('enter_beat', 'kitchen')]);

    sm.checkTrigger('item_pickup', { itemId: 'kitchen' });

    expect(sm.isCompleted('enter_beat')).toBe(false);
  });

  it('should activate multiple beats from the same trigger event', () => {
    const sm = createStoryManager();
    sm.loadBeats([
      makeSceneEnterBeat('beat_a', 'hallway'),
      makeSceneEnterBeat('beat_b', 'hallway'),
    ]);

    sm.checkTrigger('scene_enter', { sceneId: 'hallway' });

    expect(sm.isCompleted('beat_a')).toBe(true);
    expect(sm.isCompleted('beat_b')).toBe(true);
  });
});

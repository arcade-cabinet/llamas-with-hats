/**
 * Tests for EncounterSystem
 * =========================
 *
 * Tests for system creation, encounter matching, prerequisite beats,
 * cooldowns, probability filtering, update, callbacks, and singleton.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createEncounterSystem,
  getEncounterSystem,
  resetEncounterSystem,
  EncounterSystem,
} from './EncounterSystem';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createEncounterSystem', () => {
  it('should create a system successfully with the full interface', () => {
    const sys = createEncounterSystem();

    expect(typeof sys.setCallbacks).toBe('function');
    expect(typeof sys.check).toBe('function');
    expect(typeof sys.update).toBe('function');
    expect(typeof sys.reset).toBe('function');
  });
});

describe('check — no match', () => {
  let sys: EncounterSystem;

  beforeEach(() => {
    sys = createEncounterSystem();
  });

  it('should return null when no encounters match the room', () => {
    // Use a room that does not exist in any encounter definition
    const result = sys.check('nonexistent_room', 'stage1_house', 'carl', []);
    expect(result).toBeNull();
  });

  it('should return null when stageId does not match', () => {
    // kitchen exists in stage1_house, not stage2_space
    const result = sys.check('kitchen', 'stage2_space', 'carl', []);
    expect(result).toBeNull();
  });

  it('should return null when character does not match', () => {
    // carl_bedroom_lurk requires character='carl', so checking 'paul' yields nothing
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = sys.check('master_bedroom', 'stage1_house', 'paul', []);
    expect(result).toBeNull();
    vi.spyOn(Math, 'random').mockRestore();
  });
});

describe('check — matching encounter', () => {
  let sys: EncounterSystem;

  beforeEach(() => {
    sys = createEncounterSystem();
    // Force Math.random to always return 0, which picks the first eligible
    // and always passes probability (0 <= probability for all encounters)
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should return encounter when room/stage/character match', () => {
    // carl_bedroom_lurk: carl, stage1_house, master_bedroom, no requiredBeat, prob 0.35
    const result = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('carl_bedroom_lurk');
    expect(result!.lines.length).toBeGreaterThan(0);
  });

  it('should return encounter with effects when present', () => {
    // carl_kitchen_surprise has effects and requires beat 'discover_blood'
    const result = sys.check('kitchen', 'stage1_house', 'carl', ['discover_blood']);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('carl_kitchen_surprise');
    expect(result!.effects).toBeDefined();
    expect(result!.effects!.length).toBeGreaterThan(0);
  });
});

describe('check — requiredBeat prerequisite', () => {
  let sys: EncounterSystem;

  beforeEach(() => {
    sys = createEncounterSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should not return encounter when required beat is not completed', () => {
    // carl_kitchen_surprise requires 'discover_blood'
    const result = sys.check('kitchen', 'stage1_house', 'carl', []);
    expect(result).toBeNull();
  });

  it('should return encounter when required beat is completed', () => {
    const result = sys.check('kitchen', 'stage1_house', 'carl', ['discover_blood']);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('carl_kitchen_surprise');
  });
});

describe('check — cooldowns', () => {
  let sys: EncounterSystem;

  beforeEach(() => {
    sys = createEncounterSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should not return the same encounter while on cooldown', () => {
    // First check should fire
    const result1 = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(result1).not.toBeNull();
    expect(result1!.id).toBe('carl_bedroom_lurk');

    // Second check should return null (cooldown = 150s)
    const result2 = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(result2).toBeNull();
  });

  it('should allow encounter again after cooldown expires', () => {
    const result1 = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(result1).not.toBeNull();

    // Advance past cooldown (150s)
    sys.update(151);

    const result2 = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(result2).not.toBeNull();
    expect(result2!.id).toBe('carl_bedroom_lurk');
  });
});

describe('check — probability filtering', () => {
  let sys: EncounterSystem;

  beforeEach(() => {
    sys = createEncounterSystem();
  });

  it('should return null when probability check fails', () => {
    // carl_bedroom_lurk has probability 0.35
    // If Math.random returns 0.99 (> 0.35), the probability check should fail
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const result = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(result).toBeNull();

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should return encounter when probability check passes', () => {
    // Return 0 for both the pick and the probability check
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(result).not.toBeNull();

    vi.spyOn(Math, 'random').mockRestore();
  });
});

describe('update', () => {
  let sys: EncounterSystem;

  beforeEach(() => {
    sys = createEncounterSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should decrement cooldowns', () => {
    // Fire an encounter to set its cooldown
    sys.check('master_bedroom', 'stage1_house', 'carl', []);

    // Still on cooldown
    sys.update(100);
    const resultOnCooldown = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(resultOnCooldown).toBeNull();

    // Advance past remaining cooldown (150 - 100 = 50 remaining)
    sys.update(51);
    const resultAfterCooldown = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(resultAfterCooldown).not.toBeNull();
  });

  it('should remove cooldowns that reach zero', () => {
    sys.check('master_bedroom', 'stage1_house', 'carl', []);
    sys.update(200); // well past the 150s cooldown

    const result = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(result).not.toBeNull();
  });
});

describe('setCallbacks', () => {
  let sys: EncounterSystem;

  beforeEach(() => {
    sys = createEncounterSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should fire onEncounter when encounter triggers', () => {
    const onEncounter = vi.fn();
    sys.setCallbacks({ onEncounter });

    sys.check('master_bedroom', 'stage1_house', 'carl', []);

    expect(onEncounter).toHaveBeenCalledTimes(1);
    const result = onEncounter.mock.calls[0][0];
    expect(result.id).toBe('carl_bedroom_lurk');
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it('should not fire onEncounter when no encounter triggers', () => {
    const onEncounter = vi.fn();
    sys.setCallbacks({ onEncounter });

    sys.check('nonexistent_room', 'stage1_house', 'carl', []);

    expect(onEncounter).not.toHaveBeenCalled();
  });
});

describe('reset', () => {
  let sys: EncounterSystem;

  beforeEach(() => {
    sys = createEncounterSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should clear all cooldowns', () => {
    // Fire to set cooldown
    sys.check('master_bedroom', 'stage1_house', 'carl', []);

    // On cooldown
    const resultOnCooldown = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(resultOnCooldown).toBeNull();

    // Reset clears cooldowns
    sys.reset();

    const resultAfterReset = sys.check('master_bedroom', 'stage1_house', 'carl', []);
    expect(resultAfterReset).not.toBeNull();
  });
});

describe('singleton getEncounterSystem', () => {
  beforeEach(() => {
    resetEncounterSystem();
  });

  afterEach(() => {
    resetEncounterSystem();
  });

  it('should return the same instance on multiple calls', () => {
    const instance1 = getEncounterSystem();
    const instance2 = getEncounterSystem();
    expect(instance1).toBe(instance2);
  });

  it('should return a new instance after reset', () => {
    const instance1 = getEncounterSystem();
    resetEncounterSystem();
    const instance2 = getEncounterSystem();
    expect(instance1).not.toBe(instance2);
  });
});

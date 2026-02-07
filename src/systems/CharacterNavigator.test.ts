/**
 * Tests for CharacterNavigator
 * ============================
 * 
 * Tests for navigation, pathfinding, and AI behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createCharacterNavigator, 
  createAIBehavior,
  CharacterNavigator,
  AIBehavior 
} from './CharacterNavigator';

describe('createCharacterNavigator', () => {
  let navigator: CharacterNavigator;

  beforeEach(() => {
    navigator = createCharacterNavigator({
      startX: 0,
      startZ: 0,
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
      maxSpeed: 4,
      maxForce: 10
    });
  });

  describe('initialization', () => {
    it('should start at specified position', () => {
      const pos = navigator.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.z).toBe(0);
    });

    it('should start in idle mode', () => {
      expect(navigator.getMode()).toBe('idle');
    });

    it('should not be arrived initially', () => {
      expect(navigator.hasArrived()).toBe(false);
    });
  });

  describe('setPosition', () => {
    it('should update position', () => {
      navigator.setPosition(5, 5);
      const pos = navigator.getPosition();
      
      expect(pos.x).toBe(5);
      expect(pos.z).toBe(5);
    });
  });

  describe('idle', () => {
    it('should set mode to idle', () => {
      navigator.wander();
      navigator.idle();
      
      expect(navigator.getMode()).toBe('idle');
    });

    it('should stop movement', () => {
      navigator.moveTo(5, 5);
      navigator.idle();
      
      // After going idle, mode should be idle
      expect(navigator.getMode()).toBe('idle');
    });
  });

  describe('moveTo', () => {
    it('should set mode to moveTo', () => {
      navigator.moveTo(5, 5);
      expect(navigator.getMode()).toBe('moveTo');
    });

    it('should set target in state', () => {
      navigator.moveTo(5, 5);
      const state = navigator.getState();
      
      expect(state.targetX).toBe(5);
      expect(state.targetZ).toBe(5);
    });

    it('should not be arrived at start', () => {
      navigator.moveTo(5, 5);
      expect(navigator.hasArrived()).toBe(false);
    });
  });

  describe('wander', () => {
    it('should set mode to wander', () => {
      navigator.wander();
      expect(navigator.getMode()).toBe('wander');
    });
  });

  describe('follow', () => {
    it('should set mode to follow', () => {
      navigator.follow(3, 3);
      expect(navigator.getMode()).toBe('follow');
    });

    it('should track target position', () => {
      navigator.follow(3, 3);
      const state = navigator.getState();
      
      expect(state.targetX).toBe(3);
      expect(state.targetZ).toBe(3);
    });
  });

  describe('flee', () => {
    it('should set mode to flee', () => {
      navigator.flee(3, 3);
      expect(navigator.getMode()).toBe('flee');
    });
  });

  describe('updateTarget', () => {
    it('should update target for follow mode', () => {
      navigator.follow(0, 0);
      navigator.updateTarget(5, 5);
      
      const state = navigator.getState();
      expect(state.targetX).toBe(5);
      expect(state.targetZ).toBe(5);
    });
  });

  describe('updateBounds', () => {
    it('should update movement bounds', () => {
      navigator.updateBounds({ minX: -5, maxX: 5, minZ: -5, maxZ: 5 });
      
      // Position should be clamped to new bounds on update
      navigator.setPosition(10, 10);
      navigator.update(0.016);
      
      const pos = navigator.getPosition();
      // Should be clamped to bounds (with some margin)
      expect(pos.x).toBeLessThanOrEqual(5);
      expect(pos.z).toBeLessThanOrEqual(5);
    });
  });

  describe('update', () => {
    it('should not throw on update', () => {
      navigator.moveTo(5, 5);
      
      expect(() => {
        navigator.update(0.016);
      }).not.toThrow();
    });

    it('should return current state', () => {
      const state = navigator.update(0.016);
      
      expect(state.mode).toBeDefined();
      expect(state.x).toBeDefined();
      expect(state.z).toBeDefined();
      expect(state.rotation).toBeDefined();
    });
  });

  describe('getState', () => {
    it('should return complete state', () => {
      const state = navigator.getState();
      
      expect(state).toHaveProperty('mode');
      expect(state).toHaveProperty('x');
      expect(state).toHaveProperty('z');
      expect(state).toHaveProperty('rotation');
      expect(state).toHaveProperty('arrived');
    });
  });

  describe('dispose', () => {
    it('should not throw on dispose', () => {
      expect(() => {
        navigator.dispose();
      }).not.toThrow();
    });
  });
});

describe('createAIBehavior', () => {
  let navigator: CharacterNavigator;
  let behavior: AIBehavior;

  beforeEach(() => {
    navigator = createCharacterNavigator({
      startX: 0,
      startZ: 0,
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
      maxSpeed: 2,
      maxForce: 5
    });
    
    behavior = createAIBehavior({
      navigator,
      followDistance: 4,
      fleeDistance: 2,
      interactionDistance: 1.5
    });
  });

  describe('initialization', () => {
    it('should start in wander state', () => {
      expect(behavior.getState()).toBe('wander');
    });
  });

  describe('setState', () => {
    it('should change to idle', () => {
      behavior.setState('idle');
      expect(behavior.getState()).toBe('idle');
    });

    it('should change to wander', () => {
      behavior.setState('idle');
      behavior.setState('wander');
      expect(behavior.getState()).toBe('wander');
    });

    it('should change to follow', () => {
      behavior.setState('follow');
      expect(behavior.getState()).toBe('follow');
    });

    it('should change to flee', () => {
      behavior.setState('flee');
      expect(behavior.getState()).toBe('flee');
    });

    it('should change to interact', () => {
      behavior.setState('interact');
      expect(behavior.getState()).toBe('interact');
    });
  });

  describe('update', () => {
    it('should not throw during update', () => {
      expect(() => {
        behavior.update(0.016, 5, 5);
      }).not.toThrow();
    });

    it('should accept player position', () => {
      // Run several updates with player position
      for (let i = 0; i < 10; i++) {
        behavior.update(0.016, 3, 3);
      }
      
      // Should still be in a valid state
      const state = behavior.getState();
      expect(['idle', 'wander', 'follow', 'flee', 'interact']).toContain(state);
    });
  });

  describe('dispose', () => {
    it('should not throw on dispose', () => {
      expect(() => {
        behavior.dispose();
      }).not.toThrow();
    });
  });
});

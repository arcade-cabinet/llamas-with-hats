/**
 * Tests for StageDefinition System
 * =================================
 * 
 * Tests for RNG, seeding, and transition calculations.
 */

import { describe, it, expect } from 'vitest';
import { 
  hashSeed, 
  createRNG, 
  calculateTransitionLength, 
  calculateStairSteps 
} from './StageDefinition';

describe('hashSeed', () => {
  it('should produce consistent hashes for the same input', () => {
    const hash1 = hashSeed('test-seed');
    const hash2 = hashSeed('test-seed');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = hashSeed('seed-a');
    const hash2 = hashSeed('seed-b');
    expect(hash1).not.toBe(hash2);
  });

  it('should return a positive integer', () => {
    const hash = hashSeed('any-seed');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hash)).toBe(true);
  });

  it('should handle empty string', () => {
    const hash = hashSeed('');
    expect(hash).toBe(0);
  });

  it('should handle unicode characters', () => {
    const hash = hashSeed('emoji-seed-');
    expect(hash).toBeGreaterThanOrEqual(0);
  });
});

describe('createRNG', () => {
  it('should produce deterministic sequences', () => {
    const rng1 = createRNG(12345);
    const rng2 = createRNG(12345);
    
    const sequence1 = [rng1.next(), rng1.next(), rng1.next()];
    const sequence2 = [rng2.next(), rng2.next(), rng2.next()];
    
    expect(sequence1).toEqual(sequence2);
  });

  it('next() should return values between 0 and 1', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 100; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('nextInt() should return integers in range', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 100; i++) {
      const value = rng.nextInt(5, 10);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(10);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('pick() should return items from array', () => {
    const rng = createRNG(42);
    const items = ['a', 'b', 'c', 'd'];
    
    for (let i = 0; i < 50; i++) {
      const picked = rng.pick(items);
      expect(items).toContain(picked);
    }
  });

  it('shuffle() should return array with same elements', () => {
    const rng = createRNG(42);
    const original = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(original);
    
    expect(shuffled).toHaveLength(original.length);
    expect(shuffled.sort()).toEqual(original.sort());
  });

  it('shuffle() should not modify original array', () => {
    const rng = createRNG(42);
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    
    rng.shuffle(original);
    
    expect(original).toEqual(copy);
  });

  it('shuffle() should be deterministic', () => {
    const rng1 = createRNG(42);
    const rng2 = createRNG(42);
    const items = [1, 2, 3, 4, 5];
    
    const shuffled1 = rng1.shuffle(items);
    const shuffled2 = rng2.shuffle(items);
    
    expect(shuffled1).toEqual(shuffled2);
  });
});

describe('calculateTransitionLength', () => {
  it('should calculate stairs length correctly', () => {
    // Stairs: 1.8:1 run:rise ratio
    expect(calculateTransitionLength('stairs', 3.0)).toBeCloseTo(5.4, 1);
    expect(calculateTransitionLength('stairs', 4.0)).toBeCloseTo(7.2, 1);
  });

  it('should calculate ramp length correctly', () => {
    // Ramps: 4:1 run:rise ratio (gentler slope)
    expect(calculateTransitionLength('ramp', 3.0)).toBeCloseTo(12.0, 1);
    expect(calculateTransitionLength('ramp', 2.0)).toBeCloseTo(8.0, 1);
  });

  it('should handle negative height (going down)', () => {
    expect(calculateTransitionLength('stairs', -3.0)).toBeCloseTo(5.4, 1);
    expect(calculateTransitionLength('ramp', -2.0)).toBeCloseTo(8.0, 1);
  });

  it('should return minimal length for ladders', () => {
    expect(calculateTransitionLength('ladder', 5.0)).toBe(0.4);
  });

  it('should return cabin size for elevators', () => {
    expect(calculateTransitionLength('elevator', 10.0)).toBe(1.0);
  });
});

describe('calculateStairSteps', () => {
  it('should calculate correct number of steps', () => {
    // Default step height is 0.18m
    expect(calculateStairSteps(1.8)).toBe(10); // 1.8 / 0.18 = 10
    expect(calculateStairSteps(3.0)).toBe(17); // ceil(3.0 / 0.18) = 17
  });

  it('should handle custom step heights', () => {
    expect(calculateStairSteps(2.0, 0.2)).toBe(10); // 2.0 / 0.2 = 10
    expect(calculateStairSteps(1.5, 0.15)).toBe(10); // 1.5 / 0.15 = 10
  });

  it('should handle negative heights (going down)', () => {
    expect(calculateStairSteps(-1.8)).toBe(10);
  });

  it('should round up to whole steps', () => {
    expect(calculateStairSteps(0.5)).toBe(3); // ceil(0.5 / 0.18) = 3
  });
});

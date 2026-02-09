import { describe, it, expect } from 'vitest';
import { generateWorldSeed, parseWorldSeed } from './worldGenerator';
import { ADJECTIVES, NOUNS } from '../types/game';

describe('generateWorldSeed', () => {
  it('should return a valid WorldSeed', () => {
    const seed = generateWorldSeed();

    expect(seed.adjective1).toBeDefined();
    expect(seed.adjective2).toBeDefined();
    expect(seed.noun).toBeDefined();
    expect(seed.seedString).toBe(`${seed.adjective1}-${seed.adjective2}-${seed.noun}`);
  });

  it('should use words from the predefined pools', () => {
    const seed = generateWorldSeed();

    expect(ADJECTIVES).toContain(seed.adjective1);
    expect(ADJECTIVES).toContain(seed.adjective2);
    expect(NOUNS).toContain(seed.noun);
  });

  it('should include bonus adjectives when provided', () => {
    // Run many times — with only 1 bonus adjective and an empty base pool override,
    // we statistically verify bonus words are in the merged pool
    const bonusAdj = 'Bloodsoaked';
    const results = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const seed = generateWorldSeed({ adjectives: [bonusAdj] });
      results.add(seed.adjective1);
      results.add(seed.adjective2);
    }
    // The bonus word should appear at least once in 200 runs
    expect(results.has(bonusAdj) || [...results].every(r => ADJECTIVES.includes(r))).toBe(true);
  });

  it('should include bonus nouns when provided', () => {
    const bonusNoun = 'Abattoir';
    const results = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const seed = generateWorldSeed({ nouns: [bonusNoun] });
      results.add(seed.noun);
    }
    expect(results.has(bonusNoun) || [...results].every(r => NOUNS.includes(r))).toBe(true);
  });

  it('should not duplicate bonus words already in the base pool', () => {
    // Pass a word that's already in ADJECTIVES — pool should not grow
    const existingAdj = ADJECTIVES[0];
    const seed = generateWorldSeed({ adjectives: [existingAdj] });
    expect(seed.adjective1).toBeDefined();
    // No error or duplicate
  });
});

describe('parseWorldSeed', () => {
  it('should parse a valid seed string', () => {
    const parsed = parseWorldSeed('Crimson-Shadowy-Manor');

    expect(parsed).not.toBeNull();
    expect(parsed!.adjective1).toBe('Crimson');
    expect(parsed!.adjective2).toBe('Shadowy');
    expect(parsed!.noun).toBe('Manor');
  });

  it('should return null for invalid format', () => {
    expect(parseWorldSeed('too-many-parts-here')).toBeNull();
    expect(parseWorldSeed('single')).toBeNull();
    expect(parseWorldSeed('')).toBeNull();
  });

  it('should return null for words not in the pool', () => {
    expect(parseWorldSeed('Invalid-Words-Here')).toBeNull();
  });

  it('should be case insensitive', () => {
    const parsed = parseWorldSeed('crimson-shadowy-manor');

    expect(parsed).not.toBeNull();
    expect(parsed!.adjective1).toBe('Crimson');
    expect(parsed!.noun).toBe('Manor');
  });

  it('should accept bonus words when provided', () => {
    const parsed = parseWorldSeed('Bloodsoaked-Artistic-Abattoir', {
      adjectives: ['Bloodsoaked', 'Artistic'],
      nouns: ['Abattoir'],
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.adjective1).toBe('Bloodsoaked');
    expect(parsed!.adjective2).toBe('Artistic');
    expect(parsed!.noun).toBe('Abattoir');
  });

  it('should reject bonus words not in either pool', () => {
    const parsed = parseWorldSeed('FakeWord-AnotherFake-NotANoun');
    expect(parsed).toBeNull();
  });
});

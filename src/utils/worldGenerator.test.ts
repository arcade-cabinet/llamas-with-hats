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
});

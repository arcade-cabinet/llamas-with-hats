// World seed generation and parsing
import {
  WorldSeed,
  ADJECTIVES,
  NOUNS
} from '../types/game';

export interface BonusWordPool {
  adjectives?: string[];
  nouns?: string[];
}

export function generateWorldSeed(bonus?: BonusWordPool): WorldSeed {
  // Merge bonus words (unlocked through play) with the base pools
  const adjPool = bonus?.adjectives?.length
    ? [...ADJECTIVES, ...bonus.adjectives.filter(a => !ADJECTIVES.includes(a))]
    : ADJECTIVES;
  const nounPool = bonus?.nouns?.length
    ? [...NOUNS, ...bonus.nouns.filter(n => !NOUNS.includes(n))]
    : NOUNS;

  const adj1 = adjPool[Math.floor(Math.random() * adjPool.length)];
  const adj2 = adjPool[Math.floor(Math.random() * adjPool.length)];
  const noun = nounPool[Math.floor(Math.random() * nounPool.length)];

  return {
    adjective1: adj1,
    adjective2: adj2,
    noun: noun,
    seedString: `${adj1}-${adj2}-${noun}`
  };
}

export function parseWorldSeed(seedString: string, bonus?: BonusWordPool): WorldSeed | null {
  const parts = seedString.split('-');
  if (parts.length !== 3) return null;

  const [adj1, adj2, noun] = parts;

  // Include bonus words when validating
  const adjPool = bonus?.adjectives?.length
    ? [...ADJECTIVES, ...bonus.adjectives.filter(a => !ADJECTIVES.includes(a))]
    : ADJECTIVES;
  const nounPool = bonus?.nouns?.length
    ? [...NOUNS, ...bonus.nouns.filter(n => !NOUNS.includes(n))]
    : NOUNS;

  const validAdj1 = adjPool.find(a => a.toLowerCase() === adj1.toLowerCase());
  const validAdj2 = adjPool.find(a => a.toLowerCase() === adj2.toLowerCase());
  const validNoun = nounPool.find(n => n.toLowerCase() === noun.toLowerCase());

  if (!validAdj1 || !validAdj2 || !validNoun) return null;

  return {
    adjective1: validAdj1,
    adjective2: validAdj2,
    noun: validNoun,
    seedString: `${validAdj1}-${validAdj2}-${validNoun}`
  };
}

// World seed generation and parsing
import {
  WorldSeed,
  ADJECTIVES,
  NOUNS
} from '../types/game';

export function generateWorldSeed(): WorldSeed {
  const adj1 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const adj2 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];

  return {
    adjective1: adj1,
    adjective2: adj2,
    noun: noun,
    seedString: `${adj1}-${adj2}-${noun}`
  };
}

export function parseWorldSeed(seedString: string): WorldSeed | null {
  const parts = seedString.split('-');
  if (parts.length !== 3) return null;

  const [adj1, adj2, noun] = parts;

  const validAdj1 = ADJECTIVES.find(a => a.toLowerCase() === adj1.toLowerCase());
  const validAdj2 = ADJECTIVES.find(a => a.toLowerCase() === adj2.toLowerCase());
  const validNoun = NOUNS.find(n => n.toLowerCase() === noun.toLowerCase());

  if (!validAdj1 || !validAdj2 || !validNoun) return null;

  return {
    adjective1: validAdj1,
    adjective2: validAdj2,
    noun: validNoun,
    seedString: `${validAdj1}-${validAdj2}-${validNoun}`
  };
}

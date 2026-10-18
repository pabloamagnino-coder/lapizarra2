import type { AnimalCard, PatternHex, Req } from './types';

/**
 * Original animal deck for this prototype (not the published card set).
 * Offsets are axial; the first hex is where the cube goes. Neighbor offsets:
 * E(1,0) NE(1,-1) N(0,-1) W(-1,0) SW(-1,1) S(0,1).
 */
const p = (...hexes: [number, number, Req][]): PatternHex[] =>
  hexes.map(([dq, dr, req]) => ({ dq, dr, req }));

export const ANIMALS: AnimalCard[] = [
  {
    id: 'rana', name: 'Rana', emoji: '🐸', creature: 'frog',
    look: { body: 0x5fb04a, accent: 0xf2e86d },
    pattern: p([0, 0, 'water'], [1, 0, 'tree1']), points: [3, 7, 12],
  },
  {
    id: 'pato', name: 'Pato', emoji: '🦆', creature: 'bird',
    look: { body: 0x7a5a3a, accent: 0x2f8a4f, beak: 0xf2a33a },
    pattern: p([0, 0, 'water'], [1, 0, 'water'], [0, 1, 'field']), points: [4, 9, 15],
  },
  {
    id: 'zorro', name: 'Zorro', emoji: '🦊', creature: 'quadruped',
    look: { body: 0xe0782f, accent: 0xffffff, ears: 'pointy', tail: 'bushy' },
    pattern: p([0, 0, 'tree2'], [1, 0, 'field']), points: [3, 7, 11, 16],
  },
  {
    id: 'oso', name: 'Oso', emoji: '🐻', creature: 'quadruped',
    look: { body: 0x6b4a32, accent: 0x3b281b, size: 1.35, ears: 'round', tail: 'short' },
    pattern: p([0, 0, 'mountain2'], [1, 0, 'tree2']), points: [5, 11, 18],
  },
  {
    id: 'ciervo', name: 'Ciervo', emoji: '🦌', creature: 'quadruped',
    look: { body: 0xa8784a, accent: 0xf4e6d0, ears: 'pointy', antlers: true, longLegs: true, tail: 'short' },
    pattern: p([0, 0, 'field'], [1, -1, 'tree1'], [0, 1, 'tree1']), points: [4, 9, 15],
  },
  {
    id: 'aguila', name: 'Águila', emoji: '🦅', creature: 'bird',
    look: { body: 0x5a3d26, accent: 0xffffff, beak: 0xf2c23a, size: 1.25 },
    pattern: p([0, 0, 'mountain3'], [1, 0, 'mountain1']), points: [6, 14],
  },
  {
    id: 'ardilla', name: 'Ardilla', emoji: '🐿️', creature: 'quadruped',
    look: { body: 0xb5622e, accent: 0xf0d2a8, size: 0.75, ears: 'pointy', tail: 'bushy' },
    pattern: p([0, 0, 'tree3'], [1, 0, 'tree1']), points: [5, 12],
  },
  {
    id: 'buho', name: 'Búho', emoji: '🦉', creature: 'bird',
    look: { body: 0x8a6a48, accent: 0xf2d16b, beak: 0x3a2a1a },
    pattern: p([0, 0, 'tree3'], [-1, 0, 'building']), points: [6, 13],
  },
  {
    id: 'conejo', name: 'Conejo', emoji: '🐇', creature: 'quadruped',
    look: { body: 0xd8cbb8, accent: 0xffffff, size: 0.7, ears: 'long', tail: 'short' },
    pattern: p([0, 0, 'field'], [1, 0, 'field'], [0, 1, 'tree1']), points: [3, 7, 12, 17],
  },
  {
    id: 'abeja', name: 'Abeja', emoji: '🐝', creature: 'insect',
    look: { body: 0xf2c21b, accent: 0x222222 },
    pattern: p([0, 0, 'field'], [1, 0, 'building']), points: [3, 6, 10, 15],
  },
  {
    id: 'castor', name: 'Castor', emoji: '🦫', creature: 'quadruped',
    look: { body: 0x7a5232, accent: 0x3a2618, size: 0.9, ears: 'round', tail: 'flat' },
    pattern: p([0, 0, 'water'], [1, 0, 'tree2'], [-1, 0, 'water']), points: [5, 11, 18],
  },
  {
    id: 'nutria', name: 'Nutria', emoji: '🦦', creature: 'quadruped',
    look: { body: 0x5a3e2a, accent: 0xc9a77e, size: 0.85, ears: 'round', tail: 'flat' },
    pattern: p([0, 0, 'water'], [1, 0, 'water'], [2, 0, 'water']), points: [4, 10, 17],
  },
  {
    id: 'cabra', name: 'Cabra montés', emoji: '🐐', creature: 'quadruped',
    look: { body: 0xe8e2d6, accent: 0x6b5a48, horns: true, ears: 'pointy', tail: 'short' },
    pattern: p([0, 0, 'mountain2'], [1, 0, 'mountain1'], [0, 1, 'field']), points: [5, 12],
  },
  {
    id: 'lobo', name: 'Lobo', emoji: '🐺', creature: 'quadruped',
    look: { body: 0x8d8f96, accent: 0xe6e6e6, size: 1.1, ears: 'pointy', tail: 'bushy' },
    pattern: p([0, 0, 'mountain1'], [1, 0, 'tree2'], [-1, 1, 'tree2']), points: [5, 11, 18],
  },
  {
    id: 'gorrion', name: 'Gorrión', emoji: '🐦', creature: 'bird',
    look: { body: 0x9a6b44, accent: 0xe8d6b5, beak: 0x4a3a2a, size: 0.7 },
    pattern: p([0, 0, 'building'], [1, 0, 'tree1']), points: [3, 7, 12],
  },
  {
    id: 'murcielago', name: 'Murciélago', emoji: '🦇', creature: 'bird',
    look: { body: 0x3a3340, accent: 0x6a5a70, beak: 0x3a3340, size: 0.8 },
    pattern: p([0, 0, 'mountain2'], [1, -1, 'building']), points: [4, 9, 15],
  },
  {
    id: 'salmon', name: 'Salmón', emoji: '🐟', creature: 'fish',
    look: { body: 0xe8806a, accent: 0x9aa7b5 },
    pattern: p([0, 0, 'water'], [1, 0, 'mountain1']), points: [3, 7, 12, 18],
  },
  {
    id: 'flamenco', name: 'Flamenco', emoji: '🦩', creature: 'bird',
    look: { body: 0xf28fb0, accent: 0x222222, beak: 0x222222, longLegs: true, longNeck: true },
    pattern: p([0, 0, 'water'], [1, 0, 'field'], [-1, 1, 'field']), points: [4, 9, 15],
  },
  {
    id: 'mariposa', name: 'Mariposa', emoji: '🦋', creature: 'insect',
    look: { body: 0x4a8fe0, accent: 0xf2a33a },
    pattern: p([0, 0, 'field'], [1, 0, 'tree1'], [-1, 0, 'water']), points: [4, 10, 16],
  },
  {
    id: 'jabali', name: 'Jabalí', emoji: '🐗', creature: 'quadruped',
    look: { body: 0x4a3a30, accent: 0xf0ead8, size: 1.1, ears: 'pointy', horns: true, tail: 'short' },
    pattern: p([0, 0, 'tree1'], [1, 0, 'tree1'], [0, -1, 'mountain1']), points: [4, 9, 15],
  },
  {
    id: 'garza', name: 'Garza', emoji: '🪶', creature: 'bird',
    look: { body: 0xdfe6ee, accent: 0x5a6a80, beak: 0xf2c23a, longLegs: true, longNeck: true },
    pattern: p([0, 0, 'water'], [1, 0, 'tree3']), points: [5, 11],
  },
  {
    id: 'lince', name: 'Lince', emoji: '🐈', creature: 'quadruped',
    look: { body: 0xc9a06a, accent: 0x3a2a1a, ears: 'pointy', tail: 'short' },
    pattern: p([0, 0, 'tree3'], [1, 0, 'mountain2']), points: [6, 14],
  },
  {
    id: 'tortuga', name: 'Tortuga', emoji: '🐢', creature: 'turtle',
    look: { body: 0x6a8a3a, accent: 0x9a7a4a },
    pattern: p([0, 0, 'field'], [1, 0, 'water'], [0, 1, 'water']), points: [4, 9, 15],
  },
  {
    id: 'ciguena', name: 'Cigüeña', emoji: '🕊️', creature: 'bird',
    look: { body: 0xf4f4f4, accent: 0x222222, beak: 0xe0502a, longLegs: true, longNeck: true },
    pattern: p([0, 0, 'building'], [1, 0, 'water'], [-1, 0, 'field']), points: [5, 11, 18],
  },
];

const byId = new Map(ANIMALS.map((a) => [a.id, a]));

export function animal(id: string): AnimalCard {
  const a = byId.get(id);
  if (!a) throw new Error(`Unknown animal ${id}`);
  return a;
}

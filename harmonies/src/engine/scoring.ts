import { CELL_COUNT, NEIGHBORS } from './hex';
import { top } from './rules';
import type { AnimalCard, Board, HandCard, ScoreBreakdown, Side } from './types';

const HEIGHT_POINTS = [0, 1, 3, 7];
const RIVER_POINTS = [0, 0, 2, 5, 8, 11, 15];

export function riverPoints(length: number): number {
  if (length <= 6) return RIVER_POINTS[Math.max(0, length)];
  return 15 + 4 * (length - 6);
}

function isMountain(board: Board, i: number): boolean {
  const s = board[i].stack;
  return s.length > 0 && s.every((c) => c === 'gray');
}

function components(pred: (i: number) => boolean): number[][] {
  const seen = new Array<boolean>(CELL_COUNT).fill(false);
  const out: number[][] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (seen[i] || !pred(i)) continue;
    const comp: number[] = [];
    const queue = [i];
    seen[i] = true;
    while (queue.length) {
      const c = queue.shift()!;
      comp.push(c);
      for (const n of NEIGHBORS[c]) {
        if (!seen[n] && pred(n)) {
          seen[n] = true;
          queue.push(n);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Longest shortest-path (in tokens) inside a connected group of hexes. */
function diameter(comp: number[]): number {
  const set = new Set(comp);
  let best = 0;
  for (const start of comp) {
    const dist = new Map<number, number>([[start, 0]]);
    const queue = [start];
    while (queue.length) {
      const c = queue.shift()!;
      for (const n of NEIGHBORS[c]) {
        if (set.has(n) && !dist.has(n)) {
          dist.set(n, dist.get(c)! + 1);
          queue.push(n);
        }
      }
    }
    for (const d of dist.values()) best = Math.max(best, d + 1);
  }
  return best;
}

export function cardPoints(card: AnimalCard, placed: number): number {
  return placed > 0 ? card.points[Math.min(placed, card.points.length) - 1] : 0;
}

export function scoreBoard(
  board: Board,
  cards: HandCard[],
  side: Side,
  lookup: (id: string) => AnimalCard,
): ScoreBreakdown {
  let trees = 0;
  let mountains = 0;
  let buildings = 0;

  for (let i = 0; i < CELL_COUNT; i++) {
    const s = board[i].stack;
    const t = top(s);
    if (t === 'green') trees += HEIGHT_POINTS[s.length];
    if (t === 'gray' && isMountain(board, i) && NEIGHBORS[i].some((n) => isMountain(board, n))) {
      mountains += HEIGHT_POINTS[s.length];
    }
    if (t === 'red' && s.length === 2) {
      const colors = new Set(
        NEIGHBORS[i].map((n) => top(board[n].stack)).filter((c) => c !== null),
      );
      if (colors.size >= 3) buildings += 5;
    }
  }

  const fields =
    5 *
    components((i) => top(board[i].stack) === 'yellow').filter((c) => c.length >= 2)
      .length;

  let water = 0;
  if (side === 'A') {
    const rivers = components((i) => top(board[i].stack) === 'blue');
    water = riverPoints(Math.max(0, ...rivers.map(diameter)));
  } else {
    // Every space (empty ones included) not covered by water belongs to an island; always at least 1.
    water = 5 * Math.max(1, components((i) => top(board[i].stack) !== 'blue').length);
  }

  const animals = cards.reduce((sum, h) => sum + cardPoints(lookup(h.cardId), h.placed), 0);

  return {
    trees,
    mountains,
    fields,
    buildings,
    water,
    animals,
    total: trees + mountains + fields + buildings + water + animals,
  };
}

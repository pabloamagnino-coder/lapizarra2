import { CELLS, cellAt, rotate } from './hex';
import type { AnimalCard, Board, Req, Stack } from './types';

export function matchReq(stack: Stack, req: Req): boolean {
  const n = stack.length;
  switch (req) {
    case 'water':
      return n === 1 && stack[0] === 'blue';
    case 'field':
      return n === 1 && stack[0] === 'yellow';
    case 'building':
      return n === 2 && stack[1] === 'red';
    case 'tree1':
    case 'tree2':
    case 'tree3': {
      const h = Number(req.slice(4));
      return n === h && stack[n - 1] === 'green' && stack.slice(0, -1).every((c) => c === 'brown');
    }
    case 'mountain1':
    case 'mountain2':
    case 'mountain3': {
      const h = Number(req.slice(8));
      return n === h && stack.every((c) => c === 'gray');
    }
  }
}

/** Cells where a cube of this card could be placed now (any of the 6 rotations). */
export function cubeSpots(board: Board, card: AnimalCard): number[] {
  const spots: number[] = [];
  for (const anchor of CELLS) {
    if (board[anchor.index].cube !== null) continue;
    for (let rot = 0; rot < 6; rot++) {
      const ok = card.pattern.every((p) => {
        const [dq, dr] = rotate(p.dq, p.dr, rot);
        const idx = cellAt(anchor.q + dq, anchor.r + dr);
        return idx !== undefined && matchReq(board[idx].stack, p.req);
      });
      if (ok) {
        spots.push(anchor.index);
        break;
      }
    }
  }
  return spots;
}

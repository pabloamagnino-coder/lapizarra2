import { animal } from './animals';
import type { Game } from './game';
import { CELL_COUNT, NEIGHBORS } from './hex';
import { cubeSpots } from './patterns';
import { canPlace } from './rules';
import { scoreBoard } from './scoring';
import type { Board, Color, HandCard } from './types';

/**
 * Greedy bot: picks the central slot whose tokens, placed one by one on the best
 * hex, give the best board evaluation. Not smart, but plays a legal, sensible game.
 */

function cloneBoard(b: Board): Board {
  return b.map((c) => ({ stack: c.stack.slice(), cube: c.cube }));
}

function evaluate(game: Game, board: Board, hand: HandCard[]): number {
  const s = scoreBoard(board, hand, game.side, animal);
  let v = s.total;
  // Potential: open animal spots and growable stacks.
  for (const h of hand) v += Math.min(2, cubeSpots(board, animal(h.cardId)).length) * 3;
  for (let i = 0; i < CELL_COUNT; i++) {
    const st = board[i].stack;
    if (st.length === 1 && st[0] === 'brown') v += 0.8;
    if (st.length > 0 && st.every((c) => c === 'gray') && st.length < 3) v += 0.4;
    if (st.length === 1 && st[0] === 'blue') {
      v += NEIGHBORS[i].filter((n) => board[n].stack.length === 0).length * 0.15;
    }
  }
  return v;
}

export interface TokenMove {
  pendingIndex: number;
  cell: number | null; // null = discard
}

function bestPlacements(game: Game, tokens: Color[], board: Board, hand: HandCard[]) {
  const b = cloneBoard(board);
  const pending = tokens.slice();
  const moves: TokenMove[] = [];
  while (pending.length) {
    let best: { pi: number; cell: number | null; v: number } | null = null;
    for (let pi = 0; pi < pending.length; pi++) {
      let any = false;
      for (let cell = 0; cell < CELL_COUNT; cell++) {
        if (!canPlace(b[cell], pending[pi])) continue;
        any = true;
        b[cell].stack.push(pending[pi]);
        const v = evaluate(game, b, hand) + Math.random() * 0.3;
        b[cell].stack.pop();
        if (!best || v > best.v) best = { pi, cell, v };
      }
      if (!any && !best) best = { pi, cell: null, v: -Infinity };
    }
    const m = best!;
    if (m.cell !== null) b[m.cell].stack.push(pending[m.pi]);
    moves.push({ pendingIndex: m.pi, cell: m.cell });
    pending.splice(m.pi, 1);
  }
  return { moves, value: evaluate(game, b, hand) };
}

export function botChooseCard(game: Game): number | null {
  if (!game.canTakeCard() || game.player.hand.length >= 3) return null;
  let best: { i: number; v: number } | null = null;
  game.river.forEach((id, i) => {
    if (!id) return;
    const a = animal(id);
    const v = a.points[a.points.length - 1] / (a.pattern.length + a.points.length) + Math.random();
    if (!best || v > best.v) best = { i, v };
  });
  return best ? (best as { i: number }).i : null;
}

export function botChooseSlot(game: Game): { slot: number; moves: TokenMove[] } {
  let best: { slot: number; moves: TokenMove[]; value: number } | null = null;
  game.central.forEach((tokens, slot) => {
    if (!tokens) return;
    const r = bestPlacements(game, tokens, game.player.board, game.player.hand);
    if (!best || r.value > best.value) best = { slot, ...r };
  });
  if (!best) throw new Error('No slots available');
  const b = best as { slot: number; moves: TokenMove[] };
  return { slot: b.slot, moves: b.moves };
}

/** Next cube placement (hand index + cell), or null if none available. */
export function botNextCube(game: Game): { handIndex: number; cell: number } | null {
  for (let hi = 0; hi < game.player.hand.length; hi++) {
    const spots = game.cubeSpotsFor(hi);
    if (spots.length) return { handIndex: hi, cell: spots[0] };
  }
  return null;
}

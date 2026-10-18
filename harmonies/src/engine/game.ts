import { animal, ANIMALS } from './animals';
import { CELL_COUNT } from './hex';
import { cubeSpots } from './patterns';
import { canPlace } from './rules';
import { makeRng, shuffle } from './rng';
import { scoreBoard } from './scoring';
import type {
  Board,
  Color,
  HandCard,
  PlayerState,
  ScoreBreakdown,
  Side,
  TurnState,
} from './types';

/** Token mix (120 in total). Per-color split is our best reading of the box; verify. */
export const TOKEN_COUNTS: Record<Color, number> = {
  blue: 23,
  gray: 23,
  brown: 21,
  green: 19,
  yellow: 19,
  red: 15,
};

export const CENTRAL_SLOTS = 5;
export const RIVER_SIZE = 5;
export const MAX_HAND = 4;
export const TOKENS_PER_SLOT = 3;

export interface PlayerSetup {
  name: string;
  isBot: boolean;
}

export interface GameOptions {
  players: PlayerSetup[];
  side?: Side;
  seed?: number;
}

export type GameEvent =
  | { type: 'takeSlot'; player: number; slot: number; tokens: Color[] }
  | { type: 'placeToken'; player: number; cell: number; color: Color; pendingIndex: number }
  | { type: 'discardToken'; player: number; color: Color; pendingIndex: number }
  | { type: 'takeCard'; player: number; cardId: string; riverIndex: number }
  | { type: 'placeCube'; player: number; cell: number; cardId: string; completed: boolean }
  | { type: 'refill'; slot: number | null; tokens: Color[] | null; river: (string | null)[] }
  | { type: 'endTriggered'; player: number; reason: 'bag' | 'board' }
  | { type: 'nextTurn'; player: number }
  | { type: 'gameOver'; scores: ScoreBreakdown[]; winners: number[] };

export class GameError extends Error {}

export function emptyBoard(): Board {
  return Array.from({ length: CELL_COUNT }, () => ({ stack: [], cube: null }));
}

export class Game {
  readonly side: Side;
  readonly players: PlayerState[];
  current = 0;
  bag: Color[];
  central: (Color[] | null)[];
  river: (string | null)[];
  deck: string[];
  turn: TurnState = { takenSlot: null, pending: [], tookCard: false };
  endTriggered = false;
  finished = false;
  round = 1;
  private listeners: ((e: GameEvent) => void)[] = [];

  constructor(opts: GameOptions) {
    if (opts.players.length < 1 || opts.players.length > 4) {
      throw new GameError('Se juega de 1 a 4 jugadores');
    }
    const rng = makeRng(opts.seed ?? Date.now());
    this.side = opts.side ?? 'A';
    this.players = opts.players.map((p) => ({
      name: p.name,
      isBot: p.isBot,
      board: emptyBoard(),
      hand: [],
      done: [],
    }));
    const tokens: Color[] = [];
    for (const [c, n] of Object.entries(TOKEN_COUNTS) as [Color, number][]) {
      for (let i = 0; i < n; i++) tokens.push(c);
    }
    this.bag = shuffle(tokens, rng);
    this.central = Array.from({ length: CENTRAL_SLOTS }, () => this.draw());
    this.deck = shuffle(
      ANIMALS.map((a) => a.id),
      rng,
    );
    this.river = Array.from({ length: RIVER_SIZE }, () => this.deck.shift() ?? null);
  }

  on(fn: (e: GameEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: GameEvent) {
    for (const l of this.listeners) l(e);
  }

  private draw(): Color[] | null {
    if (this.bag.length < TOKENS_PER_SLOT) return null;
    return this.bag.splice(0, TOKENS_PER_SLOT);
  }

  get player(): PlayerState {
    return this.players[this.current];
  }

  // ---- queries -------------------------------------------------------------

  legalCells(color: Color, board: Board = this.player.board): number[] {
    const out: number[] = [];
    for (let i = 0; i < CELL_COUNT; i++) if (canPlace(board[i], color)) out.push(i);
    return out;
  }

  cubeSpotsFor(handIndex: number): number[] {
    const h = this.player.hand[handIndex];
    if (!h) return [];
    return cubeSpots(this.player.board, animal(h.cardId));
  }

  canTakeCard(): boolean {
    return !this.finished && !this.turn.tookCard && this.player.hand.length < MAX_HAND;
  }

  canEndTurn(): boolean {
    return !this.finished && this.turn.takenSlot !== null && this.turn.pending.length === 0;
  }

  emptyCells(p: PlayerState = this.player): number {
    return p.board.filter((c) => c.stack.length === 0).length;
  }

  score(index: number): ScoreBreakdown {
    const p = this.players[index];
    return scoreBoard(p.board, [...p.hand, ...p.done], this.side, animal);
  }

  cubesPlaced(index: number): number {
    const p = this.players[index];
    return [...p.hand, ...p.done].reduce((s, h) => s + h.placed, 0);
  }

  // ---- actions -------------------------------------------------------------

  takeSlot(slot: number) {
    this.assertActive();
    if (this.turn.takenSlot !== null) throw new GameError('Ya tomaste fichas este turno');
    const tokens = this.central[slot];
    if (!tokens) throw new GameError('Ese espacio está vacío');
    this.central[slot] = null;
    this.turn.takenSlot = slot;
    this.turn.pending = tokens.slice();
    this.emit({ type: 'takeSlot', player: this.current, slot, tokens: tokens.slice() });
  }

  placeToken(pendingIndex: number, cell: number) {
    this.assertActive();
    const color = this.turn.pending[pendingIndex];
    if (!color) throw new GameError('No hay ficha para colocar');
    const c = this.player.board[cell];
    if (!c || !canPlace(c, color)) throw new GameError('No podés colocar esa ficha ahí');
    c.stack.push(color);
    this.turn.pending.splice(pendingIndex, 1);
    this.emit({ type: 'placeToken', player: this.current, cell, color, pendingIndex });
  }

  /** Only allowed when the token has no legal spot left on the board. */
  discardToken(pendingIndex: number) {
    this.assertActive();
    const color = this.turn.pending[pendingIndex];
    if (!color) throw new GameError('No hay ficha para descartar');
    if (this.legalCells(color).length > 0) throw new GameError('Esa ficha todavía tiene lugar');
    this.turn.pending.splice(pendingIndex, 1);
    this.emit({ type: 'discardToken', player: this.current, color, pendingIndex });
  }

  takeCard(riverIndex: number) {
    this.assertActive();
    if (!this.canTakeCard()) throw new GameError('No podés tomar otra carta ahora');
    const id = this.river[riverIndex];
    if (!id) throw new GameError('No hay carta ahí');
    this.river[riverIndex] = null;
    this.player.hand.push({ cardId: id, placed: 0 });
    this.turn.tookCard = true;
    this.emit({ type: 'takeCard', player: this.current, cardId: id, riverIndex });
  }

  placeCube(handIndex: number, cell: number) {
    this.assertActive();
    const h: HandCard | undefined = this.player.hand[handIndex];
    if (!h) throw new GameError('No tenés esa carta');
    if (!this.cubeSpotsFor(handIndex).includes(cell)) {
      throw new GameError('El patrón de ese animal no está ahí');
    }
    this.player.board[cell].cube = h.cardId;
    h.placed++;
    const completed = h.placed >= animal(h.cardId).points.length;
    if (completed) {
      this.player.hand.splice(handIndex, 1);
      this.player.done.push(h);
    }
    this.emit({ type: 'placeCube', player: this.current, cell, cardId: h.cardId, completed });
  }

  endTurn() {
    this.assertActive();
    if (!this.canEndTurn()) throw new GameError('Primero colocá las 3 fichas');

    const slot = this.turn.takenSlot!;
    const refill = this.draw();
    this.central[slot] = refill;
    for (let i = 0; i < RIVER_SIZE; i++) {
      if (this.river[i] === null) this.river[i] = this.deck.shift() ?? null;
    }
    this.emit({ type: 'refill', slot, tokens: refill, river: this.river.slice() });

    if (!this.endTriggered) {
      if (refill === null) {
        this.endTriggered = true;
        this.emit({ type: 'endTriggered', player: this.current, reason: 'bag' });
      } else if (this.emptyCells() <= 2) {
        this.endTriggered = true;
        this.emit({ type: 'endTriggered', player: this.current, reason: 'board' });
      }
    }

    this.turn = { takenSlot: null, pending: [], tookCard: false };
    const next = (this.current + 1) % this.players.length;
    if (next === 0) {
      if (this.endTriggered || this.central.every((s) => s === null)) {
        this.finish();
        return;
      }
      this.round++;
    }
    this.current = next;
    this.emit({ type: 'nextTurn', player: next });
  }

  private finish() {
    this.finished = true;
    const scores = this.players.map((_, i) => this.score(i));
    const best = Math.max(...scores.map((s) => s.total));
    let winners = scores.map((s, i) => (s.total === best ? i : -1)).filter((i) => i >= 0);
    // Tie-break: most animal cubes placed.
    if (winners.length > 1) {
      const cubes = winners.map((i) => this.cubesPlaced(i));
      const most = Math.max(...cubes);
      winners = winners.filter((_, k) => cubes[k] === most);
    }
    this.emit({ type: 'gameOver', scores, winners });
  }

  private assertActive() {
    if (this.finished) throw new GameError('La partida terminó');
  }
}

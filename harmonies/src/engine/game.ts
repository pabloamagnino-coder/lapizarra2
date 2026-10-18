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

/** Token mix (120 in total), as listed in the rulebook's contents. */
export const TOKEN_COUNTS: Record<Color, number> = {
  blue: 23,
  gray: 23,
  brown: 21,
  green: 19,
  yellow: 19,
  red: 15,
};

/** Central board spaces / face-up animal cards: 5 with 2–4 players, 3 in solo mode. */
export const CENTRAL_SLOTS = 5;
export const RIVER_SIZE = 5;
export const SOLO_SLOTS = 3;

/** Solo mode: points needed for 1–8 suns (+1 sun when playing side A). */
export const SUN_THRESHOLDS = [40, 70, 90, 110, 130, 140, 150, 160];

export function sunsFor(total: number, side: Side): number {
  const base = SUN_THRESHOLDS.filter((t) => total >= t).length;
  return base + (side === 'A' && base > 0 ? 1 : 0);
}
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
  | { type: 'swapCard'; riverIndex: number; discarded: string; cardId: string }
  | { type: 'placeCube'; player: number; cell: number; cardId: string; completed: boolean }
  | { type: 'refill'; slots: number[]; river: (string | null)[] }
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
  readonly solo: boolean;
  readonly slots: number;
  current = 0;
  bag: Color[];
  central: (Color[] | null)[];
  river: (string | null)[];
  deck: string[];
  turn: TurnState = { takenSlot: null, pending: [], tookCard: false, swapped: false };
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
    this.solo = opts.players.length === 1;
    this.slots = this.solo ? SOLO_SLOTS : CENTRAL_SLOTS;
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
    this.central = Array.from({ length: this.slots }, () => this.draw());
    this.deck = shuffle(
      ANIMALS.map((a) => a.id),
      rng,
    );
    this.river = Array.from({ length: this.slots }, () => this.deck.shift() ?? null);
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
    return !this.finished && !this.turn.tookCard && !this.turn.swapped && this.player.hand.length < MAX_HAND;
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

  /** Solo only: if you took no animal card this turn, replace one face-up card with the top of the deck. */
  canSwapCard(): boolean {
    return this.solo && !this.finished && !this.turn.tookCard && !this.turn.swapped && this.deck.length > 0;
  }

  swapCard(riverIndex: number) {
    this.assertActive();
    if (!this.canSwapCard()) throw new GameError('No podés cambiar una carta ahora');
    const old = this.river[riverIndex];
    if (!old) throw new GameError('No hay carta ahí');
    this.river[riverIndex] = this.deck.shift()!;
    this.turn.swapped = true;
    this.emit({ type: 'swapCard', riverIndex, discarded: old, cardId: this.river[riverIndex]! });
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

    // Solo: the 6 leftover tokens are discarded and all 3 spaces are refilled.
    const slots = this.solo ? [0, 1, 2] : [this.turn.takenSlot!];
    let bagRanOut = false;
    for (const slot of slots) {
      this.central[slot] = this.draw();
      if (this.central[slot] === null) bagRanOut = true;
    }
    for (let i = 0; i < this.river.length; i++) {
      if (this.river[i] === null) this.river[i] = this.deck.shift() ?? null;
    }
    this.emit({ type: 'refill', slots, river: this.river.slice() });

    if (!this.endTriggered) {
      if (bagRanOut) {
        this.endTriggered = true;
        this.emit({ type: 'endTriggered', player: this.current, reason: 'bag' });
      } else if (this.emptyCells() <= 2) {
        this.endTriggered = true;
        this.emit({ type: 'endTriggered', player: this.current, reason: 'board' });
      }
    }

    this.turn = { takenSlot: null, pending: [], tookCard: false, swapped: false };
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

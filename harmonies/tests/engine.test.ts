import { describe, expect, it } from 'vitest';
import { animal } from '../src/engine/animals';
import { botChooseCard, botChooseSlot, botNextCube } from '../src/engine/bot';
import { emptyBoard, Game, sunsFor } from '../src/engine/game';
import { CELL_COUNT, cellAt, NEIGHBORS } from '../src/engine/hex';
import { cubeSpots } from '../src/engine/patterns';
import { canStack } from '../src/engine/rules';
import { riverPoints, scoreBoard } from '../src/engine/scoring';
import type { Board, Color } from '../src/engine/types';

const at = (q: number, r: number) => cellAt(q, r)!;
const put = (b: Board, q: number, r: number, ...colors: Color[]) => {
  b[at(q, r)].stack.push(...colors);
};
const score = (b: Board, side: 'A' | 'B' = 'A') => scoreBoard(b, [], side, animal);

describe('board', () => {
  it('has 23 hexes with sane neighbors', () => {
    expect(CELL_COUNT).toBe(23);
    expect(Math.max(...NEIGHBORS.map((n) => n.length))).toBe(6);
    expect(Math.min(...NEIGHBORS.map((n) => n.length))).toBeGreaterThanOrEqual(2);
  });
});

describe('stacking', () => {
  it('follows the stacking rules', () => {
    expect(canStack([], 'blue')).toBe(true);
    expect(canStack(['blue'], 'blue')).toBe(false);
    expect(canStack(['yellow'], 'green')).toBe(false);
    expect(canStack(['gray', 'gray'], 'gray')).toBe(true);
    expect(canStack(['gray', 'gray', 'gray'], 'gray')).toBe(false);
    expect(canStack(['brown'], 'green')).toBe(true);
    expect(canStack(['brown', 'brown'], 'green')).toBe(true);
    expect(canStack(['brown', 'brown'], 'brown')).toBe(false);
    expect(canStack(['green'], 'green')).toBe(false);
    expect(canStack(['gray'], 'red')).toBe(true);
    expect(canStack(['gray', 'gray'], 'red')).toBe(false);
    expect(canStack(['red', 'red'], 'red')).toBe(false);
  });
});

describe('scoring', () => {
  it('scores trees by height', () => {
    const b = emptyBoard();
    put(b, 0, 0, 'green');
    put(b, 2, 0, 'brown', 'green');
    put(b, 4, 0, 'brown', 'brown', 'green');
    expect(score(b).trees).toBe(1 + 3 + 7);
  });

  it('scores mountains only when touching another mountain', () => {
    const b = emptyBoard();
    put(b, 0, 0, 'gray', 'gray');
    expect(score(b).mountains).toBe(0);
    put(b, 1, 0, 'gray');
    expect(score(b).mountains).toBe(3 + 1);
  });

  it('scores 5 per field group of 2+', () => {
    const b = emptyBoard();
    put(b, 0, 0, 'yellow');
    put(b, 0, 1, 'yellow');
    put(b, 0, 3, 'yellow');
    expect(score(b).fields).toBe(5);
  });

  it('scores buildings surrounded by 3 colors', () => {
    const b = emptyBoard();
    put(b, 1, 1, 'gray', 'red');
    put(b, 2, 1, 'blue');
    put(b, 1, 2, 'yellow');
    expect(score(b).buildings).toBe(0);
    put(b, 0, 1, 'green');
    expect(score(b).buildings).toBe(5);
  });

  it('scores the longest river', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(riverPoints)).toEqual([0, 2, 5, 8, 11, 15, 19, 23]);
    const b = emptyBoard();
    for (let r = 0; r < 4; r++) put(b, 0, r, 'blue');
    expect(score(b).water).toBe(8);
  });

  it('scores islands on side B', () => {
    const b = emptyBoard();
    put(b, 0, 0, 'yellow');
    put(b, 0, 1, 'blue');
    put(b, 0, 2, 'green');
    put(b, 1, 0, 'blue');
    put(b, 1, 1, 'blue');
    expect(score(b, 'B').water).toBe(10);
  });

  it('always counts at least one island, empty spaces included', () => {
    expect(score(emptyBoard(), 'B').water).toBe(5);
  });
});

describe('animal patterns', () => {
  it('finds a pattern in any rotation', () => {
    const b = emptyBoard();
    put(b, 2, 0, 'blue');
    put(b, 2, 1, 'green'); // south of the water, rotated from the card's east
    expect(cubeSpots(b, animal('rana'))).toEqual([at(2, 0)]);
    b[at(2, 0)].cube = 'rana';
    expect(cubeSpots(b, animal('rana'))).toEqual([]);
  });
});

describe('game flow', () => {
  it('plays full bot games to completion', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const g = new Game({
        players: [1, 2, 3].map((i) => ({ name: `Bot ${i}`, isBot: true })),
        seed,
      });
      let over = false;
      g.on((e) => {
        if (e.type === 'gameOver') over = true;
      });
      let guard = 0;
      while (!g.finished && guard++ < 500) {
        const card = botChooseCard(g);
        if (card !== null) g.takeCard(card);
        const { slot, moves } = botChooseSlot(g);
        g.takeSlot(slot);
        for (const m of moves) {
          if (m.cell === null) g.discardToken(m.pendingIndex);
          else g.placeToken(m.pendingIndex, m.cell);
        }
        let cube;
        while ((cube = botNextCube(g))) g.placeCube(cube.handIndex, cube.cell);
        g.endTurn();
      }
      expect(over).toBe(true);
      const totals = g.players.map((_, i) => g.score(i).total);
      expect(Math.max(...totals)).toBeGreaterThan(20);
    }
  });

  it('plays the solo mode with 3 spaces and full refills', () => {
    const g = new Game({ players: [{ name: 'Solo', isBot: true }], seed: 7 });
    expect(g.central.length).toBe(3);
    expect(g.river.length).toBe(3);
    let turns = 0;
    while (!g.finished && turns++ < 100) {
      if (turns === 1) {
        g.swapCard(0);
        expect(g.canTakeCard()).toBe(false);
      }
      const { slot, moves } = botChooseSlot(g);
      g.takeSlot(slot);
      for (const m of moves) {
        if (m.cell === null) g.discardToken(m.pendingIndex);
        else g.placeToken(m.pendingIndex, m.cell);
      }
      if (!g.finished) {
        g.endTurn();
        if (!g.finished) expect(g.central.every((s) => s && s.length === 3)).toBe(true);
      }
    }
    expect(g.finished).toBe(true);
    expect(sunsFor(39, 'A')).toBe(0);
    expect(sunsFor(130, 'A')).toBe(6);
    expect(sunsFor(130, 'B')).toBe(5);
  });

  it('rejects illegal actions', () => {
    const g = new Game({ players: [{ name: 'A', isBot: false }], seed: 3 });
    expect(() => g.endTurn()).toThrow();
    g.takeSlot(0);
    expect(() => g.takeSlot(1)).toThrow();
    g.placeToken(0, 0);
    expect(() => g.endTurn()).toThrow();
  });
});

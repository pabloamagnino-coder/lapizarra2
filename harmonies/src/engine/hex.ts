/**
 * Player board: 23 hexes in 5 columns (5,4,5,4,5), flat-top hexes, "odd-q" offset
 * layout converted to axial coordinates (q, r).
 */
export interface HexCell {
  index: number;
  col: number;
  row: number;
  q: number;
  r: number;
}

const COLUMNS = [5, 4, 5, 4, 5];

export const CELLS: HexCell[] = [];
COLUMNS.forEach((n, col) => {
  for (let row = 0; row < n; row++) {
    const q = col;
    const r = row - (col - (col & 1)) / 2;
    CELLS.push({ index: CELLS.length, col, row, q, r });
  }
});

export const CELL_COUNT = CELLS.length;

const byKey = new Map<string, number>();
for (const c of CELLS) byKey.set(`${c.q},${c.r}`, c.index);

export function cellAt(q: number, r: number): number | undefined {
  return byKey.get(`${q},${r}`);
}

export const DIRECTIONS: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export const NEIGHBORS: number[][] = CELLS.map((c) =>
  DIRECTIONS.map(([dq, dr]) => cellAt(c.q + dq, c.r + dr)).filter(
    (i): i is number => i !== undefined,
  ),
);

/** Rotate an axial offset by 60° steps. */
export function rotate(dq: number, dr: number, steps: number): [number, number] {
  let q = dq;
  let r = dr;
  for (let i = 0; i < ((steps % 6) + 6) % 6; i++) {
    const nq = -r;
    const nr = q + r;
    q = nq;
    r = nr;
  }
  return [q, r];
}

/** Position of a hex center in board space (flat-top, size = circumradius). */
export function hexToWorld(q: number, r: number, size = 1): { x: number; z: number } {
  return { x: size * 1.5 * q, z: size * Math.sqrt(3) * (r + q / 2) };
}

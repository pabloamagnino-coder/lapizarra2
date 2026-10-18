import type { Cell, Color, Stack } from './types';

/**
 * Stacking rules:
 *  - blue (water) and yellow (field) only go on an empty hex and nothing goes on them.
 *  - gray stacks on gray up to 3 high (mountain).
 *  - brown stacks on brown up to 2 high (trunk); green tops 0–2 browns (tree, max 3).
 *  - red goes on a single gray, brown or red (building, exactly 2 high).
 *  - nothing goes on green, on a building, or on a hex holding an animal cube.
 */
export function canStack(stack: Stack, color: Color): boolean {
  const n = stack.length;
  if (n === 0) return true;
  if (n === 1) {
    const base = stack[0];
    if (base === 'gray') return color === 'gray' || color === 'red';
    if (base === 'brown') return color === 'brown' || color === 'green' || color === 'red';
    if (base === 'red') return color === 'red';
    return false;
  }
  if (n === 2) {
    if (stack[0] === 'gray' && stack[1] === 'gray') return color === 'gray';
    if (stack[0] === 'brown' && stack[1] === 'brown') return color === 'green';
    return false;
  }
  return false;
}

export function canPlace(cell: Cell, color: Color): boolean {
  return cell.cube === null && canStack(cell.stack, color);
}

export function top(stack: Stack): Color | null {
  return stack.length ? stack[stack.length - 1] : null;
}

/** Pure geometry of the editor board: pointer position to square or edge, furniture footprints. */
import type { Cell } from '../../engine/editor';
import type { FurnitureDef } from '../../engine/quest/schema';

/** Board units per square (the art is drawn in these; the svg is scaled down with its viewBox). */
export const U = 34;
export const BOARD_W = 26;
export const BOARD_H = 19;

/** The square under a point given in board units, or undefined outside the board. */
export function toCell(ux: number, uy: number): Cell | undefined {
  const x = Math.floor(ux / U);
  const y = Math.floor(uy / U);
  return x >= 0 && y >= 0 && x < BOARD_W && y < BOARD_H ? [x, y] : undefined;
}

/**
 * The edge between two squares that a point is close to (within `reach` of a square, 0.22 by
 * default), as the two squares. Undefined in the middle of a square or on the board border.
 */
export function nearestEdge(
  ux: number,
  uy: number,
  reach = 0.22,
): { a: Cell; b: Cell } | undefined {
  const c = toCell(ux, uy);
  if (!c) return undefined;
  const fx = ux / U - c[0];
  const fy = uy / U - c[1];
  const sides = [
    { d: fy, b: [c[0], c[1] - 1] as Cell },
    { d: 1 - fy, b: [c[0], c[1] + 1] as Cell },
    { d: fx, b: [c[0] - 1, c[1]] as Cell },
    { d: 1 - fx, b: [c[0] + 1, c[1]] as Cell },
  ].sort((p, q) => p.d - q.d);
  const best = sides[0]!;
  if (best.d > reach) return undefined;
  if (best.b[0] < 0 || best.b[1] < 0 || best.b[0] >= BOARD_W || best.b[1] >= BOARD_H)
    return undefined;
  return { a: c, b: best.b };
}

/** A square on the board border and the side of it that is the board's outer edge. */
export interface OuterEdge {
  cell: Cell;
  side: 'n' | 'e' | 's' | 'w';
}

/**
 * The outer edge of the board that a point is close to (within `reach` of a border square, 0.3 by
 * default: a bit more than an inner edge, a finger is wide), or undefined.
 */
export function nearestOuterEdge(ux: number, uy: number, reach = 0.3): OuterEdge | undefined {
  const c = toCell(ux, uy);
  if (!c) return undefined;
  const fx = ux / U - c[0];
  const fy = uy / U - c[1];
  const sides: { d: number; side: OuterEdge['side'] }[] = [];
  if (c[1] === 0) sides.push({ d: fy, side: 'n' });
  if (c[1] === BOARD_H - 1) sides.push({ d: 1 - fy, side: 's' });
  if (c[0] === 0) sides.push({ d: fx, side: 'w' });
  if (c[0] === BOARD_W - 1) sides.push({ d: 1 - fx, side: 'e' });
  sides.sort((p, q) => p.d - q.d);
  const best = sides[0];
  return best && best.d <= reach ? { cell: c, side: best.side } : undefined;
}

/** The edge on one side of a square (for the keyboard cursor). */
export function edgeOfCell(c: Cell, dir: 'n' | 'e' | 's' | 'w'): { a: Cell; b: Cell } | undefined {
  const b: Cell =
    dir === 'n'
      ? [c[0], c[1] - 1]
      : dir === 's'
        ? [c[0], c[1] + 1]
        : dir === 'w'
          ? [c[0] - 1, c[1]]
          : [c[0] + 1, c[1]];
  if (b[0] < 0 || b[1] < 0 || b[0] >= BOARD_W || b[1] >= BOARD_H) return undefined;
  return { a: c, b };
}

/** Width and height in squares of a new piece, from the existing art (Quest 1). */
export const FOOTPRINT: Readonly<Record<FurnitureDef['type'], readonly [number, number]>> = {
  stairs: [2, 2],
  table: [3, 2],
  sorcerersTable: [3, 2],
  alchemistsBench: [2, 3],
  bookcase: [3, 1],
  cupboard: [3, 1],
  chest: [1, 1],
  throne: [1, 1],
  tomb: [2, 3],
  rack: [2, 3],
  weaponsRack: [1, 3],
  fireplace: [3, 1],
};

/** The squares of a new piece whose first square (top left) is `at`. `turned` swaps width and height. */
export function footprintCells(type: FurnitureDef['type'], at: Cell, turned: boolean): Cell[] {
  const [w0, h0] = FOOTPRINT[type];
  const [w, h] = turned ? [h0, w0] : [w0, h0];
  const out: Cell[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([at[0] + dx, at[1] + dy]);
  return out;
}

export const adjacent = (a: Cell, b: Cell): boolean =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

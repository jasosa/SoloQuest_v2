import { z } from 'zod';
import raw from '../../content/board.json';

/** Area id of a cell: `C` for corridor or `R01`..`R22` for a room. */
export type AreaId = string;
export type Cell = readonly [x: number, y: number];

const BoardSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    cells: z.array(z.array(z.string().regex(/^(C|R\d{2})$/))),
  })
  .refine((b) => b.cells.length === b.height && b.cells.every((r) => r.length === b.width), {
    message: 'cells must be height rows of width columns',
  });

export interface Board {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly (readonly AreaId[])[];
}

export function parseBoard(data: unknown): Board {
  return BoardSchema.parse(data);
}

export const board: Board = parseBoard(raw);

export function inBoard(b: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.width && y < b.height;
}

/** Area id at a cell, or `undefined` outside the board. */
export function areaAt(b: Board, x: number, y: number): AreaId | undefined {
  return inBoard(b, x, y) ? b.cells[y]?.[x] : undefined;
}

/** All room ids (`R01`..), sorted. */
export function roomIds(b: Board): AreaId[] {
  const ids = new Set<AreaId>();
  for (const row of b.cells) for (const a of row) if (a !== 'C') ids.add(a);
  return [...ids].sort();
}

/** Cells of one area, row by row. */
export function cellsOf(b: Board, area: AreaId): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++) if (b.cells[y]?.[x] === area) out.push([x, y]);
  return out;
}

/**
 * Wall between two orthogonally adjacent cells (before rock and blocked squares):
 * different area ids, unless both are corridor. The board edge always counts as a wall.
 */
export function isWallBetween(b: Board, a: Cell, c: Cell): boolean {
  const aa = areaAt(b, a[0], a[1]);
  const cc = areaAt(b, c[0], c[1]);
  if (aa === undefined || cc === undefined) return true;
  if (aa === 'C' && cc === 'C') return false;
  return aa !== cc;
}

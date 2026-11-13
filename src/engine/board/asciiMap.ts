/**
 * ASCII maps for line of sight tests.
 *
 * Every cell is drawn at odd columns and odd rows, and the characters between cells are the edges:
 *
 *   #####      cells:  `.` floor   `B` blocked square   `R` rock
 *   #.#.#      edges:  `#` wall    `.` open (also space)   `D` closed door   `d` open door
 *   #.D.#      corners (even column and even row) are ignored.
 *   #####
 *
 * This is a 2 x 2 grid: the top row has a wall between its cells, the bottom row a closed door.
 * The result is a SightMap (see los.ts).
 */
import type { Cell } from './board';
import type { CellKind, SightMap } from './los';

export function asciiSightMap(rows: readonly string[]): SightMap {
  const lines = rows.map((r) => r.trimEnd());
  const height = (lines.length - 1) / 2;
  const width = (Math.max(...lines.map((l) => l.length)) - 1) / 2;
  if (!Number.isInteger(height) || !Number.isInteger(width))
    throw new Error('ASCII map must be (2 * cols + 1) wide and (2 * rows + 1) tall');
  const ch = (col: number, row: number) => lines[row]?.[col] ?? '#';
  return {
    width,
    height,
    cellKind(x, y): CellKind {
      const c = ch(2 * x + 1, 2 * y + 1);
      if (c === 'B') return 'block';
      if (c === 'R') return 'rock';
      return 'floor';
    },
    edgeOpen(a: Cell, b: Cell): boolean {
      const c = ch(a[0] + b[0] + 1, a[1] + b[1] + 1);
      return c === '.' || c === ' ' || c === 'd';
    },
  };
}

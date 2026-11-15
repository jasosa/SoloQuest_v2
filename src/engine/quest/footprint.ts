/**
 * Shape rules of a furniture piece (or stairs), shared by the editor operations and the
 * validator so that an imported or hand-edited file is held to the same rules.
 * Pure: it only looks at the board areas.
 */
import { areaAt, type Board } from '../board/board';

type C = readonly number[];
const key = (c: C) => `${c[0]},${c[1]}`;

/** True when every square can be reached from the first one through touching squares. */
export function cellsConnected(cells: readonly C[]): boolean {
  const first = cells[0];
  if (!first) return false;
  const left = new Map(cells.map((c) => [key(c), c]));
  const todo: C[] = [first];
  left.delete(key(first));
  while (todo.length) {
    const c = todo.pop() as C;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const k = key([(c[0] as number) + dx, (c[1] as number) + dy]);
      const n = left.get(k);
      if (n) {
        left.delete(k);
        todo.push(n);
      }
    }
  }
  return left.size === 0;
}

/**
 * What is wrong with the squares of a piece, if anything: empty, repeated squares, in the
 * corridor, across a wall, or squares that do not touch. `what` starts the message.
 * Squares outside the board and rock are the caller's job (they are reported on their own).
 */
export function footprintShapeProblem(
  board: Board,
  cells: readonly C[],
  what: string,
): string | undefined {
  if (cells.length === 0) return `${what} needs at least one square.`;
  if (new Set(cells.map(key)).size !== cells.length) return `${what} lists the same square twice.`;
  const area = areaAt(board, cells[0]![0] as number, cells[0]![1] as number);
  if (area === 'C') return `${what} must be inside a room, not in the corridor.`;
  if (cells.some((c) => areaAt(board, c[0] as number, c[1] as number) !== area))
    return `${what} must be inside one room, but it crosses a wall.`;
  if (!cellsConnected(cells)) return `${what} squares must touch each other.`;
  return undefined;
}

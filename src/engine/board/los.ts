/**
 * Line of sight on a square grid, center to center.
 *
 * The line is blocked by walls and closed doors (an edge that is not open), by rock, and by
 * blocked squares. A blocked square can itself be seen (sight reaches it) but nothing is seen
 * past it. Figures never block. Rock is never seen.
 *
 * Corner rule: when the line passes exactly through a grid corner, it moves diagonally between two
 * squares. Either way round the corner is enough (both edges on one of the two routes open).
 * All arithmetic is exact (integers only), so exact corner hits are detected reliably.
 */
import type { Cell } from './board';

export type CellKind = 'floor' | 'block' | 'rock';

/** What line of sight needs to know about a grid. Built from a Level, or from ASCII in tests. */
export interface SightMap {
  readonly width: number;
  readonly height: number;
  cellKind(x: number, y: number): CellKind;
  /** Can sight pass the edge between two orthogonally adjacent cells? Must be symmetric. */
  edgeOpen(a: Cell, b: Cell): boolean;
}

function inside(m: SightMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < m.width && y < m.height;
}

/** Can the line step from `from` to the orthogonal neighbour `to`? */
function step(m: SightMap, from: Cell, to: Cell, isTarget: boolean): boolean {
  if (!inside(m, to[0], to[1])) return false;
  const k = m.cellKind(to[0], to[1]);
  if (k === 'rock') return false;
  if (k === 'block' && !isTarget) return false;
  return m.edgeOpen(from, to);
}

export function lineOfSight(m: SightMap, from: Cell, to: Cell): boolean {
  const [x0, y0] = from;
  const [x1, y1] = to;
  if (!inside(m, x0, y0) || !inside(m, x1, y1)) return false;
  if (m.cellKind(x0, y0) === 'rock' || m.cellKind(x1, y1) === 'rock') return false;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  let cx = x0;
  let cy = y0;
  // The line crosses the i-th vertical grid line at t = (2i-1) / (2 adx), the j-th horizontal one at
  // t = (2j-1) / (2 ady). Compare the two by cross-multiplying.
  let i = 1;
  let j = 1;
  while (i <= adx || j <= ady) {
    let cmp: number; // <0: vertical line first, >0: horizontal first, 0: corner
    if (i > adx) cmp = 1;
    else if (j > ady) cmp = -1;
    else cmp = (2 * i - 1) * ady - (2 * j - 1) * adx;
    if (cmp < 0) {
      const next: Cell = [cx + sx, cy];
      if (!step(m, [cx, cy], next, next[0] === x1 && next[1] === y1)) return false;
      cx = next[0];
      i++;
    } else if (cmp > 0) {
      const next: Cell = [cx, cy + sy];
      if (!step(m, [cx, cy], next, next[0] === x1 && next[1] === y1)) return false;
      cy = next[1];
      j++;
    } else {
      const nx = cx + sx;
      const ny = cy + sy;
      const last = nx === x1 && ny === y1;
      const viaX = step(m, [cx, cy], [nx, cy], false) && step(m, [nx, cy], [nx, ny], last);
      const viaY = step(m, [cx, cy], [cx, ny], false) && step(m, [cx, ny], [nx, ny], last);
      if (!viaX && !viaY) return false;
      cx = nx;
      cy = ny;
      i++;
      j++;
    }
  }
  return true;
}

/** All cells (including `from`) that `from` sees. Rock is never included. Blocked squares are. */
export function visibleFrom(m: SightMap, from: Cell): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) if (lineOfSight(m, from, [x, y])) out.push([x, y]);
  return out;
}

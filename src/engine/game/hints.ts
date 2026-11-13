/**
 * "Look from here" hint (decision 13): which seen corridor squares are worth tapping.
 *
 * A square qualifies when, by the printed board alone, at least one corridor square that is not
 * seen yet is in its line of sight. The test ignores rock and blocked squares that the players have
 * not seen, because the hint must not leak anything hidden. Walls and doors count (they are on the
 * printed board; a door that is not open blocks). Blocked squares the players already saw do block.
 * Squares that were already looked from are left out: looking again would show nothing new
 * (rock or an unseen block is what hides the rest, and the hint must not keep pointing at it).
 */
import { areaAt, type Cell } from '../board/board';
import { cellKey, edgeOpen, parseKey, type Level } from '../board/level';
import { lineOfSight, type SightMap } from '../board/los';
import type { GameState } from './state';

export function lookHintCells(level: Level, state: GameState): Cell[] {
  const { board } = level;
  const seenBlockCells = new Set<string>();
  for (const b of level.blocks)
    if (state.seenBlocks.has(b.id))
      for (const c of b.cells) seenBlockCells.add(cellKey(c[0], c[1]));

  for (const k of state.placedBlocks) seenBlockCells.add(k);

  const geometry: SightMap = {
    width: board.width,
    height: board.height,
    cellKind: (x, y) => (seenBlockCells.has(cellKey(x, y)) ? 'block' : 'floor'),
    edgeOpen: (a, b) => edgeOpen(level, a, b, state.openDoors),
  };

  const unseen: Cell[] = [];
  for (let y = 0; y < board.height; y++)
    for (let x = 0; x < board.width; x++) {
      const k = cellKey(x, y);
      if (areaAt(board, x, y) === 'C' && !state.seenCells.has(k) && !seenBlockCells.has(k))
        unseen.push([x, y]);
    }
  if (unseen.length === 0) return [];

  const out: Cell[] = [];
  for (const k of [...state.seenCells].sort(byRow)) {
    if (state.looked.has(k)) continue;
    const from = parseKey(k);
    if (areaAt(board, from[0], from[1]) !== 'C') continue;
    if (unseen.some((u) => lineOfSight(geometry, from, u))) out.push(from);
  }
  return out;
}

function byRow(a: string, b: string): number {
  const [ax, ay] = parseKey(a);
  const [bx, by] = parseKey(b);
  return ay - by || ax - bx;
}

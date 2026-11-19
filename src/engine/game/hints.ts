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
import { BOARD_TILES } from '../data/roomTiles';
import type { GameState } from './state';
import { boardTilesInView } from './view';

export function lookHintCells(level: Level, state: GameState): Cell[] {
  const { board } = level;
  const seenBlockCells = new Set<string>();
  for (const b of level.blocks)
    if (state.seenBlocks.has(b.id))
      for (const c of b.cells) seenBlockCells.add(cellKey(c[0], c[1]));

  for (const k of state.placedBlocks) seenBlockCells.add(k);
  for (const k of state.sightBlockers) seenBlockCells.add(k);

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

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** A crossroads: a corridor square with three or more corridor neighbors. */
export function isCrossing(level: Level, [x, y]: Cell): boolean {
  return SIDES.filter(([dx, dy]) => areaAt(level.board, x + dx, y + dy) === 'C').length >= 3;
}

/**
 * The squares that carry the eye glyph (owner): the crossroads where looking can show more, and,
 * when a crossroads square is occupied (a figure, a trap, a marker, a block...), the corridor squares
 * right beside it instead. `occupied` is every square with something on it. Looking stays possible
 * from any square of `lookHintCells`, from its note; the glyph is only the quiet hint.
 */
export function lookEyeCells(
  level: Level,
  state: GameState,
  occupied: ReadonlySet<string>,
): Cell[] {
  const can = lookHintCells(level, state);
  const canKeys = new Set(can.map((c) => cellKey(c[0], c[1])));
  const out: Cell[] = [];
  const seen = new Set<string>();
  // No eye on a terrain tile (an icy river, a ledge): the tile is already a lot to read.
  const onTile = new Set<string>();
  for (const t of boardTilesInView(level, state))
    if (BOARD_TILES[t.type].terrain) for (const c of t.cells) onTile.add(cellKey(c[0], c[1]));
  const add = (c: Cell) => {
    const k = cellKey(c[0], c[1]);
    if (!seen.has(k) && canKeys.has(k) && !occupied.has(k) && !onTile.has(k)) {
      seen.add(k);
      out.push(c);
    }
  };
  for (const c of can) if (isCrossing(level, c)) add(c);
  // an occupied crossroads from which looking is possible: its neighbors take the eye, if they can look too
  for (const k of state.seenCells) {
    if (!occupied.has(k) || !canKeys.has(k)) continue;
    const x = parseKey(k);
    if (areaAt(level.board, x[0], x[1]) !== 'C' || !isCrossing(level, x)) continue;
    for (const [dx, dy] of SIDES) {
      const n: Cell = [x[0] + dx, x[1] + dy];
      if (areaAt(level.board, n[0], n[1]) === 'C' && state.seenCells.has(cellKey(n[0], n[1])))
        add(n);
    }
  }
  return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function byRow(a: string, b: string): number {
  const [ax, ay] = parseKey(a);
  const [bx, by] = parseKey(b);
  return ay - by || ax - bx;
}

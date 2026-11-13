/**
 * Reveal: what the app shows after a door opens or a hero looks down a corridor.
 * Works on a Draft (a mutable copy of the state owned by the reducer).
 *
 * - A room is revealed whole: every cell, its furniture, monsters, blocked squares, doors on its
 *   walls, and trap "?" markers. Secret doors and treasure are never revealed by sight.
 * - Corridors are revealed by line of sight, center to center, from one square. A room is never
 *   partly revealed: if line of sight reaches any square of a room, the whole room is revealed.
 * - Rock is never revealed. Figures do not block sight.
 */
import { seeMonster } from './state';
import { areaAt, cellsOf, roomIds, type AreaId } from '../board/board';
import {
  cellKey,
  keyOf,
  parseKey,
  sightMap,
  type CellKey,
  type DoorInfo,
  type Level,
} from '../board/level';
import { lineOfSight } from '../board/los';
import type { Cell } from '../board/board';
import type { Draft } from './state';

export interface RevealResult {
  /** Cells that became known. */
  readonly cells: CellKey[];
}

function sizeOf(d: Draft): number {
  return (
    d.seenCells.size +
    d.seenDoors.size +
    d.seenBlocks.size +
    d.seenMonsters.size +
    d.seenFurniture.size +
    d.seenTraps.size +
    d.revealedRooms.size
  );
}

/** True when the draft learned anything since `before` (a value from `progress`). */
export const progress = sizeOf;

function markBlock(level: Level, d: Draft, x: number, y: number): void {
  const b = level.blockAt.get(cellKey(x, y));
  if (b) d.seenBlocks.add(b.id);
}

/** A floor cell becomes known, with everything that sits on it. Returns true if the cell is new. */
function markCell(level: Level, d: Draft, x: number, y: number): boolean {
  const k = cellKey(x, y);
  if (level.rock.has(k)) return false;
  const isNew = !d.seenCells.has(k);
  d.seenCells.add(k);
  const q = level.quest;
  for (const f of q.furniture)
    if (f.cells.some((c) => c[0] === x && c[1] === y)) {
      d.seenFurniture.add(f.id);
      // A chest trap stays hidden until the chest is searched for traps (SEARCH_TRAPS).
      for (const t of q.traps)
        if (t.furniture === f.id && t.kind !== 'chest') d.seenTraps.add(t.id);
    }
  for (const m of q.monsters)
    if (!m.hidden && m.cell && m.cell[0] === x && m.cell[1] === y) seeMonster(d, m);
  for (const t of q.traps) if (t.cell && t.cell[0] === x && t.cell[1] === y) d.seenTraps.add(t.id);
  for (const door of level.doorsAt.get(k) ?? [])
    if (door.kind !== 'secret') d.seenDoors.add(door.id);
  return isNew;
}

/** Reveal a whole room. Rock cells inside it stay hidden. */
export function revealRoom(level: Level, d: Draft, area: AreaId): RevealResult {
  const cells: CellKey[] = [];
  if (area === 'C') throw new Error('revealRoom needs a room, not the corridor');
  const all = cellsOf(level.board, area).filter(([x, y]) => !level.rock.has(cellKey(x, y)));
  if (all.length === 0) return { cells }; // a rock room is never revealed
  d.revealedRooms.add(area);
  for (const [x, y] of all) {
    if (level.blockAt.has(cellKey(x, y))) markBlock(level, d, x, y);
    else if (markCell(level, d, x, y)) cells.push(cellKey(x, y));
  }
  return { cells };
}

/**
 * Reveal everything in line of sight of `from` (given the open doors in the draft).
 * Blocked squares in sight are revealed, nothing behind them.
 */
export function revealFrom(level: Level, d: Draft, from: Cell): RevealResult {
  const map = sightMap(level, d.openDoors, d.placedBlocks);
  const cells: CellKey[] = [];
  for (let y = 0; y < level.board.height; y++)
    for (let x = 0; x < level.board.width; x++) {
      if (!lineOfSight(map, from, [x, y])) continue;
      if (level.blockAt.has(cellKey(x, y))) markBlock(level, d, x, y);
      else if (markCell(level, d, x, y)) cells.push(cellKey(x, y));
    }
  // A room is never partly revealed: a room square in sight shows the whole room.
  for (const room of new Set(cells.map((k) => areaAt(level.board, ...parseKey(k)))))
    if (room !== undefined && room !== 'C' && !d.revealedRooms.has(room))
      cells.push(...revealRoom(level, d, room).cells);
  return { cells };
}

/**
 * Reveal what an opened door shows (normal doors only). A room on either side that is not
 * revealed whole is revealed now. A corridor square is looked from when the other side is a room
 * the heroes already know (the square beyond the door), unless it was looked from before.
 * Call it after the door was added to `openDoors`.
 */
export function revealThroughDoor(level: Level, d: Draft, door: DoorInfo): CellKey[] {
  const sides = [door.a, door.b];
  const roomSeenBefore = sides.map((c) => {
    const area = areaAt(level.board, c[0], c[1]);
    return area !== undefined && area !== 'C' && d.revealedRooms.has(area);
  });
  const cells: CellKey[] = [];
  sides.forEach((c, i) => {
    const area = areaAt(level.board, c[0], c[1]);
    if (area === undefined) return;
    if (area !== 'C') {
      if (!d.revealedRooms.has(area)) cells.push(...revealRoom(level, d, area).cells);
    } else if (roomSeenBefore[1 - i] && !d.looked.has(keyOf(c))) {
      d.looked.add(keyOf(c));
      cells.push(...revealFrom(level, d, c).cells);
    }
  });
  return cells;
}

/**
 * Reveal the whole map except rock: every room, every corridor square, all blocks, and with them
 * the monsters, furniture, normal and false doors and trap "?" markers on those squares.
 * Hidden monsters, secret doors and chest traps stay hidden.
 */
export function revealEverything(level: Level, d: Draft): RevealResult {
  const cells: CellKey[] = [];
  for (const room of roomIds(level.board)) cells.push(...revealRoom(level, d, room).cells);
  for (let y = 0; y < level.board.height; y++)
    for (let x = 0; x < level.board.width; x++) {
      if (areaAt(level.board, x, y) !== 'C' || level.rock.has(cellKey(x, y))) continue;
      if (level.blockAt.has(cellKey(x, y))) markBlock(level, d, x, y);
      else if (markCell(level, d, x, y)) cells.push(cellKey(x, y));
    }
  return { cells };
}

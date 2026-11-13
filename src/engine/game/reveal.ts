/**
 * Reveal: what the app shows after a door opens or a hero looks down a corridor.
 * Works on a Draft (a mutable copy of the state owned by the reducer).
 *
 * - A room is revealed whole: every cell, its furniture, monsters, blocked squares, doors on its
 *   walls, and trap "?" markers. Secret doors and treasure are never revealed by sight.
 * - Corridors are revealed by line of sight, center to center, from one square. Through an
 *   open door only the cells in sight are revealed, not the whole room.
 * - Rock is never revealed. Figures do not block sight.
 */
import { cellsOf, type AreaId } from '../board/board';
import { cellKey, sightMap, type CellKey, type Level } from '../board/level';
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
      for (const t of q.traps) if (t.furniture === f.id) d.seenTraps.add(t.id);
    }
  for (const m of q.monsters)
    if (!m.hidden && m.cell && m.cell[0] === x && m.cell[1] === y) d.seenMonsters.add(m.id);
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
  const map = sightMap(level, d.openDoors);
  const cells: CellKey[] = [];
  for (let y = 0; y < level.board.height; y++)
    for (let x = 0; x < level.board.width; x++) {
      if (!lineOfSight(map, from, [x, y])) continue;
      if (level.blockAt.has(cellKey(x, y))) markBlock(level, d, x, y);
      else if (markCell(level, d, x, y)) cells.push(cellKey(x, y));
    }
  return { cells };
}

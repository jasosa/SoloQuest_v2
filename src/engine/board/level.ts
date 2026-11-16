/**
 * Level = fixed board + one quest. Everything static the engine needs to answer
 * "what stops sight or movement here?": rock, blocked squares, doors by edge.
 * Game-dependent facts (which doors are open) are passed in as a set of door ids.
 */
import { resolveEnemies } from '../data/enemies';
import type { Quest } from '../quest/schema';
import {
  areaAt,
  board as defaultBoard,
  inBoard,
  isWallBetween,
  type Board,
  type Cell,
} from './board';
import type { CellKind, SightMap } from './los';

export type CellKey = string;
export const cellKey = (x: number, y: number): CellKey => `${x},${y}`;
export const keyOf = (c: Cell): CellKey => cellKey(c[0], c[1]);
export const parseKey = (k: CellKey): Cell => {
  const [x, y] = k.split(',').map(Number);
  return [x as number, y as number];
};
/** Key of the edge between two cells, the same in both directions. */
export function edgeKey(a: Cell, b: Cell): string {
  const ka = keyOf(a);
  const kb = keyOf(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

export type DoorKind = 'normal' | 'secret' | 'false';
export interface DoorInfo {
  readonly id: string;
  readonly kind: DoorKind;
  readonly a: Cell;
  readonly b: Cell;
}
export interface BlockInfo {
  readonly id: string;
  readonly cells: readonly Cell[];
}

export interface Level {
  readonly board: Board;
  readonly quest: Quest;
  /** Rock cells (rock rooms and single rock cells). */
  readonly rock: ReadonlySet<CellKey>;
  readonly blocks: readonly BlockInfo[];
  readonly blockAt: ReadonlyMap<CellKey, BlockInfo>;
  readonly doors: ReadonlyMap<string, DoorInfo>;
  readonly doorAtEdge: ReadonlyMap<string, DoorInfo>;
  /** Doors touching a cell (either side). */
  readonly doorsAt: ReadonlyMap<CellKey, readonly DoorInfo[]>;
}

export function buildLevel(source: Quest, board: Board = defaultBoard): Level {
  // Monsters that point at an enemy get its defaults here, so the engine never sees the link.
  const quest = resolveEnemies(source);
  const rockRooms = new Set(quest.rock.rooms);
  const rock = new Set<CellKey>(quest.rock.cells.map(keyOf));
  for (let y = 0; y < board.height; y++)
    for (let x = 0; x < board.width; x++) {
      const a = areaAt(board, x, y);
      if (a !== undefined && rockRooms.has(a)) rock.add(cellKey(x, y));
    }

  const blocks: BlockInfo[] = quest.blocks.map((b, i) => ({
    id: b.id ?? `b${i + 1}`,
    cells: b.cells,
  }));
  const blockAt = new Map<CellKey, BlockInfo>();
  for (const b of blocks) for (const c of b.cells) blockAt.set(keyOf(c), b);

  const doors = new Map<string, DoorInfo>();
  const doorAtEdge = new Map<string, DoorInfo>();
  const doorsAt = new Map<CellKey, DoorInfo[]>();
  const add = (list: Quest['doors'], kind: DoorKind) => {
    for (const d of list) {
      const info: DoorInfo = { id: d.id, kind, a: d.a, b: d.b };
      doors.set(d.id, info);
      doorAtEdge.set(edgeKey(d.a, d.b), info);
      for (const c of [d.a, d.b]) {
        const k = keyOf(c);
        doorsAt.set(k, [...(doorsAt.get(k) ?? []), info]);
      }
    }
  };
  add(quest.doors, 'normal');
  add(quest.secretDoors, 'secret');
  add(quest.falseDoors, 'false');

  return { board, quest, rock, blocks, blockAt, doors, doorAtEdge, doorsAt };
}

export function isRock(level: Level, x: number, y: number): boolean {
  return level.rock.has(cellKey(x, y));
}
export function isBlocked(level: Level, x: number, y: number): boolean {
  return level.blockAt.has(cellKey(x, y));
}
/** Rock, a blocked square, or outside the board: sight stops here. */
export function blocksSight(
  level: Level,
  x: number,
  y: number,
  placedBlocks: ReadonlySet<CellKey> = new Set(),
): boolean {
  return (
    !inBoard(level.board, x, y) ||
    isRock(level, x, y) ||
    isBlocked(level, x, y) ||
    placedBlocks.has(cellKey(x, y))
  );
}
/** Same set as blocksSight: nobody can stand on or walk through these squares. */
export const blocksMove: typeof blocksSight = blocksSight;

/** Wall between two neighbours, derived from the areas only (doors and rock are not considered). */
export function isWall(level: Level, a: Cell, b: Cell): boolean {
  return isWallBetween(level.board, a, b);
}

/**
 * Can sight and movement pass the edge between two orthogonal neighbours?
 * A door on the edge decides: a normal or secret door passes once its id is in `openDoors`
 * (a secret door that nobody opened is a wall), a false door never passes. With no door the
 * edge is open unless it is a wall.
 * Does not look at rock or blocked squares: those are cell properties.
 */
export function edgeOpen(level: Level, a: Cell, b: Cell, openDoors: ReadonlySet<string>): boolean {
  const door = level.doorAtEdge.get(edgeKey(a, b));
  if (door) return door.kind !== 'false' && openDoors.has(door.id);
  return !isWall(level, a, b);
}

/**
 * Line of sight map for the real game: rock and blocks from the quest, doors from `openDoors`.
 * `placedBlocks` are blocks made during play (falling block traps).
 */
export function sightMap(
  level: Level,
  openDoors: ReadonlySet<string>,
  placedBlocks: ReadonlySet<CellKey> = new Set(),
): SightMap {
  return {
    width: level.board.width,
    height: level.board.height,
    cellKind(x, y): CellKind {
      if (isRock(level, x, y)) return 'rock';
      if (isBlocked(level, x, y) || placedBlocks.has(cellKey(x, y))) return 'block';
      return 'floor';
    },
    edgeOpen: (a, b) => edgeOpen(level, a, b, openDoors),
  };
}

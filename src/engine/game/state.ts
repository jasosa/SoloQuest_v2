import type { AreaId } from '../board/board';
import type { CellKey } from '../board/level';
import { createRng, type Rng } from './rng';

/**
 * Everything the engine knows about the game. Plain data, never mutated: the reducer returns
 * a new state. Sets are replaced, not edited.
 *
 * It does NOT hold hero or monster positions, hero Body Points, gold or equipment.
 */
export interface GameState {
  readonly rng: Rng;
  /** Zargon turn counter, starts at 1. */
  readonly turn: number;
  /** Cells whose floor is known (room cells, corridor cells in sight). Never rock. */
  readonly seenCells: ReadonlySet<CellKey>;
  /** Rooms revealed whole (start room, rooms behind opened doors). */
  readonly revealedRooms: ReadonlySet<AreaId>;
  /** Corridor squares the players already looked from. */
  readonly looked: ReadonlySet<CellKey>;
  /** Ids of doors that are open. Doors never close. */
  readonly openDoors: ReadonlySet<string>;
  /** Doors on the map (normal and false doors that were seen; a secret door once it is found). */
  readonly seenDoors: ReadonlySet<string>;
  /** Block ids (see Level.blocks) that were seen. */
  readonly seenBlocks: ReadonlySet<string>;
  readonly seenMonsters: ReadonlySet<string>;
  readonly seenFurniture: ReadonlySet<string>;
  /** Trap ids shown as "?". Their kind is not part of the state. */
  readonly seenTraps: ReadonlySet<string>;
}

export function emptyState(seed: number): GameState {
  return {
    rng: createRng(seed),
    turn: 1,
    seenCells: new Set(),
    revealedRooms: new Set(),
    looked: new Set(),
    openDoors: new Set(),
    seenDoors: new Set(),
    seenBlocks: new Set(),
    seenMonsters: new Set(),
    seenFurniture: new Set(),
    seenTraps: new Set(),
  };
}

/** Mutable copy used inside the reducer while one event is applied. */
export type Draft = {
  -readonly [K in keyof GameState]: GameState[K] extends ReadonlySet<infer T>
    ? Set<T>
    : GameState[K];
};

export function draftOf(s: GameState): Draft {
  return {
    ...s,
    seenCells: new Set(s.seenCells),
    revealedRooms: new Set(s.revealedRooms),
    looked: new Set(s.looked),
    openDoors: new Set(s.openDoors),
    seenDoors: new Set(s.seenDoors),
    seenBlocks: new Set(s.seenBlocks),
    seenMonsters: new Set(s.seenMonsters),
    seenFurniture: new Set(s.seenFurniture),
    seenTraps: new Set(s.seenTraps),
  };
}

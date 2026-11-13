import type { AreaId } from '../board/board';
import type { CellKey } from '../board/level';
import { statsOf } from '../data/monsters';
import type { Hero } from '../data/heroes';
import type { MonsterDef, MonsterType } from '../quest/schema';
import { createRng, type Rng } from './rng';

/**
 * Everything the engine knows about the game. Plain data, never mutated: the reducer returns
 * a new state. Sets are replaced, not edited.
 *
 * It does NOT hold hero or monster positions, hero Body Points, gold or equipment.
 */
/** Optional Body Point tracking for a monster that was seen. Nothing else about it. */
export interface MonsterRecord {
  readonly body: number;
  readonly dead: boolean;
}

/** A wandering monster: in the roster, never on a square. */
export interface WandererRecord {
  readonly type: MonsterType;
  /** The room where the search happened. */
  readonly room: AreaId;
  /** The hero it came for. */
  readonly wanderAt: Hero;
  /** True from the moment it appears until the end of the Zargon turn ("attacks now"). */
  readonly fresh: boolean;
}

/** A trap that is not armed any more. An armed trap has no entry. */
export type TrapState = 'sprung' | 'disarmed';

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
  /** One record per seen monster id. */
  readonly monsters: Readonly<Record<string, MonsterRecord>>;
  readonly seenFurniture: ReadonlySet<string>;
  /** Trap ids shown as "?". Their kind is not part of the state. */
  readonly seenTraps: ReadonlySet<string>;
  /** Traps that sprung or were disarmed. Armed traps are not listed. */
  readonly trapStates: Readonly<Record<string, TrapState>>;
  /** Squares where a falling block trap left a permanent block (stops sight and movement). */
  readonly placedBlocks: ReadonlySet<CellKey>;
  /** Heroes that searched a room for treasure, in order. A hero searches a room once. */
  readonly treasureSearched: Readonly<Record<AreaId, readonly Hero[]>>;
  /** Chests (furniture ids) that were searched for traps. One search per chest. */
  readonly trapSearched: readonly string[];
  /** Wandering monsters by id (w1, w2...). They are also in `monsters` and `seenMonsters`. */
  readonly wanderers: Readonly<Record<string, WandererRecord>>;
  /** How many wandering monsters appeared (next id is w<count + 1>). */
  readonly wanderCount: number;
  /** Ids of notes that fired, in order, each once. The notes engine (M4) builds the journal. */
  readonly notesFired: readonly string[];
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
    monsters: {},
    seenFurniture: new Set(),
    seenTraps: new Set(),
    trapStates: {},
    placedBlocks: new Set(),
    treasureSearched: {},
    trapSearched: [],
    wanderers: {},
    wanderCount: 0,
    notesFired: [],
  };
}

/** Mutable copy used inside the reducer while one event is applied. */
export type Draft = {
  -readonly [K in keyof GameState]: GameState[K] extends ReadonlySet<infer T>
    ? Set<T>
    : K extends 'monsters'
      ? Record<string, MonsterRecord>
      : K extends 'wanderers'
        ? Record<string, WandererRecord>
        : K extends 'trapStates'
          ? Record<string, TrapState>
          : K extends 'treasureSearched'
            ? Record<AreaId, readonly Hero[]>
            : GameState[K];
};

/** A monster is seen for the first time: remember it and start its Body Points. */
export function seeMonster(d: Draft, m: MonsterDef): void {
  if (d.seenMonsters.has(m.id)) return;
  d.seenMonsters.add(m.id);
  d.monsters[m.id] = { body: statsOf(m).body, dead: false };
}

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
    monsters: { ...s.monsters },
    seenFurniture: new Set(s.seenFurniture),
    seenTraps: new Set(s.seenTraps),
    trapStates: { ...s.trapStates },
    placedBlocks: new Set(s.placedBlocks),
    treasureSearched: { ...s.treasureSearched },
    wanderers: { ...s.wanderers },
  };
}

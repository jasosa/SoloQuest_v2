import type { AreaId } from '../board/board';
import type { CellKey } from '../board/level';
import { statsOf } from '../data/monsters';
import type { Hero } from '../data/heroes';
import type { Effect, MonsterDef, MonsterType } from '../quest/schema';
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

/**
 * A monster that joined in play: a wandering monster (decision 33) or one the players added
 * (a spell, for instance). The players enter the square they put it on (decision 66), only so it is
 * drawn, can be slain and acts on Zargon's turn. The app never moves it.
 */
export interface WandererRecord {
  readonly type: MonsterType;
  /** The room where the search happened, or the area of its square. */
  readonly room: AreaId;
  /** An enemy of the quest that it is (`quest.enemyDefs`), so it has that enemy's stats and plan. */
  readonly enemy?: string;
  /** The hero a wandering monster came for. */
  readonly wanderAt?: Hero;
  /** True from the moment it appears until the end of the Zargon turn ("attacks now"). */
  readonly fresh: boolean;
  /** The square the players put it on. */
  readonly cell?: readonly [number, number];
  /** Added by the players, not a wandering monster. */
  readonly added?: boolean;
  /** Multi-map quests: the map it appeared on. It is only in play on that map. */
  readonly map?: string;
}

/** What a map keeps while the heroes are on another map: things tied to its squares and rooms. */
export interface MapMemory {
  readonly placedBlocks: readonly CellKey[];
  readonly treasureSearched: Readonly<Record<AreaId, readonly Hero[]>>;
}

/** A trap that is not armed any more. An armed trap has no entry. */
export type TrapState = 'sprung' | 'disarmed';

/** The state of a monster set by the quest notes. Without a record, the quest data decides. */
export interface MonsterStateRecord {
  readonly state: 'active' | 'dormant' | 'stone' | 'away' | 'passive';
  /** Why a monster is `away`: it left the roster without being killed (decision 51). */
  readonly reason?: 'escaped' | 'surrendered' | 'freed' | undefined;
  /** Zargon turns left as stone (counts down on ZARGON_TURN_END). Only for `stone`. */
  readonly turns?: number | undefined;
}

/** A `promptChoice` waiting for the players. Plain quest data, so replay is exact. */
export interface PendingChoice {
  readonly note: string;
  readonly text: string;
  readonly options: readonly { readonly label: string; readonly effects: readonly Effect[] }[];
}

/** A choice that was made, kept for the journal. */
export interface ChoiceMade {
  readonly note: string;
  readonly text: string;
  readonly picked: string;
  /** showText and giveItem texts of the chosen option. */
  readonly texts: readonly string[];
}

export interface GameState {
  /** The quest seed (never changes). Zargon's orders are derived from it, not from `rng`. */
  readonly seed: number;
  readonly rng: Rng;
  /** Zargon turn counter, starts at 1. */
  readonly turn: number;
  /** Multi-map quests only: the id of the map the heroes are on (decision 45). */
  readonly map?: string;
  /** Multi-map quests: the last crossing, where the heroes arrived. The reducer reveals it. */
  readonly arrival?: { readonly map: string; readonly cell: readonly [number, number] };
  /** Multi-map quests: per map, what stays on a map while the heroes are elsewhere. */
  readonly mapMemory: Readonly<Record<string, MapMemory>>;
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
  /** Squares of a tile that blocks sight and movement until its flag is set (the cage of Q0). */
  readonly sightBlockers: ReadonlySet<CellKey>;
  /** Furniture a note replaced (a throne that became a door): never drawn again. */
  readonly removedFurniture: readonly string[];
  /** Doors a note removed: they are walls now, never drawn, never opened. */
  readonly removedDoors: readonly string[];
  /** Ice slides whose whole path is visible (a spring or a good jump, decision 42). */
  readonly slidesShown: readonly string[];
  /** Squares where a falling block trap or a note left a permanent block (stops sight and movement). */
  readonly placedBlocks: ReadonlySet<CellKey>;
  /** Heroes that searched a room for treasure, in order. A hero searches a room once. */
  readonly treasureSearched: Readonly<Record<AreaId, readonly Hero[]>>;
  /** Chests (furniture ids) that were searched for traps. One search per chest. */
  readonly trapSearched: readonly string[];
  /** Wandering monsters by id (w1, w2...). They are also in `monsters` and `seenMonsters`. */
  readonly wanderers: Readonly<Record<string, WandererRecord>>;
  /** How many wandering monsters appeared (next id is w<count + 1>). */
  readonly wanderCount: number;
  /** Ids of notes that fired, in order, each once (a note that repeats is listed once). */
  readonly notesFired: readonly string[];
  /** Quest flags set by notes. Unset means false. */
  readonly flags: Readonly<Record<string, boolean>>;
  /** Quest counters changed by notes (for example a bounty). Unset means 0. */
  readonly counters: Readonly<Record<string, number>>;
  /** Objectives completed by a `completeObjective` effect. */
  readonly objectivesDone: readonly string[];
  /** Monster states set by notes (dormant, stone, active). */
  readonly monsterStates: Readonly<Record<string, MonsterStateRecord>>;
  /** Where a hidden monster was placed, when the quest names a square. Text for the players. */
  readonly placedMonsterCells: Readonly<Record<string, readonly [number, number]>>;
  /** NPCs that appeared by a `spawnNpc` effect. */
  readonly spawnedNpcs: readonly string[];
  /** Choices waiting for an answer, oldest first. */
  readonly pendingChoices: readonly PendingChoice[];
  readonly choicesMade: readonly ChoiceMade[];
  /** Dread spells cast so far, per monster id, in order. A spell listed twice in the quest may be cast twice. */
  readonly spellsCast: Readonly<Record<string, readonly string[]>>;
  /** Monsters that cast a spell this Zargon turn (for `onePerTurn`). Cleared on ZARGON_TURN_END. */
  readonly castThisTurn: readonly string[];
  /** Heroes that died, in order of death. Only the fact is tracked: no wounds, no Body Points. */
  readonly deadHeroes: readonly Hero[];
  /** Spells the players said could not be cast this turn, per monster, in order. Cleared on ZARGON_TURN_END. */
  readonly spellsFailed: Readonly<Record<string, readonly string[]>>;
  /** Monsters whose order was carried out this Zargon turn. Cleared on ZARGON_TURN_END. */
  readonly doneThisTurn: readonly string[];
  /** Set once by END_QUEST. After that every event is rejected. */
  readonly ended:
    | ({ readonly outcome: 'stairs' | 'fell' } & EndNotes)
    | ({ readonly outcome: 'ending'; readonly ending: string } & EndNotes)
    | undefined;
}

/** The texts of the notes that fired when the quest ended (`questEnds`). */
interface EndNotes {
  readonly notes?: readonly string[];
}

export function emptyState(seed: number): GameState {
  return {
    seed: seed >>> 0,
    rng: createRng(seed),
    turn: 1,
    mapMemory: {},
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
    slidesShown: [],
    removedDoors: [],
    sightBlockers: new Set(),
    removedFurniture: [],
    placedBlocks: new Set(),
    treasureSearched: {},
    trapSearched: [],
    wanderers: {},
    wanderCount: 0,
    notesFired: [],
    flags: {},
    counters: {},
    objectivesDone: [],
    monsterStates: {},
    placedMonsterCells: {},
    spawnedNpcs: [],
    pendingChoices: [],
    choicesMade: [],
    spellsCast: {},
    castThisTurn: [],
    spellsFailed: {},
    deadHeroes: [],
    doneThisTurn: [],
    ended: undefined,
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
            : K extends 'flags'
              ? Record<string, boolean>
              : K extends 'counters'
                ? Record<string, number>
                : K extends 'monsterStates'
                  ? Record<string, MonsterStateRecord>
                  : K extends 'placedMonsterCells'
                    ? Record<string, readonly [number, number]>
                    : GameState[K];
};

/** A monster is seen for the first time: remember it and start its Body Points. */
export function seeMonster(d: Draft, m: MonsterDef): void {
  if (d.seenMonsters.has(m.id)) return;
  d.seenMonsters.add(m.id);
  // A monster seen again after a map crossing keeps its wounds (decision 45).
  d.monsters[m.id] ??= { body: statsOf(m).body, dead: false };
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
    sightBlockers: new Set(s.sightBlockers),
    treasureSearched: { ...s.treasureSearched },
    wanderers: { ...s.wanderers },
    flags: { ...s.flags },
    counters: { ...s.counters },
    monsterStates: { ...s.monsterStates },
    placedMonsterCells: { ...s.placedMonsterCells },
  };
}

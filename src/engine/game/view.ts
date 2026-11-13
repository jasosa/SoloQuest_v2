/** Read-only selectors over the game state, for the UI. Pure. */
import { MONSTER_NAMES, statsOf, type MonsterStats } from '../data/monsters';
import { roomIds, type AreaId, type Cell } from '../board/board';
import type { Level } from '../board/level';
import type { Hero } from '../data/heroes';
import type { MonsterType } from '../quest/schema';
import type { TrapKindName } from './prompts';
import { liveMonstersInRoom } from './search';
import type { GameState } from './state';

export interface MonsterView {
  readonly id: string;
  readonly type: MonsterType;
  /** The quest's name for the monster, or the name of its type. */
  readonly name: string;
  readonly stats: MonsterStats;
  readonly body: number;
  readonly maxBody: number;
  readonly dead: boolean;
  /** Wandering monster: in the roster, no square. */
  readonly wandering?: boolean;
  readonly wanderAt?: Hero;
  /** True until the end of the Zargon turn after it appeared ("attacks now"). */
  readonly fresh?: boolean;
}

/** Monsters the heroes have seen, in quest order. Hidden or unseen monsters are not listed. */
export function monstersInPlay(level: Level, state: GameState): MonsterView[] {
  const out: MonsterView[] = [];
  for (const m of level.quest.monsters) {
    const rec = state.monsters[m.id];
    if (!state.seenMonsters.has(m.id) || !rec) continue;
    const stats = statsOf(m);
    out.push({
      id: m.id,
      type: m.type,
      name: m.name ?? MONSTER_NAMES[m.type],
      stats,
      body: rec.body,
      maxBody: stats.body,
      dead: rec.dead,
    });
  }
  for (const [id, w] of Object.entries(state.wanderers)) {
    const rec = state.monsters[id];
    if (!rec) continue;
    const stats = statsOf({ type: w.type });
    out.push({
      id,
      type: w.type,
      name: MONSTER_NAMES[w.type],
      stats,
      body: rec.body,
      maxBody: stats.body,
      dead: rec.dead,
      wandering: true,
      wanderAt: w.wanderAt,
      fresh: w.fresh,
    });
  }
  return out;
}

export interface TrapView {
  readonly id: string;
  /** The trap square, or the first square of its furniture. */
  readonly cell: Cell;
  readonly furniture?: string;
  readonly state: 'armed' | 'sprung' | 'disarmed';
  /** Only told once the trap sprung or was disarmed. */
  readonly kind?: TrapKindName;
  /** Still drawn on the map: armed "?", a sprung pit, a placed block. */
  readonly onMap: boolean;
  /** The sprung trap left a permanent block on its square. */
  readonly block: boolean;
}

/** Traps the players have seen. The kind of an armed trap is never included. */
export function trapsInView(level: Level, state: GameState): TrapView[] {
  const out: TrapView[] = [];
  for (const t of level.quest.traps) {
    if (!state.seenTraps.has(t.id)) continue;
    const furniture = t.furniture
      ? level.quest.furniture.find((f) => f.id === t.furniture)
      : undefined;
    const cell = t.cell ?? furniture?.cells[0];
    if (!cell) continue;
    const st = state.trapStates[t.id] ?? 'armed';
    const stays =
      st === 'armed' || (st === 'sprung' && (t.kind === 'pit' || t.kind === 'fallingBlock'));
    out.push({
      id: t.id,
      cell,
      ...(t.furniture !== undefined ? { furniture: t.furniture } : {}),
      state: st,
      ...(st !== 'armed' ? { kind: t.kind } : {}),
      onMap: stays,
      block: st === 'sprung' && t.kind === 'fallingBlock',
    });
  }
  return out;
}

export interface SearchState {
  readonly room: AreaId;
  /** Heroes that already searched this room for treasure. */
  readonly searchedBy: readonly Hero[];
  /** Seen, living monsters that started in this room (the guard). */
  readonly monstersInRoom: readonly string[];
}

export function searchState(level: Level, state: GameState, room: AreaId): SearchState {
  return {
    room,
    searchedBy: state.treasureSearched[room] ?? [],
    monstersInRoom: liveMonstersInRoom(level, state, room),
  };
}

/** Revealed rooms, in board order, with their search state. */
export function roomsSearchable(level: Level, state: GameState): SearchState[] {
  return roomIds(level.board)
    .filter((r) => state.revealedRooms.has(r))
    .map((r) => searchState(level, state, r));
}

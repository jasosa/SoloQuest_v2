/** Read-only selectors over the game state, for the UI. Pure. */
import { abilityLookup, type AbilityDef } from '../data/abilities';
import { MONSTER_NAMES, statsOf, type MonsterStats } from '../data/monsters';
import { areaAt, roomIds, type AreaId, type Cell } from '../board/board';
import type { Level } from '../board/level';
import type { Hero } from '../data/heroes';
import type { MonsterType } from '../quest/schema';
import type { TrapKindName } from './prompts';
import { isDormant, liveMonstersInRoom, monsterStateOf } from './monstersIn';
import type { GameState } from './state';

export * from './noteView';
export * from './log';

export interface MonsterView {
  readonly id: string;
  readonly type: MonsterType;
  /** The quest's name for the monster, or the name of its type. */
  readonly name: string;
  readonly stats: MonsterStats;
  readonly body: number;
  readonly maxBody: number;
  readonly dead: boolean;
  /** Dormant and stone monsters are in the roster but do not act. */
  readonly state: 'active' | 'dormant' | 'stone';
  /** Zargon turns of stone left, when the quest says so. */
  readonly stoneTurns?: number;
  /** The square the quest names for a monster placed by a note. Text for the players. */
  readonly placeAt?: Cell;
  /** Wandering monster: in the roster, no square. */
  readonly wandering?: boolean;
  readonly wanderAt?: Hero;
  /** True until the end of the Zargon turn after it appeared ("attacks now"). */
  readonly fresh?: boolean;
  /** Story-critical monster: ring and star (decision 69). */
  readonly special: boolean;
  /** Its abilities, resolved from the core library and the quest's own. */
  readonly abilities: readonly AbilityDef[];
  /** The letter of its token code, when it is not the letter of its type (an enemy of the quest). */
  readonly letter?: string;
  /** A picture for its token and roster row (a data URL). Without it the letter icon is shown. */
  readonly image?: string;
}

function abilitiesOf(
  lookup: ReadonlyMap<string, AbilityDef>,
  ids: readonly string[] | undefined,
): AbilityDef[] {
  const out: AbilityDef[] = [];
  for (const id of ids ?? []) {
    const a = lookup.get(id);
    if (a) out.push(a);
  }
  return out;
}

/** Monsters the heroes have seen, in quest order. Hidden or unseen monsters are not listed. */
export function monstersInPlay(level: Level, state: GameState): MonsterView[] {
  const out: MonsterView[] = [];
  const lookup = abilityLookup(level.quest);
  for (const m of level.quest.monsters) {
    const rec = state.monsters[m.id];
    if (!state.seenMonsters.has(m.id) || !rec || isDormant(m, state)) continue;
    const stats = statsOf(m);
    const st = monsterStateOf(m, state);
    const placeAt = state.placedMonsterCells[m.id];
    out.push({
      id: m.id,
      type: m.type,
      name: m.name ?? MONSTER_NAMES[m.type],
      stats,
      body: rec.body,
      maxBody: stats.body,
      dead: rec.dead,
      state: st.state,
      special: m.special === true,
      abilities: abilitiesOf(lookup, m.abilities),
      ...(m.letter ? { letter: m.letter } : {}),
      ...(m.image ? { image: m.image } : {}),
      ...(st.turns !== undefined ? { stoneTurns: st.turns } : {}),
      ...(placeAt ? { placeAt } : {}),
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
      state: 'active',
      wandering: true,
      wanderAt: w.wanderAt,
      fresh: w.fresh,
      special: false,
      abilities: [],
    });
  }
  return out;
}

/** The heroes of the team that are still alive, in team order (decision 32). */
export function livingHeroes(team: readonly Hero[], state: Pick<GameState, 'deadHeroes'>): Hero[] {
  return team.filter((h) => !state.deadHeroes.includes(h));
}

export interface DormantFigure {
  readonly id: string;
  readonly type: MonsterType;
  readonly cell: Cell;
}

/**
 * Dormant monsters whose square the heroes have seen (decision 28). They are furniture until a
 * note wakes them: draw a neutral statue figure. They are never in `monstersInPlay`.
 */
export function dormantFigures(level: Level, state: GameState): DormantFigure[] {
  const out: DormantFigure[] = [];
  for (const m of level.quest.monsters) {
    const cell = state.placedMonsterCells[m.id] ?? m.cell;
    if (!cell || !state.seenMonsters.has(m.id) || !isDormant(m, state)) continue;
    if (state.monsters[m.id]?.dead) continue;
    out.push({ id: m.id, type: m.type, cell });
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

export interface ChestView {
  readonly id: string;
  readonly cells: readonly Cell[];
  readonly room: AreaId;
  /** Searched for traps already. */
  readonly searched: boolean;
  /** A trap was found on it and is still armed. False before the search, whatever is there. */
  readonly trapFound: boolean;
}

/** Seen chests. Whether a trap exists is not told before the search. */
export function chestsInView(level: Level, state: GameState): ChestView[] {
  const out: ChestView[] = [];
  for (const f of level.quest.furniture) {
    if (f.type !== 'chest' || !state.seenFurniture.has(f.id)) continue;
    const room = areaAt(level.board, f.cells[0]![0], f.cells[0]![1]);
    if (room === undefined) continue;
    out.push({
      id: f.id,
      cells: f.cells,
      room,
      searched: state.trapSearched.includes(f.id),
      trapFound: level.quest.traps.some(
        (t) =>
          t.kind === 'chest' &&
          t.furniture === f.id &&
          state.seenTraps.has(t.id) &&
          state.trapStates[t.id] === undefined,
      ),
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

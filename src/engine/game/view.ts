/** Read-only selectors over the game state, for the UI. Pure. */
import { abilityLookup, type AbilityDef } from '../data/abilities';
import { boxOfMonster, pictureTypeOf } from '../data/enemies';
import { MONSTER_NAMES, statsOf, type MonsterStats } from '../data/monsters';
import { areaAt, roomIds, type AreaId, type Cell } from '../board/board';
import type { Level } from '../board/level';
import { normalizeTeam, type TeamInput } from '../data/team';
import type { MonsterType } from '../quest/schema';
import { profileOf, type Profile } from '../zargon/weights';
import type { TrapKindName } from './prompts';
import { trapKind } from '../data/trapKinds';
import { isDormant, liveMonstersInRoom, monsterStateOf } from './monstersIn';
import { wandererDef } from './roster';
import { BOARD_TILES, type BoardTileType } from '../data/roomTiles';
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
  /** Dormant and stone monsters are in the roster but do not act; so is a passive one (it has buttons). */
  readonly state: 'active' | 'dormant' | 'stone' | 'away' | 'passive';
  /** The box it comes from (its enemy's expansion), for the look of its token. */
  readonly box?: string;
  /** The core type whose texture-pack picture it may use; none for an enemy of its own kind. */
  readonly pictureType?: MonsterType;
  /** The id of its enemy in the quest, so a texture pack can give that enemy its own picture. */
  readonly enemy?: string;
  /** Its Zargon plan (a thief can escape, a passive monster can leave or be attacked). */
  readonly profile: Profile;
  /** Squares along a side (2 is a large monster). */
  readonly size?: number;
  /** It is attacked, not fought: no wounds, no Slain on its card. The quest's notes say what an attack does. */
  readonly attackOnly?: boolean;
  /** Zargon turns of stone left, when the quest says so. */
  readonly stoneTurns?: number;
  /** The square the quest names for a monster placed by a note. Text for the players. */
  readonly placeAt?: Cell;
  /** Wandering monster (decision 33). */
  readonly wandering?: boolean;
  readonly wanderAt?: string;
  /** Added by the players in play (decision 66). */
  readonly added?: boolean;
  /** The square the players put a wandering or added monster on. */
  readonly cell?: Cell;
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
      profile: profileOf(m),
      ...(boxOfMonster(m, level.quest.enemyDefs)
        ? { box: boxOfMonster(m, level.quest.enemyDefs)! }
        : {}),
      ...(pictureTypeOf(m, level.quest.enemyDefs)
        ? { pictureType: pictureTypeOf(m, level.quest.enemyDefs)! }
        : {}),
      ...(m.enemy ? { enemy: m.enemy } : {}),
      ...(m.size && m.size > 1 ? { size: m.size } : {}),
      ...(m.attackOnly ? { attackOnly: true } : {}),
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
    // a wanderer that escaped (MONSTER_LEAVE) is off the roster
    if (!rec || state.monsterStates[id]?.state === 'away') continue;
    // a wanderer of another map (multi-map quests) is not here
    if (w.map !== state.map) continue;
    const def = wandererDef(level, w, id);
    const stats = statsOf(def);
    const bx = boxOfMonster(def, level.quest.enemyDefs);
    const pt = pictureTypeOf(def, level.quest.enemyDefs);
    out.push({
      id,
      type: w.type,
      name: def.name ?? MONSTER_NAMES[w.type],
      stats,
      body: rec.body,
      maxBody: stats.body,
      dead: rec.dead,
      state: 'active',
      profile: profileOf(def),
      ...(bx ? { box: bx } : {}),
      ...(pt ? { pictureType: pt } : {}),
      ...(def.enemy ? { enemy: def.enemy } : {}),
      ...(def.letter ? { letter: def.letter } : {}),
      ...(def.image ? { image: def.image } : {}),
      wandering: w.added !== true,
      ...(w.wanderAt ? { wanderAt: w.wanderAt } : {}),
      ...(w.added ? { added: true } : {}),
      ...(w.cell ? { cell: [w.cell[0], w.cell[1]] as Cell } : {}),
      fresh: w.fresh,
      special: false,
      abilities: abilitiesOf(lookup, def.abilities),
    });
  }
  return out;
}

export interface BoardTileView {
  /** Position in `quest.boardTiles`, a stable id for the tile. */
  readonly index: number;
  readonly type: BoardTileType;
  readonly name: string;
  readonly cells: readonly Cell[];
}

/**
 * Board tiles the players can see: a tile that is always shown (the cave under the start), or one
 * with a square they have seen.
 */
export function boardTilesInView(level: Level, state: GameState): BoardTileView[] {
  return level.quest.boardTiles
    .map((t, index) => ({ t, index }))
    .filter(
      ({ t }) =>
        BOARD_TILES[t.type].always || t.cells.some((c) => state.seenCells.has(`${c[0]},${c[1]}`)),
    )
    .map(({ t, index }) => ({
      index,
      type: t.type,
      name: BOARD_TILES[t.type].name,
      cells: t.cells,
    }));
}

/** The visible board tiles that cover a square (a terrain under a hero's square, say). */
export function boardTilesAt(level: Level, state: GameState, cell: Cell): BoardTileView[] {
  return boardTilesInView(level, state).filter((t) =>
    t.cells.some((c) => c[0] === cell[0] && c[1] === cell[1]),
  );
}

/** The visible board tiles that have a square in a room. */
export function boardTilesInArea(level: Level, state: GameState, area: string): BoardTileView[] {
  return boardTilesInView(level, state).filter((t) =>
    t.cells.some((c) => areaAt(level.board, c[0], c[1]) === area),
  );
}

export interface TunnelEndView {
  readonly tunnel: string;
  readonly design: number;
  readonly end: 'a' | 'b';
  readonly cell: Cell;
}

/** The ends of ice tunnels whose square the heroes have seen (the other end stays unknown). */
export function tunnelsInView(level: Level, state: GameState): TunnelEndView[] {
  const out: TunnelEndView[] = [];
  for (const t of level.quest.tunnels)
    for (const end of ['a', 'b'] as const)
      if (state.seenCells.has(`${t[end][0]},${t[end][1]}`))
        out.push({ tunnel: t.id, design: t.design, end, cell: t[end] });
  return out;
}

/** The ids of the heroes of the team that are still alive, in team order (decision 32). Mercenaries and allies are not heroes. */
export function livingHeroes(
  team: readonly TeamInput[],
  state: Pick<GameState, 'deadHeroes'>,
): string[] {
  return normalizeTeam(team)
    .filter((m) => m.kind === 'hero' && !state.deadHeroes.includes(m.id))
    .map((m) => m.id);
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
    if (!cell || !state.seenMonsters.has(m.id) || monsterStateOf(m, state).state !== 'dormant')
      continue;
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
  /** A disarm can still be tried (an armed trap, or a sprung one that allows it). */
  readonly canDisarm: boolean;
  /** An ice slide whose path is visible. */
  readonly path?: readonly Cell[];
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
    const k = trapKind(t.kind);
    const stays = st === 'armed' || (st === 'sprung' && (k.stays || k.leavesBlock === true));
    out.push({
      id: t.id,
      cell,
      ...(t.furniture !== undefined ? { furniture: t.furniture } : {}),
      state: st,
      ...(st !== 'armed' ? { kind: t.kind } : {}),
      onMap: stays,
      block: st === 'sprung' && k.leavesBlock === true,
      canDisarm: st === 'armed' || (st === 'sprung' && k.disarmAfterSpring === true),
      ...(t.path && state.slidesShown.includes(t.id) ? { path: t.path } : {}),
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
      // A trap that already sprang or was disarmed leaves nothing to look for.
      searched:
        state.trapSearched.includes(f.id) ||
        level.quest.traps.some(
          (t) => t.kind === 'chest' && t.furniture === f.id && state.trapStates[t.id] !== undefined,
        ),
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
  readonly searchedBy: readonly string[];
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

/**
 * Searches: treasure, secret doors, and the wandering monster a treasure card can bring.
 * No positions are tracked, so "monsters in the room" means seen, living monsters whose quest
 * start square is there. The players can override the guard when they know the room is clear.
 */
import { areaAt, cellsOf, inBoard, type AreaId, type Cell } from '../board/board';
import { keyOf, sightMap, type Level } from '../board/level';
import { lineOfSight } from '../board/los';
import { HEROES, type Hero } from '../data/heroes';
import { MONSTER_NAMES, statsOf } from '../data/monsters';
import type { MonsterType } from '../quest/schema';
import { joinRoster, wandererDef } from './roster';
import type { GameEvent } from './events';
import { EventError } from './errors';
import type { Prompt } from './prompts';
import { blockingSearchNotes, runTriggers, type TriggerEvent } from './notes';
import { springTrap } from './traps';
import { draftOf, type GameState } from './state';
import { isDormant, liveMonstersInRoom } from './monstersIn';

export { liveMonstersInRoom };

type Reduced = { readonly state: GameState; readonly prompts: readonly Prompt[] };

function checkHero(hero: string, state: GameState): Hero {
  if (!(HEROES as readonly string[]).includes(hero))
    throw new EventError('UNKNOWN_HERO', `Unknown hero ${hero}`);
  if (state.deadHeroes.includes(hero as Hero))
    throw new EventError('HERO_DEAD', `The ${hero} is dead and cannot act`);
  return hero as Hero;
}

/** A revealed room (not a corridor). */
function checkRoom(level: Level, state: GameState, room: string): AreaId {
  if (room === 'C') throw new EventError('NOT_A_ROOM', 'Corridors cannot be searched this way');
  if (cellsOf(level.board, room).length === 0)
    throw new EventError('BAD_AREA', `Unknown area ${room}`);
  if (!state.revealedRooms.has(room))
    throw new EventError('ROOM_NOT_REVEALED', `Room ${room} is not revealed yet`);
  return room;
}

/** Ids of the seen, living monsters in line of sight of a corridor square (they stop a search there). */
export function liveMonstersInSight(level: Level, state: GameState, from: Cell): string[] {
  const map = sightMap(level, state.openDoors, state.placedBlocks, state.sightBlockers);
  const quest = level.quest.monsters
    .filter(
      (m) =>
        m.cell !== undefined &&
        state.seenMonsters.has(m.id) &&
        !isDormant(m, state) &&
        state.monsters[m.id]?.dead === false &&
        lineOfSight(map, from, m.cell),
    )
    .map((m) => m.id);
  // A wanderer has no square: it is in sight when any seen square of its room is.
  const wanderers = Object.entries(state.wanderers)
    .filter(
      ([id, w]) =>
        state.monsters[id]?.dead === false &&
        cellsOf(level.board, w.room).some(
          (c) => state.seenCells.has(keyOf(c)) && lineOfSight(map, from, c),
        ),
    )
    .map(([id]) => id);
  return [...quest, ...wanderers];
}

// ---- treasure

export function searchTreasure(
  level: Level,
  state: GameState,
  event: Extract<GameEvent, { type: 'SEARCH_TREASURE' }>,
): Reduced {
  const hero = checkHero(event.hero, state);
  const room = checkRoom(level, state, event.room);
  const before = state.treasureSearched[room] ?? [];
  if (before.includes(hero) && event.override !== true)
    throw new EventError('ALREADY_SEARCHED', `${hero} already searched ${room}`);
  if (event.override !== true && liveMonstersInRoom(level, state, room).length > 0)
    throw new EventError('MONSTERS_IN_ROOM', `Monsters are in ${room}`);

  const d = draftOf(state);
  const prompts: Prompt[] = [];
  const triggers: TriggerEvent[] = [];

  // (0) A blocking note ("searching here is not possible"): only that note is shown. No chest
  // trap springs, no card is drawn, and the search is not recorded, so the hero keeps the action.
  const blockers = blockingSearchNotes(level, state, room, before.length === 0);
  if (blockers.length > 0) {
    const shown = runTriggers(
      level,
      d,
      [{ type: 'treasureSearch', area: room, first: before.length === 0 }],
      { beforeRooms: new Set(state.revealedRooms), only: (n) => blockers.includes(n) },
    );
    return { state: d, prompts: shown.prompts };
  }

  // (a) A chest or furniture trap that is still armed springs first, then the search goes on.
  // This order is an interpretation of the digest ("searching springs it first").
  for (const trap of level.quest.traps) {
    if (trap.kind !== 'chest' || d.trapStates[trap.id] !== undefined) continue;
    const furniture = level.quest.furniture.find((f) => f.id === trap.furniture);
    if (furniture?.cells.some((c) => areaAt(level.board, c[0], c[1]) === room)) {
      prompts.push(springTrap(level, d, trap, 'search'));
      triggers.push({ type: 'trapSprung', trap: trap.id });
    }
  }

  // (b) Notes for this room. `first` notes fire only for the first search of the room.
  triggers.push({ type: 'treasureSearch', area: room, first: before.length === 0 });
  const notes = runTriggers(level, d, triggers, { beforeRooms: new Set(state.revealedRooms) });
  prompts.push(...notes.prompts);

  d.treasureSearched[room] = [...before, hero];
  // (c) No note took the treasure: a card is drawn.
  if (!notes.consumed) prompts.push({ kind: 'drawCard' });
  return { state: d, prompts };
}

// ---- chest traps

export function searchTraps(
  level: Level,
  state: GameState,
  event: Extract<GameEvent, { type: 'SEARCH_TRAPS' }>,
): Reduced {
  const f = level.quest.furniture.find((x) => x.id === event.furniture);
  if (!f) throw new EventError('UNKNOWN_FURNITURE', `Unknown furniture ${event.furniture}`);
  if (f.type !== 'chest') throw new EventError('NOT_A_CHEST', `${f.id} is not a chest`);
  if (!state.seenFurniture.has(f.id))
    throw new EventError('FURNITURE_NOT_SEEN', `${f.id} is not seen yet`);
  const room = areaAt(level.board, f.cells[0]![0], f.cells[0]![1]);
  if (room === undefined || !state.revealedRooms.has(room))
    throw new EventError('ROOM_NOT_REVEALED', `The room of ${f.id} is not revealed`);
  if (state.trapSearched.includes(f.id))
    throw new EventError('ALREADY_SEARCHED', `${f.id} was already searched for traps`);
  if (event.override !== true && liveMonstersInRoom(level, state, room).length > 0)
    throw new EventError('MONSTERS_IN_ROOM', `Monsters are in ${room}`);

  const d = draftOf(state);
  d.trapSearched = [...d.trapSearched, f.id];
  const found = level.quest.traps.filter(
    (t) => t.kind === 'chest' && t.furniture === f.id && d.trapStates[t.id] === undefined,
  );
  for (const t of found) d.seenTraps.add(t.id);
  return {
    state: d,
    prompts:
      found.length > 0
        ? found.map((t) => ({ kind: 'trapFound', furniture: f.id, trap: t.id }))
        : [{ kind: 'noTrap', furniture: f.id }],
  };
}

// ---- wandering monster

/** A square a monster can stand on: on the board, not rock. Throws BAD_CELL otherwise. */
function floorCell(level: Level, cell: Cell): Cell {
  const [x, y] = cell;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inBoard(level.board, x, y))
    throw new EventError('BAD_CELL', `Cell ${x},${y} is outside the board`);
  if (areaAt(level.board, x, y) === undefined || level.rock.has(`${x},${y}`))
    throw new EventError('BAD_CELL', `Cell ${x},${y} is not a floor square`);
  return [x, y];
}

/** The players add a monster in play (decision 66): it gets the square they enter, nothing else. */
export function addMonster(
  level: Level,
  state: GameState,
  event: Extract<GameEvent, { type: 'ADD_MONSTER' }>,
): Reduced {
  const cell = floorCell(level, event.cell);
  const d = draftOf(state);
  const room = areaAt(level.board, cell[0], cell[1]) ?? 'C';
  joinRoster(level, d, { type: event.monsterType, room, fresh: false, cell, added: true });
  return { state: d, prompts: [] };
}

/** The name and attack dice of a wandering monster that is an enemy of the quest. */
function wandererFacts(
  level: Level,
  id: string,
  type: MonsterType,
  enemy: string | undefined,
): { name?: string; attackDice?: number } {
  if (!enemy) return {};
  const def = wandererDef(level, { type, enemy }, id);
  return { name: def.name ?? MONSTER_NAMES[type], attackDice: statsOf(def).att };
}

export function wanderingMonster(
  level: Level,
  state: GameState,
  event: Extract<GameEvent, { type: 'WANDERING_MONSTER' }>,
): Reduced {
  const hero = checkHero(event.hero, state);
  const room = checkRoom(level, state, event.room);
  const w = level.quest.wandering;
  if (!w) throw new EventError('NO_WANDERING', 'This quest has no wandering monster');
  if ('text' in w) return { state, prompts: [{ kind: 'wanderingText', text: w.text }] };

  const d = draftOf(state);
  const cell = event.cell ? floorCell(level, event.cell) : undefined;
  const id = joinRoster(level, d, {
    type: w.monster,
    ...(w.enemy ? { enemy: w.enemy } : {}),
    room,
    wanderAt: hero,
    fresh: true,
    ...(cell ? { cell } : {}),
  });
  return {
    state: d,
    prompts: [
      {
        kind: 'wanderingMonster',
        monster: id,
        monsterType: w.monster,
        ...wandererFacts(level, id, w.monster, w.enemy),
        hero,
        room,
        placement: {
          nextToHero: hero,
          attacksAtOnce: true,
        },
      },
    ],
  };
}

// ---- secret doors

export function searchSecretDoors(
  level: Level,
  state: GameState,
  event: Extract<GameEvent, { type: 'SEARCH_SECRET_DOORS' }>,
): Reduced {
  const { board, quest } = level;
  let areaForNote: AreaId = 'C';
  let doorIds: string[];
  let monsters: string[];

  if (event.area !== undefined && event.area !== 'C') {
    const room = checkRoom(level, state, event.area);
    areaForNote = room;
    monsters = liveMonstersInRoom(level, state, room);
    doorIds = quest.secretDoors
      .filter((s) => [s.a, s.b].some((c) => areaAt(board, c[0], c[1]) === room))
      .map((s) => s.id);
  } else {
    const cell = event.cell;
    if (!cell) throw new EventError('BAD_TARGET', 'Give a room (area) or a corridor square (cell)');
    const [x, y] = cell;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !inBoard(board, x, y))
      throw new EventError('BAD_CELL', `Cell ${x},${y} is outside the board`);
    if (areaAt(board, x, y) !== 'C' || !state.seenCells.has(keyOf(cell)))
      throw new EventError(
        'NOT_A_SEEN_CORRIDOR_CELL',
        `Cell ${x},${y} is not a seen corridor square`,
      );
    const map = sightMap(level, state.openDoors, state.placedBlocks, state.sightBlockers);
    monsters = liveMonstersInSight(level, state, cell);
    doorIds = quest.secretDoors
      .filter((s) =>
        [s.a, s.b].some((c) => areaAt(board, c[0], c[1]) === 'C' && lineOfSight(map, cell, c)),
      )
      .map((s) => s.id);
  }
  if (event.override !== true && monsters.length > 0)
    throw new EventError('MONSTERS_IN_ROOM', 'A monster is in sight');

  const d = draftOf(state);
  const prompts: Prompt[] = [];
  // A note that only shows text replaces the result ("nothing found" style). Other notes
  // (addSecretDoor, ...) run through the notes engine and the search goes on.
  const notes = runTriggers(level, d, [{ type: 'secretDoorSearch', area: areaForNote }], {
    beforeRooms: new Set(state.revealedRooms),
  });
  prompts.push(...notes.prompts);
  const replaced = notes.fired.some(
    (f) =>
      f.by === 'secretDoorSearch' &&
      f.note.effects.length > 0 &&
      f.note.effects.every((e) => e.type === 'showText'),
  );
  if (replaced) return { state: d, prompts };

  const found = doorIds.filter((id) => !d.seenDoors.has(id));
  for (const id of found) d.seenDoors.add(id);
  prompts.push(
    found.length > 0 ? { kind: 'secretDoorsFound', doors: found } : { kind: 'nothingFound' },
  );
  return { state: d, prompts };
}

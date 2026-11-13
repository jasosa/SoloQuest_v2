/**
 * Searches: treasure, secret doors, and the wandering monster a treasure card can bring.
 * No positions are tracked, so "monsters in the room" means seen, living monsters whose quest
 * start square is there. The players can override the guard when they know the room is clear.
 */
import { areaAt, cellsOf, inBoard, type AreaId, type Cell } from '../board/board';
import { keyOf, sightMap, type Level } from '../board/level';
import { lineOfSight } from '../board/los';
import { HEROES, type Hero } from '../data/heroes';
import { statsOf } from '../data/monsters';
import type { Note } from '../quest/schema';
import type { GameEvent } from './events';
import { EventError } from './errors';
import type { Prompt } from './prompts';
import { springTrap } from './traps';
import { draftOf, type Draft, type GameState } from './state';

type Reduced = { readonly state: GameState; readonly prompts: readonly Prompt[] };

function checkHero(hero: string): Hero {
  if (!(HEROES as readonly string[]).includes(hero))
    throw new EventError('UNKNOWN_HERO', `Unknown hero ${hero}`);
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

/**
 * Ids of seen, living monsters in `room`: quest monsters whose start square is there, and living
 * wanderers that came to this room (they have no square, so their room stands in for it).
 */
export function liveMonstersInRoom(level: Level, state: GameState, room: AreaId): string[] {
  const quest = level.quest.monsters
    .filter(
      (m) =>
        m.cell !== undefined &&
        areaAt(level.board, m.cell[0], m.cell[1]) === room &&
        state.seenMonsters.has(m.id) &&
        state.monsters[m.id]?.dead === false,
    )
    .map((m) => m.id);
  const wanderers = Object.entries(state.wanderers)
    .filter(([id, w]) => w.room === room && state.monsters[id]?.dead === false)
    .map(([id]) => id);
  return [...quest, ...wanderers];
}

function liveMonstersInSight(level: Level, state: GameState, from: Cell): string[] {
  const map = sightMap(level, state.openDoors, state.placedBlocks);
  const quest = level.quest.monsters
    .filter(
      (m) =>
        m.cell !== undefined &&
        state.seenMonsters.has(m.id) &&
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

// ---- notes

/**
 * TODO(M4 notes engine): `when` conditions (flag, counter, monster alive, monstersAliveIn) and
 * the effects other than showText and giveItem. For now only `firstTime` is understood; every
 * other condition is treated as true.
 */
function conditionsHold(note: Note, d: Draft): boolean {
  for (const c of note.when ?? [])
    if ('firstTime' in c && d.notesFired.includes(note.id)) return false;
  return true;
}

/** Text of the effects we understand in M3: showText and giveItem. */
function noteTexts(note: Note): string[] {
  const out: string[] = [];
  for (const e of note.effects)
    if (e.type === 'showText' || e.type === 'giveItem') out.push(e.text);
  return out;
}

function fireNote(d: Draft, note: Note): Prompt {
  if (!d.notesFired.includes(note.id)) d.notesFired = [...d.notesFired, note.id];
  return {
    kind: 'note',
    noteId: note.id,
    ...(note.letter !== undefined ? { letter: note.letter } : {}),
    texts: noteTexts(note),
    consumesTreasure: note.consumesTreasure === true,
  };
}

// ---- treasure

export function searchTreasure(
  level: Level,
  state: GameState,
  event: Extract<GameEvent, { type: 'SEARCH_TREASURE' }>,
): Reduced {
  const hero = checkHero(event.hero);
  const room = checkRoom(level, state, event.room);
  const before = state.treasureSearched[room] ?? [];
  if (before.includes(hero))
    throw new EventError('ALREADY_SEARCHED', `${hero} already searched ${room}`);
  if (event.override !== true && liveMonstersInRoom(level, state, room).length > 0)
    throw new EventError('MONSTERS_IN_ROOM', `Monsters are in ${room}`);

  const d = draftOf(state);
  const prompts: Prompt[] = [];

  // (a) A chest or furniture trap that is still armed springs first, then the search goes on.
  // This order is an interpretation of the digest ("searching springs it first").
  for (const trap of level.quest.traps) {
    if (trap.kind !== 'chest' || d.trapStates[trap.id] !== undefined) continue;
    const furniture = level.quest.furniture.find((f) => f.id === trap.furniture);
    if (furniture?.cells.some((c) => areaAt(level.board, c[0], c[1]) === room))
      prompts.push(springTrap(level, d, trap, 'search'));
  }

  // (b) Notes for this room. `first` notes fire only for the first search of the room.
  let consumed = false;
  for (const note of level.quest.notes) {
    const t = note.trigger;
    if (t.type !== 'treasureSearch' || t.area !== room) continue;
    if (t.first === true && before.length > 0) continue;
    if (!conditionsHold(note, d)) continue;
    prompts.push(fireNote(d, note));
    if (note.consumesTreasure === true) consumed = true;
  }

  d.treasureSearched[room] = [...before, hero];
  // (c) No note took the treasure: a card is drawn.
  if (!consumed) prompts.push({ kind: 'drawCard' });
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

export function wanderingMonster(
  level: Level,
  state: GameState,
  event: Extract<GameEvent, { type: 'WANDERING_MONSTER' }>,
): Reduced {
  const hero = checkHero(event.hero);
  const room = checkRoom(level, state, event.room);
  const w = level.quest.wandering;
  if (!w) throw new EventError('NO_WANDERING', 'This quest has no wandering monster');
  if ('text' in w) return { state, prompts: [{ kind: 'wanderingText', text: w.text }] };

  const d = draftOf(state);
  let n = d.wanderCount + 1;
  while (level.quest.monsters.some((m) => m.id === `w${n}`)) n++;
  const id = `w${n}`;
  d.wanderCount = n;
  d.wanderers[id] = { type: w.monster, room, wanderAt: hero, fresh: true };
  d.seenMonsters.add(id);
  d.monsters[id] = { body: statsOf({ type: w.monster }).body, dead: false };
  return {
    state: d,
    prompts: [
      {
        kind: 'wanderingMonster',
        monster: id,
        monsterType: w.monster,
        hero,
        room,
        placement: {
          nextToHero: hero,
          attacksAtOnce: true,
          ifNoFreeSquare: { closestInRoom: room, actsNextZargonTurn: true },
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
  checkHero(event.hero);
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
    const map = sightMap(level, state.openDoors, state.placedBlocks);
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
  // A note that only shows text replaces the result ("nothing found" style).
  // TODO(M4 notes engine): notes with other effects (addSecretDoor, ...) run through the engine.
  let replaced = false;
  for (const note of quest.notes) {
    const t = note.trigger;
    if (t.type !== 'secretDoorSearch' || t.area !== areaForNote) continue;
    if (!conditionsHold(note, d)) continue;
    prompts.push(fireNote(d, note));
    if (note.effects.length > 0 && note.effects.every((e) => e.type === 'showText'))
      replaced = true;
  }
  if (replaced) return { state: d, prompts };

  const found = doorIds.filter((id) => !d.seenDoors.has(id));
  for (const id of found) d.seenDoors.add(id);
  prompts.push(
    found.length > 0 ? { kind: 'secretDoorsFound', doors: found } : { kind: 'nothingFound' },
  );
  return { state: d, prompts };
}

/**
 * The reducer: the only way the game state changes.
 *
 *   reduce(level, state, event) -> { state, prompts }
 *
 * Pure: no clock, no Math.random. The input state is never modified. An invalid event throws an
 * EventError (before anything is changed), so a bad tap can never corrupt the state; the caller
 * decides whether to show the message. A stored event log only ever holds valid events.
 *
 * Undo is "drop the last event and replay" (see `undo`).
 */
import { inBoard, areaAt, type Cell } from '../board/board';
import { keyOf, type CellKey, type Level } from '../board/level';
import { EventError } from './errors';
import type { GameEvent } from './events';
import type { Prompt } from './prompts';
import { searchSecretDoors, searchTraps, searchTreasure, wanderingMonster } from './search';
import { trapEvent } from './traps';
import { statsOf } from '../data/monsters';
import { HEROES } from '../data/heroes';
import { lookHintCells } from './hints';
import type { MonsterDef } from '../quest/schema';
import { isDormant, monsterStateOf } from './monstersIn';
import {
  areaEnter,
  zoneEnter,
  choose,
  manualTrigger,
  monsterSeenTriggers,
  runTriggers,
  squareTrigger,
  tickStone,
} from './notes';
import { objectivesStatus } from './noteView';
import { progress, revealFrom, revealRoom, revealThroughDoor } from './reveal';
import { draftOf, emptyState, type Draft, type GameState, type MonsterRecord } from './state';

export { EventError, type EventErrorCode } from './errors';
export type { Prompt } from './prompts';

export interface Reduced {
  readonly state: GameState;
  readonly prompts: readonly Prompt[];
}

/**
 * The start of the quest: the start room is revealed, then the `questStart` notes and the
 * `areaRevealed` notes of the start room fire. The prompts are the ones to show at the start.
 */
export function startGame(level: Level, seed: number): Reduced {
  const d = draftOf(emptyState(seed));
  revealRoom(level, d, level.quest.start.area);
  const r = runTriggers(
    level,
    d,
    [{ type: 'questStart' }, ...monsterSeenTriggers(level, d, d.seenMonsters)],
    { beforeRooms: new Set() },
  );
  return { state: d, prompts: r.prompts };
}

/**
 * State at the start of the quest (see `startGame`). The UI must call `startGame` to also get
 * the questStart and start-room prompts; this only gives the state.
 */
export function initialState(level: Level, seed: number): GameState {
  return startGame(level, seed).state;
}

/** Apply one event. After END_QUEST every event is rejected with QUEST_ENDED. */
export function reduce(level: Level, state: GameState, event: GameEvent): Reduced {
  if (state.ended) throw new EventError('QUEST_ENDED', 'The quest is over');
  const r0 = reduceEvent(level, state, event);
  const r = afterSeen(level, state, r0);
  // Objectives that became done by this event are told to the players.
  const before = objectivesStatus(level, state);
  const after = objectivesStatus(level, r.state);
  const extra: Prompt[] = [];
  after.items.forEach((o, i) => {
    if (o.done && !before.items[i]?.done)
      extra.push({ kind: 'objectiveDone', objective: o.id, text: o.text });
  });
  if (after.goalDone && !before.goalDone) extra.push({ kind: 'goalDone' });
  return extra.length > 0 ? { state: r.state, prompts: [...r.prompts, ...extra] } : r;
}

/** Monsters that came into view by this event fire their `monsterSeen` notes (decision 67). */
function afterSeen(level: Level, before: GameState, r: Reduced): Reduced {
  if (!level.quest.notes.some((n) => n.trigger.type === 'monsterSeen')) return r;
  const fresh = [...r.state.seenMonsters].filter((id) => !before.seenMonsters.has(id));
  if (fresh.length === 0) return r;
  const d = draftOf(r.state);
  const triggers = monsterSeenTriggers(level, r.state, fresh);
  const n = runTriggers(level, d, triggers, { beforeRooms: new Set(d.revealedRooms) });
  return { state: d, prompts: withNotes(r.prompts, n.prompts) };
}

/** Add the prompts of notes after the prompts of the event. "Nothing new" gives way to them. */
function withNotes(base: readonly Prompt[], notes: readonly Prompt[]): Prompt[] {
  if (notes.length === 0) return [...base];
  return [...base.filter((p) => p.kind !== 'nothingNew'), ...notes];
}

function reduceEvent(level: Level, state: GameState, event: GameEvent): Reduced {
  switch (event.type) {
    case 'OPEN_DOOR':
      return openDoor(level, state, event.door);
    case 'LOOK_FROM':
      return lookFrom(level, state, event.cell);
    case 'MONSTER_DAMAGE':
      return monsterChange(level, state, event.monster, (r) => {
        const body = Math.max(0, r.body - checkAmount(event.amount));
        return { body, dead: body === 0 };
      });
    case 'MONSTER_HEAL':
      return monsterChange(level, state, event.monster, (r, max) => ({
        body: Math.min(max, r.body + checkAmount(event.amount)),
        dead: false,
      }));
    case 'MONSTER_KILL':
      return monsterChange(level, state, event.monster, () => ({ body: 0, dead: true }));
    case 'ZARGON_TURN_END': {
      const d = draftOf(state);
      const ended = d.turn;
      d.turn += 1;
      d.castThisTurn = [];
      d.spellsFailed = {};
      d.doneThisTurn = [];
      // A wandering monster that attacked at once is no longer "fresh" after Zargon's turn.
      for (const [id, w] of Object.entries(d.wanderers))
        if (w.fresh) d.wanderers[id] = { ...w, fresh: false };
      // Stone counts down first, so a stone set by this turn's note keeps all its turns.
      const stone = tickStone(level, d);
      const r = runTriggers(level, d, [{ type: 'zargonTurn', turn: ended }], {
        beforeRooms: new Set(state.revealedRooms),
      });
      return { state: d, prompts: [...stone, ...r.prompts] };
    }
    case 'SEARCH_TREASURE':
      return searchTreasure(level, state, event);
    case 'WANDERING_MONSTER':
      return wanderingMonster(level, state, event);
    case 'SEARCH_SECRET_DOORS':
      return searchSecretDoors(level, state, event);
    case 'SEARCH_TRAPS':
      return searchTraps(level, state, event);
    case 'TRAP_JUMP':
    case 'TRAP_DISARM':
    case 'TRAP_STEP':
      return trapEvent(level, state, event);
    case 'AREA_ENTER': {
      const d = draftOf(state);
      return { state: d, prompts: areaEnter(level, state, d, event.area).prompts };
    }
    case 'ZONE_ENTER': {
      const d = draftOf(state);
      return { state: d, prompts: zoneEnter(level, state, d, event.zone).prompts };
    }
    case 'SQUARE_TRIGGER': {
      checkCell(level, event.cell);
      const d = draftOf(state);
      return { state: d, prompts: squareTrigger(level, state, d, event.cell).prompts };
    }
    case 'CONFIRM_OBJECTIVE': {
      const o = level.quest.objectives.find((x) => x.id === event.objective);
      if (!o?.confirm)
        throw new EventError('NOT_A_TRIGGER', `Objective ${event.objective} has no confirm button`);
      if (state.objectivesDone.includes(o.id))
        throw new EventError('NOT_A_TRIGGER', `Objective ${o.id} is already done`);
      const d = draftOf(state);
      d.objectivesDone = [...state.objectivesDone, o.id];
      return { state: d, prompts: [] };
    }
    case 'MANUAL_TRIGGER': {
      const d = draftOf(state);
      return { state: d, prompts: manualTrigger(level, state, d, event.note).prompts };
    }
    case 'CHOOSE': {
      const d = draftOf(state);
      return { state: d, prompts: choose(level, state, d, event.note, event.option).prompts };
    }
    case 'HERO_DIED': {
      if (!(HEROES as readonly string[]).includes(event.hero))
        throw new EventError('UNKNOWN_HERO', `Unknown hero ${String(event.hero)}`);
      if (state.deadHeroes.includes(event.hero))
        throw new EventError('ALREADY_DEAD', `The ${event.hero} is already dead`);
      const d = draftOf(state);
      d.deadHeroes = [...state.deadHeroes, event.hero];
      return { state: d, prompts: [{ kind: 'heroDied', hero: event.hero }] };
    }
    case 'SPELL_CAST':
      return spellCast(level, state, event.monster, event.spell);
    case 'SPELL_FAILED':
      return spellFailed(level, state, event.monster, event.spell);
    case 'MONSTER_DONE':
      return monsterDone(level, state, event.monster);
    case 'END_QUEST': {
      const goalDone = objectivesStatus(level, state).goalDone;
      const d = draftOf(state);
      if (event.outcome === 'ending') {
        const id = event.ending;
        if (!(level.quest.endings ?? []).some((e) => e.id === id))
          throw new EventError('UNKNOWN_ENDING', `Unknown ending ${String(id)}`);
        d.ended = { outcome: 'ending', ending: id };
        return {
          state: d,
          prompts: [{ kind: 'questEnded', outcome: 'ending', ending: id, goalDone }],
        };
      }
      if (event.outcome !== 'stairs' && event.outcome !== 'fell')
        throw new EventError('BAD_RESULT', `Bad outcome ${String(event.outcome)}`);
      d.ended = { outcome: event.outcome };
      return { state: d, prompts: [{ kind: 'questEnded', outcome: event.outcome, goalDone }] };
    }
    default: {
      const never: never = event;
      throw new Error(`Unhandled event ${JSON.stringify(never)}`);
    }
  }
}

/** Rebuild the state from the start. Throws if an event is invalid. */
export function replay(level: Level, seed: number, events: readonly GameEvent[]): GameState {
  let state = initialState(level, seed);
  for (const e of events) state = reduce(level, state, e).state;
  return state;
}

/** Drop the last event and replay. With no events, nothing changes. */
export function undo(
  level: Level,
  seed: number,
  events: readonly GameEvent[],
): { events: readonly GameEvent[]; state: GameState } {
  const rest = events.slice(0, -1);
  return { events: rest, state: replay(level, seed, rest) };
}

function finish(
  d: Draft,
  before: number,
  cells: CellKey[],
  origin: [number, number],
  quiet: boolean,
): Reduced {
  if (progress(d) !== before || cells.length > 0)
    return { state: d, prompts: [{ kind: 'revealed', cells, origin }] };
  return { state: d, prompts: quiet ? [] : [{ kind: 'nothingNew' }] };
}

function openDoor(level: Level, state: GameState, doorId: string): Reduced {
  const door = level.doors.get(doorId);
  if (!door) throw new EventError('UNKNOWN_DOOR', `Unknown door ${doorId}`);
  if (!state.seenDoors.has(doorId))
    throw new EventError('DOOR_NOT_SEEN', `Door ${doorId} has not been seen yet`);
  // A false door can be tried but never opens (decision 29): nothing changes, the players are told.
  if (door.kind === 'false') return { state, prompts: [{ kind: 'doorStuck', door: doorId }] };
  if (state.openDoors.has(doorId))
    throw new EventError('ALREADY_OPEN', `Door ${doorId} is already open`);

  const d = draftOf(state);
  const origin: [number, number] = [
    (door.a[0] + door.b[0] + 1) / 2,
    (door.a[1] + door.b[1] + 1) / 2,
  ];
  const before = progress(d);
  d.openDoors.add(doorId);
  const notes = () =>
    runTriggers(level, d, [{ type: 'doorOpened', door: doorId }], {
      beforeRooms: new Set(state.revealedRooms),
    }).prompts;
  const cells = revealThroughDoor(level, d, door);
  const shown = finish(d, before, cells, origin, true);
  return { state: d, prompts: withNotes(shown.prompts, notes()) };
}

function lookFrom(level: Level, state: GameState, cell: Cell): Reduced {
  const [x, y] = cell;
  checkCell(level, cell);
  if (areaAt(level.board, x, y) !== 'C' || !state.seenCells.has(keyOf(cell)))
    throw new EventError(
      'NOT_A_SEEN_CORRIDOR_CELL',
      `Cell ${x},${y} is not a seen corridor square`,
    );

  // Only the squares with the eye symbol (decision 13) can be looked from.
  if (!lookHintCells(level, state).some((c) => c[0] === x && c[1] === y))
    throw new EventError('NOT_A_LOOK_SQUARE', `Nothing new can be seen from ${x},${y}`);

  const d = draftOf(state);
  const before = progress(d);
  d.looked.add(keyOf(cell));
  const { cells } = revealFrom(level, d, cell);
  const shown = finish(d, before, cells, [x + 0.5, y + 0.5], false);
  // Rooms that the look revealed fire their `areaRevealed` notes.
  const notes = runTriggers(level, d, [], { beforeRooms: new Set(state.revealedRooms) }).prompts;
  return { state: d, prompts: withNotes(shown.prompts, notes) };
}

function checkCell(level: Level, cell: Cell): void {
  const [x, y] = cell;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inBoard(level.board, x, y))
    throw new EventError('BAD_CELL', `Cell ${x},${y} is outside the board`);
}

function checkAmount(n: number): number {
  if (!Number.isInteger(n) || n < 1)
    throw new EventError('BAD_AMOUNT', `Amount must be a whole number of 1 or more, got ${n}`);
  return n;
}

/**
 * Change the Body Points record of a seen, living monster. A monster that dies fires the
 * `monsterKilled` and `allKilled` notes. A dormant monster is refused with MONSTER_NOT_SEEN.
 */
function monsterChange(
  level: Level,
  state: GameState,
  id: string,
  change: (r: MonsterRecord, maxBody: number) => MonsterRecord,
): Reduced {
  const w = state.wanderers[id];
  const def = w ? { type: w.type } : level.quest.monsters.find((m) => m.id === id);
  if (!def) throw new EventError('UNKNOWN_MONSTER', `Unknown monster ${id}`);
  const rec = state.monsters[id];
  if (!state.seenMonsters.has(id) || !rec)
    throw new EventError('MONSTER_NOT_SEEN', `Monster ${id} has not been seen yet`);
  if (rec.dead) throw new EventError('MONSTER_DEAD', `Monster ${id} is already dead`);
  // A dormant monster is a statue: it cannot be wounded, healed or slain (decision 28).
  if ('id' in def && isDormant(def, state))
    throw new EventError('MONSTER_NOT_SEEN', `Monster ${id} is a statue until the quest wakes it`);
  const d = draftOf(state);
  const next = change(rec, statsOf(def).body);
  d.monsters[id] = next;
  if (!next.dead) return { state: d, prompts: [] };
  const r = runTriggers(level, d, [{ type: 'monsterKilled', monster: id, monsterType: def.type }], {
    beforeRooms: new Set(state.revealedRooms),
  });
  return { state: d, prompts: r.prompts };
}

/** A seen, living, active quest monster, or an error. Wanderers are returned without a def. */
function actingMonster(level: Level, state: GameState, id: string): MonsterDef | undefined {
  const w = state.wanderers[id];
  const def = level.quest.monsters.find((m) => m.id === id);
  if (!w && !def) throw new EventError('UNKNOWN_MONSTER', `Unknown monster ${id}`);
  const rec = state.monsters[id];
  if (!state.seenMonsters.has(id) || !rec)
    throw new EventError('MONSTER_NOT_SEEN', `Monster ${id} has not been seen yet`);
  if (rec.dead) throw new EventError('MONSTER_DEAD', `Monster ${id} is dead`);
  if (def && isDormant(def, state))
    throw new EventError('MONSTER_NOT_SEEN', `Monster ${id} is a statue until the quest wakes it`);
  if (def && monsterStateOf(def, state).state === 'stone')
    throw new EventError('MONSTER_INACTIVE', `Monster ${id} is stone and does nothing`);
  return def;
}

/**
 * A caster casts one of the Dread spells of its quest data. A spell listed twice may be cast
 * twice. A second cast in the same Zargon turn is refused for every caster (SPELL_LIMIT), and a
 * monster already marked done cannot cast (ALREADY_DONE). Fires the `spellCast` notes.
 */
function spellCast(level: Level, state: GameState, id: string, spell: string): Reduced {
  const def = actingMonster(level, state, id);
  if (!def)
    throw new EventError('UNKNOWN_SPELL', `Monster ${id} is a wandering monster and has no spells`);
  if (!def.spells?.includes(spell))
    throw new EventError('UNKNOWN_SPELL', `Monster ${id} has no spell ${spell}`);
  if (state.doneThisTurn.includes(id))
    throw new EventError('ALREADY_DONE', `Monster ${id} is already done this turn`);
  const used = state.spellsCast[id] ?? [];
  const listed = def.spells.filter((s) => s === spell).length;
  if (used.filter((s) => s === spell).length >= listed)
    throw new EventError('SPELL_USED', `Monster ${id} already cast ${spell}`);
  // A monster attacks or casts one spell per turn, so this holds for every caster.
  // `spellLimit: onePerTurn` is the explicit form of the same rule.
  if (state.castThisTurn.includes(id))
    throw new EventError('SPELL_LIMIT', `Monster ${id} already cast a spell this turn`);
  if ((state.spellsFailed[id] ?? []).includes(spell))
    throw new EventError('SPELL_DECLINED', `${spell} was declined for ${id} this turn`);
  const d = draftOf(state);
  d.spellsCast = { ...state.spellsCast, [id]: [...used, spell] };
  d.castThisTurn = [...state.castThisTurn, id];
  const r = runTriggers(level, d, [{ type: 'spellCast', monster: id, spell }], {
    beforeRooms: new Set(state.revealedRooms),
  });
  return { state: d, prompts: r.prompts };
}

/** The order of a monster was carried out this turn. A second MONSTER_DONE is refused. */
function monsterDone(level: Level, state: GameState, id: string): Reduced {
  actingMonster(level, state, id);
  if (state.wanderers[id]?.fresh)
    throw new EventError('MONSTER_INACTIVE', `Monster ${id} already attacked and acts next turn`);
  if (state.doneThisTurn.includes(id))
    throw new EventError('ALREADY_DONE', `Monster ${id} is already done this turn`);
  const d = draftOf(state);
  d.doneThisTurn = [...state.doneThisTurn, id];
  return { state: d, prompts: [] };
}

/** The players said the offered spell could not be cast: the order offers the next one. */
function spellFailed(level: Level, state: GameState, id: string, spell: string): Reduced {
  const def = actingMonster(level, state, id);
  if (!def)
    throw new EventError('UNKNOWN_SPELL', `Monster ${id} is a wandering monster and has no spells`);
  if (!def.spells?.includes(spell))
    throw new EventError('UNKNOWN_SPELL', `Monster ${id} has no spell ${spell}`);
  if (state.doneThisTurn.includes(id))
    throw new EventError('ALREADY_DONE', `Monster ${id} is already done this turn`);
  if (state.castThisTurn.includes(id))
    throw new EventError('SPELL_LIMIT', `Monster ${id} already cast a spell this turn`);
  const used = (state.spellsCast[id] ?? []).filter((s) => s === spell).length;
  if (used >= def.spells.filter((s) => s === spell).length)
    throw new EventError('SPELL_USED', `Monster ${id} already cast ${spell}`);
  const failed = state.spellsFailed[id] ?? [];
  if (failed.includes(spell))
    throw new EventError('SPELL_DECLINED', `${spell} was declined for ${id} this turn`);
  const d = draftOf(state);
  d.spellsFailed = { ...state.spellsFailed, [id]: [...failed, spell] };
  return { state: d, prompts: [] };
}

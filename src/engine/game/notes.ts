/**
 * The notes engine. A quest note is trigger + conditions + effects (docs/QUEST_FORMAT.md).
 *
 * The reducer (and search.ts, traps.ts) call `runTriggers` with the triggers an event caused.
 * Rooms that became revealed during the event fire `areaRevealed` by themselves. Effects can
 * cause more triggers (a revealed room, an opened door): they go to a queue, with a cap on depth
 * and on total steps, so a broken quest cannot loop forever.
 *
 * Works on a Draft owned by the caller. Nothing here knows about positions of heroes or monsters.
 *
 * Interpretations (see the task report): a note fires once unless its trigger repeats by nature
 * (see `repeats`); conditions are checked when the trigger happens, and a note whose conditions
 * fail stays available.
 */
import type { AreaId, Cell } from '../board/board';
import { cellKey, keyOf, type CellKey, type Level } from '../board/level';
import { MONSTER_NAMES } from '../data/monsters';
import type { Condition, Effect, MonsterType, Note } from '../quest/schema';
import { textsOf } from '../quest/effects';
import { EventError } from './errors';
import { liveMonstersInRoom } from './monstersIn';
import { lookHintCells } from './hints';
import type { Prompt } from './prompts';
import { doorMayShow, revealEverything, revealRoom, revealThroughDoor } from './reveal';
import { seeMonster, type Draft, type GameState } from './state';

/** What happened, as the notes engine sees it. */
export type TriggerEvent =
  | { readonly type: 'questStart' }
  | {
      readonly type: 'questEnds';
      readonly outcome: 'stairs' | 'fell' | 'ending';
      readonly ending?: string;
    }
  | { readonly type: 'areaRevealed'; readonly area: AreaId }
  | { readonly type: 'doorOpened'; readonly door: string }
  | { readonly type: 'areaEntered'; readonly area: AreaId }
  | { readonly type: 'zoneEntered'; readonly zone: string }
  | { readonly type: 'squareEntered'; readonly cell: CellKey }
  | { readonly type: 'treasureSearch'; readonly area: AreaId; readonly first: boolean }
  | { readonly type: 'secretDoorSearch'; readonly area: AreaId }
  | { readonly type: 'trapSprung'; readonly trap: string }
  | { readonly type: 'trapDisarmed'; readonly trap: string }
  | { readonly type: 'monsterKilled'; readonly monster: string; readonly monsterType: MonsterType }
  | { readonly type: 'spellCast'; readonly monster: string; readonly spell: string }
  | { readonly type: 'monsterSeen'; readonly monster: string; readonly monsterType: MonsterType }
  /** `turn` is the Zargon turn that just ended. */
  | { readonly type: 'zargonTurn'; readonly turn: number }
  | { readonly type: 'manual'; readonly note: string };

export interface FiredNote {
  readonly note: Note;
  /** The type of the trigger that fired it. */
  readonly by: TriggerEvent['type'];
}

export interface NotesResult {
  prompts: Prompt[];
  /** A treasure search note with `consumesTreasure` fired: no treasure card is drawn. */
  consumed: boolean;
  fired: FiredNote[];
}

export interface RunOptions {
  /** Rooms that were revealed before the event. Rooms revealed since fire `areaRevealed`.
   *  Default: the rooms revealed now (nothing new). */
  readonly beforeRooms?: ReadonlySet<AreaId>;
  /** Only notes that pass this filter may fire (used for a blocked search). */
  readonly only?: (note: Note) => boolean;
  readonly maxDepth?: number;
  readonly maxSteps?: number;
}

const MAX_DEPTH = 25;
const MAX_STEPS = 500;

type Item =
  | { readonly kind: 'trigger'; readonly t: TriggerEvent; readonly depth: number }
  | {
      readonly kind: 'effects';
      readonly note: Note;
      readonly effects: readonly Effect[];
      readonly depth: number;
    };

// ---- matching

/** Notes that fire on every matching trigger, not only the first time. */
export function repeats(note: Note): boolean {
  const t = note.trigger;
  switch (t.type) {
    case 'treasureSearch':
    case 'secretDoorSearch':
      return true;
    case 'squareEntered':
    case 'zoneEntered':
    case 'manual':
      return t.repeat === true;
    case 'monsterKilled':
      return t.monster === undefined;
    case 'spellCast':
      return t.monster === undefined || t.spell === undefined;
    case 'zargonTurn':
      return t.n === undefined;
    default:
      return false;
  }
}

/** Can this note still fire (it never fired, or it repeats)? Conditions are not looked at. */
export function isAvailable(note: Note, state: Pick<GameState, 'notesFired'>): boolean {
  return repeats(note) || !state.notesFired.includes(note.id);
}

function matches(note: Note, t: TriggerEvent, d: GameState): boolean {
  const n = note.trigger;
  if (t.type === 'monsterKilled' && n.type === 'allKilled')
    return (
      n.monsters.includes(t.monster) && n.monsters.every((id) => d.monsters[id]?.dead === true)
    );
  if (n.type !== t.type) return false;
  switch (n.type) {
    case 'questStart':
      return true;
    case 'areaRevealed':
    case 'areaEntered':
    case 'secretDoorSearch':
      return n.area === (t as { area: AreaId }).area;
    case 'treasureSearch': {
      const tt = t as Extract<TriggerEvent, { type: 'treasureSearch' }>;
      return n.area === tt.area && (n.first !== true || tt.first);
    }
    case 'zoneEntered':
      return n.zone === (t as { zone: string }).zone;
    case 'doorOpened':
      return n.door === (t as { door: string }).door;
    case 'squareEntered':
      return keyOf(n.cell) === (t as { cell: CellKey }).cell;
    case 'trapSprung':
    case 'trapDisarmed':
      return n.trap === (t as { trap: string }).trap;
    case 'monsterSeen': {
      const tt = t as Extract<TriggerEvent, { type: 'monsterSeen' }>;
      return (
        (n.monster === undefined || n.monster === tt.monster) &&
        (n.monsterType === undefined || n.monsterType === tt.monsterType)
      );
    }
    case 'monsterKilled': {
      const tt = t as Extract<TriggerEvent, { type: 'monsterKilled' }>;
      return (
        (n.monster === undefined || n.monster === tt.monster) &&
        (n.monsterType === undefined || n.monsterType === tt.monsterType)
      );
    }
    case 'spellCast': {
      const tt = t as Extract<TriggerEvent, { type: 'spellCast' }>;
      return (
        (n.monster === undefined || n.monster === tt.monster) &&
        (n.spell === undefined || n.spell === tt.spell)
      );
    }
    case 'questEnds': {
      const tt = t as Extract<TriggerEvent, { type: 'questEnds' }>;
      return (
        (n.outcome === undefined || n.outcome === tt.outcome) &&
        (n.ending === undefined || n.ending === tt.ending)
      );
    }
    case 'zargonTurn': {
      const turn = (t as { turn: number }).turn;
      if (n.n !== undefined) return turn === n.n;
      if (n.every !== undefined) return turn % n.every === 0;
      return true;
    }
    case 'manual':
      return (t as { note: string }).note === note.id;
  }
}

/** All conditions of the note hold in this state. `firstTime`: the note never fired. */
export function conditionsHold(level: Level, d: GameState, note: Note): boolean {
  return (note.when ?? []).every((c) => conditionHolds(level, d, c, note));
}

function conditionHolds(level: Level, d: GameState, c: Condition, note: Note): boolean {
  if ('flag' in c) return (d.flags[c.flag] ?? false) === c.is;
  if ('counter' in c) return (d.counters[c.counter] ?? 0) >= c.gte;
  if ('monster' in c) return (d.monsters[c.monster]?.dead !== true) === c.alive;
  if ('monstersAliveIn' in c)
    return liveMonstersInRoom(level, d, c.monstersAliveIn).length === c.is;
  if ('areaRevealed' in c) return d.revealedRooms.has(c.areaRevealed);
  if ('doorOpened' in c) return d.openDoors.has(c.doorOpened);
  if ('monsterSeen' in c) return d.seenMonsters.has(c.monsterSeen);
  if ('lookDone' in c) {
    const k = keyOf(c.lookDone);
    if (!d.seenCells.has(k)) return false;
    return (
      d.looked.has(k) ||
      !lookHintCells(level, d).some((h) => h[0] === c.lookDone[0] && h[1] === c.lookDone[1])
    );
  }
  return !d.notesFired.includes(note.id); // firstTime
}

/** Conditions of an objective: all hold now. `firstTime` has no meaning here and never holds. */
export function objectiveConditionsHold(
  level: Level,
  d: GameState,
  when: readonly Condition[],
): boolean {
  const none = { id: '', trigger: { type: 'questStart' }, effects: [] } as Note;
  return when.every((c) => !('firstTime' in c) && conditionHolds(level, d, c, none));
}

/**
 * Notes with `blocksSearch` that apply to a treasure search of `area` right now (trigger matches,
 * conditions hold). The caller shows only these and stops the search.
 */
export function blockingSearchNotes(
  level: Level,
  d: GameState,
  area: AreaId,
  first: boolean,
): Note[] {
  const t: TriggerEvent = { type: 'treasureSearch', area, first };
  return level.quest.notes.filter(
    (n) =>
      n.blocksSearch === true &&
      matches(n, t, d) &&
      isAvailable(n, d) &&
      conditionsHold(level, d, n),
  );
}

// ---- the queue

export function fireTrigger(
  level: Level,
  d: Draft,
  trigger: TriggerEvent,
  opts: RunOptions = {},
): NotesResult {
  return runTriggers(level, d, [trigger], opts);
}

/** Fire the given triggers (in order), then everything they cause. */
export function runTriggers(
  level: Level,
  d: Draft,
  triggers: readonly TriggerEvent[],
  opts: RunOptions = {},
): NotesResult {
  return run(
    level,
    d,
    triggers.map((t) => ({ kind: 'trigger', t, depth: 0 })),
    opts,
  );
}

/** `monsterSeen` triggers for monsters that just came into view (quest monsters and wanderers). */
export function monsterSeenTriggers(
  level: Level,
  state: GameState,
  ids: Iterable<string>,
): TriggerEvent[] {
  const out: TriggerEvent[] = [];
  for (const id of ids) {
    const type = level.quest.monsters.find((m) => m.id === id)?.type ?? state.wanderers[id]?.type;
    if (type) out.push({ type: 'monsterSeen', monster: id, monsterType: type });
  }
  return out;
}

/** Run the effects of a chosen option as if the note ran them (CHOOSE). */
export function runChosenEffects(
  level: Level,
  d: Draft,
  note: Note,
  effects: readonly Effect[],
  opts: RunOptions = {},
): NotesResult {
  return run(level, d, [{ kind: 'effects', note, effects, depth: 0 }], opts);
}

function run(level: Level, d: Draft, initial: Item[], opts: RunOptions): NotesResult {
  const maxDepth = opts.maxDepth ?? MAX_DEPTH;
  const maxSteps = opts.maxSteps ?? MAX_STEPS;
  const known = new Set(opts.beforeRooms ?? d.revealedRooms);
  const queue: Item[] = [...initial];
  const result: NotesResult = { prompts: [], consumed: false, fired: [] };
  const ctx: Ctx = { level, d, prompts: result.prompts, queue, depth: 0 };

  const enqueueNewRooms = (depth: number) => {
    for (const area of d.revealedRooms)
      if (!known.has(area)) {
        known.add(area);
        queue.push({ kind: 'trigger', t: { type: 'areaRevealed', area }, depth });
      }
  };
  enqueueNewRooms(0);

  let steps = 0;
  while (queue.length > 0) {
    const item = queue.shift()!;
    if (++steps > maxSteps || item.depth > maxDepth) {
      result.prompts.push({ kind: 'loopStopped' });
      break;
    }
    ctx.depth = item.depth;
    if (item.kind === 'effects') {
      runNoteEffects(ctx, item.note, item.effects, true, false);
    } else {
      for (const note of level.quest.notes) {
        if (opts.only && !opts.only(note)) continue;
        if (!matches(note, item.t, d)) continue;
        if (!isAvailable(note, d)) continue;
        if (!conditionsHold(level, d, note)) continue;
        if (!d.notesFired.includes(note.id)) d.notesFired = [...d.notesFired, note.id];
        result.fired.push({ note, by: item.t.type });
        const takes = item.t.type === 'treasureSearch' && note.consumesTreasure === true;
        if (takes) result.consumed = true;
        runNoteEffects(ctx, note, note.effects, false, takes);
      }
    }
    enqueueNewRooms(item.depth + 1);
  }
  return result;
}

// ---- effects

interface Ctx {
  readonly level: Level;
  readonly d: Draft;
  readonly prompts: Prompt[];
  readonly queue: Item[];
  depth: number;
}

function runNoteEffects(
  ctx: Ctx,
  note: Note,
  effects: readonly Effect[],
  fromChoice: boolean,
  takesTreasure: boolean,
): void {
  const { texts, title } = textsOf(effects);
  if (
    texts.length > 0 ||
    (!fromChoice && (note.letter !== undefined || takesTreasure || note.blocksSearch === true))
  ) {
    ctx.prompts.push({
      kind: 'note',
      noteId: note.id,
      ...(note.letter !== undefined ? { letter: note.letter } : {}),
      ...(note.at !== undefined ? { at: note.at } : {}),
      ...(title !== undefined ? { title } : {}),
      texts,
      consumesTreasure: takesTreasure || (!fromChoice && note.consumesTreasure === true),
      ...(!fromChoice && note.blocksSearch === true ? { blocksSearch: true as const } : {}),
    });
  }
  for (const e of effects) runEffect(ctx, note, e);
}

function centerOf(cells: readonly CellKey[]): [number, number] {
  if (cells.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    sx += x + 0.5;
    sy += y + 0.5;
  }
  return [sx / cells.length, sy / cells.length];
}

function revealedPrompt(cells: CellKey[], origin?: [number, number]): Prompt {
  return { kind: 'revealed', cells, origin: origin ?? centerOf(cells) };
}

function runEffect(ctx: Ctx, note: Note, e: Effect): void {
  const { level, d, prompts } = ctx;
  switch (e.type) {
    case 'showText':
    case 'giveItem':
      return; // told in the note prompt
    case 'revealArea': {
      if (e.area === 'C' || d.revealedRooms.has(e.area)) return;
      const { cells } = revealRoom(level, d, e.area);
      if (cells.length > 0) prompts.push(revealedPrompt(cells));
      return;
    }
    case 'revealAll': {
      const { cells } = revealEverything(level, d);
      if (cells.length > 0)
        prompts.push(revealedPrompt(cells, [level.board.width / 2, level.board.height / 2]));
      return;
    }
    case 'openAllDoors': {
      const opened: string[] = [];
      const cells: CellKey[] = [];
      for (const door of level.doors.values()) {
        if (door.kind !== 'normal' || d.openDoors.has(door.id)) continue;
        // a door that was removed, or still waits for its flag, is not on the map
        if (!doorMayShow(door, d)) continue;
        d.openDoors.add(door.id);
        d.seenDoors.add(door.id);
        opened.push(door.id);
        cells.push(...revealThroughDoor(level, d, door));
        ctx.queue.push({
          kind: 'trigger',
          t: { type: 'doorOpened', door: door.id },
          depth: ctx.depth + 1,
        });
      }
      if (opened.length > 0) prompts.push({ kind: 'doorsOpened', doors: opened });
      if (cells.length > 0) prompts.push(revealedPrompt(cells));
      return;
    }
    case 'placeMonster': {
      const def = level.quest.monsters.find((m) => m.id === e.monster);
      if (!def) return;
      // A monster already seen can be placed again (for example an escape to a new square).
      seeMonster(d, def);
      const cell = e.cell ?? def.cell;
      if (cell) d.placedMonsterCells[def.id] = [cell[0], cell[1]];
      prompts.push({
        kind: 'monsterPlaced',
        monster: def.id,
        monsterType: def.type,
        name: def.name ?? MONSTER_NAMES[def.type],
        ...(cell ? { cell } : {}),
      });
      return;
    }
    case 'setMonsterState': {
      const def = level.quest.monsters.find((m) => m.id === e.monster);
      if (!def) return;
      const turns = e.state === 'stone' ? e.turns : undefined;
      d.monsterStates[def.id] =
        turns !== undefined ? { state: e.state, turns } : { state: e.state };
      if (d.seenMonsters.has(def.id))
        prompts.push({
          kind: 'monsterState',
          monster: def.id,
          name: def.name ?? MONSTER_NAMES[def.type],
          state: e.state,
          ...(turns !== undefined ? { turns } : {}),
        });
      return;
    }
    case 'addSecretDoor': {
      const door = level.doors.get(e.door);
      if (!door || door.kind !== 'secret' || d.seenDoors.has(door.id)) return;
      d.seenDoors.add(door.id);
      prompts.push({ kind: 'secretDoorAdded', door: door.id });
      return;
    }
    case 'placeBlock': {
      for (const c of e.cells) d.placedBlocks.add(cellKey(c[0], c[1]));
      prompts.push({ kind: 'blockPlaced', cells: e.cells });
      return;
    }
    case 'setFlag':
      d.flags[e.flag] = e.value;
      // A door that waited for this flag shows now, if the heroes can see one of its squares.
      for (const door of level.doors.values())
        if (
          door.hiddenUntil === e.flag &&
          e.value &&
          doorMayShow(door, d) &&
          [door.a, door.b].some((c) => d.seenCells.has(keyOf(c)))
        )
          d.seenDoors.add(door.id);
      return;
    case 'removeDoor': {
      const door = level.doors.get(e.door);
      if (!door || d.removedDoors.includes(door.id)) return;
      // The door closes and disappears: the edge is a wall for sight, never drawn again.
      d.removedDoors = [...d.removedDoors, door.id];
      d.openDoors.delete(door.id);
      d.seenDoors.delete(door.id);
      return;
    }
    case 'addCounter': {
      const value = (d.counters[e.counter] ?? 0) + e.by;
      d.counters[e.counter] = value;
      prompts.push({ kind: 'counter', counter: e.counter, by: e.by, value });
      return;
    }
    case 'completeObjective':
      if (!d.objectivesDone.includes(e.objective))
        d.objectivesDone = [...d.objectivesDone, e.objective];
      return;
    case 'spawnNpc': {
      const npc = level.quest.npcs.find((n) => n.id === e.npc);
      if (!npc || d.spawnedNpcs.includes(npc.id)) return;
      d.spawnedNpcs = [...d.spawnedNpcs, npc.id];
      prompts.push({
        kind: 'npcSpawned',
        npc: npc.id,
        name: npc.name,
        cell: npc.cell,
        defend: npc.defend,
        text: npc.text,
      });
      return;
    }
    case 'promptChoice':
      d.pendingChoices = [...d.pendingChoices, { note: note.id, text: e.text, options: e.options }];
      prompts.push({
        kind: 'choice',
        noteId: note.id,
        text: e.text,
        options: e.options.map((o) => o.label),
      });
      return;
  }
}

// ---- Zargon turn

/**
 * Stone monsters lose one turn at the end of each Zargon turn; at 0 they become active.
 * Call before firing `zargonTurn` triggers, so a stone set by this turn's note keeps all its turns.
 */
export function tickStone(level: Level, d: Draft): Prompt[] {
  const prompts: Prompt[] = [];
  for (const [id, rec] of Object.entries(d.monsterStates)) {
    if (rec.state !== 'stone' || rec.turns === undefined) continue;
    const left = rec.turns - 1;
    const def = level.quest.monsters.find((m) => m.id === id);
    if (left > 0) {
      d.monsterStates[id] = { state: 'stone', turns: left };
      continue;
    }
    d.monsterStates[id] = { state: 'active' };
    if (def && d.seenMonsters.has(id))
      prompts.push({
        kind: 'monsterState',
        monster: id,
        name: def.name ?? MONSTER_NAMES[def.type],
        state: 'active',
      });
  }
  return prompts;
}

// ---- events that fire notes

/** The cells of `noteTrigger` squares, for the reducer checks. */
function squareNotes(level: Level, cell: CellKey): Note[] {
  return level.quest.notes.filter(
    (n) => n.trigger.type === 'squareEntered' && keyOf(n.trigger.cell) === cell,
  );
}

export function squareTrigger(
  level: Level,
  state: GameState,
  d: Draft,
  cell: Cell,
): { prompts: Prompt[] } {
  const k = keyOf(cell);
  if (!state.seenCells.has(k))
    throw new EventError('CELL_NOT_SEEN', `Square ${cell[0]},${cell[1]} is not seen yet`);
  const notes = squareNotes(level, k).filter((n) => isAvailable(n, state));
  if (notes.length === 0)
    throw new EventError('NOT_A_TRIGGER', `Nothing is waiting on square ${cell[0]},${cell[1]}`);
  const r = fireTrigger(level, d, { type: 'squareEntered', cell: k });
  return { prompts: r.prompts.length > 0 ? r.prompts : [{ kind: 'nothingNew' }] };
}

export function areaEnter(
  level: Level,
  state: GameState,
  d: Draft,
  area: string,
): { prompts: Prompt[] } {
  const notes = level.quest.notes.filter(
    (n) => n.trigger.type === 'areaEntered' && n.trigger.area === area,
  );
  if (notes.length === 0)
    throw new EventError('NOT_A_TRIGGER', `Nothing is waiting in area ${area}`);
  if (!state.revealedRooms.has(area))
    throw new EventError('ROOM_NOT_REVEALED', `Room ${area} is not revealed yet`);
  if (!notes.some((n) => isAvailable(n, state)))
    throw new EventError('NOT_A_TRIGGER', `Area ${area} already fired`);
  const before = new Set(state.revealedRooms);
  const r = fireTrigger(level, d, { type: 'areaEntered', area }, { beforeRooms: before });
  return { prompts: r.prompts.length > 0 ? r.prompts : [{ kind: 'nothingNew' }] };
}

/** A hero entered a zone that has a `zoneEntered` note waiting (decision 68). */
export function zoneEnter(
  level: Level,
  state: GameState,
  d: Draft,
  zone: string,
): { prompts: Prompt[] } {
  const z = level.quest.zones.find((x) => x.id === zone);
  if (!z) throw new EventError('UNKNOWN_ZONE', `Unknown zone ${zone}`);
  const notes = level.quest.notes.filter(
    (n) => n.trigger.type === 'zoneEntered' && n.trigger.zone === zone,
  );
  if (notes.length === 0)
    throw new EventError('NOT_A_TRIGGER', `Nothing is waiting in zone ${zone}`);
  if (!z.cells.some((c) => state.seenCells.has(keyOf(c))))
    throw new EventError('ZONE_NOT_SEEN', `Zone ${zone} has not been seen yet`);
  if (!notes.some((n) => isAvailable(n, state)))
    throw new EventError('NOT_A_TRIGGER', `Zone ${zone} already fired`);
  const r = fireTrigger(level, d, { type: 'zoneEntered', zone });
  return { prompts: r.prompts.length > 0 ? r.prompts : [{ kind: 'nothingNew' }] };
}

export function manualTrigger(
  level: Level,
  state: GameState,
  d: Draft,
  noteId: string,
): { prompts: Prompt[] } {
  const note = level.quest.notes.find((n) => n.id === noteId);
  if (!note) throw new EventError('UNKNOWN_NOTE', `Unknown note ${noteId}`);
  if (note.trigger.type !== 'manual')
    throw new EventError('NOT_A_TRIGGER', `Note ${noteId} is not a manual note`);
  if (!isAvailable(note, state))
    throw new EventError('NOT_A_TRIGGER', `Note ${noteId} already fired`);
  const r = fireTrigger(level, d, { type: 'manual', note: noteId });
  return { prompts: r.prompts.length > 0 ? r.prompts : [{ kind: 'nothingNew' }] };
}

/** CHOOSE: run the effects of the option the players picked. */
export function choose(
  level: Level,
  state: GameState,
  d: Draft,
  noteId: string,
  option: number,
): { prompts: Prompt[] } {
  const idx = state.pendingChoices.findIndex((p) => p.note === noteId);
  const pending = state.pendingChoices[idx];
  if (!pending)
    throw new EventError('NO_PENDING_CHOICE', `No choice is waiting for note ${noteId}`);
  const picked = Number.isInteger(option) ? pending.options[option] : undefined;
  if (!picked) throw new EventError('BAD_OPTION', `Option ${option} does not exist`);
  const note = level.quest.notes.find((n) => n.id === noteId);
  if (!note) throw new EventError('UNKNOWN_NOTE', `Unknown note ${noteId}`);
  d.pendingChoices = state.pendingChoices.filter((_, i) => i !== idx);
  d.choicesMade = [
    ...d.choicesMade,
    {
      note: noteId,
      text: pending.text,
      picked: picked.label,
      texts: textsOf(picked.effects).texts,
    },
  ];
  const r = runChosenEffects(level, d, note, picked.effects, {
    beforeRooms: new Set(state.revealedRooms),
  });
  return { prompts: r.prompts };
}

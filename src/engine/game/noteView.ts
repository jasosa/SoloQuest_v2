/** Read-only selectors for the quest notes, objectives and NPCs. Pure, derived from the state. */
import type { AreaId, Cell } from '../board/board';
import { tr } from '../../i18n/translate';
import { keyOf, parseKey, type Level } from '../board/level';
import { forEachEffect, textsOf } from '../quest/effects';
import type { NoteTarget, ObjectiveDef } from '../quest/schema';
import { notesOf } from '../quest/targets';
import { conditionsHold, isAvailable, objectiveConditionsHold } from './notes';
import type { GameState, PendingChoice } from './state';

// ---- journal

export interface JournalEntry {
  readonly id: string;
  readonly letter?: string;
  readonly at?: Cell;
  readonly title?: string;
  /** showText and giveItem texts, in order. */
  readonly texts: readonly string[];
  /** Choices the players made on this note. */
  readonly choices: readonly {
    readonly text: string;
    readonly picked: string;
    readonly texts: readonly string[];
  }[];
}

/**
 * Notes that were read, in the order they first fired. Silent notes (no text, no letter, no
 * choice made) are left out.
 */
export function journal(level: Level, state: GameState): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const id of state.notesFired) {
    const note = level.quest.notes.find((n) => n.id === id);
    if (!note) continue;
    const { texts, title } = textsOf(note.effects);
    const choices = state.choicesMade
      .filter((c) => c.note === id)
      .map((c) => ({ text: c.text, picked: c.picked, texts: c.texts }));
    if (texts.length === 0 && note.letter === undefined && choices.length === 0) continue;
    out.push({
      id,
      ...(note.letter !== undefined ? { letter: note.letter } : {}),
      ...(note.at !== undefined ? { at: note.at } : {}),
      ...(title !== undefined ? { title } : {}),
      texts,
      choices,
    });
  }
  return out;
}

/** The texts of the first `questStart` note: the start instruction for the Quest sheet. */
export function startTexts(level: Level): string[] {
  const note = level.quest.notes.find((n) => n.trigger.type === 'questStart');
  return note ? textsOf(note.effects).texts : [];
}

export interface MapLetter {
  readonly note: string;
  readonly letter: string;
  readonly at: Cell;
}

/** Letters to draw on the map: read notes that have a letter and a square. */
export function mapLetters(level: Level, state: GameState): MapLetter[] {
  const out: MapLetter[] = [];
  for (const id of state.notesFired) {
    const n = level.quest.notes.find((x) => x.id === id);
    if (n?.letter !== undefined && n.at !== undefined)
      out.push({ note: id, letter: n.letter, at: n.at });
  }
  return out;
}

// ---- things the players can tap

export interface SquareMarker {
  readonly cell: Cell;
  /** The marker stays after a tap (the note repeats). */
  readonly repeat: boolean;
  /** A `squareEntered` note waits here ("Did a hero step here?"). False for a button-only square. */
  readonly step: boolean;
}

/** Seen squares with a note waiting. Neutral marker: nothing about the content. */
export function squareMarkers(level: Level, state: GameState): SquareMarker[] {
  const out = new Map<string, SquareMarker>();
  for (const n of level.quest.notes) {
    const t = n.trigger;
    if (t.type !== 'squareEntered') continue;
    const k = keyOf(t.cell);
    if (!state.seenCells.has(k)) continue;
    if (!isAvailable(n, state)) {
      // fired: the square keeps its mark only when the note says so (a tap shows what was read)
      if (n.keepMark === true && !out.has(k))
        out.set(k, { cell: parseKey(k), repeat: false, step: false });
      continue;
    }
    const repeat = t.repeat === true || out.get(k)?.repeat === true;
    out.set(k, { cell: parseKey(k), repeat, step: true });
  }
  // A seen square with a button of its own that is not pressed yet keeps its marker (decision 67):
  // its hint says what to do, and the button shows once its conditions hold.
  for (const n of level.quest.notes) {
    const tg = n.target;
    if (
      n.trigger.type !== 'manual' ||
      tg?.kind !== 'square' ||
      out.has(tg.id) ||
      !state.seenCells.has(tg.id) ||
      !isAvailable(n, state)
    )
      continue;
    out.set(tg.id, { cell: parseKey(tg.id), repeat: false, step: false });
  }
  return [...out.values()];
}

/** Revealed rooms that have an `areaEntered` note still waiting ("A hero enters"). */
export function enterableAreas(level: Level, state: GameState): AreaId[] {
  const out: AreaId[] = [];
  for (const n of level.quest.notes) {
    const t = n.trigger;
    if (t.type === 'areaEntered' && state.revealedRooms.has(t.area) && isAvailable(n, state))
      if (!out.includes(t.area)) out.push(t.area);
  }
  return out;
}

export interface ZoneLabel {
  readonly zone: string;
  /** The first seen square of the zone (top row, then left): where the label is drawn. */
  readonly cell: Cell;
  /** Every seen square of the zone: drawn with a light dashed outline (the zone stays marked). */
  readonly cells: readonly Cell[];
  /** A `zoneEntered` note waits ("A hero enters"). False when only a button is waiting. */
  readonly enter: boolean;
}

/**
 * Zones that get a label on the map (decision 68): a seen zone with a `zoneEntered` note or a
 * button of its own that waits, or whose note has `keepMark` (the mark stays after use). Neutral: nothing about the
 * content.
 */
export function zoneLabels(level: Level, state: GameState): ZoneLabel[] {
  const out: ZoneLabel[] = [];
  for (const z of level.quest.zones) {
    const seen = z.cells
      .filter((c) => state.seenCells.has(keyOf(c)))
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const first = seen[0];
    if (!first) continue;
    const enter = level.quest.notes.some(
      (n) => n.trigger.type === 'zoneEntered' && n.trigger.zone === z.id && isAvailable(n, state),
    );
    const button = level.quest.notes.some(
      (n) =>
        n.trigger.type === 'manual' &&
        n.target?.kind === 'zone' &&
        n.target.id === z.id &&
        isAvailable(n, state),
    );
    // A note with `keepMark` leaves the zone marked after it fired: a tap shows what was read.
    const any = level.quest.notes.some(
      (n) =>
        n.keepMark === true &&
        ((n.trigger.type === 'zoneEntered' && n.trigger.zone === z.id) ||
          (n.target?.kind === 'zone' && n.target.id === z.id)),
    );
    if (enter || button || any)
      out.push({
        zone: z.id,
        cell: [first[0], first[1]],
        cells: seen.map((c) => [c[0], c[1]] as Cell),
        enter,
      });
  }
  return out;
}

/**
 * Rooms that get the small label on the map: a room with an `areaEntered` note waiting, or with
 * a button of its own that can be pressed now (decision 67).
 */
export function roomLabelAreas(level: Level, state: GameState): AreaId[] {
  const out = enterableAreas(level, state);
  for (const b of level.quest.notes) {
    const tg = b.target;
    if (
      b.trigger.type === 'manual' &&
      tg?.kind === 'area' &&
      state.revealedRooms.has(tg.id) &&
      isAvailable(b, state) &&
      conditionsHold(level, state, b) &&
      !out.includes(tg.id)
    )
      out.push(tg.id);
  }
  return out;
}

export interface ManualTrigger {
  readonly note: string;
  readonly label: string;
  readonly hint?: string;
}

/** The button of a `manual` note: its label and, when it has one, its hint. */
function buttonOf(n: {
  id: string;
  trigger: { type: string; label?: string; hint?: string };
}): ManualTrigger {
  return {
    note: n.id,
    label: n.trigger.label ?? '',
    ...(n.trigger.hint ? { hint: n.trigger.hint } : {}),
  };
}

/**
 * Buttons for `manual` notes that have not fired and whose conditions hold now. Notes with a
 * `target` belong to their element (see `elementQuest`), so they are left out here.
 */
export function manualTriggers(level: Level, state: GameState): ManualTrigger[] {
  const out: ManualTrigger[] = [];
  for (const n of level.quest.notes)
    if (
      n.trigger.type === 'manual' &&
      !n.target &&
      isAvailable(n, state) &&
      conditionsHold(level, state, n)
    )
      out.push(buttonOf(n));
  return out;
}

export interface ElementQuest {
  /** Notes already read that belong to the element, in the order they fired. */
  readonly read: readonly JournalEntry[];
  /** Hints of buttons that cannot be pressed yet (their conditions do not hold). */
  readonly waiting: readonly string[];
  /** Buttons of the element that can be pressed now. */
  readonly buttons: readonly ManualTrigger[];
}

/** What the "For this quest" block of a margin note shows for one element (decision 67). */
export function elementQuest(
  level: Level,
  state: GameState,
  kind: NoteTarget['kind'],
  id: string,
): ElementQuest {
  const mine = new Set(notesOf(level.quest.notes, kind, id).map((n) => n.id));
  const read = journal(level, state).filter((e) => mine.has(e.id));
  const buttons: ManualTrigger[] = [];
  const waiting: string[] = [];
  for (const n of level.quest.notes) {
    if (!mine.has(n.id) || n.trigger.type !== 'manual' || !isAvailable(n, state)) continue;
    if (conditionsHold(level, state, n)) buttons.push(buttonOf(n));
    else if (n.trigger.hint) waiting.push(n.trigger.hint);
  }
  return { read, waiting, buttons };
}

export interface ObjectiveConfirm {
  readonly objective: string;
  readonly label: string;
}

/** Confirm buttons of objectives that are not done yet (shown in the Quest sheet). */
export function objectiveConfirms(level: Level, state: GameState): ObjectiveConfirm[] {
  const out: ObjectiveConfirm[] = [];
  for (const o of level.quest.objectives)
    if (
      o.confirm &&
      !isDone(level, o, state) &&
      (!o.confirmWhen || objectiveConditionsHold(level, state, o.confirmWhen))
    )
      out.push({ objective: o.id, label: o.confirm });
  return out;
}

/** The choice the players have to answer now (the oldest one), if any. */
export function pendingChoice(state: GameState): PendingChoice | undefined {
  return state.pendingChoices[0];
}

// ---- objectives and the end

export interface ObjectiveStatus {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

export interface ObjectivesView {
  readonly items: readonly ObjectiveStatus[];
  /** All objectives are done (false for a quest with no objectives). */
  readonly goalDone: boolean;
}

function isDone(level: Level, o: ObjectiveDef, state: GameState): boolean {
  if (state.objectivesDone.includes(o.id)) return true;
  const d = o.done;
  if (!d) return false;
  if ('monsterKilled' in d) return state.monsters[d.monsterKilled]?.dead === true;
  if ('allKilled' in d) return d.allKilled.every((id) => state.monsters[id]?.dead === true);
  if ('when' in d) return objectiveConditionsHold(level, state, d.when);
  if ('allSeenKilled' in d) {
    const seen = [...state.seenMonsters];
    return seen.length > 0 && seen.every((id) => state.monsters[id]?.dead === true);
  }
  return state.flags[d.flag] === true;
}

export function objectivesStatus(level: Level, state: GameState): ObjectivesView {
  const items = level.quest.objectives.map((o) => ({
    id: o.id,
    text: o.text,
    done: isDone(level, o, state),
  }));
  return {
    items,
    goalDone: items.length > 0 && items.every((i) => i.done),
  };
}

/** What to tell the players once the goal is done: how the heroes leave. */
export function goalDoneText(level: Level): string {
  return level.quest.leave
    ? tr('game.goalDoneLeave', 'Goal done. The heroes leave {way}.', { way: level.quest.leave })
    : tr('game.goalDoneStairs', 'Goal done. Bring the heroes back to the stairs.');
}

/** A way to end the quest that the quest itself names (paraphrased label and text). */
export interface EndingView {
  readonly id: string;
  readonly label: string;
  readonly text: string | undefined;
}

/** The custom endings to offer in the End the Quest list (empty for most quests). */
export function availableEndings(level: Level): EndingView[] {
  return (level.quest.endings ?? []).map((e) => ({ id: e.id, label: e.label, text: e.text }));
}

export interface EndSummary {
  readonly outcome: 'stairs' | 'fell' | 'ending';
  /** The custom ending that was picked (only when `outcome` is 'ending'). */
  readonly ending: EndingView | undefined;
  readonly goalDone: boolean;
  /** The goal was done and the heroes left by the stairs. */
  readonly won: boolean;
  /** Reward text from the quest. Never tracked. */
  readonly rewards: string | undefined;
  /** The quest's closing note, shown after every ending. */
  readonly endText: string | undefined;
  /** Texts of the notes that fired when the quest ended (`questEnds`). */
  readonly endNotes: readonly string[];
  readonly objectives: readonly ObjectiveStatus[];
}

/**
 * How the heroes leave, in words: by the stairs, or through the wooden exit door when the quest has
 * one (Frozen Horror). The outcome stays `stairs` either way (one way to leave, saved the same).
 */
export function leaveWay(level: Level): string {
  if (level.quest.leave) return level.quest.leave;
  return level.quest.edgeDoors.some((e) => e.kind === 'woodenExit')
    ? tr('game.throughTheExit', 'through the exit door')
    : tr('game.byTheStairs', 'by the stairs');
}

/** The end screen data. Undefined until END_QUEST. */
export function endSummary(level: Level, state: GameState): EndSummary | undefined {
  if (!state.ended) return undefined;
  const view = objectivesStatus(level, state);
  const e = state.ended;
  const ending =
    e.outcome === 'ending' ? availableEndings(level).find((x) => x.id === e.ending) : undefined;
  return {
    outcome: e.outcome,
    ending,
    goalDone: view.goalDone,
    won: view.goalDone && e.outcome === 'stairs',
    // A custom ending shows no reward.
    rewards: e.outcome !== 'ending' && level.quest.rewards ? level.quest.rewards : undefined,
    endText: level.quest.endText,
    endNotes: e.notes ?? [],
    objectives: view.items,
  };
}

// ---- NPCs

export interface NpcView {
  readonly id: string;
  readonly name: string;
  readonly cell: Cell;
  readonly defend: number;
  readonly body: number;
  readonly move?: number | undefined;
  readonly attack?: number | undefined;
  readonly text: string;
}

/**
 * NPCs the players can see. An NPC that some `spawnNpc` effect brings in appears when that
 * effect fires; any other NPC appears when its square is seen. Text only, no Body Points kept.
 */
export function npcsInPlay(level: Level, state: GameState): NpcView[] {
  const spawnable = new Set<string>();
  forEachEffect(level.quest, (e) => {
    if (e.type === 'spawnNpc') spawnable.add(e.npc);
  });
  return level.quest.npcs
    .filter((n) =>
      spawnable.has(n.id) ? state.spawnedNpcs.includes(n.id) : state.seenCells.has(keyOf(n.cell)),
    )
    .map((n) => ({
      id: n.id,
      name: n.name,
      cell: n.cell,
      defend: n.defend,
      move: n.move,
      attack: n.attack,
      body: n.body,
      text: n.text,
    }));
}

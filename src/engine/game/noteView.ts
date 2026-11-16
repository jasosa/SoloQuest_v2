/** Read-only selectors for the quest notes, objectives and NPCs. Pure, derived from the state. */
import type { AreaId, Cell } from '../board/board';
import { keyOf, parseKey, type Level } from '../board/level';
import { forEachEffect, textsOf } from '../quest/effects';
import type { ObjectiveDef } from '../quest/schema';
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
}

/** Seen squares with a note waiting. Neutral marker: nothing about the content. */
export function squareMarkers(level: Level, state: GameState): SquareMarker[] {
  const out = new Map<string, SquareMarker>();
  for (const n of level.quest.notes) {
    const t = n.trigger;
    if (t.type !== 'squareEntered') continue;
    const k = keyOf(t.cell);
    if (!state.seenCells.has(k) || !isAvailable(n, state)) continue;
    const repeat = t.repeat === true || out.get(k)?.repeat === true;
    out.set(k, { cell: parseKey(k), repeat });
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

export interface ManualTrigger {
  readonly note: string;
  readonly label: string;
}

/** Buttons for `manual` notes that have not fired and whose conditions hold now. */
export function manualTriggers(level: Level, state: GameState): ManualTrigger[] {
  const out: ManualTrigger[] = [];
  for (const n of level.quest.notes)
    if (n.trigger.type === 'manual' && isAvailable(n, state) && conditionsHold(level, state, n))
      out.push({ note: n.id, label: n.trigger.label });
  return out;
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
  return { items, goalDone: items.length > 0 && items.every((i) => i.done) };
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
  readonly objectives: readonly ObjectiveStatus[];
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
      body: n.body,
      text: n.text,
    }));
}

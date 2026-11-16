/**
 * Note operations for the note builder. Same style as `ops.ts`: pure, the input is never changed,
 * ids stay stable.
 *
 * A note is allowed to be half done while it is being written: a trigger that points at a door
 * that does not exist yet, an effect with a missing target. Those problems come back as warnings
 * (and `validateQuestIssues` keeps listing them as errors). Only things the schema rejects are
 * refused.
 */
import type { Condition, Effect, Note, NoteTarget, Quest, Trigger } from '../quest/schema';
import type { Cell } from './ops';
import { clean, fail, newIssues, nextId, ok, type EditResult } from './result';

/** X marks a spot on the map, so it is never handed out as a note letter. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWYZ'.split('');
const isLetter = (s: string) => /^[A-Z]$/.test(s);

/** Letters that appear on the map (furniture letter or a one-letter marker label). */
function mapLetters(q: Quest): string[] {
  const set = new Set<string>();
  for (const f of q.furniture) if (f.letter) set.add(f.letter);
  for (const m of q.markers) if (/^[A-WYZ]$/.test(m.label)) set.add(m.label);
  return [...set].sort();
}

/** Letters on the map that no note uses yet. This is the live check of the note builder. */
export function lettersMissingNotes(q: Quest): string[] {
  const used = new Set(q.notes.flatMap((n) => (n.letter ? [n.letter] : [])));
  return mapLetters(q).filter((l) => !used.has(l));
}

/** Notes that have no letter (triggered by the quest itself, not by a letter on the map). */
export function notesWithoutLetter(q: Quest): Note[] {
  return q.notes.filter((n) => !n.letter);
}

/** Letters from A to Z (without X) that no note uses. */
export function freeNoteLetters(q: Quest): string[] {
  const used = new Set(q.notes.flatMap((n) => (n.letter ? [n.letter] : [])));
  return LETTERS.filter((l) => !used.has(l));
}

/**
 * The letter `addNote` picks for `letter: 'next'`: the first map letter with no note, else the
 * first free letter. Undefined when all 25 are used.
 */
export function nextNoteLetter(q: Quest): string | undefined {
  return lettersMissingNotes(q).find(isLetter) ?? freeNoteLetters(q)[0];
}

export interface NewNote {
  /** A letter A..Z, `'next'` for the next free one, or nothing for an unlettered note. */
  letter?: string;
  at?: Cell;
  /** The element the note belongs to (a button of that element when the trigger is manual). */
  target?: NoteTarget;
  /** Default: a manual trigger. */
  trigger?: Trigger;
  when?: Condition[];
  effects?: Effect[];
  consumesTreasure?: boolean;
  /** Treasure search only: show the note, draw no card, and do not use up the search. */
  blocksSearch?: boolean;
  id?: string;
}

/** A note id that is free: `n-<letter>` for a lettered note, `n1`, `n2`... otherwise. */
function newNoteId(q: Quest, letter: string | undefined): string {
  const taken = q.notes.map((n) => n.id);
  if (letter && !taken.includes(`n-${letter}`)) return `n-${letter}`;
  return nextId('n', taken);
}

export function addNote(q: Quest, input: NewNote = {}): EditResult {
  let letter: string | undefined;
  if (input.letter === 'next') {
    letter = nextNoteLetter(q);
    if (!letter) return fail('Every letter from A to Z already has a note.');
  } else if (input.letter !== undefined) {
    letter = input.letter.trim().toUpperCase();
    if (!isLetter(letter)) return fail('A note letter is a single capital letter from A to Z.');
    if (q.notes.some((n) => n.letter === letter))
      return fail(`Letter ${letter} already has a note.`);
  }
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) return fail(`The note id "${id}" is not valid.`);
    if (q.notes.some((n) => n.id === id)) return fail(`A note with id ${id} already exists.`);
  } else id = newNoteId(q, letter);
  const note: Note = clean({
    id,
    letter,
    at: input.at ? ([input.at[0], input.at[1]] as Cell) : undefined,
    target: input.target ? { kind: input.target.kind, id: input.target.id } : undefined,
    trigger: input.trigger ?? { type: 'manual', label: 'Manual note' },
    when: input.when && input.when.length ? input.when : undefined,
    effects: input.effects ?? [],
    consumesTreasure: input.consumesTreasure ? true : undefined,
    blocksSearch: input.blocksSearch ? true : undefined,
  });
  const quest = { ...q, notes: [...q.notes, note] };
  return ok(quest, newIssues(q, quest));
}

/** `null` clears a field; a missing key leaves it as it is. */
export interface NotePatch {
  letter?: string | null;
  at?: Cell | null;
  /** `null` detaches the note from its element. */
  target?: NoteTarget | null;
  trigger?: Trigger;
  when?: Condition[] | null;
  effects?: Effect[];
  consumesTreasure?: boolean | null;
  blocksSearch?: boolean | null;
}

export function updateNote(q: Quest, id: string, patch: NotePatch): EditResult {
  const n = q.notes.find((x) => x.id === id);
  if (!n) return fail(`There is no note ${id}.`);
  const next: Record<string, unknown> = { ...n };
  const set = (key: string, value: unknown) => {
    if (value === null || value === undefined) delete next[key];
    else next[key] = value;
  };
  if (patch.letter !== undefined) {
    if (patch.letter === null) set('letter', null);
    else {
      const letter = patch.letter.trim().toUpperCase();
      if (!isLetter(letter)) return fail('A note letter is a single capital letter from A to Z.');
      if (q.notes.some((x) => x.id !== id && x.letter === letter))
        return fail(`Letter ${letter} already has a note.`);
      set('letter', letter);
    }
  }
  if (patch.at !== undefined) set('at', patch.at ? [patch.at[0], patch.at[1]] : null);
  if (patch.target !== undefined)
    set('target', patch.target ? { kind: patch.target.kind, id: patch.target.id } : null);
  if (patch.trigger !== undefined) next.trigger = patch.trigger;
  if (patch.when !== undefined) set('when', patch.when?.length ? patch.when : null);
  if (patch.effects !== undefined) next.effects = patch.effects;
  if (patch.consumesTreasure !== undefined)
    set('consumesTreasure', patch.consumesTreasure ? true : null);
  if (patch.blocksSearch !== undefined) set('blocksSearch', patch.blocksSearch ? true : null);
  const quest = { ...q, notes: q.notes.map((x) => (x.id === id ? (next as Note) : x)) };
  return ok(quest, newIssues(q, quest));
}

/**
 * Set the main text of a note: the first top-level `showText` effect. Empty text removes that
 * effect. If the note has none, a new one goes first. The title of an existing one is kept.
 */
export function setNoteText(q: Quest, id: string, text: string): EditResult {
  const n = q.notes.find((x) => x.id === id);
  if (!n) return fail(`There is no note ${id}.`);
  const t = text.trim();
  const i = n.effects.findIndex((e) => e.type === 'showText');
  let effects: Effect[];
  if (i >= 0) {
    if (t === '') effects = n.effects.filter((_, j) => j !== i);
    else
      effects = n.effects.map((e, j) => (j === i && e.type === 'showText' ? { ...e, text: t } : e));
  } else effects = t === '' ? n.effects : [{ type: 'showText', text: t }, ...n.effects];
  return updateNote(q, id, { effects });
}

/**
 * Remove a note. Nothing else is edited. If the quest still points at it (the `noEquipmentUntil`
 * rule) or a letter on the map now has no note, that comes back in the warnings.
 */
export function removeNote(q: Quest, id: string): EditResult {
  if (!q.notes.some((n) => n.id === id)) return fail(`There is no note ${id}.`);
  const quest = { ...q, notes: q.notes.filter((n) => n.id !== id) };
  return ok(quest, newIssues(q, quest));
}

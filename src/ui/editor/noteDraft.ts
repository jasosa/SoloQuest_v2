/**
 * The draft of an action (owner decision, 2026-11-26). The action form edits a copy of the action.
 * Nothing reaches the quest until "Save action", and then it is one undo step. "Cancel" drops the
 * copy. A new action is only a draft until it is saved.
 *
 * Pure functions on top of the engine note operations, so the same checks apply to a draft as to
 * a saved action (a refused change gives the engine sentence).
 */
import { addNote, updateNote, type EditResult, type NotePatch } from '../../engine/editor';
import type { Cell } from '../../engine/editor';
import type { Note, Quest } from '../../engine/quest/schema';

export interface NoteDraft {
  /** The action as it is being edited. */
  readonly note: Note;
  /** True until the first save: the action is not in the quest yet. */
  readonly isNew: boolean;
}

/** The draft of an action that is already in the quest. */
export const draftOf = (note: Note): NoteDraft => ({ note, isNew: false });

/** The quest as the form sees it: the draft in place of the saved action (or added, when new). */
export function withDraft(q: Quest, d: NoteDraft): Quest {
  const has = q.notes.some((n) => n.id === d.note.id);
  return {
    ...q,
    notes: has ? q.notes.map((n) => (n.id === d.note.id ? d.note : n)) : [...q.notes, d.note],
  };
}

/** Change the draft. The engine refuses what it refuses for a saved action. */
export function patchDraft(
  q: Quest,
  d: NoteDraft,
  p: NotePatch,
): { ok: true; draft: NoteDraft } | { ok: false; error: string } {
  const r = updateNote(withDraft(q, d), d.note.id, p);
  if (!r.ok) return r;
  const note = r.quest.notes.find((n) => n.id === d.note.id);
  if (!note) return { ok: false, error: 'The action is gone.' };
  return { ok: true, draft: { note, isNew: d.isNew } };
}

/** Every field of an action as a patch, so a save writes the whole draft. */
export function fullPatch(n: Note): NotePatch {
  return {
    letter: n.letter ?? null,
    at: (n.at as Cell | undefined) ?? null,
    target: n.target ?? null,
    trigger: n.trigger,
    when: n.when ?? null,
    effects: n.effects,
    consumesTreasure: n.consumesTreasure ?? null,
    keepMark: n.keepMark ?? null,
    blocksSearch: n.blocksSearch ?? null,
    map: n.map ?? null,
  };
}

/** The draft differs from the action in the quest (a new action always does). */
export function isDirty(q: Quest, d: NoteDraft): boolean {
  if (d.isNew) return true;
  const saved = q.notes.find((n) => n.id === d.note.id);
  return !saved || JSON.stringify(saved) !== JSON.stringify(d.note);
}

/** Write the draft into the quest: a new action is added, an old one is replaced. */
export function commitDraft(q: Quest, d: NoteDraft): EditResult {
  if (!d.isNew) return updateNote(q, d.note.id, fullPatch(d.note));
  const added = addNote(q, { id: d.note.id, trigger: d.note.trigger, effects: [] });
  if (!added.ok) return added;
  const filled = updateNote(added.quest, d.note.id, fullPatch(d.note));
  if (!filled.ok) return filled;
  return { ok: true, quest: filled.quest, warnings: [...added.warnings, ...filled.warnings] };
}

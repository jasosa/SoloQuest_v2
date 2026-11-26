import { describe, expect, it } from 'vitest';
import { addNote } from '../../engine/editor';
import { parseQuest } from '../../engine/quest/loader';
import type { Quest } from '../../engine/quest/schema';
import { testQuestData } from '../../engine/quest/testQuest';
import { commitDraft, draftOf, isDirty, patchDraft, withDraft, type NoteDraft } from './noteDraft';

const base = (): Quest => parseQuest({ ...testQuestData });
const withNote = (letter?: string): Quest => {
  const r = addNote(base(), {
    trigger: { type: 'questStart' },
    effects: [{ type: 'showText', text: 'Hello.' }],
    ...(letter ? { letter } : {}),
  });
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};
const last = (q: Quest) => q.notes[q.notes.length - 1]!;
const text = (d: NoteDraft) => {
  const e = d.note.effects[0];
  return e && e.type === 'showText' ? e.text : '';
};
const patched = (q: Quest, d: NoteDraft, p: Parameters<typeof patchDraft>[2]): NoteDraft => {
  const r = patchDraft(q, d, p);
  if (!r.ok) throw new Error(r.error);
  return r.draft;
};

describe('action draft', () => {
  it('an edit changes the draft and leaves the quest as it was', () => {
    const q = withNote();
    const saved = last(q)!;
    const d0 = draftOf(saved);
    expect(isDirty(q, d0)).toBe(false);
    const d1 = patched(q, d0, { effects: [{ type: 'showText', text: 'Changed.' }] });
    expect(text(d1)).toBe('Changed.');
    expect(isDirty(q, d1)).toBe(true);
    expect(last(q)).toBe(saved);
    expect(text(d0)).toBe('Hello.');
  });

  it('the form sees the draft in the quest, an old action replaced and a new one added', () => {
    const q = withNote();
    const d1 = patched(q, draftOf(last(q)!), { letter: 'B' });
    expect(last(withDraft(q, d1)).letter).toBe('B');
    const fresh: NoteDraft = {
      isNew: true,
      note: { id: 'n9', trigger: { type: 'questStart' }, effects: [] },
    };
    expect(withDraft(q, fresh).notes.map((n) => n.id)).toEqual([...q.notes.map((n) => n.id), 'n9']);
    expect(isDirty(q, fresh)).toBe(true);
  });

  it('a refused change returns the engine sentence and keeps the draft', () => {
    const q = withNote('A');
    const other = addNote(q, { trigger: { type: 'questStart' }, effects: [], letter: 'B' });
    if (!other.ok) throw new Error(other.error);
    const d = draftOf(last(other.quest));
    const r = patchDraft(other.quest, d, { letter: 'A' });
    expect(r).toEqual({ ok: false, error: 'Letter A already has a note.' });
  });

  it('saving writes every field of the draft in one change', () => {
    const q = withNote();
    const d = patched(
      q,
      patched(q, draftOf(last(q)!), { effects: [{ type: 'showText', text: 'New.' }] }),
      { letter: 'C', keepMark: true },
    );
    const r = commitDraft(q, d);
    if (!r.ok) throw new Error(r.error);
    const n = last(r.quest);
    expect(n.letter).toBe('C');
    expect(n.keepMark).toBe(true);
    expect(n.effects).toEqual([{ type: 'showText', text: 'New.' }]);
    expect(isDirty(r.quest, draftOf(n))).toBe(false);
  });

  it('a field cleared in the draft is cleared on save', () => {
    const q = withNote('A');
    const d = patched(q, draftOf(last(q)!), { letter: null });
    const r = commitDraft(q, d);
    if (!r.ok) throw new Error(r.error);
    expect(last(r.quest)?.letter).toBeUndefined();
  });

  it('a new action joins the quest only when it is saved, with its id', () => {
    const q = base();
    const made = addNote(q, { trigger: { type: 'questStart' }, effects: [], letter: 'D' });
    if (!made.ok) throw new Error(made.error);
    const note = last(made.quest);
    const d = patched(
      q,
      { note, isNew: true },
      {
        effects: [{ type: 'showText', text: 'Fresh.' }],
      },
    );
    const before = q.notes.length;
    expect(q.notes.some((n) => n.id === d.note.id)).toBe(false);
    const r = commitDraft(q, d);
    if (!r.ok) throw new Error(r.error);
    expect(r.quest.notes).toHaveLength(before + 1);
    expect(last(r.quest)).toEqual(d.note);
  });
});

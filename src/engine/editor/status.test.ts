import { describe, expect, it } from 'vitest';
import { QuestSchema, type Quest } from '../quest/schema';
import { parseQuest } from '../quest/loader';
import q01 from '../../content/quests/q01-the-trial.json';
import { exportQuest, importQuest } from './io';
import { emptyQuest } from './ops';
import {
  approveQuest,
  isApproved,
  makeCopy,
  playableUserQuests,
  questStatus,
  replaceOriginal,
  replacedSlot,
  withdrawQuest,
} from './status';

/** A quest that passes validation, as a bundled quest does. */
const valid = (): Quest => parseQuest(q01);

describe('status of a quest', () => {
  it('a new quest is a draft', () => {
    const q = emptyQuest({ id: 'user-a', number: 1, title: 'A' });
    expect(questStatus(q)).toBe('draft');
    expect(isApproved(q)).toBe(false);
  });

  it('no status means approved (bundled quests and quests saved before the status)', () => {
    expect(questStatus(valid())).toBe('approved');
    expect(isApproved(valid())).toBe(true);
  });

  it('approve works on a valid quest and keeps it valid for the schema', () => {
    const r = approveQuest({ ...valid(), status: 'draft' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quest.status).toBe('approved');
    expect(QuestSchema.safeParse(r.quest).success).toBe(true);
  });

  it('approve is refused while the quest has validation errors', () => {
    const r = approveQuest(emptyQuest({ id: 'user-a', number: 1, title: 'A' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/cannot be approved/);
  });

  it('withdraw makes it a draft again, and does not change the input', () => {
    const q = { ...valid(), status: 'approved' as const };
    expect(withdrawQuest(q).status).toBe('draft');
    expect(q.status).toBe('approved');
  });
});

describe('copy of a bundled quest', () => {
  const original = {
    ...valid(),
    id: 'q03-lair',
    title: 'Lair',
    intro: { summary: 's', userText: 'mine' },
  };

  it('is a draft with a new user id, linked to the original, without personal text', () => {
    const c = makeCopy(original, ['user-lair-copy']);
    expect(c.id).toBe('user-lair-copy-2');
    expect(c.status).toBe('draft');
    expect(c.copyOf).toBe('q03-lair');
    expect(c.intro.userText).toBeUndefined();
    expect(c.notes).toEqual(original.notes);
    expect(c.notes).not.toBe(original.notes);
    expect(original.id).toBe('q03-lair');
  });

  it('adds a (copy) suffix, numbered when the title is taken', () => {
    expect(makeCopy(original, []).title).toBe('Lair (copy)');
    expect(makeCopy(original, [], ['Lair (copy)']).title).toBe('Lair (copy 2)');
    expect(makeCopy(original, [], ['Lair (copy)', 'Lair (copy 2)']).title).toBe('Lair (copy 3)');
  });

  it('a copy of a copy is numbered, not stacked', () => {
    const first = makeCopy(original, [], []);
    expect(makeCopy(first, [first.id], [first.title]).title).toBe('Lair (copy 2)');
    const second = makeCopy(first, [first.id], [first.title]);
    expect(makeCopy(second, [], [first.title, second.title]).title).toBe('Lair (copy 3)');
  });

  it('a copy of a copy still points at the bundled original', () => {
    const first = makeCopy(original, []);
    const second = makeCopy({ ...first, status: 'approved' }, [first.id]);
    expect(second.copyOf).toBe('q03-lair');
    expect(second.status).toBe('draft');
    expect(second.id).not.toBe(first.id);
  });

  it('a copy of a quest of your own has no original', () => {
    const own = { ...valid(), id: 'user-mine' };
    expect(makeCopy(own, [own.id]).copyOf).toBeUndefined();
  });
});

describe('files', () => {
  it('export leaves out status and copyOf', () => {
    const q = { ...valid(), status: 'approved' as const, copyOf: 'q03-lair' };
    const data = JSON.parse(exportQuest(q)) as Record<string, unknown>;
    expect('status' in data).toBe(false);
    expect('copyOf' in data).toBe(false);
  });

  it('a file imported with no options is a draft too, without copyOf', () => {
    const file = JSON.stringify({ ...valid(), status: 'approved', copyOf: 'q03-lair' });
    const r = importQuest(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quest.status).toBe('draft');
    expect(r.quest.copyOf).toBeUndefined();
  });

  it('a quest imported into the editor is a draft, whatever the file says', () => {
    const file = JSON.stringify({ ...valid(), status: 'approved', copyOf: 'q03-lair' });
    const r = importQuest(file, { takenIds: [] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quest.status).toBe('draft');
    expect(r.quest.copyOf).toBeUndefined();
  });
});

describe('the lists of quests to play', () => {
  const saved = [
    { id: 'user-draft', status: 'draft' as const },
    { id: 'user-ok', status: 'approved' as const },
    { id: 'user-old' }, // saved before the status existed
    { id: 'user-copy', status: 'approved' as const },
    { id: 'user-copy-draft', status: 'draft' as const },
  ];

  it('offers approved quests only; a missing status counts as approved', () => {
    expect(playableUserQuests(saved, {}).own).toEqual(['user-ok', 'user-old', 'user-copy']);
  });

  it('an approved copy replaces its original only when an override says so', () => {
    const none = playableUserQuests(saved, {});
    expect(none.replacing).toEqual({});
    expect(none.own).toContain('user-copy');
    const some = playableUserQuests(saved, { 3: 'user-copy' });
    expect(some.replacing).toEqual({ 3: 'user-copy' });
    expect(some.own).not.toContain('user-copy');
  });

  it('a draft copy does not replace the original and is not listed either', () => {
    const r = playableUserQuests(saved, { 5: 'user-copy-draft' });
    expect(r.replacing).toEqual({});
    expect(r.own).not.toContain('user-copy-draft');
  });

  it('an override of a quest that is gone changes nothing', () => {
    expect(playableUserQuests(saved, { 2: 'user-gone' }).replacing).toEqual({});
  });

  it('an old saved copy that already replaced a bundled quest still does', () => {
    expect(playableUserQuests([{ id: 'user-old' }], { 7: 'user-old' })).toEqual({
      replacing: { 7: 'user-old' },
      own: [],
    });
  });
});

describe('replace the original', () => {
  const slotOf = (id: string) => (id === 'q03-lair' ? 3 : undefined);
  const copy = (patch: Partial<Quest> = {}): Quest => ({
    ...valid(),
    id: 'user-lair',
    copyOf: 'q03-lair',
    status: 'approved',
    ...patch,
  });

  it('sets the override of the original slot and keeps the other ones', () => {
    const r = replaceOriginal({ 9: 'user-x' }, copy(), slotOf);
    expect(r).toEqual({ ok: true, slot: 3, overrides: { 9: 'user-x', 3: 'user-lair' } });
  });

  it('refuses a draft: approving comes first', () => {
    const r = replaceOriginal({}, copy({ status: 'draft' }), slotOf);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Approve/) });
  });

  it('refuses a quest that is not a copy, or whose original is gone', () => {
    const { copyOf: _c, ...own } = copy();
    void _c;
    expect(replaceOriginal({}, own, slotOf).ok).toBe(false);
    expect(replaceOriginal({}, copy({ copyOf: 'q99-gone' }), slotOf).ok).toBe(false);
  });

  it('replacedSlot tells which bundled slot a quest replaces now', () => {
    expect(replacedSlot({ 3: 'user-lair' }, { id: 'user-lair' })).toBe(3);
    expect(replacedSlot({ 3: 'user-lair' }, { id: 'user-other' })).toBeUndefined();
  });
});

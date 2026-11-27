import { describe, expect, it } from 'vitest';
import type { Quest } from '../quest/schema';
import { testQuest } from '../quest/testQuest';
import { addFurniture, addMarker, setFurnitureLetter, type EditResult } from './ops';
import {
  addNote,
  freeNoteLetters,
  lettersMissingNotes,
  nextNoteLetter,
  notesWithoutLetter,
  removeNote,
  setNoteText,
  updateNote,
} from './notes';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
const good = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};
const bad = (r: EditResult): string => {
  if (r.ok) throw new Error('expected an error');
  return r.error;
};
const base = () => deepFreeze(testQuest());

describe('letters', () => {
  it('lists map letters without a note, and the next letter', () => {
    let q: Quest = testQuest();
    q = good(setFurnitureLetter(q, 'f1', 'A'));
    q = good(addMarker(q, 'C', [9, 16]));
    q = good(addMarker(q, 'X', [10, 16]));
    expect(lettersMissingNotes(q)).toEqual(['A', 'C']);
    expect(nextNoteLetter(q)).toBe('A');
    q = good(addNote(q, { letter: 'next' }));
    expect(q.notes.at(-1)).toMatchObject({ id: 'n-A', letter: 'A' });
    expect(lettersMissingNotes(q)).toEqual(['C']);
    expect(nextNoteLetter(q)).toBe('C');
  });
  it('hands out free letters A..Z without X', () => {
    let q = testQuest();
    expect(freeNoteLetters(q)).toHaveLength(25);
    expect(freeNoteLetters(q)).not.toContain('X');
    q = good(addNote(q, { letter: 'A' }));
    q = good(addNote(q, { letter: 'next' }));
    expect(q.notes.map((n) => n.letter)).toEqual([undefined, 'A', 'B']);
  });
  it('says when every letter is used', () => {
    let q = testQuest();
    for (let i = freeNoteLetters(q).length; i > 0; i--) q = good(addNote(q, { letter: 'next' }));
    expect(bad(addNote(q, { letter: 'next' }))).toMatch(/Every letter/);
  });
  it('lists notes without a letter', () => {
    const q = good(addNote(base(), { letter: 'A' }));
    expect(notesWithoutLetter(q).map((n) => n.id)).toEqual(['n-m3']);
  });
});

describe('addNote', () => {
  it('adds an unlettered manual note with a free id and does not touch the input', () => {
    const q0 = base();
    const q = good(addNote(q0, {}));
    expect(q.notes).toHaveLength(2);
    expect(q.notes[1]).toEqual({
      id: 'n1',
      trigger: { type: 'manual', label: 'Manual note' },
      effects: [],
    });
    expect(q0.notes).toHaveLength(1);
    expect(good(addNote(q, {})).notes[2]?.id).toBe('n2');
  });
  it('keeps given trigger, conditions, effects and cell', () => {
    const q = good(
      addNote(base(), {
        letter: 'b',
        at: [3, 3],
        trigger: { type: 'doorOpened', door: 'd2' },
        when: [{ firstTime: true }],
        effects: [{ type: 'showText', text: 'Hello' }],
      }),
    );
    expect(q.notes[1]).toEqual({
      id: 'n-B',
      letter: 'B',
      at: [3, 3],
      trigger: { type: 'doorOpened', door: 'd2' },
      when: [{ firstTime: true }],
      effects: [{ type: 'showText', text: 'Hello' }],
    });
  });
  it('refuses a bad or used letter and a used id', () => {
    const q = good(addNote(base(), { letter: 'A' }));
    expect(bad(addNote(q, { letter: 'A' }))).toMatch(/already has a note/);
    expect(bad(addNote(q, { letter: 'AB' }))).toMatch(/single capital/);
    expect(bad(addNote(q, { id: 'n-A' }))).toMatch(/already exists/);
    expect(bad(addNote(q, { id: 'bad id' }))).toMatch(/not valid/);
  });
  it('warns about a trigger that points at nothing', () => {
    const r = addNote(base(), { trigger: { type: 'doorOpened', door: 'd99' } });
    expect(r.ok && r.warnings.map((w) => w.message)).toEqual([
      expect.stringMatching(/unknown door d99/),
    ]);
  });
});

describe('updateNote', () => {
  const withNote = () => deepFreeze(good(addNote(testQuest(), { letter: 'A', at: [2, 2] })));
  it('changes trigger, conditions and effects and keeps the id', () => {
    const q = good(
      updateNote(withNote(), 'n-A', {
        trigger: { type: 'treasureSearch', area: 'R17', first: true },
        when: [{ monster: 'm1', alive: false }],
        effects: [{ type: 'giveItem', text: 'A key' }],
        consumesTreasure: true,
      }),
    );
    expect(q.notes[1]).toEqual({
      id: 'n-A',
      letter: 'A',
      at: [2, 2],
      trigger: { type: 'treasureSearch', area: 'R17', first: true },
      when: [{ monster: 'm1', alive: false }],
      effects: [{ type: 'giveItem', text: 'A key' }],
      consumesTreasure: true,
    });
  });
  it('clears letter, at, when and consumesTreasure with null', () => {
    const q = good(
      updateNote(withNote(), 'n-A', { letter: null, at: null, when: null, consumesTreasure: null }),
    );
    expect(q.notes[1]).toEqual({
      id: 'n-A',
      trigger: { type: 'manual', label: 'Manual note' },
      effects: [],
    });
  });
  it('refuses a letter used by another note, an unknown note, and schema-invalid input', () => {
    const q = good(addNote(withNote(), { letter: 'B' }));
    expect(bad(updateNote(q, 'n-B', { letter: 'a' }))).toMatch(/already has a note/);
    expect(bad(updateNote(q, 'nope', {}))).toMatch(/no note nope/);
    expect(bad(updateNote(q, 'n-B', { effects: [{ type: 'showText', text: '' }] }))).toMatch(
      /invalid/,
    );
  });
  it('warns when consumesTreasure does not fit the trigger', () => {
    const r = updateNote(withNote(), 'n-A', { consumesTreasure: true });
    expect(r.ok && r.warnings.map((w) => w.message)).toEqual([
      expect.stringMatching(/consumesTreasure/),
    ]);
  });
});

describe('the blockSearch effect', () => {
  const withNote = () => deepFreeze(good(addNote(testQuest(), { letter: 'A', at: [2, 2] })));
  it('is added and removed like any effect, and addNote accepts it', () => {
    const trigger = { type: 'treasureSearch', area: 'R17' } as const;
    const q = good(updateNote(withNote(), 'n-A', { trigger, effects: [{ type: 'blockSearch' }] }));
    expect(q.notes[1]?.effects).toEqual([{ type: 'blockSearch' }]);
    const r = updateNote(q, 'n-A', { effects: [] });
    expect(r.ok && r.quest.notes[1]?.effects).toEqual([]);
    const added = good(addNote(testQuest(), { trigger, effects: [{ type: 'blockSearch' }] }));
    expect(added.notes.at(-1)?.effects).toEqual([{ type: 'blockSearch' }]);
  });
  it('warns when the trigger is not a treasure search', () => {
    const r = updateNote(withNote(), 'n-A', { effects: [{ type: 'blockSearch' }] });
    expect(r.ok && r.warnings.map((w) => w.message)).toEqual([
      expect.stringMatching(/blockSearch only/),
    ]);
  });
});

describe('setNoteText', () => {
  it('adds, replaces and removes the main text, keeping other effects and the title', () => {
    let q = good(addNote(base(), { letter: 'A', effects: [{ type: 'revealAll' }] }));
    q = good(setNoteText(q, 'n-A', ' Hi '));
    expect(q.notes[1]?.effects).toEqual([{ type: 'showText', text: 'Hi' }, { type: 'revealAll' }]);
    q = good(updateNote(q, 'n-A', { effects: [{ type: 'showText', text: 'Hi', title: 'T' }] }));
    q = good(setNoteText(q, 'n-A', 'Bye'));
    expect(q.notes[1]?.effects).toEqual([{ type: 'showText', text: 'Bye', title: 'T' }]);
    q = good(setNoteText(q, 'n-A', ''));
    expect(q.notes[1]?.effects).toEqual([]);
    expect(bad(setNoteText(q, 'zz', 'x'))).toMatch(/no note/);
  });
});

describe('removeNote', () => {
  it('removes and warns that a lettered piece now has no note', () => {
    let q = good(addFurniture(testQuest(), 'table', [[9, 14]], { letter: 'A' }));
    q = good(addNote(q, { letter: 'A' }));
    const r = removeNote(q, 'n-A');
    expect(r.ok && r.quest.notes.map((n) => n.id)).toEqual(['n-m3']);
    expect(r.ok && r.warnings.map((w) => w.message)).toEqual([
      expect.stringMatching(/letter A has no note/),
    ]);
    expect(bad(removeNote(q, 'zz'))).toMatch(/no note zz/);
  });
  it('warns when the noEquipmentUntil rule loses its note', () => {
    const q = testQuest({ rules: { noEquipmentUntil: 'n-m3' } });
    const r = removeNote(q, 'n-m3');
    expect(r.ok && r.warnings.some((w) => /noEquipmentUntil/.test(w.message))).toBe(true);
  });
});

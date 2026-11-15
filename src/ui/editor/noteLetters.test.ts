import { describe, expect, it } from 'vitest';
import { addMarker, addNote, setFurnitureLetter, type EditResult } from '../../engine/editor';
import type { Quest } from '../../engine/quest/schema';
import { testQuest } from '../../engine/quest/testQuest';
import { editorLetters } from './noteLetters';

const good = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};

describe('editorLetters', () => {
  it('marks a map letter with no note as missing, and a noted one with its note', () => {
    let q: Quest = testQuest();
    q = good(addMarker(q, 'C', [9, 16]));
    expect(editorLetters(q)).toEqual([{ letter: 'C', at: [9, 16], onThing: true }]);
    q = good(addNote(q, { letter: 'C', id: 'n-C' }));
    expect(editorLetters(q)).toEqual([{ letter: 'C', at: [9, 16], note: 'n-C', onThing: true }]);
  });

  it('uses the note square when it has one, and skips unlettered notes', () => {
    let q: Quest = testQuest();
    q = good(addNote(q, { letter: 'B', at: [4, 4], id: 'n-B' }));
    q = good(addNote(q, { id: 'n-free' }));
    expect(editorLetters(q)).toEqual([{ letter: 'B', at: [4, 4], note: 'n-B' }]);
  });

  it('finds the furniture that carries the letter', () => {
    let q: Quest = testQuest();
    const f = q.furniture[0]!;
    q = good(setFurnitureLetter(q, f.id, 'A'));
    expect(editorLetters(q)).toEqual([
      { letter: 'A', at: [f.cells[0]![0], f.cells[0]![1]], onThing: true },
    ]);
  });
});

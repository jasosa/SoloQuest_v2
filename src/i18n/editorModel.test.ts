import { describe, expect, it } from 'vitest';
import { addNewTexts, areasOf, progressByArea, removeOldTexts, rowsFor } from './editorModel';

const english = {
  'select.new': 'New game',
  'select.turn': 'Turn {turn}',
  'data:monsters.orc': 'Orc',
  'quest:q1:title': 'The Trial',
  'quest:q1:notes.n-A.effects.0.text': 'A door.',
  'quest:q2:title': 'The Rescue',
};
const es = {
  'select.new': 'Nueva partida',
  'select.turn': 'Turno',
  'data:monsters.orc': 'Orc',
  'quest:q1:title': 'La prueba',
  'old.key': 'gone',
};
const all = { area: 'all', filter: 'all', search: '' } as const;

describe('translation editor model', () => {
  it('lists the areas: interface, library, then quests', () => {
    expect(areasOf(english)).toEqual(['interface', 'library', 'q1', 'q2']);
  });
  it('counts a text as done only when it is not empty and not the English words', () => {
    const p = Object.fromEntries(progressByArea(english, es).map((r) => [r.area, r]));
    expect(p.interface).toMatchObject({ total: 2, done: 2 });
    expect(p.library).toMatchObject({ total: 1, done: 0 });
    expect(p.q1).toMatchObject({ total: 2, done: 1 });
    expect(p.q2).toMatchObject({ total: 1, done: 0 });
  });
  it('filters rows by area, state and search', () => {
    expect(rowsFor(english, es, { ...all, area: 'q1' })).toHaveLength(2);
    expect(rowsFor(english, es, { ...all, filter: 'todo', area: 'q1' })).toEqual([
      'quest:q1:notes.n-A.effects.0.text',
    ]);
    expect(rowsFor(english, es, { ...all, filter: 'problems' })).toEqual(['select.turn']);
    expect(rowsFor(english, es, { ...all, search: 'nueva' })).toEqual(['select.new']);
    expect(rowsFor(english, es, { ...all, search: 'RESCUE' })).toEqual(['quest:q2:title']);
    expect(rowsFor(english, es, { ...all, search: 'notes.n-a' })).toHaveLength(1);
  });
  it('adds new texts and removes old ones', () => {
    const added = addNewTexts(english, es);
    expect(added['quest:q2:title']).toBe('The Rescue');
    expect(added['select.new']).toBe('Nueva partida');
    expect(removeOldTexts(english, es)['old.key']).toBeUndefined();
    expect(Object.keys(removeOldTexts(english, es))).toHaveLength(4);
  });
});

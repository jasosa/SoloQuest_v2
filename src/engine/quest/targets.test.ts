import { describe, expect, it } from 'vitest';
import type { Note } from './schema';
import { noteTarget, notesOf } from './targets';

const note = (id: string, extra: Partial<Note>): Note =>
  ({ id, trigger: { type: 'questStart' }, effects: [], ...extra }) as Note;

describe('noteTarget', () => {
  it('derives the element from the trigger', () => {
    expect(noteTarget(note('a', { trigger: { type: 'doorOpened', door: 'd1' } }))).toEqual({
      kind: 'door',
      id: 'd1',
    });
    expect(noteTarget(note('b', { trigger: { type: 'trapSprung', trap: 't1' } }))).toEqual({
      kind: 'trap',
      id: 't1',
    });
    expect(noteTarget(note('c', { trigger: { type: 'monsterKilled', monster: 'm1' } }))).toEqual({
      kind: 'monster',
      id: 'm1',
    });
    expect(noteTarget(note('d', { trigger: { type: 'treasureSearch', area: 'R03' } }))).toEqual({
      kind: 'area',
      id: 'R03',
    });
  });

  it('has no element for quest-wide, square and type-only triggers', () => {
    expect(noteTarget(note('a', {}))).toBeUndefined();
    expect(
      noteTarget(note('b', { trigger: { type: 'squareEntered', cell: [1, 1] } })),
    ).toBeUndefined();
    expect(
      noteTarget(note('c', { trigger: { type: 'monsterKilled', monsterType: 'orc' } })),
    ).toBeUndefined();
    expect(noteTarget(note('d', { trigger: { type: 'manual', label: 'x' } }))).toBeUndefined();
  });

  it('an explicit target wins, so a manual note can belong to an element', () => {
    const n = note('m', {
      trigger: { type: 'manual', label: 'Open the lever' },
      target: { kind: 'furniture', id: 'f-lever' },
    });
    expect(noteTarget(n)).toEqual({ kind: 'furniture', id: 'f-lever' });
    expect(notesOf([n, note('x', {})], 'furniture', 'f-lever').map((x) => x.id)).toEqual(['m']);
  });
});

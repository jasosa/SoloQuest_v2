import { describe, expect, it } from 'vitest';
import type { OrderGroup, TurnProgress } from '../../engine/zargon';
import { displayGroups, leftLabel, progressLabel, tieText } from './zargonView';

const group = (id: string, done: boolean, doneIds: string[] = done ? [id] : []): OrderGroup =>
  ({ key: id, monsters: [id], names: [id], order: {}, doneIds, done }) as unknown as OrderGroup;

describe('zargon page helpers', () => {
  it('moves done entries to the bottom and numbers the rest', () => {
    const out = displayGroups([group('a', true), group('b', false), group('c', false)]);
    expect(out.map((d) => d.group.key)).toEqual(['b', 'c', 'a']);
    expect(out.map((d) => d.number)).toEqual([1, 2, undefined]);
  });

  it('lists the members that are not done', () => {
    const g = { ...group('a', false), monsters: ['a', 'b'], doneIds: ['a'] } as OrderGroup;
    expect(displayGroups([g])[0]?.open).toEqual(['b']);
  });

  it('writes the tie list and the labels', () => {
    expect(tieText(['dwarf', 'elf', 'wizard'])).toBe('Dwarf › Elf › Wizard');
    expect(leftLabel(1)).toBe('1 left');
    expect(leftLabel(2)).toBe('2 left');
    const p = (total: number, remaining: number): TurnProgress => ({
      turn: 1,
      total,
      done: [],
      remaining: Array.from({ length: remaining }, (_, i) => String(i)),
      allDone: remaining === 0,
    });
    expect(progressLabel(p(0, 0))).toBe('no monster to act');
    expect(progressLabel(p(2, 0))).toBe('all monsters done');
    expect(progressLabel(p(3, 1))).toBe('1 monster to act');
    expect(progressLabel(p(3, 3))).toBe('3 monsters to act');
  });
});

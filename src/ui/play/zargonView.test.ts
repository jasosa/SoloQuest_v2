import { describe, expect, it } from 'vitest';
import type { Order, TurnProgress } from '../../engine/zargon';
import { leftLabel, progressLabel, tieText, turnSequence } from './zargonView';

const order = (monster: string, status: Order['status'], done = false): Order =>
  ({ monster, status, done }) as unknown as Order;

describe('zargon turn sequence', () => {
  const orders = [order('a', 'act'), order('b', 'stone'), order('c', 'act'), order('d', 'fresh')];

  it('numbers the acting monsters and starts at the first pending one', () => {
    const s = turnSequence(orders, new Set());
    expect(s.actingTotal).toBe(2);
    expect(s.items.map((i) => i.number)).toEqual([1, undefined, 2, undefined]);
    expect(s.current?.order.monster).toBe('a');
  });

  it('resumes at the first monster not done, and info monsters count once read', () => {
    const s = turnSequence(
      [order('a', 'act', true), order('b', 'stone'), order('c', 'act')],
      new Set(),
    );
    expect(s.current?.order.monster).toBe('b');
    const t = turnSequence(
      [order('a', 'act', true), order('b', 'stone'), order('c', 'act')],
      new Set(['b']),
    );
    expect(t.current?.order.monster).toBe('c');
  });

  it('has no current item when everyone is done (the final dialog)', () => {
    expect(turnSequence([order('a', 'act', true)], new Set()).current).toBeUndefined();
    expect(turnSequence([], new Set()).current).toBeUndefined();
  });
});

describe('labels', () => {
  it('writes the tie list and the counts', () => {
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

import { describe, expect, it } from 'vitest';
import { pickSpell } from './spellPick';

const left = ['a', 'b', 'c', 'd', 'escape'];
const offers = (seed: number, order?: Record<string, number>) => {
  const out: string[] = [];
  for (let i = 0; i < left.length; i++) out.push(pickSpell(seed, 1, 'm', left, out, order)!);
  return out;
};

describe('pickSpell with a spell order', () => {
  it('offers a pinned spell at its place, for every seed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(offers(seed, { escape: 1 })[0]).toBe('escape');
      expect(offers(seed, { escape: 2 })[1]).toBe('escape');
      expect(offers(seed, { escape: 9 })[4]).toBe('escape'); // past the end: last place
    }
  });
  it('never repeats a spell and offers them all', () => {
    for (let seed = 1; seed <= 50; seed++)
      expect([...offers(seed, { a: 2, escape: 1 })].sort()).toEqual([...left].sort());
  });
  it('two spells on one place take the next free one', () => {
    const o = offers(3, { a: 1, b: 1 });
    expect(o.slice(0, 2).sort()).toEqual(['a', 'b']);
  });
  it('without an order it is the seeded shuffle, the same each time', () => {
    expect(offers(7)).toEqual(offers(7));
  });
});

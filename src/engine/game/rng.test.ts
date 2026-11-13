import { describe, expect, it } from 'vitest';
import { createRng, next, nextInt } from './rng';

describe('seeded rng', () => {
  it('is deterministic for a seed', () => {
    const run = (seed: number) => {
      let r = createRng(seed);
      const out: number[] = [];
      for (let i = 0; i < 5; i++) {
        const [v, nr] = next(r);
        out.push(v);
        r = nr;
      }
      return out;
    };
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });

  it('values are in [0, 1) and ints are in range', () => {
    let r = createRng(1);
    for (let i = 0; i < 500; i++) {
      const [v, nr] = nextInt(r, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      expect(Number.isInteger(v)).toBe(true);
      r = nr;
    }
  });

  it('state is a plain number and does not mutate', () => {
    const r = createRng(99);
    const [a] = next(r);
    const [b] = next(r);
    expect(a).toBe(b);
    expect(typeof next(r)[1]).toBe('number');
  });
});

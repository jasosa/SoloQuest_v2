import { describe, expect, it } from 'vitest';
import { needsTurn, tileFor } from './theme';

describe('tileFor', () => {
  it('gives nothing when there are no tiles', () => {
    expect(tileFor([], 3, 4)).toBeUndefined();
  });
  it('always gives the same tile to the same square', () => {
    const tiles = ['a', 'b', 'c', 'd'];
    expect(tileFor(tiles, 5, 7)).toBe(tileFor(tiles, 5, 7));
  });
  it('uses every variant over a board, so the floor does not repeat', () => {
    const tiles = ['a', 'b', 'c', 'd'];
    const used = new Set<string | undefined>();
    for (let y = 0; y < 19; y++) for (let x = 0; x < 26; x++) used.add(tileFor(tiles, x, y));
    expect(used.size).toBe(4);
  });
});

describe('needsTurn', () => {
  const table = { href: 'x', cells: [2, 1] as const };
  it('turns a landscape picture that stands upright on the board', () => {
    expect(needsTurn(table, 1, 2)).toBe(true);
  });
  it('does not turn it when it already fits', () => {
    expect(needsTurn(table, 2, 1)).toBe(false);
  });
  it('never turns square pieces or pictures without a size', () => {
    expect(needsTurn({ href: 'x', cells: [1, 1] }, 1, 2)).toBe(false);
    expect(needsTurn({ href: 'x' }, 1, 2)).toBe(false);
    expect(needsTurn(table, 2, 2)).toBe(false);
  });
});

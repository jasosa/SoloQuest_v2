import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { cornerTurn, isThemeToken, needsTurn, tileFor } from './theme';

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

describe('cornerTurn (stairs)', () => {
  // the stairs of each quest are 2 x 2 squares in a room; the picture's solid corner is the top left
  const stairs = (x: number, y: number) =>
    [
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ] as const;

  it('does not turn stairs that are in the top left corner of their room (quest 1)', () => {
    expect(cornerTurn(board, stairs(1, 14), 'topLeft')).toBe(0);
  });
  it('turns stairs that are in the bottom left corner by 270 degrees (quest 10)', () => {
    expect(cornerTurn(board, stairs(1, 16), 'topLeft')).toBe(270);
  });
  it('does not turn stairs that are not in a corner of their room (quest 2, middle of the centre room)', () => {
    expect(cornerTurn(board, stairs(10, 7), 'topLeft')).toBe(0);
  });
  it('turns by the difference when the picture has another solid corner', () => {
    // a picture whose solid corner is the top right: stairs in the top left need 270 degrees
    expect(cornerTurn(board, stairs(1, 14), 'topRight')).toBe(270);
  });
});

describe('isThemeToken', () => {
  const theme = { id: 't', name: 't', monster: { orc: 'x' } };
  it('is a whole token only when the picture comes from the theme', () => {
    expect(isThemeToken(theme, undefined, 'orc')).toBe(true);
    expect(isThemeToken(theme, 'data:own', 'orc')).toBe(false);
    expect(isThemeToken(theme, undefined, 'goblin')).toBe(false);
  });
});

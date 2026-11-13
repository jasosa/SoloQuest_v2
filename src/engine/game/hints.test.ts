import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { lookHintCells } from './hints';
import { replay } from './reducer';

const level = buildLevel(testQuest());
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const look = (x: number, y: number): GameEvent => ({ type: 'LOOK_FROM', cell: [x, y] });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const keys = (cells: readonly (readonly [number, number])[]) => cells.map((c) => c.join(','));

describe('look hint', () => {
  it('is empty before any corridor square is seen', () => {
    expect(lookHintCells(level, run())).toEqual([]);
  });

  it('points at squares that show more corridor on the printed board', () => {
    const s = run(open('d1'));
    const hint = keys(lookHintCells(level, s));
    expect(hint).toContain('0,18'); // the corridor turns north here
    expect(hint).toContain('1,18'); // sees (0,17) round the corner
    expect(hint).not.toContain('3,18'); // the hero already looked from here
  });

  it('a block the players have seen stops the hint, like it stops sight', () => {
    const hint = keys(lookHintCells(level, run(open('d1'))));
    expect(hint).not.toContain('7,18'); // only the block lies ahead
  });

  it('drops a square once it was looked from', () => {
    const before = keys(lookHintCells(level, run(open('d1'))));
    const after = keys(lookHintCells(level, run(open('d1'), look(0, 18))));
    expect(before).toContain('0,18');
    expect(after).not.toContain('0,18');
  });

  it('ignores rock: it points at squares where rock hides the rest, and leaks nothing', () => {
    // Look from the top-left of the east band: the rock cell (13,0) hides (14,0) and beyond.
    const s = run(
      open('d2'),
      open('d3'),
      open('d4'),
      look(12, 12),
      look(9, 12),
      look(9, 6),
      look(12, 6),
      look(12, 0),
    );
    const hint = keys(lookHintCells(level, s));
    expect(hint).toContain('12,1'); // geometry says (14,0) is in reach; the app will not say why it is not
    expect(hint).not.toContain('12,0'); // looked
    expect(hint).not.toContain('12,14'); // looked (the door open looks from the square beyond)

    // Same state, a level with a different rock layout and an extra unseen block: same hint.
    const other = buildLevel(
      testQuest({
        rock: { rooms: ['R04'], cells: [] },
        blocks: [{ cells: [[8, 18]] }, { cells: [[13, 5]] }],
      }),
    );
    expect(keys(lookHintCells(other, s))).toEqual(hint);
  });
});

import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { isCorner, isCrossing, isEyeSpot, lookEyeCells, lookHintCells } from './hints';
import { replay } from './reducer';

const level = buildLevel(testQuest());
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const look = (x: number, y: number): GameEvent => ({ type: 'LOOK_FROM', cell: [x, y] });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const keys = (cells: readonly (readonly [number, number])[]) => cells.map((c) => c.join(','));

const asciiLevel = (rows: string[]) =>
  ({
    ...level,
    board: {
      width: rows[0]!.length,
      height: rows.length,
      cells: rows.map((r) => [...r].map((ch) => (ch === '.' ? 'C' : 'R01'))),
    },
  }) as typeof level;

describe('corner and crossing shapes (. corridor, # room)', () => {
  it('an L turn is a corner, its ends are not', () => {
    const m = asciiLevel(['#####', '#..##', '#.###', '#####']);
    expect(isCorner(m, [1, 1])).toBe(true);
    expect(isCorner(m, [2, 1])).toBe(false);
    expect(isCorner(m, [1, 2])).toBe(false);
    expect(isCrossing(m, [1, 1])).toBe(false);
  });

  it('a straight corridor has no eye spot', () => {
    const m = asciiLevel(['#####', '#...#', '#####']);
    expect(isEyeSpot(m, [2, 1])).toBe(false);
    const v = asciiLevel(['###', '#.#', '#.#', '#.#', '###']);
    expect(isEyeSpot(v, [1, 2])).toBe(false);
  });

  it('a T and a crossing stay eye spots, and are not corners', () => {
    const t = asciiLevel(['#####', '#...#', '##.##', '#####']);
    expect(isCrossing(t, [2, 1])).toBe(true);
    expect(isCorner(t, [2, 1])).toBe(false);
    expect(isEyeSpot(t, [2, 1])).toBe(true);
    const x = asciiLevel(['##.##', '#...#', '##.##']);
    expect(isCrossing(x, [2, 1])).toBe(true);
    expect(isEyeSpot(x, [2, 1])).toBe(true);
  });
});

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

describe('eye glyphs (owner): crossroads and corners, and beside an occupied one', () => {
  const s = run(open('d2'), open('d3'), open('d4'));
  const can = keys(lookHintCells(level, s));

  it('are a quiet subset of the squares where looking can show more: crossroads and corners', () => {
    const eyes = lookEyeCells(level, s, new Set());
    expect(eyes.length).toBeGreaterThan(0);
    expect(eyes.length).toBeLessThan(can.length);
    for (const c of eyes) {
      expect(can).toContain(c.join(','));
      expect(isEyeSpot(level, c)).toBe(true);
    }
    expect(isCrossing(level, [12, 12])).toBe(true);
    expect(isCrossing(level, [9, 12])).toBe(false);
  });

  it('an occupied crossroads gives its glyph up: not on it, and beside it when that shows more', () => {
    const eyes = lookEyeCells(level, s, new Set());
    const first = eyes[0]!;
    const occupied = new Set([first.join(',')]);
    const after = lookEyeCells(level, s, occupied);
    expect(keys(after)).not.toContain(first.join(','));
    for (const c of after) {
      expect(can).toContain(c.join(','));
      const near = Math.abs(c[0] - first[0]) + Math.abs(c[1] - first[1]) === 1;
      expect(isEyeSpot(level, c) || near).toBe(true);
    }
  });

  it('no eye on a square of a terrain tile (an icy river)', () => {
    const eyes = lookEyeCells(level, s, new Set());
    expect(eyes.length).toBeGreaterThan(0);
    const first = eyes[0]!;
    const quest = testQuest();
    const withRiver = buildLevel({
      ...quest,
      boardTiles: [{ type: 'icyRiver', cells: [[first[0], first[1]]] }],
    });
    const river = replay(withRiver, 1, [open('d2'), open('d3'), open('d4')]);
    expect(keys(lookEyeCells(withRiver, river, new Set()))).not.toContain(first.join(','));
    // the same square keeps its eye when the tile is not terrain (the ice cave entrance)
    const cave = buildLevel({
      ...quest,
      boardTiles: [{ type: 'iceCaveEntrance', cells: [[first[0], first[1]]] }],
    });
    const caveS = replay(cave, 1, [open('d2'), open('d3'), open('d4')]);
    expect(keys(lookEyeCells(cave, caveS, new Set()))).toContain(first.join(','));
  });

  it('an occupied crossroads that cannot look gives no glyph to its neighbors', () => {
    // occupy every seen crossroads square that is not a look square: the glyphs do not change
    const dead = [...s.seenCells].filter(
      (k) => isEyeSpot(level, k.split(',').map(Number) as [number, number]) && !can.includes(k),
    );
    expect(dead.length).toBeGreaterThan(0);
    expect(keys(lookEyeCells(level, s, new Set(dead)))).toEqual(
      keys(lookEyeCells(level, s, new Set())),
    );
  });

  it('a corner shows an eye when looking shows more, and none when it shows nothing more', () => {
    const s1 = run(open('d1'));
    const can1 = keys(lookHintCells(level, s1));
    const eyeKeys = keys(lookEyeCells(level, s1, new Set()));
    const seen = [...s1.seenCells].map((k) => k.split(',').map(Number) as [number, number]);
    const corners = seen.filter((c) => isCorner(level, c));
    const lookable = corners.filter((c) => can1.includes(c.join(',')));
    const mute = corners.filter((c) => !can1.includes(c.join(',')));
    expect(lookable.length).toBeGreaterThan(0);
    expect(mute.length).toBeGreaterThan(0);
    for (const c of lookable) expect(eyeKeys).toContain(c.join(','));
    for (const c of mute) expect(eyeKeys).not.toContain(c.join(','));
    // a straight square never carries an eye
    for (const k of eyeKeys)
      expect(isEyeSpot(level, k.split(',').map(Number) as [number, number])).toBe(true);
  });
});

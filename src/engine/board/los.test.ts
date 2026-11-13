import { describe, expect, it } from 'vitest';
import { asciiSightMap } from './asciiMap';
import { lineOfSight, visibleFrom, type SightMap } from './los';
import { createRng, nextInt } from '../game/rng';

type P = [number, number];

/** Asserts symmetry (a sees b iff b sees a) and returns the answer. */
const sees = (m: SightMap, a: P, b: P) => {
  const ab = lineOfSight(m, a, b);
  expect(lineOfSight(m, b, a), `symmetry ${a} <-> ${b}`).toBe(ab);
  return ab;
};

describe('line of sight on ASCII maps', () => {
  it('sees along an open row, and sees itself', () => {
    const m = asciiSightMap(['#########', '#.......#', '#########']);
    expect(m.width).toBe(4);
    expect(sees(m, [0, 0], [3, 0])).toBe(true);
    expect(lineOfSight(m, [2, 0], [2, 0])).toBe(true);
  });

  it('a wall between two squares blocks', () => {
    const m = asciiSightMap(['#####', '#.#.#', '#####']);
    expect(sees(m, [0, 0], [1, 0])).toBe(false);
  });

  it('a closed door blocks, an open door lets sight through', () => {
    const closed = asciiSightMap(['#####', '#.D.#', '#####']);
    const open = asciiSightMap(['#####', '#.d.#', '#####']);
    expect(sees(closed, [0, 0], [1, 0])).toBe(false);
    expect(sees(open, [0, 0], [1, 0])).toBe(true);
  });

  it('a blocked square is seen, nothing behind it is', () => {
    // cells: floor, BLOCK, floor
    const m = asciiSightMap(['#######', '#..B..#', '#######']);
    expect(m.cellKind(1, 0)).toBe('block');
    expect(sees(m, [0, 0], [1, 0])).toBe(true);
    expect(sees(m, [0, 0], [2, 0])).toBe(false);
  });

  it('rock is never seen and blocks sight', () => {
    // cells: floor, ROCK, floor
    const m = asciiSightMap(['#######', '#..R..#', '#######']);
    expect(m.cellKind(1, 0)).toBe('rock');
    expect(sees(m, [0, 0], [1, 0])).toBe(false);
    expect(sees(m, [0, 0], [2, 0])).toBe(false);
  });

  it('a blocked square does not stop a diagonal line that goes round it', () => {
    // (0,0) floor, (1,0) BLOCK / (0,1), (1,1) floor
    const m = asciiSightMap(['#####', '#..B#', '#...#', '#...#', '#####']);
    expect(sees(m, [0, 0], [1, 1])).toBe(true); // via (0,1)
    const both = asciiSightMap(['#####', '#..B#', '###.#', '#...#', '#####']);
    // via (1,0) is a block, via (0,1) the edge is a wall
    expect(sees(both, [0, 0], [1, 1])).toBe(false);
  });

  it('corner rule: touching a corner still sees, either way round is enough', () => {
    //  (0,0) # (1,0)      wall between them
    //  (0,1) d (1,1)      open door between them
    const m = asciiSightMap(['#####', '#.#.#', '#...#', '#.d.#', '#####']);
    expect(sees(m, [0, 0], [1, 1])).toBe(true); // round the corner via (0,1)
    expect(sees(m, [1, 0], [0, 1])).toBe(true); // other diagonal, via (1,1)
  });

  it('corner rule: both ways round closed means no sight', () => {
    const m = asciiSightMap(['#####', '#.#.#', '#.#.#', '#.D.#', '#####']);
    expect(sees(m, [0, 0], [1, 1])).toBe(false);
    expect(sees(m, [1, 0], [0, 1])).toBe(false);
  });

  it('corner rule: one open route is enough, whichever it is', () => {
    // via (1,0): both edges open. via (0,1): the edge (0,0)|(0,1) is a wall.
    const m = asciiSightMap(['#####', '#...#', '###.#', '#...#', '#####']);
    expect(sees(m, [0, 0], [1, 1])).toBe(true);
    expect(sees(m, [1, 0], [0, 1])).toBe(true);
  });

  it('corner through an open door in a wall (room left, corridor right)', () => {
    const rows = [
      '#########',
      '#...#...#', // row 0: wall between x1 and x2
      '#.......#', // vertical edges open
      '#...d...#', // row 1: door between x1 and x2
      '#########',
    ];
    const open = asciiSightMap(rows);
    expect(open.width).toBe(4);
    expect(sees(open, [1, 0], [2, 1])).toBe(true); // touches the corner of the door frame
    expect(sees(open, [1, 1], [2, 0])).toBe(true);
    expect(sees(open, [1, 0], [2, 0])).toBe(false); // straight through the wall
    const closed = asciiSightMap(rows.map((r) => r.replace('d', 'D')));
    expect(sees(closed, [1, 0], [2, 1])).toBe(false);
    expect(sees(closed, [1, 1], [2, 0])).toBe(false);
  });

  it('follows the exact line, not any route (knight move)', () => {
    // (0,0) -> (2,1) goes (1,0) then (1,1). A wall between (1,0) and (1,1) blocks it,
    // even though another route exists.
    const blocked = asciiSightMap(['#######', '#.....#', '#..#..#', '#.....#', '#######']);
    expect(sees(blocked, [0, 0], [2, 1])).toBe(false);
    const open = asciiSightMap(['#######', '#.....#', '#.....#', '#.....#', '#######']);
    expect(sees(open, [0, 0], [2, 1])).toBe(true);
  });

  it('long slope through an exact corner (4 x 2)', () => {
    // (0,0) -> (3,1) passes the corner between (1,0), (2,0), (1,1), (2,1).
    const clear = asciiSightMap(['#########', '#.......#', '#.......#', '#...#...#', '#########']);
    expect(sees(clear, [0, 0], [3, 1])).toBe(true); // wall (1,1)|(2,1) is not on the line
    const shut = asciiSightMap(['#########', '#...#...#', '#.......#', '#...#...#', '#########']);
    expect(sees(shut, [0, 0], [3, 1])).toBe(false); // both ways round the corner closed
  });

  it('visibleFrom lists the squares that can be seen', () => {
    const walled = asciiSightMap(['#######', '#.#.#.#', '#######']);
    expect(visibleFrom(walled, [0, 0])).toEqual([[0, 0]]);
    const mixed = asciiSightMap(['#######', '#.d.#R#', '#######']);
    // cells: 0 floor, 1 floor (open door), 2 rock
    expect(visibleFrom(mixed, [0, 0])).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it('is symmetric on many generated maps', () => {
    let rng = createRng(12345);
    const roll = (n: number) => {
      const [v, next] = nextInt(rng, n);
      rng = next;
      return v;
    };
    const W = 6;
    const H = 5;
    for (let round = 0; round < 40; round++) {
      const rows: string[] = [];
      for (let r = 0; r < 2 * H + 1; r++) {
        let line = '';
        for (let c = 0; c < 2 * W + 1; c++) {
          const cellRow = r % 2 === 1;
          const cellCol = c % 2 === 1;
          if (cellRow && cellCol) {
            const v = roll(12);
            line += v === 0 ? 'B' : v === 1 ? 'R' : '.';
          } else if (!cellRow && !cellCol) line += '#';
          else {
            const v = roll(10);
            line += v < 2 ? '#' : v === 2 ? 'D' : v === 3 ? 'd' : '.';
          }
        }
        rows.push(line);
      }
      const m = asciiSightMap(rows);
      for (let a = 0; a < W * H; a++)
        for (let b = a + 1; b < W * H; b++) {
          const pa: P = [a % W, Math.floor(a / W)];
          const pb: P = [b % W, Math.floor(b / W)];
          expect(lineOfSight(m, pa, pb), `round ${round}: ${pa} ${pb}`).toBe(
            lineOfSight(m, pb, pa),
          );
        }
    }
  });
});

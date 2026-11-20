import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { pictureTypeOf } from '../data/enemies';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { EventError, reduce, replay } from './reducer';
import { boardTilesInView, tunnelsInView } from './view';

// Two ice tunnels on the bottom corridor (y 18): design 1 at (4,18) and (20,18), seen from door d1.
const make = (patch: Record<string, unknown> = {}) =>
  parseQuest({
    ...testQuestData,
    blocks: [],
    tunnels: [{ id: 't1', design: 1, a: [4, 18], b: [20, 18] }],
    ...patch,
  });
const lv = buildLevel(make());
const open = [{ type: 'OPEN_DOOR', door: 'd1' } as const];
const use = (from: 'a' | 'b') => ({ type: 'TUNNEL_USE', tunnel: 't1', from }) as const;
const problems = (patch: Record<string, unknown>) => validateQuest(make(patch), board).join(' | ');

describe('ice tunnels', () => {
  it('both ends show once their squares are seen', () => {
    expect(tunnelsInView(lv, replay(lv, 1, [])).length).toBe(0);
    const s = replay(lv, 1, open);
    expect(tunnelsInView(lv, s).map((e) => `${e.tunnel}:${e.end}:${e.design}`)).toEqual([
      't1:a:1',
      't1:b:1',
    ]);
  });

  it('using one comes out at the other end and shows what is in sight there', () => {
    // from a corridor square the heroes cannot see, a use shows the other side too
    const far = buildLevel(make({ tunnels: [{ id: 't1', design: 1, a: [4, 18], b: [20, 18] }] }));
    const s = replay(far, 1, [...open, use('a')]);
    expect(s.looked.has('20,18')).toBe(true);
    const r = reduce(far, replay(far, 1, open), use('b'));
    expect(r.prompts[0]).toEqual({ kind: 'tunnelUsed', tunnel: 't1', design: 1, to: [4, 18] });
    expect(r.state.looked.has('4,18')).toBe(true);
  });

  it('an end that was not seen cannot be used, and an unknown tunnel is refused', () => {
    expect(() => replay(lv, 1, [use('a')])).toThrow(EventError);
    expect(() => replay(lv, 1, [...open, { type: 'TUNNEL_USE', tunnel: 'zz', from: 'a' }])).toThrow(
      /Unknown tunnel/,
    );
  });

  it('the validator wants two squares, one pair per design, on bare floor', () => {
    expect(problems({})).toBe('');
    expect(problems({ tunnels: [{ id: 't1', design: 1, a: [4, 18], b: [4, 18] }] })).toMatch(
      /both ends are the same square/,
    );
    expect(
      problems({
        tunnels: [
          { id: 't1', design: 1, a: [4, 18], b: [20, 18] },
          { id: 't2', design: 1, a: [5, 18], b: [21, 18] },
        ],
      }),
    ).toMatch(/design 1 is used by another tunnel/);
    expect(problems({ tunnels: [{ id: 't1', design: 1, a: [4, 18], b: [13, 0] }] })).toMatch(
      /rock|outside|not/i,
    );
  });
});

describe('board tiles', () => {
  const cave = {
    type: 'iceCaveEntrance',
    cells: [
      [0, 7],
      [1, 7],
    ],
  };
  it('the cave shows from the start, a ledge when a square of it is seen', () => {
    const ledge = {
      type: 'iceLedge',
      cells: [
        [6, 15],
        [6, 16],
      ],
    };
    const l = buildLevel(make({ boardTiles: [cave, ledge] }));
    expect(boardTilesInView(l, replay(l, 1, [])).map((t) => t.type)).toEqual(['iceCaveEntrance']);
    const seen = replay(l, 1, [
      { type: 'OPEN_DOOR', door: 'd1' },
      { type: 'OPEN_DOOR', door: 'd2' },
    ]);
    expect(boardTilesInView(l, seen).map((t) => t.type)).toEqual(['iceCaveEntrance', 'iceLedge']);
  });

  it('every square must be on the board', () => {
    expect(problems({ boardTiles: [{ type: 'iceLedge', cells: [[40, 2]] }] })).toMatch(
      /outside the board|board/i,
    );
  });
});

describe('texture packs and enemies of their own kind', () => {
  it('an enemy with no base type has no core picture; one with a base keeps its type', () => {
    const enemies = [
      { id: 'own', name: 'Own', overrides: { move: 4, att: 2, def: 1, body: 6, mind: 0 } },
      { id: 'based', name: 'Based', base: 'goblin' },
    ] as never;
    expect(pictureTypeOf({ type: 'goblin', enemy: 'own' }, enemies)).toBeUndefined();
    expect(pictureTypeOf({ type: 'goblin', enemy: 'based' }, enemies)).toBe('goblin');
    expect(pictureTypeOf({ type: 'orc' }, enemies)).toBe('orc');
  });
});

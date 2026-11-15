import { describe, expect, it } from 'vitest';
import { board, cellsOf } from '../board/board';
import { footprintShapeProblem } from './footprint';
import { testQuest } from './testQuest';
import { validateQuestIssues } from './validate';

const issuesOf = (q: ReturnType<typeof testQuest>) => validateQuestIssues(q, board);
const unreachable = (q: ReturnType<typeof testQuest>) =>
  issuesOf(q).filter((i) => i.message.includes('cannot be reached'));

/*
 * Test quest layout used below (rooms only, # wall, letters are doors between neighbours):
 *
 *   R20 --d2-- R17 --d3-- R18 --d4-- corridor
 *    |          \_____s1____/
 *   d1 -- bottom corridor
 */
describe('editor check: furniture footprint', () => {
  const chest = (cells: [number, number][]) =>
    testQuest({ furniture: [{ id: 'f1', type: 'chest', cells }], traps: [] });
  const bad = (q: ReturnType<typeof testQuest>) =>
    issuesOf(q).filter((i) => i.ref?.kind === 'furniture' && i.severity === 'error');

  it('accepts a piece inside one room with touching squares', () => {
    expect(
      bad(
        chest([
          [6, 14],
          [7, 14],
        ]),
      ),
    ).toEqual([]);
  });

  it('rejects a piece in the corridor', () => {
    const [cell] = cellsOf(board, 'C') as [number, number][];
    const hits = bad(chest([cell!]));
    expect(hits).toHaveLength(1);
    expect(hits[0]!.message).toContain('not in the corridor');
    expect(hits[0]!.ref).toEqual({ kind: 'furniture', id: 'f1', cell });
  });

  it('rejects a piece that crosses a wall', () => {
    // (4,15) is in R20, (5,15) in R17: the door d2 edge.
    const hits = bad(
      chest([
        [4, 15],
        [5, 15],
      ]),
    );
    expect(hits.map((h) => h.message).join()).toContain('crosses a wall');
  });

  it('rejects squares that do not touch', () => {
    const hits = bad(
      chest([
        [6, 14],
        [7, 16],
      ]),
    );
    expect(hits.map((h) => h.message).join()).toContain('must touch');
  });

  it('does not report rock twice (the rock check already does)', () => {
    const rockCell = cellsOf(board, 'R04')[0] as [number, number];
    const hits = bad(chest([rockCell]));
    expect(hits).toHaveLength(1);
    expect(hits[0]!.message).toContain('in rock');
  });

  it('shares the helper with the editor', () => {
    expect(footprintShapeProblem(board, [[6, 14]], 'Furniture')).toBeUndefined();
    expect(footprintShapeProblem(board, [], 'Stairs')).toContain('at least one');
  });
});

describe('editor check: unreachable areas', () => {
  it('the test quest is fully reachable (secret and false doors count)', () => {
    expect(unreachable(testQuest())).toEqual([]);
  });

  it('warns for rooms with content that no door connects to the start room', () => {
    // Only d1 is left: R20 <-> bottom corridor. R17 and R18 are cut off.
    const q = testQuest({
      doors: [{ id: 'd1', a: [3, 17], b: [3, 18] }],
      secretDoors: [],
      falseDoors: [],
    });
    const hits = unreachable(q);
    expect(hits.map((h) => h.ref)).toEqual([
      { kind: 'area', area: 'R17' },
      { kind: 'area', area: 'R18' },
    ]);
    expect(hits.every((h) => h.severity === 'warning')).toBe(true);
  });

  it('a secret door is enough to reach a room', () => {
    // R20 -d2-> R17 -s1-> R18 (d3 and d4 removed).
    const q = testQuest({
      doors: [{ id: 'd2', a: [4, 15], b: [5, 15] }],
      falseDoors: [],
    });
    expect(unreachable(q)).toEqual([]);
  });

  it('a block in the only doorway cuts the room off', () => {
    const q = testQuest({
      doors: [{ id: 'd2', a: [4, 15], b: [5, 15] }],
      secretDoors: [],
      falseDoors: [],
      blocks: [{ cells: [[5, 15]] }],
    });
    expect(unreachable(q).map((h) => h.ref)).toEqual([
      { kind: 'area', area: 'R17' },
      { kind: 'area', area: 'R18' },
    ]);
  });

  it('ignores empty rooms and not-editor mode', () => {
    const q = testQuest({
      doors: [{ id: 'd1', a: [3, 17], b: [3, 18] }],
      secretDoors: [],
      falseDoors: [],
    });
    expect(
      validateQuestIssues(q, board, { editor: false }).some((i) => i.severity === 'warning'),
    ).toBe(false);
  });
});

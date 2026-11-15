import { describe, expect, it } from 'vitest';
import { board, cellsOf } from '../board/board';
import { footprintShapeProblem } from './footprint';
import { testQuest, testQuestData } from './testQuest';
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
  it('the test quest is fully reachable (secret doors count)', () => {
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

describe('reachability: false doors', () => {
  it('a false door never opens, so a room behind it is unreachable', () => {
    // Only d1 and the false door x1 (R20 | R12) are left.
    const q = testQuest({
      doors: [{ id: 'd1', a: [3, 17], b: [3, 18] }],
      secretDoors: [],
    });
    expect(unreachable(q).map((h) => h.ref)).toContainEqual({ kind: 'area', area: 'R12' });
  });
  it('a normal door at the same edge makes it reachable', () => {
    const q = testQuest({
      doors: [
        { id: 'd1', a: [3, 17], b: [3, 18] },
        { id: 'd9', a: [1, 14], b: [1, 13] },
      ],
      secretDoors: [],
      falseDoors: [],
    });
    expect(unreachable(q).map((h) => h.ref)).not.toContainEqual({ kind: 'area', area: 'R12' });
  });
});

describe('editor check: redundant rock cells', () => {
  it('warns for a rock cell inside a rock room', () => {
    // R04 is rock; (14,1) is a cell of R04.
    const q = testQuest({
      rock: {
        rooms: ['R04'],
        cells: [
          [13, 0],
          [14, 1],
        ],
      },
    });
    const hits = issuesOf(q).filter((i) => i.message.includes('already rock'));
    expect(hits).toHaveLength(1);
    expect(hits[0]!.severity).toBe('warning');
    expect(validateQuestIssues(q, board, { editor: false })).toEqual([]);
  });
  it('no warning for a rock cell outside rock rooms', () => {
    expect(issuesOf(testQuest()).filter((i) => i.message.includes('already rock'))).toEqual([]);
  });
});

describe('stacking rules in the validator', () => {
  const npc = { id: 'n1', name: 'Ragnar', cell: [7, 15], defend: 2, body: 4, text: 'Escort.' };
  const errors = (q: ReturnType<typeof testQuest>) =>
    validateQuestIssues(q, board, { editor: false }).map((i) => i.message);

  it('accepts a trap on a monster square and a chest trap on its chest', () => {
    const q = testQuest({
      traps: [
        { id: 't1', kind: 'pit', cell: [6, 15] },
        { id: 't2', kind: 'chest', furniture: 'f1' },
      ],
    });
    expect(errors(q)).toEqual([]);
  });
  it('rejects a monster on an NPC square', () => {
    const q = testQuest({ npcs: [{ ...npc, cell: [6, 15] }] });
    expect(errors(q)).toContain('monster m1: cell 6,15 is on npc n1');
  });
  it('rejects a trap on stairs, a door square or an NPC', () => {
    const stairs = {
      id: 's',
      type: 'stairs',
      cells: [
        [1, 15],
        [2, 15],
      ],
    };
    const f = testQuestData.furniture;
    const onStairs = testQuest({
      furniture: [...f, stairs],
      traps: [{ id: 't9', kind: 'pit', cell: [1, 15] }],
    });
    expect(errors(onStairs).join('\n')).toMatch(/trap t9: cell 1,15 is on the stairs/);
    const onDoor = testQuest({ traps: [{ id: 't9', kind: 'pit', cell: [5, 15] }] });
    expect(errors(onDoor).join('\n')).toMatch(/trap t9: cell 5,15 is on a door square \(door d2\)/);
    const onNpc = testQuest({ npcs: [npc], traps: [{ id: 't9', kind: 'pit', cell: [7, 15] }] });
    expect(errors(onNpc).join('\n')).toMatch(/trap t9: cell 7,15 is on an NPC/);
  });
  it('rejects two monsters or two traps on one square', () => {
    const twoM = testQuest({
      monsters: [
        { id: 'a', type: 'orc', cell: [6, 15] },
        { id: 'b', type: 'orc', cell: [6, 15] },
      ],
      notes: [],
      traps: [],
    });
    expect(errors(twoM).join('\n')).toMatch(/monster b: cell 6,15 is already used by monster a/);
    const twoT = testQuest({
      traps: [
        { id: 'a', kind: 'pit', cell: [7, 16] },
        { id: 'b', kind: 'pit', cell: [7, 16] },
      ],
    });
    expect(errors(twoT).join('\n')).toMatch(/trap b: same cell as trap a/);
  });
});

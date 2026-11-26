import { describe, expect, it } from 'vitest';
import {
  addAreaMerge,
  addDoor,
  emptyQuest,
  setRockCell,
  type EditResult,
} from '../../engine/editor';
import { board } from '../../engine/board/board';
import type { Quest } from '../../engine/quest/schema';
import {
  NO_PICK,
  doorOnMergeWall,
  mainOf,
  mergeTrial,
  outlineSegments,
  roomAtCell,
  tapRoom,
} from './mergePick';

const blank = () => emptyQuest({ id: 'u', number: 1, title: 'T' });
const good = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};

/*
 * Board excerpt (x 4..8, y 10..13), one letter per room:
 *
 *   x:  4 5 6 7 8
 *   y10 . 3 3 4 4      3 = R13, 4 = R14
 *   y11 . 3 3 4 4
 *   y12 . 3 3 4 4
 *   y13 . 7 7 7 7      7 = R17
 *
 * R13 | R14 share the wall x6|x7. R05 is far from R13.
 */
describe('the room under a square', () => {
  it('gives the room of a square, and nothing for the corridor, rock or off the board', () => {
    const q = blank();
    expect(roomAtCell(q, [5, 11])).toBe('R13');
    expect(roomAtCell(q, [7, 11])).toBe('R14');
    const y = board.cells.findIndex((row) => row.includes('C'));
    expect(roomAtCell(q, [board.cells[y]!.indexOf('C'), y])).toBeNull(); // corridor
    expect(roomAtCell(q, [99, 99])).toBeNull();
    const rocky = good(setRockCell(q, [5, 11], true));
    expect(roomAtCell(rocky, [5, 11])).toBeNull();
    expect(roomAtCell(rocky, [6, 11])).toBe('R13');
  });
});

describe('taps on rooms', () => {
  it('the first room stays, the second joins', () => {
    const q = blank();
    const one = tapRoom(q, NO_PICK, 'R13');
    expect(one).toEqual({ pick: { a: 'R13', b: null }, error: null });
    const two = tapRoom(q, one.pick, 'R14');
    expect(two.pick).toEqual({ a: 'R13', b: 'R14' });
    // a third room replaces the joining one
    expect(tapRoom(q, two.pick, 'R17').pick).toEqual({ a: 'R13', b: 'R17' });
  });

  it('a tap on a picked room takes it out of its slot; the next tap fills the first free slot', () => {
    const q = blank();
    const both = { a: 'R13', b: 'R14' };
    expect(tapRoom(q, both, 'R13').pick).toEqual({ a: null, b: 'R14' });
    expect(tapRoom(q, both, 'R14').pick).toEqual({ a: 'R13', b: null });
    expect(tapRoom(q, { a: null, b: 'R14' }, 'R17').pick).toEqual({ a: 'R17', b: 'R14' });
  });

  it('a tap on nothing does nothing and says nothing', () => {
    const q = blank();
    const p = { a: 'R13', b: null };
    expect(tapRoom(q, p, null)).toEqual({ pick: p, error: null });
  });

  it('a room merged away is refused with its main room named', () => {
    const q = good(addAreaMerge(blank(), 'R13', 'R14'));
    expect(mainOf(q, 'R14')).toBe('R13');
    const r = tapRoom(q, NO_PICK, 'R14');
    expect(r.pick).toBe(NO_PICK);
    expect(r.error).toBe('R14 is part of R13. Split it first.');
  });

  it('a room that others joined can stay (a chain) but cannot join another room', () => {
    const q = good(addAreaMerge(blank(), 'R13', 'R14'));
    expect(tapRoom(q, NO_PICK, 'R13').pick).toEqual({ a: 'R13', b: null });
    const r = tapRoom(q, { a: 'R17', b: null }, 'R13');
    expect(r.pick).toEqual({ a: 'R17', b: null });
    expect(r.error).toBe('R13 has rooms merged into it. Split them first.');
  });
});

describe('can the pair be merged', () => {
  it('empty, partial, ready and blocked', () => {
    const q = blank();
    expect(mergeTrial(q, NO_PICK).state).toBe('empty');
    expect(mergeTrial(q, { a: 'R13', b: null }).state).toBe('partial');
    expect(mergeTrial(q, { a: 'R13', b: 'R14' })).toEqual({ state: 'ready', error: null });
    const apart = mergeTrial(q, { a: 'R13', b: 'R05' });
    expect(apart.state).toBe('blocked');
    expect(apart.error).toBe('Cannot merge: the rooms do not touch');
  });

  it('[proposal] a door on the wall blocks, and the door is found for the ring', () => {
    const q = good(addDoor(blank(), [6, 11], [7, 11]));
    const t = mergeTrial(q, { a: 'R13', b: 'R14' });
    expect(t.state).toBe('blocked');
    expect(t.error).toBe('Cannot merge: door d1 is on the wall between them. Remove it first.');
    expect(doorOnMergeWall(q, { a: 'R13', b: 'R14' })).toEqual({
      id: 'd1',
      a: [6, 11],
      b: [7, 11],
    });
    expect(doorOnMergeWall(q, { a: 'R13', b: 'R17' })).toBeUndefined();
    expect(doorOnMergeWall(q, { a: 'R13', b: null })).toBeUndefined();
  });
});

describe('the outline of a room', () => {
  it('a 2 x 1 room has six sides; an L has eight', () => {
    const two = new Set(['0,0', '1,0']);
    expect(outlineSegments(3, 3, (x, y) => two.has(`${x},${y}`))).toHaveLength(6);
    const l = new Set(['0,0', '0,1', '1,1']);
    expect(outlineSegments(3, 3, (x, y) => l.has(`${x},${y}`))).toHaveLength(8);
  });

  it('the edge of the board counts as outside', () => {
    expect(outlineSegments(1, 1, () => true)).toHaveLength(4);
  });
});

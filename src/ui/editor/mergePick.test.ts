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
  it('the first room stays, every further room joins', () => {
    const q = blank();
    const one = tapRoom(q, NO_PICK, 'R13');
    expect(one).toEqual({ pick: { a: 'R13', joins: [] }, error: null });
    const two = tapRoom(q, one.pick, 'R14');
    expect(two.pick).toEqual({ a: 'R13', joins: ['R14'] });
    // a third room joins too, in the order tapped
    expect(tapRoom(q, two.pick, 'R17').pick).toEqual({ a: 'R13', joins: ['R14', 'R17'] });
  });

  it('a tap on a picked room takes it out; the next tap fills the empty Stays slot first', () => {
    const q = blank();
    const all = { a: 'R13', joins: ['R14', 'R17'] };
    expect(tapRoom(q, all, 'R13').pick).toEqual({ a: null, joins: ['R14', 'R17'] });
    expect(tapRoom(q, all, 'R14').pick).toEqual({ a: 'R13', joins: ['R17'] });
    expect(tapRoom(q, { a: null, joins: ['R14'] }, 'R17').pick).toEqual({
      a: 'R17',
      joins: ['R14'],
    });
  });

  it('a tap on nothing does nothing and says nothing', () => {
    const q = blank();
    const p = { a: 'R13', joins: [] };
    expect(tapRoom(q, p, null)).toEqual({ pick: p, error: null });
  });

  it('a tap on a room merged away does nothing and says nothing, like a corridor (decision 108)', () => {
    const q = good(addAreaMerge(blank(), 'R13', 'R14'));
    expect(mainOf(q, 'R14')).toBe('R13');
    const p = { a: 'R17', joins: [] };
    const r = tapRoom(q, p, 'R14');
    expect(r.pick).toBe(p);
    expect(r.error).toBeNull();
  });

  it('a room that others joined can stay (a chain) but cannot join another room', () => {
    const q = good(addAreaMerge(blank(), 'R13', 'R14'));
    expect(tapRoom(q, NO_PICK, 'R13').pick).toEqual({ a: 'R13', joins: [] });
    const r = tapRoom(q, { a: 'R17', joins: [] }, 'R13');
    expect(r.pick).toEqual({ a: 'R17', joins: [] });
    expect(r.error).toBe('R13 has rooms merged into it. Split them first.');
  });
});

describe('can the picked rooms be merged', () => {
  it('empty, partial, ready and blocked', () => {
    const q = blank();
    expect(mergeTrial(q, NO_PICK).state).toBe('empty');
    expect(mergeTrial(q, { a: 'R13', joins: [] }).state).toBe('partial');
    expect(mergeTrial(q, { a: null, joins: ['R14'] }).state).toBe('partial');
    expect(mergeTrial(q, { a: 'R13', joins: ['R14'] })).toEqual({ state: 'ready', error: null });
    const apart = mergeTrial(q, { a: 'R13', joins: ['R05'] });
    expect(apart.state).toBe('blocked');
    expect(apart.error).toBe('Cannot merge R05: the rooms do not touch');
  });

  it('three rooms: ready when each touches the main room or a picked room; one apart names it', () => {
    const q = blank();
    expect(mergeTrial(q, { a: 'R13', joins: ['R14', 'R17'] }).state).toBe('ready');
    const bad = mergeTrial(q, { a: 'R13', joins: ['R14', 'R05'] });
    expect(bad.state).toBe('blocked');
    expect(bad.error).toBe('Cannot merge R05: the rooms do not touch');
  });

  it('[proposal] a door on the wall blocks, and the door is found for the ring', () => {
    const q = good(addDoor(blank(), [6, 11], [7, 11]));
    const t = mergeTrial(q, { a: 'R13', joins: ['R14'] });
    expect(t.state).toBe('blocked');
    expect(t.error).toBe('Cannot merge R14: door d1 is on the wall between them. Remove it first.');
    expect(doorOnMergeWall(q, { a: 'R13', joins: ['R14'] })).toEqual({
      id: 'd1',
      a: [6, 11],
      b: [7, 11],
    });
    expect(doorOnMergeWall(q, { a: 'R13', joins: ['R17'] })).toBeUndefined();
    expect(doorOnMergeWall(q, { a: 'R13', joins: [] })).toBeUndefined();
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

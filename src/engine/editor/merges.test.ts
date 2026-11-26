import { board } from '../board/board';
import { validateQuestIssues } from '../quest/validate';
import { testMapsQuest } from '../quest/testMaps';
import { swapTo } from './maps';
import { describe, expect, it } from 'vitest';
import { emptyQuest, addDoor, type EditResult } from './ops';
import { addAreaMerge, removeAreaMerge } from './merges';
import type { Quest } from '../quest/schema';

const blank = () => emptyQuest({ id: 'u', number: 1, title: 'T' });
const ok = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};
const error = (r: EditResult): string => {
  if (r.ok) throw new Error('expected a refusal');
  return r.error;
};

/*
 * Board excerpt (x 4..8, y 10..13). Rooms only, one letter per room:
 *
 *   x:  4 5 6 7 8
 *   y10 . 3 3 4 4      3 = R13, 4 = R14
 *   y11 . 3 3 4 4
 *   y12 . 3 3 4 4
 *   y13 . 7 7 7 7      7 = R17
 *
 * R13 | R14 share the wall x6|x7 (y 10..12). R13 over R17 share y12|y13 (x 5..6).
 */
describe('addAreaMerge and doors [proposal]', () => {
  it('[proposal] refuses while a door is on the wall between the rooms', () => {
    const q = ok(addDoor(blank(), [6, 11], [7, 11]));
    expect(q.doors[0]?.id).toBe('d1');
    expect(error(addAreaMerge(q, 'R13', 'R14'))).toBe(
      'Cannot merge: door d1 is on the wall between them. Remove it first.',
    );
  });
  it('[proposal] a secret door and a false door refuse too, with their ids', () => {
    const secret = ok(addDoor(blank(), [6, 10], [7, 10], 'secret'));
    expect(error(addAreaMerge(secret, 'R13', 'R14'))).toContain('door s1 is on the wall');
    const fake = ok(addDoor(blank(), [6, 12], [7, 12], 'false'));
    expect(error(addAreaMerge(fake, 'R14', 'R13'))).toContain('door x1 is on the wall');
  });
  it('[proposal] merges when the door is on another wall of the rooms', () => {
    // door R13 | R17 (y12|y13), merging R13 with R14 is fine
    const q = ok(addDoor(blank(), [5, 12], [5, 13]));
    expect(ok(addAreaMerge(q, 'R13', 'R14')).areaOverrides).toEqual([{ merge: ['R13', 'R14'] }]);
  });
  it('[proposal] merges after the door is removed (no door, no refusal)', () => {
    expect(ok(addAreaMerge(blank(), 'R13', 'R14')).areaOverrides).toHaveLength(1);
  });
  it('[proposal] a chain: the main room with its absorbed rooms counts', () => {
    // R13+R14 are one room; a door R14 | R17 (y12|y13, x7) is on the wall to R17
    const merged = ok(addAreaMerge(blank(), 'R13', 'R14'));
    const withDoor = { ...merged, doors: [{ id: 'd1', a: [7, 12], b: [7, 13] }] } as Quest;
    expect(error(addAreaMerge(withDoor, 'R13', 'R17'))).toBe(
      'Cannot merge: door d1 is on the wall between them. Remove it first.',
    );
    // Split first, door stays: R13 alone with R17 has no door on its wall (R14 is split off)
    const split = ok(removeAreaMerge(withDoor, 'R14'));
    expect(ok(addAreaMerge(split, 'R13', 'R17')).areaOverrides).toEqual([
      { merge: ['R13', 'R17'] },
    ]);
  });
  it('keeps the four existing refusal sentences', () => {
    expect(error(addAreaMerge(blank(), 'R13', 'R13'))).toBe(
      'Cannot merge: a room cannot merge with itself',
    );
    expect(error(addAreaMerge(blank(), 'R13', 'R99'))).toBe('Cannot merge: unknown room');
    expect(error(addAreaMerge(blank(), 'R13', 'R05'))).toBe('Cannot merge: the rooms do not touch');
    const m = ok(addAreaMerge(blank(), 'R13', 'R14'));
    expect(error(addAreaMerge(m, 'R14', 'R17'))).toBe(
      'Cannot merge: a room that was merged into another cannot be merged again',
    );
  });
});

describe('addDoor on merged rooms [proposal]', () => {
  const merged = () => ok(addAreaMerge(blank(), 'R13', 'R14'));
  it('[proposal] refuses a door on the wall inside a merged room', () => {
    expect(error(addDoor(merged(), [6, 11], [7, 11]))).toBe(
      'Cannot add a door: R13 and R14 are one room. Split them first.',
    );
    // the order of the two squares does not matter
    expect(error(addDoor(merged(), [7, 11], [6, 11], 'secret'))).toBe(
      'Cannot add a door: R13 and R14 are one room. Split them first.',
    );
    expect(error(addDoor(merged(), [6, 10], [7, 10], 'false'))).toContain('one room');
  });
  it('[proposal] a chain names the two rooms of the wall', () => {
    // R13 + R14 + R17: a door R14 | R17 (y12|y13, x7) is inside the chain
    const chain = ok(addAreaMerge(merged(), 'R13', 'R17'));
    expect(error(addDoor(chain, [7, 12], [7, 13]))).toBe(
      'Cannot add a door: R14 and R17 are one room. Split them first.',
    );
  });
  it('[proposal] a door on another wall of the merged room still works', () => {
    // R13 | R17 are not merged here, only R13 + R14
    expect(ok(addDoor(merged(), [5, 12], [5, 13])).doors).toHaveLength(1);
  });
  it('[proposal] Split, then the door goes in', () => {
    const split = ok(removeAreaMerge(merged(), 'R14'));
    expect(ok(addDoor(split, [6, 11], [7, 11])).doors[0]?.id).toBe('d1');
  });
  it('[proposal] a merge on one map of a double quest does not touch the other map', () => {
    const one = testMapsQuest();
    const mergedOne = ok(addAreaMerge(one, 'R13', 'R14'));
    expect(error(addDoor(mergedOne, [6, 11], [7, 11]))).toContain('one room');
    // map two has no merge, so its door is fine
    const two = swapTo(mergedOne, 'two');
    expect(two.areaOverrides).toEqual([]);
    const withDoor = ok(addDoor(two, [6, 11], [7, 11]));
    // back on map one nothing is flagged, and the whole quest has no merged-wall error
    const back = swapTo(withDoor, 'one');
    const bad = validateQuestIssues(back, board).filter((i) =>
      i.message.includes('merged into one'),
    );
    expect(bad).toEqual([]);
  });
});

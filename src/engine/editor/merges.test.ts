import { board } from '../board/board';
import { validateQuestIssues } from '../quest/validate';
import { testMapsQuest } from '../quest/testMaps';
import { swapTo } from './maps';
import { describe, expect, it } from 'vitest';
import { emptyQuest, addDoor, type EditResult } from './ops';
import { newIssues } from './result';
import { addAreaMerge, addAreaMerges, removeAreaMerge } from './merges';
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

/*
 * Board excerpt (x 1..8, y 10..13). One letter per room:
 *
 *   x:   1 2 3 4 5 6 7 8
 *   y10  a a a a b b c c      a = R12, b = R13, c = R14
 *   y11  a a a a b b c c
 *   y12  a a a a b b c c
 *   y13  a a a a d d d d      d = R17
 *
 * R12 | R13 | R14 are in a row. R12 and R14 do not touch. R16 is far away.
 */
describe('addAreaMerges: many rooms in one action [proposal]', () => {
  const joined = (q: Quest) => q.areaOverrides.map((m) => m.merge.join('>'));
  it('three rooms in a row: the first stays, both others join', () => {
    const q = ok(addAreaMerges(blank(), 'R12', ['R13', 'R14']));
    expect(joined(q)).toEqual(['R12>R13', 'R12>R14']);
  });
  it('a star: two rooms that touch only the main room', () => {
    const q = ok(addAreaMerges(blank(), 'R13', ['R12', 'R14']));
    expect(joined(q)).toEqual(['R13>R12', 'R13>R14']);
  });
  it('a chain: a room that touches only another joining room, in any order', () => {
    const inOrder = ok(addAreaMerges(blank(), 'R12', ['R13', 'R14']));
    const reversed = ok(addAreaMerges(blank(), 'R12', ['R14', 'R13']));
    expect(joined(reversed)).toEqual(['R12>R13', 'R12>R14']);
    expect(reversed.areaOverrides).toEqual(inOrder.areaOverrides);
  });
  it('reports one issues diff for the whole action', () => {
    const r = addAreaMerges(blank(), 'R12', ['R13', 'R14']);
    if (!r.ok) throw new Error(r.error);
    expect(r.warnings).toEqual(newIssues(blank(), r.quest));
  });
  it('refuses all when one room is apart: nothing is merged, the quest is unchanged', () => {
    const q = blank();
    const r = addAreaMerges(q, 'R12', ['R13', 'R16', 'R14']);
    expect(error(r)).toBe('Cannot merge R16: the rooms do not touch');
    expect(q.areaOverrides).toEqual([]);
  });
  it('names the first room that cannot be placed', () => {
    expect(error(addAreaMerges(blank(), 'R12', ['R13', 'R99', 'R16']))).toBe(
      'Cannot merge R99: unknown room',
    );
    expect(error(addAreaMerges(blank(), 'R12', ['R12']))).toBe(
      'Cannot merge R12: a room cannot merge with itself',
    );
  });
  it('refuses all when a door is on the wall of one pair', () => {
    // door R13 | R14 (x6|x7, y11): R14 would be inside one room with R13
    const q = ok(addDoor(blank(), [6, 11], [7, 11]));
    expect(error(addAreaMerges(q, 'R12', ['R13', 'R14']))).toBe(
      'Cannot merge R14: door d1 is on the wall between them. Remove it first.',
    );
    // the same door is fine when R14 is left out
    expect(joined(ok(addAreaMerges(q, 'R12', ['R13'])))).toEqual(['R12>R13']);
  });
  it('refuses a room that is merged into another already', () => {
    const m = ok(addAreaMerge(blank(), 'R13', 'R14'));
    expect(error(addAreaMerges(m, 'R12', ['R14']))).toBe(
      'Cannot merge R14: a room that was merged into another cannot be merged again',
    );
  });
  it('[proposal] a room that has rooms merged into it cannot join another room', () => {
    const m = ok(addAreaMerge(blank(), 'R13', 'R14'));
    const sentence = 'R13 has rooms merged into it. Split them first.';
    expect(error(addAreaMerges(m, 'R12', ['R13']))).toBe(sentence);
    expect(error(addAreaMerge(m, 'R12', 'R13'))).toBe(sentence);
    expect(error(addAreaMerges(m, 'R12', ['R17', 'R13']))).toBe(sentence);
    // as the main room it is fine
    expect(joined(ok(addAreaMerges(m, 'R13', ['R12'])))).toEqual(['R13>R14', 'R13>R12']);
  });
  it('[proposal] the validator reports a file where a room with merged rooms joins another', () => {
    const q = { ...blank(), areaOverrides: [{ merge: ['R13', 'R14'] }, { merge: ['R12', 'R13'] }] };
    const errors = validateQuestIssues(q as Quest, board).filter((i) => i.severity === 'error');
    expect(errors.map((i) => i.message)).toContain(
      'areaOverrides R12 + R13: R13 has rooms merged into it. Split them first.',
    );
  });
  it('a merge on one map of a double quest does not touch the other map', () => {
    const one = testMapsQuest();
    const mergedOne = ok(addAreaMerges(one, 'R12', ['R13', 'R14']));
    expect(joined(mergedOne)).toEqual(['R12>R13', 'R12>R14']);
    expect(swapTo(mergedOne, 'two').areaOverrides).toEqual([]);
  });
});

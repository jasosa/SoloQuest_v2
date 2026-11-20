import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { sightMap, buildLevel } from '../board/level';
import { lineOfSight } from '../board/los';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { reduce, replay, startGame } from './reducer';

// Old data with a "cage" of two squares in the bottom corridor (it no longer blocks sight),
// and the throne of the test quest's R17 that becomes a door.
const manual = (id: string, effects: unknown[]) => ({
  id,
  trigger: { type: 'manual', label: id },
  effects,
});
const make = (patch: Record<string, unknown> = {}) =>
  parseQuest({
    ...testQuestData,
    blocks: [],
    boardTiles: [
      {
        type: 'cage', // old data: dropped on load
        cells: [
          [6, 18],
          [7, 18],
        ],
        hiddenWhen: 'open',
        blocks: true,
      },
    ],
    notes: [
      ...testQuestData.notes,
      manual('lever', [{ type: 'setFlag', flag: 'open', value: true }]),
    ],
    ...patch,
  });

describe('an old cage tile no longer blocks anything (decision 94)', () => {
  // `make` has the old data: a cage tile with blocks and a flag. It loads without it.
  const quest = make();
  const lv = buildLevel(quest);

  it('the cage tile and its blocks and flag are dropped on load', () => {
    expect(quest.boardTiles).toEqual([]);
  });

  it('nothing blocks sight: a look along the corridor passes the old cage squares', () => {
    const s = startGame(lv, 1).state;
    expect(s.sightBlockers.size).toBe(0);
    const map = sightMap(lv, s.openDoors, s.placedBlocks, s.sightBlockers);
    expect(lineOfSight(map, [4, 18], [9, 18])).toBe(true);
    const seen = replay(lv, 1, [{ type: 'OPEN_DOOR', door: 'd1' }]);
    expect(seen.seenCells.has('9,18')).toBe(true);
  });

  it('the lever flag still sets, as story, and changes no sight', () => {
    const s = reduce(lv, startGame(lv, 1).state, { type: 'MANUAL_TRIGGER', note: 'lever' }).state;
    expect(s.flags['open']).toBe(true);
    expect(s.sightBlockers.size).toBe(0);
  });
});

describe('replaceFurnitureWithDoor', () => {
  // a throne in R17 at (8,16) that melts into a door to R18 at (9,16)
  const q = (withDoorOnly = false) =>
    make({
      boardTiles: [],
      furniture: [...testQuestData.furniture, { id: 'ft', type: 'throne', cells: [[8, 16]] }],
      doors: [...testQuestData.doors, { id: 'dt', a: [8, 16], b: [9, 16], hiddenUntil: 'melted' }],
      notes: [
        ...testQuestData.notes,
        manual(
          'melt',
          withDoorOnly
            ? [{ type: 'setFlag', flag: 'melted', value: true }]
            : [
                { type: 'setFlag', flag: 'melted', value: true },
                { type: 'replaceFurnitureWithDoor', furniture: 'ft', door: 'dt' },
              ],
        ),
      ],
    });

  it('the piece goes, the door appears open, and it stays gone', () => {
    const l = buildLevel(q());
    const seen = replay(l, 1, [{ type: 'OPEN_DOOR', door: 'd2' }]);
    expect(seen.seenFurniture.has('ft')).toBe(true);
    expect(seen.seenDoors.has('dt')).toBe(false);
    const s = reduce(l, seen, { type: 'MANUAL_TRIGGER', note: 'melt' }).state;
    expect(s.removedFurniture).toEqual(['ft']);
    expect(s.seenFurniture.has('ft')).toBe(false);
    expect(s.openDoors.has('dt') && s.seenDoors.has('dt')).toBe(true);
  });

  it('the validator lets the door stand on the furniture it replaces, and nothing else', () => {
    expect(validateQuest(q(), board)).toEqual([]);
    expect(validateQuest(q(true), board).join(' ')).toMatch(
      /door dt: cell 8,16 is under furniture ft/,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { areaAt, board, isWallBetween } from '../board/board';
import { buildLevel } from '../board/level';
import { ROOM_TILES, ROOM_TILE_TYPES } from '../data/roomTiles';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { replay } from './reducer';

// On the test quest R20 (the start room) and R17 touch; a door sits between them.
const make = (patch: Record<string, unknown>) => parseQuest({ ...testQuestData, ...patch });
const problems = (patch: Record<string, unknown>) => validateQuest(make(patch), board).join(' | ');

describe('merged rooms (Q10 K)', () => {
  const lv = buildLevel(make({ areaOverrides: [{ merge: ['R20', 'R17'] }] }));

  it('the second room takes the id of the first and the wall between them is gone', () => {
    expect(areaAt(board, 6, 15)).toBe('R17'); // the real board is not changed
    expect(areaAt(lv.board, 6, 15)).toBe('R20');
    expect(isWallBetween(board, [4, 15], [5, 15])).toBe(true);
    expect(isWallBetween(lv.board, [4, 15], [5, 15])).toBe(false);
  });

  it('revealing the room shows both halves, with what is in them', () => {
    const s = replay(lv, 1, []);
    expect(s.seenCells.has('6,15')).toBe(true); // a square of the old R17
    expect(s.seenMonsters.has('m1')).toBe(true); // the orc that stood in R17
  });

  it('without a merge nothing changes', () => {
    const plain = buildLevel(make({}));
    expect(plain.board).toBe(buildLevel(make({})).board);
    expect(replay(plain, 1, []).seenMonsters.has('m1')).toBe(false);
  });
});

describe('room tiles and the validator', () => {
  it('a tile gives its room a name and a rule', () => {
    const q = make({ roomTiles: [{ type: 'iceVault', area: 'R17' }] });
    expect(ROOM_TILES[q.roomTiles[0]!.type].name).toBe('Ice Vault');
    for (const t of ROOM_TILE_TYPES) {
      expect(ROOM_TILES[t].id).toBe(t);
      expect(ROOM_TILES[t].rule.length).toBeGreaterThan(0);
    }
  });

  it('a clean quest with tiles and a merge has no problems', () => {
    expect(
      problems({
        roomTiles: [{ type: 'gremlinTreasure', area: 'R20' }],
        areaOverrides: [{ merge: ['R20', 'R17'] }],
        // the door d2 sat on the wall the merge removes [proposal], so it goes
        doors: testQuestData.doors.filter((d) => d.id !== 'd2'),
      }),
    ).toBe('');
  });

  it('wants known rooms, one tile per room, and rooms that touch', () => {
    expect(problems({ roomTiles: [{ type: 'iceVault', area: 'R99' }] })).toMatch(
      /unknown room R99/,
    );
    expect(
      problems({
        roomTiles: [
          { type: 'iceVault', area: 'R17' },
          { type: 'cageRoom', area: 'R17' },
        ],
      }),
    ).toMatch(/R17 already has a tile/);
    expect(problems({ areaOverrides: [{ merge: ['R20', 'R20'] }] })).toMatch(/with itself/);
    expect(problems({ areaOverrides: [{ merge: ['R20', 'R22'] }] })).toMatch(/do not touch/);
    expect(problems({ areaOverrides: [{ merge: ['R20', 'R99'] }] })).toMatch(/unknown room/);
  });

  it('the merged-away room is not a room any more: no tile, no start', () => {
    expect(
      problems({
        roomTiles: [{ type: 'iceVault', area: 'R17' }],
        areaOverrides: [{ merge: ['R20', 'R17'] }],
      }),
    ).toMatch(/R17 was merged into another room/);
    expect(
      problems({
        start: { area: 'R17' },
        areaOverrides: [{ merge: ['R20', 'R17'] }],
      }),
    ).toMatch(/start.area: unknown room R17/);
  });

  it('a room cannot be merged twice', () => {
    expect(
      problems({
        areaOverrides: [{ merge: ['R20', 'R17'] }, { merge: ['R18', 'R17'] }],
      }),
    ).toMatch(/cannot be merged again/);
  });
});

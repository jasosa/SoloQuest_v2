import { describe, expect, it } from 'vitest';
import { areaAt } from '../board/board';
import { buildLevel } from '../board/level';
import { roomTileCells } from '../quest/roomTileCells';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { reduce, replay } from './reducer';
import { newRuleHints } from './ruleHints';
import {
  newTiles,
  putTilesText,
  roomTilesAt,
  roomTilesInArea,
  roomTilesInView,
  startTiles,
} from './tiles';

const lv = buildLevel(
  parseQuest({
    ...testQuestData,
    roomTiles: [{ type: 'gremlinTreasure', area: 'R17' }],
    boardTiles: [
      { type: 'iceCaveEntrance', cells: [[0, 7]] },
      { type: 'icyRiver', cells: [[4, 18]] },
    ],
  }),
);
const start = replay(lv, 1, []);

describe('tiles to put on the board', () => {
  it('the cave is there at the start; a room tile shows once its room is revealed', () => {
    expect(startTiles(lv)).toEqual(['Ice cave entrance']);
    expect(roomTilesInView(lv, start)).toEqual([]);
    const after = reduce(lv, start, { type: 'OPEN_DOOR', door: 'd2' }).state;
    const rooms = roomTilesInView(lv, after);
    expect(rooms.map((r) => r.tile.name)).toEqual(['Ice Gremlin Treasure Room']);
    expect(rooms[0]!.cells.length).toBeGreaterThan(0);
    expect(newTiles(lv, start, after)).toEqual(['Ice Gremlin Treasure Room']);
    expect(newTiles(lv, after, after)).toEqual([]);
  });

  it('terrain that comes into view is a tile too', () => {
    const after = reduce(lv, start, { type: 'OPEN_DOOR', door: 'd1' }).state;
    expect(newTiles(lv, start, after)).toContain('Icy river');
  });

  it('the sentence names each tile', () => {
    expect(putTilesText(['Cage', 'Icy river'])).toBe(
      'Put on the board: the Cage tile, the Icy river tile.',
    );
  });
});

describe('room tiles over squares (decision 88)', () => {
  // A 4 x 1 strip of corridor and a piece of R17: a physical tile that lies over two places.
  const over = buildLevel(
    parseQuest({
      ...testQuestData,
      roomTiles: [
        {
          type: 'iceVault',
          cells: [
            [3, 18],
            [4, 18],
            [5, 18],
            [6, 18],
          ],
        },
      ],
      boardTiles: [],
    }),
  );
  const s0 = replay(over, 1, []);

  it('shows when one of its squares is seen, and gives its rule once', () => {
    expect(roomTilesInView(over, s0)).toEqual([]);
    const after = reduce(over, s0, { type: 'OPEN_DOOR', door: 'd1' }).state;
    const seen = roomTilesInView(over, after);
    expect(seen.map((t) => t.tile.name)).toEqual(['Ice Vault']);
    expect(seen[0]!.cells).toHaveLength(4);
    expect(newTiles(over, s0, after)).toEqual(['Ice Vault']);
    expect(newRuleHints(over, s0, after).map((h) => h.name)).toEqual(['Ice Vault']);
    expect(newRuleHints(over, after, after)).toEqual([]);
  });

  it('is found by the room and by the square it lies over', () => {
    const after = reduce(over, s0, { type: 'OPEN_DOOR', door: 'd1' }).state;
    expect(roomTilesAt(over, after, [4, 18])).toHaveLength(1);
    expect(roomTilesAt(over, after, [4, 17])).toHaveLength(0);
    const inRoom = roomTilesInArea(over, after, areaAt(over.board, 6, 18) as string);
    expect(inRoom.length).toBeLessThanOrEqual(1);
  });

  it('a tile that fills a room leaves out the rock squares of its neighbour', () => {
    const merged = parseQuest({
      ...testQuestData,
      rock: { rooms: [], cells: [[5, 4]] },
      areaOverrides: [{ merge: ['R02', 'R08'] }],
      roomTiles: [{ type: 'cageRoom', area: 'R02' }],
    });
    const cells = roomTileCells(merged, merged.roomTiles[0]!);
    expect(cells.some((c) => c[0] === 5 && c[1] === 4)).toBe(false);
    expect(cells.length).toBeGreaterThan(0);
  });
});

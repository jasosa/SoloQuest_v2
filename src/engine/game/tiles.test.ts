import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { reduce, replay } from './reducer';
import { newTiles, putTilesText, roomTilesInView, startTiles } from './tiles';

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

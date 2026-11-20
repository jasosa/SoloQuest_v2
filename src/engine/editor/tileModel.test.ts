/** Decision 94: one palette of physical tiles, the cage of a Cage Room, chasm squares become the 4 x 4 room. */
import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { BOARD_TILES, ROOM_TILES, TILE_PALETTE, tileSpec } from '../data/roomTiles';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuestIssues } from '../quest/validate';
import type { EditResult } from './result';
import { moveBoardTile, moveRoomTile, placeRoomTile, sizeKeepingTurn } from './tiles';

const base = { ...testQuestData, tunnels: [], boardTiles: [], roomTiles: [] };
const q = parseQuest(base);
const good = (r: EditResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};
const msgs = (quest: ReturnType<typeof parseQuest>) =>
  validateQuestIssues(quest, board).map((i) => i.message);

describe('the Board Tiles palette', () => {
  it('lists the twelve physical tiles, with no cage and no chasm squares', () => {
    const names = TILE_PALETTE.map((p) => tileSpec(p.group, p.type)!.name);
    expect(names).toEqual([
      'Ice cave entrance',
      'Icy river',
      'Ice ledge',
      'Slippery ice',
      'Ice Vault',
      'Scepter Room',
      'Living Fog Room',
      'Bottomless Chasm Room',
      'Frozen Crypt Room',
      'Seat of Power Room',
      'Cage Room',
      'Ice Gremlin Treasure Room',
    ]);
    expect(TILE_PALETTE.some((p) => p.group === 'board' && p.type === 'chasm')).toBe(false);
  });

  it('lists every shape once: no size is the turned copy of another', () => {
    for (const p of TILE_PALETTE) {
      const fps = tileSpec(p.group, p.type)!.footprints;
      for (const [i, a] of fps.entries())
        for (const b of fps.slice(i + 1)) expect(a[0] === b[0] && a[1] === b[1]).toBe(false);
      for (const a of fps)
        expect(fps.filter((b) => b[0] === a[1] && b[1] === a[0] && a[0] !== a[1])).toHaveLength(0);
    }
  });

  it('has the sizes of the owner table (decision 88)', () => {
    const fp = (g: 'board' | 'room', t: string) =>
      tileSpec(g, t)!.footprints.map((f) => f.join('x'));
    expect(fp('board', 'iceCaveEntrance')).toEqual(['6x5']);
    expect(fp('board', 'iceLedge')).toEqual(['5x3']);
    expect(fp('board', 'icyRiver')).toEqual(['1x8', '1x3']);
    expect(fp('room', 'iceVault')).toEqual(['3x2', '4x3']);
    for (const t of ['livingFog', 'scepterRoom', 'chasmRoom', 'cageRoom'])
      expect(fp('room', t)).toEqual(['4x4']);
    expect(fp('room', 'frozenCrypt')).toEqual(['5x3']);
    expect(fp('room', 'gremlinTreasure')).toEqual(['4x3']);
    expect(fp('room', 'seatOfPower')).toEqual(['6x5']);
    expect(fp('board', 'slipperyIce')).toEqual(['1x1', '2x1', '3x1', '3x2']);
    expect(ROOM_TILES.chasmRoom.name).toBe('Bottomless Chasm Room');
    expect('cage' in BOARD_TILES).toBe(false);
    expect(BOARD_TILES.chasm.notInPalette).toBe(true);
  });

  it('a size picked in the palette keeps the turn of the tile', () => {
    const vault = ROOM_TILES.iceVault.footprints;
    expect(sizeKeepingTurn(vault, 1, { w: 3, h: 2 })).toEqual([4, 3]);
    expect(sizeKeepingTurn(vault, 1, { w: 2, h: 3 })).toEqual([3, 4]);
    expect(sizeKeepingTurn(vault, 0, { w: 3, h: 4 })).toEqual([2, 3]);
  });
});

describe('moving a tile by drag and drop (the engine side)', () => {
  it('moves a room tile, refuses an overlap or the edge, and leaves the quest as it was', () => {
    let a = good(placeRoomTile(q, { type: 'livingFog', at: [2, 2] }));
    a = good(placeRoomTile(a, { type: 'scepterRoom', at: [8, 2] }));
    expect(good(moveRoomTile(a, 0, [2, 6])).roomTiles[0]!.cells![0]).toEqual([2, 6]);
    const over = moveRoomTile(a, 0, [6, 2]);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/overlap/);
    expect(moveRoomTile(a, 0, [24, 17]).ok).toBe(false);
    expect(moveBoardTile(a, 0, [0, 0]).ok).toBe(false); // there is no board tile 0
  });
});

describe('there is no cage piece (decision 94)', () => {
  const cage = {
    type: 'cage',
    cells: [
      [6, 2],
      [7, 2],
      [6, 3],
      [7, 3],
    ],
    hiddenWhen: 'cageOpen',
    blocks: true,
  };

  it('an old cage tile loads without the tile, and its blocks and flag go with it', () => {
    const quest = parseQuest({ ...base, boardTiles: [cage] });
    expect(quest.boardTiles).toEqual([]);
  });

  it('other tiles lose blocks and hiddenWhen on load, and keep the rest', () => {
    const quest = parseQuest({
      ...base,
      boardTiles: [{ type: 'iceLedge', cells: [[6, 2]], hiddenWhen: 'f', blocks: true }],
    });
    expect(quest.boardTiles).toEqual([{ type: 'iceLedge', cells: [[6, 2]] }]);
  });

  it('also on the extra maps of a double quest', () => {
    const quest = parseQuest({
      ...base,
      mapId: 'a',
      maps: [{ id: 'b', start: { area: 'R20' }, boardTiles: [cage] }],
    });
    expect(quest.maps?.[0]?.boardTiles).toEqual([]);
  });

  it('the Cage Room is only the 4 x 4 room tile, with no cage button', () => {
    const a = good(placeRoomTile(q, { type: 'cageRoom', at: [2, 2] }));
    expect(a.roomTiles[0]!.cells).toHaveLength(16);
    expect(a.boardTiles).toEqual([]);
  });
});

describe('chasm squares become the Bottomless Chasm Room when they fill a 4 x 4', () => {
  const square = (x0: number, y0: number) =>
    Array.from({ length: 16 }, (_, i) => [x0 + (i % 4), y0 + Math.floor(i / 4)]);
  const square4 = square(9, 12);

  it('a 4 x 4 of chasm squares loads as the room tile on the same squares', () => {
    const quest = parseQuest({ ...base, boardTiles: [{ type: 'chasm', cells: square4 }] });
    expect(quest.boardTiles).toEqual([]);
    expect(quest.roomTiles).toEqual([{ type: 'chasmRoom', cells: square4 }]);
  });

  it('also on the extra maps of a double quest', () => {
    const quest = parseQuest({
      ...base,
      mapId: 'a',
      maps: [{ id: 'b', start: { area: 'R20' }, boardTiles: [{ type: 'chasm', cells: square4 }] }],
    });
    expect(quest.maps?.[0]?.roomTiles).toEqual([{ type: 'chasmRoom', cells: square4 }]);
    expect(quest.maps?.[0]?.boardTiles).toEqual([]);
  });

  it('other chasm squares stay (the file still loads) and the validator says what to do', () => {
    const quest = parseQuest({
      ...base,
      boardTiles: [
        {
          type: 'chasm',
          cells: [
            [9, 12],
            [10, 12],
          ],
        },
      ],
    });
    expect(quest.boardTiles).toHaveLength(1);
    expect(msgs(quest).join(' | ')).toMatch(/replaced by the Bottomless Chasm Room tile/);
  });

  it('a chasm with the old flag and blocks loses them first, then becomes the room tile', () => {
    const quest = parseQuest({
      ...base,
      boardTiles: [{ type: 'chasm', cells: square4, hiddenWhen: 'f', blocks: true }],
    });
    expect(quest.boardTiles).toEqual([]);
    expect(quest.roomTiles).toEqual([{ type: 'chasmRoom', cells: square4 }]);
  });

  it('keeps the squares when the map already has a chasm room', () => {
    const quest = parseQuest({
      ...base,
      roomTiles: [{ type: 'chasmRoom', cells: square(1, 1) }],
      boardTiles: [{ type: 'chasm', cells: square4 }],
    });
    expect(quest.boardTiles).toHaveLength(1);
  });
});

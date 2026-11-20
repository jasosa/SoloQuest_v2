import { describe, expect, it } from 'vitest';
import { BOARD_TILES, BOARD_TILE_TYPES, footprintText } from '../data/roomTiles';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuestIssues } from '../quest/validate';
import { board } from '../board/board';
import { exportQuest } from './io';
import {
  addEdgeDoor,
  addTunnel,
  exteriorSideOf,
  knownFlags,
  nextTunnelDesign,
  pickTunnelDesign,
  setDoorFlags,
  setEdgeDoorKind,
  setStart,
  setTunnelDesign,
} from './features';
import { setDoorKind } from './ops';
import {
  boardTileAt,
  moveBoardTile,
  placeBoardTile,
  moveRoomTile,
  placeRoomTile,
  removeBoardTileCell,
  removeRoomTile,
  resizeRoomTile,
  roomTileIndexAt,
  roomTileSizes,
  rotateRoomTile,
  tileUsage,
  resizeBoardTile,
  rotateBoardTile,
  tileBox,
  tileCellsFor,
  tileSizes,
} from './tiles';
import type { EditResult } from './result';

const q = parseQuest({ ...testQuestData, tunnels: [], boardTiles: [], roomTiles: [] });
const good = (r: EditResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};

describe('tile footprints in the data', () => {
  it('says what size every tile comes in', () => {
    expect(footprintText(BOARD_TILES.slipperyIce)).toBe('1 x 1 or 2 x 1 or 3 x 1 or 3 x 2');
    expect(footprintText(BOARD_TILES.iceCaveEntrance)).toBe('6 x 5');
    expect(footprintText(BOARD_TILES.icyRiver)).toBe('1 x 8 or 1 x 3');
    expect(footprintText(BOARD_TILES.iceLedge)).toBe('5 x 3');
    expect(footprintText(BOARD_TILES.chasm)).toBe('square by square');
    for (const t of BOARD_TILE_TYPES) expect(BOARD_TILES[t].footprints.length).toBeGreaterThan(0);
  });

  it('a tile can be laid turned', () => {
    expect(tileSizes('slipperyIce')).toEqual([
      [1, 1],
      [2, 1],
      [1, 2],
      [3, 1],
      [1, 3],
      [3, 2],
      [2, 3],
    ]);
  });
});

describe('placing a board tile', () => {
  it('slippery ice comes as 1 x 1, 2 x 1, 3 x 1 and 3 x 2, with the top left square on the tap', () => {
    const one = good(placeBoardTile(q, { type: 'slipperyIce', at: [10, 13], variant: 0 }));
    expect(one.boardTiles[0]!.cells).toEqual([[10, 13]]);
    const a = good(placeBoardTile(q, { type: 'slipperyIce', at: [10, 13], variant: 1 }));
    expect(a.boardTiles[0]!.cells).toEqual([
      [10, 13],
      [11, 13],
    ]);
    const three = good(placeBoardTile(q, { type: 'slipperyIce', at: [10, 13], variant: 2 }));
    expect(tileBox(three.boardTiles[0]!.cells)).toMatchObject({ w: 3, h: 1, full: true });
    const b = good(placeBoardTile(q, { type: 'slipperyIce', at: [10, 13], variant: 3 }));
    expect(tileBox(b.boardTiles[0]!.cells)).toMatchObject({ w: 3, h: 2, full: true });
    const c = good(
      placeBoardTile(q, { type: 'slipperyIce', at: [10, 13], variant: 3, turned: true }),
    );
    expect(tileBox(c.boardTiles[0]!.cells)).toMatchObject({ w: 2, h: 3 });
    expect(tileCellsFor('iceLedge', [6, 2], 0, true)).toHaveLength(15);
  });

  it('is refused off the board, over rock (except the cave entrance) and over another tile', () => {
    expect(placeBoardTile(q, { type: 'slipperyIce', at: [25, 18], variant: 3 }).ok).toBe(false);
    // (13,0) is rock in the test quest
    const rock = good(placeBoardTile(q, { type: 'iceCaveEntrance', at: [13, 0] }));
    expect(rock.boardTiles).toHaveLength(1);
    expect(placeBoardTile(q, { type: 'slipperyIce', at: [13, 0], variant: 3 }).ok).toBe(false);
    const a = good(placeBoardTile(q, { type: 'slipperyIce', at: [6, 2], variant: 3 }));
    const over = placeBoardTile(a, { type: 'slipperyIce', at: [7, 3], variant: 0 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/overlap/);
  });

  it('terrain is laid square by square and touching squares make one tile', () => {
    let a = good(placeBoardTile(q, { type: 'chasm', at: [9, 12] }));
    a = good(placeBoardTile(a, { type: 'chasm', at: [10, 12] }));
    a = good(placeBoardTile(a, { type: 'chasm', at: [12, 12] }));
    expect(a.boardTiles).toHaveLength(2);
    expect(a.boardTiles[0]!.cells).toHaveLength(2);
    // the gap between them joins the first tile it touches
    a = good(placeBoardTile(a, { type: 'chasm', at: [11, 12] }));
    expect(boardTileAt(a, [11, 12])).toBe(0);
    expect(placeBoardTile(a, { type: 'chasm', at: [11, 12] }).ok).toBe(false);
  });

  it('turn and resize keep the top left square and respect the sizes', () => {
    const a = good(placeBoardTile(q, { type: 'slipperyIce', at: [10, 13], variant: 1 }));
    const turned = good(rotateBoardTile(a, 0));
    expect(tileBox(turned.boardTiles[0]!.cells)).toMatchObject({ x: 10, y: 13, w: 1, h: 2 });
    expect(resizeBoardTile(a, 0, [5, 5]).ok).toBe(false);
    expect(good(resizeBoardTile(a, 0, [2, 3])).boardTiles[0]!.cells).toHaveLength(6);
    expect(rotateBoardTile(good(placeBoardTile(q, { type: 'chasm', at: [9, 12] })), 0).ok).toBe(
      false,
    );
  });

  it('moves, and removes one square of terrain', () => {
    const a = good(placeBoardTile(q, { type: 'slipperyIce', at: [6, 2], variant: 3 }));
    const moved = good(moveBoardTile(a, 0, [8, 2]));
    expect(tileBox(moved.boardTiles[0]!.cells)).toMatchObject({ x: 8, y: 2 });
    const river = good(placeBoardTile(q, { type: 'chasm', at: [9, 12] }));
    expect(good(removeBoardTileCell(river, 0, [9, 12])).boardTiles).toEqual([]);
  });

  it('a tile round trips through export and import', () => {
    const a = good(placeBoardTile(q, { type: 'slipperyIce', at: [10, 13], variant: 1 }));
    const back = parseQuest(JSON.parse(exportQuest(a)));
    expect(back.boardTiles).toEqual(a.boardTiles);
  });
});

describe('room tiles', () => {
  it('lie over squares: a fixed size, any rooms and corridors, with the top left on the tap', () => {
    const a = good(placeRoomTile(q, { type: 'livingFog', at: [2, 15] }));
    expect(a.roomTiles).toHaveLength(1);
    expect(a.roomTiles[0]!.cells).toHaveLength(16);
    expect(a.roomTiles[0]!.area).toBeUndefined();
    expect(roomTileIndexAt(a, [5, 18])).toBe(0);
    expect(roomTileIndexAt(a, [6, 18])).toBe(-1);
    // 4 x 4 starting in a corridor, over the edge of a room
    expect(placeRoomTile(q, { type: 'cageRoom', at: [0, 17] }).ok).toBe(false); // off the board
    expect(roomTileSizes('iceVault')).toEqual([
      [3, 2],
      [2, 3],
      [4, 3],
      [3, 4],
    ]);
    const vault = good(
      placeRoomTile(q, { type: 'iceVault', at: [2, 15], variant: 1, turned: true }),
    );
    expect(tileBox(vault.roomTiles[0]!.cells!)).toMatchObject({ w: 3, h: 4, full: true });
  });

  it('are refused over another room tile and over rock', () => {
    const a = good(placeRoomTile(q, { type: 'livingFog', at: [2, 14] }));
    const over = placeRoomTile(a, { type: 'frozenCrypt', at: [4, 15] });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/overlap/);
    expect(placeRoomTile(q, { type: 'livingFog', at: [12, 0] }).ok).toBe(false); // (13,0) is rock
  });

  it('keep to the limit of the box, per size', () => {
    let a = good(placeRoomTile(q, { type: 'iceVault', at: [2, 15], variant: 0 }));
    const again = placeRoomTile(a, { type: 'iceVault', at: [8, 2], variant: 0 });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toMatch(/1 of 3 x 2 and 1 of 4 x 3/);
    a = good(placeRoomTile(a, { type: 'iceVault', at: [8, 2], variant: 1 }));
    expect(tileUsage(a, 'room', 'iceVault')).toMatchObject({ used: 2, max: 2 });
    expect(placeRoomTile(a, { type: 'iceVault', at: [14, 2], variant: 1 }).ok).toBe(false);
    // one livingFog only
    const fog = good(placeRoomTile(q, { type: 'livingFog', at: [2, 15] }));
    expect(placeRoomTile(fog, { type: 'livingFog', at: [14, 2] }).ok).toBe(false);
    // board tiles too: one river of 1 x 8 and one of 1 x 3, one ledge, one cave entrance
    let r = good(placeBoardTile(q, { type: 'icyRiver', at: [9, 12], variant: 0, turned: true }));
    expect(placeBoardTile(r, { type: 'icyRiver', at: [9, 14], variant: 0, turned: true }).ok).toBe(
      false,
    );
    r = good(placeBoardTile(r, { type: 'icyRiver', at: [9, 14], variant: 1, turned: true }));
    expect(tileUsage(r, 'board', 'icyRiver')).toMatchObject({ used: 2, max: 2 });
    expect(placeBoardTile(r, { type: 'icyRiver', at: [9, 16], variant: 1 }).ok).toBe(false);
    const ledge = good(placeBoardTile(q, { type: 'iceLedge', at: [1, 1] }));
    expect(tileBox(ledge.boardTiles[0]!.cells)).toMatchObject({ w: 5, h: 3 });
    expect(placeBoardTile(ledge, { type: 'iceLedge', at: [14, 8] }).ok).toBe(false);
    // slippery ice has no limit
    let s = q;
    for (let i = 0; i < 4; i++)
      s = good(placeBoardTile(s, { type: 'slipperyIce', at: [10 + i * 2, 13] }));
    expect(tileUsage(s, 'board', 'slipperyIce').max).toBeUndefined();
  });

  it('move, turn, resize and delete work, and a room shortcut becomes squares when moved', () => {
    let a = good(placeRoomTile(q, { type: 'frozenCrypt', at: [2, 11] }));
    a = good(rotateRoomTile(a, 0));
    expect(tileBox(a.roomTiles[0]!.cells!)).toMatchObject({ x: 2, y: 11, w: 3, h: 5 });
    expect(resizeRoomTile(a, 0, [4, 4]).ok).toBe(false);
    a = good(moveRoomTile(a, 0, [8, 2]));
    expect(tileBox(a.roomTiles[0]!.cells!)).toMatchObject({ x: 8, y: 2 });
    expect(removeRoomTile(good(removeRoomTile(a, 0)), 0).ok).toBe(false);
    expect(good(removeRoomTile(a, 0)).roomTiles).toEqual([]);
    // an old tile that fills the room R20 turns into squares when it is moved
    const old = parseQuest({ ...testQuestData, roomTiles: [{ type: 'cageRoom', area: 'R20' }] });
    const moved = good(moveRoomTile(old, 0, [1, 14]));
    expect(moved.roomTiles[0]!.cells).toBeDefined();
    expect(moved.roomTiles[0]!.area).toBeUndefined();
  });

  it('round trip through export and import', () => {
    const a = good(placeRoomTile(q, { type: 'livingFog', at: [2, 15] }));
    expect(parseQuest(JSON.parse(exportQuest(a))).roomTiles).toEqual(a.roomTiles);
  });

  it('a room tile has exactly one of area and cells', () => {
    expect(() =>
      parseQuest({
        ...testQuestData,
        roomTiles: [{ type: 'iceVault', area: 'R20', cells: [[1, 1]] }],
      }),
    ).toThrow();
    expect(() => parseQuest({ ...testQuestData, roomTiles: [{ type: 'iceVault' }] })).toThrow();
  });
});

describe('ice tunnels', () => {
  it('a fourth pair is refused', () => {
    let a = q;
    for (const [d, y] of [
      [1, 9],
      [2, 10],
      [3, 11],
    ] as const)
      a = good(addTunnel(a, { design: d, a: [8, y], b: [9, y] }));
    const r = addTunnel(a, { design: 4, a: [8, 12], b: [9, 12] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/3 pairs/);
  });
});

describe('exterior doors', () => {
  it('go on the outer edge of the board, with the ids in and out', () => {
    const a = good(addEdgeDoor(q, { cell: [0, 9], side: 'w', kind: 'ironEntry' }));
    const b = good(addEdgeDoor(a, { cell: [25, 9], side: 'e', kind: 'woodenExit' }));
    expect(b.edgeDoors.map((e) => e.id)).toEqual(['in', 'out']);
    const c = good(addEdgeDoor(b, { cell: [24, 18], side: 's', kind: 'woodenExit' }));
    expect(c.edgeDoors[2]!.id).toBe('out2');
  });

  it('are refused inside the board, twice on one edge, and a second iron entry', () => {
    expect(addEdgeDoor(q, { cell: [6, 9], side: 'w', kind: 'ironEntry' }).ok).toBe(false);
    const a = good(addEdgeDoor(q, { cell: [0, 9], side: 'w', kind: 'ironEntry' }));
    expect(addEdgeDoor(a, { cell: [0, 9], side: 'w', kind: 'woodenExit' }).ok).toBe(false);
    const second = addEdgeDoor(a, { cell: [0, 5], side: 'w', kind: 'ironEntry' });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/iron entry/);
  });

  it('may touch rock: an edge between floor and rock is an exterior edge', () => {
    // (13,0) is a rock square in the test quest, (12,0) is floor next to it
    expect(exteriorSideOf(q, [12, 0], [13, 0])).toEqual({ cell: [12, 0], side: 'e' });
    expect(exteriorSideOf(q, [13, 0], [12, 0])).toEqual({ cell: [12, 0], side: 'e' });
    expect(exteriorSideOf(q, [3, 3], [4, 3])).toBeUndefined();
    const a = good(addEdgeDoor(q, { cell: [12, 0], side: 'e', kind: 'ironEntry' }));
    expect(a.edgeDoors[0]).toMatchObject({ cell: [12, 0], side: 'e' });
  });

  it('only an iron entry can be the start, and the start door cannot turn into an exit', () => {
    let a = good(addEdgeDoor(q, { cell: [0, 9], side: 'w', kind: 'ironEntry' }));
    a = good(addEdgeDoor(a, { cell: [25, 9], side: 'e', kind: 'woodenExit' }));
    expect(setStart(a, { door: 'out' }).ok).toBe(false);
    const s = good(setStart(a, { door: 'in' }));
    expect(s.start).toEqual({ door: 'in' });
    expect(setEdgeDoorKind(s, 'in', 'woodenExit').ok).toBe(false);
    expect(setEdgeDoorKind(a, 'out', 'ironEntry').ok).toBe(false);
    expect(good(setEdgeDoorKind(a, 'in', 'woodenExit')).edgeDoors[0]!.kind).toBe('woodenExit');
  });
});

describe('tunnels', () => {
  it('take the first free design and can change it to a free one', () => {
    expect(nextTunnelDesign(q)).toBe(1);
    const a = good(addTunnel(q, { design: 1, a: [3, 18], b: [20, 18] }));
    const b = good(addTunnel(a, { design: 2, a: [4, 18], b: [19, 18] }));
    expect(nextTunnelDesign(b)).toBe(3);
    expect(pickTunnelDesign(b, 1)).toBe(3);
    expect(pickTunnelDesign(b, 5)).toBe(5);
    expect(setTunnelDesign(b, 'tun2', 1).ok).toBe(false);
    expect(good(setTunnelDesign(b, 'tun2', 5)).tunnels[1]!.design).toBe(5);
    expect(setTunnelDesign(b, 'tun2', 10).ok).toBe(false);
    // rock is refused
    expect(addTunnel(q, { design: 3, a: [13, 0], b: [20, 18] }).ok).toBe(false);
  });
});

describe('door flags on every kind of door', () => {
  it('hidden and locked flags work on secret and false doors and survive a kind change', () => {
    const a = good(setDoorFlags(q, 's1', { hiddenUntil: 'h' }));
    expect(a.secretDoors[0]).toMatchObject({ id: 's1', hiddenUntil: 'h' });
    const b = good(setDoorFlags(a, 'x1', { lockedUntil: 'l' }));
    expect(b.falseDoors[0]).toMatchObject({ lockedUntil: 'l' });
    const c = good(setDoorFlags(q, 'd1', { hiddenUntil: 'h', lockedUntil: 'l' }));
    const d = good(setDoorKind(c, 'd1', 'secret'));
    expect(d.secretDoors.find((x) => x.a[0] === 3 && x.a[1] === 17)).toMatchObject({
      hiddenUntil: 'h',
      lockedUntil: 'l',
    });
  });

  it('lists the flags that actions set', () => {
    const withFlag = parseQuest({
      ...testQuestData,
      notes: [
        ...testQuestData.notes,
        {
          id: 'n-flag',
          trigger: { type: 'manual', label: 'Pull the lever' },
          effects: [{ type: 'setFlag', flag: 'leverPulled', value: true }],
        },
      ],
    });
    expect(knownFlags(withFlag)).toContain('leverPulled');
  });
});

describe('problems the validator reports for the new features', () => {
  const messages = (quest: ReturnType<typeof parseQuest>) =>
    validateQuestIssues(quest, board).map((i) => i.message);

  it('two tiles on one square, a tile on rock, a tile that is not its size', () => {
    const bad = parseQuest({
      ...testQuestData,
      boardTiles: [
        {
          type: 'slipperyIce',
          cells: [
            [6, 2],
            [7, 2],
            [8, 2],
            [6, 3],
            [7, 3],
            [8, 3],
          ],
        },
        {
          type: 'icyRiver',
          cells: [
            [7, 3],
            [8, 3],
          ],
        },
        { type: 'icyRiver', cells: [[13, 0]] },
        {
          type: 'slipperyIce',
          cells: [
            [10, 13],
            [11, 13],
            [10, 14],
          ],
        },
      ],
    });
    const all = messages(bad).join(' | ');
    expect(all).toMatch(/board tile 2 \(icyRiver\) overlaps board tile 1/);
    expect(all).toMatch(/board tile 3 \(icyRiver\): cell 13,0 is in rock/);
    expect(all).toMatch(
      /board tile 4 \(slipperyIce\): Slippery ice comes as 1 x 1 or 2 x 1 or 3 x 1 or 3 x 2/,
    );
  });

  it('a tile issue jumps to the tile', () => {
    const bad = parseQuest({
      ...testQuestData,
      boardTiles: [{ type: 'icyRiver', cells: [[13, 0]] }],
    });
    const hit = validateQuestIssues(bad, board).find((i) => /is in rock/.test(i.message));
    expect(hit?.ref).toMatchObject({ kind: 'tile', id: '0' });
  });

  it('a tunnel issue names the tunnel', () => {
    const bad = parseQuest({
      ...testQuestData,
      tunnels: [{ id: 'tun1', design: 1, a: [3, 18], b: [3, 18] }],
    });
    const hit = validateQuestIssues(bad, board).find((i) =>
      /both ends are the same/.test(i.message),
    );
    expect(hit?.ref).toMatchObject({ kind: 'tunnel', id: 'tun1' });
  });
});

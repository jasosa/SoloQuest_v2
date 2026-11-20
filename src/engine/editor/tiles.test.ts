import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  placeRoomTile,
  removeBoardTileCell,
  resizeBoardTile,
  roomTileAt,
  rotateBoardTile,
  setBoardTileFlags,
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
    expect(footprintText(BOARD_TILES.cage)).toBe('2 x 2');
    expect(footprintText(BOARD_TILES.iceCaveEntrance)).toBe('6 x 5');
    expect(footprintText(BOARD_TILES.icyRiver)).toBe('square by square');
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
    expect(tileSizes('cage')).toEqual([[2, 2]]);
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
    expect(tileCellsFor('cage', [6, 2], 0, true)).toHaveLength(4);
  });

  it('is refused off the board, over rock (except the cave entrance) and over another tile', () => {
    expect(placeBoardTile(q, { type: 'cage', at: [25, 18] }).ok).toBe(false);
    // (13,0) is rock in the test quest
    const rock = good(placeBoardTile(q, { type: 'iceCaveEntrance', at: [13, 0] }));
    expect(rock.boardTiles).toHaveLength(1);
    expect(placeBoardTile(q, { type: 'cage', at: [13, 0] }).ok).toBe(false);
    const a = good(placeBoardTile(q, { type: 'cage', at: [6, 2] }));
    const over = placeBoardTile(a, { type: 'slipperyIce', at: [7, 3], variant: 0 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/overlap/);
  });

  it('terrain is laid square by square and touching squares make one tile', () => {
    let a = good(placeBoardTile(q, { type: 'icyRiver', at: [9, 12] }));
    a = good(placeBoardTile(a, { type: 'icyRiver', at: [10, 12] }));
    a = good(placeBoardTile(a, { type: 'icyRiver', at: [12, 12] }));
    expect(a.boardTiles).toHaveLength(2);
    expect(a.boardTiles[0]!.cells).toHaveLength(2);
    // the gap between them joins the first tile it touches
    a = good(placeBoardTile(a, { type: 'icyRiver', at: [11, 12] }));
    expect(boardTileAt(a, [11, 12])).toBe(0);
    expect(placeBoardTile(a, { type: 'icyRiver', at: [11, 12] }).ok).toBe(false);
  });

  it('turn and resize keep the top left square and respect the sizes', () => {
    const a = good(placeBoardTile(q, { type: 'slipperyIce', at: [10, 13], variant: 1 }));
    const turned = good(rotateBoardTile(a, 0));
    expect(tileBox(turned.boardTiles[0]!.cells)).toMatchObject({ x: 10, y: 13, w: 1, h: 2 });
    expect(resizeBoardTile(a, 0, [5, 5]).ok).toBe(false);
    expect(good(resizeBoardTile(a, 0, [2, 3])).boardTiles[0]!.cells).toHaveLength(6);
    expect(rotateBoardTile(good(placeBoardTile(q, { type: 'icyRiver', at: [9, 12] })), 0).ok).toBe(
      false,
    );
  });

  it('moves, removes one square of terrain, and a tile that blocks needs its flag', () => {
    const a = good(placeBoardTile(q, { type: 'cage', at: [6, 2] }));
    const moved = good(moveBoardTile(a, 0, [8, 2]));
    expect(tileBox(moved.boardTiles[0]!.cells)).toMatchObject({ x: 8, y: 2 });
    expect(setBoardTileFlags(a, 0, { blocks: true }).ok).toBe(false);
    const b = good(setBoardTileFlags(a, 0, { hiddenWhen: 'cageOpen' }));
    const c = good(setBoardTileFlags(b, 0, { blocks: true }));
    expect(c.boardTiles[0]).toMatchObject({ hiddenWhen: 'cageOpen', blocks: true });
    expect(setBoardTileFlags(c, 0, { hiddenWhen: '' }).ok).toBe(false);
    const river = good(placeBoardTile(q, { type: 'icyRiver', at: [9, 12] }));
    expect(good(removeBoardTileCell(river, 0, [9, 12])).boardTiles).toEqual([]);
  });

  it('a tile round trips through export and import', () => {
    let a = good(placeBoardTile(q, { type: 'slipperyIce', at: [10, 13], variant: 1 }));
    a = good(setBoardTileFlags(a, 0, { hiddenWhen: 'f' }));
    const back = parseQuest(JSON.parse(exportQuest(a)));
    expect(back.boardTiles).toEqual(a.boardTiles);
  });
});

describe('room tiles', () => {
  it('go in the tapped room, one per room, and never in a corridor', () => {
    const a = good(placeRoomTile(q, [2, 15], 'iceVault'));
    expect(a.roomTiles).toEqual([{ type: 'iceVault', area: 'R20' }]);
    expect(roomTileAt(a, [3, 16])?.type).toBe('iceVault');
    const b = good(placeRoomTile(a, [2, 15], 'livingFog'));
    expect(b.roomTiles).toEqual([{ type: 'livingFog', area: 'R20' }]);
    expect(placeRoomTile(q, [3, 18], 'iceVault').ok).toBe(false);
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

describe('the bundled quests have no tile of the wrong size', () => {
  it('quest 1 (2 x 3), quest 5 (2 x 1) and the double quest 9 (3 x 1, 3 x 2, 2 x 1) are valid shapes', () => {
    for (const f of [
      'fh01-xanon-pass.json',
      'fh05-the-deadly-depths.json',
      'fh09-the-heart-of-ice.json',
    ]) {
      const quest = parseQuest(
        JSON.parse(readFileSync(resolve(import.meta.dirname, '../../content/quests', f), 'utf8')),
      );
      const all = validateQuestIssues(quest, board).map((i) => i.message);
      expect(
        all.filter((m) => /comes as/.test(m)),
        f,
      ).toEqual([]);
    }
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
          type: 'cage',
          cells: [
            [6, 2],
            [7, 2],
            [6, 3],
            [7, 3],
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

  it('a blocking tile on the start room, and a tile issue jumps to the tile', () => {
    const bad = parseQuest({
      ...testQuestData,
      boardTiles: [{ type: 'cage', cells: [[1, 14]], hiddenWhen: 'f', blocks: true }],
      notes: [
        ...testQuestData.notes,
        {
          id: 'n-f',
          trigger: { type: 'manual', label: 'Flag' },
          effects: [{ type: 'setFlag', flag: 'f', value: true }],
        },
      ],
    });
    const hit = validateQuestIssues(bad, board).find((i) =>
      /where the heroes start/.test(i.message),
    );
    expect(hit).toBeDefined();
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

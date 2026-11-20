import { describe, expect, it } from 'vitest';
import { parseQuest } from '../quest/loader';
import { exportQuest } from './io';
import { testQuestData } from '../quest/testQuest';
import {
  addBoardTile,
  addEdgeDoor,
  addTunnel,
  parseCells,
  removeBoardTile,
  removeEdgeDoor,
  removeTunnel,
  setDoorFlags,
  setLeave,
  setSuggestedPack,
  setRoomTile,
  setStart,
} from './features';
import type { EditResult } from './result';

const q = parseQuest({ ...testQuestData, tunnels: [] });
const good = (r: EditResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};

describe('parseCells', () => {
  it('reads squares and blocks, and refuses anything else', () => {
    expect(parseCells('1,2 3,4')).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(parseCells('2,2-3,3')).toHaveLength(4);
    expect(parseCells('a,b')).toBeUndefined();
    expect(parseCells('')).toBeUndefined();
  });
});

describe('suggested texture pack', () => {
  it('sets, clears and survives export and import', () => {
    const a = good(setSuggestedPack(q, ' pack-fh '));
    expect(a.suggestedPack).toBe('pack-fh');
    expect(JSON.parse(exportQuest(a)).suggestedPack).toBe('pack-fh');
    expect(good(setSuggestedPack(a, '')).suggestedPack).toBeUndefined();
  });
});

describe('Frozen Horror features in the editor', () => {
  it('tunnels: one pair per design, ends differ and sit on the board', () => {
    const a = good(addTunnel(q, { design: 1, a: [4, 18], b: [20, 18] }));
    expect(a.tunnels).toHaveLength(1);
    expect(addTunnel(a, { design: 1, a: [5, 18], b: [6, 18] }).ok).toBe(false);
    expect(addTunnel(a, { design: 2, a: [5, 18], b: [5, 18] }).ok).toBe(false);
    expect(addTunnel(a, { design: 2, a: [5, 18], b: [40, 18] }).ok).toBe(false);
    expect(good(removeTunnel(a, a.tunnels[0]!.id)).tunnels).toEqual([]);
  });

  it('board tiles: add and remove by index', () => {
    const a = good(addBoardTile(q, { type: 'iceLedge', cells: [[6, 2]] }));
    expect(a.boardTiles[0]).toMatchObject({ type: 'iceLedge' });
    expect(good(removeBoardTile(a, 0)).boardTiles).toEqual([]);
    expect(removeBoardTile(a, 3).ok).toBe(false);
  });

  it('room tiles: one per room, null takes it away', () => {
    const a = good(setRoomTile(q, 'R03', 'iceVault'));
    const b = good(setRoomTile(a, 'R03', 'livingFog'));
    expect(b.roomTiles).toEqual([{ type: 'livingFog', area: 'R03' }]);
    expect(good(setRoomTile(b, 'R03', null)).roomTiles).toEqual([]);
    expect(setRoomTile(q, 'zz', 'iceVault').ok).toBe(false);
  });

  it('edge doors and the start outside them', () => {
    const a = good(addEdgeDoor(q, { cell: [0, 9], side: 'w', kind: 'ironEntry' }));
    const id = a.edgeDoors[0]!.id;
    expect(setStart(a, { door: 'nope' }).ok).toBe(false);
    expect(good(setStart(a, { door: id })).start).toEqual({ door: id });
    expect(good(removeEdgeDoor(a, id)).edgeDoors).toEqual([]);
  });

  it('door flags set and clear, and the leave line', () => {
    const d = q.doors[0]!.id;
    const a = good(setDoorFlags(q, d, { hiddenUntil: 'f1', lockedUntil: 'f2' }));
    expect(a.doors[0]).toMatchObject({ hiddenUntil: 'f1', lockedUntil: 'f2' });
    const b = good(setDoorFlags(a, d, { hiddenUntil: '' }));
    expect(b.doors[0]!.hiddenUntil).toBeUndefined();
    expect(b.doors[0]!.lockedUntil).toBe('f2');
    expect(setDoorFlags(q, 'zz', {}).ok).toBe(false);
    expect(good(setLeave(q, ' through the cave ')).leave).toBe('through the cave');
    expect(good(setLeave(good(setLeave(q, 'x')), '')).leave).toBeUndefined();
  });
});

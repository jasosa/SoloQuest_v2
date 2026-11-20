import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { rectCells } from '../editor/tiles';
import { parseQuest } from './loader';
import { testQuestData } from './testQuest';
import { validateQuestIssues } from './validate';

const make = (patch: Record<string, unknown>) =>
  parseQuest({ ...testQuestData, tunnels: [], boardTiles: [], roomTiles: [], ...patch });
const tileMessages = (patch: Record<string, unknown>) =>
  validateQuestIssues(make(patch), board)
    .filter((i) => /tile|tunnel|slide/.test(i.message))
    .map((i) => `${i.severity}: ${i.message}`);
const rect = (x: number, y: number, w: number, h: number) => rectCells([x, y], w, h);

describe('tile sizes and limits (decision 88)', () => {
  it('a tile of one of its sizes, turned or not, is fine', () => {
    expect(
      tileMessages({
        roomTiles: [
          { type: 'iceVault', cells: rect(2, 12, 3, 2) },
          { type: 'iceVault', cells: rect(8, 2, 3, 4) },
          { type: 'frozenCrypt', cells: rect(14, 8, 3, 5) },
        ],
        boardTiles: [
          { type: 'icyRiver', cells: rect(9, 12, 8, 1) },
          { type: 'icyRiver', cells: rect(1, 10, 1, 3) },
          { type: 'iceLedge', cells: rect(14, 14, 5, 3) },
        ],
      }),
    ).toEqual([]);
  });

  it('a size that is not one of the footprints names the tile and its sizes', () => {
    const m = tileMessages({ roomTiles: [{ type: 'iceVault', cells: rect(2, 12, 2, 2) }] });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/warning: room tile 1 \(iceVault\): Ice Vault comes as 3 x 2 or 4 x 3/);
    expect(m[0]).toMatch(/2 x 2/);
    const l = tileMessages({ boardTiles: [{ type: 'iceLedge', cells: rect(1, 1, 4, 4) }] });
    expect(l[0]).toMatch(/Ice ledge comes as 5 x 3, these squares are 4 x 4/);
    const bent = tileMessages({
      roomTiles: [{ type: 'livingFog', cells: [...rect(2, 12, 4, 3), [2, 15], [3, 15], [4, 15]] }],
    });
    expect(bent[0]).toMatch(/not a plain rectangle/);
  });

  it('too many of one size is a warning that names the tile and the limit', () => {
    const m = tileMessages({
      roomTiles: [
        { type: 'iceVault', cells: rect(2, 12, 3, 2) },
        { type: 'iceVault', cells: rect(8, 2, 2, 3) },
      ],
    });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(
      /room tile 2 \(iceVault\): too many Ice Vault tiles of 3 x 2: this map has 2, the limit is 1 of 3 x 2 and 1 of 4 x 3/,
    );
    const fog = tileMessages({
      roomTiles: [
        { type: 'livingFog', cells: rect(2, 12, 4, 4) },
        { type: 'livingFog', cells: rect(8, 2, 4, 4) },
      ],
    });
    expect(fog[0]).toMatch(
      /too many Living Fog Room tiles of 4 x 4: this map has 2, the limit is 1 of 4 x 4/,
    );
    const river = tileMessages({
      boardTiles: [
        { type: 'icyRiver', cells: rect(9, 12, 3, 1) },
        { type: 'icyRiver', cells: rect(9, 14, 3, 1) },
      ],
    });
    expect(river[0]).toMatch(/board tile 2 \(icyRiver\): too many Icy river tiles of 1 x 3/);
  });

  it('slippery ice has no limit', () => {
    expect(
      tileMessages({
        boardTiles: [0, 1, 2, 3, 4].map((i) => ({
          type: 'slipperyIce',
          cells: rect(2 + i * 2, 13, 1, 1),
        })),
      }),
    ).toEqual([]);
  });

  it('room tiles may not overlap, and a tile over squares may not be in rock', () => {
    const o = tileMessages({
      roomTiles: [
        { type: 'livingFog', cells: rect(2, 12, 4, 4) },
        { type: 'scepterRoom', cells: rect(5, 12, 4, 4) },
      ],
    });
    expect(o.join('|')).toMatch(
      /room tile 2 \(scepterRoom\) overlaps room tile 1 \(livingFog\) at 5,12/,
    );
    const r = tileMessages({ roomTiles: [{ type: 'livingFog', cells: rect(11, 0, 4, 4) }] });
    expect(r.join('|')).toMatch(/error: room tile 1 \(livingFog\): cell 13,0 is in rock/);
  });

  it('more than three tunnel pairs and a bad ice slide are warnings', () => {
    const tunnels = [1, 2, 3, 4].map((d) => ({
      id: `tun${d}`,
      design: d,
      a: [8, 8 + d],
      b: [9, 8 + d],
    }));
    expect(tileMessages({ tunnels }).join('|')).toMatch(
      /warning: ice tunnels: this map has 4 pairs, the limit is 3 pairs/,
    );
    expect(tileMessages({ tunnels: tunnels.slice(0, 3) })).toEqual([]);
    const slide = (id: string, n: number, y: number) => ({
      id,
      kind: 'iceSlide',
      cell: [1, y],
      path: Array.from({ length: n }, (_, i) => [1 + i, y]),
    });
    expect(tileMessages({ traps: [slide('s1', 8, 9)] })).toEqual([]);
    expect(tileMessages({ traps: [slide('s1', 6, 9)] })[0]).toMatch(
      /ice slide s1: the Ice Slide comes as 1 x 8, this path has 6 squares/,
    );
    expect(tileMessages({ traps: [slide('s1', 8, 9), slide('s2', 8, 10)] })[0]).toMatch(
      /ice slide s2: this map has 2 ice slides, the limit is 1/,
    );
  });

  it('the game checks (not the editor) stay quiet', () => {
    const q = make({ roomTiles: [{ type: 'iceVault', cells: rect(2, 12, 2, 2) }] });
    expect(validateQuestIssues(q, board, { editor: false })).toEqual([]);
  });
});

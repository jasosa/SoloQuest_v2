import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { newRuleHints, unthreatenedMovement } from './ruleHints';
import { reduce, replay } from './reducer';
import { boardTilesAt, boardTilesInArea } from './view';

// An icy river on the bottom corridor (14..15, 18), a ledge in R17, an Ice Vault tile on R17.
const make = (patch: Record<string, unknown> = {}) =>
  parseQuest({
    ...testQuestData,
    blocks: [],
    boardTiles: [
      {
        type: 'icyRiver',
        cells: [
          [4, 18],
          [5, 18],
        ],
      },
      {
        type: 'iceLedge',
        cells: [
          [5, 16],
          [5, 17],
        ],
      },
    ],
    roomTiles: [{ type: 'iceVault', area: 'R17' }],
    ...patch,
  });
const lv = buildLevel(make());
const start = replay(lv, 1, []);

describe('rule hints: terrain and room tiles on first reveal', () => {
  it('terrain that comes into view gives its rule, once', () => {
    const after = reduce(lv, start, { type: 'OPEN_DOOR', door: 'd1' }).state;
    const hints = newRuleHints(lv, start, after);
    expect(hints.map((h) => h.name)).toEqual(['Icy river']);
    expect(hints[0]?.lines[0]).toMatch(/counts as 2 squares/);
    // nothing new the second time
    expect(newRuleHints(lv, after, after)).toEqual([]);
  });

  it('a room tile gives its rule when its room is revealed, with the terrain in it', () => {
    const inCorridor = reduce(lv, start, { type: 'OPEN_DOOR', door: 'd1' }).state;
    const inRoom = reduce(lv, start, { type: 'OPEN_DOOR', door: 'd2' }).state;
    const hints = newRuleHints(lv, start, inRoom);
    expect(hints.map((h) => h.name).sort()).toEqual(['Ice Vault', 'Ice ledge']);
    expect(newRuleHints(lv, inCorridor, inRoom).map((h) => h.name)).toContain('Ice Vault');
  });

  it('finds the terrain under a square and inside a room', () => {
    const s = reduce(lv, start, { type: 'OPEN_DOOR', door: 'd1' }).state;
    expect(boardTilesAt(lv, s, [4, 18]).map((t) => t.type)).toEqual(['icyRiver']);
    expect(boardTilesAt(lv, s, [9, 18])).toEqual([]);
    const r = reduce(lv, start, { type: 'OPEN_DOOR', door: 'd2' }).state;
    expect(boardTilesInArea(lv, r, 'R17').map((t) => t.type)).toEqual(['iceLedge']);
  });

  it('the terrain squares must be on the board', () => {
    const bad = make({ boardTiles: [{ type: 'chasm', cells: [[40, 3]] }] });
    expect(validateQuest(bad, board).join(' ')).toMatch(/board/i);
    expect(validateQuest(make(), board)).toEqual([]);
  });
});

describe('unthreatened movement', () => {
  it('is only for expansion quests, and only while no seen monster is awake', () => {
    // the test quest is a core-style quest: no hint
    expect(unthreatenedMovement(lv, start)).toBe(false);
    const fh = buildLevel(make({ pack: 'frozen-horror' }));
    expect(unthreatenedMovement(fh, replay(fh, 1, []))).toBe(true);
    // the orc of R17 comes into view and is awake
    const seen = replay(fh, 1, [{ type: 'OPEN_DOOR', door: 'd2' }]);
    expect(unthreatenedMovement(fh, seen)).toBe(false);
    const dead = reduce(fh, seen, { type: 'MONSTER_KILL', monster: 'm1' }).state;
    expect(unthreatenedMovement(fh, dead)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { initialState, reduce, replay, undo } from './reducer';

const SEED = 3;
const lvOf = (patch: Record<string, unknown> = {}) => buildLevel(testQuest(patch));
const level = lvOf();
const reveal = (x: number, y: number): GameEvent => ({ type: 'REVEAL_AREA', cell: [x, y] });
const run = (...events: GameEvent[]) => replay(level, SEED, events);
const text = (t: string) => ({ type: 'showText', text: t }) as const;
const code = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
};

describe('REVEAL_AREA (decision 95)', () => {
  it('a room square reveals the room exactly as its door does', () => {
    const byDoor = run({ type: 'OPEN_DOOR', door: 'd2' }); // R17: orc m1, chest f1, pit t1
    const byTap = run(reveal(6, 15));
    for (const key of [
      'seenCells',
      'seenFurniture',
      'seenMonsters',
      'seenTraps',
      'seenDoors',
      'seenBlocks',
      'revealedRooms',
    ] as const)
      expect([...byTap[key]].sort(), key).toEqual([...byDoor[key]].sort());
    expect(byTap.seenMonsters.has('m1')).toBe(true);
    expect(byTap.seenFurniture.has('f1')).toBe(true);
    expect(byTap.seenTraps.has('t1')).toBe(true);
    expect(byTap.openDoors.size).toBe(0); // the door stays closed
    expect(byTap.seenDoors.has('d3')).toBe(true); // a closed door on the room's walls shows
  });

  it('gives a revealed prompt with the new squares, and fires monsterSeen and areaRevealed notes', () => {
    const lv = lvOf({
      notes: [
        {
          id: 'n17',
          trigger: { type: 'areaRevealed', area: 'R17' },
          effects: [text('A messy room.')],
        },
        {
          id: 'orc',
          trigger: { type: 'monsterSeen', monster: 'm1' },
          effects: [text('The orc growls.')],
        },
      ],
    });
    const r = reduce(lv, initialState(lv, SEED), reveal(6, 15));
    const kinds = r.prompts.map((p) => p.kind);
    expect(kinds).toContain('revealed');
    const shown = r.prompts.flatMap((p) => (p.kind === 'note' ? p.texts : []));
    expect(shown).toEqual(expect.arrayContaining(['A messy room.', 'The orc growls.']));
    const rev = r.prompts.find((p) => p.kind === 'revealed');
    expect(rev && 'cells' in rev && rev.cells.includes('5,15')).toBe(true);
    expect(r.state.notesFired).toEqual(expect.arrayContaining(['n17', 'orc']));
  });

  it('a corridor square reveals what is in sight from it, and stops at a block', () => {
    const s = run(reveal(3, 18));
    expect(s.seenCells.has('3,18')).toBe(true);
    expect(s.seenCells.has('0,18')).toBe(true);
    expect(s.seenCells.has('7,18')).toBe(true);
    expect(s.seenCells.has('9,18')).toBe(false); // the block at (8,18) hides it
    expect(s.seenTraps.has('t3')).toBe(true); // the spear trap at (5,18)
    expect(s.revealedRooms.size).toBe(1); // closed doors hide the rooms: only the start room
    expect(s.looked.has('3,18')).toBe(true);
  });

  it('refuses rock, a seen square and a room that is already revealed, so no event is kept', () => {
    expect(code(() => run(reveal(13, 0)))).toBe('REVEAL_ROCK');
    expect(code(() => run(reveal(2, 15)))).toBe('REVEAL_SEEN'); // the start room
    expect(code(() => run(reveal(6, 15), reveal(7, 16)))).toBe('REVEAL_SEEN');
    expect(code(() => run(reveal(3, 18), reveal(3, 18)))).toBe('REVEAL_SEEN');
    expect(code(() => run(reveal(99, 3)))).toBe('BAD_CELL');
  });

  it('is one event: undo drops it and replay is exact', () => {
    const events = [reveal(6, 15)];
    const a = replay(level, SEED, events);
    const b = replay(level, SEED, events);
    expect(a).toEqual(b);
    const u = undo(level, SEED, events);
    expect(u.events).toEqual([]);
    expect(u.state).toEqual(initialState(level, SEED));
  });

  it('an old SHOW_LAYOUT event in a save replays and changes nothing', () => {
    const old: GameEvent = { type: 'SHOW_LAYOUT', cell: [6, 15] };
    expect(run(old)).toEqual(run());
    const s = run(old, { type: 'OPEN_DOOR', door: 'd2' });
    expect(s.seenMonsters.has('m1')).toBe(true);
  });
});

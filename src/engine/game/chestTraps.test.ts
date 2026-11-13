import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { EventError, reduce, replay, undo, type Prompt } from './reducer';
import { chestsInView, trapsInView } from './view';

const SEED = 5;
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const kill = (monster: string): GameEvent => ({ type: 'MONSTER_KILL', monster });
const st = (furniture: string, override?: boolean): GameEvent => ({
  type: 'SEARCH_TRAPS',
  furniture,
  ...(override !== undefined ? { override } : {}),
});
const treasure = (room: string, hero: 'elf' | 'dwarf'): GameEvent => ({
  type: 'SEARCH_TREASURE',
  room,
  hero,
});
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};
const kinds = (ps: readonly Prompt[]) => ps.map((p) => p.kind);

// Fixture: R17 holds orc m1, chest f1 (6,14),(7,14) with chest trap t2, pit t1.
const fx = buildLevel(testQuest());
const intoR17 = [open('d2'), kill('m1')];
const table = {
  id: 'f1',
  type: 'table',
  cells: [
    [6, 14],
    [7, 14],
  ],
};

describe('SEARCH_TRAPS (chests only)', () => {
  it('finds the hidden trap: "?" appears, kind stays hidden', () => {
    const s = replay(fx, SEED, intoR17);
    expect(s.seenTraps.has('t2')).toBe(false);
    expect(chestsInView(fx, s)).toEqual([
      {
        id: 'f1',
        cells: [
          [6, 14],
          [7, 14],
        ],
        room: 'R17',
        searched: false,
        trapFound: false,
      },
    ]);
    const r = reduce(fx, s, st('f1'));
    expect(r.prompts).toEqual([{ kind: 'trapFound', furniture: 'f1', trap: 't2' }]);
    expect(r.state.seenTraps.has('t2')).toBe(true);
    expect(r.state.trapSearched).toEqual(['f1']);
    expect(chestsInView(fx, r.state)[0]).toMatchObject({ searched: true, trapFound: true });
    expect(trapsInView(fx, r.state).find((t) => t.id === 't2')).toMatchObject({
      state: 'armed',
      onMap: true,
    });
    expect(JSON.stringify(r.prompts)).not.toContain('chest');
  });

  it('a chest with no trap says so, and trapFound stays false', () => {
    const lv = buildLevel(testQuest({ traps: [] }));
    const r = reduce(lv, replay(lv, SEED, intoR17), st('f1'));
    expect(r.prompts).toEqual([{ kind: 'noTrap', furniture: 'f1' }]);
    expect(chestsInView(lv, r.state)[0]).toMatchObject({ searched: true, trapFound: false });
  });

  it('finds all traps on the chest, one search only', () => {
    const lv = buildLevel(
      testQuest({
        traps: [
          { id: 't2', kind: 'chest', furniture: 'f1' },
          { id: 't5', kind: 'chest', furniture: 'f1' },
        ],
      }),
    );
    const r = reduce(lv, replay(lv, SEED, intoR17), st('f1'));
    expect(r.prompts).toEqual([
      { kind: 'trapFound', furniture: 'f1', trap: 't2' },
      { kind: 'trapFound', furniture: 'f1', trap: 't5' },
    ]);
    expect(code(() => reduce(lv, r.state, st('f1')))).toBe('ALREADY_SEARCHED');
    expect(code(() => reduce(lv, r.state, st('f1', true)))).toBe('ALREADY_SEARCHED');
  });

  it('found and armed springs on a treasure search; found and disarmed does not', () => {
    const found = replay(fx, SEED, [...intoR17, st('f1')]);
    const sprung = reduce(fx, found, treasure('R17', 'elf'));
    expect(kinds(sprung.prompts)).toEqual(['trapSprung', 'drawCard']);
    expect(chestsInView(fx, sprung.state)[0]).toMatchObject({ searched: true, trapFound: false });
    const disarmed = replay(fx, SEED, [
      ...intoR17,
      st('f1'),
      { type: 'TRAP_DISARM', trap: 't2', by: 'toolkit', result: 'other' },
    ]);
    expect(kinds(reduce(fx, disarmed, treasure('R17', 'elf')).prompts)).toEqual(['drawCard']);
  });

  it('a hidden trap sprung by a treasure search: a trap search then finds nothing', () => {
    const s = replay(fx, SEED, [...intoR17, treasure('R17', 'elf')]);
    expect(reduce(fx, s, st('f1')).prompts).toEqual([{ kind: 'noTrap', furniture: 'f1' }]);
  });

  it('guard with living monsters and wanderers, with override', () => {
    const s = replay(fx, SEED, [open('d2')]);
    expect(code(() => reduce(fx, s, st('f1')))).toBe('MONSTERS_IN_ROOM');
    expect(reduce(fx, s, st('f1', true)).prompts[0]).toMatchObject({ kind: 'trapFound' });
    const lv = buildLevel(testQuest({ wandering: { monster: 'orc' } }));
    const w = replay(lv, SEED, [
      ...intoR17,
      { type: 'WANDERING_MONSTER', room: 'R17', hero: 'elf' },
    ]);
    expect(code(() => reduce(lv, w, st('f1')))).toBe('MONSTERS_IN_ROOM');
    expect(code(() => reduce(lv, w, st('f1', true)))).toBeUndefined();
  });

  it('rejects unknown furniture, non-chests and unseen chests', () => {
    expect(code(() => reduce(fx, replay(fx, SEED, intoR17), st('zz')))).toBe('UNKNOWN_FURNITURE');
    const tbl = buildLevel(testQuest({ furniture: [table] }));
    expect(code(() => reduce(tbl, replay(tbl, SEED, intoR17), st('f1')))).toBe('NOT_A_CHEST');
    expect(code(() => reduce(fx, replay(fx, SEED, []), st('f1')))).toBe('FURNITURE_NOT_SEEN');
  });

  it('a trap on non-chest furniture stays hidden and springs on a treasure search', () => {
    const tbl = buildLevel(testQuest({ furniture: [table] }));
    const s = replay(tbl, SEED, intoR17);
    expect(s.seenTraps.has('t2')).toBe(false);
    expect(chestsInView(tbl, s)).toEqual([]);
    expect(kinds(reduce(tbl, s, treasure('R17', 'elf')).prompts)).toEqual([
      'trapSprung',
      'drawCard',
    ]);
  });

  it('undo and replay are deterministic', () => {
    const events: GameEvent[] = [...intoR17, st('f1'), treasure('R17', 'elf')];
    const full = replay(fx, SEED, events);
    expect(undo(fx, SEED, events).state).toEqual(replay(fx, SEED, events.slice(0, -1)));
    expect(replay(fx, SEED, events)).toEqual(full);
    expect(undo(fx, SEED, events.slice(0, 3)).state.trapSearched).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import type { GameEvent } from './events';
import { replay } from './reducer';

// The thief of a quest runs off with the key: a note on "left" sets a flag (Frozen Horror Q9 and Q10).
const OPEN: GameEvent[] = [
  { type: 'OPEN_DOOR', door: 'd2' },
  { type: 'OPEN_DOOR', door: 'd3' },
];
const note = (id: string, trigger: Record<string, unknown>, flag: string) => ({
  id,
  trigger,
  effects: [{ type: 'setFlag', flag, value: true }],
});
const make = (notes: unknown[]) =>
  buildLevel(
    parseQuest({
      ...testQuestData,
      notes,
      monsters: [
        { id: 'm1', type: 'orc', cell: [6, 15] },
        { id: 'm2', type: 'goblin', cell: [10, 15] },
      ],
    }),
  );
const leave = (monster: string, reason: 'escaped' | 'freed'): GameEvent => ({
  type: 'MONSTER_LEAVE',
  monster,
  reason,
});

describe('monsterLeft trigger', () => {
  const lv = make([
    note('any', { type: 'monsterLeft' }, 'anyLeft'),
    {
      id: 'count',
      trigger: { type: 'monsterLeft' },
      effects: [{ type: 'addCounter', counter: 'left', by: 1 }],
    },
    {
      id: 'count1',
      trigger: { type: 'monsterLeft', monster: 'm1' },
      effects: [{ type: 'addCounter', counter: 'leftM1', by: 1 }],
    },
    note('m1', { type: 'monsterLeft', monster: 'm1' }, 'm1Left'),
    note('esc', { type: 'monsterLeft', reason: 'escaped' }, 'escaped'),
    note('kind', { type: 'monsterLeft', monsterType: 'goblin' }, 'goblinLeft'),
  ]);

  it('fires when a monster escapes, with its id, kind and reason as limits', () => {
    const s = replay(lv, 1, [...OPEN, leave('m1', 'escaped')]);
    expect(s.flags).toMatchObject({ anyLeft: true, m1Left: true, escaped: true });
    expect(s.flags['goblinLeft']).toBeUndefined();
  });

  it('a freed monster does not fire the "escaped" note, and a kind note matches the kind', () => {
    const s = replay(lv, 1, [...OPEN, leave('m2', 'freed')]);
    expect(s.flags).toMatchObject({ anyLeft: true, goblinLeft: true });
    expect(s.flags['escaped']).toBeUndefined();
    expect(s.flags['m1Left']).toBeUndefined();
  });

  it('a slain monster is not a monster that left', () => {
    const s = replay(lv, 1, [...OPEN, { type: 'MONSTER_KILL', monster: 'm1' }]);
    expect(s.flags['anyLeft']).toBeUndefined();
  });

  it('a note for one monster fires once; one for any monster fires each time', () => {
    const s = replay(lv, 1, [...OPEN, leave('m1', 'freed'), leave('m2', 'escaped')]);
    expect(s.counters['left']).toBe(2);
    expect(s.counters['leftM1']).toBe(1);
  });

  it('the validator refuses an unknown monster and both a monster and a kind', () => {
    const bad = parseQuest({
      ...testQuestData,
      notes: [
        note('a', { type: 'monsterLeft', monster: 'nope' }, 'f'),
        note('b', { type: 'monsterLeft', monster: 'm1', monsterType: 'orc' }, 'f'),
      ],
      monsters: [{ id: 'm1', type: 'orc', cell: [6, 15] }],
    });
    const msgs = validateQuest(bad, board).join(' | ');
    expect(msgs).toMatch(/unknown monster nope/);
    expect(msgs).toMatch(/monster or a monsterType, not both/);
  });
});

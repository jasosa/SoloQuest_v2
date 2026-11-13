import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { MONSTER_STATS, statsOf } from '../data/monsters';
import { MONSTER_TYPES } from '../quest/schema';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { EventError, initialState, reduce, replay, undo, type EventErrorCode } from './reducer';
import { monstersInPlay } from './view';

const level = buildLevel(testQuest());
const SEED = 5;
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const hurt = (monster: string, amount: number): GameEvent => ({
  type: 'MONSTER_DAMAGE',
  monster,
  amount,
});
const heal = (monster: string, amount: number): GameEvent => ({
  type: 'MONSTER_HEAL',
  monster,
  amount,
});
const kill = (monster: string): GameEvent => ({ type: 'MONSTER_KILL', monster });
const run = (...events: GameEvent[]) => replay(level, SEED, events);
const codeOf = (...events: GameEvent[]): EventErrorCode | undefined => {
  try {
    run(...events);
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};

// d2 reveals R17 with an orc (m1). The goblin m2 is in another room, the gargoyle m3 is hidden.
const seen = [open('d2')];
const withBody = (id: string) => replay(level, SEED, seen).monsters[id];

describe('statsOf', () => {
  it('has stats for every monster type', () => {
    for (const t of MONSTER_TYPES) expect(MONSTER_STATS[t].att).toBeGreaterThan(0);
  });

  it('uses the base table and applies overrides', () => {
    expect(statsOf({ type: 'orc' })).toEqual({ move: 8, att: 3, def: 2, body: 1, mind: 2 });
    expect(statsOf({ type: 'mummy', overrides: { att: 4, body: 5 } })).toEqual({
      move: 4,
      att: 4,
      def: 4,
      body: 5,
      mind: 0,
    });
  });
});

describe('monster Body Points', () => {
  it('starts a record when a monster is seen, and not before', () => {
    expect(initialState(level, SEED).monsters).toEqual({});
    expect(withBody('m1')).toEqual({ body: 1, dead: false });
    expect(withBody('m3')).toBeUndefined();
  });

  it('damage lowers body and kills at 0 (no negative body)', () => {
    const s = run(...seen, hurt('m1', 5));
    expect(s.monsters.m1).toEqual({ body: 0, dead: true });
  });

  it('heal is capped at the maximum', () => {
    const quest = testQuest();
    const lv = buildLevel({
      ...quest,
      monsters: quest.monsters.map((m) => (m.id === 'm1' ? { ...m, overrides: { body: 4 } } : m)),
    });
    let s = replay(lv, SEED, [open('d2'), hurt('m1', 3)]);
    expect(s.monsters.m1).toEqual({ body: 1, dead: false });
    s = reduce(lv, s, heal('m1', 1)).state;
    expect(s.monsters.m1?.body).toBe(2);
    s = reduce(lv, s, heal('m1', 10)).state;
    expect(s.monsters.m1).toEqual({ body: 4, dead: false });
  });

  it('kill sets body 0 and dead', () => {
    expect(run(...seen, kill('m1')).monsters.m1).toEqual({ body: 0, dead: true });
  });

  it('does not change the input state', () => {
    const s = run(...seen);
    reduce(level, s, hurt('m1', 1));
    expect(s.monsters.m1).toEqual({ body: 1, dead: false });
  });

  it('ZARGON_TURN_END adds one to the turn', () => {
    const s = run({ type: 'ZARGON_TURN_END' }, { type: 'ZARGON_TURN_END' });
    expect(s.turn).toBe(3);
  });
});

describe('rejected events', () => {
  it('unknown monster', () => {
    expect(codeOf(hurt('nope', 1))).toBe('UNKNOWN_MONSTER');
    expect(codeOf(kill('nope'))).toBe('UNKNOWN_MONSTER');
  });

  it('monster not seen yet, or hidden', () => {
    expect(codeOf(hurt('m1', 1))).toBe('MONSTER_NOT_SEEN');
    expect(codeOf(...seen, heal('m2', 1))).toBe('MONSTER_NOT_SEEN');
    expect(codeOf(...seen, kill('m3'))).toBe('MONSTER_NOT_SEEN');
  });

  it('dead monster', () => {
    expect(codeOf(...seen, kill('m1'), hurt('m1', 1))).toBe('MONSTER_DEAD');
    expect(codeOf(...seen, kill('m1'), heal('m1', 1))).toBe('MONSTER_DEAD');
    expect(codeOf(...seen, kill('m1'), kill('m1'))).toBe('MONSTER_DEAD');
  });

  it('bad amount', () => {
    for (const n of [0, -1, 1.5, Number.NaN]) {
      expect(codeOf(...seen, hurt('m1', n))).toBe('BAD_AMOUNT');
      expect(codeOf(...seen, heal('m1', n))).toBe('BAD_AMOUNT');
    }
  });
});

describe('undo and replay', () => {
  const log: GameEvent[] = [open('d2'), hurt('m1', 1), { type: 'ZARGON_TURN_END' }, open('d1')];

  it('replay is deterministic', () => {
    expect(replay(level, SEED, log)).toEqual(replay(level, SEED, log));
  });

  it('undo of a kill brings the monster back', () => {
    const events = [...seen, kill('m1')];
    expect(replay(level, SEED, events).monsters.m1?.dead).toBe(true);
    const u = undo(level, SEED, events);
    expect(u.state.monsters.m1).toEqual({ body: 1, dead: false });
    expect(u.state).toEqual(replay(level, SEED, seen));
  });
});

describe('monstersInPlay', () => {
  it('lists only seen monsters, with names, stats and body', () => {
    expect(monstersInPlay(level, initialState(level, SEED))).toEqual([]);
    const list = monstersInPlay(level, run(...seen, kill('m1')));
    expect(list).toEqual([
      {
        id: 'm1',
        type: 'orc',
        name: 'Orc',
        stats: MONSTER_STATS.orc,
        body: 0,
        maxBody: 1,
        dead: true,
        state: 'active',
      },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { testQuest } from '../quest/testQuest';
import { ordersFor } from '../zargon/orders';
import type { GameEvent } from './events';
import { EventError, reduce, replay } from './reducer';
import { monstersInPlay } from './view';

const SEED = 5;
const lv = buildLevel(testQuest({ wandering: { monster: 'orc' } }));
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const add = (cell: [number, number], monsterType: 'goblin' | 'orc' = 'goblin'): GameEvent => ({
  type: 'ADD_MONSTER',
  monsterType,
  cell,
});
const code = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return e instanceof EventError ? e.code : 'other';
  }
  return undefined;
};

describe('monsters added in play (decision 66)', () => {
  it('an added monster joins the roster on the square the players entered', () => {
    const s = replay(lv, SEED, [add([4, 17], 'orc')]);
    const m = monstersInPlay(lv, s).find((x) => x.id === 'w1')!;
    expect(m).toMatchObject({ type: 'orc', added: true, cell: [4, 17], body: 1, dead: false });
    expect(m.wandering).toBe(false);
    expect(m.fresh).toBe(false);
    expect(m.wanderAt).toBeUndefined();
  });

  it('it can be slain and gets a Zargon order like any monster', () => {
    const s = replay(lv, SEED, [add([4, 17])]);
    const o = ordersFor(lv, s, ['barbarian', 'dwarf']).find((x) => x.monster === 'w1');
    expect(o?.status).toBe('act');
    const dead = reduce(lv, s, { type: 'MONSTER_KILL', monster: 'w1' }).state;
    expect(monstersInPlay(lv, dead).find((x) => x.id === 'w1')?.dead).toBe(true);
  });

  it('ids never clash with quest monsters or earlier added ones', () => {
    const s = replay(lv, SEED, [add([4, 17]), add([5, 17])]);
    expect(monstersInPlay(lv, s).map((m) => m.id)).toEqual(expect.arrayContaining(['w1', 'w2']));
  });

  it('refuses a square outside the board or in rock', () => {
    expect(code(() => reduce(lv, replay(lv, SEED, []), add([99, 99])))).toBe('BAD_CELL');
    expect(code(() => reduce(lv, replay(lv, SEED, []), add([-1, 0])))).toBe('BAD_CELL');
  });

  it('a wandering monster keeps its attack at once and takes the square the players enter', () => {
    const s = replay(lv, SEED, [
      open('d2'),
      { type: 'WANDERING_MONSTER', room: 'R17', hero: 'elf', cell: [4, 16] },
    ]);
    const m = monstersInPlay(lv, s).find((x) => x.id === 'w1')!;
    expect(m).toMatchObject({ wandering: true, fresh: true, wanderAt: 'elf', cell: [4, 16] });
  });

  it('a wandering monster without a square still works (older saves)', () => {
    const s = replay(lv, SEED, [
      open('d2'),
      { type: 'WANDERING_MONSTER', room: 'R17', hero: 'elf' },
    ]);
    expect(monstersInPlay(lv, s).find((x) => x.id === 'w1')?.cell).toBeUndefined();
  });

  it('undo drops the added monster (it is an event)', () => {
    const s = replay(lv, SEED, [add([4, 17])]);
    expect(monstersInPlay(lv, s).some((m) => m.id === 'w1')).toBe(true);
    expect(monstersInPlay(lv, replay(lv, SEED, [])).some((m) => m.id === 'w1')).toBe(false);
  });
});

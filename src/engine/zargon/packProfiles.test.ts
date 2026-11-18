import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { EventError } from '../game/errors';
import { monstersInPlay } from '../game/view';
import { replay } from '../game/reducer';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { ordersFor, turnProgress } from './orders';

const TEAM = ['barbarian', 'dwarf'] as const;
const OPEN = [
  { type: 'OPEN_DOOR', door: 'd2' },
  { type: 'OPEN_DOOR', door: 'd3' },
] as const;

const make = (monster: Record<string, unknown>) =>
  buildLevel(
    parseQuest({
      ...testQuestData,
      notes: [],
      monsters: [{ id: 'm1', type: 'orc', cell: [6, 15], ...monster }],
    }),
  );

const orderOf = (monster: Record<string, unknown>, seed = 1) => {
  const lv = make(monster);
  const s = replay(lv, seed, [...OPEN]);
  return ordersFor(lv, s, [...TEAM]).find((x) => x.monster === 'm1');
};

describe('pack profiles (decision 49)', () => {
  it('thief: the plan names the steal or the attack, and the escape rule', () => {
    const plans = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const o = orderOf({ profile: 'thief' }, seed);
      expect(o?.profile).toBe('thief');
      plans.add(o!.plan!.startsWith('Steal') ? 'steal' : 'attack');
      expect(o!.plan).toMatch(/tap Escaped/);
    }
    expect(plans).toEqual(new Set(['steal', 'attack']));
  });

  it('grappler and shooter have their own plan lines', () => {
    expect(orderOf({ profile: 'grappler' })?.plan).toMatch(/hugging/i);
    const shots = new Set<boolean>();
    for (let seed = 1; seed <= 40; seed++)
      shots.add(/step back/.test(orderOf({ profile: 'shooter' }, seed)!.plan!));
    expect(shots).toEqual(new Set([true, false]));
  });

  it('several attacks: one rule per attack, and the order stays the same after a reload', () => {
    const a = orderOf({
      profile: 'relentless',
      attacks: 2,
      weights: { closest: 3, highestAtt: 2 },
    });
    expect(a?.plan).toMatch(/Attack 1: The target above\. Attack 2: .+ It moves only once\./);
    expect(
      orderOf({ profile: 'relentless', attacks: 2, weights: { closest: 3, highestAtt: 2 } }),
    ).toEqual(a);
    expect(orderOf({ profile: 'relentless' })?.plan).not.toMatch(/Attack 1/);
  });

  it('the schema takes attacks and a 2 x 2 size, and refuses other values', () => {
    expect(() => make({ attacks: 2, size: 2 })).not.toThrow();
    expect(() => make({ attacks: 0 })).toThrow();
    expect(() => make({ size: 3 })).toThrow();
    expect(() => make({ profile: 'swarm' })).toThrow();
    const view = monstersInPlay(make({ size: 2 }), replay(make({ size: 2 }), 1, [...OPEN]));
    expect(view.find((v) => v.id === 'm1')?.size).toBe(2);
  });
});

describe('passive monsters and leaving the roster (decision 51)', () => {
  const lvPassive = make({ state: 'passive' });
  const seen = replay(lvPassive, 1, [...OPEN]);

  it('a passive monster is in the roster, has no orders and does not count for the turn', () => {
    const o = ordersFor(lvPassive, seen, [...TEAM]).find((x) => x.monster === 'm1');
    expect(o?.status).toBe('stone');
    expect(o?.note).toMatch(/It left/);
    expect(turnProgress(lvPassive, seen).total).toBe(0);
  });

  it('"A hero attacked it" makes it active, and only a passive monster can wake', () => {
    const woke = replay(lvPassive, 1, [...OPEN, { type: 'MONSTER_WAKE', monster: 'm1' }]);
    expect(turnProgress(lvPassive, woke).total).toBe(1);
    expect(() =>
      replay(lvPassive, 1, [
        ...OPEN,
        { type: 'MONSTER_WAKE', monster: 'm1' },
        { type: 'MONSTER_WAKE', monster: 'm1' },
      ]),
    ).toThrow(EventError);
  });

  it('"It left" and "Escaped" take it off the roster without a kill', () => {
    const lv = make({ profile: 'thief' });
    const gone = replay(lv, 1, [
      ...OPEN,
      { type: 'MONSTER_LEAVE', monster: 'm1', reason: 'escaped' },
    ]);
    expect(monstersInPlay(lv, gone).some((v) => v.id === 'm1')).toBe(false);
    expect(ordersFor(lv, gone, [...TEAM]).some((o) => o.monster === 'm1')).toBe(false);
    // not dead: it never counts as a kill
    expect(gone.monsters['m1']?.dead).toBe(false);
  });

  it('refuses to make an unseen monster leave', () => {
    const lv = make({});
    expect(() =>
      replay(lv, 1, [{ type: 'MONSTER_LEAVE', monster: 'm1', reason: 'freed' }]),
    ).toThrow(EventError);
  });
});

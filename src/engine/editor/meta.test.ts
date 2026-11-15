import { describe, expect, it } from 'vitest';
import {
  addObjective,
  removeObjective,
  setRules,
  setWandering,
  setZargonInfo,
  updateObjective,
} from './meta';
import { emptyQuest, type EditResult } from './ops';
import type { Quest } from '../quest/schema';

const base = () => emptyQuest({ id: 'user-t', number: 1, title: 'T' });

function ok(r: EditResult): Quest {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
}

describe('setZargonInfo', () => {
  it('sets, trims and clears', () => {
    const q = ok(setZargonInfo(base(), '  Watch out.  '));
    expect(q.zargonInfo).toBe('Watch out.');
    expect('zargonInfo' in ok(setZargonInfo(q, '  '))).toBe(false);
  });
});

describe('setWandering', () => {
  it('sets a monster, text, and clears', () => {
    const q = ok(setWandering(base(), { monster: 'orc' }));
    expect(q.wandering).toEqual({ monster: 'orc' });
    expect(ok(setWandering(q, { text: ' A rat ' })).wandering).toEqual({ text: 'A rat' });
    expect(ok(setWandering(q, null)).wandering).toBeUndefined();
  });
  it('refuses empty text', () => {
    expect(setWandering(base(), { text: ' ' }).ok).toBe(false);
  });
});

describe('objectives', () => {
  it('adds with a free id, updates and removes', () => {
    let q = ok(addObjective(base(), { text: 'Find the key' }));
    expect(q.objectives).toEqual([{ id: 'o1', text: 'Find the key' }]);
    q = ok(addObjective(q, { text: 'Kill it', done: { flag: 'dead' } }));
    expect(q.objectives[1]?.id).toBe('o2');
    q = ok(updateObjective(q, 'o2', { text: 'Kill the boss', done: null }));
    expect(q.objectives[1]).toEqual({ id: 'o2', text: 'Kill the boss' });
    q = ok(updateObjective(q, 'o1', { done: { monsterKilled: 'm1' } }));
    expect(q.objectives[0]?.done).toEqual({ monsterKilled: 'm1' });
    q = ok(removeObjective(q, 'o1'));
    expect(q.objectives.map((o) => o.id)).toEqual(['o2']);
  });
  it('refuses bad input and does not change the input quest', () => {
    const q = ok(addObjective(base(), { text: 'A', id: 'o1' }));
    expect(addObjective(q, { text: ' ' }).ok).toBe(false);
    expect(addObjective(q, { text: 'B', id: 'o1' }).ok).toBe(false);
    expect(addObjective(q, { text: 'B', id: 'bad id' }).ok).toBe(false);
    expect(updateObjective(q, 'zz', { text: 'x' }).ok).toBe(false);
    expect(removeObjective(q, 'zz').ok).toBe(false);
    expect(q.objectives).toHaveLength(1);
  });
});

describe('setRules', () => {
  it('sets, keeps others, and clears with null', () => {
    let q = ok(setRules(base(), { fallingBlock: 'Some rule', bounty: { orc: 10 } }));
    q = ok(setRules(q, { fallingBlock: null }));
    expect(q.rules).toEqual({ bounty: { orc: 10 } });
    expect(ok(setRules(q, {})).rules).toEqual({ bounty: { orc: 10 } });
  });
  it('refuses empty text', () => {
    expect(setRules(base(), { fallingBlock: ' ' }).ok).toBe(false);
  });
});

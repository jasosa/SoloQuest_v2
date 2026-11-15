import { describe, expect, it } from 'vitest';
import {
  addEnding,
  addObjective,
  removeEnding,
  updateEnding,
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

describe('endings', () => {
  it('adds with generated ids, trims, and keeps the quest valid', () => {
    const q = ok(addEnding(base(), { label: '  Sir Ragnar died ', text: ' Lost. ' }));
    expect(q.endings).toEqual([{ id: 'e1', label: 'Sir Ragnar died', text: 'Lost.' }]);
    const q2 = ok(addEnding(q, { label: 'Other', id: 'other' }));
    expect(q2.endings).toEqual([
      { id: 'e1', label: 'Sir Ragnar died', text: 'Lost.' },
      { id: 'other', label: 'Other' },
    ]);
  });
  it('refuses an empty label, a bad id and a duplicate id', () => {
    const q = ok(addEnding(base(), { label: 'A', id: 'a' }));
    expect(addEnding(q, { label: ' ' }).ok).toBe(false);
    expect(addEnding(q, { label: 'B', id: 'bad id' }).ok).toBe(false);
    expect(addEnding(q, { label: 'B', id: 'a' }).ok).toBe(false);
  });
  it('updates label and text, null clears the text', () => {
    const q = ok(addEnding(base(), { label: 'A', text: 'x', id: 'a' }));
    const u = ok(updateEnding(q, 'a', { label: 'B', text: 'y' }));
    expect(u.endings).toEqual([{ id: 'a', label: 'B', text: 'y' }]);
    expect(ok(updateEnding(u, 'a', { text: null })).endings).toEqual([{ id: 'a', label: 'B' }]);
    expect(updateEnding(u, 'a', { label: '' }).ok).toBe(false);
    expect(updateEnding(u, 'zz', {}).ok).toBe(false);
  });
  it('removes, and drops the field when the list is empty; the input is not changed', () => {
    const q = Object.freeze(ok(addEnding(base(), { label: 'A', id: 'a' })));
    const r = ok(removeEnding(q, 'a'));
    expect('endings' in r).toBe(false);
    expect(q.endings).toHaveLength(1);
    expect(removeEnding(q, 'zz').ok).toBe(false);
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

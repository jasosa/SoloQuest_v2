import { describe, expect, it } from 'vitest';
import type { Quest } from '../quest/schema';
import { testQuest } from '../quest/testQuest';
import {
  addMonster,
  emptyQuest,
  setFurnitureLetter,
  updateMonster,
  updateTrap,
  type EditResult,
} from './ops';
import { addSpell, updateSpell } from './meta';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
const good = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};
const bad = (r: EditResult): string => {
  if (r.ok) throw new Error('expected an error');
  return r.error;
};
const base = () => deepFreeze(testQuest());

describe('updateMonster', () => {
  it('sets name, overrides, traits, spells, limit and state, and clears them with null', () => {
    const q = good(
      updateMonster(base(), 'm1', {
        name: ' Gorak ',
        overrides: { body: 3, att: 4 },
        traits: ['Tough'],
        spells: ['fear', 'sleep'],
        spellLimit: 'onePerTurn',
        state: 'dormant',
        type: 'abomination',
      }),
    );
    expect(q.monsters.find((x) => x.id === 'm1')).toMatchObject({
      type: 'abomination',
      name: 'Gorak',
      overrides: { body: 3, att: 4 },
      traits: ['Tough'],
      spells: ['fear', 'sleep'],
      spellLimit: 'onePerTurn',
      state: 'dormant',
      cell: [6, 15],
    });
    const cleared = good(
      updateMonster(q, 'm1', {
        name: null,
        overrides: {},
        traits: null,
        spellLimit: null,
        spells: [],
        state: null,
      }),
    );
    expect(cleared.monsters.find((x) => x.id === 'm1')).toEqual({
      id: 'm1',
      type: 'abomination',
      cell: [6, 15],
    });
  });
  it('keeps ids and order, and does not touch the input', () => {
    const q0 = base();
    const q = good(updateMonster(q0, 'm2', { name: 'Snik' }));
    expect(q.monsters.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(q0.monsters[1]?.name).toBeUndefined();
  });
  it('refuses bad input with a readable message', () => {
    expect(bad(updateMonster(base(), 'zz', {}))).toMatch(/no monster zz/);
    expect(bad(updateMonster(base(), 'm1', { name: '  ' }))).toMatch(/name cannot be empty/);
    expect(bad(updateMonster(base(), 'm1', { overrides: { body: -1 } }))).toMatch(/body/);
    expect(bad(updateMonster(base(), 'm1', { overrides: { move: 1.5 } }))).toMatch(/move/);
    expect(bad(updateMonster(base(), 'm1', { spells: ['fireball'] }))).toMatch(/Unknown spell/);
    expect(bad(updateMonster(base(), 'm1', { traits: [' '] }))).toMatch(/empty/);
    expect(bad(updateMonster(base(), 'm1', { spellLimit: 'onePerTurn' }))).toMatch(/needs/);
  });
  it('hidden needs a square when it is switched off', () => {
    expect(bad(updateMonster(base(), 'm3', { hidden: false }))).toMatch(/needs a square/);
    const q = good(updateMonster(base(), 'm1', { hidden: true }));
    expect(q.monsters[0]?.hidden).toBe(true);
    expect(good(updateMonster(q, 'm1', { hidden: false })).monsters[0]?.hidden).toBeUndefined();
  });
  it('warns when a hidden monster no note places', () => {
    const r = updateMonster(base(), 'm1', { hidden: true });
    expect(r.ok && r.warnings.some((w) => w.ref?.id === 'm1')).toBe(true);
  });
});

describe('updateTrap', () => {
  it('changes kind and effect of a square trap and keeps id and place in the list', () => {
    const q = good(updateTrap(base(), 't1', { kind: 'spear', effect: 'Pointy' }));
    expect(q.traps.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(q.traps[0]).toEqual({ id: 't1', kind: 'spear', cell: [7, 16], effect: 'Pointy' });
    const c = good(updateTrap(q, 't1', { effect: null }));
    expect(c.traps[0]).toEqual({ id: 't1', kind: 'spear', cell: [7, 16] });
  });
  it('keeps the chest rule', () => {
    expect(bad(updateTrap(base(), 't1', { kind: 'chest' }))).toMatch(/furniture/);
    expect(bad(updateTrap(base(), 't2', { kind: 'pit' }))).toMatch(/square/);
    expect(bad(updateTrap(base(), 't1', { kind: 'chest', target: { furniture: 'f9' } }))).toMatch(
      /no furniture f9/,
    );
    const q = good(updateTrap(base(), 't2', { kind: 'pit', target: { cell: [9, 16] } }));
    expect(q.traps[1]).toEqual({ id: 't2', kind: 'pit', cell: [9, 16] });
    const back = good(updateTrap(q, 't2', { kind: 'chest', target: { furniture: 'f1' } }));
    expect(back.traps[1]).toEqual({ id: 't2', kind: 'chest', furniture: 'f1' });
  });
  it('can turn a chest trap scripted and keeps its furniture', () => {
    const q = good(updateTrap(base(), 't2', { kind: 'scripted', effect: 'Gas' }));
    expect(q.traps[1]).toEqual({ id: 't2', kind: 'scripted', furniture: 'f1', effect: 'Gas' });
  });
  it('refuses a square that is taken, a blank effect and an unknown trap', () => {
    expect(bad(updateTrap(base(), 't1', { target: { cell: [5, 18] } }))).toMatch(/trap t3/);
    expect(bad(updateTrap(base(), 't1', { effect: ' ' }))).toMatch(/cannot be empty/);
    expect(bad(updateTrap(base(), 'q', {}))).toMatch(/no trap q/);
  });
  it('can keep a trap on its own square (no clash with itself)', () => {
    const q = good(updateTrap(base(), 't1', { target: { cell: [7, 16] } }));
    expect(q.traps[0]?.cell).toEqual([7, 16]);
  });
});

describe('setFurnitureLetter', () => {
  it('sets and clears a letter, and warns about a missing note', () => {
    const r = setFurnitureLetter(base(), 'f1', ' B ');
    expect(r.ok && r.quest.furniture[0]?.letter).toBe('B');
    expect(r.ok && r.warnings.map((w) => w.message)).toEqual([
      expect.stringMatching(/letter B has no note/),
    ]);
    const c = good(setFurnitureLetter(good(r), 'f1', null));
    expect(c.furniture[0]).not.toHaveProperty('letter');
  });
  it('refuses empty letters, unknown furniture and stairs', () => {
    expect(bad(setFurnitureLetter(base(), 'f1', ' '))).toMatch(/cannot be empty/);
    expect(bad(setFurnitureLetter(base(), 'zz', 'A'))).toMatch(/no furniture/);
    const q = testQuest();
    const withStairs: Quest = {
      ...q,
      furniture: [{ id: 'st', type: 'stairs', cells: [[1, 14]] }, ...q.furniture],
    };
    expect(bad(setFurnitureLetter(withStairs, 'st', 'A'))).toMatch(/stairs/);
  });
});

describe('updateMonster behavior (decision 71)', () => {
  it('sets, clears and refuses an unknown marker', () => {
    let q = emptyQuest({ id: 'user-t', number: 1, title: 'T' });
    const a = addMonster(q, 'orc', [4, 17]);
    if (!a.ok) throw new Error(a.error);
    q = a.quest;
    const set = updateMonster(q, 'm1', { behavior: { waitsFor: 'heroInRoom' } });
    if (!set.ok) throw new Error(set.error);
    expect(set.quest.monsters[0]?.behavior).toEqual({ waitsFor: 'heroInRoom' });
    const cleared = updateMonster(set.quest, 'm1', { behavior: {} });
    if (!cleared.ok) throw new Error(cleared.error);
    expect(cleared.quest.monsters[0]?.behavior).toBeUndefined();
    expect(updateMonster(q, 'm1', { behavior: { goesToward: 'marker', marker: 'k9' } }).ok).toBe(
      false,
    );
  });
});

describe('updateMonster spellOrder', () => {
  const withSpells = () => {
    const q = base();
    return good(updateMonster(q, 'm1', { spells: ['fear', 'sleep'] }));
  };
  it('sets a place, rejects a bad one, and drops a place when its spell is removed', () => {
    const q = withSpells();
    const set = good(updateMonster(q, 'm1', { spellOrder: { sleep: 1 } }));
    expect(set.monsters.find((m) => m.id === 'm1')?.spellOrder).toEqual({ sleep: 1 });
    expect(bad(updateMonster(q, 'm1', { spellOrder: { sleep: 0 } }))).toMatch(/1 to 9/);
    const removed = good(updateMonster(set, 'm1', { spells: ['fear'] }));
    expect(removed.monsters.find((m) => m.id === 'm1')?.spellOrder).toBeUndefined();
  });
});

describe('spell timing', () => {
  it('a spell of the quest can be cast instead of moving; "either" is the default and is not stored', () => {
    const q = good(
      addSpell(base(), { name: 'Mud', question: 'Is it raining?', timing: 'instead' }),
    );
    const id = q.spellDefs[0]!.id;
    expect(q.spellDefs[0]?.timing).toBe('instead');
    const back = good(updateSpell(q, id, { timing: 'either' }));
    expect(back.spellDefs[0]?.timing).toBeUndefined();
  });
});

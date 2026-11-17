import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import type { Hero } from '../data/heroes';
import type { GameEvent } from '../game/events';
import { EventError, reduce, replay, undo } from '../game/reducer';
import { livingHeroes } from '../game/view';
import { testQuest } from '../quest/testQuest';
import { availableRules, grudgeHero, ordersFor } from './orders';

const SEED = 9;
const TEAM: Hero[] = ['barbarian', 'dwarf', 'elf', 'wizard'];
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const died = (hero: Hero): GameEvent => ({ type: 'HERO_DIED', hero });
const level = buildLevel(testQuest());
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};

describe('HERO_DIED', () => {
  it('records deaths in order, with a prompt, and is undone by dropping the event', () => {
    const r = reduce(level, replay(level, SEED, [died('elf')]), died('dwarf'));
    expect(r.state.deadHeroes).toEqual(['elf', 'dwarf']);
    expect(r.prompts).toEqual([{ kind: 'heroDied', hero: 'dwarf' }]);
    expect(undo(level, SEED, [died('elf'), died('dwarf')]).state.deadHeroes).toEqual(['elf']);
  });

  it('rejects an unknown hero and a repeat', () => {
    expect(code(() => replay(level, SEED, [{ type: 'HERO_DIED', hero: 'knight' as Hero }]))).toBe(
      'UNKNOWN_HERO',
    );
    expect(code(() => replay(level, SEED, [died('elf'), died('elf')]))).toBe('ALREADY_DEAD');
  });

  it('livingHeroes filters the team and keeps its order', () => {
    const s = replay(level, SEED, [died('dwarf')]);
    expect(livingHeroes(['wizard', 'dwarf', 'elf'], s)).toEqual(['wizard', 'elf']);
  });

  it('a dead hero cannot search, wander or disarm as the Dwarf', () => {
    const dead = [died('dwarf'), died('elf')];
    expect(
      code(() =>
        replay(level, SEED, [...dead, { type: 'SEARCH_TREASURE', room: 'R20', hero: 'dwarf' }]),
      ),
    ).toBe('HERO_DEAD');
    expect(
      code(() =>
        replay(level, SEED, [...dead, { type: 'SEARCH_TREASURE', room: 'R20', hero: 'wizard' }]),
      ),
    ).toBeUndefined();
    const w = buildLevel(testQuest({ wandering: { monster: 'skeleton' } }));
    expect(
      code(() =>
        replay(w, SEED, [...dead, { type: 'WANDERING_MONSTER', room: 'R20', hero: 'elf' }]),
      ),
    ).toBe('HERO_DEAD');
    const seen = [open('d2'), died('dwarf')];
    expect(
      code(() =>
        replay(level, SEED, [
          ...seen,
          { type: 'TRAP_DISARM', trap: 't1', by: 'dwarf', result: 'other' },
        ]),
      ),
    ).toBe('HERO_DEAD');
    expect(
      code(() =>
        replay(level, SEED, [
          ...seen,
          { type: 'TRAP_DISARM', trap: 't1', by: 'toolkit', result: 'other' },
        ]),
      ),
    ).toBeUndefined();
  });
});

describe('orders after a death (decision 32)', () => {
  const lv = buildLevel(
    testQuest({
      monsters: [
        { id: 'a', type: 'orc', cell: [6, 15] },
        { id: 'b', type: 'dreadWarrior', cell: [8, 16] },
        { id: 'm3', type: 'gargoyle', hidden: true },
      ],
    }),
  );
  const seen = [open('d2')];

  it('takes dead heroes out of the tie list and keeps the relative order', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const full = ordersFor(lv, replay(lv, seed, seen), TEAM);
      const after = ordersFor(lv, replay(lv, seed, [...seen, died('dwarf')]), TEAM);
      for (let i = 0; i < full.length; i++)
        expect(after[i]!.tie).toEqual(full[i]!.tie.filter((h) => h !== 'dwarf'));
    }
  });

  it('is an empty list when every hero is dead', () => {
    const s = replay(lv, SEED, [...seen, ...TEAM.map(died)]);
    expect(ordersFor(lv, s, TEAM)).toEqual([]);
  });

  it('works for a lone survivor', () => {
    const s = replay(lv, SEED, [...seen, died('barbarian'), died('dwarf'), died('elf')]);
    for (const o of ordersFor(lv, s, TEAM)) expect(o.tie).toEqual(['wizard']);
  });

  it('never names a dead grudge hero, never offers grudge for him, keeps the others', () => {
    let sawGrudge = false;
    for (let seed = 1; seed <= 200; seed++) {
      const g = grudgeHero(seed, 'b', TEAM);
      const alive = replay(lv, seed, seen);
      const o1 = ordersFor(lv, alive, TEAM).find((o) => o.monster === 'b')!;
      if (o1.rule === 'grudge') {
        sawGrudge = true;
        expect(o1.grudgeHero).toBe(g);
      }
      const dead = replay(lv, seed, [...seen, died(g)]);
      for (const o of ordersFor(lv, dead, TEAM)) {
        if (o.monster === 'b') expect(o.rule).not.toBe('grudge');
        if (o.rule === 'grudge') expect(o.grudgeHero).not.toBe(g);
        expect(o.tie).not.toContain(g);
      }
      // another hero's death does not change the grudge hero
      const other = TEAM.find((h) => h !== g)!;
      const o2 = ordersFor(lv, replay(lv, seed, [...seen, died(other)]), TEAM).find(
        (o) => o.monster === 'b',
      )!;
      if (o2.rule === 'grudge') expect(o2.grudgeHero).toBe(g);
    }
    expect(sawGrudge).toBe(true);
  });

  it('the caster rule needs a living Wizard or Elf', () => {
    // no core monster uses the caster rule now (a pack enemy does), so give the weights here
    const goblin = { type: 'goblin' } as const;
    const w = { caster: 2, closest: 1 };
    expect(availableRules(goblin, ['barbarian', 'dwarf'], true, w).map(([k]) => k)).not.toContain(
      'caster',
    );
    expect(availableRules(goblin, ['barbarian', 'wizard'], true, w).map(([k]) => k)).toContain(
      'caster',
    );
    expect(availableRules({ type: 'orc' }, ['dwarf'], false).map(([k]) => k)).not.toContain(
      'grudge',
    );
  });

  it('is identical after undo and replay', () => {
    const ev = [...seen, died('elf')];
    const back = undo(lv, SEED, [...ev, died('dwarf')]);
    expect(ordersFor(lv, back.state, TEAM)).toEqual(ordersFor(lv, replay(lv, SEED, ev), TEAM));
  });
});

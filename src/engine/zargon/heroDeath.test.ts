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
const died = (hero: string): GameEvent => ({ type: 'HERO_DIED', hero });
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

describe('the free team list (decision 38)', () => {
  const scout = { id: 'merc:scout', name: 'Scout', kind: 'mercenary', owner: 'dwarf' } as const;
  const wolf = { id: 'ally:wolf', name: 'Wolf', kind: 'ally', owner: 'elf' } as const;
  const team = [...TEAM, scout, wolf];

  it('HERO_DIED works for a mercenary and an ally, and refuses an unknown id', () => {
    const s = replay(level, SEED, [died('merc:scout'), died('ally:wolf')]);
    expect(s.deadHeroes).toEqual(['merc:scout', 'ally:wolf']);
    expect(code(() => replay(level, SEED, [died('merc:scout'), died('merc:scout')]))).toBe(
      'ALREADY_DEAD',
    );
    expect(code(() => replay(level, SEED, [died('merc:')]))).toBe('UNKNOWN_HERO');
  });

  it('livingHeroes lists heroes only', () => {
    expect(livingHeroes(team, { deadHeroes: ['elf'] })).toEqual(['barbarian', 'dwarf', 'wizard']);
  });

  it('a mercenary and an ally are in the tie list with their names, and leave it when they fall', () => {
    const l = buildLevel(testQuest());
    const open1 = replay(l, SEED, [open('d1'), open('d2')]);
    const orders = ordersFor(l, open1, team);
    expect(orders.length).toBeGreaterThan(0);
    for (const o of orders) {
      expect([...o.tie].sort()).toEqual(team.map((m) => (typeof m === 'string' ? m : m.id)).sort());
      expect(o.tieNames).toHaveLength(o.tie.length);
      expect(o.tieNames[o.tie.indexOf('merc:scout')]).toBe('Scout');
      expect(o.tieNames[o.tie.indexOf('ally:wolf')]).toBe('Wolf');
    }
    const after = replay(l, SEED, [open('d1'), open('d2'), died('merc:scout')]);
    for (const o of ordersFor(l, after, team)) expect(o.tie).not.toContain('merc:scout');
  });

  it('a grudge, and the caster rule, name heroes only', () => {
    const l = buildLevel(testQuest());
    for (let seed = 1; seed <= 60; seed++) {
      const g = grudgeHero(seed, 'm1', team);
      expect(['barbarian', 'dwarf', 'elf', 'wizard']).toContain(g);
    }
    // only a mercenary is left alive with a hero dead: no hero, no orders
    const s = replay(l, SEED, [
      open('d1'),
      open('d2'),
      died('barbarian'),
      died('dwarf'),
      died('elf'),
      died('wizard'),
    ]);
    expect(ordersFor(l, s, team)).toEqual([]);
  });

  it('a pack hero plays as its class: a Wizard-class hero allows the caster rule, a Barbarian-class one does not', () => {
    const l = buildLevel(
      testQuest({
        monsters: [{ id: 'm1', type: 'orc', cell: [6, 15], weights: { caster: 1 } }],
      }),
    );
    const mage = { id: 'hero:mage', name: 'Mage', kind: 'hero', as: 'wizard' } as const;
    const brute = { id: 'hero:brute', name: 'Brute', kind: 'hero', as: 'barbarian' } as const;
    const s = replay(l, SEED, [open('d1'), open('d2')]);
    expect(ordersFor(l, s, [mage]).map((o) => o.rule)).toEqual(['caster']);
    expect(ordersFor(l, s, [brute]).map((o) => o.rule)).toEqual(['closest']);
  });
});

describe('NPCs as targets (decision 39)', () => {
  const npc = {
    id: 'n1',
    name: 'Sir Test',
    cell: [2, 16],
    defend: 2,
    body: 3,
    text: 'An escort.',
  };
  const withNpc = (patch: Record<string, unknown> = {}) =>
    buildLevel(testQuest({ npcs: [npc], ...patch }));
  const opened = [open('d1'), open('d2')];
  const tieOf = (l: ReturnType<typeof withNpc>, events: GameEvent[], seed = SEED) =>
    ordersFor(l, replay(l, seed, events), TEAM)[0]!;

  it('an NPC whose square is seen is in the tie list, with its name', () => {
    const l = withNpc();
    const o = tieOf(l, opened);
    expect(o.tie).toContain('npc:n1');
    expect(o.tieNames[o.tie.indexOf('npc:n1')]).toBe('Sir Test');
    expect(o.tie).toHaveLength(5);
  });

  it('an NPC that is not in play yet is not in the list', () => {
    const l = withNpc({ npcs: [{ ...npc, cell: [20, 2] }] });
    expect(tieOf(l, opened).tie).not.toContain('npc:n1');
  });

  it('a quest can exclude an NPC: it is never in a tie list', () => {
    const l = withNpc({ excludeTargets: ['n1'] });
    for (let seed = 1; seed <= 20; seed++)
      expect(tieOf(l, opened, seed).tie).toEqual(expect.not.arrayContaining(['npc:n1']));
  });

  it('the team is all still in the list when an NPC is added to the quest', () => {
    const plain = tieOf(buildLevel(testQuest()), opened).tie;
    const l = withNpc();
    const withIt = tieOf(l, opened).tie.filter((t) => t !== 'npc:n1');
    expect(plain.length).toBe(4);
    expect(withIt.length).toBe(4);
    expect(new Set(withIt)).toEqual(new Set(plain));
  });

  it('a grudge and the caster rule never name an NPC', () => {
    const l = withNpc();
    for (let seed = 1; seed <= 60; seed++) {
      const o = tieOf(l, opened, seed);
      if (o.grudgeHero) expect(o.grudgeHero.startsWith('npc:')).toBe(false);
    }
  });
});

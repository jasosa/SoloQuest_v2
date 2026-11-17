import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { type Hero } from '../data/heroes';
import type { GameEvent } from '../game/events';
import { EventError, replay, undo, type EventErrorCode } from '../game/reducer';
import { parseQuest } from '../quest/loader';
import { MONSTER_TYPES } from '../quest/schema';
import { testQuest } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { availableRules, grudgeHero, ordersFor, spellsLeft, turnProgress } from './orders';
import { PLAN_TEXT } from './texts';
import { SPELL_NAMES, type SpellKey } from './spells';
import { pickSpell } from './spellPick';
import { RULE_KEYS, WEIGHTS, profileOf, weightsOf } from './weights';

const SEED = 7;
const TEAM: Hero[] = ['barbarian', 'dwarf', 'elf', 'wizard'];
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const turnEnd: GameEvent = { type: 'ZARGON_TURN_END' };

// R17 (opened by d2) holds the orc m1, the sorcerer c1 (Grak style) and extras.
const monsters = (extra: Record<string, unknown>[] = []) => [
  { id: 'm1', type: 'orc', cell: [6, 15] },
  { id: 'm2', type: 'goblin', cell: [10, 15] },
  { id: 'm3', type: 'gargoyle', hidden: true },
  ...extra,
];
const levelWith = (extra: Record<string, unknown>[] = [], patch: Record<string, unknown> = {}) =>
  buildLevel(testQuest({ monsters: monsters(extra), ...patch }));
const code = (fn: () => unknown): EventErrorCode | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};

describe('weights and profiles', () => {
  it('profileOf follows the table', () => {
    expect(profileOf({ type: 'goblin' })).toBe('skirmisher');
    expect(profileOf({ type: 'orc' })).toBe('fighter');
    expect(profileOf({ type: 'abomination' })).toBe('fighter');
    expect(profileOf({ type: 'dreadWarrior' })).toBe('fighter');
    for (const t of ['skeleton', 'zombie', 'mummy', 'gargoyle'] as const)
      expect(profileOf({ type: t })).toBe('relentless');
  });

  it('named monsters with spells and the dread sorcerer are casters', () => {
    expect(profileOf({ type: 'gargoyle', spells: ['fear'] })).toBe('caster');
    expect(profileOf({ type: 'dreadSorcerer' })).toBe('caster');
    expect(profileOf({ type: 'gargoyle', spells: [] })).toBe('relentless');
    expect(weightsOf({ type: 'gargoyle', spells: ['fear'] })).toEqual(WEIGHTS.dreadWarrior);
  });

  it('every type has a positive weight table of known keys', () => {
    for (const t of MONSTER_TYPES) {
      const keys = Object.keys(WEIGHTS[t]);
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) expect(RULE_KEYS as readonly string[]).toContain(k);
    }
  });
});

describe('ordersFor', () => {
  const level = levelWith();
  const base = replay(level, SEED, [open('d2')]);

  it('gives one order per seen active monster with tie list, plan and rule text', () => {
    const orders = ordersFor(level, base, TEAM);
    expect(orders.map((o) => o.monster)).toEqual(['m1']);
    const o = orders[0]!;
    expect(o.status).toBe('act');
    expect(o.profile).toBe('fighter');
    expect(o.ruleText).toBeTruthy();
    expect(o.plan).toContain('Move in and attack');
    expect([...o.tie].sort()).toEqual([...TEAM].sort());
  });

  it('is deterministic: same inputs, same orders', () => {
    expect(ordersFor(level, base, TEAM)).toEqual(ordersFor(level, base, TEAM));
    expect(ordersFor(level, base, TEAM, SEED)).toEqual(ordersFor(level, base, TEAM));
  });

  it('does not depend on the order of the team', () => {
    expect(ordersFor(level, base, [...TEAM].reverse())).toEqual(ordersFor(level, base, TEAM));
  });

  it('does not touch state.rng and ignores it', () => {
    const before = base.rng;
    ordersFor(level, base, TEAM);
    expect(base.rng).toBe(before);
    expect(ordersFor(level, { ...base, rng: 12345 }, TEAM)).toEqual(ordersFor(level, base, TEAM));
  });

  it('changes with the turn (over a few turns something differs)', () => {
    let s = base;
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const o = ordersFor(level, s, TEAM)[0]!;
      seen.add(JSON.stringify([o.rule, o.tie]));
      s = replay(level, SEED, [open('d2'), ...Array<GameEvent>(i + 1).fill(turnEnd)]);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('is identical after undo and replay', () => {
    const events = [open('d2'), turnEnd, { type: 'MONSTER_DONE', monster: 'm1' } as GameEvent];
    const live = replay(level, SEED, events);
    const back = undo(level, SEED, [...events, turnEnd]);
    expect(ordersFor(level, back.state, TEAM)).toEqual(ordersFor(level, live, TEAM));
  });

  it('keeps the tie list a non-empty permutation of the team, for any team', () => {
    const teams: Hero[][] = [['dwarf'], ['elf', 'barbarian'], ['wizard', 'dwarf', 'elf'], TEAM];
    for (let seed = 1; seed <= 60; seed++) {
      const l = levelWith([{ id: 'a', type: 'goblin', cell: [5, 16] }]);
      const s = replay(l, seed, [open('d2')]);
      for (const team of teams)
        for (const o of ordersFor(l, s, team)) {
          expect(o.tie.length).toBe(team.length);
          expect([...o.tie].sort()).toEqual([...team].sort());
        }
    }
  });

  it('gives an empty list for an empty team', () => {
    expect(ordersFor(level, base, [])).toEqual([]);
  });

  it('normalises a seed override with >>> 0', () => {
    expect(ordersFor(level, base, TEAM, SEED + 2 ** 32)).toEqual(
      ordersFor(level, base, TEAM, SEED),
    );
    expect(ordersFor(level, base, TEAM, -1)).toEqual(ordersFor(level, base, TEAM, 2 ** 32 - 1));
  });
});

describe('weights are respected', () => {
  it('every profile draws only its own keys, and all of them over many seeds', () => {
    const types = ['goblin', 'orc', 'abomination', 'dreadWarrior', 'skeleton', 'gargoyle'] as const;
    for (const type of types) {
      const l = buildLevel(
        testQuest({ monsters: [{ id: 'x', type, cell: [6, 15] }, ...monsters().slice(1)] }),
      );
      const drawn = new Set<string>();
      for (let seed = 1; seed <= 400; seed++) {
        const s = replay(l, seed, [open('d2')]);
        drawn.add(ordersFor(l, s, TEAM)[0]!.rule!);
      }
      expect([...drawn].sort()).toEqual(Object.keys(WEIGHTS[type]).sort());
    }
  });

  it('draws roughly by weight', () => {
    const l = buildLevel(
      testQuest({
        monsters: [{ id: 'x', type: 'skeleton', cell: [6, 15] }, ...monsters().slice(1)],
      }),
    );
    const n: Record<string, number> = {};
    const N = 2000;
    for (let seed = 1; seed <= N; seed++) {
      const r = ordersFor(l, replay(l, seed, [open('d2')]), TEAM)[0]!.rule!;
      n[r] = (n[r] ?? 0) + 1;
    }
    // undead always go for the closest hero
    expect(n.closest).toBe(N);
  });

  it('a goblin picks on the isolated hero, an orc is drawn by weight', () => {
    const l = buildLevel(
      testQuest({
        monsters: [{ id: 'x', type: 'orc', cell: [6, 15] }, ...monsters().slice(1)],
      }),
    );
    const n: Record<string, number> = {};
    const N = 2000;
    for (let seed = 1; seed <= N; seed++) {
      const r = ordersFor(l, replay(l, seed, [open('d2')]), TEAM)[0]!.rule!;
      n[r] = (n[r] ?? 0) + 1;
    }
    // closest 3, lastAttacker 3, lowestBody 2, highestAtt 1, grudge 1 (of 10)
    expect(n.closest! / N).toBeGreaterThan(0.25);
    expect(n.closest! / N).toBeLessThan(0.35);
    const g = buildLevel(
      testQuest({ monsters: [{ id: 'x', type: 'goblin', cell: [6, 15] }, ...monsters().slice(1)] }),
    );
    for (let seed = 1; seed <= 50; seed++)
      expect(ordersFor(g, replay(g, seed, [open('d2')]), TEAM)[0]!.rule).toBe('isolated');
  });

  it('a fighter sometimes moves back after attacking, the same for the same seed and turn', () => {
    const l = buildLevel(
      testQuest({ monsters: [{ id: 'x', type: 'orc', cell: [6, 15] }, ...monsters().slice(1)] }),
    );
    let back = 0;
    const N = 600;
    for (let seed = 1; seed <= N; seed++) {
      const o = ordersFor(l, replay(l, seed, [open('d2')]), TEAM)[0]!;
      if (o.plan?.includes('move back out of reach')) back++;
      expect(ordersFor(l, replay(l, seed, [open('d2')]), TEAM)[0]!.plan).toBe(o.plan);
    }
    expect(back / N).toBeGreaterThan(0.25);
    expect(back / N).toBeLessThan(0.42);
  });

  it('redraws rules that need a Wizard or Elf when the team has none', () => {
    const w = { caster: 2, closest: 1 };
    expect(availableRules({ type: 'goblin' }, TEAM, true, w).map(([k]) => k)).toContain('caster');
    expect(
      availableRules({ type: 'goblin' }, ['barbarian', 'dwarf'], true, w).map(([k]) => k),
    ).not.toContain('caster');
  });

  it('offers grudge to a single hero and names that hero', () => {
    const l = buildLevel(
      testQuest({ monsters: [{ id: 'x', type: 'orc', cell: [6, 15] }, ...monsters().slice(1)] }),
    );
    let found = false;
    for (let seed = 1; seed <= 300 && !found; seed++) {
      const o = ordersFor(l, replay(l, seed, [open('d2')]), ['dwarf'])[0]!;
      expect(o.tie).toEqual(['dwarf']);
      if (o.rule === 'grudge') {
        found = true;
        expect(o.grudgeHero).toBe('dwarf');
        expect(o.ruleText).toContain('Dwarf');
      }
    }
    expect(found).toBe(true);
  });
});

describe('grudge', () => {
  it('is stable across turns and a pure function of seed, monster and team', () => {
    expect(grudgeHero(SEED, 'm1', TEAM)).toBe(grudgeHero(SEED, 'm1', [...TEAM].reverse()));
    const l = buildLevel(
      testQuest({
        monsters: [{ id: 'x', type: 'dreadWarrior', cell: [6, 15] }, ...monsters().slice(1)],
      }),
    );
    let s = replay(l, SEED, [open('d2')]);
    const heroes = new Set<Hero>();
    for (let i = 0; i < 40; i++) {
      const o = ordersFor(l, s, TEAM)[0]!;
      if (o.rule === 'grudge') heroes.add(o.grudgeHero!);
      s = replay(l, SEED, [open('d2'), ...Array<GameEvent>(i + 1).fill(turnEnd)]);
    }
    expect(heroes.size).toBe(1);
    expect(heroes.has(grudgeHero(SEED, 'x', TEAM))).toBe(true);
  });

  it('differs between monsters and seeds over many draws', () => {
    const picks = new Set<Hero>();
    for (let seed = 1; seed <= 50; seed++) picks.add(grudgeHero(seed, 'm1', TEAM));
    expect(picks.size).toBe(4);
  });
});

describe('who gets an order', () => {
  it('leaves out dormant monsters (statues), slain monsters and unseen ones', () => {
    const l = levelWith([
      { id: 'st', type: 'gargoyle', cell: [8, 16], state: 'dormant' },
      { id: 'o2', type: 'orc', cell: [5, 16] },
    ]);
    let s = replay(l, SEED, [open('d2')]);
    expect(ordersFor(l, s, TEAM).map((o) => o.monster)).toEqual(['m1', 'o2']);
    s = replay(l, SEED, [open('d2'), { type: 'MONSTER_KILL', monster: 'o2' }]);
    expect(ordersFor(l, s, TEAM).map((o) => o.monster)).toEqual(['m1']);
    expect(ordersFor(l, replay(l, SEED, []), TEAM)).toEqual([]);
  });

  it('gives a stone monster an order-less entry with the turns left', () => {
    const l = levelWith([{ id: 'o2', type: 'orc', cell: [5, 16] }], {
      notes: [
        {
          id: 'n-m3',
          trigger: { type: 'manual', label: 'Place the gargoyle' },
          effects: [{ type: 'placeMonster', monster: 'm3', cell: [10, 16] }],
        },
        {
          id: 'n-stone',
          trigger: { type: 'manual', label: 'Stone' },
          effects: [{ type: 'setMonsterState', monster: 'o2', state: 'stone', turns: 2 }],
        },
      ],
    });
    let s = replay(l, SEED, [open('d2'), { type: 'MANUAL_TRIGGER', note: 'n-stone' }]);
    const o = ordersFor(l, s, TEAM).find((x) => x.monster === 'o2')!;
    expect(o.status).toBe('stone');
    expect(o.rule).toBeUndefined();
    expect(o.note).toBe('Stone: 2 turns left, it does nothing.');
    expect(o.tie.length).toBe(4);
    s = replay(l, SEED, [open('d2'), { type: 'MANUAL_TRIGGER', note: 'n-stone' }, turnEnd]);
    expect(ordersFor(l, s, TEAM).find((x) => x.monster === 'o2')!.note).toBe(
      'Stone: 1 turn left, it does nothing.',
    );
    // stone and done: not tracked
    expect(turnProgress(l, s).remaining).toEqual(['m1']);
  });

  it('gives a fresh wanderer a note and the order of next turn, then a normal order', () => {
    const l = levelWith([], { wandering: { monster: 'skeleton' } });
    const events: GameEvent[] = [{ type: 'WANDERING_MONSTER', room: 'R20', hero: 'elf' }];
    const s = replay(l, SEED, events);
    const o = ordersFor(l, s, TEAM).find((x) => x.monster === 'w1')!;
    expect(o.status).toBe('fresh');
    expect(o.note).toContain('already attacked');
    expect(o.turn).toBe(s.turn + 1);
    expect(o.rule).toBeDefined();
    expect(turnProgress(l, s).remaining).not.toContain('w1');
    const s2 = replay(l, SEED, [...events, turnEnd]);
    const o2 = ordersFor(l, s2, TEAM).find((x) => x.monster === 'w1')!;
    expect(o2.status).toBe('act');
    // the order shown as "next turn" is the order that applies next turn
    expect({ ...o2, status: o.status, note: o.note, noTarget: undefined }).toEqual({
      ...o,
      done: false,
      noTarget: undefined,
    });
  });
});

describe('special rules', () => {
  it('shows stat overrides against base stats (quest 1 mummy rolls 4 attack dice)', () => {
    const quest = parseQuest(
      JSON.parse(
        readFileSync(
          resolve(import.meta.dirname, '../../content/quests/q01-the-trial.json'),
          'utf8',
        ),
      ),
    );
    const l = buildLevel(quest);
    const mummy = quest.monsters.find((m) => m.id === 'm4')!;
    const base = replay(l, SEED, []);
    const s = {
      ...base,
      seenMonsters: new Set(['m4']),
      monsters: { m4: { body: 2, dead: false } },
    };
    const o = ordersFor(l, s, TEAM)[0]!;
    expect(o.monster).toBe(mummy.id);
    expect(o.special).toEqual(['Rolls 4 attack dice']);
    expect(o.profile).toBe('relentless');
  });

  it('covers defend, move, body and the spell limit; nothing for base stats', () => {
    const l = levelWith([
      {
        id: 'w',
        type: 'gargoyle',
        cell: [8, 16],
        overrides: { def: 6, move: 1, body: 5, att: 2 },
        spells: ['fear'],
        spellLimit: 'onePerTurn',
      },
    ]);
    const s = replay(l, SEED, [open('d2')]);
    const orders = ordersFor(l, s, TEAM);
    expect(orders.find((o) => o.monster === 'm1')!.special).toEqual([]);
    expect(orders.find((o) => o.monster === 'w')!.special).toEqual([
      'Rolls 2 attack dice',
      'Rolls 6 defend dice',
      'Moves 1 square',
      'Has 5 Body Points',
    ]);
  });
});

describe('casters, random spell and tracking', () => {
  const grak = {
    id: 'g',
    type: 'gargoyle',
    cell: [8, 16],
    name: 'Grak',
    spells: ['fear', 'sleep', 'tempest'],
    spellLimit: 'onePerTurn',
  };
  const l = levelWith([grak]);
  const seen: GameEvent[] = [open('d2')];
  const cast = (spell: string, monster = 'g'): GameEvent => ({
    type: 'SPELL_CAST',
    monster,
    spell,
  });
  const orderOf = (events: GameEvent[], team: Hero[] = TEAM) =>
    ordersFor(l, replay(l, SEED, events), team).find((o) => o.monster === 'g')!;

  const failed = (spell: string, monster = 'g'): GameEvent => ({
    type: 'SPELL_FAILED',
    monster,
    spell,
  });

  it('uses the caster profile and shows ONE random spell plus the fallback plan', () => {
    const o = orderOf(seen);
    expect(o.profile).toBe('caster');
    expect(['fear', 'sleep', 'tempest']).toContain(o.spell!.spell);
    expect(o.spell).toMatchObject({ effect: 'Read the Dread spell card.', left: 1 });
    expect(o.spell!.name).toBe(SPELL_NAMES[o.spell!.spell as SpellKey]);
    expect(o.declined).toEqual([]);
    expect(o.fallbackPlan).toBe(PLAN_TEXT.caster);
    expect(o.plan).toBeUndefined();
    expect(o.spellNote).toBeUndefined();
    // no condition texts, no priority list
    expect(JSON.stringify(o)).not.toMatch(/condition|fits/);
    // normal monsters have no spell part
    const m1 = ordersFor(l, replay(l, SEED, seen), TEAM).find((x) => x.monster === 'm1')!;
    expect(m1.spell).toBeUndefined();
    expect(m1.declined).toBeUndefined();
    expect(m1.fallbackPlan).toBeUndefined();
  });

  it('the pick is deterministic (same after undo and replay), changes with turn and seed', () => {
    expect(orderOf(seen).spell).toEqual(orderOf(seen).spell);
    const events = [...seen, failed('fear'), failed('sleep')];
    const back = undo(l, SEED, [...events, turnEnd]);
    expect(ordersFor(l, back.state, TEAM)).toEqual(ordersFor(l, replay(l, SEED, events), TEAM));
    const picks = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      // on 1 turn in 4 the caster casts nothing (decision 47)
      const sp = ordersFor(l, replay(l, seed, seen), TEAM).find((x) => x.monster === 'g')!.spell;
      if (sp) picks.add(sp.spell);
    }
    expect(picks.size).toBe(3);
    const perTurn = new Set<string>();
    for (let t = 0; t < 30; t++) {
      const sp = orderOf([...seen, ...Array<GameEvent>(t).fill(turnEnd)]).spell;
      if (sp) perTurn.add(sp.spell);
    }
    expect(perTurn.size).toBeGreaterThan(1);
  });

  it('does not use state.rng', () => {
    const s = replay(l, SEED, seen);
    expect(ordersFor(l, { ...s, rng: 99 }, TEAM)).toEqual(ordersFor(l, s, TEAM));
  });

  it('SPELL_FAILED offers the next spell, never a repeat, then the plan when none is left', () => {
    const offered: string[] = [];
    let events: GameEvent[] = [...seen];
    for (let i = 0; i < 3; i++) {
      const o = orderOf(events);
      expect(o.declined).toEqual(offered);
      expect(o.spell!.place).toBe(i + 1);
      offered.push(o.spell!.spell);
      events = [...events, failed(o.spell!.spell)];
    }
    expect(new Set(offered).size).toBe(3);
    const last = orderOf(events);
    expect(last.spell).toBeUndefined();
    expect(last.spellNote).toBeUndefined();
    expect(last.plan).toBe(PLAN_TEXT.caster);
    expect(last.fallbackPlan).toBeUndefined();
    expect(last.declined).toEqual(offered);
  });

  it('the k-th offer is the k-th of the same shuffle whatever was declined', () => {
    const first = orderOf(seen).spell!.spell;
    const second = orderOf([...seen, failed(first)]).spell!.spell;
    expect(second).not.toBe(first);
    expect(pickSpell(SEED, 1, 'g', ['fear', 'sleep', 'tempest'], [first])).toBe(second);
  });

  it('declined spells clear at turn end, undo removes a decline', () => {
    const s = replay(l, SEED, [...seen, failed('fear'), turnEnd]);
    expect(s.spellsFailed).toEqual({});
    const back = undo(l, SEED, [...seen, failed('fear')]);
    expect(back.state.spellsFailed).toEqual({});
  });

  it('a cast shows the note and no plan, no spell', () => {
    const o = orderOf([...seen, cast('fear')]);
    expect(o.spellNote).toBe('It already cast a spell this turn.');
    expect(o.spell).toBeUndefined();
    expect(o.plan).toBeUndefined();
    expect(o.fallbackPlan).toBeUndefined();
  });

  it('picks only among spells left and tracks casts', () => {
    const s = replay(l, SEED, [...seen, cast('fear'), turnEnd]);
    expect(spellsLeft(grak as never, s, 'g')).toEqual({ sleep: 1, tempest: 1 });
    for (let i = 0; i < 20; i++) {
      const o = ordersFor(
        l,
        replay(l, SEED, [...seen, cast('fear'), ...Array<GameEvent>(i + 1).fill(turnEnd)]),
        TEAM,
      ).find((x) => x.monster === 'g')!;
      expect(['sleep', 'tempest']).toContain(o.spell?.spell ?? 'sleep');
    }
  });

  it('says no spells left with the plan, once everything was cast', () => {
    let evs: GameEvent[] = [...seen];
    for (const sp of ['fear', 'sleep', 'tempest']) evs = [...evs, cast(sp), turnEnd];
    const o = orderOf(evs);
    expect(o.spell).toBeUndefined();
    expect(o.spellNote).toBe('No spells left.');
    expect(o.plan).toBe(PLAN_TEXT.caster);
  });

  it('does not filter by team (summon with one hero is still picked)', () => {
    const all = levelWith([{ ...grak, spells: ['summon', 'firestorm'], spellLimit: undefined }]);
    const picks = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const o = ordersFor(all, replay(all, seed, seen), ['dwarf']).find((x) => x.monster === 'g')!;
      if (o.spell) picks.add(o.spell.spell);
    }
    expect([...picks].sort()).toEqual(['firestorm', 'summon']);
  });

  it('a spell listed twice has left 2 and is one element of the pick list', () => {
    const wl = levelWith([{ ...grak, spells: ['fear', 'fear'], spellLimit: undefined }]);
    const o = ordersFor(wl, replay(wl, SEED, seen), TEAM).find((x) => x.monster === 'g')!;
    expect(o.spell).toMatchObject({ spell: 'fear', left: 2 });
  });

  it('SPELL_FAILED rules: unknown, used, declined twice, cast, done, dead, wanderer', () => {
    const run =
      (...e: GameEvent[]) =>
      () =>
        replay(l, SEED, [...seen, ...e]);
    expect(code(run(failed('ballOfFlame')))).toBe('UNKNOWN_SPELL');
    expect(code(run(failed('fear', 'm1')))).toBe('UNKNOWN_SPELL');
    expect(code(run(failed('fear', 'zz')))).toBe('UNKNOWN_MONSTER');
    expect(code(run(failed('fear'), failed('fear')))).toBe('SPELL_DECLINED');
    expect(code(run(failed('fear'), cast('fear')))).toBe('SPELL_DECLINED');
    expect(code(run(failed('fear'), cast('sleep')))).toBeUndefined();
    expect(code(run(cast('fear'), failed('sleep')))).toBe('SPELL_LIMIT');
    expect(code(run(cast('fear'), turnEnd, failed('fear')))).toBe('SPELL_USED');
    expect(code(run({ type: 'MONSTER_DONE', monster: 'g' }, failed('fear')))).toBe('ALREADY_DONE');
    expect(code(run({ type: 'MONSTER_KILL', monster: 'g' }, failed('fear')))).toBe('MONSTER_DEAD');
    expect(code(run(failed('fear'), turnEnd, failed('fear')))).toBeUndefined();
    const w = levelWith([], { wandering: { monster: 'skeleton' } });
    expect(
      code(() =>
        replay(w, SEED, [
          { type: 'WANDERING_MONSTER', room: 'R20', hero: 'elf' },
          failed('fear', 'w1'),
        ]),
      ),
    ).toBe('UNKNOWN_SPELL');
  });

  it('rejects unknown, used, limited, dead, dormant, stone and unknown monsters', () => {
    const run =
      (...e: GameEvent[]) =>
      () =>
        replay(l, SEED, [...seen, ...e]);
    expect(code(run(cast('ballOfFlame')))).toBe('UNKNOWN_SPELL');
    expect(code(run(cast('fear', 'm1')))).toBe('UNKNOWN_SPELL');
    expect(code(run(cast('fear', 'zz')))).toBe('UNKNOWN_MONSTER');
    expect(code(run(cast('fear'), cast('sleep')))).toBe('SPELL_LIMIT');
    expect(code(run(cast('fear'), turnEnd, cast('fear')))).toBe('SPELL_USED');
    expect(code(run(cast('fear'), turnEnd, cast('sleep')))).toBeUndefined();
    expect(code(run({ type: 'MONSTER_KILL', monster: 'g' }, cast('fear')))).toBe('MONSTER_DEAD');
    expect(code(() => replay(l, SEED, [cast('fear')]))).toBe('MONSTER_NOT_SEEN');
    const dorm = levelWith([{ ...grak, state: 'dormant' }]);
    expect(code(() => replay(dorm, SEED, [open('d2'), cast('fear')]))).toBe('MONSTER_NOT_SEEN');
    const stone = levelWith([{ ...grak, state: 'stone' }]);
    expect(code(() => replay(stone, SEED, [open('d2'), cast('fear')]))).toBe('MONSTER_INACTIVE');
  });

  it('lets a spell listed twice be cast twice (Witch Lord Q14 fear twice)', () => {
    const wl = levelWith([{ ...grak, spells: ['fear', 'fear'], spellLimit: undefined }]);
    const c = cast('fear');
    expect(code(() => replay(wl, SEED, [...seen, c, turnEnd, c]))).toBeUndefined();
    expect(code(() => replay(wl, SEED, [...seen, c, c]))).toBe('SPELL_LIMIT');
    expect(code(() => replay(wl, SEED, [...seen, c, turnEnd, c, turnEnd, c]))).toBe('SPELL_USED');
    const o = ordersFor(wl, replay(wl, SEED, [...seen, c, turnEnd]), TEAM).find(
      (x) => x.monster === 'g',
    )!;
    expect(o.spell!.left).toBe(1);
  });

  it('undo removes a cast', () => {
    const events = [...seen, cast('fear')];
    const back = undo(l, SEED, events);
    expect(back.state.spellsCast).toEqual({});
    expect(back.state.castThisTurn).toEqual([]);
    expect(() => replay(l, SEED, [...back.events, cast('fear')])).not.toThrow();
  });

  it('the validator rejects unknown spell names and a limit without spells', () => {
    const ok = testQuest({ monsters: monsters([grak]) });
    expect(validateQuest(ok, board)).toEqual([]);
    const bad = testQuest({ monsters: monsters([{ ...grak, spells: ['fire'] }]) });
    expect(validateQuest(bad, board).join(' | ')).toContain('unknown spell "fire"');
    const lone = testQuest({ monsters: monsters([{ ...grak, spells: undefined }]) });
    expect(validateQuest(lone, board).join(' | ')).toContain('spellLimit needs a spells list');
  });
});

describe('MONSTER_DONE and turn progress', () => {
  const l = levelWith([{ id: 'o2', type: 'orc', cell: [5, 16] }]);
  const done = (monster: string): GameEvent => ({ type: 'MONSTER_DONE', monster });
  const seen: GameEvent[] = [open('d2')];

  it('tracks progress, marks orders done and clears at turn end', () => {
    let s = replay(l, SEED, seen);
    expect(turnProgress(l, s)).toMatchObject({ total: 2, done: [], remaining: ['m1', 'o2'] });
    s = replay(l, SEED, [...seen, done('m1')]);
    expect(turnProgress(l, s)).toMatchObject({ done: ['m1'], remaining: ['o2'], allDone: false });
    expect(ordersFor(l, s, TEAM).map((o) => o.done)).toEqual([true, false]);
    s = replay(l, SEED, [...seen, done('m1'), done('o2')]);
    expect(turnProgress(l, s).allDone).toBe(true);
    s = replay(l, SEED, [...seen, done('m1'), done('o2'), turnEnd]);
    expect(turnProgress(l, s)).toMatchObject({ turn: 2, done: [], remaining: ['m1', 'o2'] });
  });

  it('rejects a repeat, unknown, dead and unseen monsters', () => {
    expect(code(() => replay(l, SEED, [...seen, done('m1'), done('m1')]))).toBe('ALREADY_DONE');
    expect(code(() => replay(l, SEED, [...seen, done('zz')]))).toBe('UNKNOWN_MONSTER');
    expect(
      code(() => replay(l, SEED, [...seen, { type: 'MONSTER_KILL', monster: 'm1' }, done('m1')])),
    ).toBe('MONSTER_DEAD');
    expect(code(() => replay(l, SEED, [done('m1')]))).toBe('MONSTER_NOT_SEEN');
  });

  it('rejects done for a fresh wanderer', () => {
    const w = levelWith([], { wandering: { monster: 'skeleton' } });
    const evs: GameEvent[] = [{ type: 'WANDERING_MONSTER', room: 'R20', hero: 'elf' }];
    expect(code(() => replay(w, SEED, [...evs, done('w1')]))).toBe('MONSTER_INACTIVE');
    expect(code(() => replay(w, SEED, [...evs, turnEnd, done('w1')]))).toBeUndefined();
  });

  it('is undone by dropping the event', () => {
    const events = [...seen, done('m1')];
    const back = undo(l, SEED, events);
    expect(turnProgress(l, back.state).done).toEqual([]);
  });

  it('leaves the orders of the other monsters unchanged', () => {
    const a = ordersFor(l, replay(l, SEED, seen), TEAM);
    const b = ordersFor(l, replay(l, SEED, [...seen, done('m1')]), TEAM);
    expect(b.map((o) => ({ ...o, done: false }))).toEqual(a);
  });
});

describe('one action per turn for every caster', () => {
  const caster = { id: 'g', type: 'gargoyle', cell: [8, 16], spells: ['fear', 'sleep'] };
  const l = levelWith([caster]);
  const seen: GameEvent[] = [open('d2')];
  const cast = (spell: string): GameEvent => ({ type: 'SPELL_CAST', monster: 'g', spell });
  const done: GameEvent = { type: 'MONSTER_DONE', monster: 'g' };

  it('limits a caster without spellLimit to one cast per turn', () => {
    expect(code(() => replay(l, SEED, [...seen, cast('fear'), cast('sleep')]))).toBe('SPELL_LIMIT');
    expect(
      code(() => replay(l, SEED, [...seen, cast('fear'), turnEnd, cast('sleep')])),
    ).toBeUndefined();
    const o = ordersFor(l, replay(l, SEED, [...seen, cast('fear')]), TEAM).find(
      (x) => x.monster === 'g',
    )!;
    expect(o.spellNote).toBe('It already cast a spell this turn.');
  });

  it('rejects a cast by a monster already done, allows done after a cast', () => {
    expect(code(() => replay(l, SEED, [...seen, done, cast('fear')]))).toBe('ALREADY_DONE');
    expect(code(() => replay(l, SEED, [...seen, cast('fear'), done]))).toBeUndefined();
    expect(code(() => replay(l, SEED, [...seen, done, turnEnd, cast('fear')]))).toBeUndefined();
  });

  it('rejects a cast by a wandering monster with a clear message', () => {
    const w = levelWith([], { wandering: { monster: 'skeleton' } });
    expect.assertions(2);
    try {
      replay(w, SEED, [
        { type: 'WANDERING_MONSTER', room: 'R20', hero: 'elf' },
        { type: 'SPELL_CAST', monster: 'w1', spell: 'fear' },
      ]);
    } catch (e) {
      expect((e as EventError).code).toBe('UNKNOWN_SPELL');
      expect((e as Error).message).toContain('wandering');
    }
  });
});

describe('traits and override lines', () => {
  it('shows traits first, then every override that is present, even equal to the base', () => {
    const l = levelWith([
      {
        id: 'wl',
        type: 'dreadSorcerer',
        cell: [8, 16],
        traits: ['Only the Spirit Blade can harm him', 'Fire spells do not affect him'],
        overrides: { att: 3, move: 1 },
      },
    ]);
    const o = ordersFor(l, replay(l, SEED, [open('d2')]), TEAM).find((x) => x.monster === 'wl')!;
    expect(o.special).toEqual([
      'Only the Spirit Blade can harm him',
      'Fire spells do not affect him',
      'Rolls 3 attack dice',
      'Moves 1 square',
    ]);
  });

  it('the schema rejects an empty trait', () => {
    expect(() =>
      testQuest({ monsters: monsters([{ id: 'z', type: 'orc', cell: [8, 16], traits: [''] }]) }),
    ).toThrow();
  });
});

describe('spellCast notes', () => {
  const balur = { id: 'g', type: 'dreadSorcerer', cell: [8, 16], spells: ['escape', 'fear'] };
  const notes = [
    {
      id: 'n-m3',
      trigger: { type: 'manual', label: 'Place the gargoyle' },
      effects: [{ type: 'placeMonster', monster: 'm3', cell: [10, 16] }],
    },
    {
      id: 'n-escape',
      trigger: { type: 'spellCast', monster: 'g', spell: 'escape' },
      effects: [
        { type: 'setMonsterState', monster: 'g', state: 'dormant' },
        { type: 'setFlag', flag: 'escaped', value: true },
        { type: 'showText', text: 'He vanishes.' },
      ],
    },
    {
      id: 'n-any',
      trigger: { type: 'spellCast', monster: 'g' },
      effects: [{ type: 'addCounter', counter: 'casts', by: 1 }],
    },
  ];
  const l = levelWith([balur], { notes });
  const seen: GameEvent[] = [open('d2')];
  const cast = (spell: string): GameEvent => ({ type: 'SPELL_CAST', monster: 'g', spell });

  it('fires after a matching cast and can hide the caster like furniture', () => {
    const r = replay(l, SEED, [...seen, cast('escape')]);
    expect(r.flags.escaped).toBe(true);
    expect(r.counters.casts).toBe(1);
    expect(ordersFor(l, r, TEAM).map((o) => o.monster)).not.toContain('g');
  });

  it('does not fire for another spell, fires every time without a spell filter', () => {
    const r = replay(l, SEED, [...seen, cast('fear'), turnEnd]);
    expect(r.flags.escaped).toBeUndefined();
    const r2 = replay(l, SEED, [...seen, cast('fear'), turnEnd, cast('escape')]);
    expect(r2.counters.casts).toBe(2);
    expect(r2.flags.escaped).toBe(true);
  });

  it('is checked by the validator', () => {
    const bad = (trigger: Record<string, unknown>) =>
      validateQuest(
        testQuest({
          monsters: monsters([balur]),
          notes: [notes[0]!, { id: 'x', trigger, effects: [] }],
        }),
        board,
      ).join(' | ');
    expect(bad({ type: 'spellCast', monster: 'nope' })).toContain('unknown monster');
    expect(bad({ type: 'spellCast', spell: 'fire' })).toContain('unknown spell');
    expect(bad({ type: 'spellCast', monster: 'g', spell: 'sleep' })).toContain('has no spell');
    expect(bad({ type: 'spellCast', monster: 'g', spell: 'fear' })).toBe('');
  });
});

describe('wandering monster is always placed (decision 33)', () => {
  const w = levelWith([], { wandering: { monster: 'skeleton' } });
  const wander: GameEvent = { type: 'WANDERING_MONSTER', room: 'R20', hero: 'elf' };

  it('is fresh until the Zargon turn ends, then acts', () => {
    const s = replay(w, SEED, [wander]);
    expect(s.wanderers.w1).toMatchObject({ fresh: true, wanderAt: 'elf' });
    expect(ordersFor(w, s, TEAM)[0]!.status).toBe('fresh');
    expect(turnProgress(w, s).remaining).not.toContain('w1');
    const s2 = replay(w, SEED, [wander, turnEnd]);
    expect(ordersFor(w, s2, TEAM)[0]!.status).toBe('act');
    expect(turnProgress(w, s2).remaining).toContain('w1');
  });

  it('ignores an old `adjacent` key in the event', () => {
    const old = { ...wander, adjacent: false } as GameEvent;
    expect(replay(w, SEED, [old]).wanderers.w1!.fresh).toBe(true);
  });
});

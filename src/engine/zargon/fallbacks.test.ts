import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import type { Hero } from '../data/heroes';
import { replay } from '../game/reducer';
import { MONSTER_TYPES } from '../quest/schema';
import { testQuest } from '../quest/testQuest';
import { ordersFor } from './orders';
import { NO_TARGET_TEXT, nobodyInReachText } from './texts';
import { RULE_KEYS, profileOf, type Profile } from './weights';

const TEAM: Hero[] = ['barbarian', 'dwarf', 'elf', 'wizard'];

const PROFILES: Profile[] = ['skirmisher', 'soldier', 'brute', 'duelist', 'relentless', 'caster'];

describe('fallback texts (decision 35)', () => {
  it('has one short, specific line per rule key', () => {
    const lines = RULE_KEYS.map((k) => NO_TARGET_TEXT[k]);
    expect(new Set(lines).size).toBe(RULE_KEYS.length);
    for (const l of lines) expect(l).toMatch(/tie list/);
    expect(NO_TARGET_TEXT.lastAttacker).toContain('nobody has attacked it yet');
    expect(NO_TARGET_TEXT.caster).toContain('Wizard or Elf');
    expect(NO_TARGET_TEXT.grudge).toContain('grudge hero');
  });

  it('says what to do when nobody is in reach, for every profile', () => {
    for (const p of PROFILES) {
      const t = nobodyInReachText(p, 'the closest hero');
      if (p === 'duelist' || p === 'caster') {
        expect(t).toBe(
          'No hero in reach: block the nearest doorway (or hold your place if you are in one).',
        );
      } else {
        expect(t).toContain('move as far as you can toward the closest hero');
        expect(t).toContain('Do not attack');
        expect(t).toMatch(/straight lines/);
      }
    }
  });

  it('has no em-dashes anywhere', () => {
    const all = [
      ...RULE_KEYS.map((k) => NO_TARGET_TEXT[k]),
      ...PROFILES.map((p) => nobodyInReachText(p, 'the Elf')),
    ].join(' ');
    expect(all).not.toContain('—');
  });
});

describe('Order.fallbacks', () => {
  const monsters = [
    ...MONSTER_TYPES.filter((t) => t !== 'dreadSorcerer').map((type, i) => ({
      id: `x${i}`,
      type,
      cell: [2 + (i % 3), 15 + Math.floor(i / 3)] as [number, number],
    })),
    { id: 'c1', type: 'gargoyle', cell: [4, 17], spells: ['fear'] },
    { id: 'm3', type: 'gargoyle', hidden: true },
  ];
  const lv = buildLevel(testQuest({ monsters }));

  it('is present for every acting monster, with the line of its own rule, across seeds', () => {
    const rules = new Set<string>();
    const profiles = new Set<string>();
    for (let seed = 1; seed <= 150; seed++) {
      const s = replay(lv, seed, []);
      for (const o of ordersFor(lv, s, TEAM)) {
        expect(o.status).toBe('act');
        profiles.add(o.profile);
        rules.add(o.rule!);
        expect(o.fallbacks!.noTarget).toContain(NO_TARGET_TEXT[o.rule!]);
        expect(o.fallbacks!.noTarget).toContain('attack the first hero next to it');
        const toward = o.grudgeHero
          ? `the ${{ barbarian: 'Barbarian', dwarf: 'Dwarf', elf: 'Elf', wizard: 'Wizard' }[o.grudgeHero]}`
          : 'the closest hero';
        expect(o.fallbacks!.nobodyInReach).toBe(nobodyInReachText(o.profile, toward));
        expect(o.profile).toBe(profileOf(monsters.find((m) => m.id === o.monster)! as never));
      }
    }
    // highestDef is in no weight table (kept for tuning), so it is never drawn.
    expect([...rules].sort()).toEqual(RULE_KEYS.filter((k) => k !== 'highestDef').sort());
    expect([...profiles].sort()).toEqual([...PROFILES].sort());
  });

  it('a grudge order moves toward the grudge hero', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const o = ordersFor(lv, replay(lv, seed, []), TEAM).find((x) => x.rule === 'grudge');
      if (!o || o.profile === 'duelist' || o.profile === 'caster') continue;
      expect(o.fallbacks!.nobodyInReach).toContain(`toward the ${o.ruleText!.split(' ')[1]}`);
      return;
    }
    throw new Error('no grudge order found');
  });

  it('stone and fresh entries have no fallbacks', () => {
    const w = buildLevel(testQuest({ wandering: { monster: 'skeleton' } }));
    const s = replay(w, 1, [{ type: 'WANDERING_MONSTER', room: 'R20', hero: 'elf' }]);
    expect(ordersFor(w, s, TEAM)[0]!.fallbacks).toBeUndefined();
    const st = buildLevel(
      testQuest({
        monsters: [
          { id: 'z', type: 'orc', cell: [6, 15], state: 'stone' },
          { id: 'm3', type: 'gargoyle', hidden: true },
        ],
      }),
    );
    expect(
      ordersFor(st, replay(st, 1, [{ type: 'OPEN_DOOR', door: 'd2' }]), TEAM)[0]!.fallbacks,
    ).toBeUndefined();
  });

  it('the fallbacks do not change with the turn or the done flag, only with the draw', () => {
    const s = replay(lv, 3, []);
    const a = ordersFor(lv, s, TEAM);
    const b = ordersFor(lv, replay(lv, 3, [{ type: 'MONSTER_DONE', monster: 'x0' }]), TEAM);
    expect(b.map((o) => o.fallbacks)).toEqual(a.map((o) => o.fallbacks));
  });
});

import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import type { Hero } from '../data/heroes';
import { replay } from '../game/reducer';
import { MONSTER_TYPES } from '../quest/schema';
import { testQuest } from '../quest/testQuest';
import { ordersFor } from './orders';
import { noTargetText } from './texts';
import { RULE_KEYS } from './weights';

const TEAM: Hero[] = ['barbarian', 'dwarf', 'elf', 'wizard'];

describe('noTargetText (decision 35)', () => {
  it('has a line only for isolated, lastAttacker, caster and grudge', () => {
    for (const k of RULE_KEYS) {
      const t = noTargetText(k, 'Dwarf');
      if (k === 'isolated' || k === 'lastAttacker' || k === 'caster' || k === 'grudge')
        expect(t).toMatch(/tie list/);
      else expect(t).toBeUndefined();
    }
    expect(noTargetText('lastAttacker')).toBe('If nobody has attacked it yet, use the tie list.');
    expect(noTargetText('caster')).toBe('If no Wizard or Elf is in reach, use the tie list.');
    expect(noTargetText('grudge', 'Dwarf')).toBe('If the Dwarf is out of reach, use the tie list.');
  });

  it('has no em-dashes', () => {
    const all = RULE_KEYS.map((k) => noTargetText(k, 'Elf') ?? '').join(' ');
    expect(all).not.toContain('\u2014');
  });
});

describe('Order.noTarget', () => {
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

  it('exists only for isolated, lastAttacker, caster and grudge, with the hero name for a grudge', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const o of ordersFor(lv, replay(lv, seed, []), TEAM)) {
        seen.add(o.rule!);
        const expected = noTargetText(o.rule!, o.grudgeName);
        expect(o.noTarget).toBe(expected);
        if (o.rule === 'grudge') expect(o.noTarget).toContain(o.grudgeName!);
        expect('fallbacks' in o).toBe(false);
      }
    }
    expect(seen.has('closest') && seen.has('lastAttacker') && seen.has('grudge')).toBe(true);
    expect(seen.has('isolated')).toBe(true);
  });

  it('stone entries and fresh wanderers have none', () => {
    const w = buildLevel(testQuest({ wandering: { monster: 'skeleton' } }));
    for (let seed = 1; seed <= 30; seed++) {
      const s = replay(w, seed, [{ type: 'WANDERING_MONSTER', room: 'R20', hero: 'elf' }]);
      expect(ordersFor(w, s, TEAM)[0]!.noTarget).toBeUndefined();
    }
    const st = buildLevel(
      testQuest({
        monsters: [
          { id: 'z', type: 'orc', cell: [6, 15], state: 'stone' },
          { id: 'm3', type: 'gargoyle', hidden: true },
        ],
      }),
    );
    expect(
      ordersFor(st, replay(st, 1, [{ type: 'OPEN_DOOR', door: 'd2' }]), TEAM)[0]!.noTarget,
    ).toBeUndefined();
  });
});

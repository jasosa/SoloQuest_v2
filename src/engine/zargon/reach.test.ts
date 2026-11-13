import { describe, expect, it } from 'vitest';
import type { Hero } from '../data/heroes';
import type { Order } from './orders';
import { reachOrder } from './reach';
import { NOBODY_PLAN } from './texts';
import type { RuleKey } from './weights';

const TIE: Hero[] = ['dwarf', 'wizard', 'barbarian', 'elf'];
const order = (rule: RuleKey, extra: Partial<Order> = {}): Order => ({
  monster: 'm1',
  type: 'orc',
  name: 'Orc',
  status: 'act',
  profile: 'soldier',
  rule,
  ruleText: 'rule text',
  tie: TIE,
  plan: 'Move in and attack.',
  special: [],
  turn: 1,
  done: false,
  ...extra,
});

describe('reachOrder', () => {
  it('handles nobody in reach', () => {
    const r = reachOrder(order('closest'), [], []);
    expect(r.kind).toBe('nobody');
    expect(r.plan).toBe(NOBODY_PLAN);
    expect(r.tie).toEqual([]);
  });

  it('names the only hero in reach, whatever the rule', () => {
    for (const rule of ['lowestBody', 'lastAttacker', 'highestAtt', 'grudge', 'caster'] as const) {
      const r = reachOrder(order(rule), ['barbarian'], []);
      expect(r).toMatchObject({
        kind: 'hero',
        hero: 'barbarian',
        tie: ['barbarian'],
        adjacent: false,
      });
      expect(r.plan).toContain('Move next to the Barbarian');
    }
  });

  it('says attack and stay when already next to the only hero', () => {
    const r = reachOrder(order('lowestBody'), [], ['elf']);
    expect(r).toMatchObject({ kind: 'hero', hero: 'elf', adjacent: true });
    expect(r.plan).toBe('Already next to it: attack and stay.');
    expect(
      reachOrder(order('closest', { profile: 'skirmisher' }), ['elf'], ['elf']).plan,
    ).toContain('run back');
  });

  it('closest: tie list order among the reachable, but a hero next to it wins', () => {
    expect(reachOrder(order('closest'), ['elf', 'wizard'], []).hero).toBe('wizard');
    expect(reachOrder(order('closest'), ['elf', 'wizard'], ['elf']).hero).toBe('elf');
  });

  it('grudge: the grudge hero when in reach, else the first in the tie list', () => {
    const o = order('grudge', { grudgeHero: 'elf' });
    expect(reachOrder(o, ['dwarf', 'elf'], []).hero).toBe('elf');
    expect(reachOrder(o, ['barbarian', 'wizard'], []).hero).toBe('wizard');
  });

  it('caster: Wizard or Elf in reach by tie list order, else first in the tie list', () => {
    const o = order('caster');
    expect(reachOrder(o, ['dwarf', 'elf', 'wizard'], []).hero).toBe('wizard');
    expect(reachOrder(o, ['dwarf', 'barbarian'], []).hero).toBe('dwarf');
  });

  it('other rules: the rule text restricted to the reachable heroes and the filtered tie list', () => {
    const r = reachOrder(order('lowestBody'), ['elf', 'dwarf', 'barbarian'], ['elf']);
    expect(r.kind).toBe('rule');
    expect(r.tie).toEqual(['dwarf', 'barbarian', 'elf']);
    expect(r.candidates).toEqual(['dwarf', 'barbarian', 'elf']);
    expect(r.text).toContain('Dwarf, Barbarian, Elf');
    expect(r.text).toContain('fewest Body Points');
    expect(r.adjacent).toBe(true);
    expect(r.plan).toBe('Move in and attack.');
  });

  it('non-adjacent target: one plain plan for every profile, no run back or block', () => {
    for (const profile of [
      'skirmisher',
      'soldier',
      'brute',
      'duelist',
      'relentless',
      'caster',
    ] as const) {
      const r = reachOrder(order('lowestBody', { profile }), ['elf'], []);
      expect(r.plan).toBe('Move next to the Elf and attack, then stay.');
      expect(r.plan).not.toMatch(/run back|block|doorway/);
      expect(reachOrder(order('lowestBody', { profile }), [], ['elf']).plan).toContain(
        'Already next',
      );
    }
  });

  it('ignores heroes that are not in the team', () => {
    expect(reachOrder(order('lowestBody', { tie: ['dwarf'] }), ['dwarf', 'elf'], []).kind).toBe(
      'hero',
    );
  });

  it('has nothing to say for a stone entry', () => {
    const r = reachOrder(
      {
        ...order('closest'),
        rule: undefined,
        status: 'stone',
        note: 'Stone: 1 turn left, it does nothing.',
      },
      ['elf'],
      [],
    );
    expect(r.kind).toBe('nobody');
    expect(r.text).toContain('Stone');
  });
});

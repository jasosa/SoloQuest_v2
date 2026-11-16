import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { replay } from '../game/reducer';
import { monstersInPlay } from '../game/view';
import { testQuest } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { ordersFor } from '../zargon/orders';
import { CORE_ABILITIES, abilityLookup } from './abilities';

const seen = [
  { type: 'OPEN_DOOR', door: 'd2' },
  { type: 'OPEN_DOOR', door: 'd3' },
] as const;

const quest = (patch: Record<string, unknown> = {}) =>
  testQuest({
    notes: [],
    monsters: [
      { id: 'm1', type: 'orc', cell: [6, 15], special: true, abilities: ['stone', 'bog'] },
      { id: 'm2', type: 'goblin', cell: [10, 15], abilities: ['fireImmune'] },
    ],
    abilityDefs: [{ id: 'bog', name: 'Bog skin', text: 'Spells that make mud do nothing.' }],
    ...patch,
  });

describe('abilities (decision 69)', () => {
  it('the library has the core abilities, and a quest adds its own', () => {
    const ids = new Set(CORE_ABILITIES.map((a) => a.id));
    expect(ids).toEqual(new Set(['stone', 'fireImmune', 'spiritBladeOnly', 'statue']));
    const lookup = abilityLookup(quest());
    expect(lookup.get('stone')?.kind).toBe('ability');
    expect(lookup.get('fireImmune')?.kind).toBe('immunity');
    expect(lookup.get('bog')).toMatchObject({ name: 'Bog skin', kind: 'ability' });
  });

  it('a quest cannot reuse a core id, and a monster cannot name an unknown ability', () => {
    const clash = quest({ abilityDefs: [{ id: 'stone', name: 'x', text: 'y' }] });
    expect(validateQuest(clash, board).some((m) => m.includes('ability stone'))).toBe(true);
    const unknown = quest({
      monsters: [{ id: 'm1', type: 'orc', cell: [6, 15], abilities: ['nope'] }],
    });
    expect(validateQuest(unknown, board).some((m) => m.includes('unknown ability nope'))).toBe(
      true,
    );
    expect(validateQuest(quest(), board).filter((m) => m.includes('abilit'))).toEqual([]);
  });

  it('the monster view carries special and the resolved abilities', () => {
    const lv = buildLevel(quest());
    const view = monstersInPlay(lv, replay(lv, 1, [...seen]));
    const m1 = view.find((v) => v.id === 'm1')!;
    const m2 = view.find((v) => v.id === 'm2')!;
    expect(m1.special).toBe(true);
    expect(m1.abilities.map((a) => a.id)).toEqual(['stone', 'bog']);
    // an ability does not make a monster special
    expect(m2.special).toBe(false);
    expect(m2.abilities.map((a) => a.id)).toEqual(['fireImmune']);
  });

  it("Zargon's order lists the abilities as special rules", () => {
    const lv = buildLevel(quest());
    const orders = ordersFor(lv, replay(lv, 1, [...seen]), ['barbarian', 'elf']);
    const special = orders.find((o) => o.monster === 'm1')!.special;
    expect(special).toContain('Made of stone: Rolls 1 extra defend die.');
    expect(special).toContain('Bog skin: Spells that make mud do nothing.');
  });
});

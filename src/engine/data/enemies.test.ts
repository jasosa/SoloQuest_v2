import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { replay } from '../game/reducer';
import { monstersInPlay } from '../game/view';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { ordersFor } from '../zargon/orders';
import { resolveEnemies, resolveMonster } from './enemies';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const marsh = {
  id: 'marsh',
  name: 'Marsh Orc',
  base: 'orc',
  letter: 'M',
  image: PNG,
  overrides: { att: 4, body: 2 },
  abilities: ['fireImmune'],
  spells: ['fear'],
  traits: ['Smells of mud'],
};
const quest = (monsters: unknown[], extra: Record<string, unknown> = {}) =>
  parseQuest({ ...testQuestData, enemyDefs: [marsh], monsters, notes: [], ...extra });

describe('enemies as data (decision 70)', () => {
  it('a monster takes the defaults of its enemy; its own fields win', () => {
    const q = quest([
      { id: 'm1', type: 'orc', cell: [6, 15], enemy: 'marsh' },
      {
        id: 'm2',
        type: 'orc',
        cell: [10, 15],
        enemy: 'marsh',
        name: 'Big Marsh',
        overrides: { att: 5 },
        abilities: ['stone'],
        spells: ['sleep'],
      },
    ]);
    const [a, b] = resolveEnemies(q).monsters;
    expect(a).toMatchObject({
      name: 'Marsh Orc',
      letter: 'M',
      image: PNG,
      overrides: { att: 4, body: 2 },
      abilities: ['fireImmune'],
      spells: ['fear'],
      traits: ['Smells of mud'],
    });
    expect(b).toMatchObject({
      name: 'Big Marsh',
      overrides: { att: 5, body: 2 }, // its own att wins, the enemy's body stays
      abilities: ['fireImmune', 'stone'], // both
      spells: ['sleep'], // its own list replaces the enemy's
    });
  });

  it('the quest is returned unchanged when no monster uses an enemy', () => {
    const q = quest([{ id: 'm1', type: 'orc', cell: [6, 15] }]);
    expect(resolveEnemies(q)).toBe(q);
    expect(resolveMonster(q.monsters[0]!, q.enemyDefs)).toBe(q.monsters[0]);
  });

  it('the level, the view and the orders see the resolved monster', () => {
    const q = quest([{ id: 'm1', type: 'orc', cell: [6, 15], enemy: 'marsh' }]);
    const lv = buildLevel(q);
    expect(lv.quest.monsters[0]?.name).toBe('Marsh Orc');
    const s = replay(lv, 1, [
      { type: 'OPEN_DOOR', door: 'd2' },
      { type: 'OPEN_DOOR', door: 'd3' },
    ]);
    const v = monstersInPlay(lv, s).find((m) => m.id === 'm1')!;
    expect(v.name).toBe('Marsh Orc');
    expect(v.stats.att).toBe(4);
    expect(v.abilities.map((a) => a.id)).toEqual(['fireImmune']);
    const o = ordersFor(lv, s, ['barbarian']).find((x) => x.monster === 'm1')!;
    expect(o.special.some((l) => l.includes('Fireproof'))).toBe(true);
  });

  it('the validator knows the enemies, and rejects unknown ones', () => {
    expect(
      validateQuest(
        quest([{ id: 'm1', type: 'orc', cell: [6, 15], enemy: 'marsh' }]),
        board,
      ).filter((m) => m.includes('enemy')),
    ).toEqual([]);
    const bad = quest([{ id: 'm1', type: 'orc', cell: [6, 15], enemy: 'nope' }]);
    expect(validateQuest(bad, board).some((m) => m.includes('unknown enemy nope'))).toBe(true);
    const dup = quest([], { enemyDefs: [marsh, marsh] });
    expect(validateQuest(dup, board).some((m) => m.includes('duplicate id'))).toBe(true);
    const badAbility = quest([], { enemyDefs: [{ ...marsh, abilities: ['nope'] }] });
    expect(validateQuest(badAbility, board).some((m) => m.includes('unknown ability nope'))).toBe(
      true,
    );
  });

  it('an image must be a small png, jpeg or webp data URL', () => {
    expect(() =>
      quest([{ id: 'm1', type: 'orc', cell: [6, 15], image: 'http://example.com/a.png' }]),
    ).toThrow();
    expect(() => quest([{ id: 'm1', type: 'orc', cell: [6, 15], image: PNG }])).not.toThrow();
    const huge = `data:image/png;base64,${'A'.repeat(120_000)}`;
    expect(() => quest([{ id: 'm1', type: 'orc', cell: [6, 15], image: huge }])).toThrow();
  });
});

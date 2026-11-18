import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import { applyCoreFile, parseCoreFile } from '../../engine/data/coreFile';
import { replay } from '../../engine/game/reducer';
import { parseQuest } from '../../engine/quest/loader';
import { testQuestData } from '../../engine/quest/testQuest';
import { ordersFor } from '../../engine/zargon/orders';
import file from './frozen-horror.json';

applyCoreFile(parseCoreFile(file)!);
const enemy = file.items.filter((i) => i.kind === 'enemy').map((i) => i.data);

const orders = (monsterEnemy: string, seed = 1) => {
  const q = parseQuest({
    ...testQuestData,
    notes: [],
    enemyDefs: enemy,
    monsters: [{ id: 'm1', type: 'goblin', enemy: monsterEnemy, cell: [6, 15] }],
  });
  const lv = buildLevel(q);
  const s = replay(lv, seed, [
    { type: 'OPEN_DOOR', door: 'd2' },
    { type: 'OPEN_DOOR', door: 'd3' },
  ]);
  return ordersFor(lv, s, ['barbarian', 'dwarf']).find((o) => o.monster === 'm1')!;
};

describe('Frozen Horror items on Zargon cards', () => {
  it('a monster shows its abilities as special rules', () => {
    const o = orders('polarWarbear');
    expect(o.special.some((l) => l.startsWith('Two attacks:'))).toBe(true);
    expect(o.plan).toMatch(/Attack 1/);
    expect(orders('yeti').special.some((l) => l.startsWith('Bear hug:'))).toBe(true);
  });

  it('the Frozen Horror casts one of its spells, with the question and the warning of its tags', () => {
    const seen = new Map<string, string | undefined>();
    for (let seed = 1; seed <= 60; seed++) {
      const o = orders('frozenHorror', seed);
      expect(o.profile).toBe('caster');
      expect(o.special.some((l) => l.startsWith('Large:'))).toBe(true);
      seen.set(o.spell!.name, o.spell!.warning);
      expect(o.spell!.questions.length).toBeGreaterThan(0);
    }
    expect([...seen.keys()].sort()).toEqual([
      'Chill',
      'Ice Storm',
      'Ice Wall',
      'Mind Freeze',
      'Skate',
      'Soothe',
    ]);
    expect(seen.get('Ice Storm')).toMatch(/also hits monsters/);
    expect(seen.get('Mind Freeze')).toBeUndefined();
  });
});

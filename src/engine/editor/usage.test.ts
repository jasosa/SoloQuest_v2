import { describe, expect, it } from 'vitest';
import { addMonster, emptyQuest } from './ops';
import { usageOf } from './usage';
import type { Quest } from '../quest/schema';

const withMonsters = (title: string, extra: Partial<Quest>): { title: string; quest: Quest } => {
  let q = emptyQuest({ id: 'user-t', number: 1, title });
  for (const cell of [
    [4, 17],
    [5, 17],
  ] as [number, number][]) {
    const r = addMonster(q, 'orc', cell);
    if (!r.ok) throw new Error(r.error);
    q = r.quest;
  }
  return { title, quest: { ...q, ...extra } };
};

describe('usageOf', () => {
  it('counts core enemies by type, library enemies by id, abilities and spells', () => {
    const a = withMonsters('A', {});
    const b = withMonsters('B', {
      enemyDefs: [{ id: 'marsh', name: 'Marsh', base: 'orc', abilities: ['bog'], spells: ['mud'] }],
    });
    b.quest.monsters[0] = { ...b.quest.monsters[0]!, enemy: 'marsh', abilities: ['bog'] };
    expect(usageOf('enemy', 'orc', [a, b])).toEqual([
      { quest: 'A', count: 2 },
      { quest: 'B', count: 1 },
    ]);
    expect(usageOf('enemy', 'marsh', [a, b])).toEqual([{ quest: 'B', count: 1 }]);
    expect(usageOf('ability', 'bog', [a, b])).toEqual([{ quest: 'B', count: 2 }]); // monster + enemy
    expect(usageOf('spell', 'mud', [a, b])).toEqual([{ quest: 'B', count: 1 }]);
    expect(usageOf('spell', 'nope', [a, b])).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import { applyCoreFile, parseCoreFile } from '../../engine/data/coreFile';
import { replay } from '../../engine/game/reducer';
import { parseQuest } from '../../engine/quest/loader';
import { testQuestData } from '../../engine/quest/testQuest';
import { ordersFor, type OrderOptions } from '../../engine/zargon/orders';
import file from './frozen-horror.json';

applyCoreFile(parseCoreFile(file)!);
const enemy = file.items.filter((i) => i.kind === 'enemy').map((i) => i.data);

const orders = (
  monsterEnemy: string,
  seed = 1,
  opts: OrderOptions = {},
  quest: Record<string, unknown> = {},
) => {
  const q = parseQuest({
    ...testQuestData,
    ...quest,
    notes: [],
    enemyDefs: enemy,
    monsters: [{ id: 'm1', type: 'goblin', enemy: monsterEnemy, cell: [6, 15] }],
  });
  const lv = buildLevel(q);
  const s = replay(lv, seed, [
    { type: 'OPEN_DOOR', door: 'd2' },
    { type: 'OPEN_DOOR', door: 'd3' },
  ]);
  return ordersFor(lv, s, ['barbarian', 'dwarf'], undefined, opts).find((o) => o.monster === 'm1')!;
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

describe('the settings that change a card (decisions 59 and 61)', () => {
  const solo = { team: { solo: true } };

  it('No Yeti hug in solo quests: a solo quest plays the Yeti as a plain brute, a group quest does not', () => {
    const on = { noHugInSolo: true };
    expect(orders('yeti', 1, on, solo).plan).toMatch(/does not hug/);
    expect(orders('yeti', 1, on, solo).special).toContain(
      'Solo quest: it does not hug. Ignore the hug rule above.',
    );
    // a quest for a group keeps the hug
    expect(orders('yeti', 1, on).plan).toMatch(/hugging/);
    // the setting off: the hug stays even when the quest is solo
    expect(orders('yeti', 1, { noHugInSolo: false }, solo).plan).toMatch(/hugging/);
    expect(orders('yeti', 1, {}, solo).plan).toMatch(/hugging/);
  });

  it('the Raiment setting names the artifact warnings on the Gremlin and the Yeti cards only', () => {
    const raiment = { raiment: true };
    expect(orders('iceGremlin', 1, raiment).special.join(' ')).toMatch(/Cold Iron Plate Mail/);
    expect(orders('yeti', 1, raiment).special.join(' ')).toMatch(/Spiked Shield/);
    expect(orders('polarWarbear', 1, raiment).special.join(' ')).not.toMatch(/Raiment/);
    expect(orders('iceGremlin', 1).special.join(' ')).not.toMatch(/Raiment/);
  });
});

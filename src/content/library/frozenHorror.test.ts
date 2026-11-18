import { describe, expect, it } from 'vitest';
import { EnemyDefSchema } from '../../engine/quest/schema';
import file from './frozen-horror.json';

describe('the Frozen Horror monsters', () => {
  const items = file.items;
  it('are all enemies of the Frozen Horror expansion, and valid enemy definitions', () => {
    expect(items).toHaveLength(8);
    for (const it of items) {
      expect(it.kind).toBe('enemy');
      expect(it.expansion).toBe('Frozen Horror');
      const parsed = EnemyDefSchema.safeParse({ ...it.data, expansion: it.expansion });
      expect(parsed.success, `${it.data.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });
  it('the Frozen Horror is large, the Warbear hits twice, the plans are the pack profiles', () => {
    const by = Object.fromEntries(items.map((i) => [i.data.id, i.data as Record<string, unknown>]));
    expect(by.frozenHorror).toMatchObject({ size: 2, profile: 'caster' });
    expect(by.polarWarbear).toMatchObject({ attacks: 2 });
    expect(by.iceGremlin?.profile).toBe('thief');
    expect(by.yeti?.profile).toBe('grappler');
    expect(by.crossbowman?.profile).toBe('shooter');
  });
});

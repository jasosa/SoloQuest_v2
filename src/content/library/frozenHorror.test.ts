import { describe, expect, it } from 'vitest';
import { CORE_ABILITIES } from '../../engine/data/abilities';
import { SPELL_TAG_IDS } from '../../engine/data/spells';
import { EnemyDefSchema } from '../../engine/quest/schema';
import file from './frozen-horror.json';

type Item = (typeof file.items)[number];
const of = (kind: string): Item[] => file.items.filter((i) => i.kind === kind);

describe('the Frozen Horror items', () => {
  it('are all of the Frozen Horror expansion', () => {
    for (const it of file.items) expect(it.expansion).toBe('Frozen Horror');
  });

  it('the monsters are valid enemy definitions', () => {
    expect(of('enemy')).toHaveLength(8);
    for (const it of of('enemy')) {
      const parsed = EnemyDefSchema.safeParse({ ...it.data, expansion: it.expansion });
      expect(parsed.success, `${it.data.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });

  it('the Frozen Horror is large, the Warbear hits twice, the plans are the pack profiles', () => {
    const by = Object.fromEntries(
      of('enemy').map((i) => [i.data.id, i.data as Record<string, unknown>]),
    );
    expect(by.frozenHorror).toMatchObject({ size: 2, profile: 'caster' });
    expect(by.polarWarbear).toMatchObject({ attacks: 2 });
    expect(by.iceGremlin?.profile).toBe('thief');
    expect(by.yeti?.profile).toBe('grappler');
    expect(by.crossbowman?.profile).toBe('shooter');
  });

  it('special rules are Library abilities, not loose text, and every one a monster names exists', () => {
    const known = new Set([
      ...CORE_ABILITIES.map((a) => a.id),
      ...of('ability').map((a) => a.data.id),
    ]);
    for (const it of of('enemy')) {
      expect(it.data).not.toHaveProperty('traits');
      for (const a of (it.data as { abilities?: string[] }).abilities ?? [])
        expect(known.has(a), `${it.data.id} names ability ${a}`).toBe(true);
    }
    expect(of('ability')).toHaveLength(7);
  });

  it('the six spells use only known situation tags, and the Frozen Horror casts them all', () => {
    expect(
      of('spell')
        .map((s) => s.data.name)
        .sort(),
    ).toEqual(['Chill', 'Ice Storm', 'Ice Wall', 'Mind Freeze', 'Skate', 'Soothe']);
    for (const s of of('spell'))
      for (const t of (s.data as { tags: string[] }).tags)
        expect((SPELL_TAG_IDS as readonly string[]).includes(t)).toBe(true);
    const fh = of('enemy').find((e) => e.data.id === 'frozenHorror')!.data as { spells: string[] };
    expect(fh.spells.sort()).toEqual(
      of('spell')
        .map((s) => s.data.id)
        .sort(),
    );
  });
});

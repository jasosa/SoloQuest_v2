import { describe, expect, it } from 'vitest';
import { MemoryThemeStore } from '../../persist/themes';
import { getActiveTheme } from './activeTheme';
import { applyPack } from './activate';
import { PackManifestSchema, type StoredPack } from './pack';
import { CLASSIC_THEME, mergeThemes } from './theme';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const pack = (m: Record<string, unknown>, files: string[]): StoredPack => ({
  manifest: PackManifestSchema.parse({ format: 'sqtextures', version: 1, ...m }),
  files: Object.fromEntries(files.map((f) => [f, { mime: 'image/png', bytes: PNG }])),
});

describe('texture packs that build on another (Frozen Horror on core)', () => {
  it('the manifest takes the quest pack it dresses and the pack it extends', () => {
    const m = PackManifestSchema.parse({
      format: 'sqtextures',
      version: 1,
      id: 'fh-art',
      name: 'FH art',
      box: 'frozen-horror',
      extends: 'core-art',
    });
    expect(m.box).toBe('frozen-horror');
    expect(m.extends).toBe('core-art');
    expect(() =>
      PackManifestSchema.parse({
        format: 'sqtextures',
        version: 1,
        id: 'x1',
        name: 'x',
        extends: 'Bad Id',
      }),
    ).toThrow();
  });

  it('the child wins slot by slot and keeps the parent for the rest', () => {
    const merged = mergeThemes(
      {
        id: 'core-art',
        name: 'Core',
        board: 'b',
        monster: { orc: 'o', goblin: 'g' },
        door: { closed: 'c' },
      },
      { id: 'fh-art', name: 'FH', monster: { goblin: 'ice' } },
    );
    expect(merged.id).toBe('fh-art');
    expect(merged.board).toBe('b');
    expect(merged.monster).toEqual({ orc: 'o', goblin: 'ice' });
    expect(merged.door).toEqual({ closed: 'c' });
  });

  it('a child pack is used on top of its parent, and refused when the parent is not installed', async () => {
    const store = new MemoryThemeStore();
    await store.save(
      pack(
        {
          id: 'fh-art',
          name: 'FH art',
          box: 'frozen-horror',
          extends: 'core-art',
          monster: { goblin: 'ice.png' },
        },
        ['ice.png'],
      ),
    );
    expect(await applyPack(store, 'fh-art')).toBe(false);
    expect(getActiveTheme()).toBe(CLASSIC_THEME);
    await store.save(
      pack({ id: 'core-art', name: 'Core art', monster: { orc: 'orc.png' } }, ['orc.png']),
    );
    expect(await applyPack(store, 'fh-art')).toBe(true);
    const t = getActiveTheme();
    expect(Object.keys(t.monster ?? {}).sort()).toEqual(['goblin', 'orc']);
    await applyPack(store, null);
  });
});

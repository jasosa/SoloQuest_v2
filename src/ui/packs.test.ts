import { describe, expect, it } from 'vitest';
import { CORE_PACK, PackError } from '../engine/pack/registry';
import { loadRegistry, packOfQuest, packs } from './packs';

describe('the installed packs', () => {
  it('core is the base game with the 14 quests of the book, in order', () => {
    const core = packs.byId.get(CORE_PACK)!;
    expect(core.manifest.quests).toHaveLength(14);
    expect(core.manifest.quests[0]).toBe('q01-the-trial');
    expect(core.requires).toEqual([]);
    expect(packOfQuest('q07-the-lost-wizard')).toBe('core');
    expect(packOfQuest('user-my-quest')).toBeUndefined();
  });
  it('Frozen Horror depends on core, and so far has only the prelude, quest 0', () => {
    const fh = packs.byId.get('frozen-horror')!;
    expect(fh.requires).toEqual([CORE_PACK]);
    expect(fh.manifest.quests).toEqual(['fh00-into-the-northlands']);
    expect(packOfQuest('fh00-into-the-northlands')).toBe('frozen-horror');
    expect(fh.manifest.campaignSettings[0]?.default).toBe(false);
    expect(packs.packs.map((p) => p.manifest.id)).toEqual([CORE_PACK, 'frozen-horror']);
  });
  it('refuses a quest that no pack lists', () => {
    const quest = Object.values(
      import.meta.glob('../content/quests/q01-*.json', { eager: true, import: 'default' }),
    )[0];
    const stray = { ...(quest as object), id: 'stray-quest' };
    expect(() => loadRegistry(undefined, { a: quest, b: stray })).toThrow(PackError);
  });
});

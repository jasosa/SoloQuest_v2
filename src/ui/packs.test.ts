import { describe, expect, it } from 'vitest';
import { CORE_PACK, PackError } from '../engine/pack/registry';
import { levelOfId } from './quests';
import { loadRegistry, packOfQuest, packTabs, packs } from './packs';

describe('the installed packs', () => {
  it('core is the base game with the 14 quests of the book, in order', () => {
    const core = packs.byId.get(CORE_PACK)!;
    expect(core.manifest.quests).toHaveLength(14);
    expect(core.manifest.quests[0]).toBe('q01-the-trial');
    expect(core.requires).toEqual([]);
    expect(packOfQuest('q07-the-lost-wizard')).toBe('core');
    expect(packOfQuest('user-my-quest')).toBeUndefined();
  });
  it('Frozen Horror depends on core and lists the prelude, quest 0, first', () => {
    const fh = packs.byId.get('frozen-horror')!;
    expect(fh.requires).toEqual([CORE_PACK]);
    expect(fh.manifest.quests[0]).toBe('fh00-into-the-northlands');
    expect(fh.manifest.quests.every((id) => id.startsWith('fh'))).toBe(true);
    expect(packOfQuest('fh00-into-the-northlands')).toBe('frozen-horror');
    expect(fh.manifest.campaignSettings[0]?.default).toBe(false);
    expect(packs.packs.map((p) => p.manifest.id)).toEqual([CORE_PACK, 'frozen-horror']);
  });
  it('shows pack tabs only while two packs have a quest to play', () => {
    expect(packTabs(packs, () => true).map((t) => [t.id, t.name])).toEqual([
      ['core', 'Core game'],
      ['frozen-horror', 'Frozen Horror'],
    ]);
    // the expansion has no encoded quest: one pack, nothing to choose
    expect(packTabs(packs, (id) => !id.startsWith('fh'))).toEqual([]);
    // only the expansion has quests: still one pack
    expect(packTabs(packs, (id) => id.startsWith('fh'))).toEqual([]);
  });
  it('Frozen Horror offers the alternate Barbarian and the wolf in the New game popup', () => {
    const team = packs.byId.get('frozen-horror')!.manifest.team;
    expect(team.heroes).toEqual([
      { id: 'alternate-barbarian', name: 'Barbarian (alternate)', as: 'barbarian' },
    ]);
    expect(team.allies.map((a) => a.id)).toEqual(['snowdasher']);
    expect(packs.byId.get(CORE_PACK)!.manifest.team.heroes).toEqual([]);
  });
  it('the quests carry their team rule: the prelude is solo with the wolf, quest 1 is the Barbarian alone', () => {
    expect(levelOfId('fh00-into-the-northlands')?.quest.team).toEqual({
      solo: true,
      grantsAlly: 'snowdasher',
    });
    expect(levelOfId('fh01-xanon-pass')?.quest.team).toEqual({ solo: true, only: ['barbarian'] });
    expect(levelOfId('fh04-the-glacial-gate')?.quest.team).toBeUndefined();
    // monsters ignore Gothar in the rescue (decision 39)
    expect(levelOfId('fh03-the-rescue')?.quest.excludeTargets).toEqual(['gothar']);
  });
  it('refuses a quest that no pack lists', () => {
    const quest = Object.values(
      import.meta.glob('../content/quests/q01-*.json', { eager: true, import: 'default' }),
    )[0];
    const stray = { ...(quest as object), id: 'stray-quest' };
    expect(() => loadRegistry(undefined, { a: quest, b: stray })).toThrow(PackError);
  });
});

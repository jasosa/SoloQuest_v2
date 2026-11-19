import { describe, expect, it } from 'vitest';
import { levelOfId, levelOfSlot, questEntries } from './quests';

describe('the bundled quest entries', () => {
  it('have a unique slot each, and core quests keep their own number', () => {
    const slots = questEntries.map((e) => e.slot);
    expect(new Set(slots).size).toBe(slots.length);
    for (let n = 1; n <= 14; n++) {
      const e = questEntries.find((q) => q.slot === n);
      expect(e?.number).toBe(n);
      expect(e?.level?.quest.pack).toBeUndefined();
    }
  });

  it('list every Frozen Horror quest even when its number is a core number', () => {
    const fh = questEntries.filter((e) => e.level?.quest.pack === 'frozen-horror');
    expect(fh.map((e) => e.number).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    // the prelude has no core twin, so it keeps slot 0; the others sit in the 100s
    expect(levelOfSlot(0)?.quest.id).toBe('fh00-into-the-northlands');
    expect(levelOfSlot(103)?.quest.id).toBe('fh03-the-rescue');
    expect(levelOfSlot(3)?.quest.id).toBe('q03-lair-of-the-orc-warlord');
  });

  it('find a quest by id', () => {
    expect(levelOfId('fh05-the-deadly-depths')?.quest.number).toBe(5);
    expect(levelOfId('nope')).toBeUndefined();
  });
});

describe('what the manifests promise', () => {
  it('every quest file and every quest of a pack manifest is in the quest list', async () => {
    const files = import.meta.glob('../content/quests/*.json', { eager: true, import: 'default' });
    expect(questEntries.filter((e) => e.level)).toHaveLength(Object.keys(files).length);
    const { packs } = await import('./packs');
    for (const p of packs.packs)
      for (const id of p.manifest.quests) expect(levelOfId(id), id).toBeDefined();
  });
});

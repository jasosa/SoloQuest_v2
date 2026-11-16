import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DexieLibraryStore,
  LIBRARY_FORMAT,
  MemoryLibraryStore,
  checkedItem,
  type LibraryStore,
} from './library';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const ability = { id: 'bog', name: 'Bog skin', text: 'Mud spells fail.', kind: 'immunity' };
const spell = { id: 'mud', name: 'Mud', tags: ['heroAdjacent'] };
const enemy = { id: 'marsh', name: 'Marsh Orc', base: 'orc', letter: 'M', image: PNG };
const hero = { id: 'knight', name: 'Knight', image: PNG };
const companion = { id: 'ragnar', name: 'Sir Ragnar', defend: 2, body: 2, text: 'A knight.' };

function suite(name: string, make: () => LibraryStore) {
  describe(`${name} library store`, () => {
    it('saves and lists items by kind, by name', async () => {
      const s = make();
      await s.save('ability', ability, 1);
      await s.save('ability', { id: 'a2', name: 'Armor', text: 'x' }, 2);
      await s.save('spell', spell, 3);
      await s.save('enemy', enemy, 4);
      await s.save('hero', hero, 5);
      await s.save('companion', companion, 6);
      expect((await s.list('ability')).map((i) => i.name)).toEqual(['Armor', 'Bog skin']);
      expect((await s.list('spell')).map((i) => i.id)).toEqual(['mud']);
      expect((await s.list()).length).toBe(6);
      expect((await s.list('enemy'))[0]?.data).toMatchObject({ letter: 'M', image: PNG });
    });

    it('a save with the same kind and id replaces the item', async () => {
      const s = make();
      await s.save('ability', ability, 1);
      await s.save('ability', { ...ability, name: 'Marsh skin' }, 2);
      expect((await s.list('ability')).map((i) => i.name)).toEqual(['Marsh skin']);
    });

    it('refuses data that is not valid for its kind', async () => {
      const s = make();
      await expect(s.save('ability', { id: 'x', name: '' }, 1)).rejects.toThrow();
      await expect(s.save('spell', { id: 'x', name: 'X', tags: [] }, 1)).rejects.toThrow();
      await expect(s.save('enemy', { ...enemy, image: 'http://x/a.png' }, 1)).rejects.toThrow();
      await expect(s.save('hero', { id: 'h' }, 1)).rejects.toThrow();
      expect(await s.list()).toEqual([]);
    });

    it('removes an item', async () => {
      const s = make();
      await s.save('hero', hero, 1);
      await s.remove('hero', 'knight');
      expect(await s.list('hero')).toEqual([]);
    });

    it('exports to a file and imports it again, on another store', async () => {
      const a = make();
      await a.save('ability', ability, 1);
      await a.save('enemy', enemy, 2);
      const text = await a.exportAll();
      expect(JSON.parse(text).format).toBe(LIBRARY_FORMAT);
      const b = make();
      expect(await b.importAll(text, 9)).toEqual({ added: 2, replaced: 0, skipped: 0 });
      expect((await b.list()).map((i) => i.id).sort()).toEqual(['bog', 'marsh']);
      // importing again replaces, not duplicates
      expect(await b.importAll(text, 10)).toEqual({ added: 0, replaced: 2, skipped: 0 });
      expect((await b.list()).length).toBe(2);
    });

    it('imports the valid items of a file and counts the rest as skipped', async () => {
      const s = make();
      const text = JSON.stringify({
        format: LIBRARY_FORMAT,
        version: 1,
        items: [
          { kind: 'ability', data: ability },
          { kind: 'ability', data: { id: 'bad' } },
        ],
      });
      expect(await s.importAll(text, 1)).toEqual({ added: 1, replaced: 0, skipped: 1 });
      await expect(s.importAll('not json', 1)).rejects.toThrow('not a library file');
      await expect(s.importAll('{"format":"other"}', 1)).rejects.toThrow('not a library file');
    });
  });
}

suite('memory', () => new MemoryLibraryStore());

let n = 0;
const open: DexieLibraryStore[] = [];
afterEach(() => {
  for (const s of open.splice(0)) s.close();
});
suite('IndexedDB', () => {
  const s = new DexieLibraryStore(`lib-test-${++n}`);
  open.push(s);
  return s;
});

describe('checkedItem', () => {
  it('gives the id and name of a valid item', () => {
    expect(checkedItem('spell', spell)).toMatchObject({ id: 'mud', name: 'Mud' });
    expect(checkedItem('spell', { id: 'x' })).toBeUndefined();
  });
});

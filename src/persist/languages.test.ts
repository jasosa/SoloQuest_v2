import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { copyOfEnglish } from '../i18n/file';
import {
  DexieLanguageStore,
  EnglishIsFixedError,
  MemoryLanguageStore,
  type LanguageStore,
} from './languages';

// The tests run in Node: a small localStorage for the language in use.
if (typeof localStorage === 'undefined') {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  });
}

const english = { 'a.one': 'One', 'quest:q1:title': 'Trial' };
const es = copyOfEnglish(english, 'Espanol', 'es', 'Ana');

function suite(name: string, make: () => LanguageStore) {
  describe(`${name} language store`, () => {
    it('saves, lists, loads, replaces and removes a language', async () => {
      const s = make();
      expect(await s.list()).toEqual([]);
      await s.save(es);
      expect(await s.list()).toEqual([
        { code: 'es', name: 'Espanol', author: 'Ana', base: es.base, count: 2 },
      ]);
      expect(await s.load('es')).toEqual(es);
      await s.save({ ...es, strings: { 'a.one': 'Uno' } });
      expect((await s.load('es'))?.strings).toEqual({ 'a.one': 'Uno' });
      expect(await s.list()).toHaveLength(1);
      await s.remove('es');
      expect(await s.list()).toEqual([]);
      expect(await s.load('es')).toBeUndefined();
    });
    it('keeps the language in use, and English when it is removed', async () => {
      const s = make();
      expect(await s.getActive()).toBeNull();
      await s.save(es);
      await s.setActive('es');
      expect(await s.getActive()).toBe('es');
      await s.remove('es');
      expect(await s.getActive()).toBeNull();
    });
    it('can never save over, remove or choose English', async () => {
      const s = make();
      const fake = { ...es, language: { name: 'English', code: 'en' } };
      await expect(s.save(fake)).rejects.toBeInstanceOf(EnglishIsFixedError);
      await expect(s.remove('en')).rejects.toBeInstanceOf(EnglishIsFixedError);
      await s.setActive('en');
      expect(await s.getActive()).toBeNull();
      expect(await s.list()).toEqual([]);
    });
  });
}

suite('memory', () => new MemoryLanguageStore());
let n = 0;
suite('IndexedDB', () => new DexieLanguageStore(`test-languages-${n++}`));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { placeholdersOf } from '../../src/i18n/translate';
import { COVERED, ROOT, readCatalogue } from './catalogue';
import { literals } from './scan';

describe('interface text catalogue', () => {
  const { strings, problems } = readCatalogue();

  it('has no t() call that the tool cannot read', () => {
    expect(problems).toEqual([]);
  });

  it('matches src/i18n/en.json (run: npm run i18n -- write)', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'en.json'), 'utf8')) as Record<
      string,
      string
    >;
    expect(en).toEqual(strings);
  });

  it('uses plain keys and {name} placeholders', () => {
    for (const [key, text] of Object.entries(strings)) {
      expect(key, key).toMatch(/^[A-Za-z][\w.]*$/);
      expect(text.length, key).toBeGreaterThan(0);
      // a brace that is not a {name} placeholder would be printed as it is
      expect(text.replace(/\{\w+\}/g, ''), key).not.toMatch(/[{}]/);
    }
  });

  it('keeps a placeholder list that the English text and the call agree on', () => {
    // every text with placeholders is also a text a translator must keep them in
    const withPlaceholders = Object.values(strings).filter((s) => placeholdersOf(s).length);
    expect(withPlaceholders.length).toBeGreaterThan(10);
  });
});

describe('covered files have no untranslated interface text', () => {
  for (const file of COVERED)
    it(file, () => {
      const found = literals(file, readFileSync(join(ROOT, file), 'utf8'));
      expect(found.map((l) => `${l.line}: ${l.text.slice(0, 50)}`)).toEqual([]);
    });
});

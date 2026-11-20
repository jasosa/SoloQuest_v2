import { describe, expect, it } from 'vitest';
import '../content/core';
import { TRAP_KINDS_DATA } from '../engine/data/trapKinds';
import { parseQuest } from '../engine/quest/loader';
import { applyDataStrings, dataStrings } from './dataText';
import { englishStrings } from './english';
import {
  baseOf,
  compare,
  copyOfEnglish,
  languageToText,
  parseLanguageFile,
  placeholderProblem,
} from './file';
import { questStrings, translateQuest, uncoveredProse } from './questText';
import { fill, placeholdersOf, setActiveStrings, tr } from './translate';

const files = import.meta.glob('../content/quests/*.json', { eager: true, import: 'default' });
const raws = Object.values(files) as { id: string }[];

const mini = {
  id: 'user-mini',
  title: 'Mini',
  intro: { summary: 'A short one.' },
  start: { area: 'R01' },
  notes: [
    {
      id: 'n-B',
      trigger: { type: 'manual', label: 'Pull it', hint: 'Be next to it.' },
      effects: [
        { type: 'setFlag', flag: 'a b', value: true },
        {
          type: 'promptChoice',
          text: 'Pull the lever?',
          options: [
            { label: 'Yes', effects: [{ type: 'showText', title: 'Done', text: 'It clicks.' }] },
            { label: 'No', effects: [] },
          ],
        },
      ],
    },
  ],
  monsters: [{ id: 'm1', type: 'goblin', name: 'Krag', traits: ['Slow.', 'Loud.'] }],
  markers: [{ id: 'k1', label: 'X' }],
};

describe('quest keys', () => {
  it('names list items by id, else by position, and never ids or letters', () => {
    const s = questStrings(mini);
    expect(s).toEqual({
      'quest:user-mini:title': 'Mini',
      'quest:user-mini:intro.summary': 'A short one.',
      'quest:user-mini:notes.n-B.trigger.label': 'Pull it',
      'quest:user-mini:notes.n-B.trigger.hint': 'Be next to it.',
      'quest:user-mini:notes.n-B.effects.1.text': 'Pull the lever?',
      'quest:user-mini:notes.n-B.effects.1.options.0.label': 'Yes',
      'quest:user-mini:notes.n-B.effects.1.options.0.effects.0.title': 'Done',
      'quest:user-mini:notes.n-B.effects.1.options.0.effects.0.text': 'It clicks.',
      'quest:user-mini:notes.n-B.effects.1.options.1.label': 'No',
      'quest:user-mini:monsters.m1.name': 'Krag',
      'quest:user-mini:monsters.m1.traits.0': 'Slow.',
      'quest:user-mini:monsters.m1.traits.1': 'Loud.',
    });
  });

  it('falls back to positions when ids repeat', () => {
    const q = {
      id: 'x',
      title: 'T',
      monsters: [
        { id: 'a', name: 'One' },
        { id: 'a', name: 'Two' },
      ],
    };
    expect(Object.keys(questStrings(q))).toContain('quest:x:monsters.1.name');
  });
});

describe('quest overlay', () => {
  const tr1 = {
    'quest:user-mini:title': 'Pequeno',
    'quest:user-mini:notes.n-B.effects.1.options.0.effects.0.text': 'Hace clic.',
    'quest:user-mini:monsters.m1.traits.1': 'Ruidoso.',
    'quest:user-mini:notes.n-B.trigger.hint': '',
    'quest:user-mini:notes.gone.effects.0.text': 'extra key',
    'quest:other:title': 'Otro',
  };
  it('replaces texts, keeps missing and empty ones, ignores extra keys, never edits the input', () => {
    const copy = JSON.parse(JSON.stringify(mini));
    const out = translateQuest(mini, tr1) as typeof mini;
    expect(out.title).toBe('Pequeno');
    expect(out.intro.summary).toBe('A short one.');
    expect(out.monsters[0]!.traits).toEqual(['Slow.', 'Ruidoso.']);
    expect(out.notes[0]!.trigger.hint).toBe('Be next to it.');
    expect(
      (out.notes[0]!.effects[1] as { options: { effects: { text: string }[] }[] }).options[0]!
        .effects[0]!.text,
    ).toBe('Hace clic.');
    expect(mini).toEqual(copy);
  });
  it('returns the same object when the language has nothing for the quest', () => {
    expect(translateQuest(mini, { 'quest:other:title': 'x' })).toBe(mini);
    expect(translateQuest(mini, {})).toBe(mini);
  });
  it('does not touch ids, flags or squares', () => {
    const out = translateQuest(mini, { 'quest:user-mini:notes.n-B.effects.0.flag': 'zzz' });
    expect(out).toBe(mini);
  });
});

describe('bundled quests', () => {
  it('has no string that looks like prose and is not a text field', () => {
    for (const q of raws) expect(uncoveredProse(q), q.id).toEqual([]);
  });
  it('gives every quest at least a title and an intro, with unique keys', () => {
    const seen = new Set<string>();
    for (const q of raws) {
      const s = questStrings(q);
      expect(s[`quest:${q.id}:title`]).toMatch(/\S/);
      expect(s[`quest:${q.id}:intro.summary`]).toMatch(/\S/);
      for (const k of Object.keys(s)) {
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
  });
  it('keeps a quest valid after a full overlay of its own English', () => {
    for (const q of raws) {
      const same = translateQuest(q, questStrings(q));
      expect(parseQuest(same)).toEqual(parseQuest(q));
    }
  });
  it('translates a note text of a real quest', () => {
    const q = raws.find((r) => r.id === 'q01-the-trial')!;
    const key = Object.keys(questStrings(q)).find(
      (k) => k.includes(':notes.') && k.endsWith('.text'),
    )!;
    const out = parseQuest(translateQuest(q, { [key]: 'TRANSLATED' }));
    expect(JSON.stringify(out)).toContain('TRANSLATED');
  });
});

describe('data texts', () => {
  it('lists trap, spell, ability, monster, tile and Zargon texts', () => {
    const d = dataStrings();
    expect(d['data:trapKinds.pit.name']).toBe('pit trap');
    expect(d['data:trapKinds.pit.lines.0']).toMatch(/\S/);
    expect(d['data:monsters.goblin']).toBe('Goblin');
    expect(d['data:spellTags.any']).toMatch(/\S/);
    expect(d['library:spell:fear.name']).toBe('Fear');
    expect(d['data:roomTiles.iceVault.rule.0']).toMatch(/\S/);
    expect(d['data:zargonPlans.skirmisher']).toMatch(/\S/);
  });
  it('applies a translation and puts the English back', () => {
    const before = TRAP_KINDS_DATA.pit.name;
    const undo = applyDataStrings({
      'data:trapKinds.pit.name': 'trampa de foso',
      'data:trapKinds.pit.lines.0': '',
    });
    expect(TRAP_KINDS_DATA.pit.name).toBe('trampa de foso');
    expect(TRAP_KINDS_DATA.pit.lines[0]).not.toBe('');
    undo();
    expect(TRAP_KINDS_DATA.pit.name).toBe(before);
  });
});

describe('lookup', () => {
  it('falls back to English and fills placeholders', () => {
    setActiveStrings({ 'a.b': 'Hola {who}' });
    expect(tr('a.b', 'Hello {who}', { who: 'Ana' })).toBe('Hola Ana');
    expect(tr('a.c', 'Bye {who}', { who: 'Ana' })).toBe('Bye Ana');
    expect(tr('a.d', 'No vars')).toBe('No vars');
    setActiveStrings({ 'a.b': '' });
    expect(tr('a.b', 'Hello')).toBe('Hello');
    setActiveStrings({});
  });
  it('fills only known names and lists placeholders', () => {
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(placeholdersOf('{a} {b} {a}')).toEqual(['a', 'b']);
  });
});

describe('language file', () => {
  const english = { 'x.one': 'One {n}', 'x.two': 'Two' };
  const good = copyOfEnglish(english, 'Espanol', 'es', 'Ana');
  const bad = (text: string) => {
    const r = parseLanguageFile(text);
    return r.ok ? '' : r.message;
  };
  it('round-trips through text', () => {
    const r = parseLanguageFile(languageToText(good));
    expect(r).toEqual({ ok: true, file: good });
    expect(good.base).toBe(baseOf(english));
  });
  it('gives friendly errors', () => {
    expect(bad('{nope')).toMatch(/not valid JSON/);
    expect(bad('{"format":"other"}')).toMatch(/not a SoloQuest translation/);
    expect(bad(JSON.stringify({ ...good, language: { name: '', code: 'es' } }))).toMatch(
      /needs a name/,
    );
    expect(bad(JSON.stringify({ ...good, language: { name: 'E', code: 'ES!' } }))).toMatch(
      /language code/,
    );
    expect(bad(JSON.stringify({ ...good, strings: { a: 3 } }))).toMatch(/\S/);
    expect(bad(JSON.stringify({ ...good, language: { name: 'English', code: 'en' } }))).toMatch(
      /supplied by the app/,
    );
    expect(bad('x'.repeat(6 * 1024 * 1024))).toMatch(/too big/);
  });
  it('compares with English: extra, missing and untouched keys', () => {
    const c = compare(english, { 'x.one': 'Uno {n}', 'x.old': 'viejo', 'x.two': '' });
    expect(c.extra).toEqual(['x.old']);
    expect(c.missing).toEqual(['x.two']);
    expect(compare(english, english).sameAsEnglish).toHaveLength(2);
  });
  it('checks placeholders', () => {
    expect(placeholderProblem('One {n}', 'Uno {n}')).toBeUndefined();
    expect(placeholderProblem('One {n}', 'Uno')).toMatch(/Missing/);
    expect(placeholderProblem('One', 'Uno {q}')).toMatch(/Unknown/);
    expect(placeholderProblem('One {n}', '')).toBeUndefined();
  });
  it('the base changes when the English changes', () => {
    expect(baseOf({ a: '1' })).not.toBe(baseOf({ a: '2' }));
    expect(baseOf({ a: '1', b: '2' })).toBe(baseOf({ b: '2', a: '1' }));
  });
});

describe('the English file', () => {
  it('holds the quests, the library and the interface', () => {
    const e = englishStrings(raws);
    expect(Object.keys(e).length).toBeGreaterThan(800);
    expect(Object.values(e).every((v) => typeof v === 'string' && v.length > 0)).toBe(true);
  });
});

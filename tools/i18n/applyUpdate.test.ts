import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import prettier from 'prettier';
import ts from 'typescript';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { parseQuest } from '../../src/engine/quest/loader';
import { BUILTIN_UPDATE_CODE, copyOfEnglish, languageToText } from '../../src/i18n/file';
import { applyUpdate, literal, setTableText } from './applyUpdate';
import { ROOT, readCatalogue, sortedJson } from './catalogue';

/** The files of the repository that the update can touch, copied to a temp folder for each test. */
const COPY = [
  '.prettierrc',
  '.prettierrc.json',
  'src/i18n/en.json',
  'src/content/library',
  'src/content/quests/q01-the-trial.json',
  'src/engine/data/trapKinds.ts',
  'src/engine/data/spells.ts',
  'src/engine/data/abilities.ts',
  'src/engine/data/monsters.ts',
  'src/engine/data/heroes.ts',
  'src/engine/data/roomTiles.ts',
  'src/engine/zargon/texts.ts',
  'src/ui/select/StartPages.tsx',
  'src/ui/select/TeamPicker.tsx',
];

const temps: string[] = [];
let root = '';
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sq-apply-'));
  temps.push(root);
  for (const f of COPY) {
    if (!existsSync(join(ROOT, f))) continue;
    mkdirSync(dirname(join(root, f)), { recursive: true });
    cpSync(join(ROOT, f), join(root, f), { recursive: true });
  }
});
afterAll(() => temps.forEach((t) => rmSync(t, { recursive: true, force: true })));

const update = (strings: Record<string, string>) =>
  languageToText({
    ...copyOfEnglish({}, 'English (built-in update)', BUILTIN_UPDATE_CODE),
    date: '2026-11-20',
    strings,
  });
const text = (file: string) => readFileSync(join(root, file), 'utf8');
const tsErrors = (file: string) =>
  ts.transpileModule(text(file), { reportDiagnostics: true, fileName: file }).diagnostics ?? [];
const QUEST = 'src/content/quests/q01-the-trial.json';
const NOTE = 'quest:q01-the-trial:notes.n-start.effects.0.text';

describe('applying an update of the built-in English', () => {
  it('changes an interface string in the code and in en.json', async () => {
    const r = await applyUpdate(root, update({ 'select.builtInLook': 'Pick your quest' }));
    expect(r.refused).toEqual([]);
    expect(r.changes.map((c) => c.key)).toEqual(['select.builtInLook']);
    expect(text('src/ui/select/StartPages.tsx')).toContain("'Pick your quest'");
    expect(text('src/ui/select/StartPages.tsx')).not.toContain("'Built-in look'");
    const en = JSON.parse(text('src/i18n/en.json')) as Record<string, string>;
    expect(en['select.builtInLook']).toBe('Pick your quest');
    // en.json is what the code says (the check the repository runs)
    expect(en).toEqual(readCatalogue(root).strings);
    expect(tsErrors('src/ui/select/StartPages.tsx')).toEqual([]);
  });

  it('changes a quest note text and keeps the quest valid and its formatting', async () => {
    const before = text(QUEST);
    const r = await applyUpdate(root, update({ [NOTE]: 'Put the heroes on the stairs, please.' }));
    expect(r.changes).toHaveLength(1);
    const after = text(QUEST);
    expect(after).toContain('Put the heroes on the stairs, please.');
    // one line changed, nothing else moved (Prettier keeps the file as it was)
    const a = before.split('\n');
    const b = after.split('\n');
    expect(b).toHaveLength(a.length);
    expect(b.filter((line, i) => line !== a[i])).toHaveLength(1);
    expect(parseQuest(JSON.parse(after)).notes.find((n) => n.id === 'n-start')).toBeDefined();
    expect(
      await prettier.check(after, {
        filepath: join(root, QUEST),
        ...(await prettier.resolveConfig(join(root, QUEST))),
      }),
    ).toBe(true);
  });

  it('changes data texts: a table, a core ability, a core spell, a Core library item', async () => {
    const r = await applyUpdate(
      root,
      update({
        'data:trapKinds.pit.name': 'pit',
        'data:trapKinds.pit.lines.0': 'The hero falls in. The turn ends.',
        'data:monsters.goblin': 'Gobbo',
        'library:ability:stone.text': 'Rolls one more defend die.',
        'library:spell:rust.question': 'Does a hero in sight carry a metal sword?',
        'library:spell:fear.name': 'Terror',
        'library:ability:spiritBladeOnly.name': 'Spirit-bound',
      }),
    );
    expect(r.refused).toEqual([]);
    expect(r.byHand).toEqual([]);
    expect(r.changes).toHaveLength(7);
    expect(text('src/engine/data/trapKinds.ts')).toContain("name: 'pit'");
    expect(text('src/engine/data/trapKinds.ts')).toContain('The hero falls in. The turn ends.');
    expect(text('src/engine/data/monsters.ts')).toContain("goblin: 'Gobbo'");
    expect(text('src/engine/data/abilities.ts')).toContain('Rolls one more defend die.');
    expect(text('src/engine/data/spells.ts')).toContain("core('fear', 'Terror'");
    expect(text('src/engine/data/spells.ts')).toContain('metal sword?');
    expect(
      JSON.parse(text('src/content/library/core.json')).items.some(
        (i: { data: { name?: string } }) => i.data.name === 'Spirit-bound',
      ),
    ).toBe(true);
    for (const f of ['trapKinds', 'monsters', 'abilities', 'spells'])
      expect(tsErrors(`src/engine/data/${f}.ts`)).toEqual([]);
  });

  it('a dry run lists the changes and writes nothing', async () => {
    const files = [
      QUEST,
      'src/i18n/en.json',
      'src/engine/data/trapKinds.ts',
      'src/ui/select/StartPages.tsx',
    ];
    const before = files.map(text);
    const r = await applyUpdate(
      root,
      update({
        [NOTE]: 'Changed.',
        'data:trapKinds.pit.name': 'pit',
        'select.builtInLook': 'Pick',
      }),
      { dryRun: true },
    );
    expect(r.changes).toHaveLength(3);
    expect(r.written).toEqual([]);
    expect(files.map(text)).toEqual(before);
  });

  it('refuses keys that do not exist, and still applies the others', async () => {
    const r = await applyUpdate(
      root,
      update({
        'select.nope': 'x',
        'quest:q01-the-trial:notes.zz.effects.0.text': 'x',
        'quest:no-such-quest:title': 'x',
        'quest:user-mine:title': 'x',
        'data:trapKinds.nope.name': 'x',
        'data:nothing.here': 'x',
        'library:ability:nope.text': 'x',
        'select.builtInLook': 'Pick',
      }),
    );
    expect(r.refused.map((x) => x.key).sort()).toEqual([
      'data:nothing.here',
      'data:trapKinds.nope.name',
      'library:ability:nope.text',
      'quest:no-such-quest:title',
      'quest:q01-the-trial:notes.zz.effects.0.text',
      'quest:user-mine:title',
      'select.nope',
    ]);
    expect(r.changes.map((c) => c.key)).toEqual(['select.builtInLook']);
  });

  it('refuses a text that loses or adds a {name}', async () => {
    const en = JSON.parse(text('src/i18n/en.json')) as Record<string, string>;
    const key = Object.keys(en).find((k) => k.startsWith('select.') && /\{\w+\}/.test(en[k]!))!;
    const r = await applyUpdate(root, update({ [key]: 'No names here' }));
    expect(r.refused.map((x) => x.key)).toEqual([key]);
    expect(r.changes).toEqual([]);
  });

  it('a text that is the same as now changes nothing', async () => {
    const en = JSON.parse(text('src/i18n/en.json')) as Record<string, string>;
    const before = text('src/ui/select/StartPages.tsx');
    const r = await applyUpdate(root, update({ 'select.builtInLook': en['select.builtInLook']! }));
    expect(r.changes).toEqual([]);
    expect(r.unchanged).toEqual(['select.builtInLook']);
    expect(text('src/ui/select/StartPages.tsx')).toBe(before);
  });

  it('refuses a file that is not an update of the built-in English', async () => {
    const other = languageToText(copyOfEnglish({ a: 'b' }, 'Espanol', 'es'));
    await expect(applyUpdate(root, other)).rejects.toThrow(/not an update of the built-in English/);
    await expect(applyUpdate(root, '{nope')).rejects.toThrow(/not valid JSON/);
  });

  it('leaves en.json as sortedJson of the code after a change', async () => {
    await applyUpdate(root, update({ 'select.builtInLook': 'Pick' }));
    expect(text('src/i18n/en.json').replace(/\r\n/g, '\n')).toBe(
      sortedJson(readCatalogue(root).strings),
    );
  });
});

describe('rewriting a TypeScript table safely', () => {
  const src = [
    'export const T = {',
    "  a: 'one',",
    "  b: ['p', 'q'],",
    "  c: 'x' + 'y',",
    '  d: [{ id: "k", text: "kk" }],',
    '} as const;',
    '',
  ].join('\n');

  it('replaces a property, an array item and an item found by id', () => {
    const a = setTableText('t.ts', src, 'T', ['a'], "it's");
    expect(a.ok && a.source).toContain("a: 'it\\'s'");
    const b = setTableText('t.ts', src, 'T', ['b', '1'], 'Q');
    expect(b.ok && b.source).toContain("['p', 'Q']");
    const d = setTableText('t.ts', src, 'T', ['d', 'k', 'text'], 'new');
    expect(d.ok && d.from).toBe('kk');
  });
  it('leaves a text put together by code to be edited by hand, and refuses a missing path', () => {
    expect(setTableText('t.ts', src, 'T', ['c'], 'z')).toMatchObject({ ok: false, byHand: true });
    expect(setTableText('t.ts', src, 'T', ['zz'], 'z')).toMatchObject({ ok: false });
    expect(setTableText('t.ts', src, 'Nope', ['a'], 'z')).toMatchObject({ ok: false });
  });
  it('writes a literal that reads back the same', () => {
    const odd = "line one\nline 'two' \\ end";
    const sf = ts.createSourceFile(
      'x.ts',
      `const x = ${literal(odd)};`,
      ts.ScriptTarget.ES2022,
      true,
    );
    const lit = (sf.statements[0] as ts.VariableStatement).declarationList.declarations[0]!
      .initializer as ts.StringLiteral;
    expect(lit.text).toBe(odd);
  });
});

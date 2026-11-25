/**
 * Applies an update of the built-in English to the repository (decision 92). The update is a
 * translation file with the code `en-core` that holds only the changed texts. Each key is a path
 * into the file that holds the text:
 *
 * - `select.newGame` (interface): the English literal of every `t('select.newGame', '...')` call;
 *   `src/i18n/en.json` is then made again from the code;
 * - `quest:<id>:<path>`: the text in `src/content/quests/<file>.json` (the file whose `id` it is);
 * - `data:<table>.<path>` and `library:<kind>:<id>.<field>`: the literal in the engine data table
 *   (a TypeScript object or array literal, found by walking the syntax tree) or the item of a
 *   Core library file (`src/content/library/*.json`).
 *
 * A key that no longer exists is refused. A text that sits in a place the tool cannot rewrite
 * safely (a string put together by code) is listed as "edit by hand". Files are formatted with
 * Prettier. Nothing is written in a dry run.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import prettier from 'prettier';
import ts from 'typescript';
import { BUILTIN_UPDATE_CODE, parseLanguageFile } from '../../src/i18n/file';
import { questIdOf, questStrings, translateQuest } from '../../src/i18n/questText';
import { placeholdersOf } from '../../src/i18n/translate';
import { readCatalogue, sortedJson } from './catalogue';

export interface Change {
  readonly key: string;
  readonly file: string;
  readonly from: string;
  readonly to: string;
}
export interface Report {
  readonly changes: Change[];
  /** Same text as now: nothing to do. */
  readonly unchanged: string[];
  /** Keys that do not exist (any more), with why. */
  readonly refused: { key: string; reason: string }[];
  /** Texts the tool cannot rewrite safely. */
  readonly byHand: { key: string; reason: string }[];
  /** Files written (empty in a dry run). */
  readonly written: string[];
  readonly header: { base: string; date: string | undefined };
}

/** The data tables of `src/engine/data` and Zargon: TypeScript object literals of texts. */
export const DATA_TABLES: Readonly<Record<string, { file: string; variable: string }>> = {
  trapKinds: { file: 'src/engine/data/trapKinds.ts', variable: 'TRAP_KINDS_DATA' },
  spellTags: { file: 'src/engine/data/spells.ts', variable: 'SPELL_TAG_QUESTIONS' },
  spellTiming: { file: 'src/engine/data/spells.ts', variable: 'SPELL_TIMING_TEXT' },
  monsters: { file: 'src/engine/data/monsters.ts', variable: 'MONSTER_NAMES' },
  heroes: { file: 'src/engine/data/heroes.ts', variable: 'HERO_NAMES' },
  zargonRules: { file: 'src/engine/zargon/texts.ts', variable: 'RULE_TEXT' },
  zargonPlans: { file: 'src/engine/zargon/texts.ts', variable: 'PLAN_TEXT' },
  roomTiles: { file: 'src/engine/data/roomTiles.ts', variable: 'ROOM_TILES' },
  boardTiles: { file: 'src/engine/data/roomTiles.ts', variable: 'BOARD_TILES' },
};
const ABILITIES = { file: 'src/engine/data/abilities.ts', variable: 'CORE_ABILITIES' };
const SPELLS_FILE = 'src/engine/data/spells.ts';

// ---------------------------------------------------------------- TypeScript literals

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const BACKSLASH = String.fromCharCode(92);

/** A single quoted TypeScript string literal for a text (Prettier chooses the final quotes). */
export function literal(text: string): string {
  const escaped = text
    .split(BACKSLASH)
    .join(BACKSLASH + BACKSLASH)
    .split("'")
    .join(BACKSLASH + "'")
    .split(NL)
    .join(BACKSLASH + 'n')
    .split(String.fromCharCode(13))
    .join(BACKSLASH + 'r');
  return `'${escaped}'`;
}

const parse = (file: string, source: string) =>
  ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

const isText = (n: ts.Node): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

function unwrap(e: ts.Expression): ts.Expression {
  let x = e;
  while (
    ts.isParenthesizedExpression(x) ||
    ts.isAsExpression(x) ||
    ts.isSatisfiesExpression(x) ||
    ts.isTypeAssertionExpression(x)
  )
    x = x.expression;
  return x;
}

function variable(sf: ts.SourceFile, name: string): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  sf.forEachChild((st) => {
    if (!ts.isVariableStatement(st)) return;
    for (const d of st.declarationList.declarations)
      if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer)
        found = unwrap(d.initializer);
  });
  return found;
}

const propName = (p: ts.ObjectLiteralElementLike): string | undefined =>
  ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
    ? p.name.text
    : undefined;

/** One step into an object literal (by property) or an array literal (by position, or by `id`). */
function step(node: ts.Expression, seg: string): ts.Expression | undefined {
  const n = unwrap(node);
  if (ts.isObjectLiteralExpression(n)) {
    const p = n.properties.find((x) => propName(x) === seg);
    return p && ts.isPropertyAssignment(p) ? unwrap(p.initializer) : undefined;
  }
  if (ts.isArrayLiteralExpression(n)) {
    if (/^\d+$/.test(seg)) return n.elements[Number(seg)];
    return n.elements.find((el) => {
      const o = unwrap(el);
      if (!ts.isObjectLiteralExpression(o)) return false;
      const id = step(o, 'id');
      return id !== undefined && isText(id) && id.text === seg;
    });
  }
  return undefined;
}

export type Rewrite =
  { ok: true; source: string; from: string } | { ok: false; reason: string; byHand?: boolean };

/** Replaces the literal at `path` below the variable `variableName`. */
export function setTableText(
  file: string,
  source: string,
  variableName: string,
  path: readonly string[],
  text: string,
): Rewrite {
  const sf = parse(file, source);
  let node = variable(sf, variableName);
  if (!node) return { ok: false, reason: `${variableName} is not in ${file}` };
  for (const seg of path) {
    node = step(node, seg);
    if (!node) return { ok: false, reason: `no ${path.join('.')} in ${variableName}` };
  }
  return replaceLiteral(sf, source, node, text);
}

function replaceLiteral(sf: ts.SourceFile, source: string, node: ts.Node, text: string): Rewrite {
  if (!isText(node))
    return {
      ok: false,
      byHand: true,
      reason: 'the text is put together by code, not one literal',
    };
  return {
    ok: true,
    from: node.text,
    source: source.slice(0, node.getStart(sf)) + literal(text) + source.slice(node.end),
  };
}

/** A core spell written as `core('id', 'Name', [...tags], { question, warning })`. */
export function setCoreSpellText(
  file: string,
  source: string,
  id: string,
  field: string,
  text: string,
): Rewrite {
  const sf = parse(file, source);
  let target: ts.Node | undefined;
  const visit = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'core' &&
      n.arguments[0] &&
      isText(n.arguments[0]) &&
      n.arguments[0].text === id
    ) {
      if (field === 'name') target = n.arguments[1];
      else {
        const extra = n.arguments[3] ? unwrap(n.arguments[3]) : undefined;
        target = extra ? step(extra, field) : undefined;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!target) return { ok: false, reason: `no spell ${id} with ${field} in ${file}` };
  return replaceLiteral(sf, source, target, text);
}

/** Every `t('key', 'English')` literal of a key in one file. */
export function setInterfaceText(
  file: string,
  source: string,
  key: string,
  text: string,
): { source: string; from: string; count: number } {
  const sf = parse(file, source);
  const spots: ts.Node[] = [];
  const visit = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      (n.expression.text === 't' || n.expression.text === 'tr') &&
      n.arguments[0] &&
      isText(n.arguments[0]) &&
      n.arguments[0].text === key &&
      n.arguments[1] &&
      isText(n.arguments[1])
    )
      spots.push(n.arguments[1]);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  let out = source;
  for (const s of [...spots].sort((a, b) => b.getStart(sf) - a.getStart(sf)))
    out = out.slice(0, s.getStart(sf)) + literal(text) + out.slice(s.end);
  return {
    source: out,
    from: spots[0] && isText(spots[0]) ? spots[0].text : '',
    count: spots.length,
  };
}

// ---------------------------------------------------------------- JSON files

const files = (root: string, dir: string) =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => `${dir}/${f}`);

/** Set `path` (`field` or `field.N`) in the data of a Core library item. */
export function setLibraryItemText(
  raw: unknown,
  kind: string,
  id: string,
  path: readonly string[],
  text: string,
): { from: string } | undefined {
  const items = (raw as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return undefined;
  const item = items.find(
    (i) =>
      (i as { kind?: string; data?: { id?: string } }).kind === kind &&
      (i as { data?: { id?: string } }).data?.id === id,
  ) as { data: Record<string, unknown> } | undefined;
  if (!item) return undefined;
  let holder: unknown = item.data;
  for (const seg of path.slice(0, -1)) holder = (holder as Record<string, unknown>)?.[seg];
  const last = path[path.length - 1]!;
  const h = holder as Record<string, unknown> | undefined;
  if (!h || typeof h[last] !== 'string') return undefined;
  const from = h[last] as string;
  h[last] = text;
  return { from };
}

// ---------------------------------------------------------------- the update

async function format(root: string, file: string, text: string): Promise<string> {
  const abs = join(root, file);
  const config = (await prettier.resolveConfig(abs)) ?? {};
  return prettier.format(text, { ...config, filepath: abs });
}

const read = (root: string, file: string) => readFileSync(join(root, file), 'utf8');

function sourceFilesOf(root: string, dir = 'src'): string[] {
  const out: string[] = [];
  for (const d of readdirSync(join(root, dir), { withFileTypes: true })) {
    const p = `${dir}/${d.name}`;
    if (d.isDirectory()) out.push(...sourceFilesOf(root, p));
    else if (/\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name)) out.push(p);
  }
  return out;
}

/**
 * Plan the update (and write it unless `dryRun`). `text` is the content of the update file.
 * Throws an Error with a friendly message when the file is not an update of the built-in English.
 */
export async function applyUpdate(
  root: string,
  text: string,
  options: { dryRun?: boolean } = {},
): Promise<Report> {
  const parsed = parseLanguageFile(text);
  if (!parsed.ok) throw new Error(parsed.message);
  if (parsed.file.language.code !== BUILTIN_UPDATE_CODE)
    throw new Error(
      `This file is not an update of the built-in English (its code is "${parsed.file.language.code}", it should be "${BUILTIN_UPDATE_CODE}"). Export it with "Export as update" on the English row in owner mode.`,
    );
  const update = parsed.file.strings;

  const changes: Change[] = [];
  const unchanged: string[] = [];
  const refused: Report['refused'] = [];
  const byHand: Report['byHand'] = [];
  /** The new content of every file that changes, by path. */
  const next = new Map<string, string>();
  const get = (file: string) => next.get(file) ?? read(root, file);

  // the English of the interface, as the code has it now
  const catalogue = readCatalogue(root).strings;
  const sources = sourceFilesOf(root);
  // the quest files by quest id
  const questFiles = new Map<string, string>();
  for (const f of files(root, 'src/content/quests')) {
    try {
      const id = questIdOf(JSON.parse(read(root, f)));
      if (id) questFiles.set(id, f);
    } catch {
      /* a file that is not JSON is not a quest */
    }
  }
  const libraryFiles = files(root, 'src/content/library');

  for (const [key, to] of Object.entries(update).sort(([a], [b]) => a.localeCompare(b))) {
    const refuse = (reason: string) => refused.push({ key, reason });
    if (!to.trim()) {
      refuse('the text is empty');
      continue;
    }

    if (key.startsWith('quest:')) {
      const m = /^quest:([^:]+):(.+)$/.exec(key);
      const file = m ? questFiles.get(m[1]!) : undefined;
      if (!m || !file) {
        refuse(
          m?.[1]?.startsWith('user-')
            ? 'a quest made on a device is not part of the repository'
            : 'no bundled quest has this id',
        );
        continue;
      }
      const raw = JSON.parse(get(file)) as unknown;
      const old = questStrings(raw)[key];
      if (old === undefined) {
        refuse('the quest has no such text any more');
        continue;
      }
      if (old === to) {
        unchanged.push(key);
        continue;
      }
      next.set(file, JSON.stringify(translateQuest(raw, { [key]: to }), null, 2) + NL);
      changes.push({ key, file, from: old, to });
      continue;
    }

    if (key.startsWith('data:') || key.startsWith('library:')) {
      const rewrite = rewriteData(key, to, root, get, libraryFiles, next);
      if (rewrite.kind === 'change') changes.push({ key, ...rewrite.change, to });
      else if (rewrite.kind === 'same') unchanged.push(key);
      else if (rewrite.kind === 'hand') byHand.push({ key, reason: rewrite.reason });
      else refuse(rewrite.reason);
      continue;
    }

    // an interface text
    const old = catalogue[key];
    if (old === undefined) {
      refuse('no t() call in the code has this key');
      continue;
    }
    const lost = placeholdersOf(old).filter((p) => !placeholdersOf(to).includes(p));
    const added = placeholdersOf(to).filter((p) => !placeholdersOf(old).includes(p));
    if (lost.length || added.length) {
      refuse(`the {names} must stay the same as in "${old}"`);
      continue;
    }
    if (old === to) {
      unchanged.push(key);
      continue;
    }
    let done = false;
    for (const f of sources) {
      const src = get(f);
      if (!src.includes(key)) continue;
      const r = setInterfaceText(f, src, key, to);
      if (r.count > 0) {
        next.set(f, r.source);
        done = true;
        if (!changes.some((c) => c.key === key)) changes.push({ key, file: f, from: old, to });
      }
    }
    if (!done) byHand.push({ key, reason: 'the English literal could not be found in the code' });
  }

  const written: string[] = [];
  if (!options.dryRun && changes.length > 0) {
    for (const [file, content] of next) {
      // keep the line endings the file has
      const eol = read(root, file).includes(CR + NL) ? CR + NL : NL;
      const text = content
        .split(CR + NL)
        .join(NL)
        .split(NL)
        .join(eol);
      writeFileSync(join(root, file), await format(root, file, text));
      written.push(file);
    }
    // en.json is made again from the code
    writeFileSync(join(root, 'src/i18n/en.json'), sortedJson(readCatalogue(root).strings));
    written.push('src/i18n/en.json');
  }
  return {
    changes,
    unchanged,
    refused,
    byHand,
    written,
    header: { base: parsed.file.base, date: parsed.file.date },
  };
}

type DataResult =
  | { kind: 'change'; change: Omit<Change, 'key' | 'to'> }
  | { kind: 'same' }
  | { kind: 'hand'; reason: string }
  | { kind: 'refused'; reason: string };

function rewriteData(
  key: string,
  to: string,
  root: string,
  get: (file: string) => string,
  libraryFiles: string[],
  next: Map<string, string>,
): DataResult {
  const tableText = (file: string, variableName: string, path: string[]): DataResult => {
    const r = setTableText(file, get(file), variableName, path, to);
    return finish(file, r);
  };
  const finish = (file: string, r: Rewrite): DataResult => {
    if (!r.ok)
      return r.byHand ? { kind: 'hand', reason: r.reason } : { kind: 'refused', reason: r.reason };
    if (r.from === to) return { kind: 'same' };
    next.set(file, r.source);
    return { kind: 'change', change: { file, from: r.from } };
  };

  if (key.startsWith('data:')) {
    const [table, ...path] = key.slice(5).split('.');
    const def = table ? DATA_TABLES[table] : undefined;
    if (!def) return { kind: 'refused', reason: `unknown table "${table}"` };
    return tableText(def.file, def.variable, path);
  }
  const m = /^library:(\w+):([^.]+)\.(.+)$/.exec(key);
  if (!m) return { kind: 'refused', reason: 'not a library key' };
  const [, kind, id, rest] = m as unknown as [string, string, string, string];
  const path = rest.split('.');
  // an item that a Core library file holds
  for (const f of libraryFiles) {
    const raw = JSON.parse(get(f)) as unknown;
    const r = setLibraryItemText(raw, kind, id, path, to);
    if (r) {
      if (r.from === to) return { kind: 'same' };
      next.set(f, JSON.stringify(raw, null, 2) + NL);
      return { kind: 'change', change: { file: f, from: r.from } };
    }
  }
  // an item that is built into the code
  if (kind === 'ability') return tableText(ABILITIES.file, ABILITIES.variable, [id, ...path]);
  if (kind === 'spell' && path.length === 1)
    return finish(SPELLS_FILE, setCoreSpellText(SPELLS_FILE, get(SPELLS_FILE), id, path[0]!, to));
  void root;
  return { kind: 'refused', reason: `no ${kind} "${id}" with ${rest}` };
}

/** What the report says, for the command line. */
export function reportText(r: Report, dryRun: boolean): string {
  const lines: string[] = [];
  lines.push(
    `Update for English base ${r.header.base}${r.header.date ? `, made ${r.header.date}` : ''}.`,
  );
  lines.push(`${dryRun ? 'Would change' : 'Changed'} ${r.changes.length} texts.`);
  for (const c of r.changes)
    lines.push(`  ${c.key}  (${c.file})${NL}    - ${c.from}${NL}    + ${c.to}`);
  if (r.unchanged.length) lines.push(`${r.unchanged.length} texts are the same as now.`);
  for (const x of r.refused) lines.push(`REFUSED ${x.key}: ${x.reason}`);
  for (const x of r.byHand) lines.push(`EDIT BY HAND ${x.key}: ${x.reason}`);
  if (!dryRun && r.written.length) lines.push(`Wrote ${r.written.join(', ')}`);
  return lines.join(NL);
}

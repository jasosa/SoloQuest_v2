/**
 * The codemod of `npm run i18n -- codemod` (decision 92): routes the plain literals of a file
 * through `t`. It handles
 * - an element whose children are only text and `{expressions}` (the text becomes one sentence with
 *   `{name}` placeholders: `Turn {turn}`),
 * - text attributes with a string, a template, or strings in a conditional,
 * - `{'string'}` and strings in `a ? 'x' : 'y'` and `a && 'x'` shown as text.
 * An element that mixes text with other elements (`<b>`) is left and listed: it needs a hand-made text.
 */
import ts from 'typescript';
import { isTCall, TEXT_ATTRS, type Literal } from './scan';

const NL = String.fromCharCode(10);

export interface CodemodResult {
  source: string;
  entries: Record<string, string>;
  skipped: Literal[];
}

const hasLetters = (s: string) => /\p{L}{2,}/u.test(s);
const isStr = (n: ts.Node): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

const camel = (text: string): string => {
  const words = text
    .toLowerCase()
    .replace(/\{\w+\}/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  return words.map((w, i) => (i ? w[0]!.toUpperCase() + w.slice(1) : w)).join('') || 'text';
};

/** The text React shows for the text of a JSX element (the whitespace rules of JSX). */
export function jsxText(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/);
  if (lines.length === 1) return raw;
  const parts: string[] = [];
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, ' ');
    if (i !== 0) l = l.trimStart();
    if (i !== lines.length - 1) l = l.trimEnd();
    if (l) parts.push(l);
  });
  return parts.join(' ');
}

function containsJsx(n: ts.Node): boolean {
  if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return true;
  return ts.forEachChild(n, (c) => (containsJsx(c) ? true : undefined)) === true;
}

export function codemod(
  file: string,
  source: string,
  area: string,
  existing: Readonly<Record<string, string>>,
  importPath: string,
): CodemodResult {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const entries: Record<string, string> = {};
  const byEnglish = new Map<string, string>();
  for (const [k, v] of Object.entries(existing)) if (k.startsWith(`${area}.`)) byEnglish.set(v, k);
  const keyFor = (english: string): string => {
    const known = byEnglish.get(english);
    if (known) return known;
    let key = `${area}.${camel(english)}`;
    for (let i = 2; key in existing || key in entries; i++) key = `${area}.${camel(english)}${i}`;
    entries[key] = english;
    byEnglish.set(english, key);
    return key;
  };
  const q = (s: string) =>
    `'${s.split(String.fromCharCode(92)).join('\\\\').split("'").join("\\'")}'`;
  const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const edits: { start: number; end: number; text: string }[] = [];
  const skipped: Literal[] = [];

  /** A parameter name for an expression, unique inside one sentence. */
  const paramsFor = () => {
    const bySource = new Map<string, string>();
    const used = new Set<string>();
    let n = 0;
    return {
      name(e: ts.Expression): string {
        const src = e.getText(sf);
        const known = bySource.get(src);
        if (known) return known;
        let base = ts.isIdentifier(e)
          ? e.text
          : ts.isPropertyAccessExpression(e)
            ? e.name.text
            : `v${++n}`;
        if (base === 'length' || base === 'size') base = 'count';
        if (!/^\w+$/.test(base)) base = `v${++n}`;
        let name = base;
        for (let i = 2; used.has(name); i++) name = `${base}${i}`;
        used.add(name);
        bySource.set(src, name);
        return name;
      },
      list: () =>
        [...bySource.entries()].map(([src, name]) => (src === name ? name : `${name}: ${src}`)),
    };
  };

  const call = (english: string, params: string[]) =>
    `t(${q(keyFor(english))}, ${q(english)}${params.length ? `, { ${params.join(', ')} }` : ''})`;

  /** A template string as one sentence. */
  const fromTemplate = (n: ts.TemplateExpression): string | undefined => {
    if (n.templateSpans.some((s) => containsJsx(s.expression))) return undefined;
    const p = paramsFor();
    let text = n.head.text;
    for (const s of n.templateSpans) text += `{${p.name(s.expression)}}${s.literal.text}`;
    return call(text, p.list());
  };

  /** Strings inside a conditional or a `&&` that is shown as text: each branch becomes a `t` call. */
  const branches = (e: ts.Expression): void => {
    if (ts.isParenthesizedExpression(e)) return branches(e.expression);
    if (ts.isConditionalExpression(e)) {
      branches(e.whenTrue);
      branches(e.whenFalse);
    } else if (
      ts.isBinaryExpression(e) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(e.operatorToken.kind)
    )
      branches(e.right);
    else if (isStr(e) && hasLetters(e.text) && !/[&{}]/.test(e.text))
      edits.push({ start: e.getStart(sf), end: e.end, text: call(e.text, []) });
    else if (ts.isTemplateExpression(e) && hasLetters(e.head.text)) {
      const t = fromTemplate(e);
      if (t) edits.push({ start: e.getStart(sf), end: e.end, text: t });
    }
  };

  const visit = (n: ts.Node) => {
    if (isTCall(n) || ts.isImportDeclaration(n) || ts.isTypeNode(n)) return;
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const kids = n.children;
      const hasText = kids.some((c) => ts.isJsxText(c) && hasLetters(c.text));
      const onlyInline = kids.every((c) => ts.isJsxText(c) || ts.isJsxExpression(c));
      if (
        hasText &&
        onlyInline &&
        !kids.some((c) => ts.isJsxExpression(c) && (!c.expression || containsJsx(c)))
      ) {
        const p = paramsFor();
        let text = '';
        for (const c of kids) {
          if (ts.isJsxText(c)) text += jsxText(c.text);
          else if (ts.isJsxExpression(c) && c.expression) {
            const e = c.expression;
            if (isStr(e)) text += e.text;
            else text += `{${p.name(e)}}`;
          }
        }
        const core = text.trim();
        if (/[&<>]/.test(text) || !hasLetters(core) || /^\{\w+\}$/.test(core))
          skipped.push({ text: core, line: line(kids[0]!), kind: 'mixed' });
        else {
          const first = kids[0]!;
          const last = kids[kids.length - 1]!;
          const keep = (has: boolean) => (has ? "{' '}" : '');
          edits.push({
            start: first.pos,
            end: last.end,
            text: `${keep(/^ /.test(text))}{${call(core, p.list())}}${keep(/ $/.test(text))}`,
          });
        }
        return; // children done: do not visit their expressions
      }
      if (hasText && !onlyInline)
        for (const c of kids)
          if (ts.isJsxText(c) && hasLetters(c.text))
            skipped.push({ text: jsxText(c.text).trim(), line: line(c), kind: 'mixed' });
    } else if (ts.isJsxAttribute(n)) {
      const v = n.initializer;
      if (TEXT_ATTRS.has(n.name.getText(sf)) && v) {
        if (ts.isStringLiteral(v) && hasLetters(v.text)) {
          if (/[&{}]/.test(v.text))
            skipped.push({ text: v.text, line: line(v), kind: 'attribute' });
          else edits.push({ start: v.getStart(sf), end: v.end, text: `{${call(v.text, [])}}` });
        } else if (ts.isJsxExpression(v) && v.expression) branches(v.expression);
      }
      if (v && ts.isJsxExpression(v) && v.expression) ts.forEachChild(v, visit);
      return;
    } else if (ts.isJsxExpression(n) && n.expression && n.parent && !ts.isJsxAttribute(n.parent)) {
      branches(n.expression);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);

  // an edit inside another edit (a branch in a sentence) is dropped: the outer one wins
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const flat: typeof edits = [];
  for (const e of edits) if (!flat.length || e.start >= flat[flat.length - 1]!.end) flat.push(e);
  let out = source;
  for (const e of flat.sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  if (flat.length && !/from '[^']*i18n\/t'/.test(out)) {
    const sf2 = ts.createSourceFile(file, out, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    const last = sf2.statements.filter(ts.isImportDeclaration).pop();
    const imp = `import { t } from '${importPath}';`;
    out = last ? out.slice(0, last.end) + NL + imp + out.slice(last.end) : imp + NL + out;
  }
  return { source: out, entries, skipped };
}

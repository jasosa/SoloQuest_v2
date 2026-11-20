/**
 * Finds the texts of the interface in the source (decision 92). Three jobs:
 * - `tCalls`: every `t('key', 'English')` call, so `src/i18n/en.json` is made from the code;
 * - `literals`: the text that is NOT routed through `t` in a file (JSX text, text attributes,
 *   sentences in strings), for the coverage test and the report;
 * - `codemod`: rewrites the simple literals of a file into `t` calls.
 * Pure: reads source text only.
 */
import ts from 'typescript';

export interface TCall {
  key: string;
  english: string;
  line: number;
}
export interface Literal {
  text: string;
  line: number;
  kind: 'jsx-text' | 'attribute' | 'sentence' | 'mixed';
}

const CALLEES = new Set(['t', 'tr']);
/** Attributes whose value is read by people. */
export const TEXT_ATTRS = new Set([
  'title',
  'aria-label',
  'placeholder',
  'alt',
  'label',
  'hint',
  'heading',
  'description',
  'caption',
  'help',
]);

const parse = (file: string, source: string) =>
  ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ES2022,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

const lineOf = (sf: ts.SourceFile, node: ts.Node) =>
  sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

const isStr = (n: ts.Node): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

export function isTCall(n: ts.Node): n is ts.CallExpression {
  return ts.isCallExpression(n) && ts.isIdentifier(n.expression) && CALLEES.has(n.expression.text);
}

export function tCalls(file: string, source: string): { calls: TCall[]; problems: string[] } {
  const sf = parse(file, source);
  const calls: TCall[] = [];
  const problems: string[] = [];
  const visit = (n: ts.Node) => {
    if (isTCall(n)) {
      const [k, e] = n.arguments;
      if (k && e && isStr(k) && isStr(e))
        calls.push({ key: k.text, english: e.text, line: lineOf(sf, n) });
      else
        problems.push(
          `${file}:${lineOf(sf, n)} t() needs a text key and the English text as literals`,
        );
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { calls, problems };
}

const hasLetters = (s: string) => /\p{L}{2,}/u.test(s);
/** A sentence: starts with a capital, has a space and lower case letters. */
const isSentence = (s: string) => /^[A-Z][a-z]+(?:[ ,'.!?-]+[A-Za-z0-9]+)+/.test(s.trim());

function okComment(sf: ts.SourceFile, node: ts.Node): boolean {
  const lines = sf.text.split('\n');
  const l = lineOf(sf, node) - 1;
  return /i18n-ok/.test(lines[l] ?? '') || /i18n-ok/.test(lines[l - 1] ?? '');
}

/** The text that people read and that is not routed through `t`. */
export function literals(file: string, source: string): Literal[] {
  const sf = parse(file, source);
  const out: Literal[] = [];
  const add = (node: ts.Node, text: string, kind: Literal['kind']) => {
    if (!okComment(sf, node)) out.push({ text: text.trim(), line: lineOf(sf, node), kind });
  };
  const visit = (n: ts.Node) => {
    if (isTCall(n)) return; // its arguments are the routed text
    if (ts.isImportDeclaration(n) || ts.isTypeNode(n)) return;
    if (ts.isJsxText(n)) {
      if (hasLetters(n.text)) add(n, n.text.replace(/\s+/g, ' '), 'jsx-text');
    } else if (ts.isJsxAttribute(n)) {
      const name = n.name.getText(sf);
      const v = n.initializer;
      if (TEXT_ATTRS.has(name) && v) {
        if (ts.isStringLiteral(v) && hasLetters(v.text)) add(v, v.text, 'attribute');
        else if (ts.isJsxExpression(v) && v.expression) scanExpr(v.expression, 'attribute');
      } else if (v) visit(v);
      return;
    } else if (ts.isJsxExpression(n) && n.parent && !ts.isJsxAttribute(n.parent) && n.expression) {
      scanExpr(n.expression, 'jsx-text');
      return;
    } else if (isStr(n) && isSentence(n.text) && !ts.isPropertyAssignment(n.parent as ts.Node)) {
      // a sentence in code (a message, a label list)
      if (!ts.isLiteralTypeNode(n.parent)) add(n, n.text, 'sentence');
    } else if (ts.isTemplateExpression(n) && isSentence(n.head.text))
      add(n, n.head.text, 'sentence');
    ts.forEachChild(n, visit);
  };
  /** Strings that are shown as text: `{ok ? 'Yes' : 'No'}`, `{a && 'x'}`, `{'text'}`. Other code is scanned as usual. */
  const scanExpr = (e: ts.Node, kind: Literal['kind']): void => {
    if (ts.isParenthesizedExpression(e)) return scanExpr(e.expression, kind);
    if (ts.isConditionalExpression(e)) {
      visit(e.condition);
      scanExpr(e.whenTrue, kind);
      scanExpr(e.whenFalse, kind);
    } else if (
      ts.isBinaryExpression(e) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(e.operatorToken.kind)
    ) {
      visit(e.left);
      scanExpr(e.right, kind);
    } else if (isStr(e) && hasLetters(e.text)) add(e, e.text, kind);
    else if (ts.isTemplateExpression(e) && hasLetters(e.head.text)) add(e, e.head.text, kind);
    else visit(e);
  };
  visit(sf);
  // a sentence found twice (as a node and inside an expression) is listed once
  const seen = new Set<string>();
  return out.filter((l) => {
    const k = `${l.line}:${l.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

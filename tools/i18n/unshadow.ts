/** Renames local variables called `t` that shadow the `t` text function (run after a codemod). */
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { isTCall } from './scan';

const cfgPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json')!;
const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(cfgPath, ts.sys.readFile).config,
  ts.sys,
  process.cwd(),
);
const program = ts.createProgram(cfg.fileNames, cfg.options);
const checker = program.getTypeChecker();

const isIntendedCall = (id: ts.Identifier) =>
  ts.isCallExpression(id.parent) &&
  id.parent.expression === id &&
  isTCall(id.parent) &&
  id.parent.arguments.length >= 2 &&
  ts.isStringLiteralLike(id.parent.arguments[0]!);

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.replaceAll('\\', '/').includes('/src/ui/')) continue;
  let importSym: ts.Symbol | undefined;
  sf.forEachChild((n) => {
    if (
      ts.isImportDeclaration(n) &&
      n.importClause?.namedBindings &&
      ts.isNamedImports(n.importClause.namedBindings)
    )
      for (const e of n.importClause.namedBindings.elements)
        if (e.name.text === 't') importSym = checker.getSymbolAtLocation(e.name);
  });
  if (!importSym) continue;
  const bad = new Set<ts.Symbol>();
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n) && n.text === 't' && isIntendedCall(n)) {
      const sym = checker.getSymbolAtLocation(n);
      if (sym && sym !== importSym && !(sym.flags & ts.SymbolFlags.Alias)) bad.add(sym);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!bad.size) continue;
  const edits: { pos: number; text: string }[] = [];
  const visit2 = (n: ts.Node) => {
    if (ts.isIdentifier(n) && n.text === 't' && !isIntendedCall(n)) {
      if (ts.isShorthandPropertyAssignment(n.parent)) {
        const v = checker.getShorthandAssignmentValueSymbol(n.parent);
        if (v && bad.has(v)) edits.push({ pos: n.getStart(sf), text: 'item: tv' });
      } else {
        const sym = checker.getSymbolAtLocation(n);
        if (sym && bad.has(sym)) edits.push({ pos: n.getStart(sf), text: 'tv' });
      }
    }
    ts.forEachChild(n, visit2);
  };
  visit2(sf);
  let text = readFileSync(sf.fileName, 'utf8');
  for (const e of edits.sort((a, b) => b.pos - a.pos))
    text = text.slice(0, e.pos) + e.text + text.slice(e.pos + 1);
  writeFileSync(sf.fileName, text);
  console.log(`${sf.fileName}: renamed ${edits.length}`);
}

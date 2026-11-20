/**
 * `npm run i18n -- <command>` (decision 92):
 *   write                      write src/i18n/en.json from the t() calls of the source
 *   check                      fail when en.json is not what write would make
 *   report                     list the literals still in each file (all files, or the covered ones)
 *   codemod <area> <file>...   route the plain literals of the files through t, under the key area
 *                              (then run write, review the listed mixed texts by hand, add the files to covered.ts)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { COVERED, ROOT, readCatalogue, rel, sortedJson, sourceFiles } from './i18n/catalogue';
import { codemod } from './i18n/codemod';
import { literals } from './i18n/scan';

const EN = join(ROOT, 'src', 'i18n', 'en.json');
const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'write' || cmd === 'check') {
  const { strings, problems } = readCatalogue();
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const text = sortedJson(strings);
  if (cmd === 'write') {
    writeFileSync(EN, text);
    console.log(`en.json: ${Object.keys(strings).length} texts`);
  } else if (readFileSync(EN, 'utf8').replace(/\r\n/g, '\n') !== text) {
    console.error('src/i18n/en.json is out of date: run npm run i18n -- write');
    process.exit(1);
  }
} else if (cmd === 'report') {
  const all = args.includes('--all');
  let total = 0;
  const files = all
    ? sourceFiles()
        .map(rel)
        .filter((f) => f.endsWith('.tsx'))
    : COVERED;
  for (const f of files) {
    const found = literals(f, readFileSync(join(ROOT, f), 'utf8'));
    total += found.length;
    if (found.length) {
      console.log(`${f}: ${found.length}`);
      if (args.includes('-v'))
        for (const l of found) console.log(`    ${l.line} [${l.kind}] ${l.text.slice(0, 70)}`);
    }
  }
  console.log(`${total} literals left`);
} else if (cmd === 'codemod') {
  const [area, ...files] = args;
  if (!area || !files.length) {
    console.error('usage: codemod <area> <file>...');
    process.exit(1);
  }
  const existing = JSON.parse(readFileSync(EN, 'utf8')) as Record<string, string>;
  for (const f of files) {
    const abs = join(ROOT, f);
    const imp = relative(dirname(abs), join(ROOT, 'src', 'i18n', 't'))
      .split(String.fromCharCode(92))
      .join('/');
    const r = codemod(
      f,
      readFileSync(abs, 'utf8'),
      area,
      existing,
      imp.startsWith('.') ? imp : `./${imp}`,
    );
    writeFileSync(abs, r.source);
    Object.assign(existing, r.entries);
    console.log(
      `${f}: ${Object.keys(r.entries).length} new texts, ${r.skipped.length} left by hand`,
    );
    for (const s of r.skipped) console.log(`    ${s.line} [${s.kind}] ${s.text.slice(0, 70)}`);
  }
} else {
  console.error('commands: write, check, report [--all] [-v], codemod <area> <file>...');
  process.exit(1);
}

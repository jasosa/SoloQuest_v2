/** Reads the source tree for the interface catalogue (decision 92). Node only (tools and tests). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tCalls } from './scan';

export const ROOT = join(import.meta.dirname, '..', '..');

/** The files whose text is all routed through `t` (the coverage test fails on a literal in them). */
export { COVERED } from './covered';

export function sourceFiles(dir = join(ROOT, 'src')): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

export const rel = (p: string, root = ROOT) => relative(root, p).split(sep).join('/');

/** Every `t('key', 'English')` of the source: the catalogue, and what is wrong with it. */
export function readCatalogue(root = ROOT): {
  strings: Record<string, string>;
  problems: string[];
} {
  const strings: Record<string, string> = {};
  const problems: string[] = [];
  for (const file of sourceFiles(join(root, 'src'))) {
    const { calls, problems: p } = tCalls(rel(file, root), readFileSync(file, 'utf8'));
    problems.push(...p);
    for (const c of calls) {
      const known = strings[c.key];
      if (known !== undefined && known !== c.english)
        problems.push(`${rel(file, root)}:${c.line} key ${c.key} has two different English texts`);
      strings[c.key] = c.english;
    }
  }
  return { strings, problems };
}

export const sortedJson = (o: Record<string, string>) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))),
    null,
    2,
  ) + '\n';

// One gate for "is the project OK". Used by hand, by the git pre-commit hook and by the Stop hook.
//   node scripts/verify.mjs            full: rules, typecheck, lint, format, unit tests, quest validation
//   node scripts/verify.mjs --quick    rules only (no tools, a second or two)
//   node scripts/verify.mjs --hook     Stop hook: rules + typecheck, only when code changed, silent when green
//   node scripts/verify.mjs --staged   pre-commit: full when code is staged, rules only for docs
// Exit 0 = ok. Exit 2 = failed (the Stop hook sends the message back to Claude).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const args = new Set(process.argv.slice(2));
const mode = args.has('--hook')
  ? 'hook'
  : args.has('--staged')
    ? 'staged'
    : args.has('--quick')
      ? 'quick'
      : 'full';
const win = process.platform === 'win32';

const run = (cmd, a) =>
  spawnSync(cmd, a, { cwd: root, encoding: 'utf8', shell: win, maxBuffer: 64 * 1024 * 1024 });
const git = (...a) => run('git', a).stdout.split('\n').filter(Boolean);

// The Stop hook gets a JSON payload on stdin. If it is already continuing after a stop, do not loop.
if (mode === 'hook') {
  try {
    const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
    if (payload.stop_hook_active) process.exit(0);
  } catch {
    /* no payload */
  }
}

const CODE = /^(src|tests|tools|scripts)\//;
const changed =
  mode === 'staged'
    ? git('diff', '--cached', '--name-only')
    : git('status', '--porcelain').map((l) => l.slice(3).replace(/^"|"$/g, ''));
const codeChanged = changed.some(
  (f) => CODE.test(f) || /^(package(-lock)?\.json|tsconfig.*|eslint\.config\..*)$/.test(f),
);
if ((mode === 'hook' || mode === 'staged') && !codeChanged && changed.length === 0) process.exit(0);

// ---------- rules that CLAUDE.md states in words ----------
const tracked = git('ls-files').filter((f) => !f.startsWith('reference/'));
const read = (f) => {
  try {
    return readFileSync(join(root, f), 'utf8');
  } catch {
    return '';
  }
};
// Drop comments so a comment that says "no Math.random" does not trip the check.
const noComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const problems = [];
const add = (rule, file, line, text) =>
  problems.push(`${rule}: ${file}:${line} ${text.trim().slice(0, 80)}`);
const scan = (files, rule, re, strip = false) => {
  for (const f of files) {
    const body = strip ? noComments(read(f)) : read(f);
    body.split('\n').forEach((l, i) => re.test(l) && add(rule, f, i + 1, l));
  }
};

const isText = (f) => /\.(ts|tsx|js|mjs|css|json|md|html)$/.test(f);
const textFiles = tracked.filter(
  (f) =>
    (isText(f) && /^(src|docs|tests|tools|scripts|design\/play-a)\//.test(f)) ||
    /^(CLAUDE|README)\.md$/.test(f),
);
// 1. No em-dashes anywhere in docs, code or UI text.
scan(
  textFiles,
  'no em-dash (use a colon, comma or period)',
  new RegExp(String.fromCharCode(0x2014)),
);

// 2. The engine is pure: no clock, no Math.random, no React or DOM.
const engine = tracked.filter((f) => /^src\/engine\/.+\.ts$/.test(f) && !/\.test\.ts$/.test(f));
scan(
  engine,
  'engine must stay pure',
  /Math\.random|Date\.now|new Date\(|performance\.now|from ['"]react|\bdocument\.|\bwindow\.|localStorage/,
  true,
);

// 3. Colors come from tokens (src/ui/shared/tokens.css). Update design/play-a/DESIGN.md first for new ones.
const ui = tracked.filter((f) => /^src\/ui\/.+\.(tsx|css)$/.test(f) && !/tokens\.css$/.test(f));
scan(ui, 'use a color token, not a raw color', /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, true);

// 4. Quests are data: no quest numbers in engine code.
scan(engine, 'quest logic belongs in quest data', /quest(Id|Number)?\s*===?\s*['"\d]/i, true);

const step = (name, cmd, a) => {
  const r = run(cmd, a);
  if (r.status !== 0) {
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n');
    problems.push(`${name} failed:\n${out.slice(-40).join('\n')}`);
    return false;
  }
  return true;
};

const full = mode === 'full' || (mode === 'staged' && codeChanged);
if (mode === 'hook' ? codeChanged : mode !== 'quick') {
  // typecheck first: it is the fast, cheap gate.
  const typeOk = step('typecheck', 'npx', ['tsc', '--noEmit']);
  if (full && typeOk) {
    step('lint', 'npx', ['eslint', '.']);
    step('format (run prettier --write on the files it lists)', 'npx', [
      'prettier',
      '--check',
      '.',
    ]);
    step('unit tests', 'npx', ['vitest', 'run', '--reporter=dot']);
    step('quest validation', 'npx', ['tsx', 'tools/validate.ts']);
  }
}

if (problems.length === 0) {
  if (mode !== 'hook') console.log(`verify (${mode}): ok`);
  process.exit(0);
}
const shown =
  problems.length > 30
    ? [...problems.slice(0, 30), `... and ${problems.length - 30} more`]
    : problems;
process.stderr.write(`verify (${mode}) found problems:\n${shown.join('\n')}\n`);
process.exit(2);

// Checks that the Claude hooks block what they should and let normal work through.
//   node scripts/test-hooks.mjs
import { spawnSync } from 'node:child_process';

const ROOT = 'C:/Users/Juanan/code/SoloQuest_v2';
const run = (hook, payload) =>
  spawnSync('node', [`.claude/hooks/${hook}`], { input: JSON.stringify(payload), encoding: 'utf8' })
    .status;
const bash = (command) => run('guard-bash.mjs', { tool_input: { command } });
const file = (path, content) =>
  run('guard-files.mjs', { tool_input: { file_path: `${ROOT}/${path}`, content } });

const dash = String.fromCharCode(0x2014);
const cases = [
  ['chained commit and push', bash('git commit -m x && git push'), 2],
  ['force push', bash('git push --force origin x'), 2],
  ['no-verify', bash('git commit --no-verify -m x'), 2],
  ['plain commit', bash('git commit -m ok'), 0],
  ['status', bash('git status'), 0],
  ['stage a pdf', bash('git add reference/a.pdf'), 2],
  ['raw color in ui', file('src/ui/x.tsx', 'const a = "#ff0000"'), 2],
  ['token color in ui', file('src/ui/x.tsx', 'const a = "var(--ink)"'), 0],
  ['em-dash in docs', file('docs/x.md', `a ${dash} b`), 2],
  ['Math.random in engine', file('src/engine/a.ts', 'const a = Math.random()'), 2],
  ['Math.random only in a comment', file('src/engine/a.ts', '// no Math.random\nconst a = 1'), 0],
  ['write into reference', file('reference/x.md', 'a'), 2],
];
let bad = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (exit ${got}, wanted ${want})`);
}
process.exit(bad ? 1 : 0);

// SessionStart: short orientation (branch, uncommitted files, last commits, open backlog headings).
import { spawnSync } from 'node:child_process';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' }).stdout?.trim() ?? '';
const out = [];
out.push('Git: ' + git('status', '--short', '--branch').split('\n').slice(0, 12).join('\n'));
out.push('Last commits:\n' + git('log', '--oneline', '-5'));
const wt = git('worktree', 'list')
  .split('\n')
  .filter((l) => l.includes('.claude/worktrees'));
if (wt.length) out.push('Open worktrees (clean up when merged):\n' + wt.join('\n'));
out.push(
  'Gate: `node scripts/verify.mjs` (full) or `--quick` (rules only). Pre-commit runs it for you.',
);
process.stdout.write(out.join('\n') + '\n');

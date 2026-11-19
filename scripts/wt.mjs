// Worktrees for parallel work, without the manual cleanup.
//   node scripts/wt.mjs new <name>     worktree .claude/worktrees/<name> on branch wt-<name>, from master
//   node scripts/wt.mjs list           worktrees and whether their branch is merged
//   node scripts/wt.mjs merge <name>   merge wt-<name> into master, run the full verify, roll back if it fails
//   node scripts/wt.mjs clean          remove the worktrees and branches that are merged (locked ones too)
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const dirOf = (name) => join(root, '.claude', 'worktrees', name);
const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
const out = (r) => `${r.stdout || ''}${r.stderr || ''}`.trim();
const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

const [cmd, name] = process.argv.slice(2);
const branchOf = (n) => `wt-${n}`;

// The worktree borrows node_modules from the main folder with a junction (no second install).
// Remove the junction before git removes the worktree, or git would walk into the real folder.
function dropLink(dir) {
  const link = join(dir, 'node_modules');
  if (!existsSync(link) || !lstatSync(link).isSymbolicLink()) return;
  try {
    unlinkSync(link);
  } catch {
    rmdirSync(link);
  }
}

function worktrees() {
  const text = out(git('worktree', 'list', '--porcelain'));
  return text
    .split('\n\n')
    .map((block) => Object.fromEntries(block.split('\n').map((l) => l.split(/ (.*)/s).slice(0, 2))))
    .filter((w) => (w.worktree || '').replace(/\\/g, '/').includes('/.claude/worktrees/'));
}

if (cmd === 'new') {
  if (!name || !/^[\w.-]+$/.test(name)) die('Usage: node scripts/wt.mjs new <name>');
  const r = git('worktree', 'add', dirOf(name), '-b', branchOf(name), 'master');
  if (r.status !== 0) die(out(r));
  symlinkSync(join(root, 'node_modules'), join(dirOf(name), 'node_modules'), 'junction');
  console.log(`Worktree ready: ${dirOf(name)} (branch ${branchOf(name)})`);
} else if (cmd === 'list') {
  const merged = out(git('branch', '--merged', 'master'))
    .split('\n')
    .map((l) => l.replace(/^[*+ ]+/, ''));
  for (const w of worktrees()) {
    const b = (w.branch || '').replace('refs/heads/', '');
    console.log(
      `${w.worktree}  ${b}  ${merged.includes(b) ? 'merged' : 'NOT merged'}${'locked' in w ? '  locked' : ''}`,
    );
  }
} else if (cmd === 'merge') {
  if (!name) die('Usage: node scripts/wt.mjs merge <name>');
  if (out(git('branch', '--show-current')) !== 'master') die('Switch to master first.');
  if (out(git('status', '--porcelain')))
    die('master has uncommitted changes. Commit or stash them first.');
  const before = out(git('rev-parse', 'HEAD'));
  const m = git('merge', '--no-ff', branchOf(name), '-m', `Merge branch '${branchOf(name)}'`);
  if (m.status !== 0) {
    git('merge', '--abort');
    die(`Merge conflict, merge aborted. Fix in the worktree and try again.\n${out(m)}`);
  }
  const v = spawnSync('node', ['scripts/verify.mjs'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (v.status !== 0) {
    git('reset', '--hard', before);
    die(
      `verify failed after the merge. Rolled master back to ${before.slice(0, 7)}. The branch ${branchOf(name)} is untouched.`,
    );
  }
  console.log(`Merged ${branchOf(name)} into master, verify ok.`);
} else if (cmd === 'clean') {
  const merged = out(git('branch', '--merged', 'master'))
    .split('\n')
    .map((l) => l.replace(/^[*+ ]+/, ''));
  let kept = 0;
  for (const w of worktrees()) {
    const b = (w.branch || '').replace('refs/heads/', '');
    if (!merged.includes(b)) {
      console.log(`kept (not merged): ${w.worktree} ${b}`);
      kept++;
      continue;
    }
    dropLink(w.worktree);
    git('worktree', 'unlock', w.worktree);
    const r = git('worktree', 'remove', '--force', w.worktree);
    if (r.status !== 0) {
      console.log(`could not remove ${w.worktree}: ${out(r)}`);
      kept++;
      continue;
    }
    git('branch', '-d', b);
    console.log(`removed: ${w.worktree} ${b}`);
  }
  git('worktree', 'prune');
  console.log(kept ? `${kept} worktree(s) left.` : 'No worktrees left.');
} else {
  die('Usage: node scripts/wt.mjs new|list|merge|clean [name]');
}

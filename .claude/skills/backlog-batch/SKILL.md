---
name: backlog-batch
description: Work several independent backlog tasks in parallel, one worktree agent each, merged one at a time with the full gate. Use when the owner asks for a batch of quests or tasks ("encode quests 3 to 6", "do these four items").
---

# Batch of backlog tasks

1. **Pick.** Read `docs/BACKLOG.md`. Choose tasks that touch mostly different files. Say in one line per task which files it touches. Tasks that edit the same file (pack manifests, `QUEST_ENCODING.md`) are fine, but plan the merge order.
2. **Ask once.** Collect every question that needs the owner (rules, scope, a symbol you cannot read) into ONE numbered list. Mark each `[book]` (the rule is in the Quest Book or rulebook, cite the page) or `[proposal]` (an edge case the book does not cover, your suggestion). Never present a proposal as a rule. If the owner said not to wait, decide the reversible ones, record them in `docs/DECISIONS.md`, and list them in the report.
3. **Create worktrees.** `node scripts/wt.mjs new <task>` for each (at most 4 at a time). Each agent gets a narrow prompt: the task, the files, the docs to read, "work only in your worktree, run `node scripts/verify.mjs`, commit on your branch, do not push, do not merge".
4. **Merge in order.** From master with a clean tree: `node scripts/wt.mjs merge <task>`. It runs the full gate and rolls master back if the gate fails. Fix a failing branch in its worktree and try again. Run `npm run test:e2e` after the last merge.
5. **Clean up.** `node scripts/wt.mjs clean`, then `git worktree list` must show only master.
6. **Review.** Run the `reviewer` agent on the merged result of engine, schema or UI changes (by diff size, see `/ship`).
7. **Report.** Done, verified (real numbers), rolled back or deferred, decisions taken for the owner, next candidates.

---
description: Plan and implement the next open tasks of a milestone from docs/BACKLOG.md
argument-hint: <milestone id, e.g. M2>
---

Work on milestone **$ARGUMENTS** of SoloQuest v2.

1. Read `CLAUDE.md`, `docs/BACKLOG.md` (section $ARGUMENTS), `docs/DECISIONS.md` and the docs the tasks point to.
2. List the open tasks of $ARGUMENTS and propose an order and a short plan per task (files, tests). If a task needs a rules or product decision that is not in `docs/DECISIONS.md`, ask me before coding it.
3. Implement task by task. Use the `engine-dev` agent for `src/engine/` work and the `ui-dev` agent for `src/ui/` work. Keep each task small enough to review.
4. After each task: `npm run typecheck && npm test` (and `npm run test:e2e` for UI). Then run the `reviewer` agent. Fix blocking findings.
5. For engine rule work, run the `rules-referee` agent before ticking the task.
6. Tick the task in `docs/BACKLOG.md`, add new decisions to `docs/DECISIONS.md`, and commit with a short message (`engine: ...`, `ui: ...`, `content: ...`, `docs: ...`).
7. At the end, give me a short summary: what is done, what is next, and any rule interpretation I should confirm.

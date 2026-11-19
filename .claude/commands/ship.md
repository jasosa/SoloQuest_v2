---
description: Check, review and commit the current changes (never pushes)
argument-hint: <short commit message, optional>
---

Ship the current changes of SoloQuest v2: $ARGUMENTS

1. `git status` and `git diff --stat`. If you are on `master` and the change is more than a small fix, make a branch first.
2. Run `node scripts/verify.mjs` (full gate). If it fails, fix the cause and run it again. Never skip hooks.
3. Run `npm run test:e2e` if anything in `src/ui/` or `tests/e2e/` changed. For new content (a quest, a pack, a library item) also open it from the real screen (quest list, editor, `?quest=<id>`) and check it is listed and starts; a walk-through test alone does not prove it is visible. If it fails, find out if it is real or load related (run that test alone) before changing code.
4. Review, by size of the change:
   - Changes in `src/engine/`, the quest schema or more than about 200 lines: run the `reviewer` agent. Also the `rules-referee` agent when engine rules or a quest file changed.
   - Smaller code changes: read your own diff once against `CLAUDE.md` hard rules.
   - Docs only: no review.
   If a review agent fails with an API error (for example a 403), run it again once. If it still fails, say so in the report; do not skip it silently.
5. Fix blocking findings and go back to step 2. For findings that need an owner decision, stop and list them with options and your recommendation.
6. Tick `docs/BACKLOG.md` and `docs/DECISIONS.md` when the change calls for it.
7. Commit as its own command (short imperative message, `Co-Authored-By` line). Check that it worked with `git log --oneline -1`. The pre-commit hook runs verify again.
8. Do not push. Report in 5 lines at most: what was committed, what was verified (real numbers), what was reviewed, open items.

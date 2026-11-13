---
description: Review the current changes before commit (hard rules, tests, design, scope)
---

Run the `reviewer` agent on the current working tree changes. If the changes touch `src/engine/` rules or `src/content/quests/`, also run the `rules-referee` agent. Summarize blocking issues first, then minor ones, and say if it is OK to commit.

---
description: Independent check of an encoded quest against the Quest Book (rules referee + overlay)
argument-hint: <quest number 1-14>
---

Verify quest **$ARGUMENTS** without changing it.

1. Run `npm run validate` and the quest's walk-through test.
2. Run `npm run overlay -- $ARGUMENTS` and look at the overlay at 100%, quarter by quarter.
3. Run the `rules-referee` agent on `src/content/quests/q<NN>-*.json` with the map page and the notes of quest $ARGUMENTS.
4. Report differences as a table: cell or note, what the book shows, what the JSON has. Do not fix anything; I decide.

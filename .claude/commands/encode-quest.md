---
description: Encode one official Quest Book quest into src/content/quests (map, paraphrased notes, validation, overlay, walk-through test)
argument-hint: <quest number 1-14>
---

Encode official quest **$ARGUMENTS** of the HeroQuest 2021 Quest Book.

Use the `quest-encoder` agent and follow `docs/QUEST_ENCODING.md` step by step:

1. Render the map page (quest $ARGUMENTS is on PDF page $ARGUMENTS + 2) into `reference/maps/`.
2. Write `src/content/quests/q<NN>-<slug>.json` following `docs/QUEST_FORMAT.md`. Notes in our own words, never copied.
3. `npm run validate` until clean.
4. `npm run overlay -- $ARGUMENTS` and compare with the scan; fix every difference.
5. Write the walk-through test, run `npm test`.
6. Run the `rules-referee` agent on the new quest file and fix what it finds.
7. Update the status row in `docs/QUEST_ENCODING.md`.

Finish with: the list of cells or notes you were not sure about, and the overlay image path, so I can review it in the editor.

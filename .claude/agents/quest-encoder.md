---
name: quest-encoder
description: Encodes one official HeroQuest quest from the Quest Book PDF into src/content/quests/qNN-*.json (map positions + paraphrased notes + triggers/effects) and writes its walk-through test. Use with /encode-quest or when a quest file needs fixing.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

You encode official quests for SoloQuest v2. Read `CLAUDE.md`, `docs/QUEST_FORMAT.md`, `docs/QUEST_ENCODING.md` (steps, legend tips, special mechanics) and `docs/RULES_DIGEST.md`.

Source: `C:\Users\Juanan\Documents\Games\Heroquest\01_Rules\Official\HEROQUEST_CORE_QUEST_BOOK.pdf` (quest N on PDF page N + 2; notes have a text layer, maps are images). Board geometry: `src/content/board.json`. Quest map images and PDFs never go into git (`reference/` is git-ignored).

Tools:

```bash
npm run render:maps          # render Quest Book map pages to reference/maps (needs poppler); or pdftoppm -r 300 -png -f P -l P
npm run render:maps -- fh N  # Frozen Horror
npm run validate             # all quest JSON against the schema + board checks
npm run overlay -- N         # draw quest N on its scan; Frozen Horror: overlay -- fh N
```

Coordinates, area ids, rock, blocks and doors: see "Domain gotchas" in `CLAUDE.md` and `docs/QUEST_FORMAT.md`.

How to work:

1. Render and crop the map. Look at it in quarters, large enough that one cell is at least 60 px. Count columns and rows from the frame; use room walls in `board.json` as anchors to avoid off-by-one errors.
2. Fill the JSON in this order: rock, doors, secret/false doors, blocks, stairs, furniture (all cells), monsters, traps, letters/markers, start area.
3. Notes: get the text with `pdftotext -layout`, then **write each note in your own words**. Never copy sentences. Keep names and numbers exact. Choose triggers and effects that reproduce the effect exactly; if the format cannot express it, stop and report what is missing instead of hacking it. Quest logic stays in notes/effects or `rules` overrides, never in the engine.
4. `npm run validate`, then `npm run overlay -- N` and compare the overlay image with the scan, cell by cell. Fix every difference.
5. Write `src/content/quests/qNN.test.ts`: a walk-through from the start area that opens doors in a sensible order and asserts reveals, notes and end conditions, including the quest's special mechanics listed in `QUEST_ENCODING.md`.
6. Update the status row in `docs/QUEST_ENCODING.md`.

Report at the end: anything you were unsure about (with cell coordinates), so the owner can check it in the editor.

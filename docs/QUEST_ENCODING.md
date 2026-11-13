# Encoding the 14 official quests

Goal: each quest of the core Quest Book becomes `src/content/quests/qNN-<slug>.json` (format: `QUEST_FORMAT.md`), exact in positions and effects, with notes in our own words.

## Copyright guard

- Never paste Quest Book or rulebook sentences into the repo. Paraphrase each note so the effect is exact but the wording is ours. Keep names (Verag, Ulag, Sir Ragnar) and numbers (gold, Body Points).
- Rendered map pages live in `reference/maps/` (git-ignored). Do not commit images or PDFs.

## Tools

- Source PDF: `C:\Users\Juanan\Documents\Games\Heroquest\01_Rules\Official\HEROQUEST_CORE_QUEST_BOOK.pdf` (19 PDF pages; quest N is on PDF page N + 2, e.g. quest 1 on page 3, quest 14 on page 16).
- Rendering needs Poppler (`pdftoppm`). On Windows: `winget install oschwartz10612.Poppler` or `scoop install poppler`, then `npm run render:maps` (writes `reference/maps/qNN.png` at 300 dpi and a crop of the map frame).
- Board geometry is already extracted: `docs/board.json` (from the blank map, PDF page 17). Map frame on a 150 dpi page render: about x 200..1310, y 120..920; a cell is about 41.3 px at 150 dpi.
- Notes text: `pdftotext -layout` on the quest book gives the note text to paraphrase.

## Steps per quest (`/encode-quest N`)

1. Render the map page and crop the map. Read it at a size where one cell is at least 60 px (zoom in on quarters of the map).
2. Rock: list fully dark rooms in `rock.rooms`, dark corridor cells in `rock.cells`.
3. Doors, secret doors (on edges), blocked squares (single/double), stairs, furniture (cells), monsters (cell and type), traps (kind and cell), letters and markers (X, XX, numbers, "Cell").
4. Notes: one note per letter + unlettered notes (wandering monster, quest-wide rules, named monster stats). Pick the trigger and effects from `QUEST_FORMAT.md`.
5. `npm run validate`: schema + board checks (doors on real edges between different areas or across a wall, furniture inside one room, no overlap, every letter on the map has a note, start area exists).
6. Overlay check: `npm run overlay -- N` renders the JSON on top of the scan (`reference/overlays/qNN.png`). Look at it at 100%, fix differences.
7. Walk-through test `src/content/quests/qNN.test.ts`: open the doors in a sensible order from the start, assert what each reveal shows (monsters, furniture, notes fired), and the end conditions.
8. Update the status table below. Ask the owner for a 5 minute review in the editor (underlay mode).

## Monster codes on the maps

Green circles with faces on the quest maps (see the "Design Your Own Quest Adventures" legend, PDF page 17): goblin (big pointed ears), orc (tusks), skeleton, zombie, mummy, abomination (fish-like face), dread warrior (horned helmet), gargoyle (wings). Gold trap symbols: pit (square with cracks), falling block (stones), spear (diagonal lines). When unsure, compare with the legend at the same zoom.

## Status

| # | Quest | Map | Notes | Validate | Overlay | Walk-through | Owner review |
|---|---|---|---|---|---|---|---|
| 1 | The Trial | partial (prototype, SW part) | A, B | | | | |
| 2 | The Rescue of Sir Ragnar | | | | | | |
| 3 | Lair of the Orc Warlord | | | | | | |
| 4 | Prince Magnus' Gold | | | | | | |
| 5 | Melar's Maze | | | | | | |
| 6 | Legacy of the Orc Warlord | | | | | | |
| 7 | The Lost Wizard | | | | | | |
| 8 | The Fire Mage | | | | | | |
| 9 | Race Against Time | | | | | | |
| 10 | Castle of Mystery | | | | | | |
| 11 | Bastion of Dread | | | | | | |
| 12 | Barak Tor: Barrow of the Witch Lord | | | | | | |
| 13 | Quest for the Spirit Blade | | | | | | |
| 14 | Return to Barak Tor | | | | | | |

## Known special mechanics (must be covered by the walk-through tests)

| Quest | Mechanic |
|---|---|
| 1 | No traps, no secret doors (Zargon info). Mummy C rolls 4 attack dice. |
| 2 | Sir Ragnar alarm: reveal all, open all doors; Ragnar NPC (2 BP, 2 defend, moved with 1 red die); chest A poison needle (1 BP); no search in the cell. |
| 3 | Ulag stats; armory staff (A); cupboard gold + potion (B). |
| 4 | Three locked chests (A), carried one per hero, 1 red die movement while carrying. |
| 5 | Gargoyle B dormant until the next door opens, cannot be harmed until it acts; chest C gas trap (2 BP); E throne: secret door found by treasure search, not by secret door search. |
| 6 | Start in "Cell", no equipment or spells until room A is searched; Grak stats and spells; stairs B end. |
| 7 | All Dread warriors +1 defend; C needle trap (2 BP) + purple potion (hero turns to stone 5 turns); D Wardoz zombie, papers after he dies. |
| 8 | Balur stats, fire immune, six spells once each; escape to XX, placed only when that room's door opens. |
| 9 | Start in room A; three chests B; C gas trap (3 BP) + Elixir of Life. |
| 10 | Every door teleports (2 red dice to numbered squares); landing on a figure costs 1 BP; one door per turn; mine B fool's gold; A ring after both Dread warriors die; ghost instead of wandering monster. |
| 11 | Bounty per kill (text); gargoyle B wakes if chest trap springs; disarm tells what would have happened; C Dread warrior's sword. |
| 12 | False doors A; C falling block collapses after the last hero passes; D Witch Lord wakes when the first hero enters; only the Spirit Blade harms him. |
| 13 | Falling-block squares: roll 1 red die (4-6 = 1 BP, helmet: only 6), not blocking, no tiles. |
| 14 | Witch Lord stats, fear twice, Spell Ring on death. |

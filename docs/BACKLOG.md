# Backlog

Milestones in order (see `IMPLEMENTATION_PLAN.md` section 9). Tick a box only when its tests pass. Add tasks you discover under the right milestone.

## M0 · Setup and board

- [x] `git init`, `.gitignore` already in place; first commit with the harness
- [x] Vite + React 18 + TypeScript strict, ESLint, Prettier (2 spaces, single quotes, semicolons)
- [x] Vitest, Playwright (tablet project 1194 x 834, touch)
- [x] vite-plugin-pwa (offline shell, installable)
- [x] npm scripts from CLAUDE.md (`dev`, `test`, `test:e2e`, `lint`, `typecheck`, `validate`, `render:maps`, `overlay`); `overlay` is a stub until the quest schema (M1)
- [x] Move `docs/board.json` to `src/content/board.json`; typed loader; test: 22 rooms, sizes, R15 L-shape, corridor ring
- [x] Design tokens and fonts from `design/play-a/` into `src/ui/shared/` (CSS variables, Bonum + Pagella)
- [x] SVG board renderer: grid, rock hatch, walls derived from areas; state switch via `?state=` for screenshots, like the prototype
- [x] `tools/quest-import/render-maps.ts` (pdftoppm wrapper, crop of the map frame); checked on quest 1, crop shows the full 26 x 19 frame

## M1 · Engine core

- [x] Quest schema (Zod) + loader + migrations stub (`QUEST_FORMAT.md`)
- [x] Board model: areas, edges, walls, doors on edges, rock, blocks
- [x] Line of sight (center to center, corner rule) with ASCII-map tests, incl. the corner-through-open-door case
- [x] Game state + events + reducer + undo (drop last event) + seeded RNG
- [x] Reveal: open door (room / corridor), look from square; doors, blocks, monsters, trap "?" revealed
- [x] "Look from here" hint: squares where board geometry (ignoring rock) shows unseen corridor squares
- [ ] Follow-ups from the M1 review (before M7): validator checks for `noEquipmentUntil`, objective monster ids, `trigger.monsterType`, trap/door overlaps with blocks and furniture; block id collision with generated `bN` ids; test for a door touched only by a block in `revealRoom`
- [ ] Secret doors: the search event must add the door to `seenDoors` (M3); `addSecretDoor` effect too (M4)
- [x] Rooms are all or nothing (decision 14): sight into a room reveals the whole room; test over random event sequences
- [x] Autosave of the event log (IndexedDB) and resume (`src/persist/saves.ts`; wiring into the UI happens in M2)

## M2 · Play loop v1

- [x] Quest select + team select (1 to 4 heroes)
- [x] Play screen layout (title band, board, right column) as in the prototype
- [x] Margin note component (beside in the upper half, above in the lower half)
- [x] Open door with ink reveal animation; look from here; stamp-in tokens; roster
- [x] Monster callout: stats, wound/heal (Body > 1), slain
- [x] Undo, toasts, reduced motion
- [x] Quest 1 fully encoded by hand (needed to test M2..M5)

## M3 · Searches and traps

- [ ] Treasure search: hero picker, once per hero per room, monsters-in-room guard + override, special note or "Draw a treasure card"
- [ ] Wandering monster: card with placement rules (next to the searcher, attacks at once; else closest square, acts next turn), roster entry without a square
- [ ] Secret door search (room / corridor line of sight), found doors appear closed, note overrides
- [ ] Traps house rule: jump / disarm (Dwarf, tool kit) / step on, die result input, spring effects by kind, sprung pit tile, falling block = permanent block
- [ ] Chest traps: spring before the search result

## M4 · Notes engine

- [ ] Triggers, conditions, effects from `QUEST_FORMAT.md`
- [ ] Read notes leave their letter on the map (tap to read again) and in the journal
- [ ] Square markers (neutral glyph, "A hero is here") and "A hero enters" on areas with `areaEntered`
- [ ] Objectives panel, end quest screen (goal check, rewards as text)
- [ ] NPC chip (Sir Ragnar)

## M5 · Zargon's turn

- [ ] Weights, rule draw, tie list, plans, grudges (`ZARGON_AI.md`), deterministic per turn
- [ ] Zargon page: priority list (grouped identical orders), "Who can it reach?" mode, done per entry, end turn
- [ ] Special rules per monster (dormant, invulnerable until acts, stone, extra dice, moves 1)
- [ ] Casters: spell suggestion and spell use tracking
- [ ] Turn counter effects (`zargonTurn` triggers, stone countdown)

## M6 · Editor

- [ ] Editor layout: tools left, board center, inspector right
- [ ] Tools: rock, doors, secret/false doors, blocks, furniture (cells), monsters, traps, stairs, markers, start
- [ ] Inspector (monster overrides, spells, states; trap kind/effect; furniture letter)
- [ ] Note builder (trigger picker on the board, conditions, effects)
- [ ] Reference underlay (load image, 4-corner align, opacity), local only
- [ ] Validation panel, playtest with "Zargon view", import/export `.hqquest.json`

## M7 · The 14 quests

- [ ] Overlay tool (`npm run overlay -- N`)
- [ ] Quests 1..14 (each: map, notes, validate, overlay, walk-through test, owner review; status in `QUEST_ENCODING.md`)

## M8 · Polish

- [ ] Wake lock, settings (sound off, reduced motion), resume screen
- [ ] Accessibility pass (labels, focus, contrast)
- [ ] Full session test on a real tablet

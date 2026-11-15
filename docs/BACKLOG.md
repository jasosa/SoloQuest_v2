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

- [x] Treasure search: hero picker, once per hero per room, monsters-in-room guard + override, special note or "Draw a treasure card"
- [x] Wandering monster: card with placement rules (next to the searcher, attacks at once; else closest square, acts next turn), roster entry without a square
- [x] Secret door search (room / corridor line of sight), found doors appear closed, note overrides
- [x] Traps house rule: jump / disarm (Dwarf, tool kit) / step on, die result input, spring effects by kind, sprung pit tile, falling block = permanent block
- [x] Chest traps: spring before the search result


## M4 · Notes engine

- [x] Triggers, conditions, effects from `QUEST_FORMAT.md`
- [x] Read notes leave their letter on the map (tap to read again) and in the journal
- [x] Square markers (neutral glyph, "A hero is here") and "A hero enters" on areas with `areaEntered`
- [x] Objectives panel, end quest screen (goal check, rewards as text)
- [x] NPC chip (Sir Ragnar)

## M5 · Zargon's turn

- [x] Weights, rule draw, tie list, plans, grudges (`ZARGON_AI.md`), deterministic per turn
- [x] Zargon page: priority list (grouped identical orders), "Who can it reach?" mode, done per entry, end turn
- [x] Special rules per monster (dormant, invulnerable until acts, stone, extra dice, moves 1)
- [x] Casters: one random spell the players confirm, spell use tracking (decision 31)
- [x] Turn counter effects (`zargonTurn` triggers, stone countdown)

## Small changes (owner requests, 2026-11-13)

- [x] "Look from here" is offered only on squares with the eye symbol (the `lookHintCells` squares). Other seen corridor squares get no look option; the engine should refuse `LOOK_FROM` elsewhere too, with a test
- [x] "Search for secret doors" does not ask for a hero (same as the chest trap search): drop `hero` from `SEARCH_SECRET_DOORS` in the engine, the event schema and the UI sheet
- [x] Furniture shows a note with its name (for example "Weapons rack"). It must work by tap on touch screens and phones, not only by hover; on a desktop, hover shows it too. Keyboard: focus shows it. The chest note already exists, so it gets the name too. Names come from the furniture type, no book text

## M6 · Editor

Slices (in order; each ends green with tests and a commit):

**Slice 1: foundation and board tools**
- [x] Editing model in the engine: pure operations on a quest draft (rock, doors incl. secret/false, blocks, furniture with footprint check and rotate, monsters, traps, markers, start, stairs), id generation, structured validation issues, empty quest template
- [x] `.hqquest.json` export and import with migration and readable errors (`userText` never exported)
- [x] User quests in IndexedDB (list, save, delete, draft autosave); [ ] Editor entry on the quest select screen (with the shell UI)
- [x] Editor shell UI (tools left, board center, inspector right, history undo/redo) and the board tools; Editor entry on the quest select screen

**Slice 2: inspector and notes**
- [x] Engine ops for the inspector and note builder (`updateMonster`, `updateTrap`, `setFurnitureLetter`, `addNote`, `updateNote`, `setNoteText`, `removeNote`, `lettersMissingNotes`, `notesWithoutLetter`)
- [x] Inspector (monster name, overrides, traits, spells, state; trap kind and effect; furniture letter; door kind)
- [x] Editor checks (decision 64): false doors block reachability, stacking rules in ops and validator, redundant rock cell warning
- [x] Note builder (trigger picker on the board, conditions, effects, live check that every letter on the map has a note)

**Slice 3: verification tools**
- [x] Reference underlay (load image, 4-corner align, opacity), local only
- [x] Validation panel with jump to the element; playtest with a "Zargon view" (shows everything)
- [x] Import/export in the UI; Quest 1 recreated in the editor equals the bundled file (done when)

Open: "monster count vs box inventory" validation needs the miniature counts of the owner's box (not in the repo).

## M7 · The 14 quests

- [ ] Overlay tool (`npm run overlay -- N`)
- [ ] Quests 1..14 (each: map, notes, validate, overlay, walk-through test, owner review; status in `QUEST_ENCODING.md`)

## M8 · Polish

- [ ] Polish from the M6 slice 1 review: show a note when the draft cannot be stored (`stored` is false); reset the title field when an empty rename is refused; limit Backspace-delete to the board; show store errors on the editor start screen (create, copy); editor chip text 14 px; visible focus on the import file button; a `setNumber` edit operation if the owner wants the quest number editable

- [ ] Polish from the M5b review: NoteCard Esc stack should use a ref for `onClose` and a stable id, and margin notes should join the stack (Esc can close both a margin note and a card today); check that the all-heroes-fallen card does not reappear after every new event

- [ ] Polish from the M5 review: the Zargon dialog should move focus to its heading when it opens; check the `rgba(110, 31, 42, 0.08)` tint in play.css against a token

- [ ] Polish from the M4 review: trap Tab focus inside dialogs (or `inert` on the rest of the screen); cap or move long toasts to a sheet; add the dialog veil color to DESIGN.md tokens; reset the re-read sheet after an undo removes its note; unit test for a pending choice shown after the note sheets

- [ ] Wake lock, settings (sound off, reduced motion), resume screen
- [ ] Accessibility pass (labels, focus, contrast)
- [ ] Full session test on a real tablet

## Zargon spell tags (core, can land before M9)

- [ ] Casters: 25% of turns no spell (seeded), situation tags order and question, app-checked hurt tags when monster BP are tracked, at most 3 "no" answers, Escape only with an escape point (decisions 47, 48; `ZARGON_AI.md`)
- [ ] Core Dread spell tag table in `dreadSpells.ts`, with warnings

## M9 · Pack layer

- [ ] Core as a pack: `pack.json`, loader, `dependsOn`
- [ ] Campaign / one-shot, campaign flags with one-shot defaults, campaign settings and campaign seed
- [ ] Team as a free list (heroes, mercenaries, animal allies with owner); quest team rules as warnings; `HERO_DIED` for any entry
- [ ] Targets: mercenaries, allies and NPCs in tie lists; `excludeTargets`; `caster`, `grudge`, theft heroes only
- [ ] Settings: Rule hints (free movement hint, first-reveal reminders)

## M10 · Frozen Horror (`FROZEN_HORROR.md`)

- [ ] Schema: `maps` + links, start kinds, edge doors, locked and `hiddenUntil` doors, room tiles, terrain, area merge, sight blockers, monster size, passive state, trap kinds as data, tunnels with design, wandering monster list, quest team rule
- [ ] Hazards and optional decoys; ice slide reveal on a good jump
- [ ] Note questions and new effects (`removeDoor`, `showDoor`, `removeMonster`, `excludeTarget`, `replaceFurnitureWithDoor`, sight blocker clear, `crossMap`)
- [ ] Multi-map crossing (Q9-10)
- [ ] Profiles: thief, grappler (solo setting), shooter, passive, multi-attack, large; Raiment warnings
- [ ] Frozen Horror spell tags and random extra spells
- [ ] Editor: pack tools, map tabs, spell builder
- [ ] Encode Q0 and Q1..Q10, overlays, walk-through tests; confirm the dark square near F in Q0

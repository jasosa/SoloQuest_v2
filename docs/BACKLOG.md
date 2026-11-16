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
- [ ] Follow-ups from the M1 review: the validator checks are done (`noEquipmentUntil`, objective monster ids, `monsterType` shape, trap and door overlaps with blocks and furniture, block id collision with generated `bN` ids). Still open: a test for a door touched only by a block in `revealRoom`
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

- [x] Overlay tool (`npm run overlay -- N`)
- [ ] Quests 1..14 (each: map, notes, validate, overlay, walk-through test, owner review; status in `QUEST_ENCODING.md`)

## M7b · Playtest feedback (plan: `FEEDBACK_PLAN.md`, decision 66)

Do these before M8 polish. Quest owner review (M7) comes after step 8.

- [x] Step 1: README and backlog reconciled, slain monsters leave the roster, `zargonInfo` removed from format and quests, marker visibility `editor`
- [ ] Step 2, quest data pass (done so far: start note in every quest, Q2 helper text, Q3 spoilers, Q5 gargoyle and secret wall texts, Q6 and Q9 all heroes escape, Q7 note D check, Q8 XX and Balur text, Q12 falling rock as a note. Q6 and Q9 stairs buttons now wait for the stairs room. Q7 note A now fires on the first Dread warrior seen (new `monsterSeen` trigger, no map letter) and D5 is a Gargoyle (a different monster type; there are 4 Dread warriors). Q5 throne is furniture again (a throne may stand on a secret door). Q9: one search gives both chests, no change. Q10: doors never open (repeatable door button `A hero goes through`, no reveal beyond the door) and `endText` shows the gold note after every ending. Waiting for step 3: Q5 throne, Q7 note A and D5 label, Q9 note B chests, Q10, Q11; Q6 roster codes with step 5): quests 2, 3, 5, 6, 7, 8, 9, 10, 12 as in the plan section 5; a start instruction in every quest; no repeated rewards or spoilers
- [ ] Step 3, engine and format: `monsterSeen` trigger, conditions on manual triggers, `allSeenKilled` objective rule, rock-door exception for `doorTeleport`, throne next to a secret door, objectives with their own `done` triggers
- [ ] Notes refactor, engine slice 1 done (conditions `areaRevealed`, `doorOpened`, `monsterSeen`; objective `done: { when }` and `confirm` with `CONFIRM_OBJECTIVE`; editor condition forms). Note `target` field and `noteTarget()` done too. Goal confirmations of quests 2, 4, 6, 9, 13 now use objective `confirm` + `confirmWhen`. Quest sheet built (title band goal line and chips, `eventLog`, `startTexts`, side column without goal, journal and Quest actions). "For this quest" in the margin notes of doors, rooms, traps, chests and monsters is built (`elementQuest`), with room labels for rooms that have a button. Quest 12: the square C ring shows its message and button together, no note and no letter (manual notes can have a `hint`), and a ring hides the eye glyph and offers "Look from here" itself. Quest 12: the painted doors have no note (only the "cannot be opened" toast) and the square C button belongs to its square (`target` kind `square`). Editor: the Actions section of the inspector is built (list, add chips, Belongs to, Show it, Detach, hint and repeat of buttons). Zones (decision 68): schema, `zoneEntered` trigger, `ZONE_ENTER`, labels in play, validator and editor operations are done. The editor has no notes any more: Actions tab, one Add action button and the action popup (Applies to, When from the compatible triggers), the Zones tool, editable markers and the quest start message as an action of the quest are built (decision 68). Not yet: a "quest ends" trigger. Still open: light veil for messages, furniture that is not a chest as an element, element taps for `manual` notes (Q12 doors A and square C), Quest sheet, element detail sheet, room labels, editor Actions section, move the 7 manual notes
- [ ] Refactor the notes system around quest elements (needs a design pass with the owner first; plan sections 3.2 and 3.3 are only a first idea): an action (trigger, optional conditions, effects: message, reveal, place monster, question, counter) belongs to a door, furniture, monster, trap or marker instead of a board square or a free-floating note. Square and area triggers stay with a visible marker. Objectives get their own triggers and conditions, no helper note. Proposal: `NOTES_REFACTOR.md`. Decide the format (data model, migration of the 14 quests), how play shows element actions (tap the element), and how the editor edits them. Replaces the "actions on elements" part of step 7 and the Quest actions rework
- [ ] Quest 12 painted doors (owner, after the Quest sheet work): today trying one only shows the toast "This door cannot be opened." Replace the toast by a second, real note (message sheet, logged) saying the doors cannot be opened. It needs a way for a false-door attempt to fire a note (a trigger such as `doorTried` with a list of doors, once). No letter on the map.
- [ ] Step 4, messages: message sheet for every triggered text, Quest sheet (start text, objective, notes read, actions), start sheet, journal as the full log, less scrolling, "Things to confirm" block apart from "End the quest"
- [ ] Rework the Quest actions block of the side panel (owner does not like it): decide where manual buttons live (on the board element they belong to, or a Quest sheet), how they are named, and how they differ from End the quest. Plan section 3.3 is a first idea, not final; ask the owner before building
- [ ] Step 5, monsters (done: special flag with ring and star, abilities library and quest abilities, tooltips, margin note, Zargon special rules, 8 named monsters marked special; editor for special and abilities is built; open: behavior prompts (waits for, goal), Add monster and wandering monster with a square): special mark and tooltips, abilities library (quest extras, editor builder), dormant and waiting prompts
- [ ] Step 5b, added monsters: "Add monster" and wandering monster ask the players for a square; the token is drawn static, can be slain, acts on Zargon's turn, highlighted as new
- [ ] Step 6, map: "Show room" (layout only, free tool with a warning, rock message), highlight on additions, double blocks in wide corridors, trap hit area check (quest 3)
- [ ] Step 7, editor: actions attached to doors, furniture, monsters and markers; objective triggers; ability builder; admin edit of bundled quests kept as a draft until replaced; custom trap symbols
- [ ] Step 8, owner review round, one quest at a time with the overlay

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

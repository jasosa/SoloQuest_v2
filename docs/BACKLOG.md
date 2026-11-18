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
- [x] Quests 1..14 (each: map, notes, validate, overlay, walk-through test, owner review; status in `QUEST_ENCODING.md`). Owner review done 2026-11-17 for all 14.

## M7b · Playtest feedback (plan: `FEEDBACK_PLAN.md`, decision 66)

Do these before M8 polish. Quest owner review (M7) comes after step 8.

- [x] Step 1: README and backlog reconciled, slain monsters leave the roster, `zargonInfo` removed from format and quests, marker visibility `editor`
- [ ] Step 2, quest data pass (done so far: start note in every quest, Q2 helper text, Q3 spoilers, Q5 gargoyle and secret wall texts, Q6 and Q9 all heroes escape, Q7 note D check, Q8 XX and Balur text, Q12 falling rock as a note. Q6 and Q9 stairs buttons now wait for the stairs room. Q7 note A now fires on the first Dread warrior seen (new `monsterSeen` trigger, no map letter) and D5 is a Gargoyle (a different monster type; there are 4 Dread warriors). Q5 throne is furniture again (a throne may stand on a secret door). Q9: one search gives both chests, no change. Q10: doors never open (repeatable door button `A hero goes through`, no reveal beyond the door) and `endText` shows the gold note after every ending. Waiting for step 3: Q5 throne, Q7 note A and D5 label, Q9 note B chests, Q10, Q11; Q6 roster codes with step 5): quests 2, 3, 5, 6, 7, 8, 9, 10, 12 as in the plan section 5; a start instruction in every quest; no repeated rewards or spoilers
- [ ] Step 3, engine and format: `monsterSeen` trigger, conditions on manual triggers, `allSeenKilled` objective rule, rock-door exception for `doorTeleport`, throne next to a secret door, objectives with their own `done` triggers
- [ ] Notes refactor, engine slice 1 done (conditions `areaRevealed`, `doorOpened`, `monsterSeen`; objective `done: { when }` and `confirm` with `CONFIRM_OBJECTIVE`; editor condition forms). Note `target` field and `noteTarget()` done too. Goal confirmations of quests 2, 4, 6, 9, 13 now use objective `confirm` + `confirmWhen`. Quest sheet built (title band goal line and chips, `eventLog`, `startTexts`, side column without goal, journal and Quest actions). "For this quest" in the margin notes of doors, rooms, traps, chests and monsters is built (`elementQuest`), with room labels for rooms that have a button. Quest 12: the square C ring shows its message and button together, no note and no letter (manual notes can have a `hint`), and a ring hides the eye glyph and offers "Look from here" itself. Quest 12: the painted doors have no note (only the "cannot be opened" toast) and the square C button belongs to its square (`target` kind `square`). Editor: the Actions section of the inspector is built (list, add chips, Belongs to, Show it, Detach, hint and repeat of buttons). Zones (decision 68): schema, `zoneEntered` trigger, `ZONE_ENTER`, labels in play, validator and editor operations are done. The editor has no notes any more: Actions tab, one Add action button and the action popup (Applies to, When from the compatible triggers), the Zones tool, editable markers and the quest start message as an action of the quest are built (decision 68). Not yet: a "quest ends" trigger. Still open: light veil for messages, furniture that is not a chest as an element, element taps for `manual` notes (Q12 doors A and square C), Quest sheet, element detail sheet, room labels, editor Actions section, move the 7 manual notes
- [ ] Refactor the notes system around quest elements (needs a design pass with the owner first; plan sections 3.2 and 3.3 are only a first idea): an action (trigger, optional conditions, effects: message, reveal, place monster, question, counter) belongs to a door, furniture, monster, trap or marker instead of a board square or a free-floating note. Square and area triggers stay with a visible marker. Objectives get their own triggers and conditions, no helper note. Proposal: `NOTES_REFACTOR.md`. Decide the format (data model, migration of the 14 quests), how play shows element actions (tap the element), and how the editor edits them. Replaces the "actions on elements" part of step 7 and the Quest actions rework
- [ ] Quest 12 painted doors (owner, after the Quest sheet work): today trying one only shows the toast "This door cannot be opened." Replace the toast by a second, real note (message sheet, logged) saying the doors cannot be opened. It needs a way for a false-door attempt to fire a note (a trigger such as `doorTried` with a list of doors, once). No letter on the map.
- [ ] Step 4, messages: message sheet for every triggered text, Quest sheet (start text, objective, notes read, actions), start sheet, journal as the full log, less scrolling, "Things to confirm" block apart from "End the quest"
- [x] Rework the Quest actions block of the side panel (done: no sidebar block; objective confirms sit under their objective in Quest Info, loose buttons are "Quest actions" there; End quest stays apart) (owner does not like it): decide where manual buttons live (on the board element they belong to, or a Quest sheet), how they are named, and how they differ from End the quest. Plan section 3.3 is a first idea, not final; ask the owner before building
- [ ] Step 5, monsters (done: special flag with ring and star, abilities library and quest abilities, tooltips, margin note, Zargon special rules, 8 named monsters marked special; editor for special and abilities is built; open: behavior prompts (waits for, goal), Add monster and wandering monster with a square): special mark and tooltips, abilities library (quest extras, editor builder), dormant and waiting prompts
- [x] Designer slices 1 and 2 (decision 70): spells as data and the caster flow; abilities and spells as dropdown lists with popups in the monster inspector
- [x] Designer slice 3 (decision 70): browser library (IndexedDB) with export and import, quests keep copies of what they use
- [x] Designer slice 4 (decision 70): enemies as data (`enemyDefs`, `monster.enemy`, letter, picture), Designer screen and tab (core items read only, Mine, Copy, Used in, Token), start screen, editor tabs Quest / Map / Actions / Monsters / Designer
- [x] Add a monster in play with a square; a wandering monster asks for its square (decision 71)
- [x] `questEnds` trigger: notes shown in the end dialog (decision 71)
- [x] Monster behavior prompts (decision 71): Waits for, Goes toward, in the Monsters tab and on the Zargon order
- [ ] Designer polish: Quest tab "Start room" field, an image on a hero token in play (heroes are only listed for now), companions used by quests, Designer items that change keep quest copies in step (a quest keeps its own copy by design)
- [ ] Step 5b, added monsters: "Add monster" and wandering monster ask the players for a square; the token is drawn static, can be slain, acts on Zargon's turn, highlighted as new
- [ ] Step 6, map: "Show room" (layout only, free tool with a warning, rock message), highlight on additions, double blocks in wide corridors, trap hit area check (quest 3)
- [ ] Step 7, editor: actions attached to doors, furniture, monsters and markers; objective triggers; ability builder; admin edit of bundled quests kept as a draft until replaced; custom trap symbols
- [ ] Step 8, owner review round, one quest at a time with the overlay

## M7c · Quests review (owner, 2026-11-17)

General, quick fixes
- [x] Open door dialog: replace the "open is free..." text with "Free action"
- [x] Search when all 4 heroes already searched: ask "All heroes searched already, search anyway?"
- [x] Corridors: show the eye (look from here) only on crossing squares
- [x] Confirmation before slaying a monster
- [x] Monster popups: show stats under Special
- [x] Quest button renamed Quest Info
- [x] Quest intro readable inside the quest (Quest Info, "About this quest")
- [x] Popup when an objective is achieved
- [x] Trapped chest: show the trap first, then after Done the search; if the search for treasure springs the trap, drop the "search for traps in the chest" option

General, need a design decision first (ask owner)
- [x] Action panel split by scope: Element (actions of the element, maybe none), Room (clear labels, e.g. Search Room), Quest (clear labels). Furniture click must not show Search Room as an element action
- [x] Spell flow (decision 72): show the spell and its questions; No shows the alternative spell (if any); No again shows regular movement. Make questions concrete (e.g. "Is a hero with high attack in sight?"). Clarify move/cast order per spell
- [ ] Designer: let the owner define situation tags and their questions for spells (a tag is a short id plus a concrete question and an optional app check), not only pick from the fixed list. Today the 16 tags and their texts are fixed in `src/engine/data/spells.ts`; a spell can only have its own single question.
- [x] Designer: make monster profiles editable (the plan text, whether it sometimes moves back, and the target weights per monster type), like abilities and spells. Today profiles and weights are fixed in `src/engine/zargon/weights.ts` and `texts.ts` (decision 74).
- [x] Behaviors: "Block doorway" is unclear and is the same for every monster type
- [x] Board zoom: pinch gestures and numeric controls

Per quest
- [x] Q1: Mummy is a special monster
- [x] Q2: Sir Ragnar companion full stats (e.g. Movement Dice 1, Attack Dice N/A)
- [x] Q3: furniture in R14 is a chest, not a throne
- [x] Q5: searching for traps in the throne room and the adjacent room gives the regular "no traps found" message (find how to do it in the editor); corridor outside the central room (skeleton and trap) blocks the board, no "look from here" after the trap springs; change the Gargoyle wakes message
- [x] Q6: Grak still in the wrong place; quest not editable (furniture f-stairs, letter B has no note); Grak popup must not show the staff/cloak trait text nor "This turn it casts no spell"
- [x] Q8: Balur uses escape as first or second spell (quest defined); leave nothing on the map where he stood after he escapes
- [x] Q11: trap disarmed message is addressed to the players, fix wording; objective also includes escaping by the stairs
- [x] Q12: false door shows a result sheet like the already-searched chest, not a toast (a logged quest note with a `doorTried` trigger is still open, see the Quest 12 item above)
- [x] Q13: start message with "the six marked falling-block squares" removed (each marker keeps its rule)
- [x] Q13: editor changes still show the old version in play (the quest list now plays the editor draft when there is one; unsaved edits count)

## M8 · Polish

- [ ] Polish from the M6 slice 1 review: show a note when the draft cannot be stored (`stored` is false); reset the title field when an empty rename is refused; limit Backspace-delete to the board; show store errors on the editor start screen (create, copy); editor chip text 14 px; visible focus on the import file button; a `setNumber` edit operation if the owner wants the quest number editable

- [ ] Polish from the M5b review: NoteCard Esc stack should use a ref for `onClose` and a stable id, and margin notes should join the stack (Esc can close both a margin note and a card today); check that the all-heroes-fallen card does not reappear after every new event

- [ ] Polish from the M5 review: the Zargon dialog should move focus to its heading when it opens; check the `rgba(110, 31, 42, 0.08)` tint in play.css against a token

- [ ] Polish from the M4 review: trap Tab focus inside dialogs (or `inert` on the rest of the screen); cap or move long toasts to a sheet; add the dialog veil color to DESIGN.md tokens; reset the re-read sheet after an undo removes its note; unit test for a pending choice shown after the note sheets

- [x] Polish from the UI review (decision 77): contrast tokens (done: `--green` darkened to 4.83:1 on paper-2; fallen heroes use `--muted`, 5.25:1; the selected quest card uses ink for small text; `--sel` was fine as a background, 6.5:1; the Start button now says why it is off). Original note:  Lighten `--sel`; dead-hero text (`--off`) is 1.77:1; `--green` on paper-2 is 4.49:1 (needs 4.5:1); the disabled Start button needs a hint saying why
- [ ] Polish from the UI review: board squares are 34 px at the default fit on tablet. Add a larger invisible hit area (44 px) or an easier select, without changing the drawing
- [ ] Prettier flags `promptToasts.ts` (`SelectScreen.tsx` is formatted now) (not touched by the review pass): format them
- [ ] Wake lock, settings (sound off, reduced motion), resume screen
- [ ] Accessibility pass (labels, focus, contrast)
- [ ] Full session test on a real tablet

## Zargon spell tags (core, can land before M9)

- [x] Casters: 25% of turns no spell (seeded), the question of each situation tag, at most 3 "no" answers, Escape only with an escape point (decisions 47, 48, 70). Not built: app-checked hurt tags when monster BP are tracked
- [x] Core Dread spell tag table with warnings (`src/engine/data/spells.ts`)

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

## Editor changes asked in the quests review (not now)

- [x] Zones: the zone effect disappears after the first interaction (find out what the effect is and why it goes)
- [x] Actions popup appears on top of the existing text (done in the Actions tab: the action sits in a column beside the list; elsewhere it is still a popup). It should work like the monsters one (a panel beside the list, not over the text)
- [x] Monsters and Actions info appear twice: in their tabs and in the side panel. Removed: the map inspector has no Actions list and no monster form (a pointer to the Monsters tab); a monster's actions are in the Monsters tab; a tap on a letter on the map makes or opens its action over the board

## Library layers (decision 76, `docs/LIBRARY_LAYERS.md`)

- [x] Origin (official or fan-made) on library items, badge and card; owner mode replaces LOCK_CORE
- [x] Core files in the repository (`src/content/library/*.json`) with an `expansion` per item, applied at start (add, change, delete)
- [x] Export Core from the Designer in owner mode, and Delete from Core with a warning about the quests that use the item
- [ ] Designer scope switch: Core | My library; Used in shows quests
- [ ] Expansions on and off for the add menus (quests keep working)
- [ ] Copy on edit for normal users (Core read only)
- [ ] My library exported and imported as a pack file to share

## Texture packs (owner, wanted; plan the next feature with these in mind)

Goal: a user changes the look of play mode by applying a texture pack, for an expansion or a quest. A pack gives images for the board, walls, doors, furniture, monsters, heroes and tokens. See the idea in the owner's reference picture (stone floor tiles, lit walls and torches, wooden doors, 3D-looking chests, round portrait tokens, parchment and wood panels).

- [x] Decision first: decision 78 (drawing only, `.sqtextures` file, stored in the browser, a quest may only suggest a pack)
- [x] Theme layer, slice 1 (floor, corridor and rock pictures; furniture pictures with turn; the built-in look is the default theme; dev `?theme=test`). Slice 2 done: walls, doors, blocks, traps (stairs are furniture; markers stay symbols). Slice 3 done: monster pictures by type on the board token and the roster coin (an enemy's own image wins; heroes are not drawn on the board). Slice 4 done: `.sqtextures` file (zip, fflate), browser storage, Textures dialog on the select screen. Original note: every drawn element asks a `Theme` for its look (floor, rock, wall, door, each furniture type, trap, stairs, token, marker, fog). Today `BoardView.tsx` and `Furniture.tsx` draw them as SVG line art with token colors, so the default theme is the current drawing
- [ ] Image slots for all elements, including every furniture type, with a rule for size, anchor, rotation and footprint (a 2x1 table is one image over 2 squares)
- [ ] Board styles: floor tile images (with variants so it does not repeat), wall pieces (top face, side face, corners), rock fill, room lighting; the board stays a 26 x 19 grid, only the drawing changes
- [ ] Walls with depth (as in the reference): decide between a flat top-down skin and a raised wall strip; the second needs extra space around rooms and a change of how sight, doors and tokens are laid out
- [x] Texture pack file format (`.sqtextures`), import, export, delete and a picker (the Textures link on the select screen). A Settings screen and a preview in the Library are not built
- [ ] A quest can suggest a texture pack (decision 78, point 4): a `suggestedPack` id in the quest format, a line on the quest card, an offer to switch, never forced. Needs the quest schema, `QUEST_FORMAT.md` and the editor Quest tab
- [x] Whole-picture packs (decision 79): `board`, whole monster tokens, furniture proportions and stairs corner, single and double blocks, trap kinds, secret door
- [x] Pack authoring help: `docs/TEXTURE_PACKS.md` (format, slots, picture sizes). The owner's personal example pack, cut from the Quest Book, is built by `reference/texture-pack/build.py` and stays in the git-ignored `reference/` folder (never committed or shared)
- [ ] Monster, hero and companion pictures from the pack (the Library already has a per-enemy `image`; the pack gives the default per type)
- [ ] UI chrome from the pack (parchment panels, wood buttons, gear icon) is a later, separate step: it needs the token colors and sizes to stay readable (contrast, 44 px targets)
- [ ] Performance and offline: images in the PWA cache or IndexedDB, small formats (webp), lazy load, sprite sheets for large packs

- [x] Pack knobs (done): `scale` (0.4 to 2.5) and `offset` (squares) on monster, door, block, trap and furniture slots, as a file name or `{ file, scale, offset }`; documented in `docs/TEXTURE_PACKS.md`. Original note: `scale` on every slot, also above 1 for tokens (monsters bigger on the board, as in the monster list), and an optional offset `[dx, dy]` (in squares) to nudge a picture; for monsters, doors, blocks, traps and furniture. Documented in `docs/TEXTURE_PACKS.md`, checked by the pack reader. Today only furniture has `scale` (0.4 to 1), and nothing can be nudged
- [x] Pack preview (done): Preview in the Textures dialog (sample board with every slot, checks for soft pictures and a wrong board shape, list of empty slots). Original note: in the Textures dialog, a sample board that shows every slot of the selected pack at real size (board, a room, each furniture type with its footprint, monsters, doors open and closed, blocks single and double, traps), with warnings such as a picture much smaller than it is shown (soft on a tablet), a board picture that is not 26 : 19, or a slot the pack leaves empty. It is how a pack author sees the result without opening a quest

## Ideas (owner, not scheduled)

- [ ] Quest items: an item a quest defines (for example the purple flask of quest 7) that a hero can be given and that has an action of its own ("drink it") with effects, like any action. The app would keep which hero holds which quest item during the quest. There is no Zargon player, only the players, so what an unknown item does must stay hidden until it is used (the first search says only what the players may know). Needs a new decision first: it adds a small piece of tracking (who holds which quest item) next to the dead-hero fact, so hard rule 2 and decision 32 must be amended by the owner. Also: editor (define items, give them with an effect), Quest sheet or hero chip to show items, undo, and a text for the flask of quest 7 (Q7 note C, now it says the effect up front).

## Tablet test findings (owner, 2026-11-17)

- [x] The new game button was not visible: the screen is now scaled to fit the window (`FitToScreen`)
- [x] Interface too small after the fit, and the Start button too low: select, editor and Designer fill the width and scroll; the Start button is under the heroes
- [x] Zoomed in, the lower part of the board could not be reached: the zoom limits now use the visible board area
- [x] A lot of empty space left and right in a quest: the play screen is drawn as wide as the window, the right column takes the extra width
- [x] More space to the board, and normal text size: the play screen is drawn at the window size and the board is fitted to the map area
- [x] Zoom on the editor map (chips, two-finger pinch and move, wheel)

# SoloQuest v2: Implementation Plan

HeroQuest (2021 Hasbro / Avalon Hill edition) companion app for solo and cooperative play of the 14 core quests, and of quest packs (expansions) as data. First expansion: **The Frozen Horror** with its free online prelude "Into the Northlands" (`docs/FROZEN_HORROR.md`).
The app replaces Zargon as **map revealer, quest-note keeper and monster brain**. It does not track hero or monster movement. The physical board stays the center of the game.

**Guiding principle:** the app tracks as little as possible and enforces the minimum set of rules. It tracks only what the reveal engine, the notes and the AI need; game rules are shown as text, warnings or optional hints (`docs/DECISIONS.md`).

Sources used: `F3649_en-us_heroquest-game-instructions-rulebook.pdf` (image-only, read with OCR) and `HEROQUEST_CORE_QUEST_BOOK.pdf` (text layer for notes, maps are images). Packs: Frozen Horror Quest Book (text layer), Online Quest 2 "Into the Northlands" (image-only), owner's photos of the Dread spell cards (tags only).

---

## 1. Goals and non-goals

**Goals**

- Choose a pack (core or an expansion), a mode (campaign or one-shot), a quest and a team (a free list of heroes, mercenaries and animal allies; data model open for expansion heroes).
- Show the explored part of the dungeon only, with fog of war on the rest. Reveal rooms and corridors with the same rules a human Zargon uses.
- Keep the roster of monsters in play. On Zargon's turn, propose for each acting monster a target, an action, and if it retreats after the attack. Flag special rules when they trigger.
- Treasure search, secret door search, house-rule traps, all quest notes with triggers.
- A quest editor that uses the same data format.
- All 14 core quests shipped as data; quest packs shipped as data (Frozen Horror first, prelude included).

**Non-goals**

- No tracking of hero or monster positions or movement.
- No tracking of hero-related monster state (who is hugged, who was robbed): the card text covers it (decision 46).
- No enforcement of team rules: quest team rules are warnings (decision 38).
- No spell effects, potions, items or Mind Points. Spells are names, tags and short warnings; players read the cards.
- No digital dice (players roll real dice). An optional dice roller can come later.
- No digital treasure deck (players draw real cards). The app only says "draw a card" and handles the Wandering Monster result.
- No reproduction of the official book text. The app ships the quest data (positions, stats, effects) and **paraphrased** notes. In the editor the user can paste the original wording into their local copy (stored only on their device).

---

## 2. Rules digest (what the app must implement)

From the rulebook, the parts that matter for the app:

| Topic | Rule | App behavior |
|---|---|---|
| Looking down a corridor | Zargon places doors, blocked squares and monsters in the hero's line of sight. A line through a wall or a closed door blocks sight. | "Look from here" on a corridor cell reveals cells, doors, blocks and monsters in line of sight from that cell. |
| Opening a door | Zargon places monsters, chests and other items of that room. No traps, no treasure. | Open door reveals the whole room behind it (all cells, furniture, monsters, closed doors on its walls). If the door gives to a corridor, reveal is line of sight from the cell in front of the door. |
| Line of sight | Straight line between square centers. Visible if it does not cross a wall or closed door, even if it touches a corner. | Ray cast center-to-center on the wall-edge grid. Corner touch = visible. Blocked squares count as wall. Monsters and heroes do not block reveal (they only block spells). Furniture does not block (decision 16), except pieces marked as sight blockers until a flag (decision 56). Terrain does not block (decision 57). |
| Doors | All start closed. Once opened they never close. Opening is free (not an action). | Doors can only go from closed to open. |
| Search treasure | Rooms only. No monsters in the room. Each hero once per room. Special treasure only for the first searcher; otherwise draw a treasure card. Wandering monster from a card is placed next to the searcher and attacks them at once. | Search dialog: pick hero, check room has no living revealed monsters, per-hero-per-room tracking, special note or "Draw a treasure card" + "I drew a Wandering Monster" button. |
| Search secret doors | No monsters visible. Zargon reveals secret doors in the room or corridor where the hero is. Door must still be opened later. | Search dialog: pick the area (room, or corridor cell for line of sight); no hero. Places found secret doors as closed doors. |
| Traps (official) | Pit, falling block, spear, chest/furniture. Hidden until searched. Jump: 2 moves left, 1 combat die, skull = sprung. Disarm: tool kit (fail on skull) or Dwarf (fail on black shield). | Replaced by the house rule below. |
| Monsters | Move then act, or act then move. Never move part way, act, and move again. No diagonal. Max one attack. Spellcasters cast instead of attacking, each spell once per quest. | Zargon turn assistant: action plan per monster ("advance and attack", "attack and retreat", "hold", "cast X"). |
| Ending | Goal done and back to stairway, or retreat to stairway, or all heroes dead. | End quest screen with objectives check and reward. The exit can be the stairway, a wooden exit door or a tile; the end dialog also offers "The quest has failed" (decision 54). |

**House rules from the brief**

- **Traps are visible, type is hidden.** A "?" marker appears on a trap square as soon as the square is revealed. Chest / furniture traps show a "?" on the furniture. Players choose:
  - **Jump**: roll 1 combat die. Not a skull: passed, trap stays. Skull: trap springs, app reveals type and effect.
  - **Disarm**: Dwarf (fails only on black shield) or hero with tool kit (fails on skull). Success: trap removed, app tells what it was. Failure: trap springs.
  - **Step on it** (forced or by choice): trap springs.
- **No "search for traps" action.**

Spring effects by type (official): pit = 1 BP, pit tile, turn ends; falling block = 3 combat dice, 1 BP per skull, no defend, square becomes permanent block, hero picks a side; spear = roll 1 die, skull = 1 BP, trap gone; chest = effect from quest note.
**Decided:** a failed jump (or failed disarm) springs the trap with its normal rules for that trap type. Chest traps follow decision 25 (hidden, "Search for traps" on the chest).

**Pack hazards** (decisions 41 to 44): square hazards that the book makes undetectable (wandering monster trap, slippery ice, ice slide) use the same "?"; a disarm always fails and springs them; a good jump over an ice slide reveals the whole slide. Optional decoy "?" markers (off / few / many). Trap kinds are data in the pack.

---

## 3. Architecture

**Stack**

- Vite + React 18 + TypeScript (strict).
- State: Zustand store wrapping a pure engine reducer.
- Board rendering: SVG (crisp at any zoom, easy hit testing, easy to animate fog).
- Schemas: Zod (quest files, saves). JSON Schema exported for external tools.
- Persistence: IndexedDB through Dexie (saves, user quests, user note text).
- PWA: vite-plugin-pwa, offline first, installable on tablet.
- Tests: Vitest (engine), Playwright (end to end and visual checks).
- No backend. Quests are shared as `.hqquest.json` files.

**Repository layout**

```
SoloQuest_v2/
  docs/                      plan, design notes, rules digest
  src/
    engine/                  pure TS, no React, 100% unit tested
      board/                 grid, areas, walls, line of sight
      quest/                 quest model, schema, loader, validator
      game/                  game state, actions, reducer, event log, undo
      triggers/              trigger matching, conditions, effects, note questions
      zargon/                monster AI, target selection, special rules, spell flow
      pack/                  pack manifest, loader, dependency on core (M9)
      data/                  monsters.ts, heroes.ts, dreadSpells.ts, furniture.ts
    content/
      board.json             fixed geometry of the 2021 board (26 x 19)
      quests/q01-the-trial.json ... q14-return-to-barak-tor.json
      packs/frozen-horror/   pack.json + quests q00 (prelude), q01..q08, q09-10 (M10)
    ui/
      board/                 SVG renderer, fog, tokens, markers
      play/                  setup, play screen, sheets, Zargon turn
      editor/                editor screen, tool palette, inspectors, note builder
      shared/                design tokens, components
  tools/
    quest-import/            map scan pipeline (see section 8)
  tests/
    engine/ e2e/ quests/
```

**Engine pattern: event sourcing**

- `GameState = reduce(questDefinition, events[])`.
- Every user action is an event: `OPEN_DOOR`, `LOOK_FROM`, `SEARCH_TREASURE`, `SEARCH_SECRET_DOORS`, `TRAP_JUMP`, `TRAP_DISARM`, `TRAP_STEP`, `MONSTER_DAMAGE`, `MONSTER_KILL`, `WANDERING_MONSTER`, `HERO_DIED`, `SQUARE_TRIGGER`, `AREA_ENTER`, `ZARGON_TURN_START`, `ZARGON_TURN_END`, `NOTE_ACK`, `END_QUEST`. Pack additions: `NOTE_ANSWER` (note questions), `MONSTER_REMOVE` (escaped, freed), `MONSTER_ACTIVATE` (passive attacked), `CROSS_MAP`.
- The reducer returns new state plus a list of **prompts** (texts, choices) for the UI.
- Benefits: full undo (very important at the table, mis-taps happen), autosave is just the event list, deterministic tests, replay for debugging.
- Randomness (AI tie breaks) uses a seeded RNG stored in state, so undo/redo is stable.

---

## 4. Data model

### 4.1 Board (fixed, encoded once)

The 2021 board is a 26 x 19 grid. Encode once in `board.json`:

- `cells[y][x] = areaId` (`R01`..`R22` rooms incl. the center room, `C` corridor).
- Walls are derived: an edge between two cells is a wall when the area ids differ, or when either cell is a room and the other a corridor. Corridor to corridor edges are open.
- Quests can override areas: `areaOverrides: [{ merge: [areaA, areaB], as }]` removes the wall between two rooms (decision 55).
- Source of truth: the blank map in the Quest Book (page "Design Your Own Quest Adventures") plus the quest 1 map. Verified by overlay (section 8).

### 4.2 Quest file (`*.hqquest.json`)

```ts
Quest {
  id, number, title, schemaVersion
  intro: { summary: string, userText?: string }   // paraphrased goal; userText local only
  zargonInfo?: string                              // e.g. "no traps or secret doors in this quest"
  rock: CellRef[]                                  // dark shaded cells, solid rock
  start: { areaId, cells?: CellRef[] }             // stairway room or "Cell" (Q6) or room A (Q9)
  stairs?: CellRef                                 // 2x2 stair tile anchor
  doors: Door[]                                    // { id, a: CellRef, b: CellRef, kind: 'normal'|'secret'|'false' }
  blocks: Block[]                                  // single or double blocked squares
  furniture: Furniture[]                           // { id, type, anchor, rot, letter?, trap?: TrapRef }
  monsters: MonsterPlacement[]                     // { id, type, cell, name?, letter?, overrides?, startState? }
  traps: Trap[]                                    // { id, kind: 'pit'|'fallingBlock'|'spear'|'chest'|'scripted', cell|furnitureId, effect? }
  markers: Marker[]                                // letters A-E, X, XX, numbers 2-12, Cell, etc. Visible or Zargon-only
  notes: Note[]                                    // see 4.3
  wanderingMonster: MonsterType | { text: string }
  objectives: Objective[]                          // kill X, recover item, escort NPC, return to stairs
  rewards: Reward[]
  rules?: QuestRuleOverrides                       // e.g. Q13 falling-block variant, Q10 teleport doors
  npcs?: Npc[]                                     // Sir Ragnar
}
```

**Pack additions to the quest file** (M9 and M10; `QUEST_FORMAT.md` gets them when they are implemented):
- `pack`; `team?: { solo?, only?: HeroType[] | 'any', grantsAlly? }` (warnings only, decision 38); `excludeTargets?`; `flagsIn?` (campaign flags with one-shot defaults).
- `maps: QuestMap[]` and `links` for multi-map quests (decision 45); today's single-map fields move into one map.
- `start` kinds: stairway, iron door, tile; doors with `outside` (board edge) and kinds `ironEntry`, `woodenExit`, `locked`, plus `hiddenUntil` (decision 54).
- `roomTiles`, `terrain`, `areaOverrides`, furniture and tiles with `blocksSightUntil` (decisions 55 to 57).
- Monster `size` (large monsters), `startState: 'passive'`, `plan` override.
- Traps by pack trap kind id (decision 44); markers for tunnels with `pair` and `design` (decision 58) and escape points.
- `wanderingMonsters: { type, count }[]` (decision 40).

### 4.3 Notes and triggers

A note = **trigger + conditions + effects**. One note can have several effects.

Triggers:

| Trigger | Example from the 14 quests |
|---|---|
| `questStart` | Q1 "no traps or secret doors", Q6 heroes start without equipment |
| `areaRevealed(area)` | show flavor text when a room is first seen |
| `doorOpened(door)` | Q5 B gargoyle wakes when the door to the next room opens; Q2 Ragnar's cell door raises the alarm |
| `areaEntered(area)` | Q12 D Witch Lord wakes when the first hero enters the tomb; Q10 mine room |
| `squareEntered(cell)` | Q10 numbered teleport squares and "through any door" rule; Q13 falling-block squares |
| `treasureSearch(area, first/each)` | most lettered chests (Q1 D, E; Q3 A, B; Q5 A, D, E...) |
| `secretDoorSearch(area)` | Q5 E (search finds nothing) |
| `trapSprung(trap)` / `trapDisarmed(trap)` | Q11 B chest trap wakes the gargoyle; disarm tells what would have happened |
| `monsterKilled(monster or filter)` | Q7 D after Wardoz dies; Q11 bounty per kill; Q14 Spell Ring |
| `allKilled(filter)` | Q10 A both Dread warriors dead |
| `zargonTurn(n)` | Q7 stone statue countdown |
| `manual` | a button on a marker: "a hero passes here" |
| `noteQuestion(answer)` | FH Q5 B "Are all heroes in this room?", Q8 G scepter, Q9 A stairway, Q0 C lever, ice tunnels (decision 53) |
| `monsterEscaped(monster)` | FH Q9-10 "Was it the Crystal Key?" |

Conditions: flags, counters, monster alive/dead, "first time", hero chosen, ally in team (alive).

Effects: `showText`, `revealArea`, `revealAll` (Q2 alarm), `openAllDoors`, `placeMonster`, `setMonsterState` (dormant, active, stone n turns), `addDoor` / `convertToSecretDoor` (Q5 E throne), `placeBlock` (Q12 C falling block), `giveItem` / `giveArtifact`, `setFlag`, `addCounter` (bounty gold), `completeObjective`, `spawnNpc`, `promptChoice`. Pack additions (decision 53): `removeDoor`, `showDoor` (`hiddenUntil`), `removeMonster(reason)`, `excludeTarget`, `replaceFurnitureWithDoor` (open), clear a sight blocker, `crossMap`.

A note can have three parts: what the heroes know, a question asked when its letter is tapped, and a hidden part with effects after the answer.

**Engine API notes**: the UI must call `startGame(level, seed)` (not only `initialState`) to get the questStart and start-room prompts. A pending `promptChoice` does not block other events; the UI shows it until `CHOOSE` answers it.

**Square triggers** (the hard case in the brief): a marker is drawn on the cell once the cell is revealed. It uses a neutral glyph (not the effect), so it does not spoil the content. Tapping it asks "Did a hero step here?" and fires the note. Notes can be `once` or `every time`.

### 4.4 Monster data

Base stats from the monster cards (to verify against the physical cards / Game Master screen, they are not in the PDFs):

| Monster | Move | Att | Def | Body | Mind |
|---|---|---|---|---|---|
| Goblin | 10 | 2 | 1 | 1 | 1 |
| Orc | 8 | 3 | 2 | 1 | 2 |
| Abomination | 6 | 3 | 3 | 2 | 3 |
| Skeleton | 6 | 2 | 2 | 1 | 0 |
| Zombie | 5 | 2 | 3 | 1 | 0 |
| Mummy | 4 | 3 | 4 | 2 | 0 |
| Dread Warrior | 7 | 4 | 4 | 3 | 3 |
| Gargoyle | 6 | 4 | 5 | 3 | 4 |

Named monsters from the quest book: Ulag 10/4/5/2/3, Grak 8/4/4/3/3 + fear, sleep, tempest; Balur 8/2/5/3/7 + six spells, fire immune; Witch Lord Q12 moves 1, 2 attack, only the Spirit Blade harms him; Witch Lord Q14 10/5/6/4/6.

Pack monsters (Frozen Horror: Frozen Horror, Ice Gremlin, Polar Warbear, Yeti, enemy mercenaries, named monsters) come with stats, profile, weights, special rules, defensive abilities and spells in the pack data (`docs/FROZEN_HORROR.md`).

Monster instance in game state: `{ id, type, name, stats, body, size?, map?, state: 'hidden'|'dormant'|'passive'|'active'|'dead'|'escaped'|'freed', flags, spellsLeft, revealedAt }`.

### 4.5 Pack manifest (`pack.json`, M9)

- `id`, `name`, `dependsOn: ['core']`, campaign order (extra quests allowed, e.g. Frozen Horror Q0).
- `heroes` (Frozen Horror: alternate Barbarian), `mercenaries` (team and enemy), `allies` (wolf).
- `monsters`: stats, profile, weights, special rules, defensive abilities, spell list, extra random spells.
- `spells`: name, tags or custom question, optional warning (decision 48).
- `trapKinds` (decision 44), `terrain`, `roomTiles`, shared `rules` texts (e.g. ice ledge, ice tunnels).
- `campaignSettings` (e.g. Raiment, decision 61).

---

## 5. Play mode

### 5.1 Setup

1. Pick pack and mode (campaign or one-shot, decision 37; packs from M9). Campaign settings are chosen when the campaign starts.
2. Pick quest (cards for 1 to 14 plus user quests). Shows the paraphrased goal.
3. Pick team: today any 1 to 4 of the heroes. From M9 a free list in three groups (heroes, mercenaries, animal allies with an owner hero); quest team rules only warn (decision 38). The app does **not** track hero Body Points, gold, equipment or artifacts (decided).
4. Settings (from M9/M10): decoy traps, "No Yeti hug in solo quests", "Rule hints" (decisions 43, 59, 60).
5. Start: the start area is revealed (stairway room, iron door opened and looked in, or tile area), Zargon info is shown, the wandering monsters for the quest are listed.

### 5.2 Main screen interactions (tap-first, everything else in sheets)

| Tap on | Options |
|---|---|
| Closed door at the edge of explored area | **Open door**. Reveals the other side, fires door triggers. |
| Revealed corridor cell | **Look from here**. Reveals line of sight from that cell. |
| Revealed room | **Search for treasure**, **Search for secret doors**, **A hero enters** (only if the room has an `areaEntered` note, shown as a subtle glyph). |
| Trap "?" | **Jump**, **Disarm**, **Step on it**. |
| Monster token | Damage -1 / +1, **Kill**, view stats and special rules. |
| Square marker | **A hero is here**. Fires the note. |
| Top bar | Turn counter, **Zargon's turn**, objectives, undo, menu. Free movement hint when Rule hints are on and no monster is active (decision 60). |
| Iron door / wooden exit / exit tile (packs) | **Open** (start); end the quest when all heroes have left (decision 54). |

Explored area stays visible. Fog covers the rest. Rock is never shown as playable.

### 5.3 Reveal engine

- `revealArea(areaId)`: all cells of the room + furniture + monsters + doors on its walls (closed). Traps shown as "?". Secret doors not shown.
- `revealLineOfSight(fromCell)`: for every cell in the corridor network and the open rooms, cast a ray center to center, stop on walls, closed doors and blocks. Reveal the visible corridor cells, their doors, blocks, monsters, trap "?". A room is never partly revealed: if line of sight reaches any square of a room (for example through an open door), the whole room is revealed.
- Door into a corridor: line of sight from the corridor cell in front of the door, looking out.
- Door between two known areas: only flips the door to open.
- Packs: sight blockers until a flag (decision 56); large monsters are visible if any of their cells is revealed; multi-map crossing resets fog and opened doors (decision 45).

### 5.4 Zargon's turn assistant

Hero and monster positions are not tracked, so the app cannot compute reach. The design gives an **order per monster** that players apply on the board. The page shows one monster at a time in a dialog (decision 34); there is no reach mode.

For each active monster, in reveal order, one card:

- **Target priority**, for example "Wizard > Elf > Dwarf > Barbarian". Players attack the first hero in the list that the monster can reach.
- **Plan**: one of
  - *Advance and attack* (move then attack),
  - *Attack and fall back* (attack from where it is, then move away, ideally to a doorway or out of reach),
  - *Hold* (stay or block a doorway, attack if adjacent),
  - *Cast [spell] on [target]* (spellcasters, instead of attacking).
- **Special rules** that apply now, for example "Cannot be harmed until it has moved or attacked", "Rolls 4 attack dice", "+1 defend (stone)", "Moves 1 square", "Stone: 3 turns left".
- Buttons: done / killed / damage.

How the order is built (full spec: `docs/ZARGON_AI.md`): each Zargon turn, each monster draws a **target rule** from weights for its type (closest, last attacker, fewest or most Body Points left, fewest defend dice, most attack dice, a spellcaster, or a grudge against one named hero kept for the whole quest). Players apply it with their character sheets. A **tie list** (seeded shuffle of the team) is always shown. The **plan** comes from the monster profile (skirmisher, soldier, brute, duelist, relentless, caster). Same seed + turn + monster gives the same order, also after undo.

Hero Body Points are not tracked (decided); rules that need them are applied by the players. The app tracks only whether a hero died (decision 32): dead heroes leave the tie list and cannot be named in events.

Spell choice for casters (decision 31): one random spell the monster still has; the players say whether it could be cast; if not, the next random one; when none is left, the normal plan. Each spell listing once per quest, one spell per turn. Extended by decisions 47 and 48: 25% of turns no spell, situation tags set the order and the question, at most 3 "no" answers.

Pack profiles (decision 49): thief, grappler, shooter, passive, multi-attack, large. Targets include mercenaries, animal allies and NPCs (decision 39). Roster buttons: "Escaped" (thief), "It left" / "A hero attacked it" (passive).

### 5.5 Searches

- **Treasure**: hero picker (greyed if this hero searched this room), room check (warn if living revealed monsters in room; players can confirm a "the monster is in fact gone" override). Order: armed chest trap in the room springs first (note effect), then special treasure (first searcher only), else "Draw a treasure card". Result card offers **"Wandering monster"**: adds the quest's wandering monster to the roster, marked "attacks the searcher now".
- **Secret doors**: area (no hero). In a room: all secret doors on its walls. In a corridor: secret doors in line of sight of the tapped cell. Found doors appear closed. Notes like Q5 E can override ("nothing found").

### 5.6 Special quest mechanics in the 14 quests

| Quest | Mechanic | Implementation |
|---|---|---|
| Q2 | Sir Ragnar alarm, escort NPC 2 BP | `revealAll` + `openAllDoors` + NPC chip with BP and "moved by the hero who opened the door, 1 red die" |
| Q4 | Carry chests, 1 red die move | items on the objective panel, reminder text |
| Q5 | Dormant gargoyle, throne secret door | monster `dormant` = statue, furniture until a note sets it `active` (decision 28: not in the roster, not counted by search guards, no orders, cannot be wounded; `dormantFigures` lets the UI draw it); `addSecretDoor` effect |
| Q6 | No equipment until room A | quest-start condition banner; cleared by treasure note |
| Q7 | Stone Dread warriors +1 defend; purple potion turns hero to stone 5 turns | overrides; hero status timer |
| Q8 | Balur escape to XX, revealed only when door is opened | hidden placement linked to a door trigger |
| Q10 | Teleport doors, numbered squares 2 to 12 | quest rule banner + numbered markers + "roll 2 red dice" helper |
| Q11 | Bounty per kill; dormant gargoyle (B) | counter effect on `monsterKilled`; the gargoyle is a `dormant` statue (decision 28) woken by the chest trap note |
| Q12 | False doors, falling block after last hero, Witch Lord wakes on entering | `kind:'false'` doors (they never open: `doorStuck`, decision 29); scripted trap; `areaEntered` note |
| Q13 | Different falling-block rule | `squareEntered` notes with `repeat: true` and a `showText` effect (not `fallingBlock` trap objects, which are the one-shot trap that leaves a permanent block); `rules.fallingBlock = 'q13'` for the text |
| Q14 | Witch Lord only harmed by Spirit Blade, fear twice | override flags |

Frozen Horror and its prelude: `docs/FROZEN_HORROR.md`.

---

## 6. Editor

Same SVG board, different tools. Layout: tool palette left, board center, inspector right.

- **Layers / tools**: rock, doors (click an edge), secret doors, false doors, blocks (single, double), furniture (place, rotate, footprint check), monsters, traps, stairs, markers (letters, X, numbers), start area.
- **Inspector**: properties of the selected element (monster name, stat overrides, dormant, spells; trap kind and effect; furniture letter).
- **Note builder**: list of notes A..Z + unlettered. Each note: text, trigger (pick from the board: "click the door"), conditions, effects (form rows). Live check that every letter on the map has a note.
- **Reference underlay**: load an image of a quest map, align with 4 corner points, change opacity. Used to encode the official quests and to check them. The image stays on the device.
- **Validation panel**: doors on valid edges, furniture inside one room and not overlapping, monster count vs. box inventory, unreachable areas, missing notes, schema errors.
- **Playtest**: open the quest in play mode, with a "Zargon view" toggle that shows everything.
- **Import / export** `.hqquest.json`. Schema versioned with migrations.
- **Pack additions** (M10): board-edge doors, locked and hidden-until-flag doors, room tiles, terrain, area merge, sight blockers, large monster footprint, tunnels with pair and design, escape point, one tab per map with a link tool, quest settings (team warning, granted ally, excluded targets), note questions, spell builder for fan-made spells. Validation: map links with both ends, tunnel pairs complete, ice slide bottom touching a walkable square.

### Editor model (slice 1, engine and storage)

Code: `src/engine/editor/` (ops, refs, io), `src/engine/quest/validate.ts`, `src/persist/userQuests.ts`.

- **Draft** = a parsed `Quest`. Every operation is a pure function `(quest, ...args) => EditResult`, `{ ok: true, quest, warnings } | { ok: false, error }`. Input is never changed. Undo/redo in the UI is a stack of quests. The board is the fixed game board.
- **Operations**: `emptyQuest`, `renameQuest`, `setSummary`, `setStartArea`, `setRockCell`, `setRockRoom`, `addDoor` / `removeDoor` / `setDoorKind` (normal, secret, false; ids d, s, x with the first free number), `addBlock` / `removeBlock` (by square), `addFurniture` / `moveFurniture` / `rotateFurniture` / `removeFurniture`, `addMonster` / `moveMonster` / `removeMonster`, `addTrap` / `removeTrap`, `addMarker` / `removeMarker`. Footprint rules: on the board, not rock, inside one room, squares touching, nothing else on them.
- **Removing** an element never edits notes or objectives. What still points at it comes back in `warnings` (each with a ref to jump to) and stays a validation error until fixed. The chest trap of removed furniture is removed with it. `setDoorKind` renames the door and rewrites `doorOpened` and `addSecretDoor` references.
- **Issues**: `validateQuestIssues(quest, board, { editor? })` returns `{ message, severity: 'error' | 'warning', ref? }`, with `ref = { kind, id?, cell?, area? }` for jumping to the element. The editor checks (an objective exists, letters on the map have notes) run unless `editor: false`; `validateQuest` is the game checks only, as plain messages. Errors block export, warnings do not.
- **Files**: `exportQuest` (pretty JSON, fixed key order, no `intro.userText`), `exportQuestChecked` (refuses on errors), `importQuest` (never throws: bad JSON, unknown version, schema paths, validation errors; warnings returned). Extension `.hqquest.json`.
- **Storage**: `UserQuestStore` (`list`, `load`, `save`, `remove`, plus `saveDraft` / `loadDraft` / `removeDraft` for autosave), `MemoryUserQuestStore`, `DexieUserQuestStore` in its own database (`soloquest-user-quests`), so the saves database is untouched. User quest ids start with `user-` (`newUserQuestId(title, taken)`), bundled ones are `qNN-...`, so they never collide. `userText` stays in local storage.
- **Status** (decision 110): `quest.status` is `draft` or `approved` (missing = approved), `quest.copyOf` the bundled quest id of a copy. `src/engine/editor/status.ts` has `questStatus`, `approveQuest`, `withdrawQuest`, `makeCopy`, `playableUserQuests` (what the lists of quests to play may show) and `replaceOriginal`. `UserQuestSummary` carries `status` and `copyOf`. Not the same as the autosave ("Unsaved draft") of the editor start list.
- Test: quest 1 is rebuilt from `emptyQuest` with these operations only (`q01Rebuild.test.ts`).

---

## 7. Persistence and offline

- Autosave the event log after every action (IndexedDB). Resume screen on launch.
- User quests and user-pasted text in IndexedDB. Export/import for backup.
- Campaign state per pack (M9): finished quests, flags, team, campaign-setting draws. User spells in IndexedDB.
- PWA cache for app shell and bundled quests. Works in airplane mode.
- Screen wake lock during play (the tablet should not sleep at the table).

---

## 8. Encoding the 14 official quests

The notes are in the PDF text layer; the maps are images. Pipeline in `tools/quest-import/`:

1. **Render** each quest map page at 300 dpi (pdftoppm, already available on the dev machine).
2. **Grid detection**: find the map frame, split into 26 x 19 cells (the frame is a fixed size on every page, so a single calibration works for all 14).
3. **Rock detection**: mean color per cell (dark red = rock). Very reliable.
4. **Symbol detection**: template matching per cell for monsters, furniture, stairs, traps, doors on cell edges, blocks, letters. Templates cut from the "Design Your Own Quest" legend page.
5. **Draft JSON** with a confidence score per element.
6. **Manual pass**: Claude reads the 300 dpi map image and fixes the draft cell by cell; low confidence elements are checked first.
7. **Notes**: paraphrase each note into the effect model (letters and triggers from section 4.3).
8. **Verification**: Playwright renders the quest JSON on top of the scan (editor underlay) and saves side-by-side images per quest. Last check: a 5 minute review by you in the editor.
9. **Tests**: a scripted walk-through per quest (open doors in a fixed order, assert revealed monsters, notes fired, objectives).

Steps 1 to 5 can be skipped if template matching is unreliable; then step 6 does the work from images, and step 8 still verifies.

---

## 9. Milestones

| # | Milestone | Content | Done when |
|---|---|---|---|
| M0 | Setup and board | Vite, TS, lint, Vitest, Playwright, PWA shell; `board.json` from the blank map; SVG renderer | Board renders with rooms and walls matching the scan overlay |
| M1 | Engine core | quest schema, game reducer, event log, undo, line of sight, area reveal, doors | Unit tests for line of sight cases from the rulebook diagram and door reveal |
| M2 | Play loop v1 | quest/team setup, play screen, fog, open door, look from, monster roster, damage/kill | Quest 1 playable without notes |
| M3 | Searches and traps | treasure, secret doors, wandering monster, house-rule traps | Q1 to Q3 search flows pass tests |
| M4 | Notes engine | triggers, conditions, effects, markers, objectives, NPC, end quest | Q2 alarm, Q5 gargoyle, Q11 bounty pass tests (bounty shown as text, not tracked) |
| M5 | Zargon turn | profiles, priority list, plans, spells, special rules, detailed mode | AI tests per profile; table test of one quest |
| M6 | Editor | tools, inspector, note builder, underlay, validation, playtest, import/export | Quest 1 recreated in the editor equals the bundled file |
| M7 | 14 quests | import pipeline + manual pass + verification + walk-through tests | All 14 validate, overlays reviewed, walk-throughs green |
| M8 | Polish | final UI design (section 10), animations, wake lock, resume, settings, accessibility | Full campaign session on a tablet |
| M9 | Pack layer | core as a pack, pack manifest and loader, campaign / one-shot, campaign settings, free team list (heroes, mercenaries, animal allies) with warnings, targets incl. NPCs, settings (Rule hints) | Core quests run from the core pack; campaign resume works |
| M10 | Frozen Horror | schema additions (4.2), edge doors, room tiles, area merge, terrain, sight blockers, large monsters, hazards and decoys, multi-map quests, tunnels, note questions, new profiles, spell tags, Raiment, Q0 + 10 quests encoded | All 11 validate, walk-throughs green, Q9-10 crossing tests |

Suggested order is as listed. M6 comes before M7 because the editor underlay is the verification tool for the quests. The spell tags and the 25% rule (decisions 47, 48) can land in the core Zargon code before M9.

---

## 10. UI concept

Process: the `oil-ui` skill. Three directions were rendered (`design/explore/style-explorer.html`); **A · Quest Book Map was chosen**. Full play screen prototype: `design/play-a/index.html`, design note `design/play-a/DESIGN.md`. Fonts in the prototype are TeX Gyre Bonum / Pagella (offline replacements).

**Category and benchmarks.** Tabletop companion app used on a tablet next to a physical board, mostly in landscape, at arm's length, in evening light. Benchmarks: the Hasbro HeroQuest companion app, Descent: Legends of the Dark, Mansions of Madness 2e app, X-haven Assistant (Gloomhaven), Foundry VTT fog of war. *Not viewed as images in this pass, from memory; fonts, colors and main visual of each direction are to be verified.*

- **Baseline to keep**: the map is the main object; monsters as tokens on the map; one-tap actions on map objects; a clear "monsters' turn" phase.
- **Category habits to drop**: 3D camera and narration that pull eyes from the table (Hasbro app); full screen modals for every event; ornate fantasy chrome around every panel.

**Tone** (from "less invasive, focus on the board", play at night, fantasy game): energy quiet, finish refined, density medium, weight medium-light, seriousness grave but warm.

**First screen (shared by all directions).** The player comes to see "what can my heroes see now" and to tap the next door. Board fills the screen; one top line (quest, turn, Zargon's turn button, undo); a slim monster rail on the right; actions appear in a small sheet next to the tapped object. Zargon's turn is the only full-height panel.

### Direction A: "Quest Book Map"

- **North star**: the app is Zargon's own quest map, coming alive page by page.
- **Engine**: another medium, the printed quest map of the book (bone paper, red-rock hatching, line icons).
- **Font**: IM Fell English SC for titles, Source Serif 4 for text, IBM Plex Mono for numbers.
- **Color**: paper `#EFE6D2`, rock `#6E1F2A`, ink `#2B1D17`, selected `#D9C49A`, disabled `#B9AE98`. From the quest book itself.
- **Main visual**: unexplored = rock hatching; reveal spreads like ink wash from the door.
- **Controls**: square, 1.5px ink outlines, stamp-like press.
- **Risk**: bright paper is glare at night; very close to the book look.

### Direction B: "Lantern" (recommended)

- **North star**: only what the lantern touches exists.
- **Engine**: a concrete scene, a dark table in the evening, one lantern held up at a doorway.
- **Font**: Alegreya SC for titles, Alegreya Sans for text, Alegreya Sans tabular figures for numbers.
- **Color**: night `#14110F`, stone `#2A2421`, lantern `#E8A23A`, blood `#C8452F` (monsters, damage), selected `#3A2F22`, disabled `#5A514B`. Light comes from the fog-of-war mechanic itself.
- **Main visual**: unexplored is pure black; explored floor is warm grey; the area in current sight has a soft lantern glow. Opening a door: light spills from the door into the room in 400 ms.
- **Controls**: 10px radius, no outlines, glow on press.
- **Why recommended**: dark screen does not compete with the board on the table; the core mechanic (sight) is the visual language; strongest memorable moment (the door reveal).

### Direction C: "Field Slate"

- **North star**: a tactical plan, readable from one meter, zero decoration; the fantasy lives on the board.
- **Engine**: break the category habit; architect's plan / transit map instead of fantasy dress.
- **Font**: IBM Plex Sans Condensed for labels, IBM Plex Mono for codes and numbers (monsters as `G1`, `O2`).
- **Color**: slate `#1F2A2E`, chalk `#E9EEF0`, signal `#FF5A3C` (monsters only), selected `#2F3F45`, disabled `#56656B`.
- **Main visual**: thin chalk lines for walls, dotted unexplored grid, monsters as signal-orange letter tokens; Zargon's turn as a numbered order list.
- **Controls**: 2px radius, 1px chalk outline, invert on press.
- **Risk**: least atmosphere; best legibility.

---

## 11. Decisions

1. Failed jump or failed disarm: the trap springs with the normal rules of its type.
2. Hero Body Points: not tracked.
3. Zargon assistant: one monster at a time in a dialog. Target rules are dynamic and always come with a tie list (`docs/ZARGON_AI.md`).
4. Gold, equipment, artifacts between quests: not tracked.
5. UI direction: **A · Quest Book Map**. Prototype and design note in `design/play-a/`.
6. Wandering monster placement card, quest note letters on the map, "Look from here" eye hints.
7. Quest packs, Frozen Horror and its prelude, the minimum-tracking principle (decisions 36 to 63). Full list: `docs/DECISIONS.md`.

Development harness for Claude Code: `CLAUDE.md`, `docs/BACKLOG.md`, `.claude/agents/`, `.claude/commands/`.

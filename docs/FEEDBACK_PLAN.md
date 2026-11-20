# Playtest feedback: review, design and plan (2026-11-16)

Status: owner answered section 6 on 2026-11-16 (decision 66; question 7 open). Before that, nothing here changed the quest format or the rules until the owner answers the questions in section 6. Straightforward fixes are listed in section 5 and can start at once.

Owner notes covered: the playtest list of 2026-11-16 (general, quests 2 to 13, editor image) and the review brief (status, player experience, quest actions, monsters, traps, map).

## 1. Where we are today

- M0 to M6 are done. All 14 quests are encoded and have walk-through tests. **Owner review has not happened for any quest** (the status table keeps that column empty on purpose).
- README and the M1 follow-up line in the backlog were stale. Both are updated. Of the M1 follow-ups, only the `revealRoom` test for a door touched only by a block is still open.
- Frozen Horror (M10) and the pack layer (M9) are plans only. Nothing in the code depends on them.
- Open polish items (M8) still stand: editor storage feedback (`stored` false note, store errors on the start screen), focus handling in dialogs, 44 px editor chips, visible focus on the import button. None needs a decision. They are quick fixes that go into the next UI batch.

## 2. What exists today (so the proposals below are concrete)

- **Notes** have a trigger (door opened, area revealed, treasure search, square entered, monster killed, manual, ...), optional conditions and a list of effects (show text, give item, reveal, place monster, set flag, complete objective, ask a question, ...). A lettered note draws its letter on the map after it fires.
- **Quest actions** (sidebar) are the notes with the `manual` trigger: buttons for things the app cannot see, such as "a hero stands on the stairs" or "the chests are on the stairs". They are separate from **End the quest** (stairs, all heroes fell, and now custom endings like "Sir Ragnar died"). A manual note never ends the quest by itself. It can complete an objective, and the end screen then reports the goal as done.
- **Markers** are labels on squares (`X`, `XX`, numbers, `Cell`). `visible: "zargon"` means a placement marker the players never see; `visible: "players"` is drawn on the board. With no Zargon player, the first kind is only useful as an internal anchor for "place a monster here".
- **Objectives** are a list of text lines. They are completed by a note effect (`completeObjective`) or by a `done` rule (`monsterKilled`, `allKilled`). So a manual quest goal needs a note today.

## 3. Proposed design

### 3.1 Player-facing messages
- One **message sheet** (modal, board dimmed but still visible behind it) for every triggered text. Dismiss with one tap.
- A persistent **Journal** (already exists) becomes the log of everything that happened: notes read, doors, searches, traps, monsters added, deaths. Each entry can be tapped to read the note again. Rewards and items are listed once, in the journal and on the end screen, never repeated inside the note text.
- A **Quest** button on the board header opens the quest sheet: start instruction, current objective, notes read so far, quest actions. The right column then shrinks to heroes, roster and the next step, which removes most of the scrolling.
- The quest start shows a **start sheet** with the placement instruction (for example where to put the heroes) before the first move.
- Remove every Zargon-only spoiler: `zargonInfo` is no longer shown. The field stays in the format for now (internal comments and the editor), and the editor labels it "Author notes, never shown".

### 3.2 Actions attached to quest elements
Today every note has either a trigger on a game event or sits at a square. Proposal: an **action** is a note whose trigger names an element, so the author works from the element.
- In the editor, selecting a door, furniture, monster, trap or marker shows an **Actions** section in the inspector with "Add action". The action is a normal note under the hood (same format, same engine). So this needs **no format change**, only an editor change: the inspector creates the note with the right trigger prefilled (`doorOpened`, `furnitureSearched`, `monsterKilled`, `monsterSeen`, `squareEntered`) and lists the notes that point at the selected element.
- The note builder keeps the list view for notes that have no element (quest start, counters, Zargon turn).
- Square and area triggers stay for quest events tied to a place. They get a visible marker only when the author sets a letter.
- Needs a small format addition: a `monsterSeen` trigger (a monster was revealed). Needed for quest 7 note A and useful for special monsters.
- **Objectives with their own triggers.** Extend an objective with an optional `done` rule list using the same trigger and condition vocabulary (door opened, monster killed, area entered, flag set, manual button). A manual goal then creates its own button, so no helper note is needed. This is a format addition, backward compatible (`done` already exists).

### 3.3 Quest actions and ending
- Rename the sidebar block to **Things to confirm** and show each button with a one-line hint of what it does ("Confirm: all heroes left by the stairs"). A button never ends the quest. Ending stays in a separate, clearly marked **End the quest** menu (stairs, all fell, custom endings).
- A button only appears when its note's conditions hold (for example the stairs room is revealed). Quest 6 and 7 need this condition on manual triggers.
- Keep movement, dice and judgment with the players: every rule-driven effect is shown as a prompt to confirm, never enforced.

### 3.4 Monsters
- **Special monsters** get a visible mark (ring and a small star on the token, and a star in the roster) when the quest says so (`special: true`, or named monsters like Ulag, Grak, Gulthor, Balur, the Witch Lord). A regular monster with an extra ability is not special.
- **Abilities** are reusable data: `{ id, name, short text }` in a small library (stone: extra defend die, fire immunity, only X harms it, moves 1, shoots, ...). A monster lists ability ids. They show in the monster tooltip and the roster detail. Weaknesses and immunities are abilities with a tag. Quests can add custom abilities (editor: ability builder, like the spell builder).
- **Tooltips** on tokens and roster rows: name, stats, special flag, abilities, spells. Tap on touch, hover on desktop, focus on keyboard (same pattern as furniture names).
- **Behavior**: `state` already covers active, dormant and stone. Add `waitsFor` (a condition or note id) and `goal` (a target: hero, square, door) as text prompts in the order list, not as movement the app does.
- **Spellcasters** keep the spell list, limit and situation tags (decisions 47, 48). No change.
- **Remove slain monsters** from the right list (fix, see section 5). The journal keeps the kill.

### 3.5 Adding monsters during play
- A **Add monster** button in the roster header: pick type (and optional name), then choose placement text ("next to the caster") and the monster joins the roster without a square (same rule as the wandering monster, decision 33). It is marked **New** (highlight ring on the roster row for one round and a toast) until the players activate it once. Spells that summon monsters can offer the button as a follow-up prompt.
- When anything is added to the map or the roster (monster, block, door found, trap sprung), it gets a brief highlight pulse (respecting reduced motion).

### 3.6 Reveal layout without contents
- A **Show room** tool: tap any room or corridor square on the board. The area's floor and walls are drawn dimmed ("layout only") without furniture, monsters, traps or doors that are still hidden. Opening a door or seeing it later reveals the contents as usual.
- If the tapped square is rock, show a message ("That is solid rock, nothing to show").
- Spells that reveal a room can use the same tool. Players decide when to use it; the app does not check spells.
- Engine: a new event `SHOW_LAYOUT { area }` stored in state as `seenLayout`. Pure, tested. The renderer treats it as a third level between fog and revealed.

### 3.7 Traps and blocks
- Traps get an optional custom `effect` text that replaces the standard text (exists), plus an optional symbol id from a small set of icons (new, data only). Scripted traps are not shown as "?" (they are quest events): quest 12 square C becomes a plain action.
- **Double blocks in wide corridors**: the board already supports 2-square blocks. Review the 14 quests for wide corridors and use `addBlock` with two cells where the map shows one wide block. List for the owner to confirm, since this changes the look only.

### 3.8 Owner/admin editing of bundled quests
- An **Admin** switch in the editor (stored in the browser, off by default) that lets the owner open a bundled quest and save changes straight back to its JSON file. A browser cannot write into the repo by itself, so the proposal is: edit in the app, then **Export** replaces the bundled file via the dev server (`npm run dev` only) with a small save endpoint, or the owner copies the exported file. Needs a decision (section 6).

## 4. Implementation plan (in order, each ends green with tests and a commit)

1. **Docs and small fixes** (done or quick): README, backlog reconciliation, M8 editor polish items, remove slain monsters from the roster, trap and "look from here" icons: make the trap hit area win when both overlap (quest 3).
2. **Quest data pass** from the playtest notes (data only plus tests): quests 2, 3, 5, 6, 7, 8, 9, 10, 12 as listed in section 5, remove spoiler text and rewards repeats, add the start instruction to every quest.
3. **Engine/format small additions**: `monsterSeen` trigger, manual-trigger conditions, `allSeenKilled` objective rule, rock-door exception for `doorTeleport`, throne next to a secret door, objectives with their own `done` triggers.
4. **UI: messages and journal**: message sheet, Quest sheet, start sheet, journal as full log, less scrolling.
5. **UI: monsters**: special mark, tooltips, abilities (data, tooltip, editor builder), Add monster button and New highlight.
6. **UI: map**: Show room (layout only), highlight on add, double blocks, trap hit-area fix.
7. **Editor**: actions on elements (inspector section), objective triggers, ability builder, author-notes label, admin editing.
8. **Owner review round**: with the quest overlays, one quest at a time. Only then the status table gets "owner review: done".

Engine changes in steps 3 and 6 follow `CLAUDE.md` (pure, tests with every change, ASCII-map tests for reveal). Steps 4 to 7 follow Direction A and update `design/play-a/DESIGN.md` first when a pattern is missing.

## 5. Playtest notes: what each means and the fix

| Note | Fix | Kind |
|---|---|---|
| General: no Zargon spoilers | stop showing `zargonInfo`, strip spoiler text from notes | data + UI |
| Quest start note | add a `questStart` note to every quest with the placement text | data |
| Notes repeat rewards | remove repeated item and reward sentences | data |
| Special monsters visual, tooltips | section 3.4 | UI |
| Admin editing | section 3.8 | decision |
| Remove slain from roster | filter dead monsters in the roster list | UI fix |
| Quest notes as button + pop-up | section 3.1 | UI |
| Less scrolling | section 3.1 | UI |
| Add monsters on the fly | section 3.5 | UI + small engine |
| Highlight additions | section 3.5 | UI |
| Double blocks | section 3.7 | data |
| Quest Action vs End the Quest | section 3.3 | UI |
| Reveal any room/corridor | section 3.6 | engine + UI |
| Q2 Ragnar helper | remove helper | data |
| Q3 trap vs look-from-here overlap | trap hit area wins | UI fix |
| Q3 Ulag info | covered by spoiler removal | data |
| Q5 note B | only "a statue of a gargoyle" in n-B | data |
| Q5 secret search near A | search text says nothing of the far side | data |
| Q5 throne missing | validator exception, draw throne, silent search | engine + data |
| Q6 stairs note too early | condition on the manual button | engine + data |
| Q6 Grak O3, extra O4 | owner chose "roster codes": recount orcs, fix code order | data/UI |
| Q6 and Q9 all heroes escape | manual label "all surviving heroes left by the stairs" | data |
| Q7 note A cover shown at start | trigger on `monsterSeen` / area reveal | engine + data |
| Q7 D5 label | owner chose "only the label": show the name Gargoyle | data/UI |
| Q7 note D alive check | remove the Wardoz condition | data |
| Q8 Balur / XX text | remove | data |
| Q10 door click shows next square | rock-door exception | engine + data |
| Q10 teleport text | owner chose "teleport rule text": short instruction only in play | data |
| Q11 goal | owner chose "seen monsters only": `allSeenKilled` | engine + data |
| Q12 square C | remove the trap, manual action + falling-rock note | data |
| Q13 | confirmed, no change | none |
| Editor image | fixed: errors in the align dialog were hidden behind it (commit 0029523). Please retest with your corner order | done |

## 6. Questions for the owner

1. **Admin editing of bundled quests** (3.8): dev-server save endpoint, or export and copy by hand?
2. **Format additions** (3.2): OK to add `monsterSeen`, conditions on manual triggers, and objectives with their own `done` triggers? All backward compatible, none needs a version bump.
3. **Abilities library** (3.4): OK to add a small data library of abilities, with quest-defined extras, and a `special` flag on monsters?
4. **Show room** (3.6): should layout-only reveal be a free tool for the players at any time, or only offered after a quest note or spell prompt?
5. **Add monster** (3.5): monsters added mid-game join the roster without a square (like the wandering monster). Is that enough, or should the app track where they are? (CLAUDE.md says no positions.)
6. **Zargon field**: keep `zargonInfo` in the format as "author notes", or remove it from all quests?
7. **Markers**: drop the `zargon` visibility (placement markers) and replace it with a plain "internal anchor" flag, or keep as is?

## 7. Owner answers (decision 66)

1. Admin edit of bundled quests: edit the original, keep it as a draft until the owner replaces the bundled file.
2. to 3. Yes.
4. Show room: free tool with a warning.
5. Added and wandering monsters: players give a square (supersedes decision 33 for these monsters).
6. `zargonInfo`: remove it.
7. Markers: editor-only visibility (done, decision 66). Old text: Zargon markers are used in quests 2, 8 (two) and 12 and 14 (one each) as "place the monster here" anchors, never drawn to players. Proposal: drop the word Zargon, keep them as internal anchors with no `visible` field (players never see them), and use `visible: players` only for drawn labels.

## 8. Status 2026-11-21 (play side audit)

Checked by reading the code, the tests and the app (Playwright). "Done" names the file or test that shows it.

| Step and item | Status | Evidence |
|---|---|---|
| 2. Start note in every quest | done | start sheet "Start" (`tests/e2e/helpers.ts` closes it in every e2e), `startTexts` in `QuestSheet` |
| 2. Spoilers, repeated rewards, Q2, Q3, Q5, Q6, Q7 D, Q8, Q9, Q12 text fixes | done | backlog list in step 2, quest walk-through tests `src/content/quests/qNN.test.ts` |
| 2. Q5 throne, Q7 note A (`monsterSeen`), Q11 goal (`allSeenKilled`) | done | `schema.ts`, `q11.test.ts`, `notes.test.ts` (monsterSeen), validator exception for a throne on a secret door |
| 2. Q10 doors never open (repeatable button, no reveal), gold note after every ending | done | `q10.test.ts` |
| 2. Q6 roster codes, Q7 D5 is a Gargoyle | done | Gargoyle in `q07-*.json`; codes in `monsterCodes.ts` |
| 2. Q9 note B chests | no change by decision (one search gives both chests) | backlog |
| 3. `monsterSeen`, conditions on manual triggers, objective `done` and `confirm`, rock-door exception (`doorTeleport`) | done | `notes.test.ts`, `noteView.ts`, Q10 |
| 3. Wide-corridor double blocks (data pass) | partly | 2-square blocks exist in 17 quests (`blocks` with 2 cells). Whether each wide block on each map is a double block needs the overlay with the owner |
| 4. Message sheet for every triggered text | done | `sheetsOf` (`promptToasts.ts`), notes, goals and monster placement are sheets; the rest are toasts with "More" |
| 4. Start sheet | done | "Start" dialog, `questsheet.spec.ts` |
| 4. Quest sheet (intro, start text, goal, actions, notes read) | done | `QuestSheet.tsx`, `questsheet.spec.ts` |
| 4. Journal as the full log, entries can be read again | done for notes; other lines are one-line facts | `eventLog` in `log.ts` (`log.test.ts`); note lines re-open the note |
| 4. Less scrolling | done | quest sheet takes goal, notes and log off the right column |
| 4. "Things to confirm" apart from "End the quest" | done in another form | owner chose confirm buttons under their objective in Quest info; End quest is its own header chip. No block called "Things to confirm" |
| 5. Special flag, abilities, tooltips, margin note | done | `monsterTip.ts`, `abilities.ts` |
| 5. Behavior prompts, `questEnds` trigger, Add monster with a square | done | decision 71, `addMonster.test.ts`, `play.spec.ts` |
| 5b. Added and wandering monsters: square, drawn, can be slain, acts on Zargon's turn, shown as new | done | `addMonster.test.ts`, `wandererEnemy.test.ts`, roster `new` class |
| 6. Show room (layout only, warning, rock message) | done now | `layout.ts`, `layout.test.ts`, `tests/e2e/showroom.spec.ts` |
| 6. Highlight on additions | done now (monsters before; blocks and secret doors added) | `additions.ts`, `additions.test.ts`, `PlayScreen` highlight |
| 6. Trap hit area wins over "Look from here" | done | no eye on a trap square (`occupiedCells` has `trapAt`), trap hit rects sit above square hits in `PlayBoard.tsx` |
| 6. Double blocks | see step 3 row | owner overlay check |
| Notes refactor, engine slice 1, targets, zones, `questEnds` | done | `NOTES_REFACTOR.md`, `targets.test.ts`, `zones.test.ts` |
| Notes refactor: light veil, furniture that is not a chest as an element, element taps for manual notes (Q12 doors, square C), element detail sheet, a "quest ends" trigger | not done | see 8.2 |

### 8.1 Translation leftovers (decision 92) done in this pass

Through `t()` or `tr()` now: the journal log (`engine/game/log.ts`), goal and tile sentences (`noteView.ts`, `tiles.ts`), Zargon plan and note texts (`engine/zargon/texts.ts`, `orders.ts`), the trap, wandering, tooltip, toast and store messages (`ui/play/texts.ts`, `promptToasts.ts`, `monsterTip.ts`, `zargonView.ts`, `ui/store/gameStore.ts`), refused events (`ui/play/errorTexts.ts`, a text per code, the engine message is the fallback). The bold in the dwarf note is back (`rich()` reads `<b>` marks, `ui/shared/rich.tsx`). Placeholders in the play, select and pack screens have real names (no `{v1}` left outside the editor and Designer). Left: the 96 engine error messages are developer text (only the codes players can reach have a player text), and the Zargon rule and plan tables are translated by the data layer, not by code.

### 8.2 Proposal for the notes refactor (not built)

What exists: notes with triggers, a `target` field (door, room, furniture, monster, trap, marker, zone, square), "For this quest" in the margin notes, objective `confirm`, zones, and the editor's Actions tab with the action popup. So the data model of section 3.2 is mostly there.

Smallest next step: make every element tap show its actions in one place. In play, the tap on a closed door, a monster, a trap or a marker already shows "For this quest". The gap is the `manual` notes without a target that need an element (Q12 doors and square C). Move those 7 manual notes onto their elements with `target`, show them in the element's margin note, and keep only the truly quest-wide buttons in the Quest sheet. No format change, only data and a check in the validator ("a manual note with an element name needs a target"). Owner decision needed before it: should a quest-wide button also be allowed on the title band (for example "All heroes left by the stairs")?

### 8.3 Needs the owner

1. Double blocks: overlay check, one quest at a time, to say which wide corridors need a 2-square block.
2. "Things to confirm" block: the owner chose confirm buttons under the objective. Say if that closes the item.
3. Show room on a corridor draws the corridor squares in sight of the tapped square (rule interpretation): confirm.
4. Show room on a room drawn dimmed even if a door of it is open but the room was not revealed: it cannot happen (opening reveals), so no rule needed.

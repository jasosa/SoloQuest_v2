# Notes system refactor: quest elements, actions, objectives (proposal)

Status: approved by the owner (decision 67). Nothing here is built yet. Related backlog items: "Refactor the notes system around quest elements" and "Rework the Quest actions block" (M7b). Related plan: `FEEDBACK_PLAN.md` sections 3.2 and 3.3, decision 66.

## 1. What we have today (facts from the code and the 14 quests)

- A **note** = `trigger` + optional `when` conditions + `effects` + optional `letter` and `at` (the letter drawn on the map after it fires). 89 notes in the 14 quests.
- Trigger use today: treasure search 26, door opened 14, quest start 14, area revealed 9, square entered 8, manual 7, monster killed 4, spell cast 2, secret door search 2, trap sprung 1, trap disarmed 1, area entered 1.
- Effect use today: show text 75, give item 24, prompt choice 10, complete objective 8, set flag 7, place monster 5, set monster state 4, and a few single uses (reveal all, open all doors, spawn NPC, add secret door, place block).
- **Most triggers already name an element** (a door, a trap, a monster, a room). So the data is not far from "actions on elements". The real problems are elsewhere:
  1. **Authoring**: the editor lists notes in one flat list. To add "when this door opens, show this" you go to the notes panel and pick the door from a dropdown.
  2. **Play**: buttons for things the app cannot see (`manual`) sit in one "Quest actions" block of the side panel, away from the thing they are about. Players do not know what a button belongs to.
  3. **Objectives** that are not "monster X killed" need a helper note that sets a flag or completes the objective.
  4. **Dangling links**: deleting a door leaves notes that point at it (the editor warns, but it is easy to miss).
  5. **Square triggers** are drawn as a neutral dashed marker with no label, so it is unclear what they are.

## 2. Goals (from the owner's feedback)

- An action belongs to the thing it is about: a door, furniture, monster, trap, marker or room.
- Players tap the element to see its details and the actions that exist for it. No separate Quest actions block.
- Square and room triggers stay, with a marker that says what it is.
- Objectives have their own conditions, no helper note.
- Quest actions never end the quest. Ending stays a separate menu.
- Messages are one sheet and one log, and can be re-read.
- Rule-driven effects are prompts to confirm. The app does not enforce movement, dice, combat.
- Most of it must be editable in the editor.

## 3. Proposed model

### 3.1 Elements and events

Every element kind has a small fixed list of **events** an action can listen to.

| Element | Events |
|---|---|
| Door | opened, seen |
| Secret door | found |
| Furniture (chest, bookcase, ...) | seen, searched (treasure), tapped |
| Monster | seen, killed, spell cast, tapped |
| Trap | seen, sprung, disarmed |
| Marker or square | entered (a hero is here), tapped |
| Room or corridor | revealed, entered, searched for treasure, searched for secret doors |
| Quest | started, Zargon turn n, objective done |

`tapped` is the new one. In the data it keeps the stored name `manual` (a rename would change nothing in behavior); a `manual` note with a `target` is a tapped action of that element, and one without a target shows in the Quest sheet. It means: the players tap the element and press a labelled button. It replaces `manual` and the Quest actions block. The button label is the paraphrased action ("The last hero has crossed this square").

An **action** is: `{ id, on: event, when?: conditions, effects, letter? }`. Same effects and conditions as today. Nothing about effects changes.

### 3.2 Where actions are stored: two options

**Option A: keep the flat `notes` list and add a `target`** (recommended).
- A note gains `target: { kind: 'door' | 'furniture' | 'monster' | 'trap' | 'marker' | 'area', id }`. The trigger types stay as they are, plus `tapped`. The engine, reducer and all 14 quests keep working. The target is derived from the trigger when missing, so no migration of the quest files is needed for the 14 quests.
- The editor and the play screen group notes by target. Deleting an element offers to delete or detach its notes (the validator already finds dangling ones).
- Cost: small. Risk: low. No `schemaVersion` bump.

**Option B: nest `actions` inside each element** (`door.actions`, `monster.actions`, `furniture.actions`, `areas.R12.actions`, `quest.actions`).
- Deleting or copying an element takes its actions with it. The JSON reads as "this door does this".
- Needs `schemaVersion` 2 and a migration step for all quests (the migration hook already exists in `migrate.ts`), a flatten step at load so the engine stays unchanged, and a rewrite of the editor note model and `refs.ts`.
- Cost: medium to large. Risk: medium. Gain over A: mostly tidiness of the file and of copy/delete. Rooms are not entities in the quest file today, so they would need a new `areas` map just to hold actions.

Recommendation: **A now**, and revisit B only if the editor grouping in A turns out not to be enough. Both give the player and the author the same experience.

### 3.3 Objectives with their own conditions

An objective is `{ id, text, done?, confirm? }`:
- `done` is a rule evaluated after every event, using the same vocabulary as conditions: monster killed, all of some killed, all seen killed (done), flag set, counter at least n, room revealed, door opened, monster seen.
- `confirm: "label"` creates a button for the objective itself in the Quest sheet (for example "All surviving heroes have left by the stairs"). No helper note.
- Existing `done` forms keep working. This is backward compatible, like `allSeenKilled`.

### 3.4 Conditions

Add the missing ones so data does not need silent flag notes (quest 6, 8 and 9 have them today): room revealed, door opened, monster seen, trap state. Backward compatible.

### 3.5 What the player sees

- **Tap an element**: a detail sheet with its name, what the app can say about it (monster stats, special mark, abilities), the notes already read for it, and its buttons ("tapped" actions that are available now). Same sheet pattern as the margin note and the NoteCard.
- **Square and room triggers**: a visible marker with the letter of its note, dashed until used. Tapping asks the same question as today ("A hero is here?").
- **Quest sheet** (a button in the header): start instruction, current objectives (with their confirm buttons), journal. Details live here, not on the board.
- **Messages**: every triggered text opens in the message sheet and is kept in the journal; tap an entry to re-read it. Rewards are listed once.
- **End the quest** is its own menu, and no action can open it.
- The side panel keeps: heroes, companions, monsters in play, Zargon's turn. The Quest actions block goes away.

### 3.6 Editor

- Select an element on the board, and the inspector shows an **Actions** section: the list of actions on it and "Add action". The new action has its event prefilled from a short list (the element's events above).
- Selecting a room shows its actions (revealed, entered, searched).
- Quest-level actions (start, Zargon turn) and objectives stay in the quest panel.
- The existing flat notes panel remains as an overview ("all actions"), grouped by element.

## 4. Existing markers

- **Editor-only marker** (`editor`, decision 66): an anchor for "place the monster here". Players never see it.
- **Player marker** (`players`): a label drawn on the board. Stays useful for numbered squares (quest 10 teleport squares) and for tap targets without a furniture piece (quest 12 square C).
- **Square trigger marker**: derived, not stored. See 3.5.

## 5. Migration and order of work

1. Add `target` (derived), `tapped`, the extra conditions and objective `done`/`confirm` to the schema and engine, with tests. No quest file changes needed.
2. Move the 7 `manual` notes (quests 6, 7, 9, 12 and others) to `tapped` on their element, one quest at a time, with the walk-through tests.
3. Play UI: element detail sheet, Quest sheet, remove the Quest actions block, message sheet and journal. Update `design/play-a/DESIGN.md` first for the new sheets.
4. Editor: Actions section in the inspector, objective editor.
5. Owner review with the overlays.

Steps 1 and 2 are engine and data. Steps 3 and 4 are UI. Each step ends green (typecheck, tests, validate) and is committed alone.

## 6. Decisions (owner, 2026-11-16, decision 67)

1. Option A (a `target` on flat notes). Option B (nesting) can come later by migration.
2. `tapped` buttons live on their element, and also in the Quest sheet for actions with no element.
3. Rooms are tapped by a small room label.
4. Objective confirm buttons are in the Quest sheet only.
5. Every rule-driven effect is a prompt to confirm. No enforcement.

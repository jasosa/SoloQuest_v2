# Play screen · design note (Direction A, Quest Book Map)

**User and setting.** 1 to 4 players at the physical board, one tablet in landscape (1194 x 834) next to it. The app is Zargon's map: it shows what the heroes can see and gives the monsters their orders. It does not track hero or monster positions, Body Points, gold or equipment.

**North star.** Zargon's own quest map, coming alive as the heroes explore.

**Decisions (Nov 2026)**

- Failed jump: the trap springs with its normal rules (pit, falling block, spear roll, chest effect).
- No hero Body Point tracking. Monster targets use only hero class and monster type.
- No gold, equipment or artifact tracking between quests.

**Layout.** Title band (quest, turn, undo) · board 26 x 19 at 34 px a square · right column: goal, heroes, companions, monsters in play, wandering monster, Zargon's turn button. Notes read, objectives with their buttons and the log live in the Quest sheet (decision 67, see below).

**Interactions** (one tap on the map, then a margin note next to the object):

| Tap | Margin note |
|---|---|
| closed door | Open the door → reveal (room: whole room; corridor: line of sight) |
| corridor square | Look from here → line of sight reveal. Squares where looking can show more carry a small eye glyph (computed from the board geometry only, so rock is not leaked). |
| room | Search for treasure / secret doors → who searches → quest note or "Draw a treasure card" (+ wandering monster) |
| quest note letter | Notes already read leave their letter on the map where they happened (and in the right column); tap to read again |
| trap "?" | Jump / Disarm (Dwarf or tool kit) / Step onto it → enter the die result → type revealed |
| monster | stats, wound/heal if Body > 1, Slain |

Margin notes sit beside the object in the upper half of the map and above it in the lower half, so the explored area near the heroes stays visible.

**Wandering monster.** After "It was a wandering monster", a card tells the players to put the monster on a free square next to the searching hero; it attacks that hero at once and nobody else this round. If no square is free: put it in the room as close as possible, and it acts on Zargon's next turn. The monster is added to the list (not drawn on the map, its square is not known).

**Zargon's turn** is a sequence of cards, one monster at a time (see "Zargon's turn: one monster at a time" below). Each card has a target rule drawn every turn from weights that depend on the type, **always with a tie list**, plus a plan. Players use their character sheets to apply the rule. See `docs/ZARGON_AI.md`.

**Motion.**
1. Main action feedback: opening a door spreads the revealed area like ink from the door (650 ms, ease-out); new monster tokens stamp in (320 ms, 70 ms stagger); they slide into the roster.
2. State change with a source: margin note grows from the tapped object; Zargon cards rise in one after the other.
3. First entry: none beyond the margin note (the board is the content; no splash).
Reduced motion: everything lands at once.

**Tokens.** paper #EFE6D2 · floor #F7F2E8 · corridor #E4D8C2 · rock #B98A8F hatch · ink #6E1F2A · text #2B1D17 · muted #6D5A4E · monster green #3B6636 (darkened from #3F6B3A so it is 4.5:1 on paper-2) · selection #D9C49A (`--sel`), dialog veil rgba(43, 29, 23, 0.28) (`--veil`), text on ink #F4ECDD (`--on-ink`), secondary text on ink #E6CFC0 (`--on-ink-2`), token text #F2EBDD (`--token-text`), furniture and door paper #FFFFFF (`--white`), sprung pit tile #3B2A25 and #1E1411 (`--pit`, `--pit-deep`). Fonts: TeX Gyre Bonum Bold (titles, buttons), TeX Gyre Pagella (text). Controls: square corners, 2 px ink outline, offset shadow on notes, press = 2 px shift.

**Removed in the subtraction pass.** Hero Body list (not tracked anymore), explanatory line on the monster note, repeated orders for monsters of the same kind (grouped).

**Prototype limits.** Quest 1 data covers the south-west part only. One pit trap is placed on the south corridor only to show the trap flow; Quest 1 has no traps. Secret door search always finds nothing (true for Quest 1). Not reviewed by an independent reviewer; self-checked on screenshots and recordings.

## Quest and team select (added in M2)

Same shell as the play screen (title band, 920 px left area, right column). Left: 14 quest cards in a grid of five, 2 px ink outline, paper-3 fill; the chosen card takes the selection color (`--sel`) and the ink offset shadow; a quest that is not encoded is greyed out and says "Not encoded yet". Right column: quest title and summary, an optional "Saved game" box (turn, heroes, **Resume**), the four hero chips (toggle, 1 to 4), and one button at the bottom: "Start the quest", or "New game (replaces the saved one)" when a save exists. Roster: a slain monster leaves the list (the log keeps the kill). Toast: text on the dark ink-text bar, with an italic Undo for actions that can be undone (slain, end of turn).

## Notes engine (added in M4)

- **Note sheet**: centered card on a dim veil (prototype `.note`): letter chip, small caps kind, title, text, one button ("Continue"). Several notes from one event show one after the other. A choice (`promptChoice`) is the same card with one button per option and cannot be skipped.
- **Letters**: a note that was read leaves its letter (ink square, light letter) on the map at its square; tap to read again. The right column "Quest notes" lists the same notes (letter or a bullet, first sentence). Notes that were never read leave no trace.
- **Waiting notes**: a seen square with a `squareEntered` note shows a neutral dashed ring with a dot (tap: "Did a hero step here?" Yes / No). A revealed room with an `areaEntered` note shows a small arrow glyph at its top left, and its margin note gets "A hero enters". `manual` notes (buttons for things the app cannot see) are replaced by the element buttons and the Quest sheet (decision 67, see below).
- **Goal**: the right column lists the objectives with a tick box; when all are done: "Goal done. Bring the heroes back to the stairs." the goal line in the title band opens the end sheet (see "End flow" below), then the end card ("Quest complete" or "Quest over, goal not reached", objectives, rewards as text, "Back to the quests", "Undo the ending"). After the end the board is read-only (the card covers it); undo still works.
- **Companions**: an NPC is a row (name, then "Defend n · Body n" so the players can write the numbers down) above the monsters. The app does not track the Body Points.
- **Statues**: a dormant monster is drawn as a small statue figure (line art, ink on white), not in the roster, not tappable. When a note wakes it, it stamps in like any monster. A monster placed by a note shows its token on the named square, a margin note "Put X here" and a pulsing ring on the square. Roster lines: "Stone: n turns", "Placed by a quest note".

## Zargon's turn: one monster at a time (decision 34)

The page of the prototype is gone: no list, no grouping, no "Who can it reach?" mode. The button "Zargon's turn" (right column, "n monsters to act") starts a sequence of cards over the map, one monster per card, in reveal order: small caps "Monster 2 of 7", a letter chip with the monster code (same letters as the map tokens), the name, a stats line (Move, Att, Def, Body, Mind), then Target, Tie (always), Plan and Special rules. The card has no dim veil and sits in the empty upper right of the map, so the figures stay in sight: the monster's token gets the selection ring and its roster row is brought into view. A caster shows a boxed spell block: the one picked spell (name, "Read the Dread spell card.", "If it cannot cast: ..."), "Could it cast it?" with "Yes, it cast it" and "No". "Done" sends the order done and the next card rises in (instant with reduced motion). Stone monsters and fresh wanderers get a short card with "Next" (no event). After the last one: "All monsters have acted" with "End Zargon's turn" (no monsters: "No monster to act"). "Back to the map" or Esc closes only the top card; pressing the button again resumes at the first monster not done. If every hero fell the card says "All heroes have fallen" with "End quest".

## Heroes block (decision 32)

Right column, above the monsters: one square chip per hero of the team. A tap asks "<Hero> fell?" (margin note, "Yes, fell" or "No"). A fallen hero is struck through and cannot be tapped; undo takes it back. Nothing else about heroes is shown. When the last hero falls a card says "All heroes have fallen" with "End quest".

## Fit to the screen

Every screen is drawn at 1194 x 834 and scaled to the window (`FitToScreen`). Modes: the **play screen** is drawn at the size of the window (never smaller than 1000 x 600; below that the whole screen shrinks), so its text keeps its normal size; the map takes what the right column leaves and the **board is fitted to the map area** (as large as it can be, with 18 px of margin above and below: 100% of the zoom chips is the fitted size). The right column is 274 px on a tablet and grows to 420 px on a wide window; on a window wider than that the board and the column stay together in the middle, so there is no empty strip between them. Zooming goes up to 300% of the fitted size; **quest select, the editor and the Library** fill the width and the page scrolls down when the window is shorter, so nothing gets too small. The scale is at most 1.5 on a big screen. On the quest select the Start button sits right under the heroes and the story comes after it, so the button is high on the screen. Touch positions are converted back to the drawing size (the board zoom does it).

## Board zoom

The board zooms from 100% to 300%. Two fingers pinch (and drag the board while pinching), one finger drags the board when it is zoomed in (a drag never counts as a tap), and the wheel with Ctrl zooms on a computer. Three 44 px chips sit at the bottom left of the map, in a 56 px strip under the board on the play screen (so they never cover it): **−**, the percent (a tap goes back to 100%) and **+** (25% steps). Only the board scales: margin notes keep their size and follow the thing they point at, and the zoom chips stay put. Zoomed in, the board covers the map area; at 100% it is centered in it.

## Zoom on the editor map

The editor board has the same zoom chips (− , percent, +) at its bottom left, and 100% is the board fitted to its area. Two fingers pinch and move the board; the wheel moves it when zoomed in; Ctrl and the wheel zoom. A single finger or mouse drag never moves the board there, because on the editor board a drag moves furniture and monsters. A drag that moves the board never places or selects what is under it.

## Furniture names

Furniture has a tap area (its footprint). Hover or keyboard focus shows a small dark label with its name (Stairway, Table, Chest ...), drawn above the piece. A tap opens the room note headed by the name; a chest opens the chest note.

## Wandering monster card (decision 33)

After "It was a wandering monster" the card says: put the monster on a free square next to the <Hero>, it attacks that hero at once with n attack dice, nobody else this round. No choices.

## Editor (M6, slice 1)

Same shell and language as the play screen: paper, ink, square 2 px controls, Bonum for titles and buttons, margin-note style for hints. 1194 x 834 landscape, three columns under the title band.

**Title band.** "Editor" eyebrow, the quest title, then on the right: the issue counter ("2 problems", "1 warning", "No problems"; a tap shows the issue list in the inspector), Undo, Redo, "Save" (button), "Back" (links to the editor start screen; the draft is already saved). Issues are errors (block saving) and warnings.

**Superseded in part (decisions 104 and 105, section "Editor Map tab: tool options in the right card"):** the options of a tool and the element fields are in the right card, not under the chips; the Problems list opens from the title-band button.

**Tools column (left, 180 px).** One chip per tool, a single column, 44 px high, text only: Select, Rock, Doors, Blocks, Furniture, Monsters, Traps, Markers, Start. The active tool is the filled chip (`aria-pressed`). Under the chips: the options of the active tool (kind chips, a text field for the marker label, "Whole room" toggle for Rock) and a "Room ids" toggle. Shortcuts (ignored while typing in a field): S select, K rock, D doors, B blocks, F furniture, M monsters, T traps, L markers, H start, R rotate the selected furniture or the furniture being placed, Delete or Backspace delete the selection, Esc cancel, Ctrl+Z undo, Ctrl+Shift+Z or Ctrl+Y redo.

**Board (center).** The whole 26 x 19 board at 26 px a square, no fog: rock hatch, rooms and corridors, every door (closed look, secret doors dashed, false doors crossed), blocks, furniture line art, monster tokens (green coin with the type letter), traps as faint "?" triangles, markers as a small ink diamond with its first letter, the start room tinted `--sel`. The board takes keyboard focus: arrow keys move a dashed cursor square, Enter or Space acts like a click on it (Shift+arrow picks the edge for a door).
- *Hover*: the square under the pointer gets a thin ink outline; in the Doors tool the nearest edge is drawn as a thick ink bar.
- *Selection*: a `--sel` ring around the element (same pulse as play); the inspector shows it.
- *Select*: click an element (marker, monster, trap, furniture, block, door, in that order). Drag furniture or a monster to move it (a ghost follows, red if the move would fail). Delete key or the inspector "Delete".
- *Rock*: click a square to toggle it. With "Whole room" a click on a room toggles all of it.
- *Doors*: kind chips Normal, Secret, False. Click near the edge between two squares to add. Click an existing door to select it; the inspector changes its kind.
- *Blocks*: Single or Double. Double: click two touching squares. Click an existing block to select it.
- *Furniture*: type chips (the 12 types). Click places the piece with its first square (top left) on the clicked square; the footprint is shown as a ghost, `--sel` when it can be placed and red (`--ink` with a hatch) when the engine would refuse it, with the engine's reason in the hint line under the board. R turns the ghost.
- *Monsters*: type chips (9 types). Click a square to place.
- *Traps*: Pit, Falling block, Spear, Chest. Pit, falling block and spear go on a square. A chest trap goes on a chest: click the chest.
- *Markers*: label field, visible to Zargon or players. Click a square.
- *Start*: click a room: it becomes the start room.
- A failed change shows a toast with the engine's plain sentence and leaves the quest untouched. A change that leaves notes or objectives pointing at something shows a warning list under the board (dismissible).

**Inspector (right, 274 px).** Quest title and summary (saved when the field loses focus). With an element selected: its type and id, "Delete", "Rotate" for furniture, the kind chips for a door. Furniture: a Letter field (not for stairs). Monster: type chips, Name, State chips (Active, Dormant, Stone, Hidden), five stat fields (empty keeps the base, base shown as placeholder), spell chips with "One spell each turn", Traits (one per line). Trap: kind chips (with Scripted), a furniture list for chests or Across and Down fields for a square, Effect text. Text fields save when they lose focus, chips save at once, each is one undo step; a refused change shows the engine sentence as a toast and engine warnings show under the board. With nothing selected, after the title and summary: the issue list, each line a button that selects the element it names.

**Editor start screen.** The quest select layout: a list of your quests (title, number, last change, "Open", "Delete" with an inline "Delete it? Yes / No"), "New quest" (title and number), "Import file" (a `.hqquest.json` file; errors and warnings are listed, and a changed id is reported) and "Copy a bundled quest". It opens from the quest select screen with the link "Quest editor".

### Note builder (M6, slice 2)

The inspector has two tabs at the top, "Element" and "Notes" (the same chips as the tools; a small ink-outlined count on "Notes" is the number of letters on the map that have no note). Both tabs keep the 274 px column.

**Notes tab, list.** "Letters on the map with no note": one chip per letter, "Add note A", one tap adds the note and opens it. Under it the notes, lettered A..Z first, then the ones without a letter: a row of 44 px or more with the big Bonum letter, when it fires, and the first line of its text. "New note" adds one without a letter.

**Notes tab, one note.** "All notes" link, the id, then: Letter (one capital, never X), "Letter drawn at" (a square), Text, "No treasure card is drawn", and for a treasure search trigger "Searching here is not possible" (the search is not used, no card; it excludes the other chip: turning one on turns the other off). Sections "When it fires" (trigger dropdown and the fields of that trigger), "Only if" (condition rows) and "Then" (effect rows), then "Delete note". Each condition or effect is a row: paper-3 card with a 1.5 px ink border, its name in Bonum, a "Remove" chip, then its fields. A dropdown at the end of the list ("Add a condition", "Add an effect") adds a row at once. "Ask the players" holds answer cards, each with its own button label and effect list. Text fields save on blur, chips and dropdowns at once, every change is one undo step.

**Click it on the board.** Doors, squares and areas can be typed or picked: the button "Click it on the board" starts a pick. A margin-note style bar sticks to the top of the inspector with the instruction and "Cancel" (Esc also cancels), the board hint line repeats it, and the next board click is the answer (a click that does not fit says why in a toast and keeps waiting). Picking does not select or move anything.

**Note letters on the board.** Every lettered note shows its letter on the editor board in the play style (22 unit ink square, paper-colored Bonum letter, floor-colored outline). The square is the note's "Letter drawn at" square, else a corner (top right) of the furniture or marker that carries the letter. A letter on the map with no note yet is the same square in the missing style: white fill, dashed 2 px ink outline, ink letter. Unlettered notes show nothing. With the Select tool a tap on a letter opens the Notes tab: that note, or the list with "Add note A" when it is missing. The tap target is 44 units (about 34 px at the editor scale) on a note square and 18 units in the corner of a piece, so the piece itself can still be tapped. Other tools ignore the letters.

### Quest fields (objectives, wandering monster, rules)

The Element tab shows the quest fields whenever nothing is selected (below Title and Summary, under a hairline). Sections, each a "lbl" heading:

- **Objectives.** One row per objective (same paper-3 row as notes): the id in Bonum (`o1`, `o2`...) so a note can name it, a "Remove" chip, and a text area "What the heroes must do" (saves on blur, one undo step). A short note says an objective is completed by the note effect "Complete an objective" with that id. An objective with a done rule says it keeps it. "Add an objective" adds one with placeholder text, to edit. With none, a line says the quest needs one. Removing one that a note completes shows the usual warning list on the board.
- **Endings.** One row per custom ending (same paper-3 row): the id, a "Remove" chip, a "Label" field and a "Text for the players" text area (both save on blur, one undo step each; an empty label is refused). "Add an ending" adds one called "New ending". A short note says it shows in the End quest list and shows no reward.
- **Author notes.** There is no Zargon info field any more (decision 66).
- **Wandering monster.** Chips "None", "A monster" (then a monster dropdown), "Free text" (then a text field, which must not be empty).
- **Rules.** "Falling block rule" (text) and "No equipment until note" (dropdown of the notes). The door teleport rule is a pair of fields (see Rules panel below). There is no bounty rule: the players track it.

All targets are 44 px or more, all changes are engine edits.

### Import and export in the editor (M6)

Header links "Import" and "Export" (before "Save"). "Export" downloads `<title-slug>.hqquest.json` without `userText`; with errors it refuses with a toast that counts them, warnings do not block. "Import" opens a file and loads it as one undo step, keeping the draft's id. A **sheet** (paper-3, 2 px ink outline, offset shadow, centered over a dim backdrop, 200 ms rise) asks "Replace your draft?" with "Replace the draft" and "Keep my draft" when the draft is not blank, and lists import errors readably with a "Close" button.

### Reference image (M6, slice 3)

A local picture (a photo or scan of a map) to trace from. It stays on this device: in memory and, per quest id, in its own IndexedDB table. It is not part of the quest, so it is never in `.hqquest.json`, never in git and never uploaded.

**Tools column, "Reference image" block** (under "View"): "Load image" (file picker; a file dropped on the board works too), then once loaded "Change image", "Align corners" ("Align again" when set), "Hide image" or "Show image" (filled chip while shown), an "Opacity" slider (44 px high, ink accent) and "Clear image". A file that is not an image is refused with a toast.

**Align.** Loading opens a full screen page in paper, with a margin-note bar on top ("Tap the top left corner of the map frame. (1 of 4)"), zoom chips "Fit", "2x", "3x" (the page scrolls), "Undo point" and "Cancel". Four taps, in order top left, top right, bottom right, bottom left, on the corners of the map frame. Each tap leaves a numbered `--sel` dot. The fourth tap saves and closes. Points that do not make a convex four sided shape are refused with a toast and start again. The four points are mapped to the four corners of the 26 x 19 board with a perspective transform (`reference.ts`), so a tilted photo lines up.

**On the board.** The image is drawn over the board art at the chosen opacity (default 50%) and ignores the pointer, so every tool keeps working through it. Overlay rather than underlay: the squares are opaque, so an image below them would not show.

### Problems and playtest (M6, slice 3)

**Problems tab.** The inspector has a third tab, "Problems", with an ink-outlined count (all issues). The three tab chips share the 274 px column on one line (14 px text). The title band counter ("2 problems", "1 warning", "No problems") opens this tab. The tab lists every issue of the draft, errors first, then warnings, in the engine's order inside each group. A row is a 44 px or taller button: a bold Bonum word ("Problem" or "Warning"), the kind of thing it names in small italics ("Furniture", "Door", "Note", "Quest"), then the sentence. Under the heading, "(n to fix before saving)" counts the errors.

**Jump.** A tap on a row opens the thing it names. Doors, furniture, monsters, traps, markers and blocks are selected on the board and the Element tab opens so it can be fixed. A note opens in the Notes tab. An area is flashed on the board and the Problems tab stays. Objectives, helpers and the quest itself show the Element tab with nothing selected, so the quest fields (objectives and the rest) are in view. The board answers with a flash: an ink 3 px outline on the square (a `--sel` wash at 50% on every square of an area), pulsing like the selection ring, gone after 1.8 s. With reduced motion it stays still for the same time.

**Several maps.** A quest with more than one map shows the name of the map the heroes are on after the quest number in the small caps eyebrow ("Quest 9: The Upper Hall"), same style as before. After a crossing the board redraws on the other map and a toast says "The heroes are on <name> now." No new control or color.

**Playtest.** "Playtest" is a link in the title band, next to Undo. It is off while the draft has errors (the tooltip says why). It plays the draft in the real play screen with all four heroes, a new seed and a temporary game that is never written to the saves. The eyebrow says "Playtest". "Back to editor" replaces "Quests" in the title band and on the end screen, and the editor draft is exactly as it was.

**Zargon view.** In a playtest the title band has a "Zargon view" chip (filled when on, 44 px). It is a view option only: it draws what the heroes have not seen over the fog at 70% opacity (floor and walls of unseen rooms, blocks, every door with secret doors dashed and false doors crossed, furniture, traps as the "?" triangle with a letter P, F, S or C for the kind, markers, and unseen monsters as green coins with a dashed edge and the type letter). It is not tappable and changes no game state, no event and no roster.

## Custom endings and blocked searches (decisions 64 and 65)

**Endings in the end sheet.** The end sheet (see "End flow") lists one `btn alt` per custom ending of the quest (its label, for example "Sir Ragnar died") between the stairs button and "All heroes fell". A tap asks once, then ends the quest; "Undo the ending" on the end card brings it back.

**End card for a custom ending.** Title "Quest over" (never "Quest complete"), the ending label in bold, the ending text if there is one, then "The goal was done" or "The goal was not done" and the objective ticks. No rewards line. "Back to the quests" and "Undo the ending" as for the other endings.

**Blocked search.** When a treasure search meets a note that blocks it, the note card opens as for any quest note, with one extra line in the `extra` style: "The search was not used. The hero keeps the action." No card is drawn, no result sheet follows, and the hero is not greyed in "Who searches?".

## Quest sheet, element buttons and messages (decision 67)

Goal: the board stays the center, the side column stops growing, and every message and button has one clear home. Inspired by the focused overlays of Imperial Commander 2: a clear hierarchy, and sheets that leave the board readable around them. No new colors, fonts or control styles.

**Mockup.** Open `design/play-a/quest-sheet.html` (six clickable states: title band and side column, Quest sheet, element button, room label, message sheet, start sheet). Screenshots are in `design/play-a/shots/qs-*.png`. The mockup uses the quest 1 board with sample texts, so the content of the sheet is an example, not quest data.

**Title band.** Quest, turn, then a second line with the **current goal**: the first objective that is not done, in one line ("Goal: Find the Talisman of Lore"). Buttons on the right, all 44 px tall `btn alt` chips: Undo, **Quest info**, Settings. The goal line is a button that opens the end sheet; there is no End quest chip (see "End flow"). A small ink dot on the goal line means a confirm button is available now (an objective with `confirm` whose `confirmWhen` holds); the dot on Quest info means a loose Quest action is available.

**Side column (right), after the change.** Heroes, Companions, Monsters in play (alive only), the wandering monster line, the Zargon's turn button. No objectives list, no journal, no Quest actions block. Less scrolling: the list of monsters is the only part that can grow.

**Quest sheet.** Opens from the Quest chip. A panel that slides in from the right over the side column and the right 150 px of the board (420 px wide, paper-3 fill, 2 px ink outline on its left edge, offset shadow like `.note`). The rest of the board stays visible and untinted (no dim veil); tapping the board, Esc or "Close" closes it. Focus moves to the heading; Tab stays inside while it is open. Slide-in 220 ms with the ink ease; instant with reduced motion. Content, top to bottom, scrolling inside the panel only:

1. Header: small caps "Quest 5", the title, Close.
2. **About this quest**: the quest intro (the same summary as on the quest list), so the story can be read again in play.
3. **At the start**: the start instruction (the text of the `questStart` note), so it can be read again.
4. **Goal**: one row per objective with a tick box (same as today). Read only here: the ticks and the goal-done line. The confirm buttons moved to the end sheet (see "End flow").
5. **Quest actions** (only when it has rows): buttons of notes with no element (a `manual` note with no `target`), each with a one-line hint under the label. Nothing here ends the quest. **A button only shows while its conditions hold** (the room or square it is about is seen, a flag is set): it never appears before the players could need it. The same holds for element buttons and objective confirm buttons.
6. **Notes read**: letter chip or bullet, first sentence, tap to read again (the Quest sheet closes and the note opens alone; closing the note brings the Quest sheet back, so only one dialog is open at a time). Pressing any button in the sheet closes it too, so the message that follows is the only dialog.
7. **What happened**: the log, newest first, one line each with the turn number: door opened, room revealed, monster slain, trap sprung, search made, hero fell, note read, monster added. Tap a note line to read it again. The log is derived from the events, so undo removes the line.

**Segmented control** between 6 and 7 is not used: both lists are short headings in one scroll. If the log grows, "What happened" shows the last 12 with a "Show all" link.

**Margin note scopes (furniture).** Tapping a piece of furniture opens a note with up to three scopes, each under its own small caps heading and a hairline: the element, the room, this quest. See `furniture-room-quest-proposal.svg`.
1. **Element** (the top of the note): the furniture name as the small caps line, then the title **No actions** with one hint line ("This cupboard has no special action."). When the piece has quest buttons the title is **Actions** and the hint is left out.
2. **ROOM**: the small caps heading, the title **Search this room**, the hint "One hero, one search, on their own turn.", then the buttons Search for treasure and Search for secret doors (and "A hero enters" when it applies). Shown once, never repeated.
3. **FOR THIS QUEST**: the notes read and buttons of the furniture and of its room in one block. The letter chip sits at the top of its row, aligned with the first line of a long note.
A tap on the bare floor of a room shows the room scope alone ("Room", "Search this room"). A chest has the same three scopes: its own actions first (Look for traps, or disarm), then **ROOM** with the room searches, then **FOR THIS QUEST**.

**Element buttons.** Every tap on a door, furniture piece, monster, trap, marker or room label opens the usual margin note. When the element has quest notes, the margin note gets a hairline and a small caps line **For this quest** below its standard actions:
- the notes already read for this element (letter chip or bullet, first sentence; tap to read again), then
- its buttons (`manual` notes with that `target`), `btn alt`, one per row.
The line is not drawn when there is nothing to show, so most notes stay as they are.

**Room label.** A revealed room that has a quest action (an `areaEntered` note, or a `manual` note with that room as `target`) shows a small label at its top-left floor square: the existing arrow glyph in a 44 x 44 hit area, drawn like the furniture name label (dark paper text on ink) with the glyph only, no text. The label is an indicator: a tap anywhere on the room floor opens the room's margin note ("A hero enters", search, and its buttons under **For this quest**), as before. A room gets the label while it has an `areaEntered` note waiting or a button of its own that can be pressed.

**Square marker.** A dashed ring with a dot on a seen square that has a `squareEntered` note or a button of its own (a `manual` note with a `square` target). A button-only square opens a margin note "This square" with the button's `hint` line above the button (no letter, no "Did a hero step here?"). The ring replaces the eye glyph on its square: the margin note then offers "Look from here" when that square is a look square.

**Magic door (the `doorTeleport` rule, quest 10).** A door never opens: tapping a seen door opens the margin note "A magic door" with only its buttons under **For this quest** (no "Open the door"). The button "A hero goes through" repeats for every hero and asks for the dice total; only the chosen total reveals anything, so not even the room beyond the door is shown.

**End card.** After every ending the quest's `endText` (when it has one) is shown as an `extra` line, also when the goal was not reached.

**Message sheet.** The existing note card, used for every triggered text. Without a choice it uses the **light veil** (no dim, the board stays readable) and one button "Continue". With a choice it keeps the dim veil and cannot be skipped. A message never repeats a reward or an item that the end card or the log already shows. Every message goes into the log and can be read again from the Quest sheet.

**Start.** At the start of a quest the start instruction opens as a message sheet titled "Start" (for example "Place the heroes on the stairs."). It is also kept in the Quest sheet.

**Touch and keyboard.** All hit areas 44 px or more. Quest sheet buttons are reachable by Tab in reading order. The goal line in the title band is a button (44 px hit area) that opens the end sheet.

**What changes in the code (for ui-dev).** New components in `src/ui/play/`: `QuestSheet`, `ForThisQuest` (inside the margin notes), `RoomLabel`. New engine views: `eventLog(level, events)` (pure, derived from the event list), and a lookup of notes by target (`notesOf`, exists). The sidebar loses `Objectives`, `Journal` and `QuestActions`. The title band gains the goal line and the Quest chip. `EndSheet` (`src/ui/play/EndSheet.tsx`) is the end flow.

### Actions of an element (decision 67)

Selecting a door, furniture piece, monster, trap or marker shows an **Actions** section in the Element tab, above Delete. It lists the notes that belong to the element (rows like the note list: letter or dot, trigger summary, first text) or "No action on this element yet.", then chips "Add: ..." that depend on the element: a normal door "When it is opened" and "A button on it"; a monster "When it is seen", "When it is slain" and a button; a trap "When it springs", "When it is disarmed" and a button; furniture a button; a marker "When a hero is here" and a button on its square; a false door only a button. An action is a normal note: a chip creates it with the trigger and target filled in and a placeholder text, then opens it in the Notes tab. A tap on a row opens the note too. In the note form, a "Belongs to ..." line under "When it fires" names the element, with **Show it** (selects the element again) and, when the target was set explicitly, **Detach**. A button note also has "Hint above the button" and "Pressed once / Every time". Chips are 44 px or more.

**Zone mark (decision 68).** A zone is a set of squares. When any of its squares is seen and it has a `zoneEntered` note or a button of its own, every seen square of the zone carries the same dashed ring with a dot as every square marker (quest 12, falling blocks), and a tap on any of them opens the zone's note. The mark goes when the note has fired, unless the action says **Keep the mark on the map after it fires** (`keepMark`, also for single squares): then it stays and a tap shows what was read. Tap opens the margin note: "A hero enters" with its button while the note still waits, otherwise "This place", then **For this quest** with what was read. It never says what is in the zone.

### Actions, not notes: the Actions tab and the popup (decision 68)

The editor has no "notes". The inspector tabs are **Element**, **Actions** and **Problems**. An action belongs to **the quest** (a moment: the quest starts, a Zargon turn ends, all of some monsters are slain, a button in the Quest sheet), to **a place** (a room, a single square, a zone) or to **an element** (door, furniture, monster, trap, marker).

- **Add action.** With an element selected, the Element tab shows its **Actions** list and one **Add action** button. With nothing selected, the same section is at the top of the quest fields and holds the actions of the quest (the start message is one of them). The Actions tab lists every action grouped by what it belongs to (The quest, Rooms, Zones, Squares, Doors, Furniture, Monsters, Traps), with **Add action** at the end and "Add action A" chips for letters on the map that have none.
- **The popup.** A tap on a row or a new action opens the action in a centered dialog (560 px, below the title band, so Undo and Save stay reachable; Esc and Close shut it). Top to bottom: **Applies to** (the quest, a room, a zone, a door, a monster... or "A square on the board…", which asks for a click), **When** (only the triggers that fit the subject, for example a zone: "A hero enters it" or "A button"), the parameters of that trigger (button label, hint, once or every time, Zargon turn number...), **Message**, **Only if**, **Then**, **Extras** (map letter, where the letter is drawn, treasure card flags) and **Delete action**. Changing "Applies to" keeps the kind of trigger when it fits the new subject, else takes the first that fits. While the author picks something on the board the popup steps aside and a small bar says what to click.
- **Zones tool.** "Zones" in the tools column: click squares to add them to the active zone or take them out; a square of another zone makes that zone active; the chip **New zone** starts another. Zone squares are tinted with a dashed outline and the id at the first square. A selected zone shows its number of squares and "Edit its squares".
- **Markers** can be edited after they are placed (label, editor only or players see) and take actions on their square.

### Special monsters and abilities (decision 69)

A monster the quest marks special has a second ink ring around its token and a small star (`--sel` fill, ink outline) at its top left; its roster row has a star after the name; its margin note has a small caps line "Special monster". Abilities are listed as short names in italics under the roster stats, and as "Name. Text" lines in the margin note. Hovering a token or a roster row shows a tooltip: code and name, "Special monster" when it is, the stats line and one line per ability (touch users read the same facts in the margin note). A regular monster with an ability gets the ability text but no ring and no star. Zargon's order lists the abilities after the quest's free-text rules.

**Editor: special monsters and abilities (decision 69).** The monster inspector has, under the type chips, a wide chip **Special monster (story-critical)** and an **Abilities** group of 44 px chips: the core abilities (Made of stone, Fireproof, Only the Spirit Blade, Statue) and the quest's own, each a toggle with its text as the hover title. In the quest fields (nothing selected) the section **Abilities of this quest** has one row per ability (id, Remove, Name, What it does, Ability / Weakness / Immunity chips) and "Add an ability". Removing an ability that a monster still lists warns on the board, as for other removals.

**Editor: abilities and spells are dropdown lists (decision 70, replaces the ability chips of decision 69).** In the monster inspector the sections **Abilities** and **Spells** are lists of rows (name, its text or questions, a Remove button), then a row with a dropdown ("Add an ability…", "Add a spell…"), an **Add** button and **New ability…** or **New spell…**. A spell row has a **cast limit** dropdown (Once in the quest, Twice, 3 to 5 times: the number of times the spell is listed) and, for the quest's own spells, "Edit the spell…". **New ability…** and **New spell…** make the item, put it on the monster and open its popup, the same dialog shell as the action popup: the ability popup has Name, Kind (Ability, Weakness, Immunity), What it does, who uses it and Delete; the spell popup has Name, What it does, **When the monster may cast it** (one row per situation with its question and Remove, a dropdown to add more, or one question of the author's own), Offer it only when (Always, or the quest has an escape point), a warning and Delete. The quest fields list the quest's own abilities and spells with Edit, and "Add an ability" and "Add a spell". The special flag stays one toggle. **Situations of your own (M7c):** under the situation dropdown, a section lists the spell's own situations (id, an editable question, Remove) and a row to add one (Id, Question, **Add situation**; it is also put on the spell). The dropdown then offers the fixed situations and the spell's own. The same section is in the Library spell card. Same controls as the rest of the popup, no new styles.

**Monster pictures (decision 70).** A monster with an image shows it in its token circle (clipped to the circle, the code as a small ink label at the bottom) and in its roster coin. A monster without one keeps the green coin with the code. An enemy's letter replaces the letter of the type in the code (the Marsh Goblin with letter M is M1, M2...).

**Editor frame (decision 70, `design/play-a/editor-mockups.html`).** The editor has a top bar with the tabs **Quest, Map, Actions, Monsters, Library** (the open one is filled with ink) and, under it, a slim row with the quest status and the file actions (Problems, Playtest, Undo, Redo, Import, Export, Save, Back). Each tab is a frame of three columns of panels (`src/ui/shared/Frame.tsx`, classes `fr-*`): lists on the left, cards in the middle, details on the right. Quest: Actions list; General and Objectives; Rules, Wandering monster, Ending, Abilities and spells. Map: the board with its tools and inspector. Actions: the list of every action. Monsters: the monsters of the quest; Enemy, Abilities, Spells; Behavior and Actions on it. Library: the library (Abilities, Spells, Enemies, Heroes, Companions) with Core and Mine lists, New and Copy, the card of the selected item, Used in and Token. Core items are read only. The start screen shows recent quests and four cards: New quest, Open quest, Library and Packager (later, disabled). Popups start under the action row.

## Play screen: title band and right column

**Title band.** The quest title is on top (26 px, one line). Under it, small: the quest number and the goal (one line, ellipsis when long; the full text is the tooltip and is on the Quest info sheet). On the right: Turn, Undo, Quest Info, Settings, Quests (and "Finish the quest" when the goal is done). Nothing in the band wraps: a long title such as "Barak Tor: Barrow of the Witch Lord" must not break the buttons at 1194 px.

**Right column, top to bottom.** Heroes (a compact row, always shown) · Monsters in play (a paper-3 panel that takes all the height that is left and scrolls inside) · a footer set apart by a hairline: the wandering monster line (quiet, 14.5 px muted), Add a monster (outlined), and Zargon's turn (the one filled button, 68 px tall). The panels are not collapsible: what the players check each turn (who fell, which monsters are out) stays in sight.

## One set of rules for all screens

**Three action tiers, on every screen.** (1) **Filled**: the one main action of the screen (Resume and Start on the select screen, Zargon's turn in play, Save in the editor). Filled ink also means "chosen" for toggles and tools (`aria-pressed`). (2) **Outlined chip**: every other action (Undo, Redo, Quest Info, Playtest, Import, Export). Disabled ones are struck through. (3) **Italic link**: only to leave the screen (Quest editor, Quests, Back). Undo is a chip everywhere.

**Tabs are not chips.** The editor tabs (Quest, Map, Actions, Monsters, Library) are folder tabs: the open one has the page color and joins the page under the bar, the others are paper-2. A filled ink box is never a tab, so a chosen tool next to the tabs is not confused with navigation.

**Quest identity.** A quest is always shown as "QUEST N" (small caps, ink-2) over its title (bold, ink) on paper-3 with a 2 px ink outline. The select screen uses it in a grid of cards; the editor's recent list uses it in rows, with the status (Unsaved draft or Saved, and the date) and Delete on the right.

**Names.** Whole tool: Quest editor. Library of abilities, spells, enemies, heroes and companions: Library (decision 77). Buttons and labels use sentence case ("Quest info", "Finish the quest", "Add a monster").

## Themes and texture packs (decision 78)

Every board (play, Zargon view, editor, debug board) draws floor squares and the rock fill through `src/ui/theme/draw.tsx`, and furniture through `Furniture.tsx`, using the active theme (`src/ui/theme/`). The built-in theme has no pictures and is the line art described above: nothing changes unless a theme gives a picture. A theme slot is one picture (floor and corridor: a list used in turn by square, so the floor does not repeat; rock: one tile; furniture: one picture per type, stretched over the footprint and turned by 90 degrees when the piece stands the other way than the picture's `cells`). A slot with no picture falls back to the built-in drawing. A theme cannot change the UI tokens, contrast or touch sizes. In development `?theme=test` loads flat test pictures. Slice 2 added walls (one square long, turned for vertical edges, on every board), doors (closed and open, play only: the editor keeps its schematic doors so secret and false doors stay readable), blocks and traps (armed and sprung, play only). Stairs are a furniture type. Markers stay symbols: they carry the letters players need. Slice 3 added a picture per monster type for the board token and the roster coin (an enemy's own image wins). Slice 4: the pack file `.sqtextures` (a zip: `theme.json` and png, webp or jpeg pictures, at most 10 MB unzipped; `src/ui/theme/pack.ts`), packs stored in the browser (`src/persist/themes.ts`) and the **Textures** link on the quest select screen, which opens a dialog to import, use, export and delete packs (built-in Classic is always there; deleting asks twice; the choice is remembered). Not built yet: a quest that suggests a pack, and the pack's own UI skin.

## Smaller type on the select screen, the Library and the Quest editor (owner)

On these screens the base text is 14 px (the play screen keeps 15 px), buttons 14 px, chips 13 px, page headings 22 px (select header 24 px), card and list titles 15 px, small labels and help 12 to 13 px, dialog titles 19 px. Inputs stay at 16 px, because a smaller input makes iPad Safari zoom the page on focus. Touch targets stay at 44 px: only the text got smaller.

## Texture packs: whole pictures (decision 78, second pass)

A pack is made of whole pictures, not square tiles (owner). **`board`**: one picture of the 26 x 19 board, shown through the squares the heroes have seen (an SVG pattern in each board's `defs`; the walls between rooms are in the picture, so the built-in wall lines are not drawn there, only along rock edges). **Monsters**: a whole token each, drawn about one square wide with no green circle behind it (the roster coin shows it whole too). **Furniture** keeps its proportions in its footprint; **stairs** turn to the corner of their room (`corner` in the pack). **Blocks**: `single`, and `double` for two squares side by side. **Traps**: a picture per kind once known (a sprung pit, a fallen block) and for every trap in Zargon view; `armed` is the one hidden look. **Doors**: closed and open, and `secret`, which a found secret door keeps in both states (and Zargon view shows for hidden ones); it is about square and sits with its bottom edge on the wall. The per-square `floor`, `corridor`, `rock` and `wall` slots remain for packs without a board picture. The format is in `docs/TEXTURE_PACKS.md`.

**Selected room.** A selected room is tinted with the sand `--sel` at 18% (it was 35%: with a board picture that was too strong). The same light tint is used with every look, built-in or texture pack.

**Sharp pictures while zoomed or still.** The zoom layer asks for `will-change: transform` only while the board moves or zooms, and drops it 200 ms after. Left on all the time, the browser kept the first, smaller drawing of the board and pictures (monster tokens from a texture pack) looked soft until something near them repainted, for example when a popup opened.

## Quest select: starting a game, texture indicator, text size (owner)

**Right column.** Quest number, title, then the story right under the title; then, if there is a saved game, "Saved game" with its turn and heroes and **Resume**; then **New game**. There are no hero buttons in the column. **New game** opens a "Choose your heroes" popup (pick 1 to 4, then "Start the quest"). When a saved game exists the popup says it replaces it and cannot be brought back, and the buttons are "Keep the saved game" and "Replace it and start".

**Texture indicator.** The header link reads "Textures" with the built-in look and "Textures: <pack name>" when a pack is in use (the name is bold, cut with an ellipsis when long).

**Text size.** The select, editor and Library screens (width mode) shrink on a window narrower than the tablet but are never scaled up (they used to grow to 1.5 times on a big window, which made their text much bigger than on the play screen, which is never scaled up). On a wide window they stay 1194 px wide and centered.

## Turning furniture in the editor (owner)

**Rotate** (button or the R key) turns the selected piece a quarter turn clockwise, in place, around the middle of its squares: a half turn keeps the same squares, four turns bring it back. It never refuses because the new squares are taken (a piece on a wall or next to others could not otherwise reach a half turn): it shows a warning, and the Problems check, Save and Playtest look at the final position. It only refuses a turn that would leave the board. The quest remembers the quarter turns (`turn` on the piece) so a texture pack can turn the picture with the piece; with the built-in line art it changes nothing you can see.

## Tiles, tunnels and exterior doors on the editor map (owner)

The Frozen Horror board features are placed on the **Map** by tapping the board, like furniture and doors. The Quest tab keeps only quest settings (how the heroes leave, the suggested texture pack).

**Tiles tool** (key I, chip "Tiles", between Furniture and Monsters). It works like the furniture tool. One palette, **Board tiles**, holds every physical tile, room tiles and board tiles together, as one wrapped block of 44 px chips, three per row, in the right-hand column (the inspector column, above the fields of the selected tile) while the Tiles tool is on, so the left tool column stays short and nothing needs scrolling at 1194 x 834: Ice cave entrance, Ice ledge, Icy river, Slippery ice, Ice Vault, Scepter Room, Living Fog Room, Bottomless Chasm Room, Frozen Crypt Room, Seat of Power Room (the throne room), Cage Room, Ice Gremlin Treasure Room. Each chip carries a small count and the limit of the box: "Ice Vault 1 of 2" (token text, 9 px, after the name). The tile type is picked in the palette, and **right under it** (not further down the screen) sits the group **Size** with one chip per shape the tile comes in, each shape once: Ice Vault "3 x 2" and "4 x 3", Icy river "1 x 8" and "1 x 3", Slippery ice "1 x 1", "2 x 1", "3 x 1", "3 x 2". A 3 x 2 and a 2 x 3 are the same tile turned, so only 3 x 2 is listed; **Turn (R)** swaps width and height, as for furniture (the R key works too). A tile with one size shows no Size group. A size that the quest has used up is disabled, with the reason in its title. The tile is placed with its first square (top left) on the tapped square, with the same ghost as furniture (`--sel` when it fits, hatched when the engine refuses, the reason in the hint line). Sizes: cave entrance 6 x 5, ice ledge 5 x 3, icy river 1 x 8 or 1 x 3, Ice Vault 3 x 2 or 4 x 3, Living Fog, Scepter, Bottomless Chasm and Cage rooms 4 x 4, Frozen Crypt 5 x 3, Gremlin treasure room 4 x 3, Seat of Power 6 x 5, slippery ice 1 x 1 to 3 x 2. A room tile may lie over parts of two rooms and over corridor squares. There are no tiles laid square by square: the Cage Room and the Bottomless Chasm Room are the 4 x 4 tiles. Past the limit, the tap is refused and the hint line says what the box holds. The Doors tool shows "Ice tunnel 2 of 3" and refuses a fourth pair. A tap on a tile already there selects it.

**Moving a tile.** A placed tile is moved by drag and drop, in the Select tool and in the Tiles tool: press on the tile, drag, release. The ghost follows the pointer in the shape of the tile and shows `--sel` when the engine accepts the new place and hatched when it refuses it (overlap, off the board, rock). A refused drop changes nothing and the hint line says why. Every move is one undo step. Delete and Turn work on the selected tile as before.

**The cage.** There is no cage piece and no sight-blocking tile (decision 94). The Cage Room is just the 4 x 4 room tile. Where a quest has a cage that blocks line of sight and squares until it is opened (quests 0 and 4), the app does not enforce it: the quest note says so in plain words ("The cage cannot be entered and it blocks line of sight, until it is opened. You apply this at the table.") and the players handle it.

**On the board** tiles look as in play: board tiles a dashed `--ice` outline filled at 30%, river waves, ledge dashes; a room tile is a dashed `--ice` outline round every square of the tile with its name in capitals.

**Doors tool: kinds.** The kind chips are Normal, Secret, False, **Ice tunnel**, **Iron entry** and **Wooden exit**. Normal, secret and false doors are tapped on the edge between two squares. The two exterior doors go on the outer edge of a square on the board border, or on the edge of a square that touches rock (the ice cave lies over rock): tap near that edge, a thick ink bar shows it. They are drawn as in play (iron entry: ink slab with a white arrow pointing in; wooden exit: white slab with an ink arrow pointing out); the door the heroes start outside has a dashed ink ring. An ice tunnel is two taps on two squares (end A, then end B; the hint line says "Pick the other end of the tunnel.") with the design number chosen in the options (chips 1 to 9, the first free one is on); each end is drawn as in play (rounded `--ice` square, dashed ring, the design number, and a small A or B in the corner). The design chips (1 to 9, in the options and in the inspector) are in three columns; a design another tunnel uses is disabled.

**Inspector.** A selected **tile** shows its name and size, the size chips (each shape once) and **Turn**, "Remove the last square" for laid terrain, and Delete. A selected **tunnel end** shows "Ice tunnel, design N, end A", the 1 to 9 design chips and Delete (removes both ends). A selected **exterior door** shows its kind chips (Iron entry, Wooden exit), the button **The heroes start here** (iron entry only; disabled when it already is the start), and Delete. A selected **normal, secret or false door** also has the fields **Hidden until flag** and **Locked until flag** (empty means always). A selected **room tile** shows its name, its size and "1 of 2" limit text, the size chips and **Turn**, its rule text, and Delete. A tile that fills one room (an old file) shows the same and becomes squares when it is moved or turned.

## Scrollbars, monster list pictures, moving a zoomed map (owner)

**Scrollbars** are styled like the page everywhere: a 12 px paper-2 track with a hairline, a square ink thumb (3 px paper-2 border, at least 44 px long so it is easy to grab), ink-2 on hover. Firefox gets `scrollbar-width: thin` and the ink and paper-2 colors. Touch tablets keep their own overlay scrollbars.

**Monster list.** A monster with a picture (its own or from a texture pack) shows it in a 58 px coin, with its code on the picture; the row is 66 px tall. Monsters without a picture keep the 28 px coin.

**Moving a zoomed map.** When the map is zoomed in, four move buttons (left, up, down, right; 44 px, an arrow each) appear beside the zoom chips, in the strip under the board, on the play screen and in the editor. A tap moves the map a quarter of the map area; held down it repeats until the edge, where the button is disabled. They go away at 100%.

**Editor map and texture packs.** When a pack is in use, the editor's View section has a **Textures: on / off** chip (hidden with the built-in look). On, the map uses all of the pack: board or floor, walls, furniture (with its turns), monster tokens, blocks (two squares are one picture), doors (a secret door uses the secret picture; a false door keeps its cross because a pack has no picture for it) and traps (the author sees every kind, so each trap shows the picture of its kind). Markers keep their letters. Off, the map is drawn with the built-in line art, which is the clearest way to edit. The choice is kept in this browser (default on) and affects only the editor map, not Playtest.

**Scale and offset of pack pictures.** Every picture slot of a pack except the board, floor, wall and rock can be scaled (0.4 to 2.5, around its center, proportions kept) and moved (`offset` in squares, -1 to 1), so a pack author can make monsters bigger on the board or a table smaller without editing the pictures. The box of every picture comes from one helper (`tuned` in `src/ui/theme/theme.ts`), used by play, Zargon view and the editor map.

**Pack preview.** Each pack in the Textures dialog has a Preview button that opens a wide dialog: a Check (pictures much smaller than they are shown, board not 26 : 19), the slots the pack leaves empty, a sample board of 14 x 9 squares drawn at real scale with the game's own drawing code (furniture, monsters, blocks, traps, doors), and the board picture itself with its pixel size.

**Adjusting a pack from the app.** In the pack preview, "Adjust a picture" (a list grouped by monsters, furniture, doors, blocks and traps, or a tap on the picture in the sample) shows three knobs, Size, Right and Down: a slider, a 44 px minus button and a 44 px plus button, and the value. A tap moves 1% (a hundredth of a square); held down it repeats, and after a second it moves in steps of five. The sample and the knobs sit side by side (a 940 px dialog, the knobs in a 316 px column, each knob a name and value row over a minus, slider, plus row) and are pinned to the top of the dialog while a picture is picked and the rest scrolls under them, so the picture can be watched while it is adjusted. With nothing picked nothing is pinned, so the board picture at the bottom of the dialog can be looked at in full. The sample redraws as they move, the picked picture glows, and "Unsaved changes" shows in the footer until "Save changes" (the other button is then "Close without saving"). Reset puts the picture back.

**Close-up.** While a picture is picked in the pack preview the sample zooms in on it (a view of 6 x 4 squares or a little more around it, kept inside the board), because the whole sample is too small to judge a picture. A chip over it, "Show the whole sample" / "Close-up", switches between the two.

## Ice slide path (M10)

A slide whose path is known (a spring, or a good jump over it) is drawn on the board as a dashed line in the ink color from its first square to its last, with an arrowhead on the last square. It sits under the trap mark and takes no taps. Other sprung hazards that stay (axe, slippery ice) keep the "?" mark; only a pit shows the pit square. The trap menu names a trap that sprang ("The swinging axe trap is still here") and offers Disarm only when the kind allows it after a spring.

## Frozen Horror look (owner feedback, M10)

**Blue tokens.** A monster whose enemy comes from the Frozen Horror box has a blue coin (`--ice` #3B6B8C, token text #F2EBDD on it is 4.7:1) instead of the green one, on the board and in the roster. Core monsters stay green. The box is the `expansion` of the quest enemy; other boxes get their own color the same way later. **Texture packs:** a monster that is an enemy of its own kind (no base type, like the Ice Gremlin) never gets the picture of a core type from a pack: it keeps the built-in coin unless the quest gives it an image.

**Ice tunnels.** Each seen end is a rounded `--ice` square with a dashed ring and the number of its design in token text (13 px), 44 px tap target. The tap opens a margin note with the rule and the button "A hero used this tunnel", which shows what can be seen from the other end and names it in a result sheet. The other end stays hidden until seen.

**Board tiles.** The ice cave entrance is a dashed `--ice` outline filled at 30% over its squares (rock too), with its name in capitals, drawn from the start. **Slippery ice** that sprang is an `--ice` square with three wavy lines; hidden slippery ice is still the "?".

**Terrain.** `icyRiver` and `iceLedge` board tiles are drawn square by square: a river square is `--ice` at 40% with two waves, a ledge square a dashed `--ice` outline at 18%. (An old `chasm` square is still drawn `--pit` at 85% with a crack; new quests use the Bottomless Chasm Room.) They change no sight and take no taps of their own: their rule shows as a tile-rule block (name, then the lines) in the note of the corridor square or the room that holds them.

**Rule hints** (a switch "Rule hints: on/off" in the quest list header, kept on this device, on by default). When on: the first time a terrain or a room tile comes into view a toast gives its name and first rule line, and in a quest of an expansion pack the sidebar says "No monster is awake: you may move without rolling, counting each red die as 4" while no seen monster is awake. Off: none of these show; the rules stay on tap.

**Zargon card.** Order: Target, Plan, Else, Special, Tie. Special never repeats the stats (they are on the card header) or what a plan says.

## Room tiles (M10, slice 4c)

A room that holds a tile (Ice Vault, Living Fog Room, Cage Room...) shows its name as the kind line of the room note, and its rule under it: the name in the special-note style, then the rule lines as hints. A tile that lies over two rooms or over corridor squares shows its rule in the note of each place it covers (room or corridor square) once one of its squares has been seen. On the board it is a dashed `--ice` outline with its name; a texture pack can give it its own picture later.

## Edge doors (M10, slice 4a)

A door in the outer wall of the board (the Frozen Horror iron entry and wooden exit) is drawn on the wall line, moved 6 px into the board so it stays inside the picture. The iron entry is an ink slab with a white arrow pointing into the board; the wooden exit is a white slab with an ink arrow pointing out. An opened door is drawn at 45% opacity. Tap targets are the usual 44 px. Texture packs do not change these two pictures yet. The heroes at an iron entry door see only that door until it is opened; the first tap opens it and looks in from the square inside it.

## Dialogs: focus and Escape (M8)

Every dialog (the shared dialog, message cards, margin notes, the quest sheet, the editor dialogs and the import sheet) uses one hook, `useModal` (`src/ui/shared/useModal.ts`). **Escape** closes only the top dialog, and does nothing for a dialog that needs an answer or has unsaved work (a pack preview with changes). **Tab** stays inside a modal dialog (a margin note, the quest sheet and the alignment bar are not modal: the board stays usable). **Focus** goes into the dialog when it opens (the first control, or the title when the dialog asks for it) and comes back to the control that opened it when it closes, unless the person has moved it. While a dialog is open the quest editor's own shortcuts (Esc to deselect, Delete, R, tool letters) do nothing, and Delete and Backspace delete the selection only when the board has focus or nothing does.

## Accessibility checks (M8)

`tests/e2e/a11y.spec.ts` runs axe (WCAG 2.1 A and AA: contrast, names, roles, ARIA) on every main screen and dialog, and must stay clean. Rules it enforced: a control's accessible name must contain its visible text (do not put an `aria-label` that differs from it; leave a space before a count or badge), a list keeps its list role (put `role="status"` on a wrapper), a group with an `aria-label` needs a role, and small text on the selection color uses ink, not muted (3.8:1).

## Toasts, wake lock, small rules (M8)

**Toasts** show up to 110 characters. A longer message is cut at a word with an ellipsis and a **More** button, which opens the whole message in a card ("Message", with Close). A toast stays 3.2 s (the editor 4 s), longer for long messages (about 45 ms a letter, at most 9 s). **Wake lock.** While a quest is played the screen is kept awake (Screen Wake Lock API, asked for again when the page comes back, let go when leaving the quest); a browser that lacks it or refuses it just lets the screen sleep. **The "All heroes have fallen" card** shows once; after it is dismissed it stays away until an Undo brings a hero back and they fall again. **The quest editor** says when the draft cannot be stored and when a quest cannot be stored on the start screen; an empty title is refused and the field goes back; the file chooser shows keyboard focus.

## Library layers (decision 76, built)

The Library list has a two-button **layer switch** at the top, "Core n" and "My library n" (44 px), and lists one layer. A read-only Core item shows a "Core item" panel above its card with **Edit a copy**. The Details column has an **Expansions** panel (one switch per expansion: "<name> in the add menus") above **My library file**, whose **Export** opens "Share my library as a pack" (name, author) and whose **Import** says what came in. Details in `docs/LIBRARY_LAYERS.md`.

## Toggle switch (owner, quest settings)

A setting that is on or off is a row: its label on the left, a switch on the right. Track 48 x 28 px (the row is at least 44 px tall), a round knob; off: track `--paper-2` with an `--ink` outline, knob `--ink-2` on the left; on: track `--ink`, knob `--paper` on the right. The knob moves in 120 ms (none with reduced motion). It is a `button` with `role="switch"` and `aria-checked`; a short hint can sit under the label. Class `.switch-row`.

## Quest packs on the quest list (owner)

A row of tabs over the quest cards, one per installed pack: Core game, then each expansion by name. A tab is a chip (44 px tall); the chosen one is filled with `--ink` and `--paper` text. Choosing a tab shows only the quests of that pack and selects its first quest. Quests made in the editor sit with the core game. The tabs are hidden while only one pack has a quest to play. A saved game whose quest is not on this device (its pack is not installed) shows as a short hint line under the tabs with a link, "Delete the save" (44 px); nothing is deleted without a tap.

## Team in the New game popup (decision 38, M9 slice 3)

The popup "Choose your heroes" keeps its title and grows three groups, each with a small caps label (`.lbl`) over a two-column grid of 48 px chips (`.pick-heroes`). **Heroes**: the four heroes, then the heroes of the quest's pack (Barbarian (alternate)). **Mercenaries**: one chip per mercenary added (tap to take it out), then a dashed chip "Add a mercenary". **Animal allies**: the pack's allies as chips (the one the quest brings first, with "from the quest" in its hint), then "Add an animal ally". A chip for a mercenary or an ally reads "Scout (Dwarf)": name, then its owner hero. The two add chips open a small form inside the popup (no new dialog): a name field (44 px, `.input`), a row of chips for the owner hero (the picked heroes), and two buttons, "Add" and "Cancel". Under the groups, the **warnings** of the team and of the quest rule (for example "This quest is for one hero.") are short bold lines in `--ink` with a 3 px left rule (`.team-warn`); they never disable "Start the quest", which needs one hero only. Nothing else is new: no new color, font or control. In play, the right column block is called "Team" when it holds a mercenary or an ally (else "Heroes"); each entry is a chip as before, and a tap asks "<Name> fell?".

## Campaign and one-shot (decision 37, M9 slice 5)

**New game popup**: above the team groups, a small caps label "Play mode" and two 48 px chips side by side, "One-shot" and "Campaign" (`aria-pressed`, the chosen one filled with `--ink`). Under them one hint line (`.hint`): in a campaign, "Campaign: 2 of 10 quests done." or "A new campaign starts for <pack>."; in a one-shot, "This quest alone. Carried flags take their one-shot values." The default is Campaign when the pack has one, else One-shot. In a campaign the team starts as it was last time; a team entry that fell in the last finished quest is left out and named in a hint line ("Fell in the last quest: Dwarf. Tap a chip to bring them back."). **Quest list**: with a campaign, a finished quest card shows a small "Done" line under its title (the `.qnote` style of "Edited"). **Side panel**: under the summary, in a campaign, one hint line with the progress and a link-style button "Start a new campaign" (44 px) that asks "This forgets the finished quests, the carried flags and the settings of this pack's campaign." with "Start a new campaign" and "Keep it" in the same dialog. No new colors, fonts or controls.

## Settings: Yeti hug and campaign settings (decisions 59, 61, M9 slice 6)

The quest settings popup (decision 84) gets more switch rows, all in the toggle style above. **No Yeti hug in solo quests** (on by default) shows only for a quest that is for one hero. When the pack has campaign settings, a small caps label "Campaign of <pack>" follows, then one switch row per setting (name in bold, its text as the hint). On the quest list, with no campaign yet, the label is followed by one hint line: "These are set when a campaign has started. Start a game in Campaign mode first." In play the switches are the same and a change takes effect on the next Zargon card. No new colors, fonts or controls.

A row of tabs over the quest cards, one per installed pack: Core game, then each expansion by name. A tab is a chip (44 px tall); the chosen one is filled with `--ink` and `--paper` text. Choosing a tab shows only the quests of that pack and selects its first quest. Quests made in the editor sit with the core game.

## Editor: double quests (Frozen Horror, M10 slice 7)

No new styles: only existing chips, panels, fields and buttons.

- **A tab per map.** When a quest has more than one map, the Map tab shows a row of chips at the top of the tools column, one per map (its name, or its id), then a chip "New map". The pressed chip is the map on the board. Everything on the board, the inspector and the Monsters tab belongs to that map. A tap on a problem or an action of another map opens that map first.
- **Maps and links panel** (Quest tab, General column). One row per map: Name and Id fields, "Show on map" and "Delete map" chips. "New map" adds an empty one; a quest with one map has only this button (it makes the quest a double quest). Under the rows: the links (each as "Map A stairway to Map B stairway" with a Remove chip) and the link tool: two dropdowns (first stairway, second stairway, each "map: stairs id") and a "Join" button. The engine refuses a link when an end is not on stairs.
- **Merge rooms tool** (Map tab, in the tools column, key G): a short help line, the rooms that count as one in this quest on the map on show, each with "Split", and two room dropdowns with "Merge". It is a tool of the Map tab, not part of the Quest tab.
- **Action form**: a "Map" dropdown in Extras, shown only for a double quest ("Every map" or one map).
- **Rules panel**: the door teleport rule. The label is "Door teleport (magic door)" with a help line: "When a hero crosses a magic door, the hero rolls these dice and moves to a marked square." Fields: "Dice to roll" and "Squares to move to". There is no bounty rule: the players track it.
- **Monsters tab**: a "Size" dropdown (as its enemy, or Large 2 x 2).

## Translations (decision 92)

The **Translations** link in the quest select header (next to Textures) opens a wide dialog. It adds no colors, fonts or control styles: only `fr-recent` rows, chips, `fr-in`, `fr-sel`, `fr-ta` fields and the dialog shell. The link reads "Translations", or "Translations: <language>" (name in bold, like the texture pack) when a language other than English is in use.

- **Language list.** The first row is English, tagged "Built in" and "Can be changed, never deleted", with how many texts are changed; it has no Delete. It has "Use English", "Edit" (the editor lists the built-in text read only and the changed one in the field, with a "Reset" chip on a changed row and a "Changed" tag), "Export" and "Reset all to the original" (disabled with no changes; the second tap, "Really reset all", confirms). A switch "Owner mode: the built-in English can be changed" (the `fr-tog` toggle, the same setting as in the Designer) sits above the list; in owner mode one more row, "Built-in English", has "Edit the built-in English", "Export the built-in English" and "Reset the built-in changes" (second tap "Really reset"). Then one row per language of the device: "code, author, texts" over the name, with Use or "In use", Edit, Export and Delete (the second tap, "Really delete", confirms). Foot: "New language", "Import a file", "Close". Using a language reloads the page, so every text and quest is built in it.
- **New language.** A small form (Name, Code such as "es" or "pt-BR", Author optional) that copies every English text into the new language.
- **Editor.** Opens in the same dialog. Toolbar: a Show dropdown (Interface, Library, one entry per quest, or All), a Filter dropdown (All, Not translated yet, Problems), a search field, and a progress line per area ("Interface 120 of 852"). Rows show up to 50 texts, with "Show 50 more". A row has the key in small muted type, the English text in a paper-2 block (read only), and an editable `fr-ta` field with the translation. A row that is still the English text, or empty, has a "Not translated" tag; a row that lost or added a `{name}` placeholder has a "Check" tag with what is wrong. Foot: "Save" (primary), "Back to the list". When the file was made for an older English version, a note says how many texts are new or gone, with "Add the new texts" and "Remove the old texts".
- **Everything in English falls back.** A text that is empty or missing shows the English words in the app.

## Show room: reveal what is here (decision 95)

A tool for when the table shows something the app has not revealed (a spell, a quest prompt). There is no side button and no banner. Tapping a square of the fog (a square the heroes cannot see, rock excluded) opens the usual margin note (`MarginNote`, kind "Hidden square", the same look as a corridor note) with one button, "Reveal what is here" (`.btn`, 44 px). The button opens a confirmation card (`NoteCard`, with a veil): for a room square "Reveal what is here? It shows everything in this room." and for a corridor square "Reveal what is here? It shows what can be seen from this square.", with "Reveal" (`.btn`) and "Cancel" (`.btn alt`). Nothing changes until Reveal. Then the reveal is the one of a door: the same ink animation and result sheet, and the notes of what shows. Rock squares take no tap. Fog squares are tap areas under every other tap area, so doors, tokens, traps, the look eye and the zoom and drag gestures work as before (a tap that ended a drag is not a tap). Tokens only.

**Editor title band (built from the concept).** The editor uses the shared page header: square Back button, small-caps title with the saved state, and the actions (problems, Undo, Redo, Playtest, Save) on the right. A tab row sits under it (Quest, Map, Actions, Monsters, Library) with Import and Export at its right. On the Quest tab the cards after the Actions list are numbered by CSS (`.fr-numbered`). A popup in the editor starts below the header, so Undo and Save stay usable.

**Start room and companions (editor).** The Quest tab General panel has a Start room field: a select of the rooms that are not rock, with the current start chosen. When the quest starts outside an iron door the field is replaced by a line that points to the Map tab. In the characters section, "Add a companion from the Library" is a select next to "Add a character"; it is hidden when the Library has no companions. Choosing one asks for a square on the map, then adds the character (one undo step). Both use the existing select and field styles.

## Start flow: Home, Single Quest, Quest Pack Campaign (owner, Campaign.pptx)

This replaces the quest list with pack tabs, its right column and the New game popup with Play mode (the sections "Quest and team select", "Quest select: starting a game", "Quest packs on the quest list" and "Campaign and one-shot" above describe the old screen; the Team popup groups, the switch rows and the texture indicator text live on). Every screen is a page in the same shell as before: the title band (`header`: small caps `SoloQuest`, the page title, links on the right) and under it one stage. A page that is not Home starts the title band with a **Back** link (44 px, `.link`). No new colors, fonts or controls: the only new pieces are the menu button and the status line below.

**Menu button** (`.menu-btn`): a full width square button, 2 px `--ink` outline, `--paper-3` fill, 72 px tall, text left: the title in Bonum 20 px `--ink`, the caption under it in Pagella italic 14 px `--muted`. Pressed: 2 px shift, as `.qcard`. Disabled: `--off` outline and text. A menu button can carry a small tag on the right (`.qnote` style: "Saved game", "3 of 10 done").

**1. Home.** A column of four menu buttons, centered, 520 px wide: **Single Quest** ("Play a single quest"), **Quest Pack Campaign** ("Choose a quest pack and play all missions in order"), **Continue your last game** (caption: the quest and the turn, for example "Quest 3, Lair of the Orc Warlord, turn 5"; disabled with "No saved game yet." when there is none), **Settings** ("Textures, translations"). The title band has the link "Quest editor". A short notice (a saved game that could not be opened) and the saved games whose quest is not on this device (a hint line with the link "Delete the save", as before) sit under the column.

**2. Single Quest: packs.** Label "Quest packs" and a grid of menu buttons, 3 per row, one per installed pack (name, caption "10 quests"; a pack with no quest encoded is disabled and says "Not encoded yet"). Label "Other missions" and a menu button per quest made in the editor on this device (title, caption "Made on this device"); with none, a hint line "Quests you make in the editor are listed here."

**3. Single Quest: the pack's quests.** Page title is the pack name, hint "Select the quest to play." The quest cards (`.qcard`, 5 per row) as before; a card with a saved game says "Saved game", an edited copy says "Edited", a quest not encoded is greyed out. Choosing a quest opens the start page of the quest.

**Start page of a quest** (single quest, and a campaign quest): the left area has the label "Heroes" and the team groups of the Team popup (Heroes, Mercenaries, Animal allies, with the warnings) in a 4 column grid of 48 px chips. The right column (`.side`) has: quest number, title and story; the texture hint; for an edited copy "Use original" and "Export to publish (admin)"; the **Saved game** box (turn, heroes, **Resume**) when a save of this quest can be resumed here; **Quest settings** (link); and at the bottom the main button, "Start the quest" in a single quest (with a save: a hint "Starting replaces the saved game (turn 5). It cannot be brought back." and the button reads "Replace it and start"). A single quest has no campaign: carried flags take their one-shot values.

**4. Quest Pack Campaign.** Label "Select a quest pack": the pack menu buttons of page 2. Under them the label "Or continue a saved campaign" and one menu button per saved campaign: its name ("Campaign 1") and a caption with the pack and the progress ("Frozen Horror, 3 of 10 quests done"). With none: a hint line "No saved campaign yet."

**5. Campaign overview.** Title: the campaign name; hint: the pack name. The quest cards of the pack in campaign order (5 per row, `.qcard`): number, title and one status line in the `.qnote` place: "Done", "Next" (the first quest not done, with the selection color and offset shadow), "Saved game" (a game of this campaign is in progress), or nothing for a quest not played. A quest not encoded is greyed out. Right column: **Status** (small caps label): the line "3 of 10 quests done" (`.hint`), "Heroes: Dwarf, Elf", "Fell in the last quest: Wizard" (bold `.team-warn` line) when someone fell, and "Carried on: scepter destroyed" for the flags the quests handed on. Nothing else is tracked (no Body Points, gold or items). Buttons: **Play the next quest**, **Campaign settings** (only when the pack has some), **Start a new campaign** (a new campaign of this pack, the old one stays) and a link "Delete this campaign" that asks first. Choosing a card opens the start page of that quest with the team of the campaign (a hero that fell in the last quest is left out, named in a hint; a tap brings the hero back). Heroes can be swapped there, and mercenaries and animals added.

**6. Heroes for the campaign** (a new campaign, from page 4): title "Heroes for your campaign", the same team groups, and a right column with the hint "Heroes can be changed before each quest. Mercenaries and animals can be added.", the first quest of the pack, and the buttons **Start** (makes the campaign, opens the first quest) and **Campaign settings** (only when the pack has some). The campaign settings open in the note card used for quest settings, with the switch rows of the pack; they are kept in the campaign.

**Settings.** A page with two menu buttons: **Textures** (caption: the pack in use or "Built-in look") and **Translations** (caption: the language in use or "English"). They open the same dialogs as before.

**Returning.** After leaving a game the app returns to the page it started from: the start page of the quest, or the campaign overview, so the next quest is one tap away. The page is not kept across a reload: a reload goes to Home, saved games stay. The page only changes once the game has opened. The status of a quest is only Done, Saved game or Next, and the overview names only who fell in the last quest (hard rule 2 and decision 32: no casualties per quest).

**Deleting a campaign.** "Delete this campaign" asks first and says it forgets the saved games of that campaign too; they are deleted with it. A saved game of a campaign that no longer exists is not offered by Continue. A campaign whose pack is not installed is listed disabled with its own Delete link.

## End flow (decision 97)

One control and one sheet end a quest. There is no End quest chip and no chain Quest info, confirm button, End quest.

**Goal line (title band, second line).** A button, 44 px hit area (it overlaps the title row, which is not interactive), text only with a small chevron: "Goal" in small caps, then "1 of 2 done" when the quest has several objectives, then the first objective not done. When every objective is done it reads "Goal done" with the way to leave. A tap opens the end sheet. A small ink dot means an objective confirm is available now.

**Finish the quest.** When every objective is done, a filled `btn` "Finish the quest" appears in the title band, in the place the End quest chip had (the band is 64 px, so a filled 44 px button does not fit on the goal line itself). One tap, then one confirmation card ("Finish the quest?", "Heroes left by the stairs.", "Yes, end the quest" and "Back"), then the end card. The outcome is `stairs`. A quest with custom endings still finishes by the stairs: its endings are the ways it can fail.

**End sheet.** The note card (dim veil, role dialog, Esc closes), kind "The quest", title "Goal and ending". Top to bottom: the objectives as a checklist (tick box, text, "(done)" or "(not done)" for screen readers); under an open objective its confirm button (`btn alt`, 48 px) when its `confirmWhen` holds; then the ways to end: "Finish the quest" (`btn`, goal done), or "Leave without finishing" (`btn alt`, goal not done: heroes leave by the stairs, the end card says the goal was not reached), or "Heroes left by the stairs" (a quest with no objectives); one `btn alt` per custom ending; "All heroes fell"; "Keep playing". A way to end opens the confirmation card first; "Back" returns to the sheet. A confirm button closes the sheet and dispatches; the message that follows is the only dialog.

**Last objective done.** The message sheet that tells it ("All objectives are done...") has two buttons: "Finish the quest" (`btn`, opens the confirmation card) and "Continue" (`btn alt`). Nothing is forced.

**All heroes fallen.** The card "All heroes have fallen" and Zargon's turn card keep their "End quest" button; it opens the end sheet.

**Quest info** keeps the story, At the start, the objectives (read only), Quest actions, Notes read and the log.

## Frozen Horror pictures (decision 96)
## Texture pack families and the Frozen Horror pack (decision 99)

Texture packs come in families. A **core pack** (no `box`) dresses every quest. An **expansion pack** (a `box`, the `extends` id of the one core pack it is made for, and the `family` of that core pack) dresses only the quests of its box and can only be used while that core pack is in use. A player uses one core pack, or a core pack and any number of expansion packs of its family (one per box), all together. **Nothing is used by itself**: with nothing chosen every quest, Frozen Horror included, is drawn with the built-in look.

**Textures dialog.** Under the intro line, one status line says what is in use: "Built-in look: no pack in use." or "Core: Test core pack · Expansions: Frozen Horror" (`fr-help`). Then the list (`fr-recent` rows, as before): Classic first, then each core pack followed by the expansion packs made for it, indented 16 px (`li.sub`); expansion packs whose core pack is not installed come last. A row keeps the small caps line ("For frozen-horror · Family ah-2021 · Official · 2.9 MB · Included with the app"; a core pack says "Core pack" and, like every pack that has one, shows its `Family {id}`), the name in bold, and the chips **Use**, **Preview**, **Export**, **Delete** (the shipped pack has no Delete). A pack in use shows "In use" and **Stop using it**. An expansion pack that cannot be used yet says why in its row, in the note style, and its **Use** is disabled: "Needs the pack {name}. Apply it first." (the core pack is installed but not in use) "Needs the pack {id}. Import it first." (it is not installed, so only its id is known), or "Made for the family {family}, but {name} is of another family." The dialog never applies a core pack for the player. Messages after a change use the status line under the intro: using another core pack says "Stopped using {names}: made for another core pack."; stopping a core pack says "Stopped using {core} and its expansion packs: {names}." Import refuses an expansion pack without a core pack or a family ("An expansion pack needs the core pack it is made for.") and a core pack that extends another ("A core pack cannot extend another pack."). The select screen's Textures caption shows the same line as the status. No new colors, fonts or controls.

**The Frozen Horror pack** ships with the app (`src/content/art/fz-ah-2021.theme.json`, pictures in `public/assets/frozen-horror/`) and is an expansion pack a pack with id `fz-ah-2021` and family `ah-2021`, made for the core pack `core-ah-2021` (the owner's own core pack, which is not shipped: the owner imports it). Until it is imported the row says "Needs the pack core-ah-2021. Import it first."; once it is in use the Frozen Horror pack works together with it. It draws, at their natural footprint: room tiles (Ice Vault 3 x 2 and 4 x 3, Scepter, Living Fog, Chasm, Frozen Crypt, Seat of Power, Cage, Gremlin treasure), the ice cave entrance, the icy river (1 x 3 and 1 x 8), the ice ledge and the ice slide, each drawn once over its squares and turned a quarter turn when the tile lies the other way; slippery ice pieces; ice tunnels 1 to 3 (other designs keep the drawn look); the iron entry door and the wooden exit; the block; and one token per enemy. A tile with a picture does not draw its dashed outline and name. Magic Ice has a picture but no place on the board (decision 57). The Frozen Horror is one token, one square.

## Home and My collection (decision 101, owner concepts)

**Home.** The title band has the wordmark `SoloQuest` only (no page title), and on the right two buttons: "My collection" (`.btn alt`, box icon) and a settings button (`.btn alt`, icon only, 44 px). Under it: the **Continue banner** (`.continue`: 2 px `--ink` outline, `--paper-3` fill, offset shadow in `--sel`) with a small map of the quest (rock in `--rock`, the rest `--floor`), the small caps label "Continue", the quest title in Bonum 28 px, a line "Quest 3, Lair of the Orc Warlord, turn 5" and the main button "Continue". With no saved game the banner is not drawn and a hint says "No saved game yet." Under it three cards in a row (`.home-card`: 2 px `--text` outline, `--paper-3` fill, 300 px tall): a line icon, the title in Bonum 24 px, two lines of text, and at the bottom a count in italic (`24 quests in 2 boxes`, `0 in progress`, `0 quests of your own`). The Quest editor card is drawn only when the editor is available.

**My collection.** Title "My collection", hint on the right. Two columns of rows (`.box-row`: a 12 px bar, the box name in Bonum 20 px, "14 quests, always on" or "10 quests", a 28 px checkbox). An owned row has an `--ink` outline, the others `--off`. The base game is ticked and disabled. A line "N boxes ticked." and the button "Done" go back to Home.

## Play a quest (decision 101, slice 2)

Replaces the "Single Quest" pack page and the pack's quest page. Title "Play a quest", hint "One quest, nothing carried over." Three columns: the **box list** (220 px; one button per owned box with a 8 px ink bar, the name and the quest count; the picked box uses the selection color; "My quests" is a box too, shown when the device has quests of its own), the **quest grid** (`.qcard`, 3 per row; a card says "Saved game" or a check mark when the last game was won), and the **detail panel** (`.detail`: 2 px `--ink` outline, offset shadow in `--sel`): box and quest number, title, the small map of the quest, the story, "Played 2 times. Last time: won." (or "Not played yet.") and the button "Choose heroes". Tapping a card only selects it. The history is kept per quest on this device: the count of games that reached an end and whether the last one was won (a game left with the goal undone counts as not finished).

## Campaigns and the campaign page (decision 101, slice 3)

Replaces the pack buttons of "Quest Pack Campaign", the heroes-for-the-campaign entry and the campaign overview of "Start flow". **Campaigns**: left, one row per saved campaign (`.camp-row`: 10 px `--ink` bar, the name in Bonum 22 px capitals, the box, the date of the last journal line, a strip of one segment per quest of the box: finished `--ink`, skipped `--sel`, open empty, and the line "Next: Quest 2 · The Rescue of Sir Ragnar (in progress)" with the heroes). Right, the **New campaign** panel (`.detail`): the owned boxes, a Name field (default "Campaign N") and "Choose heroes", which opens the heroes page for the first quest. A campaign whose box is not installed is greyed and has its own Delete link.

**Campaign page**: title is the campaign name, the right of the title band says "Core game · 3 of 14 quests done". The quest tiles (5 per row, `.qcard`): done tiles are filled `--ink`, skipped tiles have a dashed outline (the colour bar of the box on the left stays solid), the next one and any picked one use the selection color. Tapping a tile only picks it. Under the grid a panel (`.camp-panel`) shows the quest number and status, title, story, **Skip** (not for done or skipped quests) and **Play** ("Play again" for a done quest). Below, the buttons Campaign settings and Start a new campaign, and the link Delete this campaign. Right column: a **Heroes** card (who plays, "Change" opens the heroes page of the picked quest, who fell, what was carried on) and a **Journal** card (newest first: day, quest, "Won." or "Skipped."). The journal keeps only the result of a quest, no heroes, items or notes. "Read intro again" of the concept is not built: packs have no intro text.

## Setup screen: Heroes, Before you start, Options (decision 101, slice 4)

Replaces the heroes page and its right column (`.side`) of "Start flow". Title band: `Quest 5 · Title` (a campaign's first quest: "Heroes for your campaign"), the box and campaign name on the right, and the main button (`.btn`, "Start the quest", "Start" in a campaign, "Replace it and start" over a saved game). The button stays in the title band so it is on screen on a short window; the concept puts it bottom right, which the fit rule (Start visible without scrolling on a 640 px window) does not allow. Three cards side by side (`.setup-col`, 2 px `--text` outline, `--paper-3` fill): **1 · Heroes** (the team groups of the Team popup, 2 chips per row, the warnings; a fallen hero is named and comes back with a tap), **2 · Before you start** (quest title and story, the texture hint, then one Yes/No question for each carried flag the quest begins with, set from the campaign or the one-shot value and changeable; the saved game box with Resume; the edited-copy buttons) and **3 · Options** (the quest switches, and for a campaign the campaign switches, as switch rows: no popup). A line under the cards says how many heroes are picked and, over a saved game, that starting replaces it. The "Zargon's turn" choice of the concept is not built (decision 10 keeps the priority list only).

## Follow the concept (owner, 2026-11-25)

When a screen has a concept in `reference/UIConcepts.pdf`, build it as drawn and do not change it unless a rule of the app forces it. The note for each change is recorded here, not on the screen: the screens carry no sentences that explain how the app was built.

- **Title band** (all start flow pages): Home shows the wordmark `SoloQuest` (Bonum 38 px, small caps, `--ink`) and the buttons on the right. Every other page shows a square Back button (50 px, 2 px `--ink` outline, a chevron, no text) and the title (Bonum 36 px, small caps, `--ink`). A hint goes on the title line (italic, `--muted`), a subtitle under the title, buttons or a note on the right. No rule under the band.
- **Header buttons** (My collection, Settings): both 50 px tall; Settings is a 50 px square with an icon.
- **Box colours**: each box has a colour, shown as a bar on the box rows of My collection, the box list of Play a quest, the campaign rows and the New campaign box list, and as the colour of the finished segments. Defaults: the base game ink red, Frozen Horror blue (`--ice`), other boxes from a short list. The player changes it in My collection (a colour field on the box row; kept on this device).
- **Heroes list** (setup screen): one row per hero (54 px: a square tick, the name in Bonum 19 px, the box on the right). A chosen row has the selection color and an `--ink` outline.
- **Setup screen**: Start quest is bottom right in the footer, the hero count bottom left ("2 heroes"). Options are tick boxes with the label only. "Before you start" lists only the questions; a campaign adds "Options are kept for the whole campaign." This replaces the title band button of slice 4 (the page now scrolls on a short window).
- **Campaign page**: Skip and Play are the same size (120 x 54 px), Skip outlined and Play filled.

## Concept for the quest editor and the other screens (owner request, 2026-11-25)

`design/ui-concept/editor-concept.html` draws seven screens in the language of the start-flow concepts: editor start, the editor tabs (Map, Quest, Actions and Monsters), Library, Settings with the Translations dialog, and the title band of the quest screen. Not built yet; the owner reviews it first. Main points: the title band of every screen is the square Back button and the small-caps title with a hint; the editor tabs are buttons like the box list of "Play a quest" (picked tab in the selection colour); tools, inspector and the quest fields are cards with a 2 px outline, the quest fields numbered like the setup screen; lists with a detail panel (Actions, Monsters, Library) follow "Play a quest"; the main button of a screen is the one filled button (Save, Start quest); dialogs are the same card with a veil and the offset shadow.


### Built: Library and Quest tab (2026-11-25)

- **Library** (`DesignerBody`): three columns, 220 px / cards / 390 px. Left: the kinds as `.box-pick` buttons (Enemies, Abilities, Spells, Heroes, Companions, with their counts), the Owner mode switch, and one Files card (`.lib-files`) with Core file (owner only), Expansions and My library file (Export, Import). Middle: the Core and My library switch and the box filter (chips), then the items as `.qcard` cards (item name, box or "My library" in small caps, origin line; the picked one in the selection colour) and a dashed `New enemy` card at the end. Right: the picked item in a `.detail` card (2 px `--ink` outline, offset shadow): its fields, abilities and spells (enemies), token or picture, origin, where it is used, and the buttons Copy, Reset to core or Delete, Delete from Core. Core items are read only unless owner mode is on. Changes save as they are made, so there is no Save button.
- **Quest tab**: three equal columns. The numbered cards are 1 General, 2 Objectives and maps (objectives, Maps and links, Wandering monster) and 3 Rules. Cards with no number sit under them: Characters (left; actions are only in the Actions tab, 2026-11-26), Ending (middle), Leaving and textures and Abilities and spells of this quest (right). A column scrolls when it is longer than the window.

### Check box and long titles (2026-11-26)

- **Check box** (`.fr-check`, component `CheckRow` in `src/ui/shared/Frame.tsx`): a 26 px square with a 2 px `--ink` outline on `--white`, then the label at 18 px, on a row at least 44 px high. Checked: the square is filled `--ink` with a 4 px `--white` inset. It is a button with `aria-pressed`. Used for on/off options that are not a quest setting: "Room ids" and "Textures" in the editor Tools card. The switch `fr-tog` stays for quest and app settings.
- **Title band, long titles.** The title is one line with an ellipsis, the full title in its `title` attribute. The hint and the buttons on the right never shrink or wrap.

### Actions and Monsters tabs: list and detail (owner, 2026-11-26)

- **Layout** (`Split`, `.fr-split`): a 300 px list on the left, the picked item in a detail card on the right (grid `300px 1fr`, gap 20 px, padding `0 40px 24px`). The rows are the Library's `.box-pick` rows (`PickRow`): the name and a small kind on the right, the picked row in the selection colour. The card is `DetailCard` (`.detail`, 2 px `--ink` outline, offset shadow, at least 560 px high): a small-caps label, the title, the fields, and the buttons at the bottom.
- **Actions.** Rows show the action with its kind: Moment (the quest), Place (room, zone, square) or Element (door, furniture, monster, trap, marker). Below the list: a full-width outlined "Add action". Letters of the map with no action are a small card above the list. The card label reads "Action · on a place", the title is the trigger. Sections: When, Only if, Then (each effect is a row with a bar), Extras. **The card edits a draft**: nothing reaches the quest until "Save action" (one undo step); "Cancel" drops the edits; "Delete action" (pushed right, not shown on a new action) removes a saved action. A new action is only a draft until it is saved. Picking a square, room or door on the board keeps the draft; opening another action, changing tab or undoing drops it. The same card is the body of the action popup on the other tabs (the popup has no Close, Cancel closes it).
- **Monsters.** The same layout and the same draft rules: "Save monster" (one undo step), "Cancel" (shows the saved monster again), "Delete monster" (pushed right, not on a new monster). The left list has the picker and "Add" under it; a monster added is a draft until saved. The card has the monster's sections (Enemy, Abilities, Spells, Behavior, Actions on it; the last only on a saved monster). Abilities, spells or enemies copied from the Library, or made with "New ability" or "New spell", belong to the draft: Cancel, another monster, another tab or Undo take them out again (never one that was already in the quest or that another monster uses); "Save monster" keeps them, in the same one undo step.
- **Quest tab.** It has no actions card: actions are only in the Actions tab.

## Editor Map tab: tool options in the right card (decisions 104 and 105)

Concept: `design/ui-concept/editor-tools-concept.html`. This replaces the "Tools column" and "Inspector" text of the older editor sections where they differ.

- **Left card (Tools, 230 px).** The tool chips, View (Room ids, Textures) and Reference image. No tool options.
- **Right card (290 px).** Its title is the tool name: "Select", "Rock", "Doors", "Tiles", "Merge rooms"... With Select and nothing picked it shows the hint. With an element picked it shows a small-caps label (Door, Furniture...), the id as title, the fields, Actions and Delete at the bottom. With any other tool it shows that tool's options in the same layout: a small-caps label, chips or fields, one italic note. No tabs.
- **Picking a tool clears the selection** and a half-done pick (first block square, ice tunnel end A). Delete and R act on the selection, so they work with Select only. Tool shortcut keys are unchanged.
- **Problem rows.** Each problem is the shared row (concept `.row`): a 14 px bar at the left edge, a bold title line with the kind and the id ("Door d2", "Tile 1", "Quest"), and a smaller italic line with the sentence. The bar is `--ink` for a problem (it blocks saving) and `--muted` for a warning, the colours the list already used for "Problem" and "Warning". The row is a button at least 56 px high; the screen reader label starts with "Problem" or "Warning".
- **Problems.** The "N problems" button of the title band opens the Problems list in the right card, titled "Problems". The button then shows **pressed**: the picked-tab look (selection colour, ink outline), on the same `.btn.alt.sm`. This is the only new state; no new control. A second tap on it closes the list. There is no Back button: picking any tool chip, even the one already on, shows that tool's options again. A tap on a problem row picks Select and selects the thing it names (a problem of the quest itself opens the Quest tab).

## Merge rooms (decision 106)

Concept: `design/ui-concept/editor-tools-concept.html`, boards M1 to M8. The tool works by tapping rooms on the board; the right card is titled "Merge rooms".

- **Slots.** The first room tapped **stays**; every further room tapped **joins it** (its id goes), one row each, with an empty "Tap a room" row always ready for the next. A tap on a picked room takes it out. A tap on the corridor, rock, outside or a room that is merged already (R14 part of R13) does nothing and says nothing (decision 108).
- **Button.** "Merge" (muted) until a room stays and at least one joins, then "Merge R14, R15 into R13" (the filled button): all in one undo step, all or nothing. A joining room must touch the room that stays or another picked room, in any order. "Clear" (outlined, small) empties both slots. It is muted, with the reason above it, when the merge is refused.
- **Errors are inline**, an ink bar and one sentence, never a toast. They come from the engine and name the room that blocks the merge ("Cannot merge R05: the rooms do not touch", "Cannot merge R14: door d1 is on the wall between them. Remove it first."; nothing is merged), or come from a tap ("R13 has rooms merged into it. Split them first." when it is picked as a joining room). The error goes away at the next tap.
- **List.** "Merged rooms": one row per absorbed room, a bar, "R14 is part of R13", "One room in play.", and Split. A tapped row rings the merged room on the board. "None yet." when empty. Merge and Split are one undo step each; the picked pair and the error clear when the tool changes.
- **Board.** Picked rooms take the selection colour with the small caps "Stays" and "Joins"; every joining room has a dashed outline. A merged room is one outline: the wall between its rooms is a dashed `--off` line and it has one id. Room ids are drawn while this tool is on, even when View > Room ids is off. A door on a wall between the picked rooms is ringed when it is the reason for the refusal.
- **Door tool.** On a wall inside a merged room it refuses, inline in its card: "Cannot add a door: R13 and R14 are one room. Split them first."

## Monsters tool: kinds and cards (owner, 2026-11-26)

Concept: `design/ui-concept/editor-map-monsters-concept.html`. The right card of the Monsters tool, in the same card as every tool (decision 104). It replaces the 9 type chips and the "Custom monsters" group.

- **The list of kinds.** One row per kind, in the Library row look (`.box-pick`): a colour bar, the name, the count. Kinds, in order: **Core game** (the 9 core types), one for each expansion that the library offers an enemy of (by name; a box switched off for the add menus has no kind, and the quest's own enemies of it are under This quest), **This quest** (the enemies the quest already has; listed only when there are some), **My library** (library enemies with no expansion; always listed, even with 0). The list scrolls inside the card, so many expansions fit; the card keeps its height.
- **A kind opened.** Picking a row replaces the list: a header with the **back button** (the title band Back, 44 px square), then the kind row (selection colour, bar, name, count), then the monsters as cards in two columns: the kind in small caps, the name, and the stats "Move · Att · Def · Body · Mind". The picked card takes the selection colour with the offset shadow. My library with no enemy shows only the hint "Make enemies in the Library", where **Library** is a link that switches the editor to its Library tab.
- **The pick.** Tapping a card picks that monster; a tap on the board places it, the tool stays on and the same monster stays picked (so a pack of the same monster is quick). With nothing picked a tap on the board says "Pick a monster on the right, then tap a square." A library enemy is copied into the quest the first time it is placed.
- **The "Placing" row.** While a monster is picked, a row above the kind list or the kind header says "Placing Yeti" with a small italic line "Tap a square to place it." and a **Clear** button, in every view of the card, so going back to the list never hides the pick. The pick is dropped by Clear, another tool, or Esc.
- **Colours.** Every bar (kind rows, the open kind header, cards, the Placing row) is the colour of the box the monster belongs to, as set in My collection (`src/ui/collection.ts`, the colour input of the box; defaults: base game `#6e1f2a`, Frozen Horror `#3b6b8c`). An item with no expansion (This quest, My library) takes the base game colour. The tokens on the board are not changed here.

## Colour bars (owner, 2026-11-26)

One rule for the left bar of every row, card and pick row that stands for a quest or an item.

- **A box colour.** What belongs to a box takes that box's colour from My collection (`src/ui/collection.ts`, set on the colour input of the box row; defaults: base game `#6e1f2a`, Frozen Horror `#3b6b8c`). A bundled quest follows its pack. A copy of a printed quest of an expansion keeps its `pack`, so it keeps the colour. An item of the library or of an enemy follows its `expansion`; an item with no expansion is the base game.
- **Neutral: `--muted`.** Whatever the player made is neutral: a quest made in the editor ("My quests"), an enemy, ability or spell made in the Library ("My library"), "This quest" in the Monsters tool. So is an expansion that no installed box is called after. No new colour.
- **One lookup.** `src/ui/boxBars.ts` (`barOfPack`, `barOfExpansion`, `useBarContext`) gives the colour; no screen picks its own.
- **Where.** The quest grid of Play a quest and Campaign detail (`.qcard` with a 12 px bar), the quests of the editor start list, the Library kinds (neutral) and item cards, the Actions tab rows (neutral), the Monsters tab rows (the enemy's expansion; a core type is the base game; an enemy the player made is neutral), the Monsters tool of the Map tab.
- **Not changed.** The severity bars of the Problems rows (ink for a problem, muted for a warning) mean something else. The monster tokens on the board and the roster keep their fixed colours. The Textures dialog and the Translations rows keep their rows as they are. A copy of a core quest has no `pack` (the base game lists it, the quest file does not say so), so it shows as neutral until the owner decides otherwise.

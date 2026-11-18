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

**Tokens.** paper #EFE6D2 · floor #F7F2E8 · corridor #E4D8C2 · rock #B98A8F hatch · ink #6E1F2A · text #2B1D17 · muted #6D5A4E · monster green #3B6636 (darkened from #3F6B3A so it is 4.5:1 on paper-2) · selection #D9C49A (`--sel`), text on ink #F4ECDD (`--on-ink`), secondary text on ink #E6CFC0 (`--on-ink-2`), token text #F2EBDD (`--token-text`), furniture and door paper #FFFFFF (`--white`), sprung pit tile #3B2A25 and #1E1411 (`--pit`, `--pit-deep`). Fonts: TeX Gyre Bonum Bold (titles, buttons), TeX Gyre Pagella (text). Controls: square corners, 2 px ink outline, offset shadow on notes, press = 2 px shift.

**Removed in the subtraction pass.** Hero Body list (not tracked anymore), explanatory line on the monster note, repeated orders for monsters of the same kind (grouped).

**Prototype limits.** Quest 1 data covers the south-west part only. One pit trap is placed on the south corridor only to show the trap flow; Quest 1 has no traps. Secret door search always finds nothing (true for Quest 1). Not reviewed by an independent reviewer; self-checked on screenshots and recordings.

## Quest and team select (added in M2)

Same shell as the play screen (title band, 920 px left area, right column). Left: 14 quest cards in a grid of five, 2 px ink outline, paper-3 fill; the chosen card takes the selection color (`--sel`) and the ink offset shadow; a quest that is not encoded is greyed out and says "Not encoded yet". Right column: quest title and summary, an optional "Saved game" box (turn, heroes, **Resume**), the four hero chips (toggle, 1 to 4), and one button at the bottom: "Start the quest", or "New game (replaces the saved one)" when a save exists. Roster: a slain monster leaves the list (the log keeps the kill). Toast: text on the dark ink-text bar, with an italic Undo for actions that can be undone (slain, end of turn).

## Notes engine (added in M4)

- **Note sheet**: centered card on a dim veil (prototype `.note`): letter chip, small caps kind, title, text, one button ("Continue"). Several notes from one event show one after the other. A choice (`promptChoice`) is the same card with one button per option and cannot be skipped.
- **Letters**: a note that was read leaves its letter (ink square, light letter) on the map at its square; tap to read again. The right column "Quest notes" lists the same notes (letter or a bullet, first sentence). Notes that were never read leave no trace.
- **Waiting notes**: a seen square with a `squareEntered` note shows a neutral dashed ring with a dot (tap: "Did a hero step here?" Yes / No). A revealed room with an `areaEntered` note shows a small arrow glyph at its top left, and its margin note gets "A hero enters". `manual` notes (buttons for things the app cannot see) are replaced by the element buttons and the Quest sheet (decision 67, see below).
- **Goal**: the right column lists the objectives with a tick box; when all are done: "Goal done. Bring the heroes back to the stairs." "End quest" in the title band asks "Heroes left by the stairs" or "All heroes fell", then the end card ("Quest complete" or "Quest over, goal not reached", objectives, rewards as text, "Back to the quests", "Undo the ending"). After the end the board is read-only (the card covers it); undo still works.
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
- **Rules.** "Falling block rule" (text) and "No equipment until note" (dropdown of the notes). The door teleport and bounty rules are not editable yet.

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

**Playtest.** "Playtest" is a link in the title band, next to Undo. It is off while the draft has errors (the tooltip says why). It plays the draft in the real play screen with all four heroes, a new seed and a temporary game that is never written to the saves. The eyebrow says "Playtest". "Back to editor" replaces "Quests" in the title band and on the end screen, and the editor draft is exactly as it was.

**Zargon view.** In a playtest the title band has a "Zargon view" chip (filled when on, 44 px). It is a view option only: it draws what the heroes have not seen over the fog at 70% opacity (floor and walls of unseen rooms, blocks, every door with secret doors dashed and false doors crossed, furniture, traps as the "?" triangle with a letter P, F, S or C for the kind, markers, and unseen monsters as green coins with a dashed edge and the type letter). It is not tappable and changes no game state, no event and no roster.

## Custom endings and blocked searches (decisions 64 and 65)

**End quest list.** The "How did the quest end?" card lists "Heroes left by the stairs", then one `btn alt` per custom ending of the quest (its label, for example "Sir Ragnar died"), then "All heroes fell" and "Keep playing". A tap ends the quest at once; "Undo the ending" on the end card brings it back.

**End card for a custom ending.** Title "Quest over" (never "Quest complete"), the ending label in bold, the ending text if there is one, then "The goal was done" or "The goal was not done" and the objective ticks. No rewards line. "Back to the quests" and "Undo the ending" as for the other endings.

**Blocked search.** When a treasure search meets a note that blocks it, the note card opens as for any quest note, with one extra line in the `extra` style: "The search was not used. The hero keeps the action." No card is drawn, no result sheet follows, and the hero is not greyed in "Who searches?".

## Quest sheet, element buttons and messages (decision 67)

Goal: the board stays the center, the side column stops growing, and every message and button has one clear home. Inspired by the focused overlays of Imperial Commander 2: a clear hierarchy, and sheets that leave the board readable around them. No new colors, fonts or control styles.

**Mockup.** Open `design/play-a/quest-sheet.html` (six clickable states: title band and side column, Quest sheet, element button, room label, message sheet, start sheet). Screenshots are in `design/play-a/shots/qs-*.png`. The mockup uses the quest 1 board with sample texts, so the content of the sheet is an example, not quest data.

**Title band.** Quest, turn, then a second line with the **current goal**: the first objective that is not done, in one line ("Goal: Find the Talisman of Lore"). Buttons on the right, all 44 px tall `btn alt` chips: **Quest**, Undo, End quest. A small ink dot on the Quest chip means a confirm button is available now (an objective with `confirm` whose `confirmWhen` holds). End quest stays its own menu and is never reached from a quest button.

**Side column (right), after the change.** Heroes, Companions, Monsters in play (alive only), the wandering monster line, the Zargon's turn button. No objectives list, no journal, no Quest actions block. Less scrolling: the list of monsters is the only part that can grow.

**Quest sheet.** Opens from the Quest chip. A panel that slides in from the right over the side column and the right 150 px of the board (420 px wide, paper-3 fill, 2 px ink outline on its left edge, offset shadow like `.note`). The rest of the board stays visible and untinted (no dim veil); tapping the board, Esc or "Close" closes it. Focus moves to the heading; Tab stays inside while it is open. Slide-in 220 ms with the ink ease; instant with reduced motion. Content, top to bottom, scrolling inside the panel only:

1. Header: small caps "Quest 5", the title, Close.
2. **About this quest**: the quest intro (the same summary as on the quest list), so the story can be read again in play.
3. **At the start**: the start instruction (the text of the `questStart` note), so it can be read again.
4. **Goal**: one row per objective with a tick box (same as today). A row that has a `confirm` button and is not done shows the button under it (`btn alt`, full width, 48 px): for example "All surviving heroes have left by the stairs". A button whose `confirmWhen` does not hold yet is not shown.
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

**Touch and keyboard.** All hit areas 44 px or more. Quest sheet buttons are reachable by Tab in reading order. The goal line in the title band is plain text, not a control.

**What changes in the code (for ui-dev).** New components in `src/ui/play/`: `QuestSheet`, `ForThisQuest` (inside the margin notes), `RoomLabel`. New engine views: `eventLog(level, events)` (pure, derived from the event list), and a lookup of notes by target (`notesOf`, exists). The sidebar loses `Objectives`, `Journal` and `QuestActions`. The title band gains the goal line and the Quest chip.

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

**Editor: abilities and spells are dropdown lists (decision 70, replaces the ability chips of decision 69).** In the monster inspector the sections **Abilities** and **Spells** are lists of rows (name, its text or questions, a Remove button), then a row with a dropdown ("Add an ability…", "Add a spell…"), an **Add** button and **New ability…** or **New spell…**. A spell row has a **cast limit** dropdown (Once in the quest, Twice, 3 to 5 times: the number of times the spell is listed) and, for the quest's own spells, "Edit the spell…". **New ability…** and **New spell…** make the item, put it on the monster and open its popup, the same dialog shell as the action popup: the ability popup has Name, Kind (Ability, Weakness, Immunity), What it does, who uses it and Delete; the spell popup has Name, What it does, **When the monster may cast it** (one row per situation with its question and Remove, a dropdown to add more, or one question of the author's own), Offer it only when (Always, or the quest has an escape point), a warning and Delete. The quest fields list the quest's own abilities and spells with Edit, and "Add an ability" and "Add a spell". The special flag stays one toggle.

**Monster pictures (decision 70).** A monster with an image shows it in its token circle (clipped to the circle, the code as a small ink label at the bottom) and in its roster coin. A monster without one keeps the green coin with the code. An enemy's letter replaces the letter of the type in the code (the Marsh Goblin with letter M is M1, M2...).

**Editor frame (decision 70, `design/play-a/editor-mockups.html`).** The editor has a top bar with the tabs **Quest, Map, Actions, Monsters, Library** (the open one is filled with ink) and, under it, a slim row with the quest status and the file actions (Problems, Playtest, Undo, Redo, Import, Export, Save, Back). Each tab is a frame of three columns of panels (`src/ui/shared/Frame.tsx`, classes `fr-*`): lists on the left, cards in the middle, details on the right. Quest: Actions list; General and Objectives; Rules, Wandering monster, Ending, Abilities and spells. Map: the board with its tools and inspector. Actions: the list of every action. Monsters: the monsters of the quest; Enemy, Abilities, Spells; Behavior and Actions on it. Library: the library (Abilities, Spells, Enemies, Heroes, Companions) with Core and Mine lists, New and Copy, the card of the selected item, Used in and Token. Core items are read only. The start screen shows recent quests and four cards: New quest, Open quest, Library and Packager (later, disabled). Popups start under the action row.

## Play screen: title band and right column

**Title band.** The quest title is on top (26 px, one line). Under it, small: the quest number and the goal (one line, ellipsis when long; the full text is the tooltip and is on the Quest info sheet). On the right: Turn, Undo, Quest Info, End quest, Quests. Nothing in the band wraps: a long title such as "Barak Tor: Barrow of the Witch Lord" must not break the buttons at 1194 px.

**Right column, top to bottom.** Heroes (a compact row, always shown) · Monsters in play (a paper-3 panel that takes all the height that is left and scrolls inside) · a footer set apart by a hairline: the wandering monster line (quiet, 14.5 px muted), Add a monster (outlined), and Zargon's turn (the one filled button, 68 px tall). The panels are not collapsible: what the players check each turn (who fell, which monsters are out) stays in sight.

## One set of rules for all screens

**Three action tiers, on every screen.** (1) **Filled**: the one main action of the screen (Resume and Start on the select screen, Zargon's turn in play, Save in the editor). Filled ink also means "chosen" for toggles and tools (`aria-pressed`). (2) **Outlined chip**: every other action (Undo, Redo, Quest Info, End quest, Playtest, Import, Export). Disabled ones are struck through. (3) **Italic link**: only to leave the screen (Quest editor, Quests, Back). Undo is a chip everywhere.

**Tabs are not chips.** The editor tabs (Quest, Map, Actions, Monsters, Library) are folder tabs: the open one has the page color and joins the page under the bar, the others are paper-2. A filled ink box is never a tab, so a chosen tool next to the tabs is not confused with navigation.

**Quest identity.** A quest is always shown as "QUEST N" (small caps, ink-2) over its title (bold, ink) on paper-3 with a 2 px ink outline. The select screen uses it in a grid of cards; the editor's recent list uses it in rows, with the status (Unsaved draft or Saved, and the date) and Delete on the right.

**Names.** Whole tool: Quest editor. Library of abilities, spells, enemies, heroes and companions: Library (decision 77). Buttons and labels use sentence case ("Quest info", "End quest", "Add a monster").

## Themes and texture packs (decision 78)

Every board (play, Zargon view, editor, debug board) draws floor squares and the rock fill through `src/ui/theme/draw.tsx`, and furniture through `Furniture.tsx`, using the active theme (`src/ui/theme/`). The built-in theme has no pictures and is the line art described above: nothing changes unless a theme gives a picture. A theme slot is one picture (floor and corridor: a list used in turn by square, so the floor does not repeat; rock: one tile; furniture: one picture per type, stretched over the footprint and turned by 90 degrees when the piece stands the other way than the picture's `cells`). A slot with no picture falls back to the built-in drawing. A theme cannot change the UI tokens, contrast or touch sizes. In development `?theme=test` loads flat test pictures. Not built yet: walls, doors, traps, stairs, markers, tokens, the pack file (`.sqtextures`) and the picker.

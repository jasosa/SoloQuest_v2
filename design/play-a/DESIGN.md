# Play screen · design note (Direction A, Quest Book Map)

**User and setting.** 1 to 4 players at the physical board, one tablet in landscape (1194 x 834) next to it. The app is Zargon's map: it shows what the heroes can see and gives the monsters their orders. It does not track hero or monster positions, Body Points, gold or equipment.

**North star.** Zargon's own quest map, coming alive as the heroes explore.

**Decisions (Nov 2026)**

- Failed jump: the trap springs with its normal rules (pit, falling block, spear roll, chest effect).
- No hero Body Point tracking. Monster targets use only hero class and monster type.
- No gold, equipment or artifact tracking between quests.

**Layout.** Title band (quest, turn, undo) · board 26 x 19 at 34 px a square · right column: goal, Zargon info, monsters in play, quest notes read, wandering monster, Zargon's turn button.

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

**Tokens.** paper #EFE6D2 · floor #F7F2E8 · corridor #E4D8C2 · rock #B98A8F hatch · ink #6E1F2A · text #2B1D17 · muted #6D5A4E · monster green #3F6B3A · selection #D9C49A (`--sel`), text on ink #F4ECDD (`--on-ink`), secondary text on ink #E6CFC0 (`--on-ink-2`), token text #F2EBDD (`--token-text`), furniture and door paper #FFFFFF (`--white`), sprung pit tile #3B2A25 and #1E1411 (`--pit`, `--pit-deep`). Fonts: TeX Gyre Bonum Bold (titles, buttons), TeX Gyre Pagella (text). Controls: square corners, 2 px ink outline, offset shadow on notes, press = 2 px shift.

**Removed in the subtraction pass.** Hero Body list (not tracked anymore), explanatory line on the monster note, repeated orders for monsters of the same kind (grouped).

**Prototype limits.** Quest 1 data covers the south-west part only. One pit trap is placed on the south corridor only to show the trap flow; Quest 1 has no traps. Secret door search always finds nothing (true for Quest 1). Not reviewed by an independent reviewer; self-checked on screenshots and recordings.

## Quest and team select (added in M2)

Same shell as the play screen (title band, 920 px left area, right column). Left: 14 quest cards in a grid of five, 2 px ink outline, paper-3 fill; the chosen card takes the selection color (`--sel`) and the ink offset shadow; a quest that is not encoded is greyed out and says "Not encoded yet". Right column: quest title and summary, an optional "Saved game" box (turn, heroes, **Resume**), the four hero chips (toggle, 1 to 4), and one button at the bottom: "Start the quest", or "New game (replaces the saved one)" when a save exists. Roster: a slain monster stays in the list greyed and struck through, with "Slain" instead of Body Points. Toast: text on the dark ink-text bar, with an italic Undo for actions that can be undone (slain, end of turn).

## Notes engine (added in M4)

- **Note sheet**: centered card on a dim veil (prototype `.note`): letter chip, small caps kind, title, text, one button ("Continue"). Several notes from one event show one after the other. A choice (`promptChoice`) is the same card with one button per option and cannot be skipped.
- **Letters**: a note that was read leaves its letter (ink square, light letter) on the map at its square; tap to read again. The right column "Quest notes" lists the same notes (letter or a bullet, first sentence). Notes that were never read leave no trace.
- **Waiting notes**: a seen square with a `squareEntered` note shows a neutral dashed ring with a dot (tap: "Did a hero step here?" Yes / No). A revealed room with an `areaEntered` note shows a small arrow glyph at its top left, and its margin note gets "A hero enters". `manual` notes become buttons in "Quest actions" (right column, hidden when none).
- **Goal**: the right column lists the objectives with a tick box; when all are done: "Goal done. Bring the heroes back to the stairs." "End quest" in the title band asks "Heroes left by the stairs" or "All heroes fell", then the end card ("Quest complete" or "Quest over, goal not reached", objectives, rewards as text, "Back to the quests", "Undo the ending"). After the end the board is read-only (the card covers it); undo still works.
- **Helpers**: an NPC is a text chip (name, defend dice, text) above the monsters. No Body Points.
- **Statues**: a dormant monster is drawn as a small statue figure (line art, ink on white), not in the roster, not tappable. When a note wakes it, it stamps in like any monster. A monster placed by a note shows its token on the named square, a margin note "Put X here" and a pulsing ring on the square. Roster lines: "Stone: n turns", "Placed by a quest note".

## Zargon's turn: one monster at a time (decision 34)

The page of the prototype is gone: no list, no grouping, no "Who can it reach?" mode. The button "Zargon's turn" (right column, "n monsters to act") starts a sequence of cards over the map, one monster per card, in reveal order: small caps "Monster 2 of 7", a letter chip with the monster code (same letters as the map tokens), the name, a stats line (Move, Att, Def, Body, Mind), then Target, Tie (always), Plan and Special rules. The card has no dim veil and sits in the empty upper right of the map, so the figures stay in sight: the monster's token gets the selection ring and its roster row is brought into view. A caster shows a boxed spell block: the one picked spell (name, "Read the Dread spell card.", "If it cannot cast: ..."), "Could it cast it?" with "Yes, it cast it" and "No". "Done" sends the order done and the next card rises in (instant with reduced motion). Stone monsters and fresh wanderers get a short card with "Next" (no event). After the last one: "All monsters have acted" with "End Zargon's turn" (no monsters: "No monster to act"). "Back to the map" or Esc closes only the top card; pressing the button again resumes at the first monster not done. If every hero fell the card says "All heroes have fallen" with "End quest".

## Heroes block (decision 32)

Right column, above the monsters: one square chip per hero of the team. A tap asks "<Hero> fell?" (margin note, "Yes, fell" or "No"). A fallen hero is struck through and cannot be tapped; undo takes it back. Nothing else about heroes is shown. When the last hero falls a card says "All heroes have fallen" with "End quest".

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

**Notes tab, one note.** "All notes" link, the id, then: Letter (one capital, never X), "Letter drawn at" (a square), Text, "No treasure card is drawn". Sections "When it fires" (trigger dropdown and the fields of that trigger), "Only if" (condition rows) and "Then" (effect rows), then "Delete note". Each condition or effect is a row: paper-3 card with a 1.5 px ink border, its name in Bonum, a "Remove" chip, then its fields. A dropdown at the end of the list ("Add a condition", "Add an effect") adds a row at once. "Ask the players" holds answer cards, each with its own button label and effect list. Text fields save on blur, chips and dropdowns at once, every change is one undo step.

**Click it on the board.** Doors, squares and areas can be typed or picked: the button "Click it on the board" starts a pick. A margin-note style bar sticks to the top of the inspector with the instruction and "Cancel" (Esc also cancels), the board hint line repeats it, and the next board click is the answer (a click that does not fit says why in a toast and keeps waiting). Picking does not select or move anything.

### Import and export in the editor (M6)

Header links "Import" and "Export" (before "Save"). "Export" downloads `<title-slug>.hqquest.json` without `userText`; with errors it refuses with a toast that counts them, warnings do not block. "Import" opens a file and loads it as one undo step, keeping the draft's id. A **sheet** (paper-3, 2 px ink outline, offset shadow, centered over a dim backdrop, 200 ms rise) asks "Replace your draft?" with "Replace the draft" and "Keep my draft" when the draft is not blank, and lists import errors readably with a "Close" button.

### Reference image (M6, slice 3)

A local picture (a photo or scan of a map) to trace from. It stays on this device: in memory and, per quest id, in its own IndexedDB table. It is not part of the quest, so it is never in `.hqquest.json`, never in git and never uploaded.

**Tools column, "Reference image" block** (under "View"): "Load image" (file picker; a file dropped on the board works too), then once loaded "Change image", "Align corners" ("Align again" when set), "Hide image" or "Show image" (filled chip while shown), an "Opacity" slider (44 px high, ink accent) and "Clear image". A file that is not an image is refused with a toast.

**Align.** Loading opens a full screen page in paper, with a margin-note bar on top ("Tap the top left corner of the map frame. (1 of 4)"), zoom chips "Fit", "2x", "3x" (the page scrolls), "Undo point" and "Cancel". Four taps, in order top left, top right, bottom right, bottom left, on the corners of the map frame. Each tap leaves a numbered `--sel` dot. The fourth tap saves and closes. Points that do not make a convex four sided shape are refused with a toast and start again. The four points are mapped to the four corners of the 26 x 19 board with a perspective transform (`reference.ts`), so a tilted photo lines up.

**On the board.** The image is drawn over the board art at the chosen opacity (default 50%) and ignores the pointer, so every tool keeps working through it. Overlay rather than underlay: the squares are opaque, so an image below them would not show.

### Problems and playtest (M6, slice 3)

**Problems tab.** The inspector has a third tab, "Problems", with an ink-outlined count (all issues). The three tab chips share the 274 px column on one line (14 px text). The title band counter ("2 problems", "1 warning", "No problems") opens this tab. The tab lists every issue of the draft, errors first, then warnings, in the engine's order inside each group. A row is a 44 px or taller button: a bold Bonum word ("Problem" or "Warning"), the kind of thing it names in small italics ("Furniture", "Door", "Note", "Quest"), then the sentence. Under the heading, "(n to fix before saving)" counts the errors.

**Jump.** A tap on a row opens the thing it names. Doors, furniture, monsters, traps, markers and blocks are selected on the board and the Element tab opens so it can be fixed. A note opens in the Notes tab. An area is flashed on the board and the Problems tab stays. Objectives, helpers and the quest itself show the Element tab with the quest fields. The board answers with a flash: an ink 3 px outline on the square (a `--sel` wash at 50% on every square of an area), pulsing like the selection ring, gone after 1.8 s. With reduced motion it stays still for the same time.

**Playtest.** "Playtest" is a link in the title band, next to Undo. It is off while the draft has errors (the tooltip says why). It plays the draft in the real play screen with all four heroes, a new seed and a temporary game that is never written to the saves. The eyebrow says "Playtest". "Back to editor" replaces "Quests" in the title band and on the end screen, and the editor draft is exactly as it was.

**Zargon view.** In a playtest the title band has a "Zargon view" chip (filled when on, 44 px). It is a view option only: it draws what the heroes have not seen over the fog at 70% opacity (floor and walls of unseen rooms, blocks, every door with secret doors dashed and false doors crossed, furniture, traps as the "?" triangle with a letter P, F, S or C for the kind, markers, and unseen monsters as green coins with a dashed edge and the type letter). It is not tappable and changes no game state, no event and no roster.

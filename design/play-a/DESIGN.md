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

**Zargon's turn** is a page sliding in from the right over the column. Two modes:
- *Priority list* (default): no input. Each monster gets a **target rule drawn every turn** from weights that depend on its type (closest, last attacker, fewest Body Points left, most Body Points, fewest defend dice, most attack dice, a spellcaster, or a grudge against one named hero that stays for the whole quest), **always with a tie list**, plus a plan. Players use their character sheets to apply the rule. Monsters with the same order this turn share one entry. See `docs/ZARGON_AI.md`.
- *Who can it reach?*: players tap reachable heroes per monster (and "already next to that hero"); the app names one target and the plan.

**Motion.**
1. Main action feedback: opening a door spreads the revealed area like ink from the door (650 ms, ease-out); new monster tokens stamp in (320 ms, 70 ms stagger); they slide into the roster.
2. State change with a source: margin note grows from the tapped object; Zargon page slides in from the right (340 ms); mode switch uses one moving thumb.
3. First entry: none beyond the margin note (the board is the content; no splash).
Reduced motion: everything lands at once.

**Tokens.** paper #EFE6D2 · floor #F7F2E8 · corridor #E4D8C2 · rock #B98A8F hatch · ink #6E1F2A · text #2B1D17 · muted #6D5A4E · monster green #3F6B3A · selection #D9C49A (`--sel`), text on ink #F4ECDD (`--on-ink`), secondary text on ink #E6CFC0 (`--on-ink-2`), token text #F2EBDD (`--token-text`), furniture and door paper #FFFFFF (`--white`), sprung pit tile #3B2A25 and #1E1411 (`--pit`, `--pit-deep`). Fonts: TeX Gyre Bonum Bold (titles, buttons), TeX Gyre Pagella (text). Controls: square corners, 2 px ink outline, offset shadow on notes, press = 2 px shift.

**Removed in the subtraction pass.** Hero Body list (not tracked anymore), explanatory line on the monster note, repeated orders for monsters of the same kind (grouped).

**Prototype limits.** Quest 1 data covers the south-west part only. One pit trap is placed on the south corridor only to show the trap flow; Quest 1 has no traps. Secret door search always finds nothing (true for Quest 1). Not reviewed by an independent reviewer; self-checked on screenshots and recordings.

## Quest and team select (added in M2)

Same shell as the play screen (title band, 920 px left area, right column). Left: 14 quest cards in a grid of five, 2 px ink outline, paper-3 fill; the chosen card takes the selection color (`--sel`) and the ink offset shadow; a quest that is not encoded is greyed out and says "Not encoded yet". Right column: quest title and summary, an optional "Saved game" box (turn, heroes, **Resume**), the four hero chips (toggle, 1 to 4), and one button at the bottom: "Start the quest", or "New game (replaces the saved one)" when a save exists. Roster: a slain monster stays in the list greyed and struck through, with "Slain" instead of Body Points. Toast: text on the dark ink-text bar, with an italic Undo for actions that can be undone (slain, end of turn).

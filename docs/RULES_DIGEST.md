# Rules digest

The parts of the HeroQuest 2021 rules the app implements, in our own words. Page numbers refer to the printed rulebook. When in doubt, the rulebook wins; when the rulebook and a house rule below disagree, the house rule wins.

## Turn order

- Heroes play one by one (clockwise from Zargon's left), then Zargon moves all monsters on the board. Repeat. (p. 10-11)
- A hero may move then act, or act then move; never move part way, act, and finish the move. Same for monsters. (p. 11, 20)
- Hero actions: attack, cast a spell, search for treasure, search for secret doors, disarm a trap. (Search for traps is **removed**, see house rules.)
- Looking, opening doors, drinking potions, picking things up are free (not actions). (p. 12)

## Looking and revealing (p. 12-13)

- While moving, a hero may look down a corridor or through an open door. Zargon places closed doors, blocked squares and monsters that are in the hero's line of sight. A line through a wall or a closed door blocks sight.
- Opening a door: Zargon places the monsters, chests and other furniture of the room behind it. **Not** treasure, **not** secret doors. Doors never close again.
- Blocked squares are placed as soon as they are visible.

**App**: room behind a door: whole room. Corridor behind a door: line of sight from the square beyond the door. "Look from here" on a corridor square: line of sight from it.

## Line of sight (p. 14)

Draw a straight line from the center of one square to the center of the other. If it crosses a wall or closed door (or a figure, for spells only), there is no sight. A line that only touches a corner or a wall edge still sees.

**App**: walls, closed doors, rock and blocked squares stop reveal. Figures and furniture do not stop reveal. A room is never partly revealed: when sight reaches any square of a room, the whole room is shown.

## Search for treasure (p. 14-15)

- Rooms only, never corridors. Only if no monster is in the room.
- Each hero searches a room once, on their own turn. The figure does not move.
- Special treasure in the quest notes goes to the **first** hero who searches; later searches in that room get nothing special.
- No special treasure: draw a treasure card. About half the cards are wandering monsters or hazards.
- **Wandering monster card**: the quest names the monster. Place it next to the searching hero; it attacks that hero at once (and only that hero this round). The hero defends normally, then goes on with the turn.
- Chest trap not found and disarmed: searching for treasure springs it first (effect from the quest note), then the search goes on (decision 22).

## Search for secret doors (p. 16-17)

- Only if no monster is visible to the hero.
- Zargon shows every secret door in the room or corridor where the hero is. It still has to be opened (move next to it, open it). Once open it never closes.
- Quest notes can change this (e.g. Quest 5, note E).

## Traps (p. 16-19) and the house rule

Official kinds: pit, falling block, spear, chest/furniture. Frozen Horror adds stalactite (1 BP, first hero only), swinging axe (2 combat dice, no defend, hits every hero until disarmed), wandering monster trap (once, hero stops, the quest's wandering monsters attack at once), slippery ice (1 combat die per square, white shield = fall) and the ice slide (hero is moved to the last square, 1 combat die, white shield = 1 BP). The last three cannot be found or disarmed, so a disarm try always springs them (decision 41). Positions are on the quest map.

**House rule (decided)**:
- Traps on a square (pit, falling block, spear) are **visible** as a "?" as soon as their square is seen (room revealed or square in line of sight). The **kind** stays hidden.
- There is **no general search for traps**. One exception, **chests only** (decision 25): chest traps are hidden. A hero can search a chest for traps once; that one search finds every trap on it and puts a "?" on the chest. Disarm it with the rules below (jump and step do not apply to a chest). A chest trap that was never found or never disarmed springs when a hero searches the room for treasure.
- Players choose:
  - **Jump**: needs 2 squares of movement left (onto the trap and one free square beyond). Roll 1 combat die: anything but a skull = jumped, the trap stays. Skull = the trap springs (normal effect for its kind) and the hero stays on the trap square, turn ends.
  - **Disarm**: the hero announces it before moving, moves onto the square, rolls 1 combat die. Dwarf: only a black shield springs it. Any other hero needs a tool kit: a skull springs it. Success removes the trap and the app tells its kind.
  - **Step on it**: the trap springs.
- Monsters never spring traps.

Spring effects (official):
| Kind | Effect |
|---|---|
| Pit | 1 Body Point, pit tile on the square, turn ends. In the pit: 1 fewer combat die (minimum 1) to attack and defend; climb out next turn. A sprung pit can be jumped later, not disarmed. |
| Falling block | Roll 3 combat dice, 1 Body Point per skull, no defend. Block tile on the square, it is a permanent wall. The hero moves to a free square ahead or back (their choice), turn ends. Cannot be jumped or disarmed after. |
| Spear | Roll 1 combat die: skull = 1 Body Point and turn ends; shield = dodged, keep moving. The trap is gone either way. No tile. |
| Chest / furniture | Effect written in the quest note. |

Quest overrides exist (Quest 12 note C scripted falling block; Quest 13 falling-block squares roll 1 red die).

## Zargon's turn (p. 20-21)

- Every monster on the board may move (up to its Move) and do one action: attack an adjacent hero, or cast a Dread spell if the quest gives it spells.
- Monsters may not: search, move or attack diagonally, pass over heroes, go through walls, open or close doors, share a square.
- A monster may move then act, or act then move.
- Dread spells: only on a hero the monster can see; each spell once per quest unless the quest says otherwise.
- **In the app**: Zargon's turn shows one monster at a time in a dialog, with a target rule, a tie list of the living heroes and a plan (`docs/ZARGON_AI.md`). The app tracks only whether a hero died (decision 32); a dead hero is out of every tie list and cannot search or disarm. A caster gets one random spell it still has; the players say whether it could be cast.

## Combat (p. 13, 20-21), for reference only

Players roll all dice. Attack: each skull = 1 hit. Hero defends with white shields, monster with black shields. The app optionally tracks monster Body Points (wound/heal on the monster). It never tracks hero Body Points.

## Ending a quest (p. 22)

Done when the goal is reached and the heroes are back on the stairway, or the heroes leave early by the stairway, or all heroes die. Rewards are shown as text; the app does not track gold.

## Monster stats (verify with the monster cards, they are not in the PDFs)

| Monster | Move | Att | Def | Body | Mind |
|---|---|---|---|---|---|
| Goblin | 10 | 2 | 1 | 1 | 1 |
| Orc | 8 | 3 | 2 | 1 | 2 |
| Abomination | 6 | 3 | 3 | 2 | 3 |
| Skeleton | 6 | 2 | 2 | 1 | 0 |
| Zombie | 5 | 2 | 3 | 1 | 0 |
| Mummy | 4 | 3 | 4 | 2 | 0 |
| Dread warrior | 7 | 4 | 4 | 3 | 3 |
| Gargoyle | 6 | 4 | 5 | 3 | 4 |

Named monsters from the Quest Book: Ulag (Q3) 10/4/5/2/3; Grak (Q6) 8/4/4/3/3, fear, sleep, tempest, one spell per turn; Balur (Q8) 8/2/5/3/7, fire spells do not affect him, ball of flame, firestorm, tempest, summon orcs, fear, escape (to XX); Witch Lord (Q12) moves 1, 2 attack dice, only the Spirit Blade harms him; Witch Lord (Q14) 10/5/6/4/6, fear twice.

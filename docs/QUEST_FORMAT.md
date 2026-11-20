# Quest format (`src/content/quests/qNN-<slug>.json`)

One JSON file per quest. Validated by the Zod schema in `src/engine/quest/schema.ts` (`npm run validate`). Schema version starts at `1`; any breaking change needs a migration in `src/engine/quest/migrate.ts`.

## Conventions

- Cell: `[x, y]`, `x` 0..25 left to right, `y` 0..18 top to bottom, as on the Quest Book map with the title below it.
- Area id of a cell: `board.json` (`"C"` corridor, `"R01"`..`"R22"` rooms).
- Door: an edge between two orthogonal neighbor cells, `{ "a": [x,y], "b": [x,y] }`. Order does not matter.
- Ids are short and stable inside the quest: `d1`, `m1`, `f1`, `t1`, `n-A`.
- Text fields are **paraphrased** (see CLAUDE.md hard rule 1). `userText` fields are never shipped: they exist only in the editor's local storage.

## Top level

```jsonc
{
  "schemaVersion": 1,
  "id": "q01-the-trial",
  "number": 1,
  "title": "The Trial",
  "intro": { "summary": "Find and destroy Verag, the gargoyle hiding in the catacombs." },
  "start": { "area": "R20" },                 // area revealed at start (stairway room, or e.g. Q6 "Cell")
  "rock": { "rooms": ["R04", "R05"], "cells": [[12, 1], [13, 1]] },   // dark shaded on the map
  "doors": [ { "id": "d1", "a": [3, 17], "b": [3, 18] } ],
  "secretDoors": [ { "id": "s1", "a": [9, 4], "b": [8, 4] } ],
  "falseDoors": [ { "id": "x1", "a": [5, 2], "b": [5, 3] } ],
  "blocks": [ { "cells": [[14, 18]] }, { "cells": [[12, 5], [13, 5]] } ],   // single or double blocked squares
  "furniture": [ { "id": "f1", "type": "weaponsRack", "cells": [[11, 15], [11, 16], [11, 17]], "letter": "A" } ],
`furniture` may have `"turn": 1 | 2 | 3` (quarter turns clockwise made in the editor; left out for 0). It is drawing only: `cells` is the real footprint. The editor's Rotate turns a piece in place around the middle of its squares and always allows the turn, even onto squares that are taken, so a half turn (same squares, facing the other way) can be reached through a quarter turn that does not fit; the checks of Save and Playtest look at the final position. A texture pack turns the piece's picture with it.
  "monsters": [ { "id": "m1", "type": "orc", "cell": [7, 14] } ],
  "traps": [ { "id": "t1", "kind": "pit", "cell": [11, 18] } ],
  "zones": [ { "id": "z1", "cells": [[3, 16], [4, 16]] } ],   // a set of squares: "a hero enters" and buttons (decision 68)
  "markers": [ { "id": "k1", "label": "X", "cell": [4, 2], "visible": "editor" } ],
  "notes": [ /* see below */ ],
  "wandering": { "monster": "orc", "count": 2 },          // or { "text": "Ollar's ghost appears, laughs and vanishes." }
  "objectives": [ { "id": "o1", "text": "Destroy Verag", "done": { "monsterKilled": "m-verag" } } ],
  // objective `done` rules: { "monsterKilled": id } | { "allKilled": [ids] } | { "allSeenKilled": true } (every monster the players have seen is slain, at least one) | { "flag": name }
  "rewards": "",                              // text only (e.g. "240 gold coins, shared"), never tracked
  "endText": "",                              // optional closing note, shown on the end screen after every ending
  "rules": { },                               // quest-wide overrides, see below
  "npcs": [ ],                                // e.g. Sir Ragnar
  "endings": [ { "id": "ragnar-died", "label": "Sir Ragnar died", "text": "optional end screen text" } ]  // optional
}
```

### False doors

`falseDoors` look like doors on the map, but they never open (decision 29). The players can try: the app logs the try and says the door is stuck (prompt `doorStuck`). The door stays closed, still blocks sight, and no `doorOpened` note fires for it. `openAllDoors` skips them.

### Furniture types

`stairs`, `table`, `sorcerersTable`, `alchemistsBench`, `bookcase`, `cupboard`, `chest`, `throne`, `tomb`, `rack` (torture rack), `weaponsRack`, `fireplace`. Footprint = the `cells` list, read from the map (do not assume a standard size; rotation is implied by the cells).

### Monster types

`goblin`, `orc`, `abomination`, `skeleton`, `zombie`, `mummy`, `dreadWarrior`, `gargoyle`, `dreadSorcerer` (figure for named characters). Optional per monster:

```jsonc
{ "id": "m-verag", "type": "gargoyle", "cell": [x, y], "name": "Verag",
  "overrides": { "att": 4 },                  // stat changes
  "state": "dormant",                         // a statue (Q5 B, Q11 B): furniture until an effect sets it active (decision 28)
  "spells": ["fear", "sleep", "tempest"], "spellLimit": "onePerTurn",
  "hidden": true                              // not placed by sight; placed by an effect (Q8 Balur at XX)
}
```

Monster behavior fields (all editable in the Monsters tab): `state` (`active`, `dormant`, `stone`, `passive`), `behavior` (`waitsFor`, `goesToward`), `attacks` (2 or 3 attacks per turn), `special`, and `attackOnly: true`: the monster is attacked, not fought (no wounds, no Heal, no Slain). What an attack does is an action on the monster: a `manual` note ("A hero attacked it") with effects such as a text, `giveItem` and `setMonsterState` `away`. There is no special "surrender" in the engine: a surrender is that action. Actions can also wake a monster (`setMonsterState` `active`), free it (`away`) or react when it escapes (`monsterLeft`).

`spells` lists spell ids (core or the quest's own `spellDefs: [{ id, name, text?, tags[] | question, situations?, warning?, offerWhen? }]`); a spell listed twice can be cast twice (the cast limit). Tags are the situation tags of `ZARGON_AI.md`, or an id the spell defines itself in `situations: [{ id, question }]` (the id must not be a fixed tag, a tag must be fixed or defined by the same spell); `offerWhen: "escapePoint"` offers a spell only when a note reacts to it being cast. `enemy` points at an enemy of the quest (`enemyDefs: [{ id, name, base?, letter?, image?, overrides?, profile?, weights?, abilities?, spells?, traits? }]`; `base` is the core type it starts from; without it the enemy is its own and needs all five stats in `overrides`; `profile` is `skirmisher`, `fighter`, `relentless` or `caster`, `weights` is a weight 0 to 9 per target rule, see `ZARGON_AI.md`; a monster of an enemy with no base carries `type: goblin`, and the enemy's stats, plan and weights win) that gives defaults: the name, stat overrides (the monster's own win), abilities and traits (both are added), spells (the monster's own list replaces) and the picture. `letter` (1 or 2 characters) is the letter of the token code instead of the letter of the type; `image` is a small png, jpeg or webp data URL (100 KB at most). Without an image the token shows the letter icon. `behavior` is a prompt for the players, never enforced: `waitsFor` (`heroInSight`, `heroInRoom`, `heroAdjacent`) and `goesToward` (`strongestHero`, `weakestHero`, `stayPut`, `marker` with a `marker` id of the quest). It shows first on the monster's Zargon order. `attacks` (1 to 3) is the number of attacks per turn: one target rule is drawn for each, and the monster moves once. `size: 2` is a large monster of 2 x 2 squares, its `cell` the top left corner. `profile` also takes `thief`, `grappler`, `shooter` and `passive`; `state: "passive"` gives no orders until the players tap "It left" (it leaves the roster, not a kill) or "A hero attacked it" (it turns active). A thief has an "Escaped" button that works the same way. `special: true` marks a story-critical monster (ring and star in play). `abilities` is a list of ability ids from the core library (`stone`, `fireImmune`, `spiritBladeOnly`, `statue`) or the quest's own `abilityDefs: [{ id, name, text, kind? }]` (`kind` is `ability`, `weakness` or `immunity`). An ability alone does not make a monster special. `traits` is a list of short, paraphrased special rule lines (for example "Only the Spirit Blade can harm him"); they are shown first on the monster's Zargon order. Non-empty strings. Overrides for `att`, `def`, `move` and `body` are also shown as lines whenever the key is present, even if it equals the base value.

`spells` uses the keys `escape`, `summon`, `fear`, `sleep`, `ballOfFlame`, `firestorm`, `tempest`, `command` (the validator rejects others). Each listed spell can be cast once per quest. To allow a spell more than once, list it more than once: Witch Lord Q14 has `"spells": ["fear", "fear"]`. `spellOrder` (spell id to place, 1 = first) pins when a spell is offered; spells without a place come at random (Balur: `{ "escape": 1 }`). `spellLimit: "onePerTurn"` needs a `spells` list; it is the explicit form of a rule that holds for every caster anyway (a monster attacks or casts one spell per turn). Casts are tracked with the `SPELL_CAST` event, and a spell the players could not cast with `SPELL_FAILED`. The app offers one random spell the monster still has (decision 31). The app shows the spell name and "read the Dread spell card", never the spell text.

### Trap kinds

`pit`, `fallingBlock`, `spear`, Frozen Horror `stalactite`, `swingingAxe`, `wanderingTrap`, `slipperyIce`, `iceSlide` (the kinds are a table in `src/engine/data/trapKinds.ts`, see `FROZEN_HORROR.md` section 4; an `iceSlide` also needs `"path": [[x,y], ...]`, its squares from the trap square to the last one, each next to the one before), `chest` (on furniture: `"furniture": "f3"` instead of `"cell"`), `scripted` (only by effects, e.g. Q12 C). Optional `"effect"` text for chest traps (paraphrased).

## Notes: trigger + conditions + effects

```jsonc
{
  "id": "n-A",
  "letter": "A",
  "at": [11, 14], // where the letter is drawn once read
  "trigger": { "type": "treasureSearch", "area": "R18", "first": true },
  "when": [{ "monstersAliveIn": "R18", "is": 0 }], // optional conditions, all must hold
  "effects": [
    {
      "type": "showText",
      "text": "The weapons on this rack are chipped, rusted and broken. Nothing is worth taking.",
    },
  ],
  "consumesTreasure": true, // no treasure card is drawn when this fires
  // or: "blocksSearch": true   (treasureSearch only, not together with consumesTreasure)
  // "keepMark": true   (square and zone notes: the mark stays on the map after the note fired)
}
```

`blocksSearch`: searching here is not possible. The note is shown, no treasure card is drawn, no chest trap springs, and the search is NOT recorded: the hero keeps the action and may search elsewhere. Only the blocking notes fire for that search (other notes of the trigger wait). A search with `consumesTreasure` is different: it is used up.

### Endings (optional)

`endings` lists extra ways to end the quest, for example when an NPC dies. Each has a unique `id`, a short paraphrased `label` and an optional `text`. The End the Quest list offers them next to "Left by the stairs" and "All heroes fell". Picking one sends `END_QUEST` with `outcome: "ending"` and `ending: <id>`. The end screen shows the label and text, counts as not won, and shows no reward. Nothing in notes refers to endings.

Migration: `endings` and `blocksSearch` are optional, so old files stay valid and `schemaVersion` stays `1`.

A **throne** may stand on a secret door's square (it hides the door until a treasure search, quest 5): the validator allows that one case. Any other furniture on a door square is an error.

### Note target (decision 67)

A note may name the quest element it belongs to: `"target": { "kind": "door" | "furniture" | "monster" | "trap" | "marker" | "area" | "square" | "zone", "id": "..." }` (`square` ids are `"x,y"`). The target is derived from the trigger when missing (a `doorOpened` note belongs to its door, a `treasureSearch` note to its room, a `squareEntered` note to its square). A `manual` note with a target is a button of that element: it shows under **For this quest** in the element's margin note (the square keeps its ring marker while the button can be pressed), not in the Quest sheet. A `manual` note without a target shows in the Quest sheet. The validator checks that the target exists.

### Triggers

| `type`                        | Params                      | Fires when                                                                                                                                                                                                                                                                   |
| ----------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `questStart`                  |                             | game starts                                                                                                                                                                                                                                                                  |
| `areaRevealed`                | `area`                      | area first revealed                                                                                                                                                                                                                                                          |
| `doorOpened`                  | `door`                      | that door is opened                                                                                                                                                                                                                                                          |
| `areaEntered`                 | `area`                      | players tap "A hero enters" on the area (only shown for areas with this trigger)                                                                                                                                                                                             |
| `zoneEntered`                 | `zone`, `repeat?`           | every seen square of the zone has a ring; a tap asks "Press the button when a hero enters this square" and the button "A hero enters" fires the note. Once by default; `repeat: true` fires every time, from any square, with the same popup                                 |
| `squareEntered`               | `cell`, `repeat?`           | players tap the square marker ("A hero is here")                                                                                                                                                                                                                             |
| `treasureSearch`              | `area`, `first?`            | a hero searches the area for treasure. `first` means the first search of the room by anyone. For "after X happens" notes use `when` (`firstTime` plus a flag or a monster alive), not `first`. Two lettered treasure notes in one room both fire on the same search.         |
| `secretDoorSearch`            | `area`                      | a hero searches the area for secret doors                                                                                                                                                                                                                                    |
| `trapSprung` / `trapDisarmed` | `trap`                      | trap state changes                                                                                                                                                                                                                                                           |
| `monsterSeen`                 | `monster` or `monsterType`  | the first time a matching monster comes into view (any reveal, also at the start). Fires once.                                                                                                                                                                               |
| `monsterKilled`               | `monster` or `monsterType`  | a monster is marked slain                                                                                                                                                                                                                                                    |
| `monsterLeft`                 | `monster?`, `monsterType?`, `reason?` | a monster left the roster without being slain: `escaped` (the Escaped button of a thief) or `freed` (a caged monster that "left"). `reason` limits it. It does NOT fire when an action sets a monster `away` (that action already knows). Use it for "was it the key?" questions (a `manual`-style `promptChoice` effect) or to set a flag. A note for a named monster fires once, otherwise every time. |
| `allKilled`                   | `monsters` (ids)            | the last of them is slain                                                                                                                                                                                                                                                    |
| `spellCast`                   | `monster?`, `spell?`        | a monster casts a Dread spell (after the `SPELL_CAST` event). With both `monster` and `spell` it fires once, otherwise on every matching cast. Example: Balur's escape sets him `away`, a door note places him again.                                                        |
| `questEnds`                   | `outcome?`, `ending?`       | when the quest ends (`stairs`, `fell` or a custom `ending`); the note texts show in the end dialog                                                                                                                                                                           |
| `zargonTurn`                  | `n?`, `every?`              | when Zargon's turn `n` ENDS (`n` = the turn that just ended; `every: k` when that number is divisible by k)                                                                                                                                                                  |
| `manual`                      | `label`, `hint?`, `repeat?` | a button. With a `target` it is a button of that element (under **For this quest**); without one it is in the Quest sheet. `hint` is one plain line shown above the button. `repeat: true` keeps the button after it is pressed (a magic door that every hero goes through). |

`suggestedPack` (optional) is the id of a texture pack the quest looks best with. The quest card shows it as a line. It is only a hint: the app never switches the pack by itself.

Falling-block squares in the Q13 style (a block may fall each time a hero enters) are modeled with `squareEntered` notes with `repeat: true` and a `showText` effect, NOT with `fallingBlock` trap objects. The trap kind `fallingBlock` is the one-shot official trap that leaves a permanent block.

### Conditions (`when`)

`{ "flag": "alarm", "is": true }`, `{ "counter": "kills", "gte": 3 }`, `{ "monster": "m1", "alive": false }`, `{ "monstersAliveIn": "R18", "is": 0 }`, `{ "firstTime": true }`.

State conditions (decision 67): `{ "areaRevealed": "R17" }` (the room is revealed), `{ "doorOpened": "d3" }` (the door is open), `{ "monsterSeen": "m1" }` (the monster was seen), `{ "lookDone": [0, 0] }` (the square is seen and either looked from or has nothing left to show; use it so a button cannot come before the players have looked). They replace silent "set a flag" notes. `firstTime` is not allowed in an objective.

### Objectives with their own rules

An objective `done` may be `{ "when": [conditions] }`: done when all hold, checked after every event. An objective may also have `"confirm": "label"`: a button in the Quest sheet that completes it (event `CONFIRM_OBJECTIVE`), for goals the app cannot see. An objective with `confirm` needs no `done` rule and no helper note. `confirmWhen: [conditions]` hides the button until they hold (for example the stairs room is revealed). Quests 2, 4, 6, 9 and 13 end their goal this way.

### Effects

| `type`                     | Params                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showText`                 | `text`, `title?`                                                                                                                                                                             |
| `revealArea`               | `area` (rooms only, never `C`)                                                                                                                                                               |
| `revealAll`                |                                                                                                                                                                                              | (Q2 alarm: all monsters, doors, furniture) |
| `openAllDoors`             |                                                                                                                                                                                              |
| `placeMonster`             | `monster` (an id with `hidden: true`), `cell?`                                                                                                                                               |
| `setMonsterState`          | `monster`, `state`: `active`/`dormant`/`stone`/`away`, `turns?` (`away` is like dormant but nothing is drawn: a monster that escaped)                                                        |
| `addSecretDoor`            | `door` (reveal a secret door from `secretDoors`)                                                                                                                                             |
| `removeDoor`               | `door` (the door closes and disappears, see Hidden, locked and removed doors)                                                                                                                |
| `crossMap`                 | `link` (the heroes cross to the other end of a link, see Several maps in one quest; put it last in a note)                                                                                   |
| `replaceFurnitureWithDoor` | `furniture`, `door`: the piece is gone for good and the door (declared in `doors`, usually with `hiddenUntil`) stands open where it was; the door may stand on the squares of that furniture |
| `lookFrom`                 | `cell` (what can be seen from that square shows, as if a hero stood there and looked: the exit of an ice tunnel)                                                                             |
| `placeBlock`               | `cells`                                                                                                                                                                                      |
| `giveItem`                 | `text` (shown only, not tracked)                                                                                                                                                             |
| `setFlag` / `addCounter`   | `flag`, `value` / `counter`, `by`                                                                                                                                                            |
| `completeObjective`        | `objective`                                                                                                                                                                                  |
| `spawnNpc`                 | `npc`                                                                                                                                                                                        |
| `promptChoice`             | `text`, `options: [{ label, effects }]`                                                                                                                                                      |

## Quest rule overrides (`rules`)

```jsonc
"rules": {
  "fallingBlock": "q13",            // Q13: roll 1 red die on entering, not blocking
  "doorTeleport": { "dice": "2red", "squares": "markers" },   // Q10
  "noEquipmentUntil": "n-A"         // Q6 banner
}
```

`doorTeleport` is a short text for the table: when a hero crosses a magic door, which dice to roll and which squares the hero can land on. The app shows it, it does not move anyone. The old `bounty` rule was removed (the players track it); quests that still carry it load without it.

## NPCs

```jsonc
"npcs": [ { "id": "ragnar", "name": "Sir Ragnar", "cell": [x, y], "defend": 2, "body": 2,
            "text": "Moved by the hero who opened his cell: 1 red die after that hero's turn. He cannot attack." } ]
```

## Tunnels, board tiles and a wandering enemy (Frozen Horror)

`tunnels: [{ "id": "tun1", "design": 1, "a": [15, 12], "b": [18, 10] }]`: two squares of bare floor that lead to each other. `design` (1 to 9) is the number drawn on both, one pair per design. A tap on a seen end gives the button "A hero used this tunnel" (event `TUNNEL_USE`, `from` is `a` or `b`): the other end is looked from, as after "Look from here".

Terrain is a board tile too: `icyRiver` and `iceLedge`, with the rule in the note of the square or room (see Rule hints in `DESIGN.md`). Terrain changes no sight. The river and the ledge are tiles of a fixed size (see the table below). The old `chasm` board tile (squares laid one by one) is gone from the editor: a file that has a 4 x 4 block of chasm squares loads as the Bottomless Chasm Room tile (`roomTiles`, `chasmRoom`) on the same squares, and any other chasm squares load as they are with a validator warning (decision 93).

`boardTiles: [{ "type": "iceCaveEntrance", "cells": [[0,7],[1,7]] }, { "type": "cage", "cells": [[6,2],[7,2],[6,3],[7,3]], "hiddenWhen": "cageOpen" }]` draws a labeled tile on squares (types in `src/engine/data/roomTiles.ts`). The cave entrance shows from the start and may lie over rock; a cage shows with its squares and goes when the flag `hiddenWhen` is set. The cage is part of the Cage Room tile (`roomTiles`, `cageRoom`, 4 x 4): the editor adds it from that tile, and the validator warns when a cage does not lie inside a Cage Room (decision 93). A tile with `"blocks": true` (needs `hiddenWhen`) also blocks line of sight and squares until that flag is set (decision 56: the cage of Q0 until the lever). Rooms still reveal whole: the monsters inside a cage are seen with the room.

`wandering` may name an enemy of the quest: `{ "monster": "goblin", "enemy": "iceGremlin" }` (`monster` is the carrier type, the enemy gives name, stats, plan and abilities), also with `count`: a wandering monster trap and a wandering monster card both bring `count` monsters. The players give a square per monster (`WANDERING_MONSTER` takes `cells`); all attack the searching hero at once.

An NPC such as an animal ally (`npcs`, with `spawnNpc` on the first note) shows with its stats in the Companions list.

## Room tiles and merged rooms (Frozen Horror)

A room tile is a physical tile of a fixed size (decision 88). It lies over squares, so it may cover parts of two rooms and corridor squares. Two forms, exactly one per tile:

- `roomTiles: [{ "type": "iceVault", "cells": [[4,15],[5,15],[6,15],[4,16],[5,16],[6,16]] }]`: the tile lies over these squares (a plain rectangle of one of its sizes, rock never). Its rule is shown in the note of every room and corridor square it covers, once one of its squares has been seen.
- `roomTiles: [{ "type": "iceVault", "area": "R17" }]`: a shortcut for a tile that fills one room. It expands to the squares of that room, with the rooms merged into it (`areaOverrides`) and without rock squares. It is seen when the room is revealed. Used by the bundled quests; the editor turns it into `cells` when the tile is moved, resized or turned.

Types (`src/engine/data/roomTiles.ts`): `iceVault`, `scepterRoom`, `livingFog`, `chasmRoom`, `frozenCrypt`, `seatOfPower`, `cageRoom`, `gremlinTreasure`. With `area`, one tile per room. The rule is a reminder: rolls and hits stay with the players.

### Tile sizes and limits (decision 88)

The box holds a limited number of each tile, in fixed sizes (a tile can lie turned, so 3 x 2 is also 2 x 3: the editor lists each shape once and turns it with Turn). The limits are per quest, and a quest of two maps counts each map on its own (the book gives each half its own set).

| Tile | Sizes in the box | Per quest |
|---|---|---|
| Ice cave entrance (board) | 6 x 5 | 1 |
| Ice ledge (board) | 5 x 3 | 1 |
| Icy river (board) | 1 x 8, 1 x 3 | 1 of each |
| Slippery ice (board) | 1 x 1, 2 x 1, 3 x 1, 3 x 2 | no limit stated |
| Cage (board, part of the Cage Room, not in the palette) | 2 x 2 | no limit stated |
| Ice Vault (room) | 3 x 2, 4 x 3 | 1 of each |
| Living Fog, Scepter, Bottomless Chasm and Cage rooms | 4 x 4 | 1 each |
| Frozen Crypt room | 5 x 3 | 1 |
| Ice Gremlin Treasure room | 4 x 3 | 1 |
| Frozen Horror throne room (`seatOfPower`) | 6 x 5 | 1 |
| Ice tunnels | 1 x 1 each end | 3 pairs |
| Ice slide (trap `path`) | 1 x 8, straight | 1 |

The validator warns (it never blocks) when a tile has a size that is not one of its sizes, when there are more tiles of a size than the limit, when room tiles overlap, when there are more than 3 tunnel pairs, or when an ice slide is not a straight run of 8 squares. Each message names the tile and the limit. Squares of a room tile in rock, or off the board, are errors. The editor offers only the allowed sizes and refuses a tap past a limit.

`areaOverrides: [{ "merge": ["R09", "R10"] }]` makes two rooms that touch one room (Q10 K: a tile laid over two small rooms). The second room becomes part of the first: the wall between them is gone for sight and reveal, and the second id is no longer a room of the quest (notes, tiles and the start must use the first). The rooms must touch.

## Hidden, locked and removed doors (Frozen Horror)

A door (also a secret or false one) can have `"hiddenUntil": "flag"`: it is not on the map until that quest flag is set, even when its squares are seen (Q5 door C). It shows the moment the flag is set if one of its squares is already seen, or with its square later. `"lockedUntil": "flag"`: a try to open it answers "stuck" and changes nothing until the flag is set (the Q9 key door; a note sets the flag when the key is found). Both flags must be set by some `setFlag` effect, or the validator reports it.

The effect `{ "type": "removeDoor", "door": "d3" }` makes a door close and disappear for the rest of the quest (Q5 door B): it is a wall again for sight, never drawn and never opened. Rooms the heroes already saw stay seen.

A question the players answer (Q1 B "did the Barbarian attack the Crossbowman from next to it?") is a `manual` note whose effect is a `promptChoice` with a Yes and a No option; the hidden text and effects are in the options.

## Edge doors and the start (Frozen Horror)

`edgeDoors: [{ "id": "in", "cell": [3, 18], "side": "s", "kind": "ironEntry" }, { "id": "out", "cell": [20, 18], "side": "s", "kind": "woodenExit" }]` are doors in the outer wall of the board. `cell` is the board square inside the door and `side` (`n`, `e`, `s`, `w`) the board edge it sits on; the square outside is derived. At most one iron entry. They share the door id space (notes can use `doorOpened` with their id).

`start` is `{ "area": "R20" }` (the stairway room), `{ "area": "R20", "kind": "tile" }` (an ice cave entrance tile, drawn like any start room), or `{ "door": "in" }`: the heroes begin outside that iron entry door and see only it; the first tap opens it and looks in from the square inside. Exactly one of `area` and `door`.

Leaving: heroes who go out through a wooden exit door end the quest as usual (End quest). The end buttons then say "through the exit door".

## Several maps in one quest (Frozen Horror Q9 and Q10, decision 45)

One quest can have more than one map. The board fields at the top of the quest (`rock`, `doors`, `edgeDoors`, `roomTiles`, `boardTiles`, `areaOverrides`, `secretDoors`, `falseDoors`, `blocks`, `furniture`, `monsters`, `traps`, `markers`, `tunnels`, `zones`, and `start`) are **map 1**. `mapId` (required when there are extra maps) and `mapName` name it. `maps` lists the extra maps, each `{ "id", "name?", "start", ...the same board fields }` (`start` is the room of the stairway where the heroes arrive).

```jsonc
"mapId": "upper", "mapName": "The Upper Hall",
"maps": [ { "id": "lower", "name": "The Lower Hall", "start": { "area": "R01" }, "doors": [ ... ], "furniture": [ ... ] } ],
"links": [ { "id": "l1", "a": { "map": "upper", "cell": [1, 15] }, "b": { "map": "lower", "cell": [1, 1] } } ]
```

- **Everything else is shared**: objectives, enemies, abilities, spells, rules, `wandering`, NPCs, endings. The quest ends by its own objective or ending, wherever the heroes are.
- **Ids are unique across maps**: doors, furniture, monsters, traps, zones, markers, notes. Two notes on different maps cannot use the same `letter`. The validator reports a repeat.
- **Rooms are per map**: `R05` on one map is another room on the next. A note with an `areaRevealed`, `areaEntered`, `treasureSearch`, `secretDoorSearch` or `squareEntered` trigger must say `"map": "<id>"`. Any note may. A note with no `map` is in force on every map (a kill note, the quest start, a spell note).
- **Links** join two stairways on two different maps (both ways). Each end is a square of a `stairs` furniture of that map: the heroes arrive there. A link needs both ends.
- **Crossing** is the effect `{ "type": "crossMap", "link": "l1" }` (put it last in a note), inside the answer "Yes" of a `promptChoice` "Are all heroes on the stairway?". Put one such `manual` note (with `repeat`) on each map. The engine also has a `CROSS_MAP` event with the same effect.
- **On crossing**: the fog resets (seen squares, rooms, looks, doors, furniture, traps), opened doors close, found secret doors stay found, the squares of fallen blocks and the rooms searched wait with their map. Kills, monster damage, fired notes, flags, counters, dead heroes, sprung traps and the turn counter stay. Wandering monsters without a square disappear; one the players put on a square stays on the map where it was. The arrival room of the other stairway is revealed whole.
- The Play screen shows the map name after the quest number. The editor does not draw the extra maps yet (a tab per map and a link tool come later), but it keeps all these fields on open and export.

## Pack

A quest may have `"pack": "<pack id>"`. Left out, it belongs to the pack whose manifest lists it (`PACKS.md`); a quest made in the editor is in no pack. `number` is 1 to 14 in the core book and may be 0 (a prelude).

## Team rule and excluded targets (decisions 38, 39)

`team` (optional): `{ "solo": true, "only": ["barbarian"], "grantsAlly": "snowdasher" }`. `solo`: the quest is for one hero. `only`: only these heroes (left out: any hero). `grantsAlly`: the id of a pack animal ally (`team.allies` in the pack manifest) that comes with the hero. Words for the New game popup only: it shows warnings and never blocks.

`flagsIn` (optional): `[{ "flag": "scepterDestroyed", "oneShot": true }]`. Flags the quest begins with. In a campaign the value is what an earlier quest handed on (false if none); played alone it is `oneShot`. `flagsOut` (optional): `["scepterDestroyed"]`, flags this quest hands on when it is finished. `excludeTargets` (optional): NPC ids that Zargon's monsters ignore (decision 39).


## Editing a double quest

The editor shows one map at a time (a chip per map on the Map tab). Inside, the map on show is swapped into the top-level fields, so every single-map edit works on it, and the saved draft, undo and the exported file always keep map 1 on top. New ids skip the ids of the other maps. A new note about a letter, a square or a room names the map on show (`map`); a quest-wide note names none. The link tool refuses a link unless both ends are on stairs furniture of two different maps. Deleting a map also deletes the notes that name it and the links that end on it; a quest left with one map has no `maps`, `links`, `mapId` or note `map` any more.

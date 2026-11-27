# Texture packs

A texture pack changes how the board looks. It never changes rules, quests or saved games (decision 78).
Pick packs with the **Textures** link on the quest select screen. The built-in look (Classic) is always there.

A pack is made of whole pictures: **one picture of the board**, one picture per monster, one per piece of
furniture, and pictures for doors, blocks and traps. It does not need small tiles for floors or walls.

## The file

A pack is a zip file named `something.sqtextures`. Inside: `theme.json` and the pictures it names
(png, webp or jpeg; the file must really be that kind of picture).

Limits: 10 MB after unzipping, at most 300 files, `theme.json` at most 64 KB. File names are plain relative
paths (no `..`, no leading slash).

## theme.json

Everything except `format`, `version`, `id` and `name` is optional. A slot you leave out keeps the built-in
drawing, so a pack can be partial.

```json
{
  "format": "sqtextures",
  "version": 1,
  "id": "my-stones",
  "name": "My stones",
  "origin": "fan",
  "author": "Someone",
  "board": "board.webp",
  "door": { "closed": "door.png", "open": "door-open.png", "secret": "secret-door.png" },
  "block": { "single": "block.png", "double": "block-double.png" },
  "trap": { "pit": "pit.png", "spear": "spear.png", "fallingBlock": "falling-block.png" },
  "monster": { "orc": "orc.png", "goblin": "goblin.png" },
  "furniture": {
    "table": { "file": "table.png", "cells": [3, 2] },
    "chest": { "file": "chest.png", "cells": [1, 1] },
    "stairs": { "file": "stairs.png", "corner": "topLeft" }
  }
}
```

| Field | What it is |
|---|---|
| `id` | Lowercase letters, digits and dashes (2 to 41 characters). Importing a pack with the same id replaces the old one. |
| `origin` | `official` or `fan` (default `fan`). Shown in the dialog. |
| `board` | One picture of the whole board: 26 x 19 squares, the same shape as the grid. See below. |
| `door` | `closed`, `open`, and `secret`. A secret door keeps its `secret` picture once the heroes find it, closed or open, and Zargon sees it before they do. A `secret` picture is about square (a slab on the wall line); it is drawn with its bottom edge on the wall. |
| `block` | `single` (one blocked square) and `double` (two blocked squares side by side; turned when they stand one above the other). |
| `trap` | A picture per kind of trap: `pit`, `spear`, `fallingBlock`, `chest` (a trapped chest), `scripted`, and the Frozen Horror kinds `stalactite`, `swingingAxe`, `wanderingTrap`, `slipperyIce`, `iceSlide`. `armed` is what the heroes see before a trap springs. |
| `monster` | A picture per monster type: `skeleton`, `zombie`, `mummy`, `orc`, `goblin`, `abomination`, `gargoyle`, `dreadWarrior`, `dreadSorcerer`. An enemy with its own picture in the Library keeps it. |
| `furniture` | A picture per furniture type: `stairs`, `table`, `sorcerersTable`, `alchemistsBench`, `bookcase`, `cupboard`, `chest`, `throne`, `tomb`, `rack`, `weaponsRack`, `fireplace`. |
| `enemy` | A picture per enemy, by enemy id (`iceGremlin`, `yeti`, `polarWarbear`, `frozenHorror`, `crossbowman`, `swordsman`, `halberdier`, `scout`, or the id of any enemy of a quest). An enemy that has no core type (an Ice Gremlin is not a goblin) can only get a picture this way. It wins over `monster` for that enemy; an enemy's own image in the Library still wins over both. |
| `edgeDoor` | `ironEntry` and `woodenExit`: the doors in the outer wall of the board. See below. |
| `tunnel` | An ice tunnel end by design number: `"1"` to `"9"`. A design without a picture keeps the drawn look (a square with its number). |
| `tile` | Pictures of tiles, drawn once over their squares. See below. |
| `floor`, `corridor`, `rock`, `wall` | Optional small pieces, for a pack that has no board picture: lists of floor tiles (used in turn by square), one rock tile, and a wall strip one square long. |

### The board picture

It is shown through the squares the heroes have seen, so it is one picture for every quest. It should already have
the rooms, the corridors and the walls drawn on it: the app draws no wall lines between rooms when a pack has a
`board`. Rock and fog are still drawn over the squares that are not seen (and wall lines along rock edges, in the
built-in ink).

### Scale and offset (any picture)

Any picture slot can be written as a file name, or as an object that also scales and moves it:

```json
"monster": { "orc": { "file": "orc.png", "scale": 1.3, "offset": [0, -0.1] }, "goblin": "goblin.png" },
"furniture": { "table": { "file": "table.png", "cells": [3, 2], "scale": 0.75 } }
```

- `scale` is 1 for the normal size, from 0.4 (smaller) to 2.5 (bigger). The picture keeps its proportions and
  stays centered on its square, footprint or opening. A picture bigger than its square may cover its neighbours.
- `offset` is `[dx, dy]` in squares, from -1 to 1: `[0.5, 0]` moves it half a square to the right, `[0, -0.25]`
  a quarter of a square up. For a door or a double block the offset follows the door or block when it is turned.
  For furniture it is on the screen.

This works for `monster`, `door`, `block`, `trap` and `furniture` slots. The board, floor, wall and rock pictures
are not adjusted.

### Monsters

A monster picture is the **whole token**, frame included (a round portrait is typical). The app draws no green
circle behind it. It is shown about one square wide in play, in the editor and in Zargon view, and in the
monster list. Transparent corners are fine.

### Furniture

A picture keeps its proportions inside the footprint of the piece, so a picture with a transparent background
works best. Add `cells: [w, h]` with the size in squares **as the picture is drawn**. When a quest stands the
piece the other way (a 3 x 2 table placed 2 x 3), the picture is turned by 90 degrees.

Stairs are different: the quests place them in a corner of a room, in four directions. Give the stairs picture a
`corner`, which is the corner of the picture that is solid (`topLeft`, `topRight`, `bottomRight` or
`bottomLeft`). The picture is turned so that corner points into the corner of the room the stairs are in.

### Traps

The heroes never learn the kind of an armed trap, so `armed` is one picture for all of them (leave it out for the
built-in "?"). After a trap springs, its kind picture is shown: a sprung pit, and the block a falling-block trap
leaves. Zargon view shows every trap with the picture of its kind. A spear trap leaves nothing behind, so its
picture shows in Zargon view only.

### Tiles, tunnels and edge doors (Frozen Horror, decision 96)

`tile` is a map from a tile to one picture or a list of pictures. The keys are the room tiles (`iceVault`, `scepterRoom`, `livingFog`, `chasmRoom`, `frozenCrypt`, `seatOfPower`, `cageRoom`, `gremlinTreasure`), the board tiles that are one fixed piece (`iceCaveEntrance`, `icyRiver`, `iceLedge`, `slipperyIce`) and `iceSlide`. Each picture has `cells: [w, h]`, its size in squares **as the picture is drawn** (an Ice Vault drawn portrait is `[2, 3]`), and may have `scale` and `offset`.

```json
"tile": {
  "iceVault": [ { "file": "vault-2x3.png", "cells": [2, 3] }, { "file": "vault-3x4.png", "cells": [3, 4] } ],
  "scepterRoom": { "file": "scepter.png", "cells": [4, 4] }
}
```

- A tile that comes in two sizes (Ice Vault, icy river, slippery ice) has one picture per size. The picture whose `cells` match the tile's footprint is used; if there is none, the tile keeps its dashed outline and name.
- The picture is stretched over exactly the squares of the tile (it is made for that footprint) and is turned a quarter turn when the tile lies the other way. A tile that is not a full rectangle of squares keeps the outline.
- `iceSlide` is drawn along the squares of a slide (`cells: [1, 8]`, a straight run of that length). The picture's arrow points down, and it is turned to the way the slide goes. A bent or shorter slide keeps the dashed line.
- Tunnel pictures fill their square. An edge door picture is one square with the arrow in one half and the door in the other half. The `woodenExit` picture has the door on the left and its arrow pointing right, away from the door. The `ironEntry` picture has the arrow on the left pointing at the door on the right. The picture is turned so the door half lies on the wall line (the picture is centred a quarter of a square outside the wall) and the arrow half is outside the board, on all four sides. The entry arrow points into the board; the exit arrow points out of it. The arrow is drawn past the board edge and above tiles, rock and fog, and the map keeps room for it on that side. An opened door is drawn at 45%.
- Magic Ice has no slot: the app ignores blocks that spells place (decision 57).

### The Frozen Horror pack that ships with the app (decisions 98 and 99)

Frozen Horror pictures are a texture pack like any other, with one difference: it ships with the app, so it is in the list of the Textures dialog from the start (marked "Included with the app", for `frozen-horror`, official, about 3 MB). It is an **expansion pack** (id `fz-ah-2021`, family `ah-2021`): its `extends` is `core-ah-2021`, the core pack it is made for (the owner's own core pack, not shipped), so the dialog says "Needs the pack core-ah-2021. Import it first." until that core pack is imported and in use. **It is not applied by itself.** The player taps **Use** (and **Stop using it**). The source is `src/content/art/fz-ah-2021.theme.json`; the pictures stay once in `public/assets/frozen-horror/` (png, in the offline cache) and are read from there when the pack is used, previewed or exported.

- **Export** in the dialog, and `npm run build:pack -- frozen-horror`, give the same file, `fz-ah-2021.sqtextures` / `dist-packs/fz-ah-2021.sqtextures` (git-ignored). It includes `extends`, and imports like any pack.
- If the player saves an adjusted copy from Preview, the copy replaces the shipped row (Delete on the copy brings the shipped one back).

### Pack families: core packs and expansion packs (decision 99)

Packs come in families. Someone can make textures for the core game and for every expansion, as one family.

- A **core pack** has no `box` and no `extends`. It dresses every quest. Its `family` (a short id like `ah-2021`) names the family it starts.
- An **expansion pack** has a `box` (the quest pack it dresses, for example `frozen-horror`), an `extends` (the id of the ONE concrete core pack it is made for) **and** the same `family` as that core pack. It dresses only the quests of its box. Importing refuses an expansion pack without `extends` ("An expansion pack needs the core pack it is made for."), one without `family` ("An expansion pack needs the family of its core pack.") and a core pack with `extends` ("A core pack cannot extend another pack."). `extends` names the concrete pack and `family` the family it belongs to; the two must agree, and an expansion pack is used only with its core pack of its family ("Made for the family {family}, but {pack} is of another family.").

```json
{ "id": "stone-dungeon", "name": "Stone dungeon", "family": "stone", "board": "board.webp" }
{ "id": "stone-frozen", "name": "Stone dungeon: Frozen Horror", "box": "frozen-horror", "extends": "stone-dungeon", "family": "stone", "enemy": { "iceGremlin": "gremlin.png" } }
```

What the player can use: no pack (the built-in look), a core pack alone, or a core pack and any number of expansion packs of that family together, one per box. In a quest of a box the expansion pack's pictures are on top of the core pack's, slot by slot; every slot it leaves out comes from the core pack, then from the built-in look. A core quest never gets an expansion pack. An expansion pack can only be used while the core pack it names is the core pack in use. Using another core pack stops the expansion packs of the first family; stopping the core pack stops its expansion packs too; using a second expansion pack of the same box replaces the first. The packs in use are kept on the device as `{ core, expansions }`; an older single choice is read as the core pack, and an older single expansion pack, with no core pack in use, is cleared.

## Picture sizes

The board draws a square at 34 px, and tablets show it at up to 2x. Make pictures for 2x:

| Slot | Suggested size |
|---|---|
| board | 2600 x 1900 px (100 px a square). A lossy webp keeps it small. |
| monster | 68 to 150 px square |
| door | about 68 x 28 px, a horizontal door (turned for vertical walls) |
| block, trap | 68 to 150 px square; a `double` block twice as wide |
| furniture | its footprint times 68 px or more, for example 204 x 136 px for a 3 x 2 table |

## Checking a pack: Preview

In **Textures**, the **Preview** button of a pack opens a sample board that shows every slot with the same drawing
code the game uses: the board picture, each furniture type, the monsters, a single and a double block, every trap,
and the doors closed, open, secret and in a vertical wall. Above it:

- **Check** lists pictures that are much smaller than they are shown (they would look soft on a tablet, which draws a
  square up to 68 px wide) and a board picture that is not the shape of the board (26 x 19 squares).
- **Not in this pack** lists the slots the pack leaves empty (the built-in drawing is used there).

### Adjusting from the app

Under the sample, **Adjust a picture** changes the size and position of any picture the pack has. Pick it from the
list, or tap it in the sample: the sample then zooms in on that picture (a few squares around it, about three times
bigger than the whole sample), and **Show the whole sample** switches back. **Size** is 40% to 250%, **Right** and **Down** move it up to one square; each has a
slider and − / + buttons that move it in steps of 1% (a hundredth of a square). Held down, a button repeats, and after about a second it moves five steps at a time. The sample updates as you move them, and the
Check above it follows. **Reset this picture** puts it back. **Save changes** keeps them in the pack on this device
(and uses them at once if the pack is in use); **Export** then includes them. It changes the same `scale` and
`offset` of `theme.json` described above, so a pack made by hand and one adjusted in the app are the same thing.

## What a pack does not change

The quest editor map can show the pack or not: View > Textures switches it. Markers keep their letters, a false door keeps its cross,
Zargon view keeps its semi-transparent look for what the heroes have not seen, and the buttons, panels and colors
of the app do not change. Saves and quest files never name a pack.

## Copyright

A pack made from someone else's artwork is the maker's responsibility. The app only shows the `origin` field.
Do not put pictures cut from the Quest Book into the repository (hard rule 1): keep such packs on your own device.

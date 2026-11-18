# Texture packs

A texture pack changes how the board looks. It never changes rules, quests or saved games (decision 78).
Pick one with the **Textures** link on the quest select screen. The built-in look (Classic) is always there.

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
| `trap` | A picture per kind of trap: `pit`, `spear`, `fallingBlock`, `chest` (a trapped chest), `scripted`. `armed` is what the heroes see before a trap springs. |
| `monster` | A picture per monster type: `skeleton`, `zombie`, `mummy`, `orc`, `goblin`, `abomination`, `gargoyle`, `dreadWarrior`, `dreadSorcerer`. An enemy with its own picture in the Library keeps it. |
| `furniture` | A picture per furniture type: `stairs`, `table`, `sorcerersTable`, `alchemistsBench`, `bookcase`, `cupboard`, `chest`, `throne`, `tomb`, `rack`, `weaponsRack`, `fireplace`. |
| `floor`, `corridor`, `rock`, `wall` | Optional small pieces, for a pack that has no board picture: lists of floor tiles (used in turn by square), one rock tile, and a wall strip one square long. |

### The board picture

It is shown through the squares the heroes have seen, so it is one picture for every quest. It should already have
the rooms, the corridors and the walls drawn on it: the app draws no wall lines between rooms when a pack has a
`board`. Rock and fog are still drawn over the squares that are not seen (and wall lines along rock edges, in the
built-in ink).

### Monsters

A monster picture is the **whole token**, frame included (a round portrait is typical). The app draws no green
circle behind it. It is shown about one square wide in play, in the editor and in Zargon view, and in the
monster list. Transparent corners are fine.

### Furniture

A picture keeps its proportions inside the footprint of the piece, so a picture with a transparent background
works best. Add `cells: [w, h]` with the size in squares **as the picture is drawn**. When a quest stands the
piece the other way (a 3 x 2 table placed 2 x 3), the picture is turned by 90 degrees.

A picture that looks too big can be made smaller with `scale` (0.4 to 1, default 1): it keeps its proportions and stays
centered on the footprint, for example `"table": { "file": "table.png", "cells": [3, 2], "scale": 0.85 }`.

In the editor a piece can be turned with Rotate (also by half turns, which keep the same squares): the picture turns with it, so it faces the way the quest author chose.

Stairs are different: the quests place them in a corner of a room, in four directions. Give the stairs picture a
`corner`, which is the corner of the picture that is solid (`topLeft`, `topRight`, `bottomRight` or
`bottomLeft`). The picture is turned so that corner points into the corner of the room the stairs are in.

### Traps

The heroes never learn the kind of an armed trap, so `armed` is one picture for all of them (leave it out for the
built-in "?"). After a trap springs, its kind picture is shown: a sprung pit, and the block a falling-block trap
leaves. Zargon view shows every trap with the picture of its kind. A spear trap leaves nothing behind, so its
picture shows in Zargon view only.

## Picture sizes

The board draws a square at 34 px, and tablets show it at up to 2x. Make pictures for 2x:

| Slot | Suggested size |
|---|---|
| board | 2600 x 1900 px (100 px a square). A lossy webp keeps it small. |
| monster | 68 to 150 px square |
| door | about 68 x 28 px, a horizontal door (turned for vertical walls) |
| block, trap | 68 to 150 px square; a `double` block twice as wide |
| furniture | its footprint times 68 px or more, for example 204 x 136 px for a 3 x 2 table |

## What a pack does not change

The editor keeps its own door symbols (so secret and false doors stay readable), markers keep their letters,
Zargon view keeps its semi-transparent look for what the heroes have not seen, and the buttons, panels and colors
of the app do not change. Saves and quest files never name a pack.

## Copyright

A pack made from someone else's artwork is the maker's responsibility. The app only shows the `origin` field.
Do not put pictures cut from the Quest Book into the repository (hard rule 1): keep such packs on your own device.

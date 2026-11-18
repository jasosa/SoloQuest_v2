# Texture packs

A texture pack changes how the board looks. It never changes rules, quests or saved games (decision 78).
Pick one with the **Textures** link on the quest select screen. The built-in look (Classic) is always there.

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
  "floor": ["floor1.png", "floor2.png"],
  "corridor": ["corridor1.png"],
  "rock": "rock.png",
  "wall": "wall.png",
  "door": { "closed": "door-closed.png", "open": "door-open.png" },
  "block": "block.png",
  "trap": { "armed": "trap.png", "sprung": "pit.png" },
  "monster": { "orc": "orc.png", "goblin": "goblin.png" },
  "furniture": {
    "table": { "file": "table.png", "cells": [3, 2] },
    "chest": { "file": "chest.png" }
  }
}
```

| Field | What it is |
|---|---|
| `id` | Lowercase letters, digits and dashes (2 to 41 characters). Importing a pack with the same id replaces the old one. |
| `origin` | `official` or `fan` (default `fan`). Shown in the dialog. |
| `floor`, `corridor` | Lists of tiles, one square each. They are used in turn by square (the same square always gets the same tile), so the floor does not repeat. `corridor` falls back to `floor`. |
| `rock` | One tile that fills solid rock. |
| `wall` | A piece one square long, drawn along every wall edge, turned for vertical walls. |
| `door` | A door drawn across the opening, closed and open. Used in play only. |
| `block` | A blocked square (rubble, a fallen block). Play only. |
| `trap` | A trap square: `armed` (before it springs) and `sprung` (the pit). Play only. |
| `monster` | A picture per monster type: `skeleton`, `zombie`, `mummy`, `orc`, `goblin`, `abomination`, `gargoyle`, `dreadWarrior`, `dreadSorcerer`. An enemy with its own picture in the Library keeps it. |
| `furniture` | A picture per furniture type (see below). |

Furniture types: `stairs`, `table`, `sorcerersTable`, `alchemistsBench`, `bookcase`, `cupboard`, `chest`,
`throne`, `tomb`, `rack`, `weaponsRack` and `fireplace`. Add `cells: [w, h]` with the size in
squares **as the picture is drawn**. When a quest stands the piece the other way (a 3 x 2 table placed 2 x 3), the
picture is turned by 90 degrees. Without `cells` the picture is stretched over the footprint and never turned.
Stairs are drawn in four directions in the quests, and a picture cannot turn into all of them, so a pack usually
leaves `stairs` out.

## Picture sizes

The board draws a square at 34 px, and tablets show it at up to 2x. Make pictures for 2x:

| Slot | Suggested size |
|---|---|
| floor, corridor, rock, block, trap | 68 x 68 px (square). A thin grid line on the top and left edge keeps the squares readable. |
| wall | 68 x 16 px, a horizontal strip with a transparent background (png or webp) |
| door | 68 x 28 px, a horizontal door (turned for vertical walls) |
| monster | 68 x 68 px; shown inside a circle, so keep the face in the middle |
| furniture | its footprint times 68 px, for example 204 x 136 px for a 3 x 2 table |

## What a pack does not change

The editor keeps its own door symbols (so secret and false doors stay readable), markers keep their letters,
Zargon view keeps its dashed look for what the heroes have not seen, and the buttons, panels and colors of the app
do not change. Saves and quest files never name a pack.

## Copyright

A pack made from someone else's artwork is the maker's responsibility. The app only shows the `origin` field.
Do not put pictures cut from the Quest Book into the repository (hard rule 1): keep such packs on your own device.

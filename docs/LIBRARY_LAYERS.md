# Library layers (decision 76)

Status: first slice built (origin marker, owner mode). The rest is in the backlog (M9).

The Designer works on three layers, each on top of the one below:

1. **Core.** Ships with the app. Built by the owner with the Designer. It includes the expansions the owner delivers (Frozen Horror and later ones) as groups of Core items, each tagged with its `expansion` ("base" or the expansion name). Users read it and use it; they cannot change it.
2. **My library.** What a person makes in their own browser, on top of Core. It can use Core items or start from them, and it can be exported and imported as a file.
3. **Quest.** What a quest uses, copied into the quest file so it works on any device. It can differ from the layer below (the "Update from the library" button brings it back in step).

## Rules of the stack

- **Lookup order**: Quest, then My library, then Core. The first layer that has the item (by kind and id) wins.
- **Editing an item of a lower layer** makes a copy in the layer you work in (Core to My library, My library to Quest). It never changes the layer below.
- **Update goes one layer up**: a quest updates from My library or Core; My library updates from Core.
- **Every item has an `origin`**: `official` (the game and its expansions, always the case for Core) or `fan-made` (everything else). An item with no origin is fan-made. Core items are shown as official and cannot be set otherwise.
- **Owner mode** (a switch in the Designer, kept on this device): only in owner mode Core can be changed, and only then can an item of My library be called official. The development build is in owner mode by default.

## Built

- `origin` on every library item kind (ability, spell, enemy, hero, companion); badge in the lists; an Origin card in the Designer.
- Owner mode switch replaces the old `LOCK_CORE` constant. Core is read only without it.
- The list says "My library" (it said "Mine").

- **Core files**: `src/content/library/*.json` (format `soloquest-core`), applied at start in file name order (`src/content/core.ts`, and `npm run validate`). A file adds items, changes items (same id) or takes them out (`deleted: true`). An item has an optional `expansion`. Core abilities and spells are changed in place; added enemies, heroes and companions are listed in `CORE_EXTRA`.
- **Delete a Core item** (owner mode): a warning lists your quests that use it (an ability or spell is copied into them first, so they keep working) and the bundled quests that use it (they stop validating until fixed). The deletion stays on this device until exported. The monsters and heroes of the game itself (the nine monster types, the four heroes) cannot be deleted: the rules need them (owner decision). Everything else in Core can.
- **Export Core** (owner mode): one `core.json` with the deletions, the changed core items and the official items of the library (with their expansion). Put it in `src/content/library/`.

## Still to build (backlog, M9)

1. **Scope switch** in the Designer: Core | My library, with the "Used in" panel showing quests.
2. **Expansions on and off**: a user can hide an expansion's items from the add menus; quests keep working.
3. **Copy on edit** for normal users: Core is read only, "Copy" makes the item in My library.
4. **My library as a pack file**: export and import to share (reuses the library export that exists).

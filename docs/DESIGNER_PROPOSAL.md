# Designer: abilities, spells, enemies, heroes, companions (proposal)

Status: proposal with mockups, nothing built. Mockups: open `design/play-a/editor-mockups.html` (six screens) or see `design/play-a/shots/em-*.png`. Inspiration: the Imperial Commander 2 mission editor (a launcher with big action cards, a tab bar, lists with add and remove on the left, cards with sections in the middle). The look stays ours (paper, ink, 44 px controls).

## Owner feedback this answers

- Adding an ability works like adding an action: a button opens a popup.
- Abilities, spells, enemies can be made outside a quest, in the editor, as a library.
- One or more abilities (and spells) on a monster: a dropdown plus an Add button, no chips.
- Spellcasters: spell lists, cast limits, conditions for offering a spell, the situation tags (decisions 47 and 48), and a way to add spells and edit their tags.
- Sections for Abilities, Spells, Heroes, Companions (NPCs) and Enemies.

## The shape

1. **Start screen** (mockup 1): New quest, Open quest, Designer, Packager (later), and the recent quests.
2. **Tabs of the quest editor** (mockup 2): Quest, Map, Actions, Monsters, Designer. Lists on the left, cards in the middle.
   - **Quest**: title, summary, start room, objectives (a done rule or a confirm button), rules, closing note.
   - **Map**: today's board with its tools and the inspector of the selected element.
   - **Actions**: the grouped list and the popup that exist now.
   - **Monsters** (mockup 3): the monsters of this quest. A card Enemy (pick an enemy from the library, a name for this quest, special toggle, stats that start from the enemy), a card Abilities, a card Spells, and a Behavior card (starts active, dormant or stone; waits for; goes toward; hidden until an action places it).
   - **Designer**: the library (mockup 6).
3. **Add pattern everywhere**: a dropdown "Add an ability…" with an Add button and a "New ability…" button that opens the popup (mockup 4). Each added item is a row with its text and a Remove button. No chips.
4. **Spell popup** (mockup 5): name, own card text (optional), the situations (each one shows its question; a dropdown adds more; a custom question can replace them), cast limit (once in the quest, twice, unlimited), "offer only when" (always, or the quest has an escape point), a warning for the players, and where it is saved.
5. **Designer** (mockup 6): a list of Abilities, Spells, Enemies, Heroes and Companions. Core entries are read only: copy one to change it. "Used in" shows where it is used.

## What this needs in the data (new work)

- **Spells become data.** Today the eight spell keys and their names are in code (`spells.ts`), and the tag table is still open in the backlog. The library needs `{ id, name, text?, tags[] | customQuestion, warning?, castLimit, offerWhen }`. Core spells move from code to a data table; the engine reads the library.
- **Enemies become data.** A monster points at an enemy (type letter, base stats, abilities, spells, hunting rule) and keeps only its own overrides. The 9 core types stay.
- **Library storage.** Own entries live in the browser (like draft quests) and can be exported and imported as files.
- **Quests stay self-contained.** On export a quest carries a copy of every custom ability, spell and enemy it uses (`abilityDefs` today, plus `spellDefs` and `enemyDefs`), so a quest file works on any device.
- **Cast limit** per spell on a monster is new data (`spells` becomes a list of `{ spell, limit }`; the old list of keys still loads).

## Questions for the owner

1. **Library storage**: browser only plus file export and import, with the quest copying what it uses (my proposal)? Or should the library live in the quest files only?
2. **Heroes**: the app tracks no hero stats. What should a custom hero be for? Options: only a name and a class for the team list and the tie lists; or also "strong attack" and "caster" flags that the situation tags use (`strongInSight`, `casterInSight`).
3. **Companions** are the quest's helper characters today (name, defend, body, text). In the Designer they become reusable (Sir Ragnar once, used in several quests). OK?
4. **The editor layout**: replace the right-hand inspector by these tabs (the Map tab keeps a slim inspector for the selected element)? This is the biggest change.
5. **Order**: spells as data first (it unlocks cast limits and the spell popup), then enemies, then the tabs and the Designer?

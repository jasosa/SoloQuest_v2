# Decisions

Taken with the owner. Do not change them without asking. Add new ones at the bottom with the date.

| # | Date | Decision |
|---|---|---|
| 1 | 2026-11-13 | Edition: HeroQuest 2021 (Hasbro / Avalon Hill), 14 core quests. |
| 2 | 2026-11-13 | Platform: offline web app (PWA), React + TypeScript, tablet landscape first. |
| 3 | 2026-11-13 | The app does not track hero or monster movement/positions. It tracks which monsters are in play and, optionally, monster Body Points. |
| 4 | 2026-11-13 | Traps are visible as "?" with hidden kind; players jump, disarm or step on. No "search for traps". |
| 5 | 2026-11-13 | A failed jump or failed disarm springs the trap with the normal rules of its kind. |
| 6 | 2026-11-13 | Hero Body Points are not tracked. |
| 7 | 2026-11-13 | Gold, equipment and artifacts are not tracked, in or between quests. |
| 8 | 2026-11-13 | No verbatim text from the Quest Book or rulebook in the repo; notes are paraphrased. Owner may paste original text locally in the editor. |
| 9 | 2026-11-13 | UI direction A, "Quest Book Map" (`design/play-a/`). |
| 10 | 2026-11-13 | Zargon's turn: priority list by default, "Who can it reach?" as an option. Target rules are dynamic (drawn per turn and monster from type weights: closest, last attacker, fewest/most Body Points, fewest defend dice, most attack dice, spellcaster, grudge against a named hero), always with a tie list. |
| 11 | 2026-11-13 | Wandering monster: the app shows the placement rule (next to the searching hero, attacks at once; else closest square in the room, acts next Zargon turn) and adds it to the roster without a square. |
| 12 | 2026-11-13 | Quest note letters appear on the map where the note happened, once read; tap to read again. |
| 13 | 2026-11-13 | Squares where "Look from here" can show more get an eye glyph, computed from board geometry only (rock is not leaked). |
| 14 | 2026-11-13 | A room is all or nothing: the first time it is revealed (door opened, or sight reaches any square of it) the whole room is shown. No "hero enters" event is needed. |
| 15 | 2026-11-13 | A false door can be opened by the players: nothing is revealed, and the wall stays. |
| 16 | 2026-11-13 | Furniture does not block sight (the rulebook only says figures block spells). A block you can see is drawn as a block and stops sight behind it. The "look from here" eye disappears from a square once the players looked from it. |
| 17 | 2026-11-13 | Quest 1 notes A and B (empty rack, empty chest): the first hero to search gets nothing; later searchers draw a normal treasure card. Same pattern for other "nothing here" notes unless the quest says otherwise. |
| 18 | 2026-11-13 | Quest 1 note C: the guardian mummy is the one next to letter C, at (6,2). It rolls 4 attack dice. |
| 19 | 2026-11-13 | "New game" over a saved game asks for confirmation first. |
| 20 | 2026-11-13 | One save slot per quest for now. |
| 21 | 2026-11-13 | Named monsters carry their own stats, spells and special rules in the quest data (`overrides`, `spells`); the engine tables only hold the base monsters. The dread sorcerer base stats are a placeholder. |

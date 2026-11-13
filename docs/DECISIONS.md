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
| 15 | 2026-11-13 | A false door can be opened by the players: nothing is revealed, and the wall stays. (Superseded by 29.) |
| 16 | 2026-11-13 | Furniture does not block sight (the rulebook only says figures block spells). A block you can see is drawn as a block and stops sight behind it. The "look from here" eye disappears from a square once the players looked from it. |
| 17 | 2026-11-13 | Quest 1 notes A and B (empty rack, empty chest): the first hero to search gets nothing; later searchers draw a normal treasure card. Same pattern for other "nothing here" notes unless the quest says otherwise. |
| 18 | 2026-11-13 | Quest 1 note C: the guardian mummy is the one next to letter C, at (6,2). It rolls 4 attack dice. |
| 19 | 2026-11-13 | "New game" over a saved game asks for confirmation first. |
| 20 | 2026-11-13 | One save slot per quest for now. |
| 21 | 2026-11-13 | Named monsters carry their own stats, spells and special rules in the quest data (`overrides`, `spells`); the engine tables only hold the base monsters. The dread sorcerer base stats are a placeholder. |
| 22 | 2026-11-13 | A search in a room with an armed chest trap: the trap springs first and its effect applies, then the search goes on (special treasure or a treasure card). Chest traps can be disarmed with the usual disarm rules. |
| 23 | 2026-11-13 | Stepping onto an already sprung pit springs it again (the hero falls in). A sprung pit can still be jumped, never disarmed. |
| 24 | 2026-11-13 | A living wandering monster counts as a monster in its room: treasure and secret-door searches there need the players' override. The game remembers only the room it was placed in and the hero it attacked, not a square. |
| 25 | 2026-11-13 | Chest traps are hidden (no "?" in advance; this changes decision 4 for chests only). Only chests get a "Search for traps": once per chest, by any hero, no hero input; it finds all traps on that chest and marks it "?". Same monsters-in-room guard and override as other searches. A found trap is disarmed with the house disarm rules; a trap not found or not disarmed springs on the treasure search. |
| 26 | 2026-11-13 | Ending a quest: objectives tick by themselves (monster slain, flag set, effect). When all are done the panel says to bring the heroes back to the stairs. An "End quest" button always works and asks "Heroes left by the stairs" or "All heroes fell". The end screen shows whether the goal was done and the rewards as text. |
| 27 | 2026-11-13 | NPCs (for example Sir Ragnar) are text only: a chip with name, defend dice and who moves it. The app does not track NPC Body Points. |
| 28 | 2026-11-13 | A dormant monster (a statue, as in quests 5 and 11) is furniture until the quest wakes it: it is not in the monster list, does not block searches, gets no Zargon orders and cannot be wounded. Once awake it is a normal monster. The app does not track whether it has moved or attacked. The "invulnerable until it acts" rule is dropped. |
| 29 | 2026-11-13 | Supersedes 15. The players may try to open a false door (OPEN_DOOR is accepted and logged), but it never opens: it stays closed and blocks sight, no `doorOpened` note fires, and the app answers with a "door stuck" prompt (`doorStuck`). Trying again gives the same answer. |
| 30 | 2026-11-13 | Zargon orders are derived from a pure hash of (quest seed, turn, monster id, team), never from the game rng; the seed is kept in state. A spell listing equals one cast; every caster casts at most one spell per turn; spells that do not fit the team are suggested last, never dropped. A wandering monster that found no free square next to the hero acts in the coming Zargon turn. |
| 31 | 2026-11-13 | Spells are not modeled in detail. A caster gets one randomly picked spell it still has; the players say whether it could be cast; if yes the players apply the effect themselves, if no the app offers the next random spell, and when none is left the normal plan. Casting limits per quest data are kept. Supersedes the spell suggestion order and the team filters of decision 30. |

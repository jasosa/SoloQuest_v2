# SoloQuest v2

A quiet companion app for **solo and co-op HeroQuest** (2021 edition, core Quest Book). It reveals the dungeon as the heroes explore, keeps the quest notes, and gives the monsters their orders, so all players can be heroes and the physical board stays the center of the game.

Status: milestones M0 to M6 are done (engine, play loop, searches and traps, notes, Zargon's turn, quest editor). All 14 core quests are encoded and have walk-through tests; they are waiting for owner review. M8 polish, the pack layer (M9) and Frozen Horror (M10) are planned, not built. See `docs/BACKLOG.md` and `docs/QUEST_ENCODING.md`.

- Plan: `docs/IMPLEMENTATION_PLAN.md`
- Rules the app implements: `docs/RULES_DIGEST.md`
- UI prototype: open `design/play-a/index.html` in a browser
- Working with Claude Code: `CLAUDE.md`, agents in `.claude/agents/`, commands `/milestone`, `/encode-quest`, `/verify-quest`, `/review`

HeroQuest is a trademark of Hasbro. This is a personal fan project; it ships no text or images from the official books.

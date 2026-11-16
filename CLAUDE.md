# SoloQuest v2

Companion app for **solo and co-op play of HeroQuest (2021 Hasbro / Avalon Hill edition)**, the 14 quests of the core Quest Book.
The app is Zargon's map and brain: it reveals what the heroes can see, keeps the quest notes, and gives the monsters their orders. The physical board stays the center of the game.

Owner: Juanan. Write code comments, docs and UI text in plain, short English. **No em-dashes** anywhere (use a colon, comma or period).

## Read first

| Doc | What it is |
|---|---|
| `docs/IMPLEMENTATION_PLAN.md` | Architecture, data model, milestones. The source of truth for scope. |
| `docs/BACKLOG.md` | Milestone checklists. Pick work here, tick it when done. |
| `docs/RULES_DIGEST.md` | The HeroQuest rules the app implements, plus the house rules. |
| `docs/QUEST_FORMAT.md` | Quest JSON format (coordinates, doors, notes, triggers, effects). |
| `docs/ZARGON_AI.md` | Monster target rules, tie lists, plans. |
| `docs/QUEST_ENCODING.md` | How the 14 official quests are encoded and verified, with status table. |
| `docs/DECISIONS.md` | Decisions already taken. Do not reopen them without the owner. |
| `design/play-a/DESIGN.md` | UI design (Direction A, "Quest Book Map"): layout, tokens, motion. |
| `design/play-a/index.html` | Clickable prototype. The UI must look and behave like it. |

## Hard rules

1. **No verbatim book text.** Never copy text from the Quest Book or rulebook into the repo (notes, parchment text, card text). Paraphrase in your own words, keep the game effect exact. Quest map images and PDFs never go into git (`reference/` is git-ignored).
2. **The app does not track**: hero or monster positions and movement, hero Body/Mind Points, gold, equipment, artifacts between quests (the one exception: whether a hero has died, decision 32). No digital dice, no digital treasure deck. The one exception to positions: a monster added in play (spell, wandering) gets a square the players enter, only so it is drawn, can be slain and acts on Zargon's turn (decision 66); the app never moves it. Do not add these "to help".
3. **Engine is pure TypeScript** in `src/engine/`: no React, no DOM, no `Date.now()`, no `Math.random()`. All randomness goes through the seeded RNG in the game state. All changes to game state are events through the reducer (event sourcing, undo = drop last event).
4. **Tests with every engine change.** Vitest unit tests next to the code (`*.test.ts`). Line of sight and reveal changes need a test case drawn on a small ASCII map.
5. **Quests are data only** (`src/content/quests/qNN-*.json`), validated by the Zod schema. Quest-specific logic goes in notes/effects or `rules` overrides, never `if (quest === 7)` in the engine.
6. **UI follows Direction A.** Use the tokens and components in `src/ui/shared/`. Do not invent new colors, fonts or control styles; if something is missing, update `design/play-a/DESIGN.md` first.
7. **Tablet first.** Target 1194 x 834 landscape, touch targets at least 44 px, works offline (PWA).

## Commands

Created in milestone M0.

```bash
npm run dev            # Vite dev server
npm test               # Vitest (engine + content)
npm run test:e2e       # Playwright (play flows, screenshots in test-results/)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run validate       # validate all quest JSON against the schema + board checks
npm run render:maps    # render Quest Book map pages to reference/maps (needs poppler, see QUEST_ENCODING.md)
```

Run `npm run typecheck && npm test` before saying a task is done. Run `npm run test:e2e` when UI flows change.

## Repository map

```
CLAUDE.md                 this file
docs/                     plan, backlog, rules, formats, decisions
design/explore/           the three first-screen directions (A chosen)
design/play-a/            Direction A prototype + DESIGN.md (reference implementation for the UI)
src/engine/               pure game logic (board, quest, game, triggers, zargon, data)
src/content/              board.json, quests/*.json
src/ui/                   React UI (board, play, editor, shared)
tools/quest-import/       map page rendering, grid detection, overlay checks
tests/e2e/                Playwright specs
reference/                LOCAL ONLY, git-ignored: rendered map pages, notes from the PDFs
.claude/agents/           sub-agents (see below)
.claude/commands/         slash commands (see below)
```

Source PDFs (owner's copy, read-only, outside the repo):
`C:\Users\Juanan\Documents\Games\Heroquest\01_Rules\Official\`
- `F3649_en-us_heroquest-game-instructions-rulebook.pdf` (scanned images, use OCR or view pages)
- `HEROQUEST_CORE_QUEST_BOOK.pdf` (notes have a text layer, maps are images)

## Agents and commands

| Agent | Use it for |
|---|---|
| `engine-dev` | Anything in `src/engine/`: reducer, line of sight, reveal, searches, traps, triggers, Zargon orders. |
| `ui-dev` | React UI in `src/ui/`, matching the Direction A prototype. |
| `quest-encoder` | Turning one Quest Book quest into `src/content/quests/qNN-*.json` (map + paraphrased notes). |
| `rules-referee` | Read-only check of engine behavior or a quest file against the rules digest and the book. |
| `reviewer` | Read-only review of a diff: hard rules, tests, design, scope. |

| Command | Does |
|---|---|
| `/milestone M2` | Plan and implement the next open tasks of a milestone from the backlog. |
| `/encode-quest 5` | Encode one official quest end to end (render, draft, validate, overlay, walk-through test). |
| `/verify-quest 5` | Independent check of an encoded quest (referee + overlay screenshot). |
| `/review` | Review the current changes before commit. |

## Workflow

1. Pick the next unchecked task in `docs/BACKLOG.md` (milestones in order; M6 editor before M7 quests).
2. Read the relevant docs above. If the task needs a decision that is not in `docs/DECISIONS.md`, ask the owner; do not guess on rules.
3. Implement in small steps, with tests. Keep engine and UI changes in separate commits when possible.
4. Run typecheck + tests (+ e2e for UI). Use `reviewer` before committing a milestone task.
5. Tick the task in `docs/BACKLOG.md`. Record any new decision in `docs/DECISIONS.md`.
6. Commit with a short imperative message (`engine: reveal room on door open`).

## Domain gotchas

- **Coordinates**: `x` 0..25 left to right, `y` 0..18 top to bottom. Area id per cell in `board.json`: `C` corridor, `R01`..`R22` rooms (R11 is the center room). R15 is L-shaped: never assume rooms are rectangles.
- **Walls** are derived: an edge is a wall when the two cells have different area ids, unless both are corridor. Rock (dark areas of a quest map) and blocked squares also stop sight and movement.
- **Doors** sit on an edge between two orthogonal cells: `{ a: [x,y], b: [x,y] }`.
- **Line of sight**: straight line between square centers. Blocked by walls, closed doors, rock and blocked squares. A line that only touches a corner still sees (either way round the corner is enough). Figures do not block reveal.
- **Reveal**: opening a door into a room reveals the whole room (furniture, monsters, closed doors on its walls, trap "?" markers). Into a corridor: line of sight from the square beyond the door. "Look from here" reveals line of sight from a corridor square. Secret doors and treasure are never revealed by sight.
- **Traps (house rule)**: visible as "?" as soon as their square is seen; type hidden. Jump (1 combat die, skull springs), disarm (Dwarf fails on black shield, tool kit fails on skull), or step on. A failed jump or disarm springs the trap with its normal rules. No "search for traps".
- **Wandering monster**: always placed by the players next to the searching hero, and it attacks that hero at once (decision 33). It joins the roster without a square.
- **Monster orders**: positions are unknown, so orders are rules players apply with their character sheets, always with a tie list. Zargon's turn shows one monster at a time in a dialog (decision 34). The app tracks only whether a hero died (decision 32). See `docs/ZARGON_AI.md`.

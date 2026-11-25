# SoloQuest v2

Companion app for **solo and co-op play of HeroQuest (2021 Hasbro / Avalon Hill edition)**, the 14 quests of the core Quest Book. The app is Zargon's map and brain: it reveals what the heroes can see, keeps the quest notes, and gives the monsters their orders. The physical board stays the center of the game.

Owner: Juanan. Write code comments, docs and UI text in plain, short English. **No em-dashes** anywhere (use a colon, comma or period).

## Read first

| Doc | What it is |
|---|---|
| `docs/IMPLEMENTATION_PLAN.md` | Architecture, data model, milestones. Source of truth for scope. |
| `docs/BACKLOG.md` | Milestone checklists. Pick work here, tick it when done. |
| `docs/RULES_DIGEST.md` | The HeroQuest rules the app implements, plus house rules. |
| `docs/QUEST_FORMAT.md` | Quest JSON format. |
| `docs/ZARGON_AI.md` | Monster target rules, tie lists, plans. |
| `docs/QUEST_ENCODING.md` | How the 14 quests are encoded and verified, status table. |
| `docs/DECISIONS.md` | Decisions already taken. Do not reopen without the owner. |
| `design/play-a/DESIGN.md`, `design/play-a/index.html` | UI design (Direction A) and clickable prototype. The UI must look and behave like it. |

## Hard rules

1. **No verbatim book text** in the repo (notes, parchment, card text). Paraphrase, keep the game effect exact. Quest map images and PDFs never go into git (`reference/` is git-ignored).
2. **The app does not track** hero or monster positions or movement, hero Body/Mind Points, gold, equipment, or artifacts between quests. Exceptions: whether a hero died (decision 32); a monster added in play gets a square the players enter, only so it is drawn, can be slain and acts, and the app never moves it (decision 66). No digital dice or treasure deck. Do not add these "to help".
3. **Engine is pure TypeScript** in `src/engine/`: no React, no DOM, no `Date.now()`, no `Math.random()`. Randomness only via the seeded RNG in game state. State changes are reducer events (undo = drop last event).
4. **Tests with every engine change** (Vitest, `*.test.ts` next to the code). Line of sight and reveal changes need a test drawn on a small ASCII map.
5. **Quests are data only** (`src/content/quests/qNN-*.json`, Zod schema). Quest logic goes in notes/effects or `rules` overrides, never `if (quest === 7)`.
6. **UI follows Direction A.** Use the tokens and components in `src/ui/shared/`. No new colors, fonts or control styles; update `design/play-a/DESIGN.md` first.
7. **Tablet first.** 1194 x 834 landscape, touch targets at least 44 px, works offline (PWA).

## Commands

```bash
npm run dev                       # Vite dev server
npm run verify                    # THE gate: rule checks, typecheck, lint, format, unit tests, quest validation (~45 s)
node scripts/verify.mjs --quick   # rule checks only (~1 s)
npm run test:e2e                  # Playwright; run when UI flows change
node scripts/wt.mjs new|list|merge|clean|drop   # worktrees; merge runs verify and rolls back on failure
```

Run `npm run verify` before saying a task is done. The pre-commit hook and the Stop hook run it too. Never use `--no-verify`.

## Workflow

1. Pick the next unchecked task in `docs/BACKLOG.md` (milestones in order; M6 editor before M7 quests).
2. Read the relevant docs. If the task needs a decision not in `docs/DECISIONS.md`, ask the owner; do not guess on rules.
3. Implement in small steps, with tests. Keep engine and UI changes in separate commits when possible.
4. Run verify (+ e2e for UI). Engine, schema or large changes get the `reviewer` agent first; docs-only changes do not (see `/ship`).
5. Tick the task in `docs/BACKLOG.md`. Record any new decision in `docs/DECISIONS.md`.
6. Commit with a short imperative message (`engine: reveal room on door open`).

Every agent has `model: sonnet` in its frontmatter. Override it for one run only: `opus` for complex architectural or edge-case work, `haiku` for a `reviewer` pass on docs-only or small diffs.

## Working rules (enforced by hooks in `.claude/hooks/`)

- **Agents:** the main session only coordinates. Every task goes to the matching agent: UI to `ui-dev`, engine and schema to `engine-dev`, quests to `quest-encoder`, review to `reviewer`, rules checks to `rules-referee`. The main session plans, briefs the agent with full context, collects the result and reports.
- **Git:** commit and push are separate commands, never chained. Push only when the owner asks. More than a small fix goes on a branch, merged when green. Parallel work uses `node scripts/wt.mjs`, never loose `git worktree` calls; run `clean` after merging.
- **Windows edits:** working copies are CRLF. Change files with the Edit or Write tools. For a scripted edit use Python with `newline=''` and detect the line ending first. No shell heredocs for content with quotes or `$`; write a script file instead. Never `sed -i` a CRLF file.
- **Rules questions:** tag each `[book]` (cite the page) or `[proposal]` (edge case the book does not cover). Never present an invented rule as a game rule.
- **Formatting:** Prettier covers code and data (`.prettierignore` skips `docs/`, `design/`, `*.md`). Run `npx prettier --write <file>` on what you touched, never on whole folders.
- **Tests must not get weaker:** no loosened assertions (no `>= 1` for an exact count), no `.skip` or `.only`. A deliberate one needs `// verify-ok` with the reason.
- **App texts: no AI slop.** Labels, messages, quest notes, settings and errors are plain, short and concrete, in the words the game uses. No filler openers, hype, cheerful padding or vague reassurance. Cut every word that carries no information.

## Domain gotchas

Single source for these rules. Agents point here; do not copy them elsewhere. Quest import commands and source PDF paths are in `quest-encoder.md` and `rules-referee.md`.

- **Coordinates**: `x` 0..25 left to right, `y` 0..18 top to bottom. Area id per cell in `src/content/board.json`: `C` corridor, `R01`..`R22` rooms (R11 is the center room). R15 is L-shaped: never assume rooms are rectangles.
- **Walls** are derived: an edge is a wall when the two cells have different area ids, unless both are corridor. Rock (dark areas of a quest map) and blocked squares also stop sight and movement.
- **Doors** sit on an edge between two orthogonal cells: `{ a: [x,y], b: [x,y] }`.
- **Line of sight**: straight line between square centers. Blocked by walls, closed doors, rock and blocked squares. A line that only touches a corner still sees (either way round the corner is enough). Figures do not block reveal.
- **Reveal**: opening a door into a room reveals the whole room (furniture, monsters, closed doors on its walls, trap "?" markers). Into a corridor: line of sight from the square beyond the door. "Look from here" reveals line of sight from a corridor square. Secret doors and treasure are never revealed by sight.
- **Traps (house rule)**: visible as "?" as soon as their square is seen; type hidden. Jump (1 combat die, skull springs), disarm (Dwarf fails on black shield, tool kit fails on skull), or step on. A failed jump or disarm springs the trap with its normal rules. No "search for traps".
- **Wandering monster**: always placed by the players next to the searching hero, and it attacks that hero at once (decision 33). It joins the roster without a square.
- **Monster orders**: positions are unknown, so orders are rules players apply with their character sheets, always with a tie list. Zargon's turn shows one monster at a time in a dialog (decision 34). The app tracks only whether a hero died (decision 32). See `docs/ZARGON_AI.md`.

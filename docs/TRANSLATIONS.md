# Translations (decision 92)

All the words of the app can be changed with a tool: the interface, the quest texts, and the texts of the engine tables and the Core library. A translation is one JSON file. English is supplied by the app and can never be deleted or changed: a user makes a copy and changes the copy.

## For a player or translator

1. Quest select screen, header link **Translations**.
2. **New language** (name, code such as `es` or `pt-BR`, author). The new language starts as a copy of every English text.
3. **Edit**: pick an area (Interface, Library, or one quest), filter on "Not translated yet" or "Problems", search, change the texts, **Save**. A text left empty or missing is shown in English. Keep the `{names}` in curly braces: they are filled in when you play ("Turn {turn}").
4. **Use** makes it the language of the app (kept on this device, English is the default). The page reloads, so every text and quest is built in the language.
5. **Export** gives `code.sqlang.json`. **Import a file** adds it, or replaces the language with the same code. A friendly message says what is wrong with a bad file (not JSON, not a translation file, no name, bad code, over 5 MB, the code `en`).

File format (`src/i18n/file.ts`, Zod schema):

```json
{
  "format": "soloquest-language",
  "version": 1,
  "language": { "name": "Espanol", "code": "es" },
  "author": "Ana",
  "base": "en-1a2b3c4d",
  "strings": { "select.chooseAQuest": "Elige una mision" }
}
```

`base` names the English version the file was made from (a hash of all English keys and texts). A file made for an older base still works by key: new English texts fall back to English, and the editor says how many texts are new or gone, with buttons to add the new ones and remove the old ones.

## Keys

| Kind | Key | Example |
|---|---|---|
| Interface | `area.camelCaseWords` | `select.newGame`, `play.PlayScreen.wanderingMonster` |
| Quest text | `quest:<quest id>:<path>` | `quest:q01-the-trial:notes.n-start.effects.0.text` |
| Engine data | `data:<table>.<id>.<field>` | `data:trapKinds.pit.lines.0`, `data:monsters.goblin` |
| Core library | `library:<kind>:<id>.<field>` | `library:ability:stone.text` |

- **Quest paths** name a list item by its `id` when every item of the list has a unique one (notes, monsters, traps, objectives, endings, npcs, enemies, abilities, spells), else by position (effects, choice options, traits). The quest file is never rewritten: a translation is an overlay laid over the quest when it is loaded (`translateQuest`, `src/i18n/questText.ts`), so the engine does not see it. Quests made in the editor are translated the same way, by their own id (`user-...`).
- **Which fields are text** is the table `QUEST_TEXT_PATTERNS` in `src/i18n/questText.ts`: title, intro, map names, rewards, end text, leave, wandering text, falling block rule, action labels and hints, effect `text` and `title` (at any depth of choices), choice option labels, monster names and traits, trap effects, enemy names and traits, ability, spell, NPC, objective and ending texts. Ids, enum values, squares, flags, letters and marker labels are not text. The test `bundled quests > has no string that looks like prose...` walks every bundled quest and fails when a string with a space is neither in the table nor in `QUEST_TEXT_EXCLUDED` (box names). **When the schema gets a new text field, add its pattern.**
- **Engine data** (`src/i18n/dataText.ts`): trap kinds, spell situation questions and timing lines, core spells and abilities, monster and hero names, room and board tiles with their rule lines, Zargon target rules and plans, and the Core library items. They are read from the live tables, so a Core file the owner adds is in the English file at once. A language is laid over the tables when the app starts (`applyDataStrings`).

## Where the words come from

- `src/i18n/en.json` is the English interface catalogue. It is **made from the code**: write `t('select.newGame', 'New game')` (key, English, optional `{name}` values as a third argument) and run `npm run i18n -- write`. The unit test fails when `en.json` is out of date or when a key has two English texts.
- `t` is `tr` in `src/i18n/translate.ts`: no DOM, no clock, pure, so the engine can use it (`tr('zargon.thief', 'Steal: ...')`). The active language is a map set once at startup (`initI18n`, `src/i18n/runtime.ts`); a key it lacks falls back to the English words in the call.
- The English file the tool shows is built from the app: `englishStrings(quests, englishDataStrings())` (`src/i18n/english.ts`): the catalogue, the data tables as they were before any language, and the quests (bundled, and of this device).

## Adding the next text

- A new interface text: write it with `t(...)`, run `npm run i18n -- write`. Plain JSX text and text attributes can be routed by the tool: `npm run i18n -- codemod <area> <file>` (then `npx tsx tools/i18n/unshadow.ts` if a local variable called `t` hides the function, `npx prettier --write`, `npm run typecheck`). Sentences that mix text and elements are listed for a hand-made text with `{name}` values.
- Check what is left: `npm run i18n -- report` (covered files) or `report --all -v` (every screen); `--clean` lists the files with nothing left. Put a clean file in `tools/i18n/covered.ts`: from then on a literal in it fails the unit test. A line that must stay English (a font name, a code) takes `// i18n-ok` on its line or the one above.
- A new quest text field: add its pattern to `QUEST_TEXT_PATTERNS`.
- A new data table with words: add it to `entries()` in `src/i18n/dataText.ts`.

## Storage and the tool

- Languages are kept in IndexedDB (`soloquest-languages`), the one in use in localStorage (`src/persist/languages.ts`), in the way texture packs are. English is never stored: saving, removing or choosing the code `en` as a stored language is refused.
- The dialog: `src/ui/translations/` (list, new from English, import, export, delete, use) and the editor (areas with progress, filters, search, 50 rows at a time, placeholder check). Design: `design/play-a/DESIGN.md`, section Translations.
- `?nosave=1` keeps languages in memory, so a language chosen there does not survive the reload; the e2e flow runs without it.

## Coverage

See the section "Translations" of `docs/BACKLOG.md` for what is routed and what is left.

## Gaps and limits

- The editor writes a quest's texts as they are; keys come from the path. Notes, objectives, endings, monsters, traps, NPCs, enemies, abilities and spells have stable ids. **Effects, choice options and traits are named by position**, so a translation of a quest loses its place for the items after one the author inserts or removes in the middle. Give them ids before translating a quest that is still being edited.
- A language is applied when the app starts. Choosing another one reloads the page.
- The editor and the Designer are routed through `t` where the text is plain; tab names and a few labels held in constants stay English (see the backlog).

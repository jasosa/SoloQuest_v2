/**
 * Quest files you can share: `.hqquest.json`.
 * Export drops `intro.userText` (local only, decisions 8 and QUEST_FORMAT.md). Import checks
 * everything and returns readable errors. Errors block, warnings are returned to the caller.
 */
import { board } from '../board/board';
import { isUserQuestId, newUserQuestId } from './ids';
import { parseQuest, QuestParseError } from '../quest/loader';
import { QuestVersionError } from '../quest/migrate';
import type { Quest } from '../quest/schema';
import { validateQuestIssues, type Issue } from '../quest/validate';

export const QUEST_FILE_EXTENSION = '.hqquest.json';
/** Files bigger than this are refused before parsing (a real quest is about 30 KB). */
export const MAX_QUEST_FILE_CHARS = 2_000_000;

const TOP_KEYS = [
  'schemaVersion',
  'id',
  'number',
  'title',
  'intro',
  'start',
  'rock',
  'doors',
  'secretDoors',
  'falseDoors',
  'blocks',
  'furniture',
  'monsters',
  'traps',
  'markers',
  'zones',
  'abilityDefs',
  'spellDefs',
  'enemyDefs',
  'notes',
  'wandering',
  'objectives',
  'rewards',
  'endText',
  'rules',
  'npcs',
  'endings',
] as const;

/** Suggested file name for a quest. */
export function questFileName(quest: Quest): string {
  return `${quest.id}${QUEST_FILE_EXTENSION}`;
}

/** The quest without anything that must stay on this device. */
export function stripLocal(quest: Quest): Quest {
  const { userText: _userText, ...intro } = quest.intro;
  void _userText;
  return { ...quest, intro };
}

/** Pretty JSON with a fixed top-level key order, cell pairs on one line, no `userText`. */
export function exportQuest(quest: Quest): string {
  const clean = stripLocal(quest) as unknown as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const k of TOP_KEYS) if (clean[k] !== undefined) ordered[k] = clean[k];
  const text = JSON.stringify(ordered, null, 2);
  // A cell pair printed over four lines becomes one line. Strings cannot hold raw newlines,
  // so this never touches text.
  return text.replace(/\[\n\s+(-?\d+),\n\s+(-?\d+)\n\s+\]/g, '[$1, $2]') + '\n';
}

export type ExportResult =
  { ok: true; text: string; warnings: Issue[] } | { ok: false; errors: string[] };

/** Export only a quest with no validation errors. Warnings are returned. */
export function exportQuestChecked(quest: Quest): ExportResult {
  const issues = validateQuestIssues(quest, board);
  const errors = issues.filter((i) => i.severity === 'error').map((i) => i.message);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    text: exportQuest(quest),
    warnings: issues.filter((i) => i.severity === 'warning'),
  };
}

export interface ImportOptions {
  /** Ids already in use. With this option (even empty) the quest id is made a free user id. */
  takenIds?: Iterable<string>;
}

export type ImportResult =
  | {
      ok: true;
      quest: Quest;
      warnings: Issue[];
      /** Set when the file id was not a free user id and a new one was given (a warning says so). */
      idRewritten?: { from: string; to: string };
    }
  | { ok: false; errors: string[] };

/**
 * Read a quest file. Never throws. Pass `options` from the import screen: a file id that is not a
 * `user-` id (for example a bundled quest) or that is already taken gets a new id from
 * `newUserQuestId`, reported in `idRewritten` and in a warning. Without options the id is kept.
 */
export function importQuest(text: string, options?: ImportOptions): ImportResult {
  if (typeof text !== 'string') return { ok: false, errors: ['The file is not text.'] };
  if (text.length > MAX_QUEST_FILE_CHARS)
    return { ok: false, errors: ['The file is too big to be a quest.'] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`The file is not valid JSON: ${(e as Error).message}`] };
  }
  let quest: Quest;
  try {
    quest = parseQuest(data);
  } catch (e) {
    if (e instanceof QuestVersionError) return { ok: false, errors: [e.message] };
    if (e instanceof QuestParseError) return { ok: false, errors: e.issues };
    return { ok: false, errors: ['The file is not a readable quest.'] };
  }
  const warnings: Issue[] = [];
  if (quest.intro.userText !== undefined) {
    warnings.push({
      severity: 'warning',
      message: 'The file had personal text (userText). It was ignored.',
      ref: { kind: 'quest' },
    });
    quest = stripLocal(quest);
  }
  const issues = validateQuestIssues(quest, board);
  const errors = issues.filter((i) => i.severity === 'error').map((i) => i.message);
  warnings.push(...issues.filter((i) => i.severity === 'warning'));
  if (errors.length) return { ok: false, errors };
  let idRewritten: { from: string; to: string } | undefined;
  if (options) {
    const taken = new Set(options.takenIds ?? []);
    if (!isUserQuestId(quest.id) || taken.has(quest.id)) {
      const to = newUserQuestId(quest.title, taken);
      idRewritten = { from: quest.id, to };
      quest = { ...quest, id: to };
      warnings.push({
        severity: 'warning',
        message: `The quest id ${idRewritten.from} was changed to ${to} so it does not clash with another quest.`,
        ref: { kind: 'quest' },
      });
    }
  }
  return idRewritten ? { ok: true, quest, warnings, idRewritten } : { ok: true, quest, warnings };
}

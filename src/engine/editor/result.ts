/**
 * Shared result type and small helpers of the editor operations.
 * Internal: `index.ts` does not export this file, except the `EditResult` type through `ops.ts`.
 */
import { board } from '../board/board';
import { QuestSchema, type Quest } from '../quest/schema';
import { validateQuestIssues, type Issue } from '../quest/validate';

export type EditResult =
  { ok: true; quest: Quest; warnings: Issue[] } | { ok: false; error: string };

export const fail = (error: string): EditResult => ({ ok: false, error });

/**
 * Safety net: an ok result is always a quest the schema accepts, so a draft can always be saved.
 * The input checks in each op give the friendly messages; this catches anything they missed.
 */
export const ok = (quest: Quest, warnings: Issue[] = []): EditResult => {
  const parsed = QuestSchema.safeParse(quest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(
      `That change would make the quest invalid (${first?.path.join('.')}: ${first?.message}).`,
    );
  }
  return { ok: true, quest, warnings };
};

/** Drop keys whose value is undefined (the schema does not allow explicit undefined). */
export function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Generated ids take the LOWEST free number. If removing d3 warned about a note that points at
 * d3, and a new door later becomes d3, that note now points at the new door. The warning from the
 * removal is the only protection: the UI must make the user fix those notes.
 */
export function nextId(prefix: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  let n = 1;
  while (set.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Problems that `after` has and `before` did not (compared by message), as warnings. */
export function newIssues(before: Quest, after: Quest): Issue[] {
  const old = new Set(validateQuestIssues(before, board).map((i) => i.message));
  return validateQuestIssues(after, board)
    .filter((i) => !old.has(i.message))
    .map((i) => ({ ...i, severity: 'warning' as const }));
}

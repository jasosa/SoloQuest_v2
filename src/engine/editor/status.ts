/**
 * Draft and approved quests (decision 110). A quest made or edited in the editor is a `draft` until
 * its creator approves it. Only approved quests are offered in the lists of quests to play. A copy
 * of a bundled quest replaces the original only when the person says so (`replaceOriginal`).
 *
 * This is separate from the editor's "Unsaved draft" / "Saved" (is the working copy stored yet).
 * Pure functions, nothing is stored here: the caller saves the returned quest and the overrides.
 */
import { tr } from '../../i18n/translate';
import { board } from '../board/board';
import { isUserQuestId, newUserQuestId } from './ids';
import { fail, ok, type EditResult } from './result';
import type { Quest } from '../quest/schema';
import { validateQuestIssues } from '../quest/validate';

export type QuestStatus = 'draft' | 'approved';

/**
 * The status of a quest. No status means approved: bundled quests, and quests saved on this device
 * before the status existed (they were already in the list, so they stay playable).
 */
export function questStatus(q: { status?: QuestStatus | undefined }): QuestStatus {
  return q.status ?? 'approved';
}

export const isApproved = (q: { status?: QuestStatus | undefined }): boolean =>
  questStatus(q) === 'approved';

/**
 * Approve a quest: it joins the lists of quests to play. A quest with validation errors cannot be
 * approved (the errors come back in the message). Save the result to make it count.
 */
export function approveQuest(q: Quest): EditResult {
  const issues = validateQuestIssues(q, board);
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0)
    return fail(
      tr(
        'editor.status.fixTheseFirst',
        'The quest cannot be approved yet. Fix this first: {problems}',
        { problems: errors.map((e) => e.message).join(' ') },
      ),
    );
  return ok(
    { ...q, status: 'approved' },
    issues.filter((i) => i.severity === 'warning'),
  );
}

/** Take a quest out of the lists of quests to play again. Save the result to make it count. */
export function withdrawQuest(q: Quest): Quest {
  return { ...q, status: 'draft' };
}

/**
 * A copy of a quest for editing (a bundled quest, or one of yours): a new user id, a draft, and the
 * link (`copyOf`) to the bundled quest it comes from. The copy never replaces the original
 * by itself. The title gets a " (copy)" suffix, numbered ("(copy 2)") when that title is taken
 * (decision 112): `takenTitles` are the titles of the saved quests.
 */
export function makeCopy(
  original: Quest,
  takenIds: Iterable<string>,
  takenTitles: Iterable<string> = [],
): Quest {
  const title = copyTitle(original.title, takenTitles);
  const { userText: _userText, ...intro } = original.intro;
  void _userText;
  const { copyOf, ...rest } = original;
  const of = isUserQuestId(original.id) ? copyOf : original.id;
  return {
    ...structuredClone(rest),
    intro,
    title,
    id: newUserQuestId(title, takenIds),
    status: 'draft',
    ...(of !== undefined ? { copyOf: of } : {}),
  };
}

/** "Title" gives "Title (copy)"; a taken title gives "Title (copy 2)", "(copy 3)"... */
export function copyTitle(title: string, takenTitles: Iterable<string> = []): string {
  const base = title.replace(/ \(copy(?: \d+)?\)$/, '');
  const taken = new Set([title, ...takenTitles]);
  let name = tr('editor.status.copyTitle', '{title} (copy)', { title: base });
  for (let n = 2; taken.has(name); n++)
    name = tr('editor.status.copyTitleN', '{title} (copy {n})', { title: base, n });
  return name;
}

/** What the lists of quests to play need to know about a saved quest of this device. */
export interface StoredQuestRef {
  readonly id: string;
  readonly status?: QuestStatus | undefined;
}

export interface PlayableUserQuests {
  /** Bundled slot -> id of the approved quest that replaces it. */
  readonly replacing: Readonly<Record<number, string>>;
  /** Approved quests that are played as quests of their own ("My quests"). */
  readonly own: readonly string[];
}

/**
 * The quests of this device that the lists of quests to play may show (decision 110).
 * `overrides` is the saved "this copy replaces bundled quest N" map. A draft never shows, not as a
 * quest of its own and not as a replacement (the bundled quest is played instead). Saved quests
 * with no status count as approved.
 */
export function playableUserQuests(
  saved: readonly StoredQuestRef[],
  overrides: Readonly<Record<number, string>>,
): PlayableUserQuests {
  const approved = new Set(saved.filter(isApproved).map((r) => r.id));
  const replacing: Record<number, string> = {};
  for (const [slot, id] of Object.entries(overrides))
    if (approved.has(id)) replacing[Number(slot)] = id;
  const replacingIds = new Set(Object.values(overrides));
  return {
    replacing,
    own: saved.filter((r) => isApproved(r) && !replacingIds.has(r.id)).map((r) => r.id),
  };
}

/**
 * The explicit "Replace the original" action. The quest must be an approved copy of a bundled
 * quest. Returns the new overrides map to store (`setOverride(slot, quest.id)` does the same).
 * `slotOf` finds the bundled slot of a bundled quest id.
 */
export function replaceOriginal(
  overrides: Readonly<Record<number, string>>,
  quest: Quest,
  slotOf: (bundledId: string) => number | undefined,
): { ok: true; slot: number; overrides: Record<number, string> } | { ok: false; error: string } {
  if (quest.copyOf === undefined)
    return {
      ok: false,
      error: tr('editor.status.notACopy', 'This quest is not a copy of a bundled quest.'),
    };
  if (!isApproved(quest))
    return {
      ok: false,
      error: tr('editor.status.approveFirst', 'Approve the quest first.'),
    };
  const slot = slotOf(quest.copyOf);
  if (slot === undefined)
    return {
      ok: false,
      error: tr('editor.status.originalMissing', 'The original quest is not in this app.'),
    };
  return { ok: true, slot, overrides: { ...overrides, [slot]: quest.id } };
}

/** The bundled slot that the quest replaces now, if any. */
export function replacedSlot(
  overrides: Readonly<Record<number, string>>,
  quest: { id: string },
): number | undefined {
  const hit = Object.entries(overrides).find(([, id]) => id === quest.id);
  return hit ? Number(hit[0]) : undefined;
}

/**
 * The draft of a monster (owner decision, 2026-11-26), as the draft of an action in `noteDraft.ts`.
 * The Monsters tab edits a copy of the monster. Nothing reaches the quest until "Save monster",
 * and then it is one undo step. "Cancel" drops the copy. A monster added in the tab is only a
 * draft until it is saved.
 *
 * Some edits also make things that belong to the quest, not to the monster: an ability, a spell or
 * an enemy copied from the Library. `runOnMonsterDraft` splits such an edit: the monster part
 * stays in the draft, the quest part is returned to be written at once (it is a definition that
 * costs nothing when it stays unused).
 */
import { newIssues, ok } from '../../engine/editor/result';
import type { MonsterDef, Quest } from '../../engine/quest/schema';
import type { EditResult } from '../../engine/editor';

export interface MonsterDraft {
  /** The monster as it is being edited. */
  readonly monster: MonsterDef;
  /** True until the first save: the monster is not in the quest yet. */
  readonly isNew: boolean;
}

/** The draft of a monster that is already in the quest. */
export const monsterDraftOf = (monster: MonsterDef): MonsterDraft => ({ monster, isNew: false });

/** The quest as the form sees it: the draft in place of the saved monster (or added, when new). */
export function withMonsterDraft(q: Quest, d: MonsterDraft): Quest {
  const has = q.monsters.some((m) => m.id === d.monster.id);
  return {
    ...q,
    monsters: has
      ? q.monsters.map((m) => (m.id === d.monster.id ? d.monster : m))
      : [...q.monsters, d.monster],
  };
}

/** The draft differs from the monster in the quest (a new monster always does). */
export function isMonsterDirty(q: Quest, d: MonsterDraft): boolean {
  if (d.isNew) return true;
  const saved = q.monsters.find((m) => m.id === d.monster.id);
  return !saved || JSON.stringify(saved) !== JSON.stringify(d.monster);
}

export type DraftRun =
  { ok: true; draft: MonsterDraft; quest: Quest | null } | { ok: false; error: string };

/**
 * Run an engine edit on the quest as the draft sees it. The result is the new draft, and the quest
 * with the changes that are not about this monster (`null` when there are none).
 */
export function runOnMonsterDraft(
  q: Quest,
  d: MonsterDraft,
  op: (q: Quest) => EditResult,
): DraftRun {
  const seen = withMonsterDraft(q, d);
  const r = op(seen);
  if (!r.ok) return r;
  const monster = r.quest.monsters.find((m) => m.id === d.monster.id);
  if (!monster) return { ok: false, error: 'The monster is gone.' };
  const outside = (Object.keys(r.quest) as (keyof Quest)[]).some(
    (k) => k !== 'monsters' && r.quest[k] !== seen[k],
  );
  return {
    ok: true,
    draft: { monster, isNew: d.isNew },
    quest: outside ? { ...r.quest, monsters: q.monsters } : null,
  };
}

/** Write the draft into the quest: a new monster is added, an old one is replaced. */
export function commitMonsterDraft(q: Quest, d: MonsterDraft): EditResult {
  const quest = withMonsterDraft(q, d);
  return ok(quest, newIssues(q, quest));
}

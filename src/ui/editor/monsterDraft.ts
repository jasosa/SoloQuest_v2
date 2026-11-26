/**
 * The draft of a monster (owner decision, 2026-11-26), as the draft of an action in `noteDraft.ts`.
 * The Monsters tab edits a copy of the monster. Nothing reaches the quest until "Save monster",
 * and then it is one undo step. "Cancel" drops the copy. A monster added in the tab is only a
 * draft until it is saved.
 *
 * Some edits also make definitions that belong to the quest, not to the monster: an ability, a spell
 * or an enemy copied from the Library, "New ability" and "New spell". `runOnMonsterDraft` splits
 * such an edit: the monster part stays in the draft; the definitions are written to the quest at
 * once (the popups of an ability or a spell edit them there), without an undo step, and the draft
 * remembers which ones it added. "Save monster" makes the whole edit one undo step. When the draft
 * is dropped (Cancel, another monster, another tab, Undo) `removeAddedDefs` takes those definitions
 * out again. A definition that was in the quest before, or that another monster uses, stays.
 */
import { newIssues, ok } from '../../engine/editor/result';
import type { MonsterDef, Quest } from '../../engine/quest/schema';
import type { EditResult } from '../../engine/editor';

/** The ids of the definitions of a quest (abilities, spells, enemies). */
export interface DefIds {
  readonly abilities: readonly string[];
  readonly spells: readonly string[];
  readonly enemies: readonly string[];
}

export const NO_DEFS: DefIds = { abilities: [], spells: [], enemies: [] };

export interface MonsterDraft {
  /** The monster as it is being edited. */
  readonly monster: MonsterDef;
  /** True until the first save: the monster is not in the quest yet. */
  readonly isNew: boolean;
  /** Definitions this draft added to the quest. */
  readonly added: DefIds;
  /** The quest before the first of them was written: the undo step of "Save monster" goes back to it. */
  readonly base: Quest | null;
}

/** The draft of a monster that is already in the quest. */
export const monsterDraftOf = (monster: MonsterDef): MonsterDraft => ({
  monster,
  isNew: false,
  added: NO_DEFS,
  base: null,
});

/** The draft of a monster that is not in the quest yet. */
export const newMonsterDraft = (monster: MonsterDef): MonsterDraft => ({
  monster,
  isNew: true,
  added: NO_DEFS,
  base: null,
});

export const hasAddedDefs = (d: MonsterDraft): boolean =>
  d.added.abilities.length + d.added.spells.length + d.added.enemies.length > 0;

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

type DefList = 'abilityDefs' | 'spellDefs' | 'enemyDefs';
const LISTS: readonly [DefList, keyof DefIds][] = [
  ['abilityDefs', 'abilities'],
  ['spellDefs', 'spells'],
  ['enemyDefs', 'enemies'],
];

/** What changed between two quests in the definitions, and whether the monsters or anything else changed. */
export function defChanges(
  before: Quest,
  after: Quest,
): { added: DefIds; touched: DefIds; other: boolean; monsters: boolean } {
  const added: Record<string, string[]> = {};
  const touched: Record<string, string[]> = {};
  for (const [list, key] of LISTS) {
    const b: readonly { id: string }[] = before[list];
    const a: readonly { id: string }[] = after[list];
    const was = new Map(b.map((x) => [x.id, x]));
    const now = new Map(a.map((x) => [x.id, x]));
    added[key] = a.filter((x) => !was.has(x.id)).map((x) => x.id);
    touched[key] = [
      ...a.filter((x) => was.get(x.id) !== x).map((x) => x.id),
      ...b.filter((x) => !now.has(x.id)).map((x) => x.id),
    ];
  }
  const skip = new Set<string>(['monsters', ...LISTS.map(([l]) => l)]);
  const other = (Object.keys(after) as (keyof Quest)[]).some(
    (k) => !skip.has(k) && after[k] !== before[k],
  );
  return {
    added: added as unknown as DefIds,
    touched: touched as unknown as DefIds,
    other,
    monsters: after.monsters !== before.monsters,
  };
}

/** The change from `before` to `after` is only about definitions the draft added. */
export function onlyAddedDefs(before: Quest, after: Quest, d: MonsterDraft): boolean {
  const c = defChanges(before, after);
  if (c.other || c.monsters) return false;
  return LISTS.every(([, key]) => c.touched[key].every((id) => d.added[key].includes(id)));
}

export type DraftRun =
  | {
      ok: true;
      draft: MonsterDraft;
      /** The quest with the new definitions (and the saved monsters as they were); `null` when there are none. */
      quest: Quest | null;
      /** Every change outside the monster is a new definition (it can be written without an undo step). */
      onlyNew: boolean;
    }
  | { ok: false; error: string };

/**
 * Run an engine edit on the quest as the draft sees it. The result is the new draft (with the ids
 * of the definitions the edit added), and the quest with the changes that are not about this
 * monster (`null` when there are none).
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
  const c = defChanges(seen, r.quest);
  const outside = (Object.keys(r.quest) as (keyof Quest)[]).some(
    (k) => k !== 'monsters' && r.quest[k] !== seen[k],
  );
  const added: DefIds = {
    abilities: [...d.added.abilities, ...c.added.abilities],
    spells: [...d.added.spells, ...c.added.spells],
    enemies: [...d.added.enemies, ...c.added.enemies],
  };
  const onlyNew =
    !c.other && LISTS.every(([, key]) => c.touched[key].every((id) => c.added[key].includes(id)));
  return {
    ok: true,
    draft: { monster, isNew: d.isNew, added, base: d.base },
    quest: outside ? { ...r.quest, monsters: q.monsters } : null,
    onlyNew,
  };
}

/**
 * The quest without the definitions the draft added, or `null` when there is nothing to take out.
 * A definition that another monster uses stays (the draft's own saved monster does not count: it
 * cannot use a definition that did not exist before the draft).
 */
export function removeAddedDefs(q: Quest, d: MonsterDraft): Quest | null {
  if (!hasAddedDefs(d)) return null;
  const others = q.monsters.filter((m) => m.id !== d.monster.id);
  const usedAbility = new Set(others.flatMap((m) => m.abilities ?? []));
  const usedSpell = new Set(others.flatMap((m) => m.spells ?? []));
  const usedEnemy = new Set(others.flatMap((m) => (m.enemy ? [m.enemy] : [])));
  const enemies = q.enemyDefs.filter((e) => !d.added.enemies.includes(e.id) || usedEnemy.has(e.id));
  // what a removed enemy needed (its abilities and spells) goes with it, unless something else uses it
  const enemyAbility = new Set(enemies.flatMap((e) => e.abilities ?? []));
  const enemySpell = new Set(enemies.flatMap((e) => e.spells ?? []));
  const abilityDefs = q.abilityDefs.filter(
    (a) => !d.added.abilities.includes(a.id) || usedAbility.has(a.id) || enemyAbility.has(a.id),
  );
  const spellDefs = q.spellDefs.filter(
    (s) => !d.added.spells.includes(s.id) || usedSpell.has(s.id) || enemySpell.has(s.id),
  );
  if (
    enemies.length === q.enemyDefs.length &&
    abilityDefs.length === q.abilityDefs.length &&
    spellDefs.length === q.spellDefs.length
  )
    return null;
  return { ...q, enemyDefs: enemies, abilityDefs, spellDefs };
}

/** Write the draft into the quest: a new monster is added, an old one is replaced. */
export function commitMonsterDraft(q: Quest, d: MonsterDraft): EditResult {
  const quest = withMonsterDraft(q, d);
  return ok(quest, newIssues(q, quest));
}

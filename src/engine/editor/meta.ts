/**
 * Quest-level operations: Zargon info, wandering monster, objectives and rules overrides.
 * Same style as `ops.ts`: pure, the input is never changed, ids stay stable.
 * Half done work is allowed (an objective that points at a missing monster): that comes back as
 * warnings, and `validateQuestIssues` keeps listing it as an error.
 */
import type { MonsterType, ObjectiveDef, Quest, QuestRules } from '../quest/schema';
import { clean, fail, newIssues, nextId, ok, type EditResult } from './result';

/** Text for Zargon only. Empty text clears it. */
export function setZargonInfo(q: Quest, text: string): EditResult {
  const t = text.trim();
  const { zargonInfo: _old, ...rest } = q;
  void _old;
  return ok(t === '' ? rest : { ...rest, zargonInfo: t });
}

/** What a wandering monster is: a monster type, free text, or `null` for none. */
export type WanderingInput = { monster: MonsterType } | { text: string } | null;

export function setWandering(q: Quest, wandering: WanderingInput): EditResult {
  const { wandering: _old, ...rest } = q;
  void _old;
  if (wandering === null) return ok(rest);
  if ('text' in wandering) {
    const t = wandering.text.trim();
    if (t === '') return fail('The wandering monster text cannot be empty.');
    return ok({ ...rest, wandering: { text: t } });
  }
  return ok({ ...rest, wandering: { monster: wandering.monster } });
}

// ---- objectives

export interface NewObjective {
  text: string;
  done?: ObjectiveDef['done'];
  id?: string;
}

export function addObjective(q: Quest, input: NewObjective): EditResult {
  const text = input.text.trim();
  if (text === '') return fail('An objective needs text.');
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
      return fail(`The objective id "${id}" is not valid.`);
    if (q.objectives.some((o) => o.id === id))
      return fail(`An objective with id ${id} already exists.`);
  } else
    id = nextId(
      'o',
      q.objectives.map((o) => o.id),
    );
  const objective: ObjectiveDef = clean({ id, text, done: input.done });
  const quest = { ...q, objectives: [...q.objectives, objective] };
  return ok(quest, newIssues(q, quest));
}

/** `null` clears `done`; a missing key leaves it as it is. */
export interface ObjectivePatch {
  text?: string;
  done?: ObjectiveDef['done'] | null;
}

export function updateObjective(q: Quest, id: string, patch: ObjectivePatch): EditResult {
  const o = q.objectives.find((x) => x.id === id);
  if (!o) return fail(`There is no objective ${id}.`);
  const next: ObjectiveDef = { ...o };
  if (patch.text !== undefined) {
    const t = patch.text.trim();
    if (t === '') return fail('An objective needs text.');
    next.text = t;
  }
  if (patch.done === null) delete next.done;
  else if (patch.done !== undefined) next.done = patch.done;
  const quest = { ...q, objectives: q.objectives.map((x) => (x.id === id ? next : x)) };
  return ok(quest, newIssues(q, quest));
}

/** Remove an objective. Notes that complete it come back as warnings. */
export function removeObjective(q: Quest, id: string): EditResult {
  if (!q.objectives.some((o) => o.id === id)) return fail(`There is no objective ${id}.`);
  const quest = { ...q, objectives: q.objectives.filter((o) => o.id !== id) };
  return ok(quest, newIssues(q, quest));
}

// ---- rules

/** `null` clears a rule; a missing key leaves it as it is. */
export type RulesPatch = { [K in keyof QuestRules]?: QuestRules[K] | null };

export function setRules(q: Quest, patch: RulesPatch): EditResult {
  const next: Record<string, unknown> = { ...q.rules };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) delete next[k];
    else if (typeof v === 'string' && v.trim() === '')
      return fail(`The ${k} rule cannot be empty.`);
    else next[k] = v;
  }
  const quest = { ...q, rules: next as QuestRules };
  return ok(quest, newIssues(q, quest));
}

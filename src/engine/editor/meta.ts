/**
 * Quest-level operations: wandering monster, objectives and rules overrides.
 * Same style as `ops.ts`: pure, the input is never changed, ids stay stable.
 * Half done work is allowed (an objective that points at a missing monster): that comes back as
 * warnings, and `validateQuestIssues` keeps listing it as an error.
 */
import { CORE_ABILITIES } from '../data/abilities';
import {
  CORE_SPELLS,
  isSpellTag,
  type OfferWhen,
  type SpellTag,
  type SpellTiming,
} from '../data/spells';
import type { EndingDef, MonsterType, ObjectiveDef, Quest, QuestRules } from '../quest/schema';
import { clean, fail, newIssues, nextId, ok, type EditResult } from './result';

/** An ability of the quest (decision 69), next to the core library. */
export interface NewAbility {
  name: string;
  text: string;
  kind?: 'ability' | 'weakness' | 'immunity';
  id?: string;
}

export function addAbility(q: Quest, input: NewAbility): EditResult {
  const name = input.name.trim();
  const text = input.text.trim();
  if (name === '') return fail('An ability needs a name.');
  if (text === '') return fail('An ability needs text.');
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
      return fail(`The ability id "${id}" is not valid.`);
    if (CORE_ABILITIES.some((a) => a.id === id) || q.abilityDefs.some((a) => a.id === id))
      return fail(`An ability with id ${id} already exists.`);
  } else id = nextId('ab', [...CORE_ABILITIES.map((a) => a.id), ...q.abilityDefs.map((a) => a.id)]);
  const def = clean({ id, name, text, kind: input.kind });
  const quest = { ...q, abilityDefs: [...q.abilityDefs, def] };
  return ok(quest, newIssues(q, quest));
}

export function updateAbility(
  q: Quest,
  id: string,
  patch: { name?: string; text?: string; kind?: 'ability' | 'weakness' | 'immunity' },
): EditResult {
  const a = q.abilityDefs.find((x) => x.id === id);
  if (!a) return fail(`There is no ability ${id} of this quest.`);
  const name = patch.name === undefined ? a.name : patch.name.trim();
  const text = patch.text === undefined ? a.text : patch.text.trim();
  if (name === '') return fail('An ability needs a name.');
  if (text === '') return fail('An ability needs text.');
  const next = clean({ ...a, name, text, kind: patch.kind ?? a.kind });
  const quest = { ...q, abilityDefs: q.abilityDefs.map((x) => (x.id === id ? next : x)) };
  return ok(quest, newIssues(q, quest));
}

/** Remove an ability of the quest. Monsters that still list it come back as warnings. */
export function removeAbility(q: Quest, id: string): EditResult {
  if (!q.abilityDefs.some((a) => a.id === id))
    return fail(`There is no ability ${id} of this quest.`);
  const quest = { ...q, abilityDefs: q.abilityDefs.filter((a) => a.id !== id) };
  return ok(quest, newIssues(q, quest));
}

/** A spell of the quest (decision 70), next to the core spells. */
export interface SpellInput {
  name?: string;
  text?: string | null;
  tags?: SpellTag[];
  /** One question of its own; replaces the tags. `null` clears it. */
  question?: string | null;
  warning?: string | null;
  offerWhen?: OfferWhen;
  /** When it is cast in the turn. `either` is the default and is not stored. */
  timing?: SpellTiming;
}

export function addSpell(q: Quest, input: SpellInput & { id?: string }): EditResult {
  const name = (input.name ?? '').trim();
  if (name === '') return fail('A spell needs a name.');
  const tags = input.tags ?? [];
  const question = input.question?.trim() || undefined;
  if (tags.length === 0 && !question) return fail('A spell needs a situation or a question.');
  const bad = tags.find((t) => !isSpellTag(t));
  if (bad) return fail(`Unknown situation "${bad}".`);
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) return fail(`The spell id "${id}" is not valid.`);
    if (CORE_SPELLS.some((s) => s.id === id) || q.spellDefs.some((s) => s.id === id))
      return fail(`A spell with id ${id} already exists.`);
  } else id = nextId('sp', [...CORE_SPELLS.map((s) => s.id), ...q.spellDefs.map((s) => s.id)]);
  const def = clean({
    id,
    name,
    text: input.text?.trim() || undefined,
    tags: [...new Set(tags)],
    question,
    warning: input.warning?.trim() || undefined,
    offerWhen: input.offerWhen && input.offerWhen !== 'always' ? input.offerWhen : undefined,
    timing: input.timing && input.timing !== 'either' ? input.timing : undefined,
  });
  const quest = { ...q, spellDefs: [...q.spellDefs, def] };
  return ok(quest, newIssues(q, quest));
}

export function updateSpell(q: Quest, id: string, patch: SpellInput): EditResult {
  const s = q.spellDefs.find((x) => x.id === id);
  if (!s) return fail(`There is no spell ${id} of this quest.`);
  const name = patch.name === undefined ? s.name : patch.name.trim();
  if (name === '') return fail('A spell needs a name.');
  const tags = patch.tags === undefined ? [...s.tags] : [...new Set(patch.tags)];
  const bad = tags.find((t) => !isSpellTag(t));
  if (bad) return fail(`Unknown situation "${bad}".`);
  const question =
    patch.question === undefined
      ? s.question
      : patch.question === null
        ? undefined
        : patch.question.trim() || undefined;
  if (tags.length === 0 && !question) return fail('A spell needs a situation or a question.');
  const pick = (cur: string | undefined, v: string | null | undefined) =>
    v === undefined ? cur : v === null ? undefined : v.trim() || undefined;
  const next = clean({
    id,
    name,
    text: pick(s.text, patch.text),
    tags,
    question,
    warning: pick(s.warning, patch.warning),
    offerWhen:
      (patch.offerWhen ?? s.offerWhen) === 'escapePoint' ? ('escapePoint' as const) : undefined,
    timing: (() => {
      const t = patch.timing ?? s.timing;
      return t && t !== 'either' ? t : undefined;
    })(),
  });
  const quest = { ...q, spellDefs: q.spellDefs.map((x) => (x.id === id ? next : x)) };
  return ok(quest, newIssues(q, quest));
}

/** Remove a spell of the quest. Monsters and notes that still use it come back as warnings. */
export function removeSpell(q: Quest, id: string): EditResult {
  if (!q.spellDefs.some((s) => s.id === id)) return fail(`There is no spell ${id} of this quest.`);
  const quest = { ...q, spellDefs: q.spellDefs.filter((s) => s.id !== id) };
  return ok(quest, newIssues(q, quest));
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

// ---- endings

export interface NewEnding {
  label: string;
  text?: string;
  id?: string;
}

/** Put the list back on the quest; an empty list removes the field. */
function withEndings(q: Quest, endings: EndingDef[]): Quest {
  const { endings: _old, ...rest } = q;
  void _old;
  return endings.length === 0 ? rest : { ...rest, endings };
}

/** Add a custom quest ending (for example "Sir Ragnar died"). */
export function addEnding(q: Quest, input: NewEnding): EditResult {
  const label = input.label.trim();
  if (label === '') return fail('An ending needs a label.');
  const list = q.endings ?? [];
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) return fail(`The ending id "${id}" is not valid.`);
    if (list.some((e) => e.id === id)) return fail(`An ending with id ${id} already exists.`);
  } else
    id = nextId(
      'e',
      list.map((e) => e.id),
    );
  const text = input.text?.trim();
  const ending: EndingDef = clean({ id, label, text: text === '' ? undefined : text });
  const quest = withEndings(q, [...list, ending]);
  return ok(quest, newIssues(q, quest));
}

/** `null` clears the text; a missing key leaves it as it is. */
export interface EndingPatch {
  label?: string;
  text?: string | null;
}

export function updateEnding(q: Quest, id: string, patch: EndingPatch): EditResult {
  const list = q.endings ?? [];
  const e = list.find((x) => x.id === id);
  if (!e) return fail(`There is no ending ${id}.`);
  const next: EndingDef = { ...e };
  if (patch.label !== undefined) {
    const l = patch.label.trim();
    if (l === '') return fail('An ending needs a label.');
    next.label = l;
  }
  if (patch.text !== undefined) {
    const t = patch.text === null ? '' : patch.text.trim();
    if (t === '') delete next.text;
    else next.text = t;
  }
  const quest = withEndings(
    q,
    list.map((x) => (x.id === id ? next : x)),
  );
  return ok(quest, newIssues(q, quest));
}

/** Remove an ending. Nothing in the quest refers to endings, so there is nothing to warn about. */
export function removeEnding(q: Quest, id: string): EditResult {
  const list = q.endings ?? [];
  if (!list.some((e) => e.id === id)) return fail(`There is no ending ${id}.`);
  const quest = withEndings(
    q,
    list.filter((e) => e.id !== id),
  );
  return ok(quest, newIssues(q, quest));
}

/**
 * Quest-level operations: wandering monster, objectives and rules overrides.
 * Same style as `ops.ts`: pure, the input is never changed, ids stay stable.
 * Half done work is allowed (an objective that points at a missing monster): that comes back as
 * warnings, and `validateQuestIssues` keeps listing it as an error.
 */
import { tr } from '../../i18n/translate';
import { CORE_ABILITIES } from '../data/abilities';
import { CORE_SPELLS, isSpellTag, type OfferWhen, type SpellTiming } from '../data/spells';
import type {
  Condition,
  EndingDef,
  MonsterType,
  NpcDef,
  ObjectiveDef,
  Quest,
  QuestRules,
} from '../quest/schema';
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
  if (name === '') return fail(tr('editor.meta.anAbilityNeedsAName', 'An ability needs a name.'));
  if (text === '') return fail(tr('editor.meta.anAbilityNeedsText', 'An ability needs text.'));
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
      return fail(
        tr('editor.meta.theAbilityIdIsNotValid', 'The ability id "{id}" is not valid.', { id }),
      );
    if (CORE_ABILITIES.some((a) => a.id === id) || q.abilityDefs.some((a) => a.id === id))
      return fail(
        tr('editor.meta.anAbilityWithIdAlreadyExists', 'An ability with id {id} already exists.', {
          id,
        }),
      );
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
  if (!a)
    return fail(
      tr('editor.meta.thereIsNoAbilityOfThis', 'There is no ability {id} of this quest.', { id }),
    );
  const name = patch.name === undefined ? a.name : patch.name.trim();
  const text = patch.text === undefined ? a.text : patch.text.trim();
  if (name === '') return fail(tr('editor.meta.anAbilityNeedsAName', 'An ability needs a name.'));
  if (text === '') return fail(tr('editor.meta.anAbilityNeedsText', 'An ability needs text.'));
  const next = clean({ ...a, name, text, kind: patch.kind ?? a.kind });
  const quest = { ...q, abilityDefs: q.abilityDefs.map((x) => (x.id === id ? next : x)) };
  return ok(quest, newIssues(q, quest));
}

/** Remove an ability of the quest. Monsters that still list it come back as warnings. */
export function removeAbility(q: Quest, id: string): EditResult {
  if (!q.abilityDefs.some((a) => a.id === id))
    return fail(
      tr('editor.meta.thereIsNoAbilityOfThis', 'There is no ability {id} of this quest.', { id }),
    );
  const quest = { ...q, abilityDefs: q.abilityDefs.filter((a) => a.id !== id) };
  return ok(quest, newIssues(q, quest));
}

/** A spell of the quest (decision 70), next to the core spells. */
export interface SpellInput {
  name?: string;
  text?: string | null;
  tags?: string[];
  /** Situations of the spell's own: an id and a question each. Replaces the list. */
  situations?: { id: string; question: string }[];
  /** One question of its own; replaces the tags. `null` clears it. */
  question?: string | null;
  warning?: string | null;
  offerWhen?: OfferWhen;
  /** When it is cast in the turn. `either` is the default and is not stored. */
  timing?: SpellTiming;
}

/**
 * Checks the own situations of a spell and the tags that use them. Returns the cleaned list, or
 * an error text. An id is letters, digits, - and _, not a fixed situation id, not repeated.
 */
function checkSituations(
  situations: readonly { id: string; question: string }[] | undefined,
  tags: readonly string[],
): { list: { id: string; question: string }[] } | { error: string } {
  const list: { id: string; question: string }[] = [];
  for (const s of situations ?? []) {
    const id = s.id.trim();
    const question = s.question.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
      return {
        error: tr(
          'editor.meta.theSituationIdIsNotValid',
          'The situation id "{id}" is not valid. Use letters, numbers, - and _.',
          { id },
        ),
      };
    if (isSpellTag(id) || list.some((x) => x.id === id))
      return {
        error: tr(
          'editor.meta.theSituationIdIsTaken',
          'The situation id "{id}" is already used. Pick another.',
          { id },
        ),
      };
    if (question === '')
      return {
        error: tr(
          'editor.meta.aSituationNeedsAQuestion',
          'The situation "{id}" needs a question the players can answer.',
          { id },
        ),
      };
    list.push({ id, question });
  }
  const bad = tags.find((t) => !isSpellTag(t) && !list.some((x) => x.id === t));
  if (bad)
    return { error: tr('editor.meta.unknownSituation', 'Unknown situation "{bad}".', { bad }) };
  return { list };
}

export function addSpell(q: Quest, input: SpellInput & { id?: string }): EditResult {
  const name = (input.name ?? '').trim();
  if (name === '') return fail(tr('editor.meta.aSpellNeedsAName', 'A spell needs a name.'));
  const tags = input.tags ?? [];
  const question = input.question?.trim() || undefined;
  if (tags.length === 0 && !question)
    return fail(
      tr('editor.meta.aSpellNeedsASituationOr', 'A spell needs a situation or a question.'),
    );
  const sit = checkSituations(input.situations, tags);
  if ('error' in sit) return fail(sit.error);
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
      return fail(
        tr('editor.meta.theSpellIdIsNotValid', 'The spell id "{id}" is not valid.', { id }),
      );
    if (CORE_SPELLS.some((s) => s.id === id) || q.spellDefs.some((s) => s.id === id))
      return fail(
        tr('editor.meta.aSpellWithIdAlreadyExists', 'A spell with id {id} already exists.', { id }),
      );
  } else id = nextId('sp', [...CORE_SPELLS.map((s) => s.id), ...q.spellDefs.map((s) => s.id)]);
  const def = clean({
    id,
    name,
    text: input.text?.trim() || undefined,
    tags: [...new Set(tags)],
    situations: sit.list.length ? sit.list : undefined,
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
  if (!s)
    return fail(
      tr('editor.meta.thereIsNoSpellOfThis', 'There is no spell {id} of this quest.', { id }),
    );
  const name = patch.name === undefined ? s.name : patch.name.trim();
  if (name === '') return fail(tr('editor.meta.aSpellNeedsAName', 'A spell needs a name.'));
  const tags = patch.tags === undefined ? [...s.tags] : [...new Set(patch.tags)];
  const sit = checkSituations(patch.situations ?? s.situations, tags);
  if ('error' in sit) return fail(sit.error);
  const question =
    patch.question === undefined
      ? s.question
      : patch.question === null
        ? undefined
        : patch.question.trim() || undefined;
  if (tags.length === 0 && !question)
    return fail(
      tr('editor.meta.aSpellNeedsASituationOr', 'A spell needs a situation or a question.'),
    );
  const pick = (cur: string | undefined, v: string | null | undefined) =>
    v === undefined ? cur : v === null ? undefined : v.trim() || undefined;
  const next = clean({
    id,
    name,
    text: pick(s.text, patch.text),
    tags,
    situations: sit.list.length ? sit.list : undefined,
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
  if (!q.spellDefs.some((s) => s.id === id))
    return fail(
      tr('editor.meta.thereIsNoSpellOfThis', 'There is no spell {id} of this quest.', { id }),
    );
  const quest = { ...q, spellDefs: q.spellDefs.filter((s) => s.id !== id) };
  return ok(quest, newIssues(q, quest));
}

/**
 * What a wandering monster is: a monster type (with how many come at once from a wandering monster
 * trap, and the enemy of the quest it is), free text, or `null` for none.
 */
export type WanderingInput =
  | { monster: MonsterType; count?: number | undefined; enemy?: string | undefined }
  | { text: string }
  | null;

export function setWandering(q: Quest, wandering: WanderingInput): EditResult {
  const { wandering: _old, ...rest } = q;
  void _old;
  if (wandering === null) return ok(rest);
  if ('text' in wandering) {
    const t = wandering.text.trim();
    if (t === '')
      return fail(
        tr(
          'editor.meta.theWanderingMonsterTextCannotBe',
          'The wandering monster text cannot be empty.',
        ),
      );
    return ok({ ...rest, wandering: { text: t } });
  }
  const { count, enemy } = wandering;
  if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 6))
    return fail(
      tr(
        'editor.meta.howManyWanderingMonstersComeIs',
        'How many wandering monsters come is a whole number from 1 to 6.',
      ),
    );
  if (enemy !== undefined && !q.enemyDefs.some((e) => e.id === enemy))
    return fail(tr('editor.meta.unknownEnemy', 'Unknown enemy "{enemy}".', { enemy }));
  const next = clean({ monster: wandering.monster, count: count === 1 ? undefined : count, enemy });
  const quest = { ...rest, wandering: next };
  return ok(quest, newIssues(q, quest));
}

// ---- objectives

export interface NewObjective {
  text: string;
  done?: ObjectiveDef['done'];
  /** A button in the Quest sheet that completes it (for goals the app cannot see). */
  confirm?: string;
  /** The confirm button shows only while all of these hold. Needs `confirm`. */
  confirmWhen?: Condition[];
  id?: string;
}

export function addObjective(q: Quest, input: NewObjective): EditResult {
  const text = input.text.trim();
  if (text === '') return fail(tr('editor.meta.anObjectiveNeedsText', 'An objective needs text.'));
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
      return fail(
        tr('editor.meta.theObjectiveIdIsNotValid', 'The objective id "{id}" is not valid.', { id }),
      );
    if (q.objectives.some((o) => o.id === id))
      return fail(
        tr(
          'editor.meta.anObjectiveWithIdAlreadyExists',
          'An objective with id {id} already exists.',
          { id },
        ),
      );
  } else
    id = nextId(
      'o',
      q.objectives.map((o) => o.id),
    );
  const confirm = input.confirm?.trim();
  const objective: ObjectiveDef = clean({
    id,
    text,
    done: input.done,
    confirm: confirm === '' ? undefined : confirm,
    confirmWhen: input.confirmWhen?.length ? input.confirmWhen : undefined,
  });
  const quest = { ...q, objectives: [...q.objectives, objective] };
  return ok(quest, newIssues(q, quest));
}

/** `null` clears `done`; a missing key leaves it as it is. */
export interface ObjectivePatch {
  text?: string;
  done?: ObjectiveDef['done'] | null;
  /** `null` or empty text clears the confirm button (and its conditions). */
  confirm?: string | null;
  confirmWhen?: Condition[] | null;
}

export function updateObjective(q: Quest, id: string, patch: ObjectivePatch): EditResult {
  const o = q.objectives.find((x) => x.id === id);
  if (!o) return fail(tr('editor.meta.thereIsNoObjective', 'There is no objective {id}.', { id }));
  const next: ObjectiveDef = { ...o };
  if (patch.text !== undefined) {
    const t = patch.text.trim();
    if (t === '') return fail(tr('editor.meta.anObjectiveNeedsText', 'An objective needs text.'));
    next.text = t;
  }
  if (patch.done === null) delete next.done;
  else if (patch.done !== undefined) next.done = patch.done;
  if (patch.confirm !== undefined) {
    const c = patch.confirm === null ? '' : patch.confirm.trim();
    if (c === '') {
      delete next.confirm;
      delete next.confirmWhen;
    } else next.confirm = c;
  }
  if (patch.confirmWhen !== undefined) {
    if (patch.confirmWhen?.length) {
      if (next.confirm === undefined)
        return fail(
          tr('editor.meta.writeTheConfirmButtonTextFirst', 'Write the confirm button text first.'),
        );
      next.confirmWhen = patch.confirmWhen;
    } else delete next.confirmWhen;
  }
  const quest = { ...q, objectives: q.objectives.map((x) => (x.id === id ? next : x)) };
  return ok(quest, newIssues(q, quest));
}

/** Remove an objective. Notes that complete it come back as warnings. */
export function removeObjective(q: Quest, id: string): EditResult {
  if (!q.objectives.some((o) => o.id === id))
    return fail(tr('editor.meta.thereIsNoObjective', 'There is no objective {id}.', { id }));
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
      return fail(tr('editor.meta.theRuleCannotBeEmpty', 'The {k} rule cannot be empty.', { k }));
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
  if (label === '') return fail(tr('editor.meta.anEndingNeedsALabel', 'An ending needs a label.'));
  const list = q.endings ?? [];
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
      return fail(
        tr('editor.meta.theEndingIdIsNotValid', 'The ending id "{id}" is not valid.', { id }),
      );
    if (list.some((e) => e.id === id))
      return fail(
        tr('editor.meta.anEndingWithIdAlreadyExists', 'An ending with id {id} already exists.', {
          id,
        }),
      );
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
  if (!e) return fail(tr('editor.meta.thereIsNoEnding', 'There is no ending {id}.', { id }));
  const next: EndingDef = { ...e };
  if (patch.label !== undefined) {
    const l = patch.label.trim();
    if (l === '') return fail(tr('editor.meta.anEndingNeedsALabel', 'An ending needs a label.'));
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
  if (!list.some((e) => e.id === id))
    return fail(tr('editor.meta.thereIsNoEnding', 'There is no ending {id}.', { id }));
  const quest = withEndings(
    q,
    list.filter((e) => e.id !== id),
  );
  return ok(quest, newIssues(q, quest));
}

// ---- end text

/** The note on the end screen after every ending. Empty or `null` clears it. */
export function setEndText(q: Quest, text: string | null): EditResult {
  const { endText: _old, ...rest } = q;
  void _old;
  const t = text?.trim() ?? '';
  return ok(t === '' ? rest : { ...rest, endText: t });
}

// ---- characters (NPCs)

export interface NewNpc {
  name: string;
  cell: [number, number];
  defend: number;
  body: number;
  move?: number;
  attack?: number;
  text?: string;
  id?: string;
}

const wholeOrNone = (v: number | undefined | null) =>
  v === undefined || v === null || (Number.isInteger(v) && v >= 0);

/** A character the quest brings in with the effect "Bring in a character" (Gothar of Q3). */
export function addNpc(q: Quest, input: NewNpc): EditResult {
  const name = input.name.trim();
  if (name === '') return fail(tr('editor.meta.aCharacterNeedsAName', 'A character needs a name.'));
  if (![input.defend, input.body].every((v) => Number.isInteger(v) && v >= 0))
    return fail(
      tr(
        'editor.meta.defendAndBodyAreWholeNumbers',
        'Defend and Body are whole numbers, 0 or more.',
      ),
    );
  if (!wholeOrNone(input.move) || !wholeOrNone(input.attack))
    return fail(
      tr(
        'editor.meta.moveAndAttackAreWholeNumbers',
        'Move and Attack are whole numbers, 0 or more.',
      ),
    );
  let id = input.id;
  if (id !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))
      return fail(
        tr('editor.meta.theCharacterIdIsNotValid', 'The character id "{id}" is not valid.', { id }),
      );
    if (q.npcs.some((n) => n.id === id))
      return fail(
        tr(
          'editor.meta.aCharacterWithIdAlreadyExists',
          'A character with id {id} already exists.',
          { id },
        ),
      );
  } else
    id = nextId(
      'npc',
      q.npcs.map((n) => n.id),
    );
  const npc: NpcDef = clean({
    id,
    name,
    cell: [input.cell[0], input.cell[1]],
    defend: input.defend,
    body: input.body,
    move: input.move,
    attack: input.attack,
    text: input.text?.trim() ?? '',
  });
  const quest = { ...q, npcs: [...q.npcs, npc] };
  return ok(quest, newIssues(q, quest));
}

/** `null` clears move, attack or text; a missing key leaves it as it is. */
export interface NpcPatch {
  name?: string;
  cell?: [number, number];
  defend?: number;
  body?: number;
  move?: number | null;
  attack?: number | null;
  text?: string | null;
}

export function updateNpc(q: Quest, id: string, patch: NpcPatch): EditResult {
  const n = q.npcs.find((x) => x.id === id);
  if (!n) return fail(tr('editor.meta.thereIsNoCharacter', 'There is no character {id}.', { id }));
  const next: Record<string, unknown> = { ...n };
  if (patch.name !== undefined) {
    if (patch.name.trim() === '')
      return fail(tr('editor.meta.aCharacterNeedsAName', 'A character needs a name.'));
    next.name = patch.name.trim();
  }
  if (patch.cell !== undefined) next.cell = [patch.cell[0], patch.cell[1]];
  for (const k of ['defend', 'body'] as const) {
    const v = patch[k];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 0)
      return fail(tr('editor.meta.isAWholeNumber0Or', '{k} is a whole number, 0 or more.', { k }));
    next[k] = v;
  }
  for (const k of ['move', 'attack'] as const) {
    const v = patch[k];
    if (v === undefined) continue;
    if (!wholeOrNone(v))
      return fail(tr('editor.meta.isAWholeNumber0Or', '{k} is a whole number, 0 or more.', { k }));
    if (v === null) delete next[k];
    else next[k] = v;
  }
  if (patch.text !== undefined) next.text = patch.text?.trim() ?? '';
  const quest = { ...q, npcs: q.npcs.map((x) => (x.id === id ? (next as NpcDef) : x)) };
  return ok(quest, newIssues(q, quest));
}

/** Remove a character. Actions that bring it in come back as warnings. */
export function removeNpc(q: Quest, id: string): EditResult {
  if (!q.npcs.some((n) => n.id === id))
    return fail(tr('editor.meta.thereIsNoCharacter', 'There is no character {id}.', { id }));
  const quest = { ...q, npcs: q.npcs.filter((n) => n.id !== id) };
  return ok(quest, newIssues(q, quest));
}

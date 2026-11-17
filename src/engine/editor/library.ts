/**
 * Using a library item in a quest (decision 70). The quest keeps its own copy of everything it
 * uses, so a quest file works on any device. Each helper returns the quest with the item added
 * (and what the item needs) and the id the item has in the quest. If the quest already has an
 * item with that id and the same content it is reused; if the id is taken by something else the
 * copy gets a free id. Pure.
 */
import { CORE_ABILITIES } from '../data/abilities';
import { CORE_SPELLS } from '../data/spells';
import type { AbilityDefData, EnemyDef, Quest, SpellDefData } from '../quest/schema';
import { addMonster, updateMonster, type Cell } from './ops';
import { fail, newIssues, ok, type EditResult } from './result';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function freeId(taken: readonly string[], want: string): string {
  if (!taken.includes(want)) return want;
  for (let n = 2; ; n++) if (!taken.includes(`${want}-${n}`)) return `${want}-${n}`;
}

/** True when a library ability has the id of a core one but other content (a core item that was changed). */
export function abilityChanged(def: AbilityDefData): boolean {
  const core = CORE_ABILITIES.find((a) => a.id === def.id);
  return (
    core !== undefined &&
    (core.name !== def.name || core.text !== def.text || core.kind !== (def.kind ?? 'ability'))
  );
}

/** The same for a spell. */
export function spellChanged(def: SpellDefData): boolean {
  const core = CORE_SPELLS.find((s) => s.id === def.id);
  if (!core) return false;
  const { core: _flag, ...rest } = core;
  void _flag;
  const norm = (x: Record<string, unknown>) =>
    JSON.stringify({
      name: x.name,
      text: x.text ?? null,
      tags: x.tags ?? [],
      question: x.question ?? null,
      warning: x.warning ?? null,
      offerWhen: x.offerWhen ?? 'always',
      timing: x.timing ?? 'either',
    });
  return norm(rest) !== norm(def as unknown as Record<string, unknown>);
}

export interface Added {
  readonly quest: Quest;
  /** The id the item has in the quest. */
  readonly id: string;
}

export function takeLibraryAbility(q: Quest, def: AbilityDefData): Added {
  if (CORE_ABILITIES.some((a) => a.id === def.id) && !abilityChanged(def))
    return { quest: q, id: def.id };
  const own = q.abilityDefs.find((a) => a.id === def.id);
  if (own && same(own, def)) return { quest: q, id: def.id };
  const taken = [...CORE_ABILITIES.map((a) => a.id), ...q.abilityDefs.map((a) => a.id)];
  const id = freeId(taken, def.id);
  return { quest: { ...q, abilityDefs: [...q.abilityDefs, { ...def, id }] }, id };
}

export function takeLibrarySpell(q: Quest, def: SpellDefData): Added {
  if (CORE_SPELLS.some((s) => s.id === def.id) && !spellChanged(def))
    return { quest: q, id: def.id };
  const own = q.spellDefs.find((s) => s.id === def.id);
  if (own && same(own, def)) return { quest: q, id: def.id };
  const taken = [...CORE_SPELLS.map((s) => s.id), ...q.spellDefs.map((s) => s.id)];
  const id = freeId(taken, def.id);
  return { quest: { ...q, spellDefs: [...q.spellDefs, { ...def, id }] }, id };
}

/** What the library knows, to find the abilities and spells an enemy lists. */
export interface LibraryContent {
  readonly abilities: readonly AbilityDefData[];
  readonly spells: readonly SpellDefData[];
}

/**
 * Copy an enemy into the quest with the abilities and spells it lists that are not core. An ability
 * or spell the library does not have is dropped from the copy (the quest could not know it).
 */
export function takeLibraryEnemy(q: Quest, def: EnemyDef, lib: LibraryContent): Added {
  let quest = q;
  const abilities: string[] = [];
  for (const id of def.abilities ?? []) {
    const item = lib.abilities.find((a) => a.id === id);
    if (item) {
      const r = takeLibraryAbility(quest, item);
      quest = r.quest;
      abilities.push(r.id);
    } else if (CORE_ABILITIES.some((a) => a.id === id)) abilities.push(id);
  }
  const spells: string[] = [];
  for (const id of def.spells ?? []) {
    const item = lib.spells.find((s) => s.id === id);
    if (item) {
      const r = takeLibrarySpell(quest, item);
      quest = r.quest;
      spells.push(r.id);
    } else if (CORE_SPELLS.some((s) => s.id === id)) spells.push(id);
  }
  const copy: EnemyDef = {
    ...def,
    ...(abilities.length ? { abilities } : { abilities: undefined }),
    ...(spells.length ? { spells } : { spells: undefined }),
  };
  if (!copy.abilities) delete (copy as { abilities?: unknown }).abilities;
  if (!copy.spells) delete (copy as { spells?: unknown }).spells;
  const own = quest.enemyDefs.find((e) => e.id === def.id);
  if (own && same(own, copy)) return { quest, id: def.id };
  const id = freeId(
    quest.enemyDefs.map((e) => e.id),
    def.id,
  );
  return { quest: { ...quest, enemyDefs: [...quest.enemyDefs, { ...copy, id }] }, id };
}

/** Give a monster an ability from the library (a copy goes into the quest if it is not core). */
export function addLibraryAbilityToMonster(
  q: Quest,
  monsterId: string,
  def: AbilityDefData,
): EditResult {
  const m = q.monsters.find((x) => x.id === monsterId);
  if (!m) return fail(`There is no monster ${monsterId}.`);
  const t = takeLibraryAbility(q, def);
  const mine = m.abilities ?? [];
  if (mine.includes(t.id)) return fail('That monster already has that ability.');
  return updateMonster(t.quest, monsterId, { abilities: [...mine, t.id] });
}

/** Give a monster a spell from the library (a copy goes into the quest if it is not core). */
export function addLibrarySpellToMonster(
  q: Quest,
  monsterId: string,
  def: SpellDefData,
): EditResult {
  const m = q.monsters.find((x) => x.id === monsterId);
  if (!m) return fail(`There is no monster ${monsterId}.`);
  const t = takeLibrarySpell(q, def);
  return updateMonster(t.quest, monsterId, { spells: [...(m.spells ?? []), t.id] });
}

/**
 * The core type a monster of this enemy carries in the quest file. An enemy with no base type is
 * completely its own: it carries the goblin type, but its own stats, plan and weights win.
 */
export const carrierType = (def: Pick<EnemyDef, 'base'>) => def.base ?? 'goblin';

/** The quest's copy of an enemy is older than, or different from, the library's version. */
export function enemyDiffersFromLibrary(q: Quest, def: EnemyDef): boolean {
  const own = q.enemyDefs.find((e) => e.id === def.id);
  return own !== undefined && JSON.stringify(own) !== JSON.stringify(def);
}

/**
 * Replace the quest's copy of an enemy with the library's version (stats, abilities, spells,
 * letter, picture). Monsters that use the enemy keep it and show the new values at once.
 */
export function updateEnemyFromLibrary(q: Quest, def: EnemyDef, lib: LibraryContent): EditResult {
  if (!q.enemyDefs.some((e) => e.id === def.id)) return fail(`The quest has no enemy ${def.id}.`);
  const without = { ...q, enemyDefs: q.enemyDefs.filter((e) => e.id !== def.id) };
  const t = takeLibraryEnemy(without, def, lib);
  // keep the position of the enemy in the list
  const index = q.enemyDefs.findIndex((e) => e.id === def.id);
  const taken = t.quest.enemyDefs.find((e) => e.id === t.id)!;
  const rest = t.quest.enemyDefs.filter((e) => e.id !== t.id);
  rest.splice(index, 0, taken);
  const quest = { ...t.quest, enemyDefs: rest };
  return ok(quest, newIssues(q, quest));
}

/**
 * Put a monster of a custom enemy on the map. A library enemy is copied into the quest first
 * (`fromLibrary`); an enemy the quest already has is used as it is. The monster takes the type the
 * enemy behaves like, and the enemy gives its name, stats, abilities and spells.
 */
export function addMonsterOfEnemy(
  q: Quest,
  def: EnemyDef,
  cell: Cell | null,
  opts: { fromLibrary: boolean; lib: LibraryContent; hidden?: boolean },
): EditResult {
  const t = opts.fromLibrary ? takeLibraryEnemy(q, def, opts.lib) : { quest: q, id: def.id };
  const made = addMonster(t.quest, carrierType(def), cell, opts.hidden ? { hidden: true } : {});
  if (!made.ok) return made;
  const id = made.quest.monsters.at(-1)?.id;
  if (!id) return fail('The monster could not be added.');
  return updateMonster(made.quest, id, { enemy: t.id });
}

/**
 * Make a monster an enemy from the library: the enemy is copied into the quest and the monster
 * takes its type (the enemy's base). Its own name and stat overrides stay as they are.
 */
export function setMonsterEnemyFromLibrary(
  q: Quest,
  monsterId: string,
  def: EnemyDef,
  lib: LibraryContent,
): EditResult {
  if (!q.monsters.some((x) => x.id === monsterId)) return fail(`There is no monster ${monsterId}.`);
  const t = takeLibraryEnemy(q, def, lib);
  return updateMonster(t.quest, monsterId, { type: carrierType(def), enemy: t.id });
}

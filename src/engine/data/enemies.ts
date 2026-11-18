/**
 * Enemies as data (decision 70): a reusable monster definition (base type, letter, image, stats,
 * abilities, spells) that a monster of a quest points at with `enemy`. The engine never sees the
 * indirection: `resolveEnemies` returns the quest with every monster filled in, and `buildLevel`
 * uses it. The editor keeps working on the quest as written. Pure.
 */
import type { MonsterDef, Quest } from '../quest/schema';

/** Image data URLs are small on purpose (the editor shrinks them): about 100 KB at most. */
export const MAX_IMAGE_CHARS = 100_000;
export const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const union = (a: readonly string[] | undefined, b: readonly string[] | undefined) => {
  const out = [...new Set([...(a ?? []), ...(b ?? [])])];
  return out.length ? out : undefined;
};

/** One monster with the defaults of its enemy filled in. The monster's own fields win. */
export function resolveMonster(m: MonsterDef, enemies: Quest['enemyDefs']): MonsterDef {
  if (!m.enemy) return m;
  const e = enemies.find((x) => x.id === m.enemy);
  if (!e) return m;
  const overrides = { ...(e.overrides ?? {}), ...(m.overrides ?? {}) };
  const abilities = union(e.abilities, m.abilities);
  const traits = union(e.traits, m.traits);
  const spells = m.spells ?? e.spells;
  const letter = m.letter ?? e.letter;
  const image = m.image ?? e.image;
  const profile = m.profile ?? e.profile;
  const weights = m.weights ?? e.weights;
  const attacks = m.attacks ?? e.attacks;
  const size = m.size ?? e.size;
  return {
    ...m,
    name: m.name ?? e.name,
    ...(Object.keys(overrides).length ? { overrides } : {}),
    ...(abilities ? { abilities } : {}),
    ...(traits ? { traits } : {}),
    ...(spells ? { spells } : {}),
    ...(letter ? { letter } : {}),
    ...(image ? { image } : {}),
    ...(profile ? { profile } : {}),
    ...(weights ? { weights } : {}),
    ...(attacks ? { attacks } : {}),
    ...(size ? { size } : {}),
  };
}

/**
 * The core type whose texture-pack picture a monster may use. A monster that is an enemy with no
 * base type is its own kind (an Ice Gremlin is not a goblin), so no pack picture of a core type fits it.
 */
export function pictureTypeOf(
  m: Pick<MonsterDef, 'type' | 'enemy'>,
  enemies: Quest['enemyDefs'],
): MonsterDef['type'] | undefined {
  const e = m.enemy ? enemies.find((x) => x.id === m.enemy) : undefined;
  return e && e.base === undefined ? undefined : m.type;
}

/** The box (expansion) a monster's enemy comes from, if it has one. */
export function boxOfMonster(
  m: Pick<MonsterDef, 'enemy'>,
  enemies: Quest['enemyDefs'],
): string | undefined {
  return m.enemy ? enemies.find((x) => x.id === m.enemy)?.expansion : undefined;
}

/** The quest with every monster resolved. The same object when no monster uses an enemy. */
export function resolveEnemies(quest: Quest): Quest {
  if (!quest.monsters.some((m) => m.enemy)) return quest;
  return {
    ...quest,
    monsters: quest.monsters.map((m) => resolveMonster(m, quest.enemyDefs)),
  };
}

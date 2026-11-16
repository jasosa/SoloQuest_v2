/**
 * Reusable special abilities of monsters (decision 69). A monster lists ability ids; the text
 * shows in its tooltip, its margin note and Zargon's order. A quest may add its own abilities
 * (`abilityDefs`). Weaknesses and immunities are abilities with a kind. All texts are our own
 * words. A regular monster with an ability is not a special monster: `special` is a separate flag
 * for story-critical monsters.
 */
import type { Quest } from '../quest/schema';

export type AbilityKind = 'ability' | 'weakness' | 'immunity';

export interface AbilityDef {
  readonly id: string;
  readonly name: string;
  readonly text: string;
  readonly kind: AbilityKind;
}

export const CORE_ABILITIES: readonly AbilityDef[] = [
  {
    id: 'stone',
    name: 'Made of stone',
    text: 'Rolls 1 extra defend die.',
    kind: 'ability',
  },
  {
    id: 'fireImmune',
    name: 'Fireproof',
    text: 'Fire spells have no effect on it.',
    kind: 'immunity',
  },
  {
    id: 'spiritBladeOnly',
    name: 'Only the Spirit Blade',
    text: 'Weapons and spells do nothing to it. Only the Spirit Blade can hurt it.',
    kind: 'immunity',
  },
  {
    id: 'statue',
    name: 'Statue',
    text: 'Attacks do nothing to it until it has taken a step or struck a hero.',
    kind: 'immunity',
  },
];

/** The core abilities and the quest's own, by id. A quest ability cannot reuse a core id. */
export function abilityLookup(
  quest: Pick<Quest, 'abilityDefs'> | undefined,
): ReadonlyMap<string, AbilityDef> {
  const out = new Map<string, AbilityDef>(CORE_ABILITIES.map((a) => [a.id, a]));
  for (const a of quest?.abilityDefs ?? [])
    if (!out.has(a.id))
      out.set(a.id, { id: a.id, name: a.name, text: a.text, kind: a.kind ?? 'ability' });
  return out;
}

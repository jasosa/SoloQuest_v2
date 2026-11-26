/**
 * The kinds of the Monsters tool of the Map tab (concept `editor-map-monsters-concept.html`): the
 * monsters you can place, grouped by the box they come from. Pure, no React.
 *
 * - Core game: the 9 core types.
 * - One kind for each expansion that has an enemy in the library or in the quest.
 * - This quest: the enemies the quest already has (made or copied). Listed only when there are some.
 * - My library: the library enemies that belong to no expansion. Always listed, even with 0.
 *
 * An enemy of the library that the quest does not have is copied into the quest the first time it is
 * placed (`fromLibrary`). One the quest has is used as it is.
 */
import { MONSTER_NAMES, MONSTER_STATS } from '../../engine/data/monsters';
import { MONSTER_TYPES, type EnemyDef } from '../../engine/quest/schema';
import type { MonsterKind } from '../../engine/editor';

export type KindKey = 'core' | 'quest' | 'mine' | `exp:${string}`;

/** One monster card. */
export interface KindItem {
  /** Unique in a kind and stable: `core:orc`, or the enemy id. */
  readonly id: string;
  readonly name: string;
  /** "Move · Att · Def · Body · Mind", the numbers the monster starts with. */
  readonly stats: string;
  /** What placing it needs: a core type, or an enemy (and whether it is copied in first). */
  readonly pick:
    { readonly type: MonsterKind } | { readonly enemy: EnemyDef; readonly fromLibrary: boolean };
}

/** One row of the list of kinds. */
export interface Kind {
  readonly key: KindKey;
  readonly label: string;
  /** The expansion (box) it belongs to; `undefined` for the base game and for items with no box. */
  readonly expansion: string | undefined;
  readonly items: readonly KindItem[];
}

const FIVE = ['move', 'att', 'def', 'body', 'mind'] as const;

/** The stats line of an enemy: its own numbers over those of the core type it starts from. */
export function enemyStats(def: Pick<EnemyDef, 'base' | 'overrides'>): string {
  const base = def.base ? MONSTER_STATS[def.base] : undefined;
  return FIVE.map((k) => def.overrides?.[k] ?? base?.[k] ?? 0).join(' · ');
}

const coreItems = (): KindItem[] =>
  MONSTER_TYPES.map((type) => ({
    id: `core:${type}`,
    name: MONSTER_NAMES[type],
    stats: FIVE.map((k) => MONSTER_STATS[type][k]).join(' · '),
    pick: { type },
  }));

export interface KindsInput {
  /** The enemies the quest has (`quest.enemyDefs`). */
  readonly questEnemies: readonly EnemyDef[];
  /** The library enemies that can be added (not those of a box that is switched off). */
  readonly libraryEnemies: readonly EnemyDef[];
  /** The expansion of an enemy: its own, or the one of the Core library item. */
  readonly expansionOf: (e: EnemyDef) => string | undefined;
}

/**
 * The list of kinds, in order: Core game, the expansions by name, This quest, My library. A kind with
 * no monster is left out, except My library.
 */
export function monsterKinds(input: KindsInput): Kind[] {
  const own = new Map(input.questEnemies.map((e) => [e.id, e]));
  // the quest's copy wins over the library's: it is what is placed
  const item = (e: EnemyDef): KindItem => {
    const mine = own.get(e.id);
    const def = mine ?? e;
    return {
      id: def.id,
      name: def.name,
      stats: enemyStats(def),
      pick: { enemy: def, fromLibrary: mine === undefined },
    };
  };
  const byExpansion = new Map<string, Map<string, KindItem>>();
  const mine = new Map<string, KindItem>();
  for (const e of input.libraryEnemies) {
    const x = input.expansionOf(e);
    if (x === undefined) mine.set(e.id, item(e));
    else {
      if (!byExpansion.has(x)) byExpansion.set(x, new Map());
      byExpansion.get(x)!.set(e.id, item(e));
    }
  }
  // an enemy the quest has, of an expansion, is listed there even when the library no longer offers it
  for (const e of input.questEnemies) {
    const x = e.expansion ?? input.expansionOf(e);
    if (x === undefined) continue;
    if (!byExpansion.has(x)) byExpansion.set(x, new Map());
    if (!byExpansion.get(x)!.has(e.id)) byExpansion.get(x)!.set(e.id, item(e));
  }
  const kinds: Kind[] = [
    { key: 'core', label: 'Core game', expansion: undefined, items: coreItems() },
  ];
  for (const name of [...byExpansion.keys()].sort((a, b) => a.localeCompare(b)))
    kinds.push({
      key: `exp:${name}`,
      label: name,
      expansion: name,
      items: [...byExpansion.get(name)!.values()],
    });
  if (input.questEnemies.length > 0)
    kinds.push({
      key: 'quest',
      label: 'This quest',
      expansion: undefined,
      items: input.questEnemies.map(item),
    });
  kinds.push({ key: 'mine', label: 'My library', expansion: undefined, items: [...mine.values()] });
  return kinds;
}

/** The kind a picked monster is listed under first (to name it and colour its row). */
export function kindOfPick(
  kinds: readonly Kind[],
  pick: KindItem['pick'] | null,
): { kind: Kind; item: KindItem } | undefined {
  if (!pick) return undefined;
  for (const kind of kinds)
    for (const it of kind.items) {
      const same =
        'type' in pick
          ? 'type' in it.pick && it.pick.type === pick.type
          : 'enemy' in it.pick && it.pick.enemy.id === pick.enemy.id;
      if (same) return { kind, item: it };
    }
  return undefined;
}

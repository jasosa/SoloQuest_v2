/**
 * Core library files (decision 76). The built-in Core (the nine monster types, the core abilities
 * and spells in code) can be added to, changed and have items removed by files in
 * `src/content/library/`. The owner makes them in the Designer ("Export Core"). `applyCoreFile`
 * changes the registries in place, so everything that looks up core items sees the result.
 * Pure: no files are read here.
 */
import { CORE_ABILITIES, type AbilityDef } from './abilities';
import { CORE_SPELLS, type SpellDef } from './spells';

export const CORE_FILE_FORMAT = 'soloquest-core';

export type CoreKind = 'ability' | 'spell' | 'enemy' | 'hero' | 'companion';
const KINDS: readonly CoreKind[] = ['ability', 'spell', 'enemy', 'hero', 'companion'];

export interface CoreItem {
  readonly kind: CoreKind;
  /** The expansion an item belongs to. Missing means the base game. */
  readonly expansion?: string;
  /** The item is taken out of Core (it is only hidden if the engine has it built in). */
  readonly deleted?: boolean;
  readonly data: Record<string, unknown> & { readonly id: string; readonly name: string };
}

export interface CoreFile {
  readonly format: typeof CORE_FILE_FORMAT;
  readonly items: readonly CoreItem[];
}

/** Core enemies, heroes and companions that the files add (the built-in ones are in code). */
export const CORE_EXTRA: Record<'enemy' | 'hero' | 'companion', CoreItem[]> = {
  enemy: [],
  hero: [],
  companion: [],
};
/** Built-in items that a file took out, by kind. They are hidden from the menus. */
export const CORE_RETIRED: Record<CoreKind, Set<string>> = {
  ability: new Set(),
  spell: new Set(),
  enemy: new Set(),
  hero: new Set(),
  companion: new Set(),
};
/** The expansion of an item by `kind:id` (the base game has none). */
export const CORE_EXPANSION = new Map<string, string>();

/** The file, or undefined when it is not a Core file. */
export function parseCoreFile(raw: unknown): CoreFile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as { format?: unknown; items?: unknown };
  if (f.format !== CORE_FILE_FORMAT || !Array.isArray(f.items)) return undefined;
  const items: CoreItem[] = [];
  for (const it of f.items as CoreItem[]) {
    if (!it || !KINDS.includes(it.kind) || typeof it.data?.id !== 'string') continue;
    items.push(it);
  }
  return { format: CORE_FILE_FORMAT, items };
}

const BUILT_IN_ENEMIES = new Set([
  'goblin',
  'orc',
  'abomination',
  'skeleton',
  'zombie',
  'mummy',
  'dreadWarrior',
  'gargoyle',
  'dreadSorcerer',
]);
const BUILT_IN_HEROES = new Set(['barbarian', 'dwarf', 'elf', 'wizard']);

function put<T extends { id: string }>(list: T[], id: string, next: T | undefined) {
  const i = list.findIndex((x) => x.id === id);
  if (next === undefined) {
    if (i >= 0) list.splice(i, 1);
  } else if (i >= 0) list[i] = next;
  else list.push(next);
}

/** Apply one Core file. Later files win over earlier ones. */
export function applyCoreFile(file: CoreFile): void {
  for (const it of file.items) {
    const id = it.data.id;
    if (it.expansion) CORE_EXPANSION.set(`${it.kind}:${id}`, it.expansion);
    if (it.kind === 'ability') {
      put(CORE_ABILITIES as AbilityDef[], id, it.deleted ? undefined : toAbility(it));
      if (it.deleted) CORE_RETIRED.ability.add(id);
      else CORE_RETIRED.ability.delete(id);
    } else if (it.kind === 'spell') {
      put(CORE_SPELLS as SpellDef[], id, it.deleted ? undefined : toSpell(it));
      if (it.deleted) CORE_RETIRED.spell.add(id);
      else CORE_RETIRED.spell.delete(id);
    } else {
      const builtIn =
        it.kind === 'enemy'
          ? BUILT_IN_ENEMIES
          : it.kind === 'hero'
            ? BUILT_IN_HEROES
            : new Set<string>();
      const list = CORE_EXTRA[it.kind];
      const i = list.findIndex((x) => x.data.id === id);
      if (it.deleted) {
        // a built-in item is hidden (the engine still needs the type); an added one is dropped
        if (builtIn.has(id)) CORE_RETIRED[it.kind].add(id);
        if (i >= 0) list.splice(i, 1);
      } else {
        CORE_RETIRED[it.kind].delete(id);
        if (i >= 0) list[i] = it;
        else list.push(it);
      }
    }
  }
}

function toAbility(it: CoreItem): AbilityDef {
  const d = it.data as Record<string, unknown>;
  return {
    id: it.data.id,
    name: it.data.name,
    text: String(d.text ?? ''),
    kind: (d.kind as AbilityDef['kind']) ?? 'ability',
  };
}

function toSpell(it: CoreItem): SpellDef {
  const d = it.data as Record<string, unknown>;
  return {
    id: it.data.id,
    name: it.data.name,
    ...(typeof d.text === 'string' ? { text: d.text } : {}),
    tags: (d.tags as SpellDef['tags']) ?? [],
    ...(typeof d.question === 'string' ? { question: d.question } : {}),
    ...(typeof d.warning === 'string' ? { warning: d.warning } : {}),
    offerWhen: (d.offerWhen as SpellDef['offerWhen']) ?? 'always',
    ...(d.timing ? { timing: d.timing as NonNullable<SpellDef['timing']> } : {}),
    core: true,
  };
}

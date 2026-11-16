import Dexie, { type EntityTable } from 'dexie';
import { z } from 'zod';
import {
  AbilityDefSchema,
  CompanionDefSchema,
  EnemyDefSchema,
  HeroDefSchema,
  SpellDefSchema,
} from '../engine/quest/schema';

/**
 * The Designer library (decision 70): abilities, spells, enemies, heroes and companions made once
 * and kept on this device (IndexedDB), to use in any quest. A quest keeps its own copy of what it
 * uses, so the library is a source to pick from, never a dependency of a quest file. Items can be
 * exported to a file and imported on another device.
 * Lives outside `src/engine/` because it touches IndexedDB. Timestamps are passed in.
 */

export const LIBRARY_KINDS = ['ability', 'spell', 'enemy', 'hero', 'companion'] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const LIBRARY_KIND_NAMES: Readonly<Record<LibraryKind, string>> = {
  ability: 'Abilities',
  spell: 'Spells',
  enemy: 'Enemies',
  hero: 'Heroes',
  companion: 'Companions',
};

const SCHEMAS = {
  ability: AbilityDefSchema,
  spell: SpellDefSchema,
  enemy: EnemyDefSchema,
  hero: HeroDefSchema,
  companion: CompanionDefSchema,
} as const;

export interface LibraryItem {
  readonly kind: LibraryKind;
  readonly id: string;
  readonly name: string;
  /** The item itself, as the quest format has it. */
  readonly data: Record<string, unknown>;
  readonly updatedAt: number;
}

export interface ImportResult {
  readonly added: number;
  readonly replaced: number;
  readonly skipped: number;
}

export interface LibraryStore {
  /** Items of one kind (or all), by name. Corrupt rows are skipped (not deleted). */
  list(kind?: LibraryKind): Promise<LibraryItem[]>;
  /** Rejects when the data is not valid for its kind. */
  save(kind: LibraryKind, data: unknown, now: number): Promise<void>;
  remove(kind: LibraryKind, id: string): Promise<void>;
  /** All items as the text of a file. */
  exportAll(): Promise<string>;
  /** Items of a file: valid ones are added or replace the item with the same kind and id. */
  importAll(text: string, now: number): Promise<ImportResult>;
}

export const LIBRARY_FORMAT = 'soloquest-library';

/** The checked data of an item, or undefined when it is not valid for its kind. */
export function checkedItem(
  kind: LibraryKind,
  data: unknown,
): { id: string; name: string; data: Record<string, unknown> } | undefined {
  const r = SCHEMAS[kind].safeParse(data);
  if (!r.success) return undefined;
  const d = r.data as { id: string; name: string };
  return { id: d.id, name: d.name, data: d as unknown as Record<string, unknown> };
}

const FileSchema = z.object({
  format: z.literal(LIBRARY_FORMAT),
  version: z.literal(1),
  items: z.array(z.object({ kind: z.enum(LIBRARY_KINDS), data: z.unknown() })),
});

const keyOf = (kind: LibraryKind, id: string) => `${kind}:${id}`;

abstract class BaseLibraryStore implements LibraryStore {
  protected abstract rows(): Promise<
    { kind: LibraryKind; id: string; data: unknown; updatedAt: number }[]
  >;
  protected abstract put(
    kind: LibraryKind,
    id: string,
    name: string,
    data: Record<string, unknown>,
    now: number,
  ): Promise<void>;
  protected abstract has(kind: LibraryKind, id: string): Promise<boolean>;
  abstract remove(kind: LibraryKind, id: string): Promise<void>;

  async list(kind?: LibraryKind): Promise<LibraryItem[]> {
    const out: LibraryItem[] = [];
    for (const r of await this.rows()) {
      if (kind && r.kind !== kind) continue;
      const c = checkedItem(r.kind, r.data);
      if (c && typeof r.updatedAt === 'number')
        out.push({ kind: r.kind, id: c.id, name: c.name, data: c.data, updatedAt: r.updatedAt });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async save(kind: LibraryKind, data: unknown, now: number): Promise<void> {
    const c = checkedItem(kind, data);
    if (!c) throw new Error('The data is not valid for the library and was not saved.');
    await this.put(kind, c.id, c.name, c.data, now);
  }

  async exportAll(): Promise<string> {
    const items = (await this.list()).map((i) => ({ kind: i.kind, data: i.data }));
    return `${JSON.stringify({ format: LIBRARY_FORMAT, version: 1, items }, null, 2)}\n`;
  }

  async importAll(text: string, now: number): Promise<ImportResult> {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('That file is not a library file.');
    }
    const f = FileSchema.safeParse(raw);
    if (!f.success) throw new Error('That file is not a library file.');
    let added = 0;
    let replaced = 0;
    let skipped = 0;
    for (const item of f.data.items) {
      const c = checkedItem(item.kind, item.data);
      if (!c) {
        skipped++;
        continue;
      }
      if (await this.has(item.kind, c.id)) replaced++;
      else added++;
      await this.put(item.kind, c.id, c.name, c.data, now);
    }
    return { added, replaced, skipped };
  }
}

export class MemoryLibraryStore extends BaseLibraryStore {
  private readonly map = new Map<
    string,
    { kind: LibraryKind; id: string; data: unknown; updatedAt: number }
  >();
  protected async rows() {
    return [...this.map.values()].map((r) => structuredClone(r));
  }
  protected async put(
    kind: LibraryKind,
    id: string,
    _name: string,
    data: Record<string, unknown>,
    now: number,
  ) {
    this.map.set(keyOf(kind, id), { kind, id, data: structuredClone(data), updatedAt: now });
  }
  protected async has(kind: LibraryKind, id: string) {
    return this.map.has(keyOf(kind, id));
  }
  async remove(kind: LibraryKind, id: string): Promise<void> {
    this.map.delete(keyOf(kind, id));
  }
}

interface LibraryRow {
  key: string;
  kind: LibraryKind;
  id: string;
  name: string;
  updatedAt: number;
  data: unknown;
}

// A database of its own, like the user quests: nothing else is touched.
class LibraryDb extends Dexie {
  items!: EntityTable<LibraryRow, 'key'>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ items: 'key, kind, updatedAt' });
  }
}

export class DexieLibraryStore extends BaseLibraryStore {
  private readonly db: LibraryDb;
  constructor(name = 'soloquest-library') {
    super();
    this.db = new LibraryDb(name);
  }
  protected async rows() {
    return (await this.db.items.toArray()).map((r) => ({
      kind: r.kind,
      id: r.id,
      data: r.data,
      updatedAt: r.updatedAt,
    }));
  }
  protected async put(
    kind: LibraryKind,
    id: string,
    name: string,
    data: Record<string, unknown>,
    now: number,
  ) {
    await this.db.items.put({ key: keyOf(kind, id), kind, id, name, updatedAt: now, data });
  }
  protected async has(kind: LibraryKind, id: string) {
    return (await this.db.items.get(keyOf(kind, id))) !== undefined;
  }
  async remove(kind: LibraryKind, id: string): Promise<void> {
    await this.db.items.delete(keyOf(kind, id));
  }
  close(): void {
    this.db.close();
  }
}

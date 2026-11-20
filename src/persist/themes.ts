import Dexie, { type EntityTable } from 'dexie';
import type { StoredPack } from '../ui/theme/pack';

/**
 * Texture packs kept on this device (decision 78): the imported `.sqtextures` files, in IndexedDB,
 * and which one is in use. Quests and saves never refer to a pack.
 */

export interface PackSummary {
  id: string;
  name: string;
  origin: 'official' | 'fan';
  author?: string | undefined;
  /** Size of the pictures, in bytes. */
  bytes: number;
  /** The quest pack it dresses (an expansion pack); a core pack has none. */
  box?: string | undefined;
  /** The family of packs it belongs to (a core pack starts one, an expansion pack joins one). */
  family?: string | undefined;
  /** An expansion pack: the id of the one core pack it is made for. */
  extends?: string | undefined;
  /** Ships with the app: it cannot be deleted. */
  included?: boolean | undefined;
}

export interface ThemeStore {
  list(): Promise<PackSummary[]>;
  load(id: string): Promise<StoredPack | undefined>;
  /** Adds the pack, or replaces the one with the same id. */
  save(pack: StoredPack): Promise<void>;
  remove(id: string): Promise<void>;
  /** The packs in use (decision 99). */
  getSelection(): Promise<ActiveSelection>;
  setSelection(selection: ActiveSelection): Promise<void>;
}

/**
 * The packs in use: one core pack (null: the built-in look) and the expansion packs of that core pack's
 * family, one per box. An expansion pack is only in the list while its core pack is the core one.
 */
export interface ActiveSelection {
  core: string | null;
  expansions: string[];
}

export const NO_SELECTION: ActiveSelection = { core: null, expansions: [] };

export function summaryOf(pack: StoredPack): PackSummary {
  const m = pack.manifest;
  return {
    id: m.id,
    name: m.name,
    origin: m.origin,
    ...(m.author ? { author: m.author } : {}),
    ...(m.box ? { box: m.box } : {}),
    ...(m.family ? { family: m.family } : {}),
    ...(m.extends ? { extends: m.extends } : {}),
    bytes: Object.values(pack.files).reduce((n, f) => n + f.bytes.length, 0),
  };
}

export class MemoryThemeStore implements ThemeStore {
  private packs = new Map<string, StoredPack>();
  private selection: ActiveSelection = { core: null, expansions: [] };
  async list() {
    return [...this.packs.values()].map(summaryOf);
  }
  async load(id: string) {
    return this.packs.get(id);
  }
  async save(pack: StoredPack) {
    this.packs.set(pack.manifest.id, pack);
  }
  async remove(id: string) {
    this.packs.delete(id);
  }
  async getSelection() {
    return { core: this.selection.core, expansions: [...this.selection.expansions] };
  }
  async setSelection(selection: ActiveSelection) {
    this.selection = { core: selection.core, expansions: [...selection.expansions] };
  }
}

interface PackRow {
  id: string;
  updatedAt: number;
  pack: StoredPack;
}

class ThemeDb extends Dexie {
  packs!: EntityTable<PackRow, 'id'>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ packs: 'id, updatedAt' });
  }
}

/** The first versions kept one pack id here. It is read as the core pack and moved to `SELECTION_KEY`. */
const LEGACY_KEY = 'soloquest-active-texture-pack';
const SELECTION_KEY = 'soloquest-texture-selection';

export class DexieThemeStore implements ThemeStore {
  private db: ThemeDb;
  constructor(name = 'soloquest-themes') {
    this.db = new ThemeDb(name);
  }
  async list() {
    try {
      return (await this.db.packs.toArray()).map((r) => summaryOf(r.pack));
    } catch {
      return [];
    }
  }
  async load(id: string) {
    try {
      return (await this.db.packs.get(id))?.pack;
    } catch {
      return undefined;
    }
  }
  async save(pack: StoredPack) {
    await this.db.packs.put({ id: pack.manifest.id, updatedAt: Date.now(), pack });
  }
  async remove(id: string) {
    await this.db.packs.delete(id);
  }
  async getSelection(): Promise<ActiveSelection> {
    try {
      const raw = localStorage.getItem(SELECTION_KEY);
      if (raw) {
        const v = JSON.parse(raw) as Partial<ActiveSelection>;
        return {
          core: typeof v.core === 'string' ? v.core : null,
          expansions: Array.isArray(v.expansions)
            ? v.expansions.filter((x): x is string => typeof x === 'string')
            : [],
        };
      }
      const legacy = localStorage.getItem(LEGACY_KEY);
      return { core: legacy, expansions: [] };
    } catch {
      return { core: null, expansions: [] };
    }
  }
  async setSelection(selection: ActiveSelection) {
    try {
      localStorage.removeItem(LEGACY_KEY);
      if (selection.core) localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
      else localStorage.removeItem(SELECTION_KEY);
    } catch {
      /* storage unavailable: the packs are used until the page closes */
    }
  }
}

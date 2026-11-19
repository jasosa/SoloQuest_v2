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
  /** The quest pack it dresses; the core game when missing. */
  box?: string | undefined;
  /** The texture pack it builds on. */
  extends?: string | undefined;
}

export interface ThemeStore {
  list(): Promise<PackSummary[]>;
  load(id: string): Promise<StoredPack | undefined>;
  /** Adds the pack, or replaces the one with the same id. */
  save(pack: StoredPack): Promise<void>;
  remove(id: string): Promise<void>;
  /** The id of the pack in use, or null for the built-in look. */
  getActive(): Promise<string | null>;
  setActive(id: string | null): Promise<void>;
}

export function summaryOf(pack: StoredPack): PackSummary {
  const m = pack.manifest;
  return {
    id: m.id,
    name: m.name,
    origin: m.origin,
    ...(m.author ? { author: m.author } : {}),
    ...(m.box ? { box: m.box } : {}),
    ...(m.extends ? { extends: m.extends } : {}),
    bytes: Object.values(pack.files).reduce((n, f) => n + f.bytes.length, 0),
  };
}

export class MemoryThemeStore implements ThemeStore {
  private packs = new Map<string, StoredPack>();
  private active: string | null = null;
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
    if (this.active === id) this.active = null;
  }
  async getActive() {
    return this.active;
  }
  async setActive(id: string | null) {
    this.active = id;
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

const ACTIVE_KEY = 'soloquest-active-texture-pack';

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
    if ((await this.getActive()) === id) await this.setActive(null);
  }
  async getActive() {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  }
  async setActive(id: string | null) {
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* storage unavailable: the pack is used until the page closes */
    }
  }
}

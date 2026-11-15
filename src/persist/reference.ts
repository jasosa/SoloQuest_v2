import Dexie, { type EntityTable } from 'dexie';

/**
 * The reference image of a quest in the editor, kept on this device only (IndexedDB), one row per
 * quest id. It is never part of the quest, never exported and never uploaded.
 */
export interface ReferenceRecord {
  questId: string;
  image: Blob;
  /** Four corner points on the image in image pixels, or null before the image is aligned. */
  corners: [number, number][] | null;
  opacity: number;
  visible: boolean;
}

export interface ReferenceStore {
  load(questId: string): Promise<ReferenceRecord | undefined>;
  save(rec: ReferenceRecord): Promise<void>;
  remove(questId: string): Promise<void>;
}

export class MemoryReferenceStore implements ReferenceStore {
  private rows = new Map<string, ReferenceRecord>();
  async load(questId: string) {
    return this.rows.get(questId);
  }
  async save(rec: ReferenceRecord) {
    this.rows.set(rec.questId, rec);
  }
  async remove(questId: string) {
    this.rows.delete(questId);
  }
}

class ReferenceDb extends Dexie {
  refs!: EntityTable<ReferenceRecord, 'questId'>;
  constructor() {
    super('soloquest-reference');
    this.version(1).stores({ refs: 'questId' });
  }
}

export class DexieReferenceStore implements ReferenceStore {
  private db = new ReferenceDb();
  async load(questId: string) {
    try {
      return await this.db.refs.get(questId);
    } catch {
      return undefined;
    }
  }
  async save(rec: ReferenceRecord) {
    await this.db.refs.put(rec);
  }
  async remove(questId: string) {
    await this.db.refs.delete(questId);
  }
}

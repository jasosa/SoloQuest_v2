import Dexie, { type EntityTable } from 'dexie';
import { USER_QUEST_PREFIX, isUserQuestId, newUserQuestId } from '../engine/editor/ids';
import { dropLegacy } from '../engine/quest/migrate';
import { QuestSchema, type Quest } from '../engine/quest/schema';

/**
 * Quests made in the editor, kept on this device (IndexedDB), plus one autosaved draft per quest.
 * `userText` stays here: it is only stripped on export.
 *
 * Ids: a user quest id must start with `user-`. Bundled quests are `qNN-...`, so the two can never
 * collide. `newUserQuestId` makes one from a title.
 * Lives outside `src/engine/` because it touches IndexedDB. Timestamps are passed in.
 */

export { USER_QUEST_PREFIX, isUserQuestId, newUserQuestId };

export interface UserQuestSummary {
  id: string;
  title: string;
  number: number;
  updatedAt: number;
}

export interface UserQuestStore {
  /** Saved quests, newest first. Corrupt rows are skipped (not deleted). */
  list(): Promise<UserQuestSummary[]>;
  /** Undefined when there is no such quest or its stored row is corrupt (load never throws on data). */
  load(id: string): Promise<Quest | undefined>;
  /** Rejects when the id is not a user id or the quest is not valid data. */
  save(quest: Quest, now: number): Promise<void>;
  /** Removes the quest and its draft. */
  remove(id: string): Promise<void>;
  /** The editor autosave: the working copy, which may still have validation errors. */
  saveDraft(quest: Quest, now: number): Promise<void>;
  /** Undefined when missing. A corrupt draft is deleted and also gives undefined. */
  loadDraft(id: string): Promise<{ quest: Quest; updatedAt: number } | undefined>;
  removeDraft(id: string): Promise<void>;
}

function checked(quest: Quest): Quest {
  if (!isUserQuestId(quest.id))
    throw new Error(
      `A quest you made needs an id like "${USER_QUEST_PREFIX}my-quest", not "${quest.id}".`,
    );
  const parsed = QuestSchema.safeParse(quest);
  if (!parsed.success) throw new Error('The quest data is not valid and was not saved.');
  return parsed.data;
}

/** The quest of a stored row, or undefined when the row is corrupt. Never throws. */
function readBack(data: unknown): Quest | undefined {
  const parsed = QuestSchema.safeParse(dropLegacy(data));
  return parsed.success ? parsed.data : undefined;
}

const summary = (q: Quest, updatedAt: number): UserQuestSummary => ({
  id: q.id,
  title: q.title,
  number: q.number,
  updatedAt,
});

export class MemoryUserQuestStore implements UserQuestStore {
  private readonly quests = new Map<string, { quest: Quest; updatedAt: number }>();
  private readonly drafts = new Map<string, { quest: Quest; updatedAt: number }>();
  async list(): Promise<UserQuestSummary[]> {
    return [...this.quests.values()]
      .map((r) => summary(r.quest, r.updatedAt))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async load(id: string): Promise<Quest | undefined> {
    return structuredClone(this.quests.get(id)?.quest);
  }
  async save(quest: Quest, now: number): Promise<void> {
    const q = checked(quest);
    this.quests.set(q.id, { quest: structuredClone(q), updatedAt: now });
  }
  async remove(id: string): Promise<void> {
    this.quests.delete(id);
    this.drafts.delete(id);
  }
  async saveDraft(quest: Quest, now: number): Promise<void> {
    const q = checked(quest);
    this.drafts.set(q.id, { quest: structuredClone(q), updatedAt: now });
  }
  async loadDraft(id: string) {
    return structuredClone(this.drafts.get(id));
  }
  async removeDraft(id: string): Promise<void> {
    this.drafts.delete(id);
  }
}

interface QuestRow {
  id: string;
  title: string;
  number: number;
  updatedAt: number;
  quest: Quest;
}
interface DraftRow {
  id: string;
  updatedAt: number;
  quest: Quest;
}

// A database of its own: the `saves` database of saves.ts is never touched.
class UserQuestDb extends Dexie {
  userQuests!: EntityTable<QuestRow, 'id'>;
  drafts!: EntityTable<DraftRow, 'id'>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ userQuests: 'id, updatedAt', drafts: 'id, updatedAt' });
  }
}

export class DexieUserQuestStore implements UserQuestStore {
  private readonly db: UserQuestDb;
  constructor(name = 'soloquest-user-quests') {
    this.db = new UserQuestDb(name);
  }
  async list(): Promise<UserQuestSummary[]> {
    const rows = await this.db.userQuests.orderBy('updatedAt').reverse().toArray();
    const out: UserQuestSummary[] = [];
    for (const r of rows) {
      const q = readBack(r?.quest);
      if (q && typeof r.updatedAt === 'number')
        out.push({ id: q.id, title: q.title, number: q.number, updatedAt: r.updatedAt });
    }
    return out;
  }
  async load(id: string): Promise<Quest | undefined> {
    const row = await this.db.userQuests.get(id);
    return row ? readBack(row.quest) : undefined;
  }
  async save(quest: Quest, now: number): Promise<void> {
    const q = checked(quest);
    await this.db.userQuests.put({
      id: q.id,
      title: q.title,
      number: q.number,
      updatedAt: now,
      quest: q,
    });
  }
  async remove(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.userQuests, this.db.drafts, async () => {
      await this.db.userQuests.delete(id);
      await this.db.drafts.delete(id);
    });
  }
  async saveDraft(quest: Quest, now: number): Promise<void> {
    const q = checked(quest);
    await this.db.drafts.put({ id: q.id, updatedAt: now, quest: q });
  }
  async loadDraft(id: string) {
    const row = await this.db.drafts.get(id);
    if (!row) return undefined;
    const quest = readBack(row.quest);
    if (quest && typeof row.updatedAt === 'number') return { quest, updatedAt: row.updatedAt };
    // A corrupt draft is useless and would block the editor: drop it.
    await this.db.drafts.delete(id);
    return undefined;
  }
  async removeDraft(id: string): Promise<void> {
    await this.db.drafts.delete(id);
  }
  close(): void {
    this.db.close();
  }
}

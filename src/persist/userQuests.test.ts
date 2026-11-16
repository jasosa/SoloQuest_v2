import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import {
  addDoor,
  addFurniture,
  addMarker,
  addMonster,
  addTrap,
  emptyQuest,
} from '../engine/editor/ops';
import type { Quest } from '../engine/quest/schema';
import { DexieSaveStore, MemorySaveStore } from './saves';
import {
  DexieUserQuestStore,
  MemoryUserQuestStore,
  isUserQuestId,
  newUserQuestId,
  type UserQuestStore,
} from './userQuests';

const make = (id: string, title = 'My Quest', number = 1): Quest => ({
  ...emptyQuest({ id, number, title }),
});

let n = 0;
const stores: [string, () => UserQuestStore][] = [
  ['memory', () => new MemoryUserQuestStore()],
  ['IndexedDB (Dexie)', () => new DexieUserQuestStore(`uq-test-${n++}`)],
];

describe.each(stores)('user quest store: %s', (_name, build) => {
  let store: UserQuestStore;
  afterEach(() => {
    if (store instanceof DexieUserQuestStore) store.close();
  });

  it('starts empty', async () => {
    store = build();
    expect(await store.list()).toEqual([]);
    expect(await store.load('user-a')).toBeUndefined();
    expect(await store.loadDraft('user-a')).toBeUndefined();
  });

  it('saves, lists newest first, loads and keeps userText', async () => {
    store = build();
    const a = make('user-a', 'Alpha', 1);
    const b = { ...make('user-b', 'Beta', 2), intro: { summary: 'S', userText: 'private' } };
    await store.save(a, 100);
    await store.save(b, 200);
    expect(await store.list()).toEqual([
      { id: 'user-b', title: 'Beta', number: 2, updatedAt: 200 },
      { id: 'user-a', title: 'Alpha', number: 1, updatedAt: 100 },
    ]);
    expect(await store.load('user-b')).toEqual(b);
    expect((await store.load('user-b'))?.intro.userText).toBe('private');
  });

  it('saving again replaces the quest and its time', async () => {
    store = build();
    await store.save(make('user-a', 'Alpha'), 100);
    await store.save(make('user-a', 'Alpha 2'), 300);
    const list = await store.list();
    expect(list).toEqual([{ id: 'user-a', title: 'Alpha 2', number: 1, updatedAt: 300 }]);
  });

  it('removes a quest and its draft', async () => {
    store = build();
    const a = make('user-a');
    await store.save(a, 1);
    await store.saveDraft(a, 2);
    await store.remove('user-a');
    expect(await store.load('user-a')).toBeUndefined();
    expect(await store.loadDraft('user-a')).toBeUndefined();
    await store.remove('user-a');
  });

  it('autosaves a draft apart from the saved quest', async () => {
    store = build();
    const saved = make('user-a', 'Saved');
    const draft = make('user-a', 'Draft');
    await store.save(saved, 1);
    await store.saveDraft(draft, 5);
    expect((await store.load('user-a'))?.title).toBe('Saved');
    expect(await store.loadDraft('user-a')).toEqual({ quest: draft, updatedAt: 5 });
    await store.removeDraft('user-a');
    expect(await store.loadDraft('user-a')).toBeUndefined();
    expect((await store.load('user-a'))?.title).toBe('Saved');
  });

  it('a draft can exist before the first save', async () => {
    store = build();
    await store.saveDraft(make('user-new'), 1);
    expect(await store.list()).toEqual([]);
    expect((await store.loadDraft('user-new'))?.quest.id).toBe('user-new');
  });

  it('rejects ids that are not user ids (bundled ids never collide)', async () => {
    store = build();
    for (const id of ['q01-the-trial', 'user-', 'User-a', 'user-a b', '', 'user-/x'])
      await expect(store.save({ ...make('user-x'), id }, 1), id).rejects.toThrow();
    await expect(store.saveDraft({ ...make('user-x'), id: 'q01-the-trial' }, 1)).rejects.toThrow(
      /user-/,
    );
    expect(await store.list()).toEqual([]);
  });

  it('rejects data that is not a quest', async () => {
    store = build();
    const broken = { ...make('user-a'), start: { area: 'nowhere' } } as unknown as Quest;
    await expect(store.save(broken, 1)).rejects.toThrow(/not valid/);
  });

  it('returns copies, not the stored object', async () => {
    store = build();
    await store.save(make('user-a'), 1);
    const loaded = (await store.load('user-a')) as Quest;
    loaded.title = 'changed';
    expect((await store.load('user-a'))?.title).toBe('My Quest');
  });
});

describe('user quest ids', () => {
  it('accepts user- ids only', () => {
    expect(isUserQuestId('user-my-quest')).toBe(true);
    expect(isUserQuestId('user-1')).toBe(true);
    expect(isUserQuestId('q01-the-trial')).toBe(false);
    expect(isUserQuestId('user-')).toBe(false);
    expect(isUserQuestId('user-' + 'a'.repeat(100))).toBe(false);
  });
  it('makes unique ids from titles', () => {
    expect(newUserQuestId('The Lost Crypt!')).toBe('user-the-lost-crypt');
    expect(newUserQuestId('???')).toBe('user-quest');
    expect(newUserQuestId('Crypt', ['user-crypt', 'user-crypt-2'])).toBe('user-crypt-3');
    expect(isUserQuestId(newUserQuestId('Ünïcode  título'))).toBe(true);
  });
});

describe('next to the save store', () => {
  it('uses its own database, saves keep working', async () => {
    const saves = new DexieSaveStore('shared-check');
    const quests = new DexieUserQuestStore('shared-check-quests');
    await saves.save({
      questId: 'q',
      version: 1,
      seed: 1,
      team: ['elf'],
      events: [],
      updatedAt: 1,
    });
    await quests.save(make('user-a'), 1);
    expect(await saves.list()).toHaveLength(1);
    expect(await quests.list()).toHaveLength(1);
    saves.close();
    quests.close();
    expect(new MemorySaveStore()).toBeDefined();
  });
});

describe('corrupt rows in IndexedDB', () => {
  const open = (name: string) => {
    const db = new Dexie(name);
    db.version(1).stores({ userQuests: 'id, updatedAt', drafts: 'id, updatedAt' });
    return db;
  };

  it('load and list skip a corrupt quest, loadDraft deletes a corrupt draft', async () => {
    const name = `uq-corrupt-${n++}`;
    const store = new DexieUserQuestStore(name);
    await store.save(make('user-good', 'Good'), 5);
    store.close();
    const raw = open(name);
    await raw
      .table('userQuests')
      .put({ id: 'user-bad', title: 'Bad', number: 1, updatedAt: 9, quest: { oops: true } });
    await raw.table('userQuests').put({ id: 'user-null', updatedAt: 8, quest: null });
    await raw.table('drafts').put({ id: 'user-bad', updatedAt: 9, quest: 'text' });
    raw.close();

    const again = new DexieUserQuestStore(name);
    expect(await again.load('user-bad')).toBeUndefined();
    expect(await again.load('user-null')).toBeUndefined();
    expect((await again.load('user-good'))?.title).toBe('Good');
    expect((await again.list()).map((s) => s.id)).toEqual(['user-good']);
    expect(await again.loadDraft('user-bad')).toBeUndefined();
    again.close();

    const check = open(name);
    expect(await check.table('drafts').get('user-bad')).toBeUndefined();
    // the corrupt saved quest is kept, so nothing is lost silently
    expect(await check.table('userQuests').get('user-bad')).toBeDefined();
    check.close();
  });
});

describe('an ok edit can always be saved as a draft', () => {
  it('saveDraft never throws on an ok result', async () => {
    const store = new MemoryUserQuestStore();
    const q = emptyQuest({ id: 'user-x', number: 1, title: 'X' });
    const results = [
      addFurniture(q, 'chest', [[3, 16]], { letter: 'A' }),
      addMonster(q, 'orc', [3, 16], { name: 'Bob', traits: ['x'], overrides: { att: 4 } }),
      addMarker(q, 'X', [3, 16], 'editor'),
      addTrap(q, 'pit', { cell: [3, 16] }, { effect: 'ouch' }),
      addMonster(q, 'orc', [3, 16], { name: '  ' }),
      addMarker(q, ' ', [3, 16]),
      addDoor(q, [3, 17], [3, 18], 'secret'),
    ];
    for (const r of results)
      if (r.ok) await expect(store.saveDraft(r.quest, 1)).resolves.toBeUndefined();
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
});

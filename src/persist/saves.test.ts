import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { Hero } from '../engine/data/heroes';
import { buildLevel } from '../engine/board/level';
import type { GameEvent } from '../engine/game/events';
import { replay, undo } from '../engine/game/reducer';
import { testQuest } from '../engine/quest/testQuest';
import { autosave, DexieSaveStore, MemorySaveStore, resume, type SaveStore } from './saves';

const level = buildLevel(testQuest());
const SEED = 7;
const TEAM: Hero[] = ['dwarf', 'wizard'];
const log: GameEvent[] = [
  { type: 'OPEN_DOOR', door: 'd1' },
  { type: 'LOOK_FROM', cell: [3, 18] },
];

let n = 0;
const stores: [string, () => SaveStore][] = [
  ['memory', () => new MemorySaveStore()],
  ['IndexedDB (Dexie)', () => new DexieSaveStore(`test-${n++}`)],
];

describe.each(stores)('save store: %s', (_name, make) => {
  let store: SaveStore;
  afterEach(() => {
    if (store instanceof DexieSaveStore) store.close();
  });

  it('has nothing to resume at first', async () => {
    store = make();
    const r = await resume(store, level);
    expect(r).toMatchObject({ ok: false, reason: 'none' });
  });

  it('autosaves the log and resumes to the same state', async () => {
    store = make();
    await autosave(store, level.quest.id, SEED, TEAM, log, 1000);
    const r = await resume(store, level);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual(log);
    expect(r.team).toEqual(TEAM);
    expect(r.state).toEqual(replay(level, SEED, log));
  });

  it('keeps only the latest log per quest, and undo is saved too', async () => {
    store = make();
    await autosave(store, level.quest.id, SEED, TEAM, log, 1000);
    const { events } = undo(level, SEED, log);
    await autosave(store, level.quest.id, SEED, TEAM, events, 2000);
    expect(await store.list()).toHaveLength(1);
    const r = await resume(store, level);
    expect(r.ok && r.events).toEqual(events);
  });

  it('removes a save', async () => {
    store = make();
    await autosave(store, level.quest.id, SEED, TEAM, log, 1000);
    await store.remove(level.quest.id);
    expect(await store.load(level.quest.id)).toBeUndefined();
  });

  it('reports a log that does not replay on this quest', async () => {
    store = make();
    await autosave(store, level.quest.id, SEED, TEAM, [{ type: 'OPEN_DOOR', door: 'nope' }], 1000);
    expect(await resume(store, level)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('reports a bad team as corrupt', async () => {
    store = make();
    const teams = [
      [],
      ['elf', 'elf'],
      ['elf', 'ogre'],
      ['barbarian', 'dwarf', 'elf', 'wizard', 'elf'],
    ];
    for (const team of teams) {
      await store.save({
        questId: level.quest.id,
        version: 1,
        seed: 1,
        updatedAt: 1,
        team: team as Hero[],
        events: [],
      });
      expect(await resume(store, level)).toMatchObject({ ok: false, reason: 'corrupt' });
    }
  });

  it('accepts the new events in a save (they fail only on replay)', async () => {
    store = make();
    const evs: GameEvent[] = [
      { type: 'MONSTER_DAMAGE', monster: 'x', amount: 1 },
      { type: 'MONSTER_HEAL', monster: 'x', amount: 1 },
      { type: 'MONSTER_KILL', monster: 'x' },
      { type: 'ZARGON_TURN_END' },
    ];
    await autosave(store, level.quest.id, SEED, TEAM, evs, 1);
    expect(await resume(store, level)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('reports stored data in the wrong shape', async () => {
    store = make();
    await store.save({
      questId: level.quest.id,
      version: 1,
      seed: 1,
      team: ['elf'],
      updatedAt: 1,
      events: [{ type: 'FLY' } as unknown as GameEvent],
    });
    expect(await resume(store, level)).toMatchObject({ ok: false, reason: 'corrupt' });
  });
});

describe('unavailable storage', () => {
  const broken: SaveStore = {
    save: () => Promise.reject(new Error('blocked')),
    load: () => Promise.reject(new Error('blocked')),
    list: () => Promise.reject(new Error('blocked')),
    remove: () => Promise.reject(new Error('blocked')),
  };

  it('resume reports unavailable instead of throwing', async () => {
    expect(await resume(broken, level)).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('autosave returns false instead of throwing', async () => {
    expect(await autosave(broken, level.quest.id, SEED, TEAM, log, 1)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { testQuest } from '../../engine/quest/testQuest';
import { MemorySaveStore, resume, type SaveStore } from '../../persist/saves';
import { createGameStore } from './gameStore';

const level = buildLevel(testQuest());
const make = (saves: SaveStore = new MemorySaveStore(), events: GameEvent[] = []) =>
  createGameStore({ level, seed: 7, team: ['dwarf', 'elf'], saves, events, now: () => 1000 });

describe('game store', () => {
  it('starts with the start room revealed and turn 1', () => {
    const s = make().getState();
    expect(s.state.turn).toBe(1);
    expect(s.state.revealedRooms.has('R20')).toBe(true);
    expect(s.events).toEqual([]);
    expect(s.fx).toBeNull();
  });

  it('dispatch reduces, keeps the event, and sets the reveal fx', () => {
    const store = make();
    expect(store.getState().dispatch({ type: 'OPEN_DOOR', door: 'd2' })).toBe(true);
    const s = store.getState();
    expect(s.events).toHaveLength(1);
    expect(s.state.openDoors.has('d2')).toBe(true);
    expect(s.fx?.cells.size).toBeGreaterThan(0);
    expect(s.fx?.freshMonsters.length).toBeGreaterThan(0);
  });

  it('shows "Nothing new here" when a look finds nothing, with no fx', () => {
    const store = make();
    store.getState().dispatch({ type: 'OPEN_DOOR', door: 'd1' });
    store.getState().dispatch({ type: 'LOOK_FROM', cell: [3, 18] });
    store.getState().dispatch({ type: 'LOOK_FROM', cell: [3, 18] });
    expect(store.getState().toast?.text).toBe('Nothing new here.');
    expect(store.getState().fx).toBeNull();
  });

  it('refuses an invalid event with a toast and leaves the log alone', () => {
    const store = make();
    expect(store.getState().dispatch({ type: 'OPEN_DOOR', door: 'nope' })).toBe(false);
    expect(store.getState().events).toHaveLength(0);
    expect(store.getState().toast?.text).toMatch(/Unknown door/);
  });

  it('autosaves after every event and after undo', async () => {
    const saves = new MemorySaveStore();
    const store = make(saves);
    store.getState().dispatch({ type: 'OPEN_DOOR', door: 'd2' });
    store.getState().dispatch({ type: 'ZARGON_TURN_END' });
    await store.getState().flush();
    const saved = await saves.load('test-quest');
    expect(saved?.events).toHaveLength(2);
    expect(saved?.team).toEqual(['dwarf', 'elf']);
    expect(saved?.seed).toBe(7);
    store.getState().undo();
    await store.getState().flush();
    expect((await saves.load('test-quest'))?.events).toHaveLength(1);
    expect(store.getState().state.turn).toBe(1);
  });

  it('save() writes a fresh game with its seed and team', async () => {
    const saves = new MemorySaveStore();
    await make(saves).getState().save();
    const saved = await saves.load('test-quest');
    expect(saved).toMatchObject({ seed: 7, team: ['dwarf', 'elf'], events: [] });
  });

  it('undo drops the last event and clears fx; with no events it does nothing', () => {
    const store = make();
    store.getState().undo();
    store.getState().dispatch({ type: 'OPEN_DOOR', door: 'd2' });
    store.getState().undo();
    const s = store.getState();
    expect(s.events).toHaveLength(0);
    expect(s.state.openDoors.size).toBe(0);
    expect(s.fx).toBeNull();
  });

  it('a failing save store does not stop play', async () => {
    const broken: SaveStore = {
      save: () => Promise.reject(new Error('no disk')),
      load: () => Promise.resolve(undefined),
      list: () => Promise.resolve([]),
      remove: () => Promise.resolve(),
    };
    const store = make(broken);
    expect(store.getState().dispatch({ type: 'ZARGON_TURN_END' })).toBe(true);
    await store.getState().flush();
    expect(store.getState().saved).toBe(false);
    expect(store.getState().state.turn).toBe(2);
  });

  it('resumes a saved game with the same state', async () => {
    const saves = new MemorySaveStore();
    const a = make(saves);
    a.getState().dispatch({ type: 'OPEN_DOOR', door: 'd2' });
    a.getState().dispatch({ type: 'ZARGON_TURN_END' });
    await a.getState().flush();
    const r = await resume(saves, level);
    if (!r.ok) throw new Error(r.message);
    const b = createGameStore({
      level,
      seed: r.seed,
      team: r.team,
      events: r.events,
      saves,
      now: () => 2,
    });
    expect(b.getState().state).toEqual(a.getState().state);
    expect(b.getState().fx).toBeNull();
  });

  it('toasts a slain monster with an undo button', () => {
    const store = make();
    store.getState().dispatch({ type: 'OPEN_DOOR', door: 'd2' });
    const id = store.getState().fx?.freshMonsters[0] as string;
    store.getState().dispatch({ type: 'MONSTER_KILL', monster: id });
    expect(store.getState().toast).toMatchObject({ undo: true });
    expect(store.getState().toast?.text).toMatch(/slain\.$/);
  });
});

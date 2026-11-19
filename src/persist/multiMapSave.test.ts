import { describe, expect, it } from 'vitest';
import { buildLevel } from '../engine/board/level';
import type { GameEvent } from '../engine/game/events';
import { replay } from '../engine/game/reducer';
import { testMapsQuest } from '../engine/quest/testMaps';
import { autosave, MemorySaveStore, resume } from './saves';

describe('a save of a multi-map quest', () => {
  const root = buildLevel(testMapsQuest());
  const log: GameEvent[] = [
    { type: 'OPEN_DOOR', door: 'd2' },
    { type: 'MANUAL_TRIGGER', note: 'ask1' },
    { type: 'CHOOSE', note: 'ask1', option: 0 },
    { type: 'OPEN_DOOR', door: 'e1' },
  ];

  it('resumes on the map the heroes were on, to the same state', async () => {
    const store = new MemorySaveStore();
    await autosave(store, root.quest.id, 3, ['dwarf'], log, 10);
    const r = await resume(store, root);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual(log);
    expect(r.state).toEqual(replay(root, 3, log));
    expect(r.state.map).toBe('two');
    expect(r.state.openDoors.has('e1')).toBe(true);
  });

  it('a crossing alone is saved and resumes on the other map', async () => {
    const store = new MemorySaveStore();
    const one: GameEvent[] = [{ type: 'CROSS_MAP', link: 'l1' }];
    await autosave(store, root.quest.id, 3, ['dwarf'], one, 10);
    const r = await resume(store, root);
    expect(r.ok && r.state.map).toBe('two');
  });
});

import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import { testQuest } from '../../engine/quest/testQuest';
import { MemorySaveStore, SAVE_VERSION } from '../../persist/saves';
import { openSaved, SAVED_GAME_FAILED } from './openSaved';

const level = buildLevel(testQuest());
const base = {
  questId: 'test-quest',
  version: SAVE_VERSION as 1,
  seed: 1,
  team: ['dwarf' as const],
  updatedAt: 1,
};

describe('openSaved', () => {
  it('opens a good save', async () => {
    const saves = new MemorySaveStore();
    await saves.save({ ...base, events: [{ type: 'ZARGON_TURN_END' }] });
    const r = await openSaved(saves, level);
    expect(r.ok && r.store.getState().state.turn).toBe(2);
  });

  it('gives the plain message when there is no save, or it is corrupt, or it does not replay', async () => {
    const saves = new MemorySaveStore();
    expect(await openSaved(saves, level)).toEqual({ ok: false, message: SAVED_GAME_FAILED });
    await saves.save({ ...base, team: [], events: [] });
    expect(await openSaved(saves, level)).toEqual({ ok: false, message: SAVED_GAME_FAILED });
    await saves.save({ ...base, events: [{ type: 'OPEN_DOOR', door: 'nope' }] });
    expect(await openSaved(saves, level)).toEqual({ ok: false, message: SAVED_GAME_FAILED });
  });
});

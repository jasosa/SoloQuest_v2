import type { Level } from '../../engine/board/level';
import { resume, type SaveStore } from '../../persist/saves';
import { createGameStore, type GameStore } from './gameStore';

export const SAVED_GAME_FAILED = 'The saved game could not be opened. Start a new game.';

/** Open the saved game of a quest. On any failure the caller shows the plain message. */
export async function openSaved(
  saves: SaveStore,
  level: Level,
): Promise<{ ok: true; store: GameStore } | { ok: false; message: string }> {
  const r = await resume(saves, level);
  if (!r.ok) return { ok: false, message: SAVED_GAME_FAILED };
  try {
    const store = createGameStore({
      level,
      seed: r.seed,
      team: r.team,
      events: r.events,
      startFlags: r.startFlags,
      campaign: r.campaign,
      pack: r.pack,
      saves,
    });
    return { ok: true, store };
  } catch {
    return { ok: false, message: SAVED_GAME_FAILED };
  }
}

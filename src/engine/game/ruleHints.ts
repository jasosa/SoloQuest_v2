/**
 * Rule hints (decision 60): short reminders of rules the app does not enforce. Pure. The setting that
 * turns them on is in the UI; this only says which reminders are due.
 */
import type { Level } from '../board/level';
import { BOARD_TILES } from '../data/roomTiles';
import type { GameState } from './state';
import { roomTilesInView } from './tiles';
import { boardTilesInView, monstersInPlay } from './view';

export interface RuleHint {
  /** "Icy river", "Ice Vault". */
  readonly name: string;
  readonly lines: readonly string[];
}

/**
 * The reminders that became due between two states: terrain that came into view for the first time,
 * and room tiles that came into view for the first time. Tiles shown before are not repeated.
 */
export function newRuleHints(level: Level, before: GameState, after: GameState): RuleHint[] {
  const out: RuleHint[] = [];
  const seenBefore = new Set(boardTilesInView(level, before).map((t) => t.index));
  for (const t of boardTilesInView(level, after)) {
    const def = BOARD_TILES[t.type];
    if (def.terrain && !seenBefore.has(t.index)) out.push({ name: def.name, lines: def.rule });
  }
  const roomsBefore = new Set(roomTilesInView(level, before).map((t) => t.index));
  for (const t of roomTilesInView(level, after))
    if (!roomsBefore.has(t.index)) out.push({ name: t.tile.name, lines: t.tile.rule });
  return out;
}

/**
 * The hint of unthreatened movement: when no monster the heroes have seen is awake and alive, the
 * players may count each red die as 4 instead of rolling. A general rule, for every quest of every
 * pack; the per-quest Rule hints setting turns the reminder off.
 */
export function unthreatenedMovement(level: Level, state: GameState): boolean {
  return !monstersInPlay(level, state).some((m) => !m.dead && m.state === 'active');
}

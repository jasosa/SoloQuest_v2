/**
 * Traps (house rule, decisions 4 and 5). A trap is a "?" once its square or furniture is seen.
 * The state keeps only whether it sprung or was disarmed; the kind is read from the quest and is
 * told to the players by a prompt when the trap sprung or was disarmed.
 */
import type { TrapDef } from '../quest/schema';
import { keyOf, type Level } from '../board/level';
import type { GameEvent } from './events';
import { EventError } from './errors';
import type { Prompt } from './prompts';
import { runTriggers, type TriggerEvent } from './notes';
import { draftOf, type Draft, type GameState } from './state';

type Use = 'jump' | 'disarm' | 'step' | 'search';
type Reduced = { readonly state: GameState; readonly prompts: readonly Prompt[] };

/** Make a trap spring. Returns the prompt. A falling block becomes a permanent block. */
export function springTrap(level: Level, d: Draft, trap: TrapDef, via: Use): Prompt {
  d.trapStates[trap.id] = 'sprung';
  if (trap.kind === 'fallingBlock' && trap.cell) d.placedBlocks.add(keyOf(trap.cell));
  const effect =
    trap.effect ?? (trap.kind === 'fallingBlock' ? level.quest.rules.fallingBlock : undefined);
  return {
    kind: 'trapSprung',
    trap: trap.id,
    trapKind: trap.kind,
    via,
    ...(effect !== undefined ? { effect } : {}),
  };
}

/** Throws unless this trap can be used this way right now. */
function checkUsable(level: Level, state: GameState, id: string, use: Use): TrapDef {
  const trap = level.quest.traps.find((t) => t.id === id);
  if (!trap) throw new EventError('UNKNOWN_TRAP', `Unknown trap ${id}`);
  if (!state.seenTraps.has(id)) throw new EventError('TRAP_NOT_SEEN', `Trap ${id} is not seen yet`);
  if (trap.kind === 'scripted')
    throw new EventError('TRAP_CANNOT', `Trap ${id} is scripted by the quest notes`);
  const st = state.trapStates[id];
  if (st === 'disarmed') throw new EventError('TRAP_GONE', `Trap ${id} was disarmed`);
  if (st === 'sprung') {
    // Only a sprung pit is still there: it can be jumped or fallen into again, not disarmed.
    if (trap.kind !== 'pit') throw new EventError('TRAP_GONE', `Trap ${id} is gone`);
    if (use === 'disarm') throw new EventError('TRAP_CANNOT', 'A sprung pit cannot be disarmed');
  }
  // A chest or furniture trap can only be disarmed (or sprung by searching), not jumped or stepped on.
  if (trap.kind === 'chest' && use !== 'disarm')
    throw new EventError('TRAP_CANNOT', `Trap ${id} is on furniture: it cannot be jumped`);
  return trap;
}

/**
 * Fire the notes for a trap whose state changed (armed to sprung or disarmed). A sprung pit that
 * springs again is not a change. The note prompts follow the trap prompt.
 */
function withNotes(
  level: Level,
  before: GameState,
  d: Draft,
  trapId: string,
  prompt: Prompt,
): Reduced {
  const now = d.trapStates[trapId];
  if (now === undefined || now === before.trapStates[trapId])
    return { state: d, prompts: [prompt] };
  const trigger: TriggerEvent =
    now === 'sprung'
      ? { type: 'trapSprung', trap: trapId }
      : { type: 'trapDisarmed', trap: trapId };
  const r = runTriggers(level, d, [trigger], { beforeRooms: new Set(before.revealedRooms) });
  return { state: d, prompts: [prompt, ...r.prompts] };
}

export function trapEvent(
  level: Level,
  state: GameState,
  event: Extract<GameEvent, { type: 'TRAP_JUMP' | 'TRAP_DISARM' | 'TRAP_STEP' }>,
): Reduced {
  switch (event.type) {
    case 'TRAP_JUMP': {
      if (event.result !== 'skull' && event.result !== 'ok')
        throw new EventError('BAD_RESULT', `Bad jump result ${String(event.result)}`);
      const trap = checkUsable(level, state, event.trap, 'jump');
      if (event.result === 'ok') return { state, prompts: [{ kind: 'trapJumped', trap: trap.id }] };
      const d = draftOf(state);
      return withNotes(level, state, d, trap.id, springTrap(level, d, trap, 'jump'));
    }
    case 'TRAP_STEP': {
      const trap = checkUsable(level, state, event.trap, 'step');
      const d = draftOf(state);
      return withNotes(level, state, d, trap.id, springTrap(level, d, trap, 'step'));
    }
    case 'TRAP_DISARM': {
      if (event.by !== 'dwarf' && event.by !== 'toolkit')
        throw new EventError('BAD_RESULT', `Bad disarm tool ${String(event.by)}`);
      if (!['skull', 'blackShield', 'other'].includes(event.result))
        throw new EventError('BAD_RESULT', `Bad disarm result ${String(event.result)}`);
      const trap = checkUsable(level, state, event.trap, 'disarm');
      const d = draftOf(state);
      const fails =
        event.by === 'dwarf' ? event.result === 'blackShield' : event.result === 'skull';
      if (fails) return withNotes(level, state, d, trap.id, springTrap(level, d, trap, 'disarm'));
      d.trapStates[trap.id] = 'disarmed';
      return withNotes(level, state, d, trap.id, {
        kind: 'trapDisarmed',
        trap: trap.id,
        trapKind: trap.kind,
      });
    }
  }
}

/**
 * Traps (house rule, decisions 4 and 5). A trap is a "?" once its square or furniture is seen.
 * The state keeps only whether it sprung or was disarmed; the kind is read from the quest and is
 * told to the players by a prompt when the trap sprung or was disarmed.
 */
import type { MonsterType, TrapDef } from '../quest/schema';
import { areaAt } from '../board/board';
import { keyOf, type Level } from '../board/level';
import { trapKind } from '../data/trapKinds';
import { joinRoster, wandererDef } from './roster';
import type { GameEvent } from './events';
import { EventError } from './errors';
import type { Prompt } from './prompts';
import { runTriggers, type TriggerEvent } from './notes';
import { draftOf, type Draft, type GameState } from './state';

type Use = 'jump' | 'disarm' | 'step' | 'search';
type Reduced = { readonly state: GameState; readonly prompts: readonly Prompt[] };

/**
 * Make a trap spring (what it does comes from its kind, `data/trapKinds.ts`). Returns the prompt.
 * A falling block becomes a permanent block, a wandering monster trap brings the quest's wandering
 * monsters (no square: the players put them next to the hero), a slide shows its path.
 */
export function springTrap(level: Level, d: Draft, trap: TrapDef, via: Use): Prompt {
  const kind = trapKind(trap.kind);
  d.trapStates[trap.id] = 'sprung';
  if (kind.leavesBlock && trap.cell) d.placedBlocks.add(keyOf(trap.cell));
  if (kind.slide) showSlide(d, trap);
  let effect =
    trap.effect ?? (trap.kind === 'fallingBlock' ? level.quest.rules.fallingBlock : undefined);
  const spawned: { monster: string; monsterType: MonsterType; name?: string }[] = [];
  if (kind.bringsWanderers && trap.cell) {
    const w = level.quest.wandering;
    if (w && 'monster' in w) {
      const room = areaAt(level.board, trap.cell[0], trap.cell[1]) ?? 'C';
      for (let i = 0; i < (w.count ?? 1); i++) {
        const id = joinRoster(level, d, {
          type: w.monster,
          ...(w.enemy ? { enemy: w.enemy } : {}),
          room,
          fresh: true,
        });
        const name = w.enemy
          ? wandererDef(level, { type: w.monster, enemy: w.enemy }, id).name
          : undefined;
        spawned.push({ monster: id, monsterType: w.monster, ...(name ? { name } : {}) });
      }
    } else if (w) effect = effect ?? w.text;
  }
  return {
    kind: 'trapSprung',
    trap: trap.id,
    trapKind: trap.kind,
    via,
    ...(effect !== undefined ? { effect } : {}),
    ...(spawned.length ? { spawned } : {}),
  };
}

function showSlide(d: Draft, trap: TrapDef): void {
  if (!d.slidesShown.includes(trap.id)) d.slidesShown = [...d.slidesShown, trap.id];
}

/** Throws unless this trap can be used this way right now. */
function checkUsable(level: Level, state: GameState, id: string, use: Use): TrapDef {
  const trap = level.quest.traps.find((t) => t.id === id);
  if (!trap) throw new EventError('UNKNOWN_TRAP', `Unknown trap ${id}`);
  if (!state.seenTraps.has(id)) throw new EventError('TRAP_NOT_SEEN', `Trap ${id} is not seen yet`);
  const kind = trapKind(trap.kind);
  if (kind.scripted)
    throw new EventError('TRAP_CANNOT', `Trap ${id} is scripted by the quest notes`);
  const st = state.trapStates[id];
  if (st === 'disarmed') throw new EventError('TRAP_GONE', `Trap ${id} was disarmed`);
  if (st === 'sprung') {
    // Only a trap that stays (a pit, an axe, ice) is still there: it springs for the next hero.
    if (!kind.stays) throw new EventError('TRAP_GONE', `Trap ${id} is gone`);
    if (use === 'disarm' && !kind.disarmAfterSpring)
      throw new EventError('TRAP_CANNOT', `A sprung ${kind.name} cannot be disarmed`);
  }
  // A chest or furniture trap can only be disarmed (or sprung by searching), not jumped or stepped on.
  if (kind.onFurniture && use !== 'disarm')
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
      if (event.result === 'ok') {
        // A good jump over an ice slide shows the whole slide (decision 42).
        if (!trapKind(trap.kind).slide)
          return { state, prompts: [{ kind: 'trapJumped', trap: trap.id }] };
        const shown = draftOf(state);
        showSlide(shown, trap);
        return { state: shown, prompts: [{ kind: 'trapJumped', trap: trap.id, slide: true }] };
      }
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
      if (event.by === 'dwarf' && state.deadHeroes.includes('dwarf'))
        throw new EventError('HERO_DEAD', 'The dwarf is dead and cannot disarm');
      const trap = checkUsable(level, state, event.trap, 'disarm');
      const d = draftOf(state);
      // A trap the book says cannot be found or disarmed always springs on a try (decision 41).
      const fails =
        !trapKind(trap.kind).disarmable ||
        (event.by === 'dwarf' ? event.result === 'blackShield' : event.result === 'skull');
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

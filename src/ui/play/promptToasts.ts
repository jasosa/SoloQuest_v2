/**
 * Prompts that only need a short message (no sheet): what a note did to the map or the roster.
 * Notes with text and monsters placed on a named square get a sheet instead (see sheets.ts).
 */
import type { Prompt } from '../../engine/game/prompts';

export function promptToasts(prompts: readonly Prompt[]): string[] {
  const out: string[] = [];
  for (const p of prompts) {
    switch (p.kind) {
      case 'monsterPlaced':
        if (p.cell === undefined) out.push(`${p.name} is in play now.`);
        break;
      case 'monsterState':
        if (p.state === 'stone')
          out.push(
            p.turns !== undefined
              ? `${p.name} turns to stone for ${p.turns} turn${p.turns === 1 ? '' : 's'}.`
              : `${p.name} turns to stone.`,
          );
        else if (p.state === 'dormant') out.push(`${p.name} goes still.`);
        else if (p.state === 'away') out.push(`${p.name} is gone from the map.`);
        else out.push(`${p.name} is awake.`);
        break;
      case 'doorsOpened':
        out.push(p.doors.length > 1 ? 'Doors open on the map.' : 'A door opens on the map.');
        break;
      case 'doorStuck': // shown as a result sheet, not a toast
        break;
      case 'secretDoorAdded':
        out.push('A secret door is on the map now.');
        break;
      case 'blockPlaced':
        out.push('Blocked squares are on the map now.');
        break;
      case 'counter':
        out.push(`${p.counter}: ${p.value}.`);
        break;
      case 'npcSpawned':
        out.push(`${p.name} joins the heroes.`);
        break;
      case 'objectiveDone': // shown as a sheet
      case 'goalDone':
        break;
      case 'loopStopped':
        out.push('Too many notes in a row. The rest was skipped.');
        break;
      default:
        break;
    }
  }
  return out;
}

/** One sheet to show, in order. Notes with something to read, and monsters to put on the map. */
export type Sheet =
  | { readonly t: 'note'; readonly p: Extract<Prompt, { kind: 'note' }> }
  | { readonly t: 'place'; readonly p: Extract<Prompt, { kind: 'monsterPlaced' }> }
  /** An objective was achieved. `all` is true when it was the last one: the goal is done. */
  | { readonly t: 'goal'; readonly p: Extract<Prompt, { kind: 'objectiveDone' }>; readonly all: boolean };

export function sheetsOf(prompts: readonly Prompt[]): Sheet[] {
  const out: Sheet[] = [];
  const lastGoal = prompts.map((p) => p.kind).lastIndexOf('objectiveDone');
  const allDone = prompts.some((p) => p.kind === 'goalDone');
  for (const [i, p] of prompts.entries()) {
    if (p.kind === 'objectiveDone') out.push({ t: 'goal', p, all: allDone && i === lastGoal });
    if (
      p.kind === 'note' &&
      (p.texts.length > 0 || p.letter !== undefined || p.blocksSearch === true)
    )
      out.push({ t: 'note', p });
    if (p.kind === 'monsterPlaced' && p.cell !== undefined) out.push({ t: 'place', p });
  }
  return out;
}

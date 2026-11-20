/**
 * Prompts that only need a short message (no sheet): what a note did to the map or the roster.
 * Notes with text and monsters placed on a named square get a sheet instead (see sheets.ts).
 */
import type { Prompt } from '../../engine/game/prompts';
import { t } from '../../i18n/t';

export function promptToasts(prompts: readonly Prompt[]): string[] {
  const out: string[] = [];
  for (const p of prompts) {
    switch (p.kind) {
      case 'monsterPlaced':
        if (p.cell === undefined)
          out.push(t('play.toasts.inPlayNow', '{name} is in play now.', { name: p.name }));
        break;
      case 'monsterState':
        if (p.state === 'stone')
          out.push(
            p.turns === undefined
              ? t('play.toasts.turnsToStone', '{name} turns to stone.', { name: p.name })
              : p.turns === 1
                ? t('play.toasts.turnsToStoneOne', '{name} turns to stone for 1 turn.', {
                    name: p.name,
                  })
                : t('play.toasts.turnsToStoneMany', '{name} turns to stone for {turns} turns.', {
                    name: p.name,
                    turns: p.turns,
                  }),
          );
        else if (p.state === 'dormant')
          out.push(t('play.toasts.goesStill', '{name} goes still.', { name: p.name }));
        else if (p.state === 'away')
          out.push(
            t('play.toasts.goneFromTheMap', '{name} is gone from the map.', { name: p.name }),
          );
        else out.push(t('play.toasts.isAwake', '{name} is awake.', { name: p.name }));
        break;
      case 'crossed':
        out.push(
          t('play.toasts.onTheMapNow', 'The heroes are on {map} now.', {
            map: p.name ?? t('play.toasts.theOtherMap', 'the other map'),
          }),
        );
        break;
      case 'doorsOpened':
        out.push(
          p.doors.length > 1
            ? t('play.toasts.doorsOpen', 'Doors open on the map.')
            : t('play.toasts.doorOpens', 'A door opens on the map.'),
        );
        break;
      case 'doorStuck': // shown as a result sheet, not a toast
        break;
      case 'secretDoorAdded':
        out.push(t('play.toasts.secretDoorOnMap', 'A secret door is on the map now.'));
        break;
      case 'blockPlaced':
        out.push(t('play.toasts.blocksOnMap', 'Blocked squares are on the map now.'));
        break;
      case 'counter':
        out.push(
          t('play.toasts.counter', '{counter}: {value}.', { counter: p.counter, value: p.value }),
        );
        break;
      case 'npcSpawned':
        out.push(t('play.toasts.joinsTheHeroes', '{name} joins the heroes.', { name: p.name }));
        break;
      case 'objectiveDone': // shown as a sheet
      case 'goalDone':
        break;
      case 'loopStopped':
        out.push(t('play.toasts.tooManyNotes', 'Too many notes in a row. The rest was skipped.'));
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
  | {
      readonly t: 'goal';
      readonly p: Extract<Prompt, { kind: 'objectiveDone' }>;
      readonly all: boolean;
    };

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

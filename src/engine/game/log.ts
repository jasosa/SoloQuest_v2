import { wandererDef } from './roster';
import { tr } from '../../i18n/translate';
import { activeLevel, type Level } from '../board/level';
import { MONSTER_NAMES } from '../data/monsters';
import type { GameEvent } from './events';
import type { Prompt } from './prompts';
import { reduce, startGame } from './reducer';
import type { GameState } from './state';
import { nameFromId } from '../data/team';

/** One line of "What happened" in the Quest sheet. */
export interface LogEntry {
  /** The Zargon turn the event happened in. */
  readonly turn: number;
  readonly kind:
    | 'start'
    | 'door'
    | 'look'
    | 'monster'
    | 'search'
    | 'trap'
    | 'hero'
    | 'note'
    | 'goal'
    | 'turn'
    | 'end';
  readonly text: string;
  /** The note to read again, for `note` lines. */
  readonly note?: string;
}

const first = (text: string) => {
  const s = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return s.length > 90 ? `${s.slice(0, 87)}...` : s;
};

function monsterName(level: Level, state: GameState, id: string): string {
  const m = level.quest.monsters.find((x) => x.id === id);
  if (m) return m.name ?? MONSTER_NAMES[m.type];
  const w = state.wanderers[id];
  return w
    ? (wandererDef(level, w, id).name ?? MONSTER_NAMES[w.type])
    : tr('game.log.aMonster', 'A monster');
}

/** Lines that the prompts of one event add (notes, goals, new monsters). */
function fromPrompts(prompts: readonly Prompt[], turn: number): LogEntry[] {
  const out: LogEntry[] = [];
  for (const p of prompts) {
    if (p.kind === 'note') {
      const what = p.title ?? (p.texts[0] ? first(p.texts[0]) : tr('game.log.aNote', 'A note'));
      out.push({
        turn,
        kind: 'note',
        note: p.noteId,
        text: p.letter
          ? tr('game.log.noteLetter', 'Note {letter}: {what}', { letter: p.letter, what })
          : what,
      });
    } else if (p.kind === 'crossed') {
      out.push({
        turn,
        kind: 'look',
        text: tr('game.log.crossed', 'The heroes crossed to {map}', {
          map: p.name ?? tr('game.log.theOtherMap', 'the other map'),
        }),
      });
    } else if (p.kind === 'monsterPlaced') {
      out.push({
        turn,
        kind: 'monster',
        text: tr('game.log.joins', '{name} joins the fight', { name: p.name }),
      });
    } else if (p.kind === 'objectiveDone') {
      out.push({
        turn,
        kind: 'goal',
        text: tr('game.log.goalDone', 'Goal done: {text}', { text: p.text }),
      });
    } else if (p.kind === 'secretDoorsFound') {
      out.push({
        turn,
        kind: 'search',
        text: tr('game.log.secretDoor', 'A secret door was found'),
      });
    } else if (p.kind === 'trapSprung') {
      out.push({ turn, kind: 'trap', text: tr('game.log.trapSprang', 'A trap sprang') });
    } else if (p.kind === 'trapDisarmed') {
      out.push({ turn, kind: 'trap', text: tr('game.log.trapDisarmed', 'A trap was disarmed') });
    } else if (p.kind === 'trapJumped') {
      out.push({
        turn,
        kind: 'trap',
        text: tr('game.log.trapJumped', 'A hero jumped over a trap'),
      });
    } else if (p.kind === 'wanderingMonster') {
      out.push({
        turn,
        kind: 'monster',
        text: tr('game.log.wandering', 'A wandering {name} appears', {
          name: MONSTER_NAMES[p.monsterType],
        }),
      });
    }
  }
  return out;
}

/** The line of the event itself, when it has one. */
function fromEvent(level: Level, before: GameState, e: GameEvent): LogEntry | undefined {
  const turn = before.turn;
  switch (e.type) {
    case 'OPEN_DOOR':
      return { turn, kind: 'door', text: tr('game.log.doorOpened', 'A door was opened') };
    case 'TUNNEL_USE':
      return { turn, kind: 'look', text: tr('game.log.tunnel', 'A hero used an ice tunnel') };
    case 'LOOK_FROM':
      return { turn, kind: 'look', text: tr('game.log.look', 'A hero looked along the corridor') };
    case 'MONSTER_KILL':
      return {
        turn,
        kind: 'monster',
        text: tr('game.log.slain', '{name} slain', { name: monsterName(level, before, e.monster) }),
      };
    case 'MONSTER_LEAVE': {
      const name = monsterName(level, before, e.monster);
      const text =
        e.reason === 'escaped'
          ? tr('game.log.escaped', '{name} escaped', { name })
          : tr('game.log.freed', '{name} was freed', { name });
      return { turn, kind: 'monster', text };
    }
    case 'MONSTER_WAKE':
      return {
        turn,
        kind: 'monster',
        text: tr('game.log.attacked', '{name} was attacked', {
          name: monsterName(level, before, e.monster),
        }),
      };
    case 'SEARCH_TREASURE':
      return {
        turn,
        kind: 'search',
        text: tr('game.log.searchedTreasure', 'The {hero} searched for treasure', {
          hero: nameFromId(e.hero),
        }),
      };
    case 'SEARCH_SECRET_DOORS':
      return {
        turn,
        kind: 'search',
        text: tr('game.log.searchSecret', 'A search for secret doors'),
      };
    case 'SEARCH_TRAPS':
      return {
        turn,
        kind: 'search',
        text: tr('game.log.searchTraps', 'A chest was searched for traps'),
      };
    case 'HERO_DIED':
      return {
        turn,
        kind: 'hero',
        text: tr('game.log.heroFell', 'The {hero} fell', { hero: nameFromId(e.hero) }),
      };
    case 'ZARGON_TURN_END':
      return {
        turn,
        kind: 'turn',
        text: tr('game.log.turnEnded', "Zargon's turn {turn} ended", { turn }),
      };
    case 'END_QUEST':
      return { turn, kind: 'end', text: tr('game.log.questEnded', 'The quest ended') };
    default:
      return undefined;
  }
}

/**
 * The "What happened" log, oldest first, derived from the events (so an undo removes its line).
 * Pure: it replays the events. Numbers, doors and traps are never named, so nothing hidden leaks.
 */
export function eventLog(
  root: Level,
  seed: number,
  events: readonly GameEvent[],
  startFlags: Readonly<Record<string, boolean>> = {},
): LogEntry[] {
  const start = startGame(root, seed, startFlags);
  const out: LogEntry[] = [
    { turn: start.state.turn, kind: 'start', text: tr('game.log.start', 'The quest starts') },
  ];
  out.push(...fromPrompts(start.prompts, start.state.turn));
  let state = start.state;
  for (const e of events) {
    const r = reduce(root, state, e);
    const line = fromEvent(activeLevel(root, state), state, e);
    if (line) out.push(line);
    out.push(...fromPrompts(r.prompts, state.turn));
    state = r.state;
  }
  return out;
}

import { wandererDef } from './roster';
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
  return w ? (wandererDef(level, w, id).name ?? MONSTER_NAMES[w.type]) : 'A monster';
}

/** Lines that the prompts of one event add (notes, goals, new monsters). */
function fromPrompts(prompts: readonly Prompt[], turn: number): LogEntry[] {
  const out: LogEntry[] = [];
  for (const p of prompts) {
    if (p.kind === 'note') {
      const what = p.title ?? (p.texts[0] ? first(p.texts[0]) : 'A note');
      out.push({
        turn,
        kind: 'note',
        note: p.noteId,
        text: p.letter ? `Note ${p.letter}: ${what}` : what,
      });
    } else if (p.kind === 'crossed') {
      out.push({ turn, kind: 'look', text: `The heroes crossed to ${p.name ?? 'the other map'}` });
    } else if (p.kind === 'monsterPlaced') {
      out.push({ turn, kind: 'monster', text: `${p.name} joins the fight` });
    } else if (p.kind === 'objectiveDone') {
      out.push({ turn, kind: 'goal', text: `Goal done: ${p.text}` });
    } else if (p.kind === 'secretDoorsFound') {
      out.push({ turn, kind: 'search', text: 'A secret door was found' });
    } else if (p.kind === 'trapSprung') {
      out.push({ turn, kind: 'trap', text: 'A trap sprang' });
    } else if (p.kind === 'trapDisarmed') {
      out.push({ turn, kind: 'trap', text: 'A trap was disarmed' });
    } else if (p.kind === 'trapJumped') {
      out.push({ turn, kind: 'trap', text: 'A hero jumped over a trap' });
    } else if (p.kind === 'wanderingMonster') {
      out.push({
        turn,
        kind: 'monster',
        text: `A wandering ${MONSTER_NAMES[p.monsterType]} appears`,
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
      return { turn, kind: 'door', text: 'A door was opened' };
    case 'TUNNEL_USE':
      return { turn, kind: 'look', text: 'A hero used an ice tunnel' };
    case 'LOOK_FROM':
      return { turn, kind: 'look', text: 'A hero looked along the corridor' };
    case 'MONSTER_KILL':
      return { turn, kind: 'monster', text: `${monsterName(level, before, e.monster)} slain` };
    case 'MONSTER_LEAVE': {
      const how = { escaped: 'escaped', freed: 'was freed' }[e.reason];
      return { turn, kind: 'monster', text: `${monsterName(level, before, e.monster)} ${how}` };
    }
    case 'MONSTER_WAKE':
      return {
        turn,
        kind: 'monster',
        text: `${monsterName(level, before, e.monster)} was attacked`,
      };
    case 'SEARCH_TREASURE':
      return { turn, kind: 'search', text: `The ${nameFromId(e.hero)} searched for treasure` };
    case 'SEARCH_SECRET_DOORS':
      return { turn, kind: 'search', text: 'A search for secret doors' };
    case 'SEARCH_TRAPS':
      return { turn, kind: 'search', text: 'A chest was searched for traps' };
    case 'HERO_DIED':
      return { turn, kind: 'hero', text: `The ${nameFromId(e.hero)} fell` };
    case 'ZARGON_TURN_END':
      return { turn, kind: 'turn', text: `Zargon's turn ${turn} ended` };
    case 'END_QUEST':
      return { turn, kind: 'end', text: 'The quest ended' };
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
  const out: LogEntry[] = [{ turn: start.state.turn, kind: 'start', text: 'The quest starts' }];
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

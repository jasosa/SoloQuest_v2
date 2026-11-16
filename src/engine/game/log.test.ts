import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { eventLog } from './log';

const SEED = 7;
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const lv = buildLevel(
  testQuest({
    notes: [
      {
        id: 'start',
        trigger: { type: 'questStart' },
        effects: [{ type: 'showText', title: 'Start', text: 'Place the heroes on the stairs.' }],
      },
      {
        id: 'door-note',
        letter: 'B',
        at: [1, 1],
        trigger: { type: 'doorOpened', door: 'd2' },
        effects: [{ type: 'showText', text: 'A cold draft. Something moves beyond.' }],
      },
    ],
  }),
);

describe('eventLog', () => {
  it('starts with the quest start and its start note', () => {
    const log = eventLog(lv, SEED, []);
    expect(log.map((l) => l.kind)).toEqual(['start', 'note']);
    expect(log[1]).toMatchObject({ note: 'start', text: 'Start', turn: 1 });
  });

  it('lists doors, notes (with the note to read again) and kills, oldest first', () => {
    const log = eventLog(lv, SEED, [open('d2'), { type: 'MONSTER_KILL', monster: 'm1' }]);
    const kinds = log.map((l) => l.kind);
    expect(kinds).toEqual(['start', 'note', 'door', 'note', 'monster']);
    expect(log[3]).toMatchObject({ note: 'door-note', text: 'Note B: A cold draft.' });
    expect(log[4]?.text).toMatch(/slain$/);
  });

  it('uses the turn the event happened in', () => {
    const log = eventLog(lv, SEED, [{ type: 'ZARGON_TURN_END' }, open('d2')]);
    expect(log.find((l) => l.kind === 'turn')).toMatchObject({ turn: 1 });
    expect(log.find((l) => l.kind === 'door')).toMatchObject({ turn: 2 });
  });

  it('an undo (dropping the last event) drops its lines', () => {
    const events: GameEvent[] = [open('d2'), { type: 'MONSTER_KILL', monster: 'm1' }];
    expect(eventLog(lv, SEED, events.slice(0, -1)).some((l) => l.kind === 'monster')).toBe(false);
    expect(eventLog(lv, SEED, events).some((l) => l.kind === 'monster')).toBe(true);
  });

  it('never names a door or a hidden trap', () => {
    const text = eventLog(lv, SEED, [open('d2')])
      .map((l) => l.text)
      .join(' ');
    expect(text).not.toMatch(/\bd\d\b/);
  });
});

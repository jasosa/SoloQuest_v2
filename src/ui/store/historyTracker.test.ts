import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import { testQuest } from '../../engine/quest/testQuest';
import { getRecord, setRecord } from '../../persist/history';
import { MemorySaveStore } from '../../persist/saves';
import { createGameStore } from './gameStore';
import { trackHistory } from './historyTracker';

const level = buildLevel(
  testQuest({
    objectives: [{ id: 'o', text: 'Pull', done: { flag: 'lever' } }],
    notes: [
      {
        id: 'lv',
        trigger: { type: 'manual', label: 'Lever' },
        effects: [{ type: 'setFlag', flag: 'lever', value: true }],
      },
    ],
  }),
);
const open = () =>
  createGameStore({ level, seed: 5, team: ['dwarf'], saves: new MemorySaveStore(), now: () => 1 });

describe('the quest history while a quest is played', () => {
  it('counts a win once and Undo of the end takes it back', () => {
    setRecord('h1', undefined);
    const game = open();
    trackHistory(game, 'h1');
    const d = game.getState().dispatch;
    d({ type: 'MANUAL_TRIGGER', note: 'lv' });
    d({ type: 'END_QUEST', outcome: 'stairs' });
    expect(getRecord('h1')?.plays).toBe(1);
    expect(getRecord('h1')?.last).toBe('won');
    game.getState().undo();
    expect(getRecord('h1')).toBeUndefined();
  });

  it('a quest left with the goal undone is lost, and plays add up', () => {
    setRecord('h2', { plays: 2, last: 'won', at: 1 });
    const game = open();
    trackHistory(game, 'h2');
    game.getState().dispatch({ type: 'END_QUEST', outcome: 'stairs' });
    expect(getRecord('h2')).toMatchObject({ plays: 3, last: 'lost' });
    game.getState().undo();
    expect(getRecord('h2')).toEqual({ plays: 2, last: 'won', at: 1 });
  });

  it('a game opened already ended is not counted again', () => {
    setRecord('h3', undefined);
    const game = open();
    game.getState().dispatch({ type: 'END_QUEST', outcome: 'stairs' });
    trackHistory(game, 'h3');
    expect(getRecord('h3')).toBeUndefined();
    game.getState().undo();
    expect(getRecord('h3')).toBeUndefined();
  });
});

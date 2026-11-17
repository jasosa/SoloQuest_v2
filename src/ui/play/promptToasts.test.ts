import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import type { Prompt } from '../../engine/game/prompts';
import { testQuest } from '../../engine/quest/testQuest';
import { MemorySaveStore } from '../../persist/saves';
import { createGameStore } from '../store/gameStore';
import { promptToasts, sheetsOf } from './promptToasts';

describe('prompt toasts and sheets', () => {
  it('short messages for map and roster changes', () => {
    const prompts: Prompt[] = [
      { kind: 'doorsOpened', doors: ['d1'] },
      { kind: 'monsterState', monster: 'm1', name: 'Verag', state: 'stone', turns: 2 },
      { kind: 'monsterState', monster: 'm1', name: 'Verag', state: 'active' },
      { kind: 'npcSpawned', npc: 'n', name: 'Sir Ragnar', cell: [1, 1], defend: 2, text: 'x' },
      { kind: 'doorStuck', door: 'x1' },
      { kind: 'goalDone' },
      { kind: 'loopStopped' },
    ];
    expect(promptToasts(prompts)).toEqual([
      'A door opens on the map.',
      'Verag turns to stone for 2 turns.',
      'Verag is awake.',
      'Sir Ragnar joins the heroes.',
      'Too many notes in a row. The rest was skipped.',
    ]);
  });

  it('a note with text, or a monster with a square, gets a sheet; the rest does not', () => {
    const prompts: Prompt[] = [
      { kind: 'note', noteId: 'a', texts: ['Hello.'], consumesTreasure: false },
      { kind: 'note', noteId: 'b', texts: [], consumesTreasure: true },
      { kind: 'monsterPlaced', monster: 'm', monsterType: 'orc', name: 'Orc', cell: [1, 2] },
      { kind: 'monsterPlaced', monster: 'n', monsterType: 'orc', name: 'Orc' },
    ];
    expect(sheetsOf(prompts).map((s) => s.t)).toEqual(['note', 'place']);
    expect(promptToasts(prompts)).toEqual(['Orc is in play now.']);
  });

  it('an achieved objective gets a sheet; the last one says the goal is done', () => {
    const prompts: Prompt[] = [
      { kind: 'objectiveDone', objective: 'o1', text: 'Kill them all' },
      { kind: 'objectiveDone', objective: 'o2', text: 'Leave' },
      { kind: 'goalDone' },
    ];
    expect(sheetsOf(prompts).map((s) => (s.t === 'goal' ? s.all : null))).toEqual([false, true]);
    expect(promptToasts(prompts)).toEqual([]);
    const one = sheetsOf([{ kind: 'objectiveDone', objective: 'o1', text: 'x' }]);
    expect(one.map((s) => (s.t === 'goal' ? s.all : null))).toEqual([false]);
  });
});

describe('start of a game', () => {
  const level = buildLevel(
    testQuest({
      notes: [
        {
          id: 'n-start',
          letter: 'I',
          trigger: { type: 'questStart' },
          effects: [{ type: 'showText', text: 'Welcome.' }],
        },
      ],
    }),
  );
  const make = (fresh: boolean) =>
    createGameStore({ level, seed: 1, team: ['dwarf'], saves: new MemorySaveStore(), fresh });

  it('a new game shows the start notes once; a resumed game does not replay them', () => {
    const a = make(true).getState();
    expect(sheetsOf(a.prompts)).toHaveLength(1);
    expect(a.state.notesFired).toEqual(['n-start']);
    const b = make(false).getState();
    expect(b.prompts).toEqual([]);
    expect(b.state.notesFired).toEqual(['n-start']); // the journal still has it
  });
});

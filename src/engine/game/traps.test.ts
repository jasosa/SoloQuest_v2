import { describe, expect, it } from 'vitest';
import { buildLevel, sightMap } from '../board/level';
import { visibleFrom } from '../board/los';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { lookHintCells } from './hints';
import { EventError, initialState, reduce, replay, undo, type Prompt } from './reducer';
import { draftOf } from './state';
import { trapsInView } from './view';

const level = buildLevel(testQuest());
const SEED = 7;
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (lv = level, ...events: GameEvent[]) => replay(lv, SEED, events);
const jump = (trap: string, result: 'skull' | 'ok'): GameEvent => ({
  type: 'TRAP_JUMP',
  trap,
  result,
});
const disarm = (
  trap: string,
  by: 'dwarf' | 'toolkit',
  result: 'skull' | 'blackShield' | 'other',
): GameEvent => ({ type: 'TRAP_DISARM', trap, by, result });
const step = (trap: string): GameEvent => ({ type: 'TRAP_STEP', trap });
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};
const prompts = (lv: typeof level, events: GameEvent[], last: GameEvent): readonly Prompt[] =>
  reduce(lv, replay(lv, SEED, events), last).prompts;

// t1 pit (7,16) and t2 chest trap are in R17 (open d2); t3 spear (5,18) is in the corridor (open d1).
const inR17 = [open('d2')];
const inCorridor = [open('d1')];

describe('traps: seen but kind hidden', () => {
  it('lists a seen trap as armed with no kind', () => {
    const s = run(level, ...inR17);
    const views = trapsInView(level, s);
    expect(views.map((v) => v.id)).toEqual(['t1', 't2']);
    for (const v of views) {
      expect(v.state).toBe('armed');
      expect(v.kind).toBeUndefined();
      expect(v.onMap).toBe(true);
    }
    expect(views.find((v) => v.id === 't2')?.cell).toEqual([6, 14]); // first square of the table
    expect(JSON.stringify(views)).not.toContain('pit');
  });

  it('rejects unseen and unknown traps', () => {
    const s = run(level);
    expect(code(() => reduce(level, s, step('t1')))).toBe('TRAP_NOT_SEEN');
    expect(code(() => reduce(level, s, step('zz')))).toBe('UNKNOWN_TRAP');
  });
});

describe('traps: jump, disarm, step truth table', () => {
  it('jump ok leaves the trap armed, skull springs it', () => {
    const s = run(level, ...inR17);
    const ok = reduce(level, s, jump('t1', 'ok'));
    expect(ok.prompts).toEqual([{ kind: 'trapJumped', trap: 't1' }]);
    expect(ok.state.trapStates).toEqual({});
    const bad = reduce(level, s, jump('t1', 'skull'));
    expect(bad.prompts).toEqual([{ kind: 'trapSprung', trap: 't1', trapKind: 'pit', via: 'jump' }]);
    expect(bad.state.trapStates).toEqual({ t1: 'sprung' });
  });

  it('step springs it', () => {
    const r = reduce(level, run(level, ...inCorridor), step('t3'));
    expect(r.prompts).toEqual([{ kind: 'trapSprung', trap: 't3', trapKind: 'spear', via: 'step' }]);
  });

  const table: ['dwarf' | 'toolkit', 'skull' | 'blackShield' | 'other', 'springs' | 'disarmed'][] =
    [
      ['dwarf', 'blackShield', 'springs'],
      ['dwarf', 'skull', 'disarmed'],
      ['dwarf', 'other', 'disarmed'],
      ['toolkit', 'skull', 'springs'],
      ['toolkit', 'blackShield', 'disarmed'],
      ['toolkit', 'other', 'disarmed'],
    ];
  for (const [by, result, outcome] of table) {
    it(`disarm by ${by} with ${result}: ${outcome}`, () => {
      const r = reduce(level, run(level, ...inCorridor), disarm('t3', by, result));
      if (outcome === 'springs') {
        expect(r.prompts[0]).toMatchObject({
          kind: 'trapSprung',
          via: 'disarm',
          trapKind: 'spear',
        });
        expect(r.state.trapStates.t3).toBe('sprung');
      } else {
        expect(r.prompts).toEqual([{ kind: 'trapDisarmed', trap: 't3', trapKind: 'spear' }]);
        expect(r.state.trapStates.t3).toBe('disarmed');
      }
    });
  }

  it('rejects a bad die result at runtime', () => {
    const s = run(level, ...inCorridor);
    const bad = { type: 'TRAP_JUMP', trap: 't3', result: 'six' } as unknown as GameEvent;
    expect(code(() => reduce(level, s, bad))).toBe('BAD_RESULT');
    const bad2 = {
      type: 'TRAP_DISARM',
      trap: 't3',
      by: 'elf',
      result: 'other',
    } as unknown as GameEvent;
    expect(code(() => reduce(level, s, bad2))).toBe('BAD_RESULT');
  });

  it('a sprung or disarmed trap is told in the view', () => {
    const s = run(level, ...inCorridor, step('t3'));
    const v = trapsInView(level, s).find((t) => t.id === 't3');
    expect(v).toMatchObject({ state: 'sprung', kind: 'spear', onMap: false, block: false });
    const u = run(level, ...inCorridor, disarm('t3', 'dwarf', 'other'));
    expect(trapsInView(level, u).find((t) => t.id === 't3')).toMatchObject({
      state: 'disarmed',
      kind: 'spear',
      onMap: false,
    });
  });
});

describe('traps: by kind', () => {
  it('spear is gone after it springs', () => {
    const s = run(level, ...inCorridor, step('t3'));
    for (const e of [step('t3'), jump('t3', 'ok'), disarm('t3', 'dwarf', 'other')])
      expect(code(() => reduce(level, s, e))).toBe('TRAP_GONE');
  });

  it('a disarmed trap is gone', () => {
    const s = run(level, ...inR17, disarm('t1', 'toolkit', 'other'));
    expect(code(() => reduce(level, s, step('t1')))).toBe('TRAP_GONE');
  });

  it('pit stays after it springs: it can be jumped again, not disarmed', () => {
    const s = run(level, ...inR17, step('t1'));
    expect(trapsInView(level, s).find((t) => t.id === 't1')).toMatchObject({
      state: 'sprung',
      kind: 'pit',
      onMap: true,
    });
    expect(reduce(level, s, jump('t1', 'ok')).prompts).toEqual([
      { kind: 'trapJumped', trap: 't1' },
    ]);
    const again = reduce(level, s, jump('t1', 'skull'));
    expect(again.prompts[0]).toMatchObject({ kind: 'trapSprung', trapKind: 'pit', via: 'jump' });
    expect(again.state.trapStates.t1).toBe('sprung');
    expect(code(() => reduce(level, s, disarm('t1', 'dwarf', 'other')))).toBe('TRAP_CANNOT');
  });

  it('chest trap: can be disarmed, never jumped or stepped on', () => {
    const s = run(level, ...inR17);
    expect(code(() => reduce(level, s, jump('t2', 'ok')))).toBe('TRAP_CANNOT');
    expect(code(() => reduce(level, s, step('t2')))).toBe('TRAP_CANNOT');
    expect(reduce(level, s, disarm('t2', 'toolkit', 'other')).prompts).toEqual([
      { kind: 'trapDisarmed', trap: 't2', trapKind: 'chest' },
    ]);
    const bad = reduce(level, s, disarm('t2', 'toolkit', 'skull'));
    expect(bad.prompts[0]).toMatchObject({ kind: 'trapSprung', trapKind: 'chest', via: 'disarm' });
    expect(code(() => reduce(level, bad.state, disarm('t2', 'dwarf', 'other')))).toBe('TRAP_GONE');
  });

  it('chest trap sprung text comes from the trap', () => {
    const lv = buildLevel(
      testQuest({
        traps: [{ id: 't2', kind: 'chest', furniture: 'f1', effect: 'Poison gas. Lose a turn.' }],
      }),
    );
    const p = prompts(lv, [open('d2')], disarm('t2', 'dwarf', 'blackShield'));
    expect(p[0]).toMatchObject({ kind: 'trapSprung', effect: 'Poison gas. Lose a turn.' });
  });

  it('a scripted trap cannot be used by these events', () => {
    const lv = buildLevel(testQuest({ traps: [{ id: 't9', kind: 'scripted', cell: [7, 16] }] }));
    const s = replay(lv, SEED, [open('d2')]);
    expect(s.seenTraps.has('t9')).toBe(true);
    for (const e of [step('t9'), jump('t9', 'skull'), disarm('t9', 'dwarf', 'other')])
      expect(code(() => reduce(lv, s, e))).toBe('TRAP_CANNOT');
  });
});

describe('traps: falling block', () => {
  const lv = buildLevel(
    testQuest({
      traps: [{ id: 't3', kind: 'fallingBlock', cell: [5, 18], effect: 'Roll 3 dice.' }],
    }),
  );

  it('becomes a permanent block that stops sight behind it', () => {
    // The hero stands at (3,18); door d1 is open and the corridor is only known at (3,18).
    const d = draftOf(initialState(lv, SEED));
    d.seenCells.add('3,18');
    d.openDoors.add('d1');
    d.seenTraps.add('t3');
    const before = visibleFrom(sightMap(lv, d.openDoors, d.placedBlocks), [3, 18]).map(String);
    expect(before).toContain('7,18');

    const r = reduce(lv, d, step('t3'));
    expect(r.prompts).toEqual([
      {
        kind: 'trapSprung',
        trap: 't3',
        trapKind: 'fallingBlock',
        via: 'step',
        effect: 'Roll 3 dice.',
      },
    ]);
    expect(r.state.placedBlocks).toEqual(new Set(['5,18']));
    const seen = visibleFrom(sightMap(lv, r.state.openDoors, r.state.placedBlocks), [3, 18]).map(
      String,
    );
    expect(seen).toContain('4,18');
    expect(seen).toContain('5,18'); // the block itself is seen
    expect(seen).not.toContain('6,18');
    expect(seen).not.toContain('7,18');

    // Reveal uses the block too.
    const looked = reduce(lv, r.state, { type: 'LOOK_FROM', cell: [3, 18] }).state;
    expect(looked.seenCells.has('4,18')).toBe(true);
    expect(looked.seenCells.has('6,18')).toBe(false);
    expect(looked.seenCells.has('0,18')).toBe(true);
  });

  it('the look hint no longer points past the new block', () => {
    const s = run(lv, open('d1'));
    expect(s.seenCells.has('7,18')).toBe(true);
    const t = reduce(lv, s, step('t3')).state;
    expect(lookHintCells(lv, t).length).toBeLessThanOrEqual(lookHintCells(lv, s).length);
  });

  it('is shown as a block in the view; it cannot be jumped or disarmed after', () => {
    const s = run(lv, open('d1'), step('t3'));
    expect(trapsInView(lv, s).find((t) => t.id === 't3')).toMatchObject({
      state: 'sprung',
      kind: 'fallingBlock',
      onMap: true,
      block: true,
    });
    for (const e of [step('t3'), jump('t3', 'ok'), disarm('t3', 'toolkit', 'other')])
      expect(code(() => reduce(lv, s, e))).toBe('TRAP_GONE');
  });

  it('uses the quest rule text when the trap has none', () => {
    const lv2 = buildLevel(
      testQuest({
        traps: [{ id: 't3', kind: 'fallingBlock', cell: [5, 18] }],
        rules: { fallingBlock: 'Quest rule for blocks.' },
      }),
    );
    expect(prompts(lv2, [open('d1')], step('t3'))[0]).toMatchObject({
      effect: 'Quest rule for blocks.',
    });
  });
});

describe('traps: undo and replay', () => {
  it('undo drops the last trap event and replays to the same state', () => {
    const events: GameEvent[] = [open('d2'), jump('t1', 'skull'), disarm('t2', 'toolkit', 'other')];
    const full = replay(level, SEED, events);
    expect(full.trapStates).toEqual({ t1: 'sprung', t2: 'disarmed' });
    const u = undo(level, SEED, events);
    expect(u.state).toEqual(replay(level, SEED, events.slice(0, 2)));
    expect(u.state.trapStates).toEqual({ t1: 'sprung' });
    expect(replay(level, SEED, events)).toEqual(full);
  });

  it('does not change the input state', () => {
    const s = run(level, ...inR17);
    reduce(level, s, step('t1'));
    expect(s.trapStates).toEqual({});
  });
});

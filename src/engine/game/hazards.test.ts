import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { TRAP_KIND_NAMES, trapKind } from '../data/trapKinds';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import type { GameEvent } from './events';
import { EventError, reduce, replay, type Prompt } from './reducer';
import { trapsInView } from './view';

// Frozen Horror hazards on the bottom corridor (y 18), seen once door d1 is open.
const make = (wandering?: unknown) =>
  parseQuest({
    ...testQuestData,
    blocks: [],
    traps: [
      { id: 'st', kind: 'stalactite', cell: [4, 18] },
      { id: 'ax', kind: 'swingingAxe', cell: [5, 18] },
      { id: 'wt', kind: 'wanderingTrap', cell: [6, 18] },
      { id: 'si', kind: 'slipperyIce', cell: [7, 18] },
      {
        id: 'sl',
        kind: 'iceSlide',
        cell: [2, 18],
        path: [
          [2, 18],
          [1, 18],
        ],
      },
    ],
    ...(wandering ? { wandering } : {}),
  });

const SEED = 3;
const lv = buildLevel(make({ monster: 'goblin', count: 2 }));
const open: GameEvent[] = [{ type: 'OPEN_DOOR', door: 'd1' }];
const after = (...e: GameEvent[]) => replay(lv, SEED, [...open, ...e]);
const step = (trap: string): GameEvent => ({ type: 'TRAP_STEP', trap });
const sprung = (ps: readonly Prompt[]) =>
  ps.find((p) => p.kind === 'trapSprung') as Extract<Prompt, { kind: 'trapSprung' }>;
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};
const dwarfOk = (trap: string): GameEvent => ({
  type: 'TRAP_DISARM',
  trap,
  by: 'dwarf',
  result: 'other',
});

describe('trap kinds are data (decision 44)', () => {
  it('every kind has a table entry with the same id, and the Frozen Horror ones name their box', () => {
    for (const k of TRAP_KIND_NAMES) expect(trapKind(k).id).toBe(k);
    for (const k of [
      'stalactite',
      'swingingAxe',
      'wanderingTrap',
      'slipperyIce',
      'iceSlide',
    ] as const)
      expect(trapKind(k).box).toBe('Frozen Horror');
    expect(trapKind('pit').box).toBeUndefined();
  });

  it('the hazards are all seen as "?" with no kind until they spring', () => {
    const views = trapsInView(lv, after());
    expect(views.map((v) => v.id).sort()).toEqual(['ax', 'sl', 'si', 'st', 'wt'].sort());
    for (const v of views) {
      expect(v.state).toBe('armed');
      expect(v.kind).toBeUndefined();
      expect(v.path).toBeUndefined();
    }
  });
});

describe('stalactite: once, then gone', () => {
  it('springs for the first hero and is gone for the next', () => {
    const p = reduce(lv, after(), step('st')).prompts;
    expect(sprung(p).trapKind).toBe('stalactite');
    expect(code(() => replay(lv, SEED, [...open, step('st'), step('st')]))).toBe('TRAP_GONE');
    expect(trapsInView(lv, after(step('st'))).find((v) => v.id === 'st')?.onMap).toBe(false);
  });
});

describe('swinging axe: hits every hero until it is disarmed', () => {
  it('springs again and again, and can be disarmed after it sprang', () => {
    const twice = after(step('ax'), step('ax'));
    const v = trapsInView(lv, twice).find((t) => t.id === 'ax')!;
    expect(v).toMatchObject({ state: 'sprung', kind: 'swingingAxe', onMap: true, canDisarm: true });
    const off = after(step('ax'), dwarfOk('ax'));
    expect(off.trapStates['ax']).toBe('disarmed');
    expect(code(() => replay(lv, SEED, [...open, dwarfOk('ax'), step('ax')]))).toBe('TRAP_GONE');
  });
  it('a sprung pit still cannot be disarmed', () => {
    const pitLv = buildLevel(parseQuest({ ...testQuestData }));
    expect(
      code(() =>
        replay(pitLv, SEED, [
          { type: 'OPEN_DOOR', door: 'd2' },
          { type: 'TRAP_STEP', trap: 't1' },
          { type: 'TRAP_DISARM', trap: 't1', by: 'dwarf', result: 'other' },
        ]),
      ),
    ).toBe('TRAP_CANNOT');
  });
});

describe('wandering monster trap (decision 41)', () => {
  it('a disarm try always springs it, even a good one', () => {
    const p = reduce(lv, after(), dwarfOk('wt')).prompts;
    expect(sprung(p)).toMatchObject({ trapKind: 'wanderingTrap', via: 'disarm' });
  });

  it('brings the quest wandering monsters onto the roster, fresh, in the area of the trap', () => {
    const r = reduce(lv, after(), step('wt'));
    expect(sprung(r.prompts).spawned).toEqual([
      { monster: 'w1', monsterType: 'goblin' },
      { monster: 'w2', monsterType: 'goblin' },
    ]);
    expect(Object.keys(r.state.wanderers)).toEqual(['w1', 'w2']);
    expect(r.state.wanderers['w1']).toMatchObject({ type: 'goblin', room: 'C', fresh: true });
    expect(r.state.seenMonsters.has('w2')).toBe(true);
    // it only works once
    expect(code(() => replay(lv, SEED, [...open, step('wt'), step('wt')]))).toBe('TRAP_GONE');
  });

  it('with no wandering monster in the quest nothing joins; a text quest shows its text', () => {
    const none = buildLevel(make());
    const r = reduce(none, replay(none, SEED, open), step('wt'));
    expect(sprung(r.prompts).spawned).toBeUndefined();
    expect(Object.keys(r.state.wanderers)).toEqual([]);
    const text = buildLevel(make({ text: 'Two thieves jump out.' }));
    expect(sprung(reduce(text, replay(text, SEED, open), step('wt')).prompts).effect).toBe(
      'Two thieves jump out.',
    );
  });
});

describe('slippery ice and the ice slide', () => {
  it('slippery ice cannot be disarmed: a try springs it, and it stays', () => {
    const p = reduce(lv, after(), dwarfOk('si')).prompts;
    expect(sprung(p).trapKind).toBe('slipperyIce');
    const s = after(dwarfOk('si'));
    expect(trapsInView(lv, s).find((t) => t.id === 'si')).toMatchObject({
      state: 'sprung',
      onMap: true,
      canDisarm: false,
    });
    // another hero steps on it: it springs again
    expect(sprung(reduce(lv, s, step('si')).prompts).trapKind).toBe('slipperyIce');
    expect(code(() => replay(lv, SEED, [...open, step('si'), dwarfOk('si')]))).toBe('TRAP_CANNOT');
  });

  it('a jump over the slide, good or bad, has the effect of a spring (decision 87)', () => {
    expect(trapsInView(lv, after()).find((t) => t.id === 'sl')?.path).toBeUndefined();
    for (const result of ['ok', 'skull'] as const) {
      const jumped = after({ type: 'TRAP_JUMP', trap: 'sl', result });
      const v = trapsInView(lv, jumped).find((t) => t.id === 'sl')!;
      expect(v.state).toBe('sprung');
      expect(v.path).toEqual([
        [2, 18],
        [1, 18],
      ]);
      const p = reduce(lv, after(), { type: 'TRAP_JUMP', trap: 'sl', result }).prompts;
      expect(p.some((x) => x.kind === 'trapSprung')).toBe(true);
      expect(p.some((x) => x.kind === 'trapJumped')).toBe(false);
    }
  });

  it('a spring also shows the path, and the slide stays for the next hero', () => {
    const s = after(step('sl'));
    expect(trapsInView(lv, s).find((t) => t.id === 'sl')).toMatchObject({
      state: 'sprung',
      kind: 'iceSlide',
      onMap: true,
    });
    expect(trapsInView(lv, s).find((t) => t.id === 'sl')?.path).toHaveLength(2);
    expect(sprung(reduce(lv, s, step('sl')).prompts).trapKind).toBe('iceSlide');
  });

  it('a jump that fails on the slide springs it; an ordinary good jump shows nothing', () => {
    expect(
      sprung(reduce(lv, after(), { type: 'TRAP_JUMP', trap: 'sl', result: 'skull' }).prompts)
        .trapKind,
    ).toBe('iceSlide');
    const p = reduce(lv, after(), { type: 'TRAP_JUMP', trap: 'st', result: 'ok' }).prompts;
    expect(p).toEqual([{ kind: 'trapJumped', trap: 'st' }]);
  });
});

describe('the quest file', () => {
  it('an ice slide needs a path that starts on its square, and only a slide has one', () => {
    const bad = (t: unknown) => () => parseQuest({ ...testQuestData, blocks: [], traps: [t] });
    expect(bad({ id: 'a', kind: 'iceSlide', cell: [2, 18] })).toThrow();
    expect(
      bad({
        id: 'a',
        kind: 'iceSlide',
        cell: [2, 18],
        path: [
          [3, 18],
          [2, 18],
        ],
      }),
    ).toThrow();
    expect(
      bad({
        id: 'a',
        kind: 'stalactite',
        cell: [2, 18],
        path: [
          [2, 18],
          [1, 18],
        ],
      }),
    ).toThrow();
    expect(bad({ id: 'a', kind: 'stalactite', cell: [2, 18] })).not.toThrow();
  });

  it('the validator wants slide squares on the board and next to each other', () => {
    const q = parseQuest({
      ...testQuestData,
      blocks: [],
      traps: [
        {
          id: 'sl',
          kind: 'iceSlide',
          cell: [2, 18],
          path: [
            [2, 18],
            [0, 18],
          ],
        },
      ],
    });
    expect(validateQuest(q, board).some((m) => m.includes('not next to the one before'))).toBe(
      true,
    );
    expect(validateQuest(make({ monster: 'goblin' }), board)).toEqual([]);
  });

  it('a wandering monster count is 1 to 6', () => {
    expect(() => make({ monster: 'goblin', count: 0 })).toThrow();
    expect(() => make({ monster: 'goblin', count: 7 })).toThrow();
  });
});

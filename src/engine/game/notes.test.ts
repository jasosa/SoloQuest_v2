import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { parseQuest } from '../quest/loader';
import { testQuest, testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { board } from '../board/board';
import { sightMap } from '../board/level';
import { EventError, type EventErrorCode } from './errors';
import type { GameEvent } from './events';
import { runTriggers } from './notes';
import { liveMonstersInRoom } from './monstersIn';
import { initialState, reduce, replay, startGame, undo, type Prompt } from './reducer';
import { draftOf, emptyState } from './state';
import { revealRoom } from './reveal';
import {
  availableEndings,
  dormantFigures,
  endSummary,
  elementQuest,
  enterableAreas,
  journal,
  manualTriggers,
  mapLetters,
  monstersInPlay,
  npcsInPlay,
  objectiveConfirms,
  objectivesStatus,
  pendingChoice,
  roomLabelAreas,
  squareMarkers,
  startTexts,
} from './view';

const SEED = 7;
const lvOf = (patch: Record<string, unknown> = {}) => buildLevel(testQuest(patch));
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const kill = (monster: string): GameEvent => ({ type: 'MONSTER_KILL', monster });
const hurt = (monster: string, amount: number): GameEvent => ({
  type: 'MONSTER_DAMAGE',
  monster,
  amount,
});
const manual = (note: string): GameEvent => ({ type: 'MANUAL_TRIGGER', note });
const turnEnd: GameEvent = { type: 'ZARGON_TURN_END' };
const square = (x: number, y: number): GameEvent => ({ type: 'SQUARE_TRIGGER', cell: [x, y] });
const code = (fn: () => unknown): EventErrorCode | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};
const kinds = (ps: readonly Prompt[]) => ps.map((p) => p.kind);
const texts = (ps: readonly Prompt[]) => ps.flatMap((p) => (p.kind === 'note' ? p.texts : []));
const text = (t: string) => ({ type: 'showText', text: t }) as const;

describe('questStart and areaRevealed', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'start',
        letter: 'S',
        at: [2, 15],
        trigger: { type: 'questStart' },
        effects: [text('Welcome.'), { type: 'setFlag', flag: 'begun', value: true }],
      },
      {
        id: 'room20',
        trigger: { type: 'areaRevealed', area: 'R20' },
        effects: [text('The stairway room.')],
      },
      {
        id: 'room17',
        trigger: { type: 'areaRevealed', area: 'R17' },
        when: [{ flag: 'begun', is: true }],
        effects: [text('A messy room.')],
      },
    ],
  });

  it('fires questStart and the start room at the start', () => {
    const r = startGame(lv, SEED);
    expect(texts(r.prompts)).toEqual(['Welcome.', 'The stairway room.']);
    expect(r.state.notesFired).toEqual(['start', 'room20']);
    expect(r.state.flags).toEqual({ begun: true });
    expect(initialState(lv, SEED)).toEqual(r.state);
  });

  it('fires areaRevealed when a door reveals the room, with the conditions checked', () => {
    const r = reduce(lv, initialState(lv, SEED), open('d2'));
    expect(kinds(r.prompts)).toEqual(['revealed', 'note']);
    expect(texts(r.prompts)).toEqual(['A messy room.']);
  });

  it('shows read notes in the journal and their letters on the map', () => {
    const s = replay(lv, SEED, [open('d2')]);
    expect(journal(lv, s).map((j) => [j.id, j.texts])).toEqual([
      ['start', ['Welcome.']],
      ['room20', ['The stairway room.']],
      ['room17', ['A messy room.']],
    ]);
    expect(mapLetters(lv, s)).toEqual([{ note: 'start', letter: 'S', at: [2, 15] }]);
    const unread = initialState(lvOf({ notes: [lv.quest.notes[2]!] }), SEED);
    expect(mapLetters(lv, { ...unread, notesFired: [] })).toEqual([]);
  });

  it('a note whose conditions fail stays available', () => {
    const lv2 = lvOf({
      notes: [
        {
          id: 'late',
          trigger: { type: 'areaRevealed', area: 'R17' },
          when: [{ flag: 'never', is: true }],
          effects: [text('x')],
        },
      ],
    });
    const s = replay(lv2, SEED, [open('d2')]);
    expect(s.notesFired).toEqual([]);
  });
});

describe('Q2 style alarm: doorOpened -> revealAll, openAllDoors, spawnNpc', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'alarm',
        trigger: { type: 'doorOpened', door: 'd2' },
        effects: [
          text('An alarm sounds!'),
          { type: 'setFlag', flag: 'alarm', value: true },
          { type: 'revealAll' },
          { type: 'openAllDoors' },
          { type: 'spawnNpc', npc: 'ragnar' },
        ],
      },
    ],
    npcs: [
      {
        id: 'ragnar',
        name: 'Sir Ragnar',
        cell: [2, 16],
        defend: 2,
        body: 2,
        text: 'Moved by the hero who opened his cell.',
      },
    ],
  });

  it('reveals the whole map except rock and hidden things, opens every normal door', () => {
    const start = initialState(lv, SEED);
    expect(npcsInPlay(lv, start)).toEqual([]); // spawned by the alarm, not by sight
    expect(start.seenCells.has('2,16')).toBe(true);

    const r = reduce(lv, start, open('d2'));
    const s = r.state;
    expect(kinds(r.prompts)).toContain('doorsOpened');
    expect(r.prompts.find((p) => p.kind === 'doorsOpened')).toMatchObject({
      doors: ['d1', 'd3', 'd4', 'd5'],
    });
    expect(kinds(r.prompts)).toContain('npcSpawned');
    expect(texts(r.prompts)).toEqual(['An alarm sounds!']);
    for (const d of ['d1', 'd2', 'd3', 'd4', 'd5']) expect(s.openDoors.has(d)).toBe(true);
    expect(s.openDoors.has('s1')).toBe(false);
    expect(s.openDoors.has('x1')).toBe(false);
    expect(s.seenDoors.has('s1')).toBe(false); // secret door stays hidden
    expect(s.seenDoors.has('x1')).toBe(true);
    expect(s.seenMonsters).toEqual(new Set(['m1', 'm2'])); // m3 is hidden
    expect(s.seenFurniture.has('f1')).toBe(true);
    expect(s.revealedRooms.has('R04')).toBe(false); // rock room
    expect(s.revealedRooms.has('R18')).toBe(true);
    expect(s.revealedRooms.has('R12')).toBe(true);
    for (const k of s.seenCells) expect(lv.rock.has(k)).toBe(false);
    expect(s.seenCells.has('3,18')).toBe(true); // corridor squares too
    expect(s.seenBlocks.size).toBe(1);
    expect(s.seenTraps.has('t2')).toBe(false); // the chest trap stays hidden
    expect(npcsInPlay(lv, s).map((n) => [n.id, n.name, n.defend])).toEqual([
      ['ragnar', 'Sir Ragnar', 2],
    ]);
  });

  it('is replayed exactly and undone', () => {
    const events = [open('d2')];
    const s = replay(lv, SEED, events);
    expect(s.flags.alarm).toBe(true);
    expect(undo(lv, SEED, events).state).toEqual(initialState(lv, SEED));
  });
});

describe('Q5 style gargoyle: a dormant statue until the next door opens (decision 28)', () => {
  const lv = lvOf({
    monsters: [
      { id: 'm1', type: 'orc', cell: [6, 15] },
      { id: 'm2', type: 'goblin', cell: [10, 15] },
      { id: 'm3', type: 'gargoyle', cell: [10, 16], state: 'dormant' },
    ],
    notes: [
      {
        id: 'wake',
        trigger: { type: 'doorOpened', door: 'd4' },
        effects: [
          text('The statue moves.'),
          { type: 'setMonsterState', monster: 'm3', state: 'active' },
        ],
      },
    ],
  });
  const toR18: GameEvent[] = [open('d2'), open('d3')];

  it('is furniture: drawn as a figure, not in the roster, cannot be wounded or slain', () => {
    const s = replay(lv, SEED, toR18);
    expect(monstersInPlay(lv, s).map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(dormantFigures(lv, s)).toEqual([{ id: 'm3', type: 'gargoyle', cell: [10, 16] }]);
    for (const e of [
      hurt('m3', 1),
      kill('m3'),
      { type: 'MONSTER_HEAL', monster: 'm3', amount: 1 } as const,
    ])
      expect(code(() => reduce(lv, s, e))).toBe('MONSTER_NOT_SEEN');
    expect(code(() => reduce(lv, s, hurt('m2', 1)))).toBeUndefined();
  });

  it('does not count as a monster in the room for searches or conditions', () => {
    const s = replay(lv, SEED, [...toR18, kill('m2')]);
    expect(liveMonstersInRoom(lv, s, 'R18')).toEqual([]);
    const r = reduce(lv, s, { type: 'SEARCH_TREASURE', room: 'R18', hero: 'elf' });
    expect(kinds(r.prompts)).toEqual(['drawCard']);
  });

  it('becomes a normal monster when the door opens', () => {
    const r = reduce(lv, replay(lv, SEED, toR18), open('d4'));
    expect(r.prompts).toContainEqual({
      kind: 'monsterState',
      monster: 'm3',
      name: 'Gargoyle',
      state: 'active',
    });
    expect(dormantFigures(lv, r.state)).toEqual([]);
    const g = monstersInPlay(lv, r.state).find((m) => m.id === 'm3')!;
    expect(g).toMatchObject({ state: 'active', body: 3, dead: false });
    expect(liveMonstersInRoom(lv, r.state, 'R18')).toContain('m3');
    const h = reduce(lv, r.state, hurt('m3', 3));
    expect(h.state.monsters.m3).toEqual({ body: 0, dead: true });
  });
});

describe('Q11 style bounty: monsterKilled -> addCounter + showText', () => {
  const lv = lvOf({
    wandering: { monster: 'orc' },
    notes: [
      {
        id: 'bounty-goblin',
        trigger: { type: 'monsterKilled', monsterType: 'goblin' },
        effects: [
          text('Pay 10 gold for this goblin.'),
          { type: 'addCounter', counter: 'gold', by: 10 },
        ],
      },
      {
        id: 'bounty-orc',
        trigger: { type: 'monsterKilled', monsterType: 'orc' },
        effects: [
          text('Pay 20 gold for this orc.'),
          { type: 'addCounter', counter: 'gold', by: 20 },
        ],
      },
      {
        id: 'rich',
        trigger: { type: 'monsterKilled' },
        when: [{ counter: 'gold', gte: 50 }, { firstTime: true }],
        effects: [text('The bounty hunter is rich.')],
      },
    ],
  });
  const seen: GameEvent[] = [open('d2'), open('d3')];

  it('adds to the counter at each kill and shows the text', () => {
    const a = reduce(lv, replay(lv, SEED, seen), kill('m1'));
    expect(texts(a.prompts)).toEqual(['Pay 20 gold for this orc.']);
    expect(a.prompts).toContainEqual({ kind: 'counter', counter: 'gold', by: 20, value: 20 });
    const b = reduce(lv, a.state, kill('m2'));
    expect(texts(b.prompts)).toEqual(['Pay 10 gold for this goblin.']);
    expect(b.state.counters.gold).toBe(30);
  });

  it('counts wandering monsters too, a repeating note stays one journal entry', () => {
    const s = replay(lv, SEED, [
      ...seen,
      kill('m1'),
      { type: 'WANDERING_MONSTER', room: 'R17', hero: 'elf' },
      kill('w1'),
      kill('m2'),
    ]);
    expect(s.counters.gold).toBe(50);
    expect(s.notesFired).toEqual(['bounty-orc', 'bounty-goblin', 'rich']);
    expect(journal(lv, s).map((j) => j.id)).toEqual(['bounty-orc', 'bounty-goblin', 'rich']);
    // the third kill (goblin) took the counter to 50 and fired "rich" in the same event
  });

  it('a kill by damage to 0 fires the same notes', () => {
    const s = replay(lv, SEED, [...seen, hurt('m1', 1)]);
    expect(s.counters.gold).toBe(20);
  });
});

describe('monsterKilled by id and allKilled', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'one',
        trigger: { type: 'monsterKilled', monster: 'm1' },
        effects: [text('The orc is down.')],
      },
      {
        id: 'both',
        trigger: { type: 'allKilled', monsters: ['m1', 'm2'] },
        effects: [text('Both are down.')],
      },
    ],
  });
  it('allKilled fires with the last of the listed monsters', () => {
    const seen: GameEvent[] = [open('d2'), open('d3')];
    const a = reduce(lv, replay(lv, SEED, seen), kill('m2'));
    expect(texts(a.prompts)).toEqual([]);
    const b = reduce(lv, a.state, kill('m1'));
    expect(texts(b.prompts)).toEqual(['The orc is down.', 'Both are down.']);
  });
});

describe('Q12 style areaEntered', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'enter',
        trigger: { type: 'areaEntered', area: 'R17' },
        effects: [text('Something stirs.')],
      },
    ],
  });
  it('is offered only for a revealed room with the note, once', () => {
    const s0 = initialState(lv, SEED);
    expect(enterableAreas(lv, s0)).toEqual([]);
    expect(code(() => reduce(lv, s0, { type: 'AREA_ENTER', area: 'R17' }))).toBe(
      'ROOM_NOT_REVEALED',
    );
    expect(code(() => reduce(lv, s0, { type: 'AREA_ENTER', area: 'R20' }))).toBe('NOT_A_TRIGGER');
    const s1 = replay(lv, SEED, [open('d2')]);
    expect(enterableAreas(lv, s1)).toEqual(['R17']);
    const r = reduce(lv, s1, { type: 'AREA_ENTER', area: 'R17' });
    expect(texts(r.prompts)).toEqual(['Something stirs.']);
    expect(enterableAreas(lv, r.state)).toEqual([]);
    expect(code(() => reduce(lv, r.state, { type: 'AREA_ENTER', area: 'R17' }))).toBe(
      'NOT_A_TRIGGER',
    );
  });
});

describe('Q10 style squareEntered', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'tele',
        trigger: { type: 'squareEntered', cell: [3, 16], repeat: true },
        effects: [text('Roll 2 red dice.')],
      },
      {
        id: 'once',
        trigger: { type: 'squareEntered', cell: [2, 16] },
        effects: [text('A draft.')],
      },
      {
        id: 'far',
        trigger: { type: 'squareEntered', cell: [7, 17] },
        effects: [text('Far away.')],
      },
    ],
  });
  it('markers show only seen squares, with no content', () => {
    const s = initialState(lv, SEED);
    expect(squareMarkers(lv, s)).toEqual([
      { cell: [3, 16], repeat: true, step: true },
      { cell: [2, 16], repeat: false, step: true },
    ]);
    expect(JSON.stringify(squareMarkers(lv, s))).not.toContain('Roll');
    const t = replay(lv, SEED, [open('d2')]);
    expect(squareMarkers(lv, t).map((m) => m.cell)).toContainEqual([7, 17]);
  });

  it('a repeat note fires every time, a once note one time', () => {
    const a = reduce(lv, initialState(lv, SEED), square(3, 16));
    const b = reduce(lv, a.state, square(3, 16));
    expect(texts(b.prompts)).toEqual(['Roll 2 red dice.']);
    expect(squareMarkers(lv, b.state).map((m) => m.cell)).toContainEqual([3, 16]);
    const c = reduce(lv, b.state, square(2, 16));
    expect(texts(c.prompts)).toEqual(['A draft.']);
    expect(squareMarkers(lv, c.state).map((m) => m.cell)).not.toContainEqual([2, 16]);
    expect(code(() => reduce(lv, c.state, square(2, 16)))).toBe('NOT_A_TRIGGER');
    expect(c.state.notesFired).toEqual(['tele', 'once']);
  });

  it('rejects unseen squares, squares with no note and bad cells', () => {
    const s = initialState(lv, SEED);
    expect(code(() => reduce(lv, s, square(7, 17)))).toBe('CELL_NOT_SEEN');
    expect(code(() => reduce(lv, s, square(1, 14)))).toBe('NOT_A_TRIGGER');
    expect(code(() => reduce(lv, s, square(99, 1)))).toBe('BAD_CELL');
  });
});

describe('zargonTurn and the stone countdown', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'stoned',
        trigger: { type: 'zargonTurn', n: 1 },
        effects: [{ type: 'setMonsterState', monster: 'm1', state: 'stone', turns: 2 }],
      },
      { id: 'two', trigger: { type: 'zargonTurn', n: 2 }, effects: [text('Turn two ends.')] },
      { id: 'even', trigger: { type: 'zargonTurn', every: 2 }, effects: [text('Even turn.')] },
      {
        id: 'all',
        trigger: { type: 'zargonTurn' },
        effects: [{ type: 'addCounter', counter: 't', by: 1 }],
      },
    ],
  });
  const seen: GameEvent[] = [open('d2')];

  it('n is the turn that just ended; every repeats', () => {
    const a = reduce(lv, replay(lv, SEED, seen), turnEnd);
    expect(a.state.turn).toBe(2);
    expect(texts(a.prompts)).toEqual([]);
    const b = reduce(lv, a.state, turnEnd);
    expect(texts(b.prompts)).toEqual(['Turn two ends.', 'Even turn.']);
    const c = reduce(lv, b.state, turnEnd);
    expect(texts(c.prompts)).toEqual([]);
    const d = reduce(lv, c.state, turnEnd);
    expect(texts(d.prompts)).toEqual(['Even turn.']);
    expect(d.state.counters.t).toBe(4);
  });

  it('stone set by a turn note keeps all its turns, then wakes up', () => {
    const view = (s: ReturnType<typeof initialState>) =>
      monstersInPlay(lv, s).find((m) => m.id === 'm1')!;
    const a = reduce(lv, replay(lv, SEED, seen), turnEnd);
    expect(view(a.state)).toMatchObject({ state: 'stone', stoneTurns: 2 });
    const b = reduce(lv, a.state, turnEnd);
    expect(view(b.state)).toMatchObject({ state: 'stone', stoneTurns: 1 });
    const c = reduce(lv, b.state, turnEnd);
    expect(view(c.state).state).toBe('active');
    expect(c.prompts).toContainEqual({
      kind: 'monsterState',
      monster: 'm1',
      name: 'Orc',
      state: 'active',
    });
  });
});

describe('promptChoice and CHOOSE', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'lever',
        letter: 'L',
        at: [2, 15],
        trigger: { type: 'manual', label: 'Lever' },
        effects: [
          text('There is a lever.'),
          {
            type: 'promptChoice',
            text: 'Pull it?',
            options: [
              {
                label: 'Pull',
                effects: [text('A wall slides.'), { type: 'setFlag', flag: 'pulled', value: true }],
              },
              { label: 'Leave', effects: [] },
            ],
          },
        ],
      },
    ],
  });
  it('keeps the pending choice in the state and runs the picked option', () => {
    const a = reduce(lv, initialState(lv, SEED), manual('lever'));
    expect(a.prompts.at(-1)).toEqual({
      kind: 'choice',
      noteId: 'lever',
      text: 'Pull it?',
      options: ['Pull', 'Leave'],
    });
    expect(pendingChoice(a.state)?.text).toBe('Pull it?');
    expect(code(() => reduce(lv, a.state, { type: 'CHOOSE', note: 'lever', option: 5 }))).toBe(
      'BAD_OPTION',
    );
    expect(code(() => reduce(lv, a.state, { type: 'CHOOSE', note: 'nope', option: 0 }))).toBe(
      'NO_PENDING_CHOICE',
    );
    const b = reduce(lv, a.state, { type: 'CHOOSE', note: 'lever', option: 0 });
    expect(texts(b.prompts)).toEqual(['A wall slides.']);
    expect(b.state.flags.pulled).toBe(true);
    expect(pendingChoice(b.state)).toBeUndefined();
    expect(code(() => reduce(lv, b.state, { type: 'CHOOSE', note: 'lever', option: 0 }))).toBe(
      'NO_PENDING_CHOICE',
    );
    expect(journal(lv, b.state)[0]?.choices).toEqual([
      { text: 'Pull it?', picked: 'Pull', texts: ['A wall slides.'] },
    ]);
  });
  it('replays exactly', () => {
    const events: GameEvent[] = [manual('lever'), { type: 'CHOOSE', note: 'lever', option: 1 }];
    const s = replay(lv, SEED, events);
    expect(s.flags.pulled).toBeUndefined();
    expect(undo(lv, SEED, events).state.pendingChoices).toHaveLength(1);
  });
});

describe('manual', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'btn',
        trigger: { type: 'manual', label: 'A hero passes here' },
        when: [{ flag: 'ready', is: true }],
        effects: [text('Done.')],
      },
      {
        id: 'ready',
        trigger: { type: 'questStart' },
        effects: [{ type: 'setFlag', flag: 'ready', value: true }],
      },
      { id: 'other', trigger: { type: 'questStart' }, effects: [] },
    ],
  });
  it('lists buttons for notes that did not fire and fires them once', () => {
    const s = initialState(lv, SEED);
    expect(manualTriggers(lv, s)).toEqual([{ note: 'btn', label: 'A hero passes here' }]);
    const r = reduce(lv, s, manual('btn'));
    expect(texts(r.prompts)).toEqual(['Done.']);
    expect(manualTriggers(lv, r.state)).toEqual([]);
    expect(code(() => reduce(lv, r.state, manual('btn')))).toBe('NOT_A_TRIGGER');
    expect(code(() => reduce(lv, s, manual('zzz')))).toBe('UNKNOWN_NOTE');
    expect(code(() => reduce(lv, s, manual('other')))).toBe('NOT_A_TRIGGER');
  });
  it('a failed condition fires nothing and the note stays unfired', () => {
    const lv2 = lvOf({ notes: [lv.quest.notes[0]!] });
    const r = reduce(lv2, initialState(lv2, SEED), manual('btn'));
    expect(kinds(r.prompts)).toEqual(['nothingNew']);
    expect(manualTriggers(lv2, r.state)).toEqual([]); // hidden while its conditions fail
    expect(r.state.notesFired).toEqual([]);
  });
});

describe('conditions', () => {
  const note = (id: string, when: unknown[]) => ({
    id,
    trigger: { type: 'manual', label: id },
    when,
    effects: [text(id)],
  });
  const lv = lvOf({
    notes: [
      {
        id: 'setup',
        trigger: { type: 'questStart' },
        effects: [
          { type: 'setFlag', flag: 'f', value: true },
          { type: 'addCounter', counter: 'c', by: 2 },
        ],
      },
      note('flag-true', [{ flag: 'f', is: true }]),
      note('flag-false', [{ flag: 'f', is: false }]),
      note('counter-ok', [{ counter: 'c', gte: 2 }]),
      note('counter-high', [{ counter: 'c', gte: 3 }]),
      note('m1-dead', [{ monster: 'm1', alive: false }]),
      note('m1-alive', [{ monster: 'm1', alive: true }]),
      note('room-clear', [{ monstersAliveIn: 'R17', is: 0 }]),
      note('first', [{ firstTime: true }]),
    ],
  });
  const fires = (s: ReturnType<typeof initialState>, id: string) =>
    texts(reduce(lv, s, manual(id)).prompts).length > 0;

  it('checks each kind', () => {
    const s = replay(lv, SEED, [open('d2')]);
    expect(fires(s, 'flag-true')).toBe(true);
    expect(fires(s, 'flag-false')).toBe(false);
    expect(fires(s, 'counter-ok')).toBe(true);
    expect(fires(s, 'counter-high')).toBe(false);
    expect(fires(s, 'm1-alive')).toBe(true);
    expect(fires(s, 'm1-dead')).toBe(false);
    expect(fires(s, 'room-clear')).toBe(false); // the orc is in R17
    expect(fires(s, 'first')).toBe(true);
    const t = reduce(lv, s, kill('m1')).state;
    expect(fires(t, 'm1-dead')).toBe(true);
    expect(fires(t, 'm1-alive')).toBe(false);
    expect(fires(t, 'room-clear')).toBe(true);
  });

  it('all conditions must hold', () => {
    const lv2 = lvOf({
      notes: [
        lv.quest.notes[0]!,
        note('both', [
          { flag: 'f', is: true },
          { counter: 'c', gte: 9 },
        ]),
      ],
    });
    expect(texts(reduce(lv2, initialState(lv2, SEED), manual('both')).prompts)).toEqual([]);
  });

  it('the schema rejects unknown shapes instead of ignoring them', () => {
    const bad = (patch: Record<string, unknown>) => () =>
      parseQuest({ ...testQuestData, ...patch });
    const base = { id: 'x', trigger: { type: 'questStart' }, effects: [] };
    expect(bad({ notes: [{ ...base, when: [{ nope: 1 }] }] })).toThrow();
    expect(bad({ notes: [{ ...base, when: [{ flag: 'a', is: 'yes' }] }] })).toThrow();
    expect(bad({ notes: [{ ...base, when: [{ flag: 'a', is: true, extra: 1 }] }] })).toThrow();
    expect(bad({ notes: [{ ...base, trigger: { type: 'sometime' } }] })).toThrow();
    expect(bad({ notes: [{ ...base, effects: [{ type: 'explode' }] }] })).toThrow();
    expect(bad({ notes: [{ ...base, effects: [{ type: 'setFlag', flag: 'a' }] }] })).toThrow();
  });
});

describe('other effects', () => {
  it('placeMonster puts a hidden monster in the roster with the named square', () => {
    const lv = lvOf();
    expect(monstersInPlay(lv, initialState(lv, SEED)).map((m) => m.id)).toEqual([]);
    const r = reduce(lv, initialState(lv, SEED), manual('n-m3'));
    expect(r.prompts).toEqual([
      {
        kind: 'monsterPlaced',
        monster: 'm3',
        monsterType: 'gargoyle',
        name: 'Gargoyle',
        cell: [10, 16],
      },
    ]);
    expect(monstersInPlay(lv, r.state)).toMatchObject([{ id: 'm3', placeAt: [10, 16], body: 3 }]);
    expect(code(() => reduce(lv, r.state, hurt('m3', 1)))).toBeUndefined();
  });

  it('addSecretDoor makes the door seen, closed, and openable', () => {
    const lv = lvOf({
      notes: [
        {
          id: 'sd',
          trigger: { type: 'doorOpened', door: 'd2' },
          effects: [{ type: 'addSecretDoor', door: 's1' }],
        },
      ],
    });
    const r = reduce(lv, initialState(lv, SEED), open('d2'));
    expect(r.prompts).toContainEqual({ kind: 'secretDoorAdded', door: 's1' });
    expect(r.state.seenDoors.has('s1')).toBe(true);
    expect(r.state.openDoors.has('s1')).toBe(false);
    const o = reduce(lv, r.state, open('s1'));
    expect(o.state.revealedRooms.has('R18')).toBe(true);
  });

  it('a secret door search with an addSecretDoor note still finds the other doors', () => {
    const lv = lvOf({
      notes: [
        {
          id: 'sd',
          trigger: { type: 'secretDoorSearch', area: 'R17' },
          effects: [text('A click.'), { type: 'addSecretDoor', door: 's1' }],
        },
      ],
    });
    const s = replay(lv, SEED, [open('d2'), kill('m1')]);
    const r = reduce(lv, s, { type: 'SEARCH_SECRET_DOORS', area: 'R17' });
    expect(kinds(r.prompts)).toEqual(['note', 'secretDoorAdded', 'nothingFound']);
    expect(r.state.seenDoors.has('s1')).toBe(true);
  });

  it('placeBlock adds a permanent block that stops sight', () => {
    const lv = lvOf({
      notes: [
        {
          id: 'pb',
          trigger: { type: 'questStart' },
          effects: [{ type: 'placeBlock', cells: [[3, 16]] }],
        },
      ],
    });
    const s = initialState(lv, SEED);
    expect(s.placedBlocks.has('3,16')).toBe(true);
    expect(sightMap(lv, s.openDoors, s.placedBlocks).cellKind(3, 16)).toBe('block');
  });

  it('openAllDoors alone also reveals what the doors show', () => {
    const lv = lvOf({
      notes: [{ id: 'od', trigger: { type: 'questStart' }, effects: [{ type: 'openAllDoors' }] }],
    });
    const s = initialState(lv, SEED);
    expect(s.openDoors.size).toBe(5);
    expect(s.revealedRooms.has('R17')).toBe(true);
    expect(s.revealedRooms.has('R18')).toBe(true);
  });

  it('revealArea reveals the room and fires its areaRevealed notes', () => {
    const lv = lvOf({
      notes: [
        {
          id: 'ra',
          trigger: { type: 'doorOpened', door: 'd1' },
          effects: [{ type: 'revealArea', area: 'R18' }],
        },
        {
          id: 'seen',
          trigger: { type: 'areaRevealed', area: 'R18' },
          effects: [text('You see the far room.')],
        },
      ],
    });
    const r = reduce(lv, initialState(lv, SEED), open('d1'));
    expect(r.state.revealedRooms.has('R18')).toBe(true);
    expect(texts(r.prompts)).toEqual(['You see the far room.']);
    expect(r.state.seenMonsters.has('m2')).toBe(true);
  });

  it('giveItem is text only', () => {
    const lv = lvOf({
      notes: [
        {
          id: 'gi',
          trigger: { type: 'questStart' },
          effects: [{ type: 'giveItem', text: 'a silver key' }],
        },
      ],
    });
    expect(texts(startGame(lv, SEED).prompts)).toEqual(['a silver key']);
  });
});

describe('trap hooks', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'sprung',
        trigger: { type: 'trapSprung', trap: 't1' },
        effects: [text('The pit opens.')],
      },
    ],
  });
  it('fires once when the trap changes to sprung', () => {
    const s = replay(lv, SEED, [open('d2')]);
    const a = reduce(lv, s, { type: 'TRAP_STEP', trap: 't1' });
    expect(kinds(a.prompts)).toEqual(['trapSprung', 'note']);
    const b = reduce(lv, a.state, { type: 'TRAP_STEP', trap: 't1' }); // falls in again
    expect(kinds(b.prompts)).toEqual(['trapSprung']);
  });
  it('fires on a disarm', () => {
    const lv2 = lvOf({
      notes: [
        { id: 'safe', trigger: { type: 'trapDisarmed', trap: 't1' }, effects: [text('Safe.')] },
      ],
    });
    const s = replay(lv2, SEED, [open('d2')]);
    const r = reduce(lv2, s, { type: 'TRAP_DISARM', trap: 't1', by: 'dwarf', result: 'other' });
    expect(kinds(r.prompts)).toEqual(['trapDisarmed', 'note']);
  });
  it('a chest trap sprung by a treasure search fires its note before the treasure notes', () => {
    const lv3 = lvOf({
      notes: [
        { id: 'chest', trigger: { type: 'trapSprung', trap: 't2' }, effects: [text('Gas!')] },
        { id: 'find', trigger: { type: 'treasureSearch', area: 'R17' }, effects: [text('Coins.')] },
      ],
    });
    const s = replay(lv3, SEED, [open('d2'), kill('m1')]);
    const r = reduce(lv3, s, { type: 'SEARCH_TREASURE', room: 'R17', hero: 'elf' });
    expect(kinds(r.prompts)).toEqual(['trapSprung', 'note', 'note', 'drawCard']);
    expect(texts(r.prompts)).toEqual(['Gas!', 'Coins.']);
  });
});

describe('loop guard', () => {
  const chain = lvOf({
    notes: [
      { id: 'a', trigger: { type: 'questStart' }, effects: [{ type: 'revealArea', area: 'R17' }] },
      {
        id: 'b',
        trigger: { type: 'areaRevealed', area: 'R17' },
        effects: [{ type: 'revealArea', area: 'R18' }],
      },
      { id: 'c', trigger: { type: 'areaRevealed', area: 'R18' }, effects: [text('End of chain.')] },
    ],
  });
  const fresh = () => {
    const d = draftOf(emptyState(1));
    revealRoom(chain, d, 'R20');
    return d;
  };

  it('the full chain runs with the default caps', () => {
    expect(texts(startGame(chain, 1).prompts)).toEqual(['End of chain.']);
  });
  it('stops at the depth cap and says so', () => {
    const d = fresh();
    const r = runTriggers(chain, d, [{ type: 'questStart' }], {
      beforeRooms: new Set(),
      maxDepth: 1,
    });
    expect(kinds(r.prompts)).toContain('loopStopped');
    expect(d.notesFired).toEqual(['a', 'b']);
  });
  it('stops at the step cap', () => {
    const d = fresh();
    const r = runTriggers(chain, d, [{ type: 'questStart' }], {
      beforeRooms: new Set(),
      maxSteps: 2,
    });
    expect(kinds(r.prompts)).toContain('loopStopped');
  });
});

describe('objectives and END_QUEST', () => {
  const lv = lvOf({
    rewards: '100 gold coins, shared',
    objectives: [
      { id: 'o1', text: 'Kill the orc', done: { monsterKilled: 'm1' } },
      { id: 'o2', text: 'Pull the lever', done: { flag: 'lever' } },
      { id: 'o3', text: 'Be brave' },
      { id: 'o4', text: 'Kill both', done: { allKilled: ['m1', 'm2'] } },
    ],
    notes: [
      {
        id: 'lv',
        trigger: { type: 'manual', label: 'Lever' },
        effects: [{ type: 'setFlag', flag: 'lever', value: true }],
      },
      {
        id: 'br',
        trigger: { type: 'manual', label: 'Brave' },
        effects: [{ type: 'completeObjective', objective: 'o3' }],
      },
    ],
  });
  const seen: GameEvent[] = [open('d2'), open('d3')];
  const done = (s: ReturnType<typeof initialState>) =>
    objectivesStatus(lv, s).items.map((o) => o.done);

  it('ticks by itself', () => {
    let r = reduce(lv, replay(lv, SEED, seen), kill('m1'));
    expect(r.prompts).toContainEqual({
      kind: 'objectiveDone',
      objective: 'o1',
      text: 'Kill the orc',
    });
    expect(done(r.state)).toEqual([true, false, false, false]);
    r = reduce(lv, r.state, manual('lv'));
    expect(done(r.state)).toEqual([true, true, false, false]);
    r = reduce(lv, r.state, manual('br'));
    expect(kinds(r.prompts)).not.toContain('goalDone');
    r = reduce(lv, r.state, kill('m2'));
    expect(kinds(r.prompts)).toEqual(['objectiveDone', 'goalDone']);
    expect(objectivesStatus(lv, r.state).goalDone).toBe(true);
  });

  it('a quest with no objectives never reports goalDone', () => {
    const lv0 = lvOf();
    expect(objectivesStatus(lv0, initialState(lv0, SEED)).goalDone).toBe(false);
  });

  it('END_QUEST with a custom ending: label and text, not won, no rewards', () => {
    const lvE = buildLevel(
      testQuest({
        rewards: '100 gold coins, shared',
        endings: [
          { id: 'npc-died', label: 'The guide died', text: 'The guide is lost.' },
          { id: 'plain', label: 'Plain' },
        ],
      }),
    );
    expect(availableEndings(lvE)).toEqual([
      { id: 'npc-died', label: 'The guide died', text: 'The guide is lost.' },
      { id: 'plain', label: 'Plain', text: undefined },
    ]);
    const s = initialState(lvE, SEED);
    const r = reduce(lvE, s, { type: 'END_QUEST', outcome: 'ending', ending: 'npc-died' });
    expect(r.prompts).toEqual([
      { kind: 'questEnded', outcome: 'ending', ending: 'npc-died', goalDone: false },
    ]);
    expect(r.state.ended).toEqual({ outcome: 'ending', ending: 'npc-died' });
    expect(endSummary(lvE, r.state)).toMatchObject({
      outcome: 'ending',
      ending: { id: 'npc-died', label: 'The guide died', text: 'The guide is lost.' },
      won: false,
      rewards: undefined,
    });
    expect(code(() => reduce(lvE, r.state, turnEnd))).toBe('QUEST_ENDED');
    // Undo replays to the state before the end.
    expect(
      undo(lvE, SEED, [{ type: 'END_QUEST', outcome: 'ending', ending: 'plain' }]).state.ended,
    ).toBeUndefined();
  });

  it('END_QUEST refuses an unknown ending, and any ending when the quest has none', () => {
    const lvE = buildLevel(testQuest({ endings: [{ id: 'a', label: 'A' }] }));
    const bad: GameEvent = { type: 'END_QUEST', outcome: 'ending', ending: 'zzz' };
    expect(code(() => reduce(lvE, initialState(lvE, SEED), bad))).toBe('UNKNOWN_ENDING');
    expect(code(() => reduce(lv, initialState(lv, SEED), bad))).toBe('UNKNOWN_ENDING');
    expect(availableEndings(lv)).toEqual([]);
  });

  it('END_QUEST ends once and blocks every other event', () => {
    const s = replay(lv, SEED, seen);
    expect(endSummary(lv, s)).toBeUndefined();
    const fell = reduce(lv, s, { type: 'END_QUEST', outcome: 'fell' });
    expect(fell.prompts).toEqual([{ kind: 'questEnded', outcome: 'fell', goalDone: false }]);
    expect(endSummary(lv, fell.state)).toEqual({
      outcome: 'fell',
      goalDone: false,
      won: false,
      rewards: '100 gold coins, shared',
      objectives: [
        { id: 'o1', text: 'Kill the orc', done: false },
        { id: 'o2', text: 'Pull the lever', done: false },
        { id: 'o3', text: 'Be brave', done: false },
        { id: 'o4', text: 'Kill both', done: false },
      ],
    });
    for (const e of [
      kill('m1'),
      turnEnd,
      open('d1'),
      { type: 'END_QUEST', outcome: 'stairs' } as const,
    ])
      expect(code(() => reduce(lv, fell.state, e))).toBe('QUEST_ENDED');
  });

  it('won needs the goal and the stairs', () => {
    const s = replay(lv, SEED, [...seen, kill('m1'), kill('m2'), manual('lv'), manual('br')]);
    const end = reduce(lv, s, { type: 'END_QUEST', outcome: 'stairs' });
    expect(end.prompts).toEqual([{ kind: 'questEnded', outcome: 'stairs', goalDone: true }]);
    expect(endSummary(lv, end.state)).toMatchObject({ goalDone: true, won: true });
  });
});

describe('NPCs', () => {
  const lv = lvOf({
    npcs: [
      { id: 'guard', name: 'Old Guard', cell: [6, 17], defend: 3, body: 4, text: 'Stands still.' },
    ],
  });
  it('an NPC that nothing spawns appears when its square is seen', () => {
    expect(npcsInPlay(lv, initialState(lv, SEED))).toEqual([]);
    const s = replay(lv, SEED, [open('d2')]);
    expect(npcsInPlay(lv, s).map((n) => n.id)).toEqual(['guard']);
  });
});

describe('undo and replay of every new event', () => {
  const lv = lvOf({
    wandering: { monster: 'orc' },
    npcs: [{ id: 'n1', name: 'N', cell: [2, 16], defend: 1, body: 1, text: 't' }],
    objectives: [{ id: 'o1', text: 'x', done: { monsterKilled: 'm1' } }],
    notes: [
      { id: 'enter', trigger: { type: 'areaEntered', area: 'R17' }, effects: [text('in')] },
      {
        id: 'sq',
        trigger: { type: 'squareEntered', cell: [3, 16] },
        effects: [{ type: 'spawnNpc', npc: 'n1' }],
      },
      {
        id: 'ch',
        trigger: { type: 'manual', label: 'go' },
        effects: [
          {
            type: 'promptChoice',
            text: 'Which?',
            options: [
              {
                label: 'A',
                effects: [{ type: 'setMonsterState', monster: 'm1', state: 'stone', turns: 2 }],
              },
              { label: 'B', effects: [] },
            ],
          },
        ],
      },
      {
        id: 'z',
        trigger: { type: 'zargonTurn', every: 1 },
        effects: [{ type: 'addCounter', counter: 'k', by: 1 }],
      },
    ],
  });
  const events: GameEvent[] = [
    open('d2'),
    { type: 'AREA_ENTER', area: 'R17' },
    square(3, 16),
    manual('ch'),
    { type: 'CHOOSE', note: 'ch', option: 0 },
    turnEnd,
    turnEnd,
    kill('m1'),
    { type: 'END_QUEST', outcome: 'stairs' },
  ];
  it('replaying equals playing, and undo returns the earlier state', () => {
    let s = initialState(lv, SEED);
    const states = [s];
    for (const e of events) {
      s = reduce(lv, s, e).state;
      states.push(s);
    }
    expect(replay(lv, SEED, events)).toEqual(s);
    for (let i = 1; i <= events.length; i++)
      expect(undo(lv, SEED, events.slice(0, i)).state).toEqual(states[i - 1]);
    expect(s.ended).toEqual({ outcome: 'stairs' });
    expect(s.counters.k).toBe(2);
  });
  it('does not change the state it was given', () => {
    const s = replay(lv, SEED, events.slice(0, 5));
    const copy = structuredClone(s);
    reduce(lv, s, turnEnd);
    expect(s).toEqual(copy);
  });
});

describe('validateQuest: notes engine checks', () => {
  const problems = (patch: Record<string, unknown>) => validateQuest(testQuest(patch), board);
  const note = (extra: Record<string, unknown>) => ({
    id: 'n1',
    trigger: { type: 'questStart' },
    effects: [],
    ...extra,
  });
  const keepFixture = testQuestData.notes[0];
  const has = (ps: string[], part: string) => ps.some((p) => p.includes(part));

  it('accepts the fixture', () => {
    expect(problems({})).toEqual([]);
  });
  it('checks references in effects, triggers and conditions', () => {
    const ps = problems({
      notes: [
        keepFixture,
        note({
          trigger: { type: 'monsterKilled', monster: 'zz' },
          when: [
            { monster: 'yy', alive: true },
            { monstersAliveIn: 'R99', is: 0 },
          ],
          effects: [
            { type: 'setMonsterState', monster: 'xx', state: 'dormant', turns: 2 },
            { type: 'addSecretDoor', door: 'd1' },
            { type: 'completeObjective', objective: 'oo' },
            { type: 'revealArea', area: 'C' },
          ],
        }),
      ],
    });
    for (const part of [
      'monster zz',
      'monster yy',
      'R99',
      'monster xx',
      'turns only',
      'secret door d1',
      'objective oo',
      'not a room',
    ])
      expect(has(ps, part)).toBe(true);
  });
  it('placeMonster needs a hidden monster with a square, and hidden monsters must be placed', () => {
    const ps = problems({
      notes: [note({ effects: [{ type: 'placeMonster', monster: 'm1' }] })],
    });
    expect(has(ps, 'needs a hidden monster')).toBe(true);
    expect(has(ps, 'monster m3: hidden but no note places it')).toBe(true);
    const nocell = problems({
      monsters: [
        ...testQuestData.monsters.slice(0, 2),
        { id: 'm3', type: 'gargoyle', hidden: true },
      ],
      notes: [note({ effects: [{ type: 'placeMonster', monster: 'm3' }] })],
    });
    expect(has(nocell, 'has no cell')).toBe(true);
  });
  it('flags and counters used in conditions must be set somewhere', () => {
    const ps = problems({
      notes: [
        keepFixture,
        note({
          when: [
            { flag: 'ghost', is: true },
            { counter: 'nope', gte: 1 },
          ],
        }),
      ],
    });
    expect(has(ps, 'flag ghost is never set')).toBe(true);
    expect(has(ps, 'counter nope is never changed')).toBe(true);
  });
  it('rules.noEquipmentUntil must name a note', () => {
    expect(has(problems({ rules: { noEquipmentUntil: 'n-zz' } }), 'noEquipmentUntil')).toBe(true);
    expect(problems({ rules: { noEquipmentUntil: 'n-m3' } })).toEqual([]);
  });
  it('objective references', () => {
    const ps = problems({
      objectives: [
        { id: 'o1', text: 'a', done: { monsterKilled: 'zz' } },
        { id: 'o2', text: 'b', done: { allKilled: ['m1', 'yy'] } },
        { id: 'o3', text: 'c', done: { flag: 'nope' } },
        { id: 'o4', text: 'd' },
      ],
    });
    for (const part of ['monster zz', 'monster yy', 'flag nope is never set', 'no done rule'])
      expect(has(ps, part)).toBe(true);
  });
  it('trigger shape checks', () => {
    const ps = problems({
      notes: [
        keepFixture,
        note({ id: 'a', trigger: { type: 'monsterKilled', monster: 'm1', monsterType: 'orc' } }),
        note({ id: 'b', trigger: { type: 'zargonTurn', n: 1, every: 2 } }),
        note({ id: 'c', consumesTreasure: true }),
        note({ id: 'd', trigger: { type: 'areaEntered', area: 'C' } }),
      ],
    });
    for (const part of ['not both', 'n or every', 'consumesTreasure only', 'not a room'])
      expect(has(ps, part)).toBe(true);
  });
  it('blocksSearch needs a treasureSearch trigger and excludes consumesTreasure', () => {
    const ps = problems({
      notes: [
        keepFixture,
        note({ id: 'a', blocksSearch: true }),
        note({
          id: 'b',
          trigger: { type: 'treasureSearch', area: 'R17' },
          blocksSearch: true,
          consumesTreasure: true,
        }),
      ],
    });
    expect(has(ps, 'note a: blocksSearch only')).toBe(true);
    expect(has(ps, 'note b: blocksSearch and consumesTreasure')).toBe(true);
    const fine = problems({
      notes: [
        keepFixture,
        note({ id: 'c', trigger: { type: 'treasureSearch', area: 'R17' }, blocksSearch: true }),
      ],
    });
    expect(fine).toEqual([]);
  });
  it('ending ids must be unique', () => {
    const ps = problems({
      endings: [
        { id: 'e1', label: 'One' },
        { id: 'e1', label: 'Two' },
      ],
    });
    expect(has(ps, 'ending e1: duplicate id')).toBe(true);
  });
  it('traps and doors may not sit under blocks or furniture', () => {
    const ps = problems({
      traps: [
        { id: 't1', kind: 'pit', cell: [8, 18] },
        { id: 't4', kind: 'pit', cell: [6, 14] },
        { id: 't5', kind: 'pit', cell: [7, 16] },
        { id: 't6', kind: 'spear', cell: [7, 16] },
      ],
      blocks: [{ cells: [[8, 18]] }, { cells: [[3, 17]] }],
    });
    expect(has(ps, 'trap t1: cell 8,18 is under block')).toBe(true);
    expect(has(ps, 'trap t4: cell 6,14 is under furniture f1')).toBe(true);
    expect(has(ps, 'trap t6: same cell as trap t5')).toBe(true);
    expect(has(ps, 'door d1: cell 3,17 is under block')).toBe(true);
  });
  it('block ids may not collide with generated ids', () => {
    const ps = problems({ blocks: [{ cells: [[8, 18]] }, { id: 'b1', cells: [[12, 5]] }] });
    expect(has(ps, 'collides with a generated block id')).toBe(true);
    expect(problems({ blocks: [{ id: 'b1', cells: [[8, 18]] }, { cells: [[12, 5]] }] })).toEqual(
      [],
    );
  });
});

describe('review fixes', () => {
  const note = (extra: Record<string, unknown>) => ({
    id: 'n1',
    trigger: { type: 'questStart' },
    effects: [],
    ...extra,
  });
  it('flag is false and counter gte 0 need no setter', () => {
    const ps = validateQuest(
      testQuest({
        notes: [
          testQuestData.notes[0],
          note({
            when: [
              { flag: 'x', is: false },
              { counter: 'c', gte: 0 },
            ],
          }),
        ],
      }),
      board,
    );
    expect(ps).toEqual([]);
  });

  it('a monster placed by an effect counts in the room where it was placed', () => {
    const lv = lvOf();
    const s = replay(lv, SEED, [open('d2'), manual('n-m3')]); // m3 placed at (10,16), in R18
    expect(liveMonstersInRoom(lv, s, 'R18')).toContain('m3');
  });

  it('placeMonster also moves a monster the heroes already saw', () => {
    const lv = lvOf({
      notes: [
        {
          id: 'esc',
          trigger: { type: 'manual', label: 'Escape' },
          effects: [{ type: 'placeMonster', monster: 'm1', cell: [2, 16] }],
        },
      ],
    });
    const s = replay(lv, SEED, [open('d2')]);
    const r = reduce(lv, s, manual('esc'));
    expect(r.prompts).toEqual([
      { kind: 'monsterPlaced', monster: 'm1', monsterType: 'orc', name: 'Orc', cell: [2, 16] },
    ]);
    expect(r.state.placedMonsterCells.m1).toEqual([2, 16]);
    expect(liveMonstersInRoom(lv, r.state, 'R20')).toEqual(['m1']);
    expect(r.state.monsters.m1).toEqual({ body: 1, dead: false });
  });

  it('manualTriggers lists a note only while its conditions hold', () => {
    const lv = lvOf({
      notes: [
        {
          id: 'set',
          trigger: { type: 'doorOpened', door: 'd2' },
          effects: [{ type: 'setFlag', flag: 'f', value: true }],
        },
        {
          id: 'btn',
          trigger: { type: 'manual', label: 'Go' },
          when: [{ flag: 'f', is: true }],
          effects: [text('ok')],
        },
      ],
    });
    const s0 = initialState(lv, SEED);
    expect(manualTriggers(lv, s0)).toEqual([]);
    const s1 = reduce(lv, s0, open('d2')).state;
    expect(manualTriggers(lv, s1)).toHaveLength(1);
    expect(manualTriggers(lv, reduce(lv, s1, manual('btn')).state)).toEqual([]);
  });
});

describe('conditions on state (decision 67) and objectives with own rules', () => {
  const lv = lvOf({
    objectives: [
      {
        id: 'o1',
        text: 'Open two doors',
        done: { when: [{ doorOpened: 'd2' }, { doorOpened: 'd3' }] },
      },
      { id: 'o2', text: 'Leave together', confirm: 'All survivors left' },
    ],
    notes: [
      {
        id: 'gated',
        trigger: { type: 'manual', label: 'Needs d3' },
        when: [{ doorOpened: 'd3' }],
        effects: [text('ok')],
      },
      {
        id: 'seen',
        trigger: { type: 'manual', label: 'Needs m1 seen' },
        when: [{ monsterSeen: 'm1' }],
        effects: [text('ok')],
      },
    ],
  });

  it('a manual button waits for its door condition', () => {
    const s0 = replay(lv, SEED, [open('d2')]);
    expect(manualTriggers(lv, s0).map((m) => m.note)).not.toContain('gated');
    const s1 = reduce(lv, s0, open('d3')).state;
    expect(manualTriggers(lv, s1).map((m) => m.note)).toContain('gated');
  });

  it('monsterSeen holds once the monster was seen', () => {
    const s0 = initialState(lv, SEED);
    expect(s0.seenMonsters.has('m1')).toBe(false);
    expect(manualTriggers(lv, s0).map((m) => m.note)).not.toContain('seen');
    const s1 = replay(lv, SEED, [open('d2'), open('d3')]);
    expect(
      manualTriggers(lv, s1)
        .map((m) => m.note)
        .includes('seen'),
    ).toBe(s1.seenMonsters.has('m1'));
  });

  it('an objective with `when` is done when all its conditions hold', () => {
    const s1 = reduce(lv, initialState(lv, SEED), open('d2')).state;
    expect(objectivesStatus(lv, s1).items[0]?.done).toBe(false);
    const s2 = reduce(lv, s1, open('d3')).state;
    expect(objectivesStatus(lv, s2).items[0]?.done).toBe(true);
  });

  it('CONFIRM_OBJECTIVE completes an objective with a confirm button, once', () => {
    const s0 = initialState(lv, SEED);
    expect(objectiveConfirms(lv, s0)).toEqual([{ objective: 'o2', label: 'All survivors left' }]);
    const r = reduce(lv, s0, { type: 'CONFIRM_OBJECTIVE', objective: 'o2' });
    expect(objectivesStatus(lv, r.state).items[1]?.done).toBe(true);
    expect(objectiveConfirms(lv, r.state)).toEqual([]);
    expect(code(() => reduce(lv, r.state, { type: 'CONFIRM_OBJECTIVE', objective: 'o2' }))).toBe(
      'NOT_A_TRIGGER',
    );
    expect(code(() => reduce(lv, s0, { type: 'CONFIRM_OBJECTIVE', objective: 'o1' }))).toBe(
      'NOT_A_TRIGGER',
    );
  });

  it('the validator accepts the quest and rejects bad ids and firstTime in an objective', () => {
    expect(validateQuest(lv.quest, board).filter((m) => m.includes('objective'))).toEqual([]);
    const bad = lvOf({
      objectives: [
        { id: 'o1', text: 'x', done: { when: [{ doorOpened: 'nope' }, { firstTime: true }] } },
      ],
    });
    const msgs = validateQuest(bad.quest, board);
    expect(msgs.some((m) => m.includes('unknown door nope'))).toBe(true);
    expect(msgs.some((m) => m.includes('firstTime'))).toBe(true);
  });
});

describe('note target (decision 67)', () => {
  it('an explicit target must name an element of the quest', () => {
    const ok = lvOf({
      notes: [
        {
          id: 'b',
          trigger: { type: 'manual', label: 'Pull' },
          target: { kind: 'door', id: 'd2' },
          effects: [text('x')],
        },
      ],
    });
    expect(validateQuest(ok.quest, board).filter((m) => m.includes('target'))).toEqual([]);
    const bad = lvOf({
      notes: [
        {
          id: 'b',
          trigger: { type: 'manual', label: 'Pull' },
          target: { kind: 'monster', id: 'nope' },
          effects: [text('x')],
        },
      ],
    });
    expect(validateQuest(bad.quest, board).some((m) => m.includes('target monster nope'))).toBe(
      true,
    );
  });
});

describe('startTexts', () => {
  it('gives the texts of the first questStart note, or none', () => {
    expect(startTexts(lvOf({ notes: [] }))).toEqual([]);
    const lv = lvOf({
      notes: [
        {
          id: 's',
          trigger: { type: 'questStart' },
          effects: [text('Place the heroes on the stairs.')],
        },
      ],
    });
    expect(startTexts(lv)).toEqual(['Place the heroes on the stairs.']);
  });
});

describe('element buttons (decision 67)', () => {
  const lv = lvOf({
    notes: [
      {
        id: 'free',
        trigger: { type: 'manual', label: 'No element' },
        effects: [text('free')],
      },
      {
        id: 'on-door',
        trigger: { type: 'manual', label: 'On the door' },
        target: { kind: 'door', id: 'd2' },
        effects: [text('door')],
      },
      {
        id: 'seen',
        trigger: { type: 'doorOpened', door: 'd2' },
        effects: [text('The door groans.')],
      },
    ],
  });

  it('a manual note with a target is a button of its element, not of the Quest sheet', () => {
    const s = initialState(lv, SEED);
    expect(manualTriggers(lv, s).map((m) => m.note)).toEqual(['free']);
    expect(elementQuest(lv, s, 'door', 'd2').buttons).toEqual([
      { note: 'on-door', label: 'On the door' },
    ]);
    expect(elementQuest(lv, s, 'door', 'd1')).toEqual({ read: [], waiting: [], buttons: [] });
  });

  it('lists the notes already read for the element, and a pressed button is gone', () => {
    const s = replay(lv, SEED, [open('d2'), manual('on-door')]);
    const q = elementQuest(lv, s, 'door', 'd2');
    expect(q.buttons).toEqual([]);
    expect(q.read.map((e) => e.id)).toEqual(['seen', 'on-door']);
  });

  it('a button with an area target puts the label on a revealed room', () => {
    const lv2 = lvOf({
      notes: [
        {
          id: 'room-btn',
          trigger: { type: 'manual', label: 'Room button' },
          target: { kind: 'area', id: lvOf().quest.start.area },
          effects: [text('x')],
        },
      ],
    });
    const s = initialState(lv2, SEED);
    expect(roomLabelAreas(lv2, s)).toEqual([lv2.quest.start.area]);
    expect(enterableAreas(lv2, s)).toEqual([]); // no "A hero enters" for a button only
  });
});

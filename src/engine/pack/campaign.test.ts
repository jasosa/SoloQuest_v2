import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import type { GameEvent } from '../game/events';
import { reduce, replay } from '../game/reducer';
import { testQuest } from '../quest/testQuest';
import {
  finishQuest,
  newCampaign,
  nextCampaignSlot,
  nextQuest,
  questFinished,
  skipQuest,
  startFlagsFor,
  type Campaign,
} from './campaign';
import { parsePackManifest } from './registry';

const SEED = 4;
const pack = parsePackManifest({
  schemaVersion: 1,
  id: 'ice',
  name: 'Ice',
  dependsOn: ['core'],
  quests: ['a', 'b', 'c'],
  campaignSettings: [
    { id: 'raiment', name: 'Raiment', text: 'x', default: false },
    { id: 'extra', name: 'Extra', text: 'y', default: true },
  ],
});

describe('a campaign (decision 37)', () => {
  it('starts empty, with the pack settings at their defaults and its seed', () => {
    expect(newCampaign(pack, SEED)).toEqual({
      version: 1,
      id: 'ice',
      name: 'Ice',
      pack: 'ice',
      seed: SEED,
      finished: [],
      skipped: [],
      journal: [],
      flags: {},
      team: [],
      fallen: [],
      settings: { raiment: false, extra: true },
    });
  });

  it('a campaign can have its own id and name, and the next id of a pack is free', () => {
    const c = newCampaign(pack, SEED, { id: 'ice-2', name: 'Campaign 2' });
    expect(c.id).toBe('ice-2');
    expect(c.name).toBe('Campaign 2');
    expect(nextCampaignSlot('ice', [])).toEqual({ id: 'ice', number: 1 });
    expect(nextCampaignSlot('ice', ['ice', 'core'])).toEqual({ id: 'ice-2', number: 2 });
    expect(nextCampaignSlot('ice', ['ice', 'ice-3'])).toEqual({ id: 'ice-2', number: 2 });
    expect(nextCampaignSlot('ice', ['ice', 'ice-2'])).toEqual({ id: 'ice-3', number: 3 });
  });

  it('a one-shot takes the one-shot value of a carried flag, a campaign what was carried (false if nothing)', () => {
    const q = { flagsIn: [{ flag: 'scepterDestroyed', oneShot: true }] };
    expect(startFlagsFor(q, undefined)).toEqual({ scepterDestroyed: true });
    const c = newCampaign(pack, SEED);
    expect(startFlagsFor(q, c)).toEqual({ scepterDestroyed: false });
    expect(startFlagsFor(q, { ...c, flags: { scepterDestroyed: true } })).toEqual({
      scepterDestroyed: true,
    });
    expect(startFlagsFor({}, c)).toEqual({});
  });

  it('finishing a quest lists it once, keeps only its flagsOut, and notes who fell', () => {
    const c = newCampaign(pack, SEED);
    const quest = { id: 'a', flagsOut: ['scepterDestroyed'] };
    const state = { flags: { scepterDestroyed: true, other: true }, deadHeroes: ['dwarf'] };
    const done = finishQuest(c, quest, state);
    expect(done.finished).toEqual(['a']);
    expect(done.flags).toEqual({ scepterDestroyed: true });
    expect(done.fallen).toEqual(['dwarf']);
    // played again and not destroyed this time: the flag is overwritten, the quest is listed once
    const again = finishQuest(done, quest, { flags: {}, deadHeroes: [] });
    expect(again.finished).toEqual(['a']);
    expect(again.flags).toEqual({ scepterDestroyed: false });
  });

  it('the next quest is the first of the campaign order that is not finished', () => {
    const c: Campaign = { ...newCampaign(pack, SEED), finished: ['a', 'c'] };
    expect(nextQuest(pack, undefined)).toBe('a');
    expect(nextQuest(pack, c)).toBe('b');
    expect(nextQuest(pack, { ...c, finished: ['a', 'b', 'c'] })).toBeUndefined();
  });
});

describe('flags that a quest starts with', () => {
  const lv = buildLevel(
    testQuest({
      flagsIn: [{ flag: 'scepterDestroyed', oneShot: true }],
      objectives: [{ id: 'o', text: 'Be brave' }],
      notes: [
        {
          id: 'n',
          trigger: { type: 'questStart' },
          when: [{ flag: 'scepterDestroyed', is: true }],
          effects: [{ type: 'showText', text: 'The scepter is gone.' }],
        },
      ],
    }),
  );

  it('are in the state from the first moment, so the quest-start notes see them', () => {
    const on = replay(lv, SEED, [], { scepterDestroyed: true });
    expect(on.flags.scepterDestroyed).toBe(true);
    expect(on.startFlags).toEqual({ scepterDestroyed: true });
    expect(on.notesFired).toContain('n');
    expect(replay(lv, SEED, [], { scepterDestroyed: false }).notesFired).not.toContain('n');
  });

  it('replay with the same flags gives the same state', () => {
    const e: GameEvent[] = [{ type: 'OPEN_DOOR', door: 'd1' }];
    expect(replay(lv, SEED, e, { scepterDestroyed: true })).toEqual(
      replay(lv, SEED, e, { scepterDestroyed: true }),
    );
  });
});

describe('when a quest counts as finished', () => {
  const lv = buildLevel(
    testQuest({
      objectives: [{ id: 'o', text: 'Be brave' }],
      notes: [
        {
          id: 'br',
          trigger: { type: 'manual', label: 'Brave' },
          effects: [{ type: 'completeObjective', objective: 'o' }],
        },
      ],
      endings: [{ id: 'npc-died', label: 'The escort died' }],
    }),
  );
  const brave: GameEvent = { type: 'MANUAL_TRIGGER', note: 'br' };
  const end = (e: GameEvent[]) => questFinished(lv, replay(lv, SEED, e));

  it('is not finished before the end', () => {
    expect(end([])).toBe(false);
    expect(end([brave])).toBe(false);
  });
  it('leaving by the stairs with the goal done finishes it; with the goal undone, or falling, does not', () => {
    expect(end([brave, { type: 'END_QUEST', outcome: 'stairs' }])).toBe(true);
    expect(end([{ type: 'END_QUEST', outcome: 'stairs' }])).toBe(false);
    expect(end([brave, { type: 'END_QUEST', outcome: 'fell' }])).toBe(false);
  });
  it('one of the quest endings finishes it', () => {
    expect(end([{ type: 'END_QUEST', outcome: 'ending', ending: 'npc-died' }])).toBe(true);
  });
  it('no event is accepted after the end (so the campaign cannot change by play)', () => {
    const s = replay(lv, SEED, [brave, { type: 'END_QUEST', outcome: 'stairs' }]);
    expect(() => reduce(lv, s, { type: 'ZARGON_TURN_END' })).toThrow();
  });
});

describe('skipped quests and the journal (decision 101)', () => {
  const quest = { id: 'a', flagsOut: [] };
  const state = { flags: {}, deadHeroes: [] };
  it('a skipped quest is not next, is journaled, and can be skipped only once', () => {
    const c = skipQuest(newCampaign(pack, 1), 'a', 10);
    expect(c.skipped).toEqual(['a']);
    expect(c.journal).toEqual([{ quest: 'a', result: 'skipped', at: 10 }]);
    expect(nextQuest(pack, c)).toBe('b');
    expect(skipQuest(c, 'a', 20)).toBe(c);
  });
  it('finishing a skipped quest removes the skip and adds one journal line', () => {
    const skipped = skipQuest(newCampaign(pack, 1), 'a', 10);
    const done = finishQuest(skipped, quest, state, 30);
    expect(done.skipped).toEqual([]);
    expect(done.journal.map((j) => j.result)).toEqual(['skipped', 'won']);
    expect(finishQuest(done, quest, state, 40).journal).toHaveLength(2);
  });
  it('a finished quest cannot be skipped', () => {
    const done = finishQuest(newCampaign(pack, 1), quest, state, 30);
    expect(skipQuest(done, 'a', 40)).toBe(done);
  });
});

/** Walk-through of Frozen Horror quest 3, The Rescue (solo Barbarian: free Gothar, bring him to the stairway). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import { applyCoreFile, parseCoreFile } from '../../engine/data/coreFile';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { conditionsHold } from '../../engine/game/notes';
import { reduce, replay, startGame, type Prompt } from '../../engine/game/reducer';
import {
  availableEndings,
  endSummary,
  monstersInPlay,
  npcsInPlay,
  objectiveConfirms,
  objectivesStatus,
  trapsInView,
} from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

// The Ice Gremlin comes with the Frozen Horror library file.
applyCoreFile(
  parseCoreFile(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../library/frozen-horror.json'), 'utf8')),
  )!,
);

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'fh03-the-rescue.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({
  type: 'SEARCH_TREASURE',
  room,
  hero: 'barbarian',
  override: true,
});
const kill = (monster: string): GameEvent => ({ type: 'MONSTER_KILL', monster });
const fired = (s: ReturnType<typeof run>, id: string) => s.notesFired.includes(id);

// Walking: look along the corridors until a door is in sight (as the players do), then open it.
const reach = (base: GameEvent[], door: string): GameEvent[] => {
  const ev = [...base];
  for (let i = 0; i < 80; i++) {
    const s = run(...ev);
    if (s.seenDoors.has(door)) return [...ev, open(door)];
    const next = lookHintCells(level, s)[0];
    if (!next) break;
    ev.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`door ${door} never seen`);
};

// From the stairway: R07, door d4 to R08 (A), door d5 to the corridor of column 9.
const toR08: GameEvent[] = [open('d4')];
const toCorridor: GameEvent[] = [...toR08, open('d5')];
// Row 6 east to door d6 (R04, the tomb) and down column 16 to door d7 (R11, Gothar's room).
const toR04: GameEvent[] = reach(toCorridor, 'd6');
const toR11: GameEvent[] = reach(toCorridor, 'd7');
// The west side: row 9 to column 0, door d12 into R20 (the Ice Gremlins).
const toR20: GameEvent[] = reach(toCorridor, 'd12');
// R20 to R17 (d13), to R13 (d10), to R12 (d8, the needle chest).
const toR17: GameEvent[] = [...toR20, open('d12'), open('d13')].filter(
  (e, i, a) => a.findIndex((x) => JSON.stringify(x) === JSON.stringify(e)) === i,
);
// Row 12 east to door d11 (R18, the helmet chest).
const toR18: GameEvent[] = reach(toCorridor, 'd11');
// North: row 6, column 12 up to row 0, west to door d3 (R03, then R02 and R01).
const toR03: GameEvent[] = reach(toCorridor, 'd3');

describe('quest 3: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has the map: doors, secret doors, blocks, furniture, monsters and traps', () => {
    expect(quest.number).toBe(3);
    expect(quest.pack).toBe('frozen-horror');
    expect(quest.doors).toHaveLength(14);
    expect(quest.secretDoors.map((d) => d.id)).toEqual(['s1', 's2']);
    expect(quest.blocks).toHaveLength(4);
    expect(quest.furniture.map((f) => f.type).sort()).toEqual(
      [
        'bookcase',
        'chest',
        'chest',
        'chest',
        'cupboard',
        'rack',
        'sorcerersTable',
        'stairs',
        'tomb',
        'weaponsRack',
      ].sort(),
    );
    expect(quest.monsters).toHaveLength(25);
    const kinds = quest.traps.map((t) => t.kind);
    expect(kinds.filter((k) => k === 'pit')).toHaveLength(5);
    expect(kinds.filter((k) => k === 'wanderingTrap')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'stalactite')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'chest')).toHaveLength(1);
  });

  it('no tile of the pack is used: the map has no room tile and no board tile', () => {
    expect(quest.roomTiles).toEqual([]);
    expect(quest.boardTiles).toEqual([]);
  });

  it('every letter on the map has a note', () => {
    for (const l of ['A', 'B', 'C', 'D', 'E'])
      expect(
        quest.notes.some((n) => n.letter === l),
        `note ${l}`,
      ).toBe(true);
  });

  it('the east side of the board is rock', () => {
    expect(level.rock.has('18,2')).toBe(true); // R05
    expect(level.rock.has('20,9')).toBe(true); // corridor east of the block
    expect(level.rock.has('13,15')).toBe(true); // corridor south of the block
    expect(level.rock.has('9,9')).toBe(false);
    expect(level.rock.has('17,9')).toBe(false); // the block square is not rock
  });
});

describe('quest 3: the start', () => {
  it('the Barbarian starts on the stairway in R07, with the story and the rule to bring Gothar back', () => {
    const { state, prompts } = startGame(level, 1);
    expect(fired(state, 'n-start')).toBe(true);
    expect(JSON.stringify(prompts)).toContain('Gothar');
    expect(quest.start).toEqual({ area: 'R07' });
    expect(state.seenCells.has('1,7')).toBe(true); // the stairs
    expect(state.seenDoors.has('d4')).toBe(true);
    expect(state.seenDoors.has('d5')).toBe(false);
    expect(npcsInPlay(level, state)).toEqual([]); // Gothar is not free yet
  });

  it('the wandering monsters are 2 Orcs', () => {
    expect(quest.wandering).toEqual({ monster: 'orc', count: 2 });
  });
});

describe('quest 3: rooms and notes', () => {
  it('A: R08 holds an Abomination and a Goblin, and the weapons rack gives a battle axe', () => {
    const s = run(...toR08);
    expect(s.seenMonsters.has('m-abom-1') && s.seenMonsters.has('m-goblin-3')).toBe(true);
    expect(s.seenFurniture.has('f-weapons')).toBe(true);
    expect(fired(s, 'n-A')).toBe(false);
    const after = run(...toR08, search('R08'));
    expect(fired(after, 'n-A')).toBe(true);
    expect(JSON.stringify(quest.notes.find((n) => n.id === 'n-A'))).toContain('battle axe');
  });

  it('the corridor beyond d5 shows the wandering trap and the pit of row 6, not the pit of row 12', () => {
    const ids = trapsInView(level, run(...toCorridor)).map((t) => t.id);
    expect(ids).toContain('t-wander-1'); // (14,6), in sight along row 6
    expect(ids).not.toContain('t-pit-5'); // (16,12) is far down column 16
    expect(trapsInView(level, run(...toR11)).map((t) => t.id)).toContain('t-pit-5');
  });

  it('the tomb room R04: a Mummy and two Skeletons', () => {
    const s = run(...toR04);
    for (const id of ['m-mummy', 'm-skel-1', 'm-skel-2']) expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenFurniture.has('f-tomb')).toBe(true);
  });

  it('B: the north rooms. R03 has two Orcs and two Goblins, R02 the chest with 70 gold, R01 a Gargoyle', () => {
    const s = run(...toR03);
    for (const id of ['m-orc-1', 'm-goblin-1', 'm-goblin-2', 'm-orc-2'])
      expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenFurniture.has('f-bookcase')).toBe(true);
    const s2 = run(...toR03, open('d2'));
    expect(s2.seenFurniture.has('f-chest-b')).toBe(true);
    expect(fired(run(...toR03, open('d2'), search('R02')), 'n-B')).toBe(true);
    const s1 = run(...toR03, open('d2'), open('d1'));
    expect(s1.seenMonsters.has('m-gargoyle')).toBe(true);
    expect(s1.seenFurniture.has('f-cupboard')).toBe(true);
  });

  it('the lower west rooms: Ice Gremlins in R20, Zombies in R17', () => {
    const s = run(...toR20);
    expect(s.seenMonsters.has('m-gremlin-1') && s.seenMonsters.has('m-gremlin-2')).toBe(true);
    const s17 = run(...toR17);
    expect(s17.seenMonsters.has('m-zombie-1') && s17.seenMonsters.has('m-zombie-2')).toBe(true);
    expect(s17.seenFurniture.has('f-sorcerer')).toBe(true);
  });

  it('C: R18 has two Orcs and the chest with a helmet', () => {
    const s = run(...toR18);
    expect(s.seenMonsters.has('m-orc-6') && s.seenMonsters.has('m-orc-7')).toBe(true);
    expect(s.seenFurniture.has('f-chest-c')).toBe(true);
    expect(fired(run(...toR18, search('R18')), 'n-C')).toBe(true);
  });

  it('D: R12 has an Abomination and the needle chest worth 150 gold', () => {
    const toR13 = [...toR17, open('d10')];
    const toR12 = [...toR13, open('d8')];
    const s13 = run(...toR13);
    expect(s13.seenMonsters.has('m-goblin-4') && s13.seenMonsters.has('m-goblin-5')).toBe(true);
    const s = run(...toR12);
    expect(s.seenMonsters.has('m-abom-2')).toBe(true);
    expect(s.seenFurniture.has('f-chest-d')).toBe(true);
    const done = run(...toR12, search('R12'));
    expect(fired(done, 'n-D')).toBe(true);
    const text = JSON.stringify(quest.notes.find((n) => n.id === 'n-D'));
    expect(text).toContain('150 gold');
    // the trap is told by the trap itself, first: the treasure text does not repeat it
    expect(text).not.toMatch(/trap|sprung|Body Point/i);
  });

  it('the chest trap of D: a needle that costs 1 Body Point, springs on a search before it is disarmed', () => {
    const t = quest.traps.find((x) => x.id === 't-chest-d')!;
    expect(t.furniture).toBe('f-chest-d');
    expect(t.effect).toContain('1 Body Point');
  });
});

describe('quest 3: secret doors', () => {
  it('a search in R07 finds the secret door to R01, and a search in R13 the one to R14', () => {
    const a = run(...toR08);
    expect(a.seenDoors.has('s1')).toBe(false);
    const found1 = run(...toR08, { type: 'SEARCH_SECRET_DOORS', area: 'R07', override: true });
    expect(found1.seenDoors.has('s1')).toBe(true);
    const toR13 = [...toR17, open('d10')];
    const found2 = run(...toR13, { type: 'SEARCH_SECRET_DOORS', area: 'R13', override: true });
    expect(found2.seenDoors.has('s2')).toBe(true);
    const inside = run(
      ...toR13,
      { type: 'SEARCH_SECRET_DOORS', area: 'R13', override: true },
      open('s2'),
    );
    expect(inside.seenMonsters.has('m-dread-3')).toBe(true); // the third Dread Warrior hides in R14
  });
});

describe('quest 3: monsters keep their own kind', () => {
  it('Ice Gremlins are Frozen Horror monsters with no core picture; core monsters keep their type', () => {
    const s = run(...toR20);
    const by = (id: string) => monstersInPlay(level, s).find((m) => m.id === id)!;
    const gremlin = by('m-gremlin-1');
    expect(gremlin.name).toBe('Ice Gremlin');
    expect(gremlin.box).toBe('Frozen Horror');
    expect(gremlin.pictureType).toBeUndefined();
    expect(gremlin.profile).toBe('thief');
    const orc = monstersInPlay(level, run(...toR03)).find((m) => m.id === 'm-orc-1')!;
    expect(orc.pictureType).toBe('orc');
    expect(orc.box).toBeUndefined();
  });

  it('every other monster of the map is a core monster', () => {
    const types = new Set(quest.monsters.filter((m) => !m.enemy).map((m) => m.type));
    expect([...types].sort()).toEqual(
      [
        'abomination',
        'dreadWarrior',
        'gargoyle',
        'goblin',
        'mummy',
        'orc',
        'skeleton',
        'zombie',
      ].sort(),
    );
  });
});

describe('quest 3: Gothar and the end', () => {
  it('E: the center room shows the Dread Warriors, the rack and three Orcs behind pits', () => {
    const s = run(...toR11);
    expect(fired(s, 'n-E')).toBe(true);
    for (const id of ['m-dread-1', 'm-dread-2', 'm-orc-3', 'm-orc-4', 'm-orc-5'])
      expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenFurniture.has('f-rack')).toBe(true);
    expect(s.seenMonsters.has('m-dread-3')).toBe(false); // the third one is in the secret room
    const ids = trapsInView(level, s).map((t) => t.id);
    expect(ids).toContain('t-pit-2');
    expect(npcsInPlay(level, s)).toEqual([]);
  });

  it('killing only one of the two Dread Warriors of R11 does not free Gothar', () => {
    const s = run(...toR11, kill('m-dread-1'));
    expect(fired(s, 'n-gothar-freed')).toBe(false);
    expect(s.flags['gotharFree']).toBeUndefined();
    expect(objectivesStatus(level, s).items.find((o) => o.id === 'o1')?.done).toBe(false);
  });

  it('killing the third Dread Warrior (R14) does not count', () => {
    const toR13 = [...toR17, open('d10')];
    const secret: GameEvent[] = [
      ...toR13,
      { type: 'SEARCH_SECRET_DOORS', area: 'R13', override: true },
      open('s2'),
    ];
    const s = run(...secret, kill('m-dread-3'));
    expect(fired(s, 'n-gothar-freed')).toBe(false);
  });

  it('killing both does not free Gothar by itself: the action "Free Gothar" does', () => {
    const both = run(...toR11, kill('m-dread-1'), kill('m-dread-2'));
    expect(fired(both, 'n-gothar-freed')).toBe(false);
    expect(both.flags['gotharFree']).toBeUndefined();
    // the action is offered only when both are dead
    const note = quest.notes.find((n) => n.id === 'n-gothar-freed')!;
    expect(conditionsHold(level, both, note)).toBe(true);
    expect(conditionsHold(level, run(...toR11, kill('m-dread-1')), note)).toBe(false);
  });

  it('the action frees Gothar: the NPC joins, with his stats, and the goal can be confirmed', () => {
    const before = run(...toR11, kill('m-dread-1'), kill('m-dread-2'));
    const r = reduce(level, before, { type: 'MANUAL_TRIGGER', note: 'n-gothar-freed' });
    expect(fired(r.state, 'n-gothar-freed')).toBe(true);
    expect(r.state.flags['gotharFree']).toBe(true);
    expect(r.prompts.some((p: Prompt) => p.kind === 'npcSpawned')).toBe(true);
    expect(npcsInPlay(level, r.state).find((n) => n.id === 'gothar')).toMatchObject({
      name: 'Gothar',
      move: 6,
      attack: 1,
      defend: 2,
      body: 2,
    });
    expect(objectivesStatus(level, r.state).items.find((o) => o.id === 'o1')?.done).toBe(true);
    expect(objectivesStatus(level, r.state).goalDone).toBe(false);
    expect(objectiveConfirms(level, r.state).map((c) => c.objective)).toContain('o2');
  });

  it('the stairway button only shows once Gothar is free', () => {
    expect(objectiveConfirms(level, run(...toR11))).toEqual([]);
  });

  it('confirming that Gothar is on the stairway wins the quest', () => {
    const free = reduce(level, run(...toR11, kill('m-dread-1'), kill('m-dread-2')), {
      type: 'MANUAL_TRIGGER',
      note: 'n-gothar-freed',
    }).state;
    const done = reduce(level, free, { type: 'CONFIRM_OBJECTIVE', objective: 'o2' }).state;
    expect(objectivesStatus(level, done).goalDone).toBe(true);
    const end = reduce(level, done, { type: 'END_QUEST', outcome: 'stairs' }).state;
    expect(endSummary(level, end)).toMatchObject({ outcome: 'stairs', won: true });
  });

  it('has the ending "Gothar was captured": not a win', () => {
    expect(availableEndings(level).map((e) => e.id)).toEqual(['gothar-captured']);
    const s = reduce(level, run(...toR11), {
      type: 'END_QUEST',
      outcome: 'ending',
      ending: 'gothar-captured',
    }).state;
    expect(endSummary(level, s)).toMatchObject({
      outcome: 'ending',
      ending: { label: 'Gothar was captured' },
      won: false,
    });
  });

  it('the note on Gothar says monsters go only for the Barbarian', () => {
    const start = JSON.stringify(quest.notes.find((n) => n.id === 'n-start'));
    expect(start).toContain('only for the Barbarian');
    expect(quest.npcs[0]?.text).toContain('Monsters never attack him');
  });
});

describe('quest 3: hazards', () => {
  it('a wandering monster trap brings 2 Orcs next to the hero and works only once', () => {
    const s = run(...toR20);
    // (0,12) is on the corridor of column 0, seen on the way to d12
    expect(trapsInView(level, s).some((t) => t.id === 't-wander-2')).toBe(true);
    const r = reduce(level, s, { type: 'TRAP_STEP', trap: 't-wander-2' });
    const sprung = r.prompts.find((p: Prompt) => p.kind === 'trapSprung') as
      { spawned?: { monster: string; monsterType: string }[] } | undefined;
    expect(sprung?.spawned).toEqual([
      { monster: 'w1', monsterType: 'orc' },
      { monster: 'w2', monsterType: 'orc' },
    ]);
    expect(Object.keys(r.state.wanderers)).toEqual(['w1', 'w2']);
  });

  it('the stalactite is seen at (9,9) on the corridor', () => {
    const s = run(...toCorridor);
    expect(trapsInView(level, s).some((t) => t.id === 't-stalactite')).toBe(true);
  });
});

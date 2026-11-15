/** Walk-through of quest 10, Castle of Mystery: teleporting doors, ring after both Dread warriors (A), fool's gold mine (B). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import { objectivesStatus } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q10-castle-of-mystery.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
// A choice option is the dice total minus 2 (totals 2..12).
const choose = (door: string, total: number): GameEvent => ({
  type: 'CHOOSE',
  note: `n-tele-${door}`,
  option: total - 2,
});
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (
  room: string,
  override = false,
  hero: 'barbarian' | 'dwarf' = 'barbarian',
): GameEvent => ({
  type: 'SEARCH_TREASURE',
  room,
  hero,
  ...(override ? { override: true } : {}),
});
const count = (type: string) => quest.monsters.filter((m) => m.type === type).length;
const areaOf = (c: [number, number]) => board.cells[c[1]]?.[c[0]];
// Leave the start room by d10, roll `total`: the destination room is revealed.
const teleport = (total: number): GameEvent[] => [open('d10'), choose('d10', total)];

describe('quest 10: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('monster types match the map: 2 zombies, 4 skeletons, 2 mummies, 5 orcs, 4 goblins, 3 Dread warriors', () => {
    expect([
      count('zombie'),
      count('skeleton'),
      count('mummy'),
      count('orc'),
      count('goblin'),
      count('dreadWarrior'),
    ]).toEqual([2, 4, 2, 5, 4, 3]);
    expect(quest.monsters).toHaveLength(20);
    expect(count('abomination') + count('gargoyle')).toBe(0);
  });

  it('has 10 doors, no secret or false doors, no blocks, no traps, no furniture except the stairs', () => {
    expect(quest.doors).toHaveLength(10);
    expect(quest.secretDoors).toEqual([]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toEqual([]);
    expect(quest.traps).toEqual([]);
    expect(quest.furniture.map((f) => f.type)).toEqual(['stairs']);
    expect(quest.start).toEqual({ area: 'R20' });
  });

  it('the numbered squares 2/12 and 3 to 11 are markers inside lit rooms', () => {
    expect(quest.markers.map((m) => m.label).sort()).toEqual(
      ['2/12', '3', '4', '5', '6', '7', '8', '9', '10', '11'].sort(),
    );
    expect(quest.rules.doorTeleport).toEqual({ dice: '2red', squares: 'markers' });
    expect(quest.markers.find((m) => m.label === '7')?.cell).toEqual([15, 9]);
    expect(areaOf([15, 9])).toBe('R11');
  });

  it('the ghost of Ollar is the wandering monster (text, no figure)', () => {
    expect(quest.wandering).toHaveProperty('text');
  });
});

describe('quest 10: the teleporting doors', () => {
  it('starts in R20 with the stairs and only door d10 known; the start note explains the doors', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R20']));
    expect(s.seenDoors).toEqual(new Set(['d10']));
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
    const start = quest.notes.find((n) => n.trigger.type === 'questStart')!;
    const t = start.effects.find((e) => e.type === 'showText') as { text: string };
    expect(t.text).toContain('2 red dice');
    expect(t.text).toContain('1 Body Point');
    expect(t.text).toContain('single door in a turn');
    expect(t.text).toContain('marked 2/12 is inside the start room');
  });

  it('every door has a teleport choice with 11 totals', () => {
    for (const d of quest.doors) {
      const n = quest.notes.find((x) => x.id === `n-tele-${d.id}`)!;
      expect(n.trigger).toEqual({ type: 'doorOpened', door: d.id });
      const c = n.effects.find((e) => e.type === 'promptChoice') as { options: unknown[] };
      expect(c.options).toHaveLength(11);
    }
  });

  it('opening d10 asks for the total; nothing is revealed until it is chosen', () => {
    const r = reduce(level, initialState(level, 1), open('d10'));
    expect(r.prompts.find((p) => p.kind === 'choice')).toMatchObject({
      kind: 'choice',
      noteId: 'n-tele-d10',
    });
    // R12 is the one open square beyond d10 (no monsters).
    expect(r.state.revealedRooms).toEqual(new Set(['R20', 'R12']));
    expect(r.state.seenMonsters.size).toBe(0);
  });

  it('total 3 shows R03: skeleton and two zombies, and door d1', () => {
    const s = run(...teleport(3));
    expect(s.revealedRooms.has('R03')).toBe(true);
    const seen = quest.monsters.filter((m) => s.seenMonsters.has(m.id)).map((m) => m.type);
    expect(seen.sort()).toEqual(['skeleton', 'zombie', 'zombie']);
    expect(s.seenDoors.has('d1')).toBe(true);
  });

  it('each total reveals the room of its numbered square', () => {
    const rooms: Record<number, string> = {
      3: 'R03',
      4: 'R07',
      5: 'R13',
      6: 'R18',
      7: 'R11',
      8: 'R04',
      9: 'R19',
      10: 'R16',
      11: 'R06',
    };
    for (const [total, room] of Object.entries(rooms)) {
      const s = run(...teleport(Number(total)));
      expect(s.revealedRooms.has(room)).toBe(true);
      const marker = quest.markers.find((m) => m.label === total)!;
      expect(areaOf(marker.cell)).toBe(room);
    }
  });

  it('totals 7 and 9 show 4 goblins, and a mummy with 3 skeletons', () => {
    const s7 = run(...teleport(7));
    expect(quest.monsters.filter((m) => s7.seenMonsters.has(m.id)).map((m) => m.type)).toEqual([
      'goblin',
      'goblin',
      'goblin',
      'goblin',
    ]);
    const s9 = run(...teleport(9));
    const seen = quest.monsters.filter((m) => s9.seenMonsters.has(m.id)).map((m) => m.type);
    expect(seen.sort()).toEqual(['mummy', 'skeleton', 'skeleton', 'skeleton']);
  });

  it('totals 4, 11, 5, 6 show 2 orcs, 3 orcs, one Dread warrior, one mummy', () => {
    const types = (total: number) => {
      const s = run(...teleport(total));
      return quest.monsters.filter((m) => s.seenMonsters.has(m.id)).map((m) => m.type);
    };
    expect(types(4)).toEqual(['orc', 'orc']);
    expect(types(11)).toEqual(['orc', 'orc', 'orc']);
    expect(types(5)).toEqual(['dreadWarrior']);
    expect(types(6)).toEqual(['mummy']);
  });

  it('totals 2 and 12 send the hero to the stairs square: nothing new', () => {
    for (const t of [2, 12]) {
      const s = run(...teleport(t));
      expect(s.revealedRooms).toEqual(new Set(['R20', 'R12']));
      expect(s.seenMonsters.size).toBe(0);
    }
  });

  it('a door seen after a teleport asks again: d9 from R16 leads on by the next total', () => {
    const s = run(...teleport(10), open('d9'), choose('d9', 9));
    expect(s.openDoors.has('d9')).toBe(true);
    expect(s.revealedRooms.has('R19')).toBe(true);
  });

  it('never reveals the rock rooms', () => {
    const s = run(...teleport(3), open('d1'), choose('d1', 11), open('d3'), choose('d3', 6));
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 10: the 2/12 square', () => {
  it('is in the start room just inside door d10, not on the stairs', () => {
    const k = quest.markers.find((m) => m.label === '2/12')!;
    const d = quest.doors.find((x) => x.id === 'd10')!;
    expect(k.cell).toEqual([4, 14]);
    expect(areaOf(k.cell)).toBe('R20');
    expect([d.a, d.b]).toContainEqual(k.cell);
    const stairs = quest.furniture.find((f) => f.type === 'stairs')!;
    expect(stairs.cells).not.toContainEqual(k.cell);
  });
});

describe('quest 10: letter A (the Ring of Return)', () => {
  const inRoom = [...teleport(10)];
  it('the two Dread warriors of R16 stand next to the A', () => {
    expect(quest.monsters.find((m) => m.id === 'm-dw-a1')?.cell).toEqual([22, 11]);
    expect(quest.monsters.find((m) => m.id === 'm-dw-a2')?.cell).toEqual([24, 12]);
    expect(areaOf([22, 11])).toBe('R16');
    expect(areaOf([24, 12])).toBe('R16');
  });

  it('a search before both are dead does not give the ring', () => {
    const r = reduce(level, run(...inRoom), search('R16', true));
    expect(r.prompts.find((p) => p.kind === 'note')).toBeUndefined();
    const one = run(...inRoom, { type: 'MONSTER_KILL', monster: 'm-dw-a1' });
    expect(
      reduce(level, one, search('R16', true)).prompts.find((p) => p.kind === 'note'),
    ).toBeUndefined();
  });

  it('with both dead, the first search gives the ring, the second does not', () => {
    const s = run(
      ...inRoom,
      { type: 'MONSTER_KILL', monster: 'm-dw-a1' },
      { type: 'MONSTER_KILL', monster: 'm-dw-a2' },
    );
    const r = reduce(level, s, search('R16', true));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-A',
      letter: 'A',
      at: [23, 11],
      consumesTreasure: true,
    });
    const again = reduce(level, r.state, search('R16', true, 'dwarf'));
    expect(again.prompts.find((p) => p.kind === 'note')).toBeUndefined();
  });

  it('the Dread warrior of R13 does not count for the ring', () => {
    const s = run(...teleport(5), { type: 'MONSTER_KILL', monster: 'm13' });
    expect(s.seenMonsters.has('m13')).toBe(true);
    expect(quest.notes.find((n) => n.id === 'n-A')?.when).toEqual([
      { monster: 'm-dw-a1', alive: false },
      { monster: 'm-dw-a2', alive: false },
      { firstTime: true },
    ]);
  });
});

describe("quest 10: letter B (the mine, fool's gold)", () => {
  it('B sits on the boxed square in R04 and fires when a hero is there', () => {
    const b = quest.notes.find((n) => n.letter === 'B')!;
    expect(b.at).toEqual([14, 4]);
    expect(areaOf([14, 4])).toBe('R04');
    const s = run(...teleport(8));
    const r = reduce(level, s, { type: 'SQUARE_TRIGGER', cell: [14, 4] });
    const p = r.prompts.find((x) => x.kind === 'note') as unknown as { noteId: string };
    expect(p.noteId).toBe('n-B');
    const text = JSON.stringify(b.effects);
    expect(text).toContain('5,000');
    expect(text).not.toContain("fool's");
    expect(quest.zargonInfo).not.toContain("fool's");
    expect(quest.intro.summary).not.toContain('fool');
    expect(quest.rewards).toContain("fool's gold");
  });

  it('the quest ends when all monsters are dead (or by the stairs)', () => {
    const s0 = run(...teleport(8));
    expect(objectivesStatus(level, s0).goalDone).toBe(false);
    // Chain the doors: d10 -> 3, d1 -> 4, d4 -> 5, d6 -> 6, d7 -> 7, d5 -> 8, d2 -> 9, d8 -> 10, d9 -> 11.
    const chain: GameEvent[] = [];
    [
      ['d10', 3],
      ['d1', 4],
      ['d4', 5],
      ['d6', 6],
      ['d7', 7],
      ['d5', 8],
      ['d2', 9],
      ['d8', 10],
      ['d9', 11],
    ].forEach(([d, t]) => chain.push(open(d as string), choose(d as string, t as number)));
    const seenAll = run(...chain);
    for (const m of quest.monsters) expect(seenAll.seenMonsters.has(m.id)).toBe(true);
    const kills: GameEvent[] = quest.monsters.map((m) => ({ type: 'MONSTER_KILL', monster: m.id }));
    const s = run(...chain, ...kills);
    expect(objectivesStatus(level, s).goalDone).toBe(true);
  });
});

/** Walk-through of quest 8, The Fire Mage: Balur, six spells once each, escape to XX only after the center door opens, chest A. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel, cellKey } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import { dormantFigures, objectivesStatus } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q08-the-fire-mage.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({ type: 'SEARCH_TREASURE', room, hero: 'barbarian' });
const cast = (spell: string): GameEvent => ({ type: 'SPELL_CAST', monster: 'm-balur', spell });
const monster = (id: string) => quest.monsters.find((m) => m.id === id);
const count = (type: string) => quest.monsters.filter((m) => m.type === type).length;
// Blocked squares seal the corridor ring: from the stairs room the only way on is north around row 0
// to door d1 (Balur's room), then south through R07 to the main corridors. This helper looks along
// the corridors, and when nothing new can be seen it opens the seen doors in order (never d10 early).
const seeing = (door: string): GameEvent[] => {
  const out: GameEvent[] = [open('d16')];
  const opened = new Set(['d16']);
  const searched = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const s = run(...out);
    if (s.seenDoors.has(door)) return out;
    const next = lookHintCells(level, s)[0];
    if (next) {
      out.push({ type: 'LOOK_FROM', cell: next });
      continue;
    }
    const d = [...quest.doors, ...quest.secretDoors].find(
      (x) => s.seenDoors.has(x.id) && !opened.has(x.id) && x.id !== 'd10',
    );
    if (d) {
      opened.add(d.id);
      out.push(open(d.id));
      continue;
    }
    // The sealed corridors can only be left through the two secret doors: search from either side.
    let did = false;
    for (const x of quest.secretDoors) {
      if (searched.has(x.id)) continue;
      const c = [x.a, x.b].find((p) => areaOf(p) === 'C')!;
      const r = [x.a, x.b].find((p) => areaOf(p) !== 'C')!;
      if (s.seenCells.has(cellKey(c[0], c[1]))) {
        out.push({ type: 'SEARCH_SECRET_DOORS', cell: [c[0], c[1]], override: true });
      } else if (s.revealedRooms.has(areaOf(r)!)) {
        out.push({ type: 'SEARCH_SECRET_DOORS', area: areaOf(r), override: true });
      } else continue;
      searched.add(x.id);
      did = true;
      break;
    }
    if (!did) break;
  }
  throw new Error(`door ${door} never seen`);
};
const via = (door: string): GameEvent[] => [...seeing(door), open(door)];
const areaOf = (c: readonly number[]) => board.cells[c[1]!]?.[c[0]!];
const noteIds = (prompts: readonly { kind: string }[]) =>
  prompts.filter((p) => p.kind === 'note').map((p) => (p as unknown as { noteId: string }).noteId);

describe('quest 8: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 16 doors, 2 secret doors, 9 blocks, 4 pits, 6 spear traps, wandering abomination', () => {
    expect(quest.doors).toHaveLength(16);
    expect(quest.secretDoors.map((s) => [s.a, s.b])).toEqual([
      [
        [7, 9],
        [7, 10],
      ],
      [
        [8, 12],
        [9, 12],
      ],
    ]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(9);
    expect(quest.traps.filter((t) => t.kind === 'pit')).toHaveLength(4);
    expect(quest.traps.filter((t) => t.kind === 'spear')).toHaveLength(6);
    expect(quest.wandering).toEqual({ monster: 'abomination' });
    expect(quest.start).toEqual({ area: 'R10' });
  });

  it('has 5 zombies, 11 skeletons, 2 mummies, 6 orcs and Balur', () => {
    expect(count('zombie')).toBe(5);
    expect(count('skeleton')).toBe(11);
    expect(count('mummy')).toBe(2);
    expect(count('orc')).toBe(6);
    expect(count('dreadSorcerer')).toBe(1);
    expect(quest.monsters).toHaveLength(25);
  });

  it('Balur is a Dread sorcerer 8 / 2 / 5 / 3 / 7 with six spells once each, one per turn', () => {
    const b = monster('m-balur')!;
    expect(b).toMatchObject({
      type: 'dreadSorcerer',
      name: 'Balur',
      cell: [2, 3],
      hidden: true,
      overrides: { move: 8, att: 2, def: 5, body: 3, mind: 7 },
      spellLimit: 'onePerTurn',
    });
    expect([...b.spells!].sort()).toEqual(
      ['ballOfFlame', 'escape', 'fear', 'firestorm', 'summon', 'tempest'].sort(),
    );
    expect(b.abilities).toEqual(['fireImmune']);
    expect(b.special).toBe(true);
    expect(new Set(b.spells).size).toBe(6);
    expect(areaOf(b.cell!)).toBe('R01');
  });

  it('XX is in the center room R11 and the markers are editor-only', () => {
    const xx = quest.markers.find((m) => m.label === 'XX')!;
    expect(areaOf(xx.cell)).toBe('R11');
    expect(xx.visible).toBe('editor');
  });
});

describe('quest 8: walk-through', () => {
  it('starts in the stairs room R10 and sees nothing else', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R10']));
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
    expect(s.seenDoors.has('d16')).toBe(true);
  });

  it('d10 shows the center room R11: mummies, zombies, bookcases, sorcerer table', () => {
    const s = run(...via('d10'));
    expect(s.revealedRooms.has('R11')).toBe(true);
    for (const m of ['m17', 'm18', 'm4', 'm5']) expect(s.seenMonsters.has(m)).toBe(true);
    for (const f of ['f-bookcase-n', 'f-bookcase-s', 'f-sorcerer'])
      expect(s.seenFurniture.has(f)).toBe(true);
    expect(s.placedMonsterCells['m-balur']).toEqual([2, 3]);
  });

  it('d11 and d15 show R15 and the chest room R16 with two orcs', () => {
    const r15 = run(...via('d11'));
    expect(r15.revealedRooms.has('R15')).toBe(true);
    const r16 = run(...via('d15'));
    expect(r16.revealedRooms.has('R16')).toBe(true);
    expect(r16.seenFurniture.has('f-chest')).toBe(true);
    expect(r16.seenMonsters.has('m19')).toBe(true);
    expect(r16.seenMonsters.has('m20')).toBe(true);
  });

  it('d12 shows R21 and d14 shows R19 with its table', () => {
    const r21 = run(...via('d12'));
    expect(r21.revealedRooms.has('R21')).toBe(true);
    expect(r21.seenMonsters.has('m22')).toBe(true);
    expect(r21.seenMonsters.has('m24')).toBe(true);
    const r19 = run(...via('d14'));
    expect(r19.revealedRooms.has('R19')).toBe(true);
    expect(r19.seenFurniture.has('f-table')).toBe(true);
    expect(r19.seenMonsters.has('m21')).toBe(true);
    expect(r19.seenMonsters.has('m23')).toBe(true);
    // two long walk-throughs in one test: a slow, busy machine needs more than the default 5 s
  }, 30_000);

  it("d1 shows Balur's room R01: four skeletons, and Balur is put on X", () => {
    const s = run(...via('d1'));
    expect(s.revealedRooms.has('R01')).toBe(true);
    for (const m of ['m6', 'm7', 'm8', 'm9']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenMonsters.has('m-balur')).toBe(true);
    expect(s.placedMonsterCells['m-balur']).toEqual([2, 3]);
  });

  it('d3, d5 and d6 reach R07, R12 and R20', () => {
    const r07 = run(...via('d3'));
    expect(r07.revealedRooms.has('R07')).toBe(true);
    expect(r07.seenMonsters.has('m3')).toBe(true);
    const r12 = run(...via('d5'));
    expect(r12.revealedRooms.has('R12')).toBe(true);
    expect(r12.seenMonsters.has('m10')).toBe(true);
    const r20 = run(...via('d6'));
    expect(r20.revealedRooms.has('R20')).toBe(true);
    expect(r20.seenMonsters.has('m12')).toBe(true);
  });

  it('the secret doors lead into the small room R14, revealed once one is opened', () => {
    const s = run(...via('s2'));
    expect(s.revealedRooms.has('R14')).toBe(true);
    expect(s.seenDoors.has('s1')).toBe(true);
    expect(s.openDoors.has('s2')).toBe(true);
  });

  it('d8 shows the skeleton room R17', () => {
    const s = run(...via('d8'));
    expect(s.revealedRooms.has('R17')).toBe(true);
    expect(s.seenMonsters.has('m14')).toBe(true);
  });

  it('never reveals rock rooms', () => {
    const s = run(...via('d15'));
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 8: Balur and the escape spell', () => {
  const inRoom = [...via('d1')];

  it('each spell is castable once', () => {
    const s = run(...inRoom, cast('fear'));
    expect(s.spellsCast['m-balur']).toContain('fear');
  });

  it('Balur is offered escape first', () => {
    expect(quest.monsters.find((m) => m.id === 'm-balur')?.spellOrder).toEqual({ escape: 1 });
  });

  it('a spell cannot be cast twice, even in a later turn', () => {
    const s = run(...inRoom, cast('fear'), { type: 'ZARGON_TURN_END' });
    expect(() => reduce(level, s, cast('fear'))).toThrow(/already cast/);
    expect(() => reduce(level, s, cast('tempest'))).not.toThrow();
  });

  it('escape before the center door opens: Balur is set aside and the flag is set', () => {
    const r = reduce(level, run(...inRoom), cast('escape'));
    expect(r.state.flags['escaped']).toBe(true);
    expect(r.state.monsterStates['m-balur']?.state).toBe('away');
    // Nothing stays on the map where he stood (no statue figure).
    expect(dormantFigures(level, r.state).some((f) => f.id === 'm-balur')).toBe(false);
    expect(noteIds(r.prompts)).toEqual(['n-escape-closed']);
  });

  it('opening the center door afterwards places Balur on XX and wakes him', () => {
    const s = run(...seeing('d10'), cast('escape'));
    const r = reduce(level, s, open('d10'));
    expect(r.state.placedMonsterCells['m-balur']).toEqual([12, 9]);
    expect(r.state.monsterStates['m-balur']?.state).toBe('active');
    expect(noteIds(r.prompts)).toContain('n-balur-xx');
  });

  it('escape after the center door is open puts him on XX at once', () => {
    const s = run(...via('d10'));
    const r = reduce(level, s, cast('escape'));
    expect(r.state.placedMonsterCells['m-balur']).toEqual([12, 9]);
    expect(r.state.monsterStates['m-balur']?.state).not.toBe('dormant');
    expect(noteIds(r.prompts)).toEqual(['n-escape-open']);
  });

  it('other spells do not move him', () => {
    const s = run(...inRoom, cast('tempest'));
    expect(s.flags['escaped']).toBeUndefined();
    expect(s.placedMonsterCells['m-balur']).toEqual([2, 3]);
  });

  it('killing Balur completes the objective', () => {
    const s = run(...inRoom);
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const r = reduce(level, s, { type: 'MONSTER_KILL', monster: 'm-balur' });
    expect(objectivesStatus(level, r.state).goalDone).toBe(true);
  });
});

describe('quest 8: letter A', () => {
  it('searching R16 first gives the chest: 150 gold and the Wand of Magic, no card drawn', () => {
    const n = quest.notes.find((x) => x.letter === 'A')!;
    expect(n.trigger).toEqual({ type: 'treasureSearch', area: 'R16', first: true });
    expect(n.at).toEqual([21, 10]);
    const s = run(
      ...via('d15'),
      { type: 'MONSTER_KILL', monster: 'm19' },
      { type: 'MONSTER_KILL', monster: 'm20' },
    );
    const r = reduce(level, s, search('R16'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-A',
      letter: 'A',
      consumesTreasure: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
    const gift = n.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('150');
    expect(gift.text).toContain('Wand of Magic');
  });
});

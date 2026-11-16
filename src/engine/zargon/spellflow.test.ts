import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import {
  CORE_SPELLS,
  SPELL_TAG_IDS,
  SPELL_TAG_QUESTIONS,
  spellLookup,
  spellQuestions,
} from '../data/spells';
import type { GameEvent } from '../game/events';
import { replay } from '../game/reducer';
import { parseQuest } from '../quest/loader';
import { testQuest, testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { ordersFor } from './orders';

const TEAM = ['barbarian', 'elf'] as const;
const seen: GameEvent[] = [{ type: 'OPEN_DOOR', door: 'd2' }];

const caster = (spells: string[], extra: Record<string, unknown> = {}) => ({
  id: 'g',
  type: 'gargoyle',
  cell: [8, 16],
  name: 'Grak',
  spells,
  ...extra,
});
const levelWith = (monsters: unknown[], patch: Record<string, unknown> = {}) =>
  buildLevel(testQuest({ notes: [], monsters, ...patch }));
const orderAt = (lv: ReturnType<typeof levelWith>, seed: number, turns = 0) => {
  const events = [...seen, ...Array<GameEvent>(turns).fill({ type: 'ZARGON_TURN_END' })];
  return ordersFor(lv, replay(lv, seed, events), [...TEAM]).find((o) => o.monster === 'g')!;
};

describe('spell data (decisions 47, 48, 70)', () => {
  it('every tag has a question, every core spell has tags or its own question', () => {
    for (const t of SPELL_TAG_IDS) expect(SPELL_TAG_QUESTIONS[t].length).toBeGreaterThan(5);
    for (const s of CORE_SPELLS)
      expect(s.tags.length > 0 || s.question !== undefined, s.id).toBe(true);
    expect(new Set(CORE_SPELLS.map((s) => s.id)).size).toBe(CORE_SPELLS.length);
  });

  it('the core table follows the tag table', () => {
    const tags = (id: string) => spellLookup(undefined).get(id)?.tags;
    expect(tags('sleep')).toEqual(['strongAdjacent', 'strongInSight']);
    expect(tags('ballOfFlame')).toEqual(['any']);
    expect(tags('summon')).toEqual(['manyInSight', 'selfHurt']);
    expect(spellLookup(undefined).get('escape')?.offerWhen).toBe('escapePoint');
    expect(spellLookup(undefined).get('firestorm')?.warning).toMatch(/monsters in the room/);
    expect(spellQuestions(spellLookup(undefined).get('rust')!)).toEqual([
      'Does a hero in sight carry a metal sword or helmet that is not an artifact?',
    ]);
    expect(spellQuestions(spellLookup(undefined).get('fear')!)).toEqual([
      SPELL_TAG_QUESTIONS.strongAdjacent,
      SPELL_TAG_QUESTIONS.strongInSight,
    ]);
  });

  it('a quest spell is added to the lookup, and cannot reuse a core id', () => {
    const q = parseQuest({
      ...testQuestData,
      spellDefs: [
        { id: 'mud', name: 'Mud', text: 'The floor turns to mud.', tags: ['heroAdjacent'] },
      ],
    });
    expect(spellLookup(q).get('mud')).toMatchObject({ name: 'Mud', core: false });
    const clash = parseQuest({
      ...testQuestData,
      spellDefs: [{ id: 'fear', name: 'x', tags: ['any'] }],
    });
    expect(validateQuest(clash, board).some((m) => m.includes('spell fear'))).toBe(true);
  });

  it('a spell needs tags or a question, and the validator knows quest spells', () => {
    expect(() =>
      parseQuest({ ...testQuestData, spellDefs: [{ id: 'x', name: 'X', tags: [] }] }),
    ).toThrow();
    const q = parseQuest({
      ...testQuestData,
      spellDefs: [{ id: 'mud', name: 'Mud', question: 'Is it raining?' }],
      monsters: [{ id: 'm1', type: 'gargoyle', cell: [6, 15], spells: ['mud'] }],
    });
    expect(validateQuest(q, board).filter((m) => m.includes('spell'))).toEqual([]);
    const bad = parseQuest({
      ...testQuestData,
      monsters: [{ id: 'm1', type: 'gargoyle', cell: [6, 15], spells: ['nope'] }],
    });
    expect(validateQuest(bad, board).some((m) => m.includes('unknown spell "nope"'))).toBe(true);
  });
});

describe('the spell flow of a caster (decisions 47 and 48)', () => {
  it('shows the question of the tag, and the warning of the spell', () => {
    const lv = levelWith([caster(['firestorm'])]);
    let o = orderAt(lv, 1);
    for (let seed = 2; !o.spell && seed < 40; seed++) o = orderAt(lv, seed);
    expect(o.spell?.questions).toEqual([SPELL_TAG_QUESTIONS.heroesInSameRoom]);
    expect(o.spell?.warning).toMatch(/does not work in corridors/);
    expect(o.spell?.effect).toBe('Read the Dread spell card.');
  });

  it('several tags give several questions; a custom question replaces them', () => {
    const lv = levelWith([caster(['sleep'])]);
    let o = orderAt(lv, 1);
    for (let seed = 2; !o.spell && seed < 40; seed++) o = orderAt(lv, seed);
    expect(o.spell?.questions).toHaveLength(2);
    const own = levelWith([caster(['mud'])], {
      spellDefs: [
        { id: 'mud', name: 'Mud', text: 'The floor turns to mud.', question: 'Is it raining?' },
      ],
    });
    let p = orderAt(own, 1);
    for (let seed = 2; !p.spell && seed < 40; seed++) p = orderAt(own, seed);
    expect(p.spell?.questions).toEqual(['Is it raining?']);
    expect(p.spell?.effect).toBe('The floor turns to mud.');
    expect(p.spell?.name).toBe('Mud');
  });

  it('about one turn in four has no spell, always the same for the same seed and turn', () => {
    const lv = levelWith([caster(['fear', 'sleep'])]);
    let none = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const o = orderAt(lv, seed);
      if (!o.spell) {
        none++;
        expect(o.spellNote).toBe('This turn it casts no spell: it uses its normal plan.');
        expect(o.plan).toBeDefined(); // the normal plan stays
      }
      expect(orderAt(lv, seed).spell).toEqual(o.spell);
    }
    expect(none).toBeGreaterThan(30);
    expect(none).toBeLessThan(70);
  });

  it('Escape is only offered when the quest has an escape point', () => {
    const without = levelWith([caster(['escape'])]);
    for (let seed = 1; seed <= 40; seed++) {
      const o = orderAt(without, seed);
      expect(o.spell).toBeUndefined();
    }
    const withPoint = levelWith([caster(['escape'])], {
      notes: [
        {
          id: 'n-esc',
          trigger: { type: 'spellCast', monster: 'g', spell: 'escape' },
          effects: [{ type: 'showText', text: 'It vanishes.' }],
        },
      ],
    });
    let offered = false;
    for (let seed = 1; seed <= 40; seed++)
      offered = offered || orderAt(withPoint, seed).spell?.spell === 'escape';
    expect(offered).toBe(true);
  });

  it('after three "no" answers it uses its normal plan', () => {
    const lv = levelWith([caster(['fear', 'sleep', 'tempest', 'command'])]);
    let seed = 1;
    while (!orderAt(lv, seed).spell && seed < 60) seed++;
    let events: GameEvent[] = [...seen];
    for (let i = 0; i < 3; i++) {
      const o = ordersFor(lv, replay(lv, seed, events), [...TEAM]).find((x) => x.monster === 'g')!;
      events = [...events, { type: 'SPELL_FAILED', monster: 'g', spell: o.spell!.spell }];
    }
    const last = ordersFor(lv, replay(lv, seed, events), [...TEAM]).find((x) => x.monster === 'g')!;
    expect(last.spell).toBeUndefined();
    expect(last.spellNote).toBe('Three spells could not be cast: it uses its normal plan.');
    expect(last.plan).toBeDefined();
  });
});

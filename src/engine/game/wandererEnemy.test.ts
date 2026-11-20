import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { ordersFor } from '../zargon/orders';
import { reduce, replay } from './reducer';
import { monstersInPlay } from './view';

// A wandering monster that is an enemy of the quest: an Ice Gremlin, not a goblin.
const gremlin = {
  id: 'gremlin',
  name: 'Ice Gremlin',
  letter: 'IG',
  expansion: 'Frozen Horror',
  overrides: { move: 10, att: 2, def: 3, body: 3, mind: 3 },
  profile: 'thief',
  weights: { closest: 3 },
};
const make = () =>
  buildLevel(
    parseQuest({
      ...testQuestData,
      enemyDefs: [gremlin],
      wandering: { monster: 'goblin', enemy: 'gremlin' },
    }),
  );

describe('a wandering monster that is a quest enemy', () => {
  const lv = make();
  const open = replay(lv, 1, [{ type: 'OPEN_DOOR', door: 'd1' }]);
  const asked = reduce(lv, open, {
    type: 'WANDERING_MONSTER',
    room: 'R20',
    hero: 'dwarf',
  });

  it('has the enemy stats, name, plan and box, not the carrier type', () => {
    const v = monstersInPlay(lv, asked.state).find((m) => m.id === 'w1')!;
    expect(v.name).toBe('Ice Gremlin');
    expect(v.stats).toMatchObject({ move: 10, att: 2, def: 3, body: 3 });
    expect(v.body).toBe(3);
    expect(v.profile).toBe('thief');
    expect(v.box).toBe('Frozen Horror');
    expect(v.pictureType).toBeUndefined(); // no goblin picture from a texture pack
    expect(v.enemy).toBe('gremlin'); // a pack may give this enemy its own picture
  });

  it('tells the players its name and attack dice', () => {
    const p = asked.prompts.find((x) => x.kind === 'wanderingMonster');
    expect(p).toMatchObject({ name: 'Ice Gremlin', attackDice: 2 });
  });

  it('gets orders with the enemy plan', () => {
    const next = reduce(lv, asked.state, { type: 'ZARGON_TURN_END' }).state;
    const o = ordersFor(lv, next, ['dwarf']).find((x) => x.monster === 'w1')!;
    expect(o.profile).toBe('thief');
    expect(o.name).toBe('Ice Gremlin');
  });

  it('wounds count against the enemy body points', () => {
    const w = reduce(lv, asked.state, { type: 'MONSTER_DAMAGE', monster: 'w1', amount: 2 }).state;
    expect(w.monsters['w1']?.body).toBe(1);
    const dead = reduce(lv, w, { type: 'MONSTER_DAMAGE', monster: 'w1', amount: 1 }).state;
    expect(dead.monsters['w1']?.dead).toBe(true);
  });

  it('the validator wants the enemy to exist', () => {
    const bad = parseQuest({ ...testQuestData, wandering: { monster: 'goblin', enemy: 'x' } });
    expect(validateQuest(bad, board).join(' ')).toMatch(/wandering: unknown enemy x/);
    expect(validateQuest(lv.quest, board)).toEqual([]);
  });
});

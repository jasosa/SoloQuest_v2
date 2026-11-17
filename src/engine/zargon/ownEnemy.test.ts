import { describe, expect, it } from 'vitest';
import { resolveMonster } from '../data/enemies';
import { statsOf } from '../data/monsters';
import { EnemyDefSchema } from '../quest/schema';
import { isCaster, profileOf, weightsOf } from './weights';

describe('an enemy with its own rules (decision 75)', () => {
  const own = {
    id: 'slime',
    name: 'Slime',
    overrides: { move: 4, att: 2, def: 1, body: 6, mind: 0 },
    profile: 'relentless' as const,
    weights: { lowestBody: 3, closest: 1 },
  };

  it('needs all five stats when it has no base type', () => {
    expect(EnemyDefSchema.safeParse(own).success).toBe(true);
    expect(EnemyDefSchema.safeParse({ ...own, overrides: { move: 4 } }).success).toBe(false);
    expect(EnemyDefSchema.safeParse({ id: 'x', name: 'X', base: 'orc' }).success).toBe(true);
  });

  it('its plan, weights and stats reach the monster, and win over the carrier type', () => {
    const m = resolveMonster({ id: 'm1', type: 'goblin', enemy: 'slime', cell: [1, 1] }, [own]);
    expect(profileOf(m)).toBe('relentless'); // a goblin would be a skirmisher
    expect(weightsOf(m)).toEqual({ lowestBody: 3, closest: 1 });
    expect(statsOf(m)).toEqual({ move: 4, att: 2, def: 1, body: 6, mind: 0 });
  });

  it('a caster plan makes it a caster, and weights that are all zero fall back to the type', () => {
    expect(isCaster({ type: 'goblin', profile: 'caster' })).toBe(true);
    expect(weightsOf({ type: 'goblin', weights: { closest: 0 } })).toEqual({ isolated: 1 });
  });
});

import { describe, expect, it } from 'vitest';
import type { MonsterView } from '../../engine/game/view';
import { abilityLine, monsterTip } from './monsterTip';

const view = (extra: Partial<MonsterView> = {}): MonsterView => ({
  id: 'm1',
  type: 'orc',
  name: 'Grak',
  stats: { move: 8, att: 4, def: 4, body: 3, mind: 3 },
  body: 3,
  maxBody: 3,
  dead: false,
  state: 'active',
  special: false,
  abilities: [],
  ...extra,
});

describe('monsterTip', () => {
  it('names the monster and gives its stats', () => {
    expect(monsterTip(view(), 'O3')).toBe('O3 Grak\nMove 8 · Att 4 · Def 4 · Body 3 · Mind 3');
  });

  it('adds the special line and one line per ability', () => {
    const tip = monsterTip(
      view({
        special: true,
        abilities: [
          {
            id: 'fireImmune',
            name: 'Fireproof',
            text: 'Fire spells have no effect on it.',
            kind: 'immunity',
          },
        ],
      }),
      'O3',
    );
    expect(tip.split('\n')).toEqual([
      'O3 Grak',
      'Special monster',
      'Move 8 · Att 4 · Def 4 · Body 3 · Mind 3',
      'Fireproof: Fire spells have no effect on it.',
    ]);
  });

  it('an ability alone does not say special', () => {
    const tip = monsterTip(
      view({ abilities: [{ id: 's', name: 'Made of stone', text: 'x', kind: 'ability' }] }),
      'O1',
    );
    expect(tip).not.toContain('Special monster');
    expect(
      abilityLine(
        view({ abilities: [{ id: 's', name: 'Made of stone', text: 'x', kind: 'ability' }] }),
      ),
    ).toBe('Made of stone');
  });
});

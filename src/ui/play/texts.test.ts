import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import { testQuest } from '../../engine/quest/testQuest';
import { monsterCodes } from './monsterCodes';
import { sprungLines, sprungTitle, wanderAskLines, wanderingLines } from './texts';

describe('result texts', () => {
  it('names each trap kind and says what happens', () => {
    expect(sprungTitle('pit')).toBe('Pit trap!');
    const pit = sprungLines({ kind: 'trapSprung', trap: 't1', trapKind: 'pit', via: 'step' });
    expect(pit.join(' ')).toMatch(/pit tile/);
    const jumped = sprungLines({ kind: 'trapSprung', trap: 't3', trapKind: 'spear', via: 'jump' });
    expect(jumped[0]).toMatch(/stays on the trap square/);
  });

  it('a chest trap shows the quest effect, or sends the players to the notes', () => {
    const base = { kind: 'trapSprung', trap: 't2', trapKind: 'chest', via: 'search' } as const;
    expect(sprungLines({ ...base, effect: 'A gas cloud.' })).toContain('A gas cloud.');
    expect(sprungLines(base).join(' ')).toMatch(/quest notes/);
  });

  it('the wandering monster card asks the placement question, then answers it', () => {
    const ask = wanderAskLines('orc', 'elf');
    expect(ask[0]).toMatch(/free square next to the Elf.*3 attack dice/);
    expect(ask[1]).toBe('Was there a free square next to the Elf?');

    const p = {
      kind: 'wanderingMonster',
      monster: 'w1',
      monsterType: 'orc',
      hero: 'elf',
      room: 'R18',
      placement: {
        nextToHero: 'elf',
        attacksAtOnce: true,
        ifNoFreeSquare: { closestInRoom: 'R18', actsNextZargonTurn: true },
      },
    } as const;
    expect(wanderingLines(p, true)[0]).toMatch(/attacks the Elf at once with 3 attack dice/);
    expect(wanderingLines(p, false)[0]).toMatch(/as close to the Elf.*Zargon's next turn/);
  });

  it('monster codes include wanderers in the order they appeared', () => {
    const level = buildLevel(testQuest());
    const codes = monsterCodes(level, ['m1', 'w1', 'm2'], { w1: { type: 'orc' } });
    expect(codes.get('m1')).toBe('O1');
    expect(codes.get('w1')).toBe('O2');
    expect(codes.get('m2')).toBe('G1');
  });
});

import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../engine/game/events';
import { EventSchema } from './saves';

describe('EventSchema covers the search, trap and notes events', () => {
  const events: GameEvent[] = [
    { type: 'SEARCH_TREASURE', room: 'R17', hero: 'elf' },
    { type: 'SEARCH_TREASURE', room: 'R17', hero: 'dwarf', override: true },
    { type: 'WANDERING_MONSTER', room: 'R17', hero: 'wizard' },
    { type: 'SEARCH_SECRET_DOORS', hero: 'barbarian', area: 'R17' },
    { type: 'SEARCH_SECRET_DOORS', hero: 'barbarian', cell: [3, 18], override: false },
    { type: 'SEARCH_TRAPS', furniture: 'f1' },
    { type: 'SEARCH_TRAPS', furniture: 'f1', override: true },
    { type: 'TRAP_JUMP', trap: 't1', result: 'skull' },
    { type: 'TRAP_DISARM', trap: 't1', by: 'toolkit', result: 'blackShield' },
    { type: 'TRAP_STEP', trap: 't1' },
    { type: 'AREA_ENTER', area: 'R17' },
    { type: 'SQUARE_TRIGGER', cell: [3, 16] },
    { type: 'MANUAL_TRIGGER', note: 'n-A' },
    { type: 'CHOOSE', note: 'n-A', option: 1 },
    { type: 'END_QUEST', outcome: 'stairs' },
    { type: 'END_QUEST', outcome: 'fell' },
  ];
  for (const e of events)
    it(`round-trips ${e.type}`, () => {
      expect(EventSchema.parse(JSON.parse(JSON.stringify(e)))).toEqual(e);
    });

  it('rejects bad note events', () => {
    expect(EventSchema.safeParse({ type: 'END_QUEST', outcome: 'won' }).success).toBe(false);
    expect(EventSchema.safeParse({ type: 'CHOOSE', note: 'n', option: -1 }).success).toBe(false);
    expect(EventSchema.safeParse({ type: 'SQUARE_TRIGGER', cell: [1.5, 2] }).success).toBe(false);
    expect(EventSchema.safeParse({ type: 'AREA_ENTER' }).success).toBe(false);
  });

  it('rejects bad values', () => {
    expect(EventSchema.safeParse({ type: 'TRAP_JUMP', trap: 't1', result: 'six' }).success).toBe(
      false,
    );
    expect(
      EventSchema.safeParse({ type: 'SEARCH_TREASURE', room: 'R1', hero: 'knight' }).success,
    ).toBe(false);
  });
});

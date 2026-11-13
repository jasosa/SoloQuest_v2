import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../engine/game/events';
import { EventSchema } from './saves';

describe('EventSchema covers the search, trap and notes events', () => {
  const events: GameEvent[] = [
    { type: 'SEARCH_TREASURE', room: 'R17', hero: 'elf' },
    { type: 'SEARCH_TREASURE', room: 'R17', hero: 'dwarf', override: true },
    { type: 'WANDERING_MONSTER', room: 'R17', hero: 'wizard' },
    { type: 'HERO_DIED', hero: 'dwarf' },
    { type: 'SEARCH_SECRET_DOORS', area: 'R17' },
    { type: 'SEARCH_SECRET_DOORS', cell: [3, 18], override: false },
    { type: 'SEARCH_TRAPS', furniture: 'f1' },
    { type: 'SEARCH_TRAPS', furniture: 'f1', override: true },
    { type: 'TRAP_JUMP', trap: 't1', result: 'skull' },
    { type: 'TRAP_DISARM', trap: 't1', by: 'toolkit', result: 'blackShield' },
    { type: 'TRAP_STEP', trap: 't1' },
    { type: 'AREA_ENTER', area: 'R17' },
    { type: 'SQUARE_TRIGGER', cell: [3, 16] },
    { type: 'MANUAL_TRIGGER', note: 'n-A' },
    { type: 'CHOOSE', note: 'n-A', option: 1 },
    { type: 'SPELL_CAST', monster: 'm1', spell: 'fear' },
    { type: 'SPELL_FAILED', monster: 'm1', spell: 'fear' },
    { type: 'MONSTER_DONE', monster: 'm1' },
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

  it('still parses old saves with the dropped keys (ignored)', () => {
    const w = EventSchema.parse({
      type: 'WANDERING_MONSTER',
      room: 'R17',
      hero: 'elf',
      adjacent: false,
    });
    expect(w).toEqual({ type: 'WANDERING_MONSTER', room: 'R17', hero: 'elf' });
    const s = EventSchema.parse({ type: 'SEARCH_SECRET_DOORS', hero: 'elf', area: 'R17' });
    expect(s).toEqual({ type: 'SEARCH_SECRET_DOORS', area: 'R17' });
  });

  it('rejects an unknown hero in HERO_DIED', () => {
    expect(EventSchema.safeParse({ type: 'HERO_DIED', hero: 'knight' }).success).toBe(false);
  });

  it('rejects bad Zargon events', () => {
    expect(EventSchema.safeParse({ type: 'SPELL_CAST', monster: 'm1' }).success).toBe(false);
    expect(EventSchema.safeParse({ type: 'SPELL_FAILED', monster: 'm1' }).success).toBe(false);
    expect(EventSchema.safeParse({ type: 'MONSTER_DONE' }).success).toBe(false);
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

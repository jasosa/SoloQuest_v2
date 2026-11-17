import { describe, expect, it } from 'vitest';
import { CORE_FILE_FORMAT } from '../engine/data/coreFile';
import { buildCoreExport } from './corePending';

describe('buildCoreExport', () => {
  const none = { format: CORE_FILE_FORMAT, items: [] } as const;
  const lib = [
    {
      kind: 'enemy' as const,
      data: { id: 'orc', name: 'Orc', base: 'orc', overrides: { att: 4 } },
    },
    {
      kind: 'enemy' as const,
      data: {
        id: 'slime',
        name: 'Slime',
        base: 'goblin',
        origin: 'official',
        expansion: 'Frozen Horror',
      },
    },
    {
      kind: 'enemy' as const,
      data: { id: 'fan', name: 'Fan thing', base: 'goblin', origin: 'fan-made' },
    },
  ];
  it('exports changed core items and official items, not fan-made ones', () => {
    const out = buildCoreExport(none, lib, (k, id) => k === 'enemy' && id === 'orc');
    expect(out.items.map((i) => i.data.id)).toEqual(['orc', 'slime']);
    expect(out.items[1]?.expansion).toBe('Frozen Horror');
    expect(out.items[1]?.data).not.toHaveProperty('expansion');
    expect(out.items[1]?.data).not.toHaveProperty('origin');
  });
  it('keeps what was taken out of Core', () => {
    const pending = {
      format: CORE_FILE_FORMAT,
      items: [{ kind: 'ability' as const, deleted: true, data: { id: 'stone', name: 'Stone' } }],
    };
    const out = buildCoreExport(pending, [], () => false);
    expect(out.items).toEqual(pending.items);
  });
});

import { describe, expect, it } from 'vitest';
import { PackManifestSchema, type PackManifest } from './pack';
import { adjustableSlots, isNoTune, NO_TUNE, tuneOfSlot, withTune } from './tune';

const manifest = (extra: object = {}): PackManifest =>
  PackManifestSchema.parse({
    format: 'sqtextures',
    version: 1,
    id: 'pp',
    name: 'P',
    monster: { orc: 'orc.png', goblin: { file: 'g.png', scale: 1.5 } },
    furniture: { table: { file: 't.png', cells: [3, 2], scale: 0.8 }, chest: { file: 'c.png' } },
    door: { closed: 'd.png' },
    block: { double: 'b2.png' },
    trap: { pit: 'p.png' },
    ...extra,
  });

describe('adjustableSlots', () => {
  it('lists only the slots that have a picture, in dialog order', () => {
    expect(adjustableSlots(manifest()).map((s) => s.id)).toEqual([
      'monster.goblin',
      'monster.orc',
      'furniture.table',
      'furniture.chest',
      'door.closed',
      'block.double',
      'trap.pit',
    ]);
  });
  it('gives readable names', () => {
    const slots = adjustableSlots(manifest({ monster: { dreadWarrior: 'x.png' } }));
    expect(slots.find((s) => s.id === 'monster.dreadWarrior')?.label).toBe('Dread warrior');
  });
});

describe('tuneOfSlot', () => {
  it('reads the scale and offset, with defaults for a plain file name', () => {
    expect(tuneOfSlot(manifest(), 'monster.orc')).toEqual(NO_TUNE);
    expect(tuneOfSlot(manifest(), 'monster.goblin')).toEqual({ scale: 1.5, offset: [0, 0] });
    expect(tuneOfSlot(manifest(), 'furniture.table')).toEqual({ scale: 0.8, offset: [0, 0] });
  });
});

describe('withTune', () => {
  it('turns a plain file name into a slot object, and back when nothing is changed', () => {
    const m = withTune(manifest(), 'monster.orc', { scale: 1.3, offset: [0.25, -0.1] });
    expect(m.monster?.orc).toEqual({ file: 'orc.png', scale: 1.3, offset: [0.25, -0.1] });
    const back = withTune(m, 'monster.orc', NO_TUNE);
    expect(back.monster?.orc).toBe('orc.png');
  });
  it('keeps the other fields of a furniture slot', () => {
    const m = withTune(manifest(), 'furniture.table', { scale: 0.7, offset: [0, 0.1] });
    expect(m.furniture?.table).toEqual({
      file: 't.png',
      cells: [3, 2],
      scale: 0.7,
      offset: [0, 0.1],
    });
    const plain = withTune(m, 'furniture.table', NO_TUNE);
    expect(plain.furniture?.table).toEqual({ file: 't.png', cells: [3, 2] });
  });
  it('rounds to two decimals and keeps inside the limits', () => {
    const m = withTune(manifest(), 'monster.orc', { scale: 9, offset: [3, -3] });
    expect(m.monster?.orc).toEqual({ file: 'orc.png', scale: 2.5, offset: [1, -1] });
    expect(
      withTune(manifest(), 'monster.orc', { scale: 0.123456, offset: [0, 0] }).monster?.orc,
    ).toEqual({
      file: 'orc.png',
      scale: 0.4,
    });
    expect(
      withTune(manifest(), 'monster.orc', { scale: 1.0333333, offset: [0, 0] }).monster?.orc,
    ).toEqual({ file: 'orc.png', scale: 1.03 });
  });
  it('does not change the original and leaves a slot that is not in the pack alone', () => {
    const m = manifest();
    withTune(m, 'monster.orc', { scale: 2, offset: [0, 0] });
    expect(m.monster?.orc).toBe('orc.png');
    expect(withTune(m, 'monster.zombie', { scale: 2, offset: [0, 0] })).toBe(m);
  });
  it('gives a manifest the pack reader still accepts', () => {
    const m = withTune(manifest(), 'trap.pit', { scale: 1.2, offset: [0, 0.5] });
    expect(PackManifestSchema.safeParse(m).success).toBe(true);
  });
  it('knows what is no change', () => {
    expect(isNoTune(NO_TUNE)).toBe(true);
    expect(isNoTune({ scale: 1, offset: [0, 0.05] })).toBe(false);
  });
});

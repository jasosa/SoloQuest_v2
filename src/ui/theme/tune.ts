import { FURNITURE_TYPES, MONSTER_TYPES, TRAP_KINDS } from '../../engine/quest/schema';
import type { PackManifest } from './pack';
import { OFFSET_MAX, SCALE_MAX, SCALE_MIN } from './theme';

/**
 * Editing the knobs of a pack from the app (scale and offset of a picture). Pure functions on the
 * manifest: a slot is named `group.key` (`monster.orc`, `furniture.table`, `door.closed`, `block.single`,
 * `trap.pit`). A slot without a change stays a plain file name in `theme.json`.
 */

export type SlotGroup = 'monster' | 'furniture' | 'door' | 'block' | 'trap';

export interface SlotRef {
  /** `group.key`. */
  readonly id: string;
  readonly group: SlotGroup;
  readonly key: string;
  readonly label: string;
}

export interface SlotTune {
  readonly scale: number;
  readonly offset: readonly [number, number];
}

export const NO_TUNE: SlotTune = { scale: 1, offset: [0, 0] };

export const GROUP_NAMES: Readonly<Record<SlotGroup, string>> = {
  monster: 'Monsters',
  furniture: 'Furniture',
  door: 'Doors',
  block: 'Blocks',
  trap: 'Traps',
};

const NAMES: Readonly<Record<string, string>> = {
  dreadWarrior: 'Dread warrior',
  dreadSorcerer: 'Dread sorcerer',
  sorcerersTable: "Sorcerer's table",
  alchemistsBench: "Alchemist's bench",
  weaponsRack: 'Weapons rack',
  fallingBlock: 'Falling block',
};
const nice = (key: string): string =>
  NAMES[key] ??
  key.charAt(0).toUpperCase() +
    key
      .replace(/([A-Z])/g, ' $1')
      .slice(1)
      .toLowerCase();

/** The slots of a pack that have a picture, in the order of the dialog. Only they can be adjusted. */
export function adjustableSlots(m: PackManifest): SlotRef[] {
  const out: SlotRef[] = [];
  const add = (group: SlotGroup, key: string, label: string) =>
    out.push({ id: `${group}.${key}`, group, key, label });
  for (const t of MONSTER_TYPES) if (m.monster?.[t]) add('monster', t, nice(t));
  for (const t of FURNITURE_TYPES) if (m.furniture?.[t]) add('furniture', t, nice(t));
  for (const k of ['closed', 'open', 'secret'] as const) if (m.door?.[k]) add('door', k, nice(k));
  for (const k of ['single', 'double'] as const) if (m.block?.[k]) add('block', k, nice(k));
  for (const k of ['armed', ...TRAP_KINDS] as const) if (m.trap?.[k]) add('trap', k, nice(k));
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The tune of a slot as it is now (the defaults for a slot that has none). */
export function tuneOfSlot(m: PackManifest, id: string): SlotTune {
  const [group, key] = id.split('.') as [SlotGroup, string];
  const slot = (m[group] as Record<string, unknown> | undefined)?.[key];
  if (!slot || typeof slot !== 'object') return NO_TUNE;
  const s = slot as { scale?: number; offset?: [number, number] };
  return { scale: s.scale ?? 1, offset: s.offset ?? [0, 0] };
}

export const isNoTune = (t: SlotTune): boolean =>
  t.scale === 1 && t.offset[0] === 0 && t.offset[1] === 0;

/** The manifest with a new scale and offset for one slot (limits and rounding applied). */
export function withTune(m: PackManifest, id: string, tune: SlotTune): PackManifest {
  const [group, key] = id.split('.') as [SlotGroup, string];
  const group_ = m[group] as Record<string, unknown> | undefined;
  const slot = group_?.[key];
  if (slot === undefined) return m;
  const scale = round2(clamp(tune.scale, SCALE_MIN, SCALE_MAX));
  const offset: [number, number] = [
    round2(clamp(tune.offset[0], -OFFSET_MAX, OFFSET_MAX)),
    round2(clamp(tune.offset[1], -OFFSET_MAX, OFFSET_MAX)),
  ];
  const plain = scale === 1 && offset[0] === 0 && offset[1] === 0;
  const extra = {
    ...(scale !== 1 ? { scale } : {}),
    ...(offset[0] !== 0 || offset[1] !== 0 ? { offset } : {}),
  };
  let next: unknown;
  if (group === 'furniture') {
    // furniture keeps its other fields (cells, corner); only scale and offset change
    const rest: Record<string, unknown> = { ...(slot as Record<string, unknown>) };
    delete rest.scale;
    delete rest.offset;
    next = { ...rest, ...extra };
  } else {
    const file = typeof slot === 'string' ? slot : (slot as { file: string }).file;
    next = plain ? file : { file, ...extra };
  }
  return { ...m, [group]: { ...group_, [key]: next } } as PackManifest;
}

import { PackManifestSchema, type PackManifest } from './schema';

/**
 * The packs that are installed and how they fit together (decision 36). Pure: it is given the parsed
 * manifests and the ids of the quests that exist, and says what is wrong or gives the registry.
 */

export const CORE_PACK = 'core';

export class PackError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`The packs are not valid:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'PackError';
    this.issues = issues;
  }
}

export interface ResolvedPack {
  readonly manifest: PackManifest;
  /** Every pack this one needs, dependencies first, not including itself. */
  readonly requires: readonly string[];
}

export interface PackRegistry {
  /** Dependencies first (core first), then by id. */
  readonly packs: readonly ResolvedPack[];
  readonly byId: ReadonlyMap<string, ResolvedPack>;
  /** The pack of each quest id. */
  readonly packOfQuest: ReadonlyMap<string, string>;
}

/** The quests that exist: their id, and the pack the quest file says it belongs to (none: it is listed by a pack). */
export interface QuestRef {
  readonly id: string;
  readonly pack?: string | undefined;
}

/** Parse a manifest from raw JSON. Throws a PackError with a readable message. */
export function parsePackManifest(raw: unknown): PackManifest {
  const r = PackManifestSchema.safeParse(raw);
  if (!r.success)
    throw new PackError(
      r.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  return r.data;
}

export function buildRegistry(
  manifests: readonly PackManifest[],
  quests: readonly QuestRef[],
): PackRegistry {
  const issues: string[] = [];
  const byManifest = new Map<string, PackManifest>();
  for (const m of manifests) {
    if (byManifest.has(m.id)) issues.push(`pack ${m.id}: two manifests have this id`);
    else byManifest.set(m.id, m);
  }
  if (!byManifest.has(CORE_PACK)) issues.push(`there is no "${CORE_PACK}" pack (the base game)`);
  else if (byManifest.get(CORE_PACK)!.dependsOn.length > 0)
    issues.push(`pack ${CORE_PACK}: the base game depends on nothing`);

  for (const m of byManifest.values())
    for (const d of m.dependsOn) {
      if (d === m.id) issues.push(`pack ${m.id}: depends on itself`);
      else if (!byManifest.has(d))
        issues.push(`pack ${m.id}: depends on "${d}", which is not installed`);
    }

  // Dependencies first. A cycle is reported with the packs in it.
  const order: string[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const requires = new Map<string, string[]>();
  const visit = (id: string, path: string[]): string[] => {
    const seen = state.get(id);
    if (seen === 'done') return requires.get(id) ?? [];
    if (seen === 'visiting') {
      issues.push(
        `packs depend on each other in a circle: ${[...path.slice(path.indexOf(id)), id].join(' > ')}`,
      );
      return [];
    }
    state.set(id, 'visiting');
    const needs: string[] = [];
    for (const d of byManifest.get(id)?.dependsOn ?? []) {
      if (!byManifest.has(d) || d === id) continue;
      for (const n of visit(d, [...path, id])) if (!needs.includes(n)) needs.push(n);
      if (!needs.includes(d)) needs.push(d);
    }
    state.set(id, 'done');
    requires.set(id, needs);
    order.push(id);
    return needs;
  };
  for (const id of [...byManifest.keys()].sort((a, b) =>
    a === CORE_PACK ? -1 : b === CORE_PACK ? 1 : a.localeCompare(b),
  ))
    visit(id, []);

  // Every expansion needs the base game.
  for (const id of order)
    if (
      id !== CORE_PACK &&
      byManifest.has(CORE_PACK) &&
      !(requires.get(id) ?? []).includes(CORE_PACK)
    )
      issues.push(`pack ${id}: an expansion must depend on "${CORE_PACK}"`);

  // Quests: each listed once, each one exists, and a quest file that names its pack agrees.
  const known = new Map(quests.map((q) => [q.id, q]));
  const packOfQuest = new Map<string, string>();
  for (const m of byManifest.values())
    for (const q of m.quests) {
      const have = known.get(q);
      if (!have) issues.push(`pack ${m.id}: lists quest "${q}", which does not exist`);
      else if (have.pack !== undefined && have.pack !== m.id)
        issues.push(`quest "${q}": the file says pack "${have.pack}" but pack ${m.id} lists it`);
      const other = packOfQuest.get(q);
      if (other) issues.push(`quest "${q}": listed by both ${other} and ${m.id}`);
      else packOfQuest.set(q, m.id);
    }
  for (const q of quests) {
    if (packOfQuest.has(q.id)) continue;
    if (q.pack !== undefined && !byManifest.has(q.pack))
      issues.push(`quest "${q.id}": belongs to pack "${q.pack}", which is not installed`);
    else issues.push(`quest "${q.id}": no pack lists it`);
  }

  if (issues.length > 0) throw new PackError(issues);

  const resolved = order.map((id): ResolvedPack => ({
    manifest: byManifest.get(id)!,
    requires: requires.get(id) ?? [],
  }));
  return { packs: resolved, byId: new Map(resolved.map((p) => [p.manifest.id, p])), packOfQuest };
}

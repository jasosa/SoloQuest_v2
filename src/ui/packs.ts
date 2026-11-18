/**
 * The installed quest packs (decision 36): every `src/content/packs/*.json` manifest, checked together
 * with the quests that exist. `core` is the base game; an expansion depends on it.
 */
import { buildRegistry, parsePackManifest, type PackRegistry } from '../engine/pack/registry';
import { parseQuest } from '../engine/quest/loader';

const manifests = import.meta.glob('../content/packs/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const questFiles = import.meta.glob('../content/quests/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export function loadRegistry(
  rawManifests: Record<string, unknown> = manifests,
  rawQuests: Record<string, unknown> = questFiles,
): PackRegistry {
  const quests = Object.values(rawQuests).map((raw) => {
    const q = parseQuest(raw);
    return { id: q.id, pack: q.pack };
  });
  return buildRegistry(Object.values(rawManifests).map(parsePackManifest), quests);
}

export const packs: PackRegistry = loadRegistry();

/** The pack a quest belongs to (a quest of this device, made in the editor, is in none). */
export const packOfQuest = (questId: string): string | undefined => packs.packOfQuest.get(questId);

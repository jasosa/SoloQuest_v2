/**
 * The installed quest packs (decision 36): every `src/content/packs/*.json` manifest, checked together
 * with the quests that exist. `core` is the base game; an expansion depends on it.
 */
import {
  CORE_PACK,
  buildRegistry,
  parsePackManifest,
  type PackRegistry,
} from '../engine/pack/registry';
import { parseQuest } from '../engine/quest/loader';
import { t } from '../i18n/t';

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

/**
 * The packs that get a tab on the quest list: those with at least one quest that is encoded. With one
 * such pack (today: only the core game) there is nothing to choose, so the list has no tabs.
 */
export function packTabs(
  registry: PackRegistry,
  hasQuest: (questId: string) => boolean,
): { id: string; name: string }[] {
  const withQuests = registry.packs.filter((p) => p.manifest.quests.some(hasQuest));
  if (withQuests.length < 2) return [];
  return withQuests.map((p) => ({
    id: p.manifest.id,
    name: packLabel(p.manifest),
  }));
}

/** The pack a quest belongs to (a quest of this device, made in the editor, is in none). */
export const packOfQuest = (questId: string): string | undefined => packs.packOfQuest.get(questId);

/** What the player reads for a pack: the base game is "Core game", an expansion is its name. */
export const packLabel = (manifest: { id: string; name: string }): string =>
  manifest.id === CORE_PACK ? t('select.coreGame', 'Core game') : manifest.name;

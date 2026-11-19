/**
 * Multi-map quests (decision 45): the board fields of the quest are map 1, `maps` holds the extra
 * ones. `questMaps` gives every map as an ordinary single-map quest (a "map view"): the shared data
 * of the quest with the board fields of that map and only the notes of that map. The rest of the
 * engine never sees more than one map at a time.
 */
import type { MapDef, Quest } from './schema';

/** The fields that draw one map. The same names are in the quest (map 1) and in `MapDef`. */
export const BOARD_KEYS = [
  'rock',
  'doors',
  'edgeDoors',
  'roomTiles',
  'boardTiles',
  'areaOverrides',
  'secretDoors',
  'falseDoors',
  'blocks',
  'furniture',
  'monsters',
  'traps',
  'markers',
  'tunnels',
  'zones',
] as const;

/** Id of map 1 when the quest does not name it. */
export const DEFAULT_MAP_ID = 'map1';

export interface QuestMap {
  readonly id: string;
  readonly name: string | undefined;
  /** An ordinary quest: this map's board data and notes. */
  readonly quest: Quest;
}

export function isMultiMap(quest: Pick<Quest, 'maps'>): boolean {
  return (quest.maps?.length ?? 0) > 0;
}

/** The id of map 1. */
export function firstMapId(quest: Pick<Quest, 'mapId'>): string {
  return quest.mapId ?? DEFAULT_MAP_ID;
}

/** A note is in force on a map when it names that map or names none. */
export function noteOnMap(note: { readonly map?: string | undefined }, mapId: string): boolean {
  return note.map === undefined || note.map === mapId;
}

/** The map views of a quest, map 1 first. A quest with one map gives itself. */
export function questMaps(quest: Quest): QuestMap[] {
  if (!isMultiMap(quest)) return [{ id: firstMapId(quest), name: quest.mapName, quest }];
  const { maps, ...shared } = quest;
  const first = firstMapId(quest);
  const view = (id: string, name: string | undefined, own: Partial<Quest>): QuestMap => ({
    id,
    name,
    quest: {
      ...shared,
      ...own,
      mapId: id,
      ...(name !== undefined ? { mapName: name } : {}),
      notes: quest.notes.filter((n) => noteOnMap(n, id)),
    } as Quest,
  });
  const out: QuestMap[] = [view(first, quest.mapName, {})];
  for (const m of maps ?? []) out.push(view(m.id, m.name, ownFields(m)));
  return out;
}

function ownFields(m: MapDef): Partial<Quest> {
  const out: Record<string, unknown> = { start: m.start };
  for (const k of BOARD_KEYS) out[k] = m[k];
  return out as Partial<Quest>;
}

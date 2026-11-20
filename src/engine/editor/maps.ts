/**
 * Editing the maps of a multi-map quest (decision 45). Pure, same style as `ops.ts`.
 *
 * The quest keeps map 1 in its own board fields and the others in `maps`. The editor works on one
 * map at a time by SWAPPING that map into the top-level fields (`swapTo`): every single-map
 * operation then edits the shown map with no change. Swapping twice gives the quest back, so the
 * saved draft, undo and export always use the canonical form (`toCanon`).
 *
 * The operations here (`addMap`, `removeMap`, `updateMap`, `addLink`, `removeLink`) work on the
 * canonical quest.
 */
import { BOARD_KEYS, firstMapId, isMultiMap, questMaps } from '../quest/maps';
import type { MapDef, Note, Quest } from '../quest/schema';
import { NEEDS_MAP } from '../quest/validate';
import { fail, newIssues, nextId, ok, type EditResult } from './result';

type Cell = [number, number];
const key = (c: readonly number[]) => `${c[0]},${c[1]}`;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** The board fields and start of the map that sits in the top-level fields. */
function topFields(q: Quest): MapDef {
  const out: Record<string, unknown> = { id: firstMapId(q), start: q.start };
  if (q.mapName !== undefined) out.name = q.mapName;
  for (const k of BOARD_KEYS) out[k] = q[k];
  return out as MapDef;
}

/**
 * Put map `id` in the top-level fields; the map that was there takes its place in `maps`.
 * A quest with one map, or the id of the map that is already on top, comes back unchanged.
 */
export function swapTo(q: Quest, id: string): Quest {
  if (!isMultiMap(q) || firstMapId(q) === id) return q;
  const target = q.maps?.find((m) => m.id === id);
  if (!target) return q;
  const next: Record<string, unknown> = { ...q, mapId: target.id, start: target.start };
  if (target.name !== undefined) next.mapName = target.name;
  else delete next.mapName;
  for (const k of BOARD_KEYS) next[k] = target[k];
  next.maps = (q.maps ?? []).map((m) => (m.id === id ? topFields(q) : m));
  return next as Quest;
}

/** Ids of the maps, in order of the canonical quest (map 1 first). */
export function mapIdsOf(q: Quest): string[] {
  return questMaps(q).map((m) => m.id);
}

/** Ids on the maps other than the one on top: new ids must not repeat these. */
export function foreignIdsOf(q: Quest): Set<string> {
  const out = new Set<string>();
  for (const m of q.maps ?? [])
    for (const list of [
      m.doors,
      m.edgeDoors,
      m.secretDoors,
      m.falseDoors,
      m.furniture,
      m.monsters,
      m.traps,
      m.markers,
      m.zones,
      m.tunnels,
    ])
      for (const x of list) out.add(x.id);
  return out;
}

const hasMapTrigger = (n: Note) => NEEDS_MAP.has(n.trigger.type);
/** A note that is about one map: a letter, a square, a target element or a room trigger. */
const isMapNote = (n: Note) =>
  n.letter !== undefined || n.at !== undefined || n.target !== undefined || hasMapTrigger(n);

/** The map a new note should name in a multi-map quest (or undefined for a quest-wide note). */
export function mapForNewNote(
  q: Quest,
  note: { letter?: unknown; at?: unknown; target?: unknown; trigger?: { type: string } },
): string | undefined {
  if (!isMultiMap(q)) return undefined;
  const wide = note.letter !== undefined || note.at !== undefined || note.target !== undefined;
  return wide || (note.trigger && NEEDS_MAP.has(note.trigger.type)) ? firstMapId(q) : undefined;
}

/** A readable list of the stairways: where a link can start or end. */
export interface StairsEnd {
  readonly map: string;
  readonly mapName: string;
  readonly furniture: string;
  readonly cell: Cell;
}

export function stairsEnds(q: Quest): StairsEnd[] {
  const out: StairsEnd[] = [];
  for (const m of questMaps(q))
    for (const f of m.quest.furniture)
      if (f.type === 'stairs' && f.cells[0])
        out.push({
          map: m.id,
          mapName: m.name ?? m.id,
          furniture: f.id,
          cell: [f.cells[0][0], f.cells[0][1]],
        });
  return out;
}

// ---- maps

export interface NewMap {
  id?: string;
  name?: string;
}

/** Add an empty map (start room R01). The first extra map turns the quest into a multi-map quest. */
export function addMap(q: Quest, input: NewMap = {}): EditResult {
  const taken = mapIdsOf(q);
  let id = input.id?.trim();
  if (id !== undefined && id !== '') {
    if (!ID_PATTERN.test(id))
      return fail(`The map id "${id}" can only use letters, numbers, - and _.`);
    if (taken.includes(id)) return fail(`A map with id ${id} already exists.`);
  } else id = nextId('map', taken);
  const name = input.name?.trim();
  if (input.name !== undefined && name === '') return fail('The map name cannot be empty.');

  const first = firstMapId(q);
  const extra: MapDef = {
    id,
    ...(name ? { name } : {}),
    start: { area: 'R01' },
    rock: { rooms: [], cells: [] },
    doors: [],
    edgeDoors: [],
    roomTiles: [],
    boardTiles: [],
    areaOverrides: [],
    secretDoors: [],
    falseDoors: [],
    blocks: [],
    furniture: [],
    monsters: [],
    traps: [],
    markers: [],
    tunnels: [],
    zones: [],
  };
  const single = !isMultiMap(q);
  // The notes that are about the map the quest already had now name it.
  const notes = single ? q.notes.map((n) => (isMapNote(n) ? { ...n, map: first } : n)) : q.notes;
  const quest: Quest = {
    ...q,
    mapId: first,
    maps: [...(q.maps ?? []), extra],
    notes,
  };
  return ok(quest, newIssues(q, quest));
}

/**
 * Remove a map with its notes (the notes that name it) and its links. Removing the second to last
 * map turns the quest back into a single-map quest.
 */
export function removeMap(q: Quest, id: string): EditResult {
  const ids = mapIdsOf(q);
  if (!ids.includes(id)) return fail(`There is no map ${id}.`);
  if (ids.length < 2) return fail('A quest needs at least one map.');
  const other = ids.find((x) => x !== id) as string;
  let w = firstMapId(q) === id ? swapTo(q, other) : q;
  // `id` is now one of the extra maps
  const maps = (w.maps ?? []).filter((m) => m.id !== id);
  const links = (w.links ?? []).filter((l) => l.a.map !== id && l.b.map !== id);
  const notes = w.notes.filter((n) => n.map !== id);
  const next: Record<string, unknown> = { ...w, maps, links, notes };
  if (links.length === 0) delete next.links;
  if (maps.length === 0) {
    // back to one map: nothing names a map any more
    delete next.maps;
    delete next.links;
    delete next.mapId;
    delete next.mapName;
    next.notes = notes.map((n) => {
      const { map: _drop, ...rest } = n;
      void _drop;
      return rest as Note;
    });
  }
  w = next as Quest;
  return ok(w, newIssues(q, w));
}

export interface MapPatch {
  /** A new id; links and notes that name the map follow. */
  id?: string;
  /** `null` clears the name (the id is shown). */
  name?: string | null;
}

export function updateMap(q: Quest, id: string, patch: MapPatch): EditResult {
  const ids = mapIdsOf(q);
  if (!ids.includes(id)) return fail(`There is no map ${id}.`);
  const first = firstMapId(q) === id;
  const nextIdValue = patch.id?.trim() ?? id;
  if (nextIdValue !== id) {
    if (!ID_PATTERN.test(nextIdValue))
      return fail(`The map id "${nextIdValue}" can only use letters, numbers, - and _.`);
    if (ids.includes(nextIdValue)) return fail(`A map with id ${nextIdValue} already exists.`);
  }
  let name: string | undefined;
  if (patch.name !== undefined && patch.name !== null) {
    name = patch.name.trim();
    if (name === '') return fail('The map name cannot be empty.');
  }
  const apply = <T extends { id: string; name?: string | undefined }>(m: T): T => {
    const out: Record<string, unknown> = { ...m, id: nextIdValue };
    if (patch.name === null) delete out.name;
    else if (name !== undefined) out.name = name;
    return out as T;
  };
  let quest: Quest;
  if (first) {
    const next: Record<string, unknown> = { ...q, mapId: nextIdValue };
    if (patch.name === null) delete next.mapName;
    else if (name !== undefined) next.mapName = name;
    quest = next as Quest;
  } else quest = { ...q, maps: (q.maps ?? []).map((m) => (m.id === id ? apply(m) : m)) };
  if (nextIdValue !== id) {
    const end = <T extends { map: string }>(e: T): T =>
      e.map === id ? { ...e, map: nextIdValue } : e;
    quest = {
      ...quest,
      notes: quest.notes.map((n) => (n.map === id ? { ...n, map: nextIdValue } : n)),
      ...(quest.links
        ? { links: quest.links.map((l) => ({ ...l, a: end(l.a), b: end(l.b) })) }
        : {}),
    };
  }
  return ok(quest, newIssues(q, quest));
}

// ---- links

export interface LinkEnd {
  map: string;
  cell: Cell;
}

/** Join two stairways of two maps (both ways). Both ends must be on a stairway. */
export function addLink(q: Quest, a: LinkEnd, b: LinkEnd, id?: string): EditResult {
  const maps = questMaps(q);
  if (maps.length < 2) return fail('Add a second map first.');
  if (a.map === b.map) return fail('A link joins two different maps.');
  for (const [end, name] of [
    [a, 'first'],
    [b, 'second'],
  ] as const) {
    const m = maps.find((x) => x.id === end.map);
    if (!m) return fail(`The ${name} end is on a map that does not exist (${end.map}).`);
    const onStairs = m.quest.furniture.some(
      (f) => f.type === 'stairs' && f.cells.some((c) => key(c) === key(end.cell)),
    );
    if (!onStairs) return fail(`The ${name} end is not on a stairway of map ${m.name ?? m.id}.`);
    for (const l of q.links ?? [])
      for (const e of [l.a, l.b])
        if (e.map === end.map) {
          const there = m.quest.furniture.find(
            (f) =>
              f.type === 'stairs' &&
              f.cells.some((c) => key(c) === key(end.cell)) &&
              f.cells.some((c) => key(c) === key(e.cell)),
          );
          if (there) return fail(`The ${name} stairway is already linked (${l.id}).`);
        }
  }
  let linkId = id?.trim();
  const taken = (q.links ?? []).map((l) => l.id);
  if (linkId !== undefined && linkId !== '') {
    if (!ID_PATTERN.test(linkId)) return fail(`The link id "${linkId}" is not valid.`);
    if (taken.includes(linkId)) return fail(`A link with id ${linkId} already exists.`);
  } else linkId = nextId('l', taken);
  const link = {
    id: linkId,
    a: { map: a.map, cell: [a.cell[0], a.cell[1]] as Cell },
    b: { map: b.map, cell: [b.cell[0], b.cell[1]] as Cell },
  };
  const quest: Quest = { ...q, links: [...(q.links ?? []), link] };
  return ok(quest, newIssues(q, quest));
}

/** Remove a link. A `crossMap` effect that names it is reported in the warnings. */
export function removeLink(q: Quest, id: string): EditResult {
  if (!(q.links ?? []).some((l) => l.id === id)) return fail(`There is no link ${id}.`);
  const links = (q.links ?? []).filter((l) => l.id !== id);
  const next: Record<string, unknown> = { ...q, links };
  if (links.length === 0) delete next.links;
  const quest = next as Quest;
  return ok(quest, newIssues(q, quest));
}

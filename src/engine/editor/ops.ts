/**
 * Editing model: pure operations on a quest draft (a parsed `Quest`).
 *
 * Every operation returns a NEW quest and never changes its input. The result is
 * `{ ok: true, quest, warnings }` or `{ ok: false, error }` with a plain message.
 *
 * Removing something never edits notes or objectives for you. If a note, objective or effect
 * still points at the removed element, the result lists it in `warnings` (with a ref to jump to)
 * and `validateQuestIssues` keeps reporting it as an error until it is fixed. Structural leftovers
 * that cannot make sense alone are removed with their owner: the trap of a removed chest.
 *
 * The board is the fixed game board.
 */
import { areaAt, board, cellsOf, inBoard, isWallBetween } from '../board/board';
import { isSpellKey, SPELL_KEYS } from '../zargon/spells';
import { QuestSchema, type FurnitureDef, type MonsterDef, type Quest } from '../quest/schema';
import type { Issue } from '../quest/validate';
import { footprintShapeProblem } from '../quest/footprint';
import { referencesTo, renameDoorRefs } from './refs';
import { clean, fail, newIssues, nextId, ok, type EditResult } from './result';

export type Cell = [number, number];
export type DoorKind = 'normal' | 'secret' | 'false';
export type FurnitureType = FurnitureDef['type'];
export type MonsterKind = MonsterDef['type'];
export type TrapKind = Quest['traps'][number]['kind'];

export type { EditResult };

const key = (c: readonly number[]) => `${c[0]},${c[1]}`;
const cellEq = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];
const at = (c: readonly number[]) => `(${c[0]}, ${c[1]})`;
const copy = (c: readonly number[]): Cell => [c[0] as number, c[1] as number];
const byRow = (a: Cell, b: Cell) => a[1] - b[1] || a[0] - b[0];

/** Ids a person may type: letters, digits, dash, underscore. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** Text that must not be empty or only spaces: returns the trimmed text or an error message. */
function trimmed(value: string | undefined, what: string): { value?: string; error?: string } {
  if (value === undefined) return {};
  const t = value.trim();
  return t === '' ? { error: `The ${what} cannot be empty.` } : { value: t };
}

function pickId(
  prefix: string,
  taken: Iterable<string>,
  wanted: string | undefined,
  what: string,
): { id: string } | { error: string } {
  if (wanted === undefined) return { id: nextId(prefix, taken) };
  if (wanted.trim() === '') return { error: `The ${what} id cannot be empty.` };
  if (!ID_PATTERN.test(wanted))
    return {
      error: `The ${what} id "${wanted}" can only use letters, numbers, - and _, and must start with a letter or number.`,
    };
  if (new Set(taken).has(wanted)) return { error: `A ${what} with id ${wanted} already exists.` };
  return { id: wanted };
}

// ---- reading the draft

const allDoors = (q: Quest) => [...q.doors, ...q.secretDoors, ...q.falseDoors];

function isRockCell(q: Quest, c: readonly number[]): boolean {
  if (q.rock.cells.some((r) => cellEq(r, c))) return true;
  const a = areaAt(board, c[0] as number, c[1] as number);
  return a !== undefined && q.rock.rooms.includes(a);
}

interface Layers {
  blocks: Map<string, string>;
  furniture: Map<string, string>;
  stairs: Map<string, string>;
  monsters: Map<string, string>;
  traps: Map<string, string>;
  doors: Map<string, string>;
  npcs: Map<string, string>;
}

/** Which element sits on which cell. `skip` leaves out the element being moved. */
function layers(q: Quest, skip: { furniture?: string; monster?: string } = {}): Layers {
  const l: Layers = {
    blocks: new Map(),
    furniture: new Map(),
    stairs: new Map(),
    monsters: new Map(),
    traps: new Map(),
    doors: new Map(),
    npcs: new Map(),
  };
  q.blocks.forEach((b, i) =>
    b.cells.forEach((c) => l.blocks.set(key(c), `block ${b.id ?? `b${i + 1}`}`)),
  );
  for (const f of q.furniture) {
    if (f.id === skip.furniture) continue;
    const target = f.type === 'stairs' ? l.stairs : l.furniture;
    f.cells.forEach((c) =>
      target.set(key(c), `${f.type === 'stairs' ? 'the stairs' : 'furniture'} ${f.id}`),
    );
  }
  for (const m of q.monsters)
    if (m.cell && !m.hidden && m.id !== skip.monster)
      l.monsters.set(key(m.cell), `monster ${m.id}`);
  for (const t of q.traps) if (t.cell) l.traps.set(key(t.cell), `trap ${t.id}`);
  for (const d of allDoors(q)) for (const c of [d.a, d.b]) l.doors.set(key(c), `door ${d.id}`);
  for (const n of q.npcs) l.npcs.set(key(n.cell), `npc ${n.id}`);
  return l;
}

type LayerName = keyof Layers;
function conflict(l: Layers, c: readonly number[], names: LayerName[]): string | undefined {
  for (const n of names) {
    const hit = l[n].get(key(c));
    if (hit) return hit;
  }
  return undefined;
}

/** Cell is on the board and not rock. */
function floorProblem(q: Quest, c: readonly number[], what: string): string | undefined {
  if (
    !Number.isInteger(c[0]) ||
    !Number.isInteger(c[1]) ||
    !inBoard(board, c[0] as number, c[1] as number)
  )
    return `${what}: ${at(c)} is outside the board.`;
  if (isRockCell(q, c)) return `${what}: ${at(c)} is rock.`;
  return undefined;
}

const neighbours = (a: readonly number[], b: readonly number[]) =>
  Math.abs((a[0] as number) - (b[0] as number)) + Math.abs((a[1] as number) - (b[1] as number)) ===
  1;

// ---- empty quest

export interface NewQuestInput {
  id: string;
  number: number;
  title: string;
}

/**
 * A valid skeleton: start room R20 with a stairway, a placeholder summary, nothing else.
 * It has no objective yet, so `validateQuestIssues` reports that until one is added.
 */
export function emptyQuest(input: NewQuestInput): Quest {
  return QuestSchema.parse({
    schemaVersion: 1,
    id: input.id,
    number: input.number,
    title: input.title,
    intro: { summary: 'Write a short summary of this quest.' },
    start: { area: 'R20' },
    furniture: [
      {
        id: 'f-stairs',
        type: 'stairs',
        cells: [
          [1, 14],
          [2, 14],
          [1, 15],
          [2, 15],
        ],
      },
    ],
  });
}

// ---- text fields

export function renameQuest(q: Quest, title: string): EditResult {
  if (title.trim() === '') return fail('The title cannot be empty.');
  return ok({ ...q, title: title.trim() });
}

export function setSummary(q: Quest, summary: string): EditResult {
  if (summary.trim() === '') return fail('The summary cannot be empty.');
  return ok({ ...q, intro: { ...q.intro, summary: summary.trim() } });
}

// ---- start

export function setStartArea(q: Quest, area: string): EditResult {
  if (!/^R\d{2}$/.test(area) || cellsOf(board, area).length === 0)
    return fail(`${area} is not a room of the board.`);
  if (q.rock.rooms.includes(area)) return fail(`${area} is rock. Clear the rock first.`);
  return ok({ ...q, start: { area } });
}

// ---- rock

/** The first element that stands on any of these cells and cannot be in rock, as text. */
function rockConflict(q: Quest, cells: ReadonlySet<string>): string | undefined {
  const l = layers(q);
  for (const k of cells) {
    const c = k.split(',').map(Number) as Cell;
    const hit = conflict(l, c, ['blocks', 'furniture', 'stairs', 'monsters', 'traps', 'npcs']);
    if (hit) return `${hit} is on ${at(c)}`;
  }
  for (const m of q.monsters)
    if (m.cell && m.hidden && cells.has(key(m.cell))) return `monster ${m.id} is on ${at(m.cell)}`;
  for (const m of q.markers)
    if (cells.has(key(m.cell))) return `marker ${m.id} is on ${at(m.cell)}`;
  for (const d of [...q.doors, ...q.secretDoors])
    for (const c of [d.a, d.b]) if (cells.has(key(c))) return `door ${d.id} touches ${at(c)}`;
  return undefined;
}

export function setRockCell(q: Quest, cell: Cell, on: boolean): EditResult {
  if (!Number.isInteger(cell[0]) || !Number.isInteger(cell[1]) || !inBoard(board, cell[0], cell[1]))
    return fail(`${at(cell)} is outside the board.`);
  const room = areaAt(board, cell[0], cell[1]) as string;
  const inRockRoom = q.rock.rooms.includes(room);
  const listed = q.rock.cells.some((c) => cellEq(c, cell));
  if (on) {
    if (inRockRoom || listed) return ok(q);
    const hit = rockConflict(q, new Set([key(cell)]));
    if (hit) return fail(`Cannot make ${at(cell)} rock: ${hit}. Remove it first.`);
    return ok({
      ...q,
      rock: { ...q.rock, cells: [...q.rock.cells.map(copy), copy(cell)].sort(byRow) },
    });
  }
  if (inRockRoom)
    return fail(`${at(cell)} is part of rock room ${room}. Clear the whole room instead.`);
  if (!listed) return ok(q);
  return ok({ ...q, rock: { ...q.rock, cells: q.rock.cells.filter((c) => !cellEq(c, cell)) } });
}

export function setRockRoom(q: Quest, room: string, on: boolean): EditResult {
  const roomCells = cellsOf(board, room);
  if (!/^R\d{2}$/.test(room) || roomCells.length === 0)
    return fail(`${room} is not a room of the board.`);
  if (on) {
    if (q.rock.rooms.includes(room)) return ok(q);
    if (q.start.area === room)
      return fail(`${room} is the start room. Choose another start first.`);
    const hit = rockConflict(q, new Set(roomCells.map(key)));
    if (hit) return fail(`Cannot make ${room} rock: ${hit}. Remove it first.`);
    const rooms = [...q.rock.rooms, room].sort();
    // Single rock cells inside the room are now redundant.
    const cells = q.rock.cells.filter((c) => areaAt(board, c[0], c[1]) !== room);
    return ok({ ...q, rock: { rooms, cells } });
  }
  if (!q.rock.rooms.includes(room)) return ok(q);
  return ok({ ...q, rock: { ...q.rock, rooms: q.rock.rooms.filter((r) => r !== room) } });
}

// ---- doors

const DOOR_PREFIX: Record<DoorKind, string> = { normal: 'd', secret: 's', false: 'x' };
const DOOR_LIST = { normal: 'doors', secret: 'secretDoors', false: 'falseDoors' } as const;

function doorEdgeProblem(
  q: Quest,
  a: Cell,
  b: Cell,
  kind: DoorKind,
  ignoreId?: string,
): string | undefined {
  for (const c of [a, b])
    if (!Number.isInteger(c[0]) || !Number.isInteger(c[1]) || !inBoard(board, c[0], c[1]))
      return `${at(c)} is outside the board.`;
  if (!neighbours(a, b))
    return `${at(a)} and ${at(b)} are not next to each other. A door sits between two neighbouring squares.`;
  if (!isWallBetween(board, a, b))
    return `There is no wall between ${at(a)} and ${at(b)}, so a door cannot go there.`;
  const twin = allDoors(q).find(
    (d) =>
      d.id !== ignoreId &&
      ((cellEq(d.a, a) && cellEq(d.b, b)) || (cellEq(d.a, b) && cellEq(d.b, a))),
  );
  if (twin) return `Door ${twin.id} is already on that edge.`;
  if (kind !== 'false')
    for (const c of [a, b])
      if (isRockCell(q, c))
        return `A ${kind} door cannot touch rock (${at(c)}). Only a false door may.`;
  const l = layers(q);
  for (const c of [a, b]) {
    const hit = conflict(l, c, ['blocks', 'furniture']);
    if (hit) return `${hit} is on ${at(c)}, so a door cannot go there.`;
  }
  return undefined;
}

export function addDoor(q: Quest, a: Cell, b: Cell, kind: DoorKind = 'normal'): EditResult {
  const problem = doorEdgeProblem(q, a, b, kind);
  if (problem) return fail(problem);
  const id = nextId(
    DOOR_PREFIX[kind],
    allDoors(q).map((d) => d.id),
  );
  const list = DOOR_LIST[kind];
  return ok({ ...q, [list]: [...q[list], { id, a: copy(a), b: copy(b) }] });
}

export function removeDoor(q: Quest, id: string): EditResult {
  const found = allDoors(q).find((d) => d.id === id);
  if (!found) return fail(`There is no door ${id}.`);
  const next: Quest = {
    ...q,
    doors: q.doors.filter((d) => d.id !== id),
    secretDoors: q.secretDoors.filter((d) => d.id !== id),
    falseDoors: q.falseDoors.filter((d) => d.id !== id),
  };
  return ok(next, referencesTo(next, 'door', id));
}

/** Change a door between normal, secret and false. The id changes with the kind (d, s, x). */
export function setDoorKind(q: Quest, id: string, kind: DoorKind): EditResult {
  const found = allDoors(q).find((d) => d.id === id);
  if (!found) return fail(`There is no door ${id}.`);
  const current: DoorKind = q.doors.includes(found)
    ? 'normal'
    : q.secretDoors.includes(found)
      ? 'secret'
      : 'false';
  if (current === kind) return ok(q);
  const problem = doorEdgeProblem(q, found.a, found.b, kind, id);
  if (problem) return fail(problem);
  const rest = {
    doors: q.doors.filter((d) => d.id !== id),
    secretDoors: q.secretDoors.filter((d) => d.id !== id),
    falseDoors: q.falseDoors.filter((d) => d.id !== id),
  };
  const newId = nextId(
    DOOR_PREFIX[kind],
    [...rest.doors, ...rest.secretDoors, ...rest.falseDoors].map((d) => d.id),
  );
  const list = DOOR_LIST[kind];
  const moved: Quest = {
    ...q,
    ...rest,
    [list]: [...rest[list], { id: newId, a: found.a, b: found.b }],
  };
  const renamed = renameDoorRefs(moved, id, newId);
  const warnings: Issue[] =
    kind === 'secret'
      ? []
      : renamed.notes.flatMap((n) => {
          const bad: Issue[] = [];
          const walk = (e: Quest['notes'][number]['effects'][number]) => {
            if (e.type === 'addSecretDoor' && e.door === newId)
              bad.push({
                severity: 'warning',
                message: `note ${n.id} reveals door ${newId} as a secret door, but it is not secret now. Fix the note.`,
                ref: { kind: 'note', id: n.id },
              });
            if (e.type === 'promptChoice') e.options.forEach((o) => o.effects.forEach(walk));
          };
          n.effects.forEach(walk);
          return bad;
        });
  return ok(renamed, warnings);
}

// ---- blocks

export function addBlock(q: Quest, cells: Cell[]): EditResult {
  if (cells.length < 1 || cells.length > 2) return fail('A block is one or two squares.');
  if (cells.length === 2 && !neighbours(cells[0] as Cell, cells[1] as Cell))
    return fail('The two squares of a block must be neighbours.');
  const l = layers(q);
  for (const c of cells) {
    const p = floorProblem(q, c, 'Block');
    if (p) return fail(p);
    const hit = conflict(l, c, [
      'blocks',
      'furniture',
      'stairs',
      'monsters',
      'traps',
      'doors',
      'npcs',
    ]);
    if (hit) return fail(`Block: ${hit} is already on ${at(c)}.`);
  }
  return ok({ ...q, blocks: [...q.blocks, { cells: cells.map(copy) }] });
}

/** Remove the block that covers this square. */
export function removeBlock(q: Quest, cell: Cell): EditResult {
  const i = q.blocks.findIndex((b) => b.cells.some((c) => cellEq(c, cell)));
  if (i < 0) return fail(`There is no block on ${at(cell)}.`);
  return ok({ ...q, blocks: q.blocks.filter((_, j) => j !== i) });
}

// ---- furniture

export interface FurnitureOpts {
  id?: string;
  letter?: string;
}

function footprintProblem(
  q: Quest,
  type: FurnitureType,
  cells: readonly Cell[],
  ignoreId?: string,
): string | undefined {
  const what = type === 'stairs' ? 'Stairs' : 'Furniture';
  if (cells.length === 0) return `${what} needs at least one square.`;
  if (new Set(cells.map(key)).size !== cells.length) return `${what} lists the same square twice.`;
  for (const c of cells) {
    const p = floorProblem(q, c, what);
    if (p) return p;
  }
  const shape = footprintShapeProblem(board, cells, what);
  if (shape) return shape;
  const l = layers(q, ignoreId === undefined ? {} : { furniture: ignoreId });
  const names: LayerName[] =
    type === 'stairs'
      ? ['blocks', 'furniture', 'stairs', 'monsters', 'doors']
      : ['blocks', 'furniture', 'stairs', 'monsters', 'traps', 'doors', 'npcs'];
  for (const c of cells) {
    const hit = conflict(l, c, names);
    if (hit) return `${what}: ${hit} is already on ${at(c)}.`;
  }
  return undefined;
}

export function addFurniture(
  q: Quest,
  type: FurnitureType,
  cells: Cell[],
  opts: FurnitureOpts = {},
): EditResult {
  const p = footprintProblem(q, type, cells);
  if (p) return fail(p);
  const picked = pickId(
    'f',
    q.furniture.map((f) => f.id),
    opts.id,
    'furniture',
  );
  if ('error' in picked) return fail(picked.error);
  const letter = trimmed(opts.letter, 'letter');
  if (letter.error) return fail(letter.error);
  const item: FurnitureDef = clean({
    id: picked.id,
    type,
    cells: cells.map(copy),
    letter: letter.value,
  });
  return ok({ ...q, furniture: [...q.furniture, item] });
}

function replaceCells(q: Quest, id: string, cells: Cell[]): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(`There is no furniture ${id}.`);
  const p = footprintProblem(q, f.type, cells, id);
  if (p) return fail(p);
  return ok({ ...q, furniture: q.furniture.map((x) => (x.id === id ? { ...x, cells } : x)) });
}

/** Move a piece so that its first square lands on `to`. The shape stays the same. */
export function moveFurniture(q: Quest, id: string, to: Cell): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(`There is no furniture ${id}.`);
  const first = f.cells[0] as Cell;
  const dx = to[0] - first[0];
  const dy = to[1] - first[1];
  return replaceCells(
    q,
    id,
    f.cells.map((c): Cell => [c[0] + dx, c[1] + dy]),
  );
}

/** Turn a piece 90 degrees clockwise around its first square. */
export function rotateFurniture(q: Quest, id: string): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(`There is no furniture ${id}.`);
  const [ox, oy] = f.cells[0] as Cell;
  return replaceCells(
    q,
    id,
    f.cells.map((c): Cell => [ox - (c[1] - oy), oy + (c[0] - ox)]),
  );
}

/**
 * Remove a piece. Its chest trap goes with it. A note that has the same letter and nothing else
 * on the map for that letter is reported.
 */
export function removeFurniture(q: Quest, id: string): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(`There is no furniture ${id}.`);
  const goneTraps = q.traps.filter((t) => t.furniture === id).map((t) => t.id);
  const next: Quest = {
    ...q,
    furniture: q.furniture.filter((x) => x.id !== id),
    traps: q.traps.filter((t) => t.furniture !== id),
  };
  const warnings: Issue[] = goneTraps.flatMap((t) => referencesTo(next, 'trap', t));
  if (f.letter) {
    const stillOnMap =
      next.furniture.some((x) => x.letter === f.letter) ||
      next.markers.some((m) => m.label === f.letter);
    if (!stillOnMap)
      for (const n of next.notes)
        if (n.letter === f.letter && !n.at)
          warnings.push({
            severity: 'warning',
            message: `note ${n.id} has letter ${f.letter}, which is no longer on the map.`,
            ref: { kind: 'note', id: n.id },
          });
  }
  return ok(next, warnings);
}

// ---- monsters

export interface MonsterOpts {
  id?: string;
  name?: string;
  overrides?: NonNullable<MonsterDef['overrides']>;
  state?: MonsterDef['state'];
  spells?: string[];
  spellLimit?: MonsterDef['spellLimit'];
  traits?: string[];
  hidden?: boolean;
}

function monsterCellProblem(q: Quest, cell: Cell, skipId?: string): string | undefined {
  const p = floorProblem(q, cell, 'Monster');
  if (p) return p;
  const l = layers(q, skipId === undefined ? {} : { monster: skipId });
  const hit = conflict(l, cell, ['blocks', 'furniture', 'stairs', 'monsters']);
  if (hit) return `Monster: ${hit} is already on ${at(cell)}.`;
  return monsterStackProblem(q, cell);
}

/**
 * A monster never stands on an NPC (hidden monsters too). Door squares are allowed: the Quest
 * Book puts monsters right beside a door (quest 1, orc m16).
 */
function monsterStackProblem(q: Quest, cell: Cell): string | undefined {
  const hit = conflict(layers(q), cell, ['npcs']);
  if (hit) return `Monster: ${hit} is on ${at(cell)}, so a monster cannot stand there.`;
  return undefined;
}

/** `cell` may be null only for a hidden monster that an effect places later. */
export function addMonster(
  q: Quest,
  type: MonsterKind,
  cell: Cell | null,
  opts: MonsterOpts = {},
): EditResult {
  if (cell === null) {
    if (!opts.hidden) return fail('A monster needs a square, unless it is hidden.');
  } else if (opts.hidden) {
    const p = floorProblem(q, cell, 'Monster') ?? monsterStackProblem(q, cell);
    if (p) return fail(p);
  } else {
    const p = monsterCellProblem(q, cell);
    if (p) return fail(p);
  }
  const picked = pickId(
    'm',
    q.monsters.map((m) => m.id),
    opts.id,
    'monster',
  );
  if ('error' in picked) return fail(picked.error);
  const { id: _ignored, ...rest } = opts;
  void _ignored;
  const name = trimmed(opts.name, 'monster name');
  if (name.error) return fail(name.error);
  for (const list of [opts.traits, opts.spells])
    if (list?.some((t) => t.trim() === '')) return fail('Traits and spells cannot be empty text.');
  for (const [k, v] of Object.entries(opts.overrides ?? {}))
    if (v !== undefined && (!Number.isInteger(v) || v < 0))
      return fail(`The ${k} override must be a whole number, 0 or more.`);
  const m: MonsterDef = clean({
    id: picked.id,
    type,
    ...(cell ? { cell: copy(cell) } : {}),
    ...rest,
    name: name.value,
    ...(opts.traits ? { traits: opts.traits.map((t) => t.trim()) } : {}),
  });
  return ok({ ...q, monsters: [...q.monsters, m] });
}

export function moveMonster(q: Quest, id: string, cell: Cell): EditResult {
  const m = q.monsters.find((x) => x.id === id);
  if (!m) return fail(`There is no monster ${id}.`);
  const p = m.hidden
    ? (floorProblem(q, cell, 'Monster') ?? monsterStackProblem(q, cell))
    : monsterCellProblem(q, cell, id);
  if (p) return fail(p);
  return ok({
    ...q,
    monsters: q.monsters.map((x) => (x.id === id ? { ...x, cell: copy(cell) } : x)),
  });
}

export function removeMonster(q: Quest, id: string): EditResult {
  if (!q.monsters.some((m) => m.id === id)) return fail(`There is no monster ${id}.`);
  const next = { ...q, monsters: q.monsters.filter((m) => m.id !== id) };
  return ok(next, referencesTo(next, 'monster', id));
}

// ---- traps

export type TrapTarget = { cell: Cell } | { furniture: string };
export interface TrapOpts {
  id?: string;
  effect?: string;
}

export function addTrap(
  q: Quest,
  kind: TrapKind,
  target: TrapTarget,
  opts: TrapOpts = {},
): EditResult {
  let placed: { cell: Cell } | { furniture: string };
  if ('furniture' in target) {
    if (kind !== 'chest' && kind !== 'scripted')
      return fail(`A ${kind} trap goes on a square, not on furniture.`);
    const f = q.furniture.find((x) => x.id === target.furniture);
    if (!f) return fail(`There is no furniture ${target.furniture}.`);
    if (kind === 'chest' && q.traps.some((t) => t.furniture === f.id))
      return fail(`Furniture ${f.id} already has a trap.`);
    placed = { furniture: f.id };
  } else {
    if (kind === 'chest')
      return fail('A chest trap goes on a piece of furniture, not on a square.');
    const p = floorProblem(q, target.cell, 'Trap');
    if (p) return fail(p);
    // A trap may share a monster's square or a door square, but never stairs or an NPC.
    const hit = conflict(layers(q), target.cell, [
      'blocks',
      'furniture',
      'traps',
      'stairs',
      'npcs',
    ]);
    if (hit) return fail(`Trap: ${hit} is on ${at(target.cell)}, so a trap cannot go there.`);
    placed = { cell: copy(target.cell) };
  }
  const picked = pickId(
    't',
    q.traps.map((t) => t.id),
    opts.id,
    'trap',
  );
  if ('error' in picked) return fail(picked.error);
  const effect = trimmed(opts.effect, 'trap effect');
  if (effect.error) return fail(effect.error);
  const trap = clean({ id: picked.id, kind, ...placed, effect: effect.value });
  return ok({ ...q, traps: [...q.traps, trap] });
}

export function removeTrap(q: Quest, id: string): EditResult {
  if (!q.traps.some((t) => t.id === id)) return fail(`There is no trap ${id}.`);
  const next = { ...q, traps: q.traps.filter((t) => t.id !== id) };
  return ok(next, referencesTo(next, 'trap', id));
}

// ---- markers

export function addMarker(
  q: Quest,
  label: string,
  cell: Cell,
  visible?: 'zargon' | 'players',
  id?: string,
): EditResult {
  const text = label.trim();
  if (text === '') return fail('A marker needs a label.');
  const p = floorProblem(q, cell, 'Marker');
  if (p) return fail(p);
  const picked = pickId(
    'k',
    q.markers.map((m) => m.id),
    id,
    'marker',
  );
  if ('error' in picked) return fail(picked.error);
  const marker = clean({ id: picked.id, label: text, cell: copy(cell), visible });
  return ok({ ...q, markers: [...q.markers, marker] });
}

export function removeMarker(q: Quest, id: string): EditResult {
  if (!q.markers.some((m) => m.id === id)) return fail(`There is no marker ${id}.`);
  return ok({ ...q, markers: q.markers.filter((m) => m.id !== id) });
}

// ---- inspector: change properties of what is already on the map

/**
 * Change a piece of furniture's letter. `null` clears it. Stairs take no letter.
 * Warnings: a note that lost its letter on the map, or a new letter that has no note yet.
 */
export function setFurnitureLetter(q: Quest, id: string, letter: string | null): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(`There is no furniture ${id}.`);
  let next: string | undefined;
  if (letter !== null) {
    const t = trimmed(letter, 'letter');
    if (t.error) return fail(t.error);
    next = t.value;
    if (f.type === 'stairs') return fail('The stairs do not take a letter.');
  }
  const { letter: _old, ...rest } = f;
  void _old;
  const updated: FurnitureDef = clean({ ...rest, letter: next });
  const quest = { ...q, furniture: q.furniture.map((x) => (x.id === id ? updated : x)) };
  return ok(quest, newIssues(q, quest));
}

/** `null` clears a field; a missing key leaves it as it is. */
export interface MonsterPatch {
  type?: MonsterKind;
  name?: string | null;
  /** Replaces all stat overrides. `null` or `{}` clears them. */
  overrides?: NonNullable<MonsterDef['overrides']> | null;
  state?: NonNullable<MonsterDef['state']> | null;
  spells?: string[] | null;
  spellLimit?: NonNullable<MonsterDef['spellLimit']> | null;
  traits?: string[] | null;
  hidden?: boolean | null;
}

/**
 * Change the properties of a monster. Its square stays (use `moveMonster` to move it).
 * Refused: a spell the app does not know, a spell limit without spells, a negative or fractional
 * stat, empty text, a shown monster with no square or on an occupied square.
 */
export function updateMonster(q: Quest, id: string, patch: MonsterPatch): EditResult {
  const m = q.monsters.find((x) => x.id === id);
  if (!m) return fail(`There is no monster ${id}.`);
  const next: Record<string, unknown> = { ...m };
  const set = (key: string, value: unknown) => {
    if (value === null || value === undefined) delete next[key];
    else next[key] = value;
  };
  if (patch.type !== undefined) next.type = patch.type;
  if (patch.name !== undefined) {
    if (patch.name === null) set('name', null);
    else {
      const t = trimmed(patch.name, 'monster name');
      if (t.error) return fail(t.error);
      set('name', t.value);
    }
  }
  if (patch.overrides !== undefined) {
    const o = patch.overrides;
    for (const [k, v] of Object.entries(o ?? {}))
      if (v !== undefined && (!Number.isInteger(v) || v < 0))
        return fail(`The ${k} override must be a whole number, 0 or more.`);
    const kept = o ? clean({ ...o }) : {};
    set('overrides', Object.keys(kept).length ? kept : null);
  }
  if (patch.state !== undefined) set('state', patch.state);
  if (patch.traits !== undefined) {
    if (patch.traits?.some((t) => t.trim() === ''))
      return fail('Traits and spells cannot be empty text.');
    set('traits', patch.traits?.length ? patch.traits.map((t) => t.trim()) : null);
  }
  if (patch.spells !== undefined) {
    if (patch.spells?.some((t) => t.trim() === ''))
      return fail('Traits and spells cannot be empty text.');
    const bad = patch.spells?.find((s) => !isSpellKey(s));
    if (bad) return fail(`Unknown spell "${bad}". Known spells: ${SPELL_KEYS.join(', ')}.`);
    set('spells', patch.spells?.length ? patch.spells : null);
  }
  if (patch.spellLimit !== undefined) set('spellLimit', patch.spellLimit);
  if (patch.hidden !== undefined) set('hidden', patch.hidden === true ? true : null);
  if (next.spellLimit && !(next.spells as string[] | undefined)?.length)
    return fail('A spell limit needs at least one spell.');
  const cell = m.cell;
  if (next.hidden !== true) {
    if (!cell) return fail('A monster that is shown needs a square. Move it onto the board first.');
    const p = monsterCellProblem(q, cell, id);
    if (p) return fail(p);
  }
  const quest = {
    ...q,
    monsters: q.monsters.map((x) => (x.id === id ? (next as MonsterDef) : x)),
  };
  return ok(quest, newIssues(q, quest));
}

export interface TrapPatch {
  kind?: TrapKind;
  /** Where the trap is. Needed when the new kind does not fit the old place. */
  target?: TrapTarget;
  /** `null` clears the effect text. */
  effect?: string | null;
}

/**
 * Change a trap: its kind, its place and its effect text. A chest trap sits on furniture, pit,
 * falling block and spear on a square, a scripted trap on either. The id stays the same, so notes
 * that point at the trap keep working.
 */
export function updateTrap(q: Quest, id: string, patch: TrapPatch): EditResult {
  const index = q.traps.findIndex((t) => t.id === id);
  const t = q.traps[index];
  if (!t) return fail(`There is no trap ${id}.`);
  const kind = patch.kind ?? t.kind;
  let target: TrapTarget | undefined = patch.target;
  if (!target) {
    if (kind === 'chest' && !t.furniture)
      return fail('A chest trap goes on a piece of furniture. Pick the furniture.');
    if ((kind === 'pit' || kind === 'fallingBlock' || kind === 'spear') && !t.cell)
      return fail(`A ${kind} trap goes on a square. Pick the square.`);
    target = t.furniture ? { furniture: t.furniture } : t.cell ? { cell: t.cell } : undefined;
  }
  if (!target) return fail('Pick a square or a piece of furniture for the trap.');
  const effect =
    patch.effect === undefined ? t.effect : patch.effect === null ? undefined : patch.effect;
  const without: Quest = { ...q, traps: q.traps.filter((x) => x.id !== id) };
  const r = addTrap(without, kind, target, clean({ id, effect }));
  if (!r.ok) return r;
  const placed = r.quest.traps[r.quest.traps.length - 1]!;
  const traps = [...without.traps];
  traps.splice(index, 0, placed);
  const quest = { ...q, traps };
  return ok(quest, newIssues(q, quest));
}

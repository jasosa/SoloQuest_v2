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
import { tr } from '../../i18n/translate';
import { areaAt, board, cellsOf, inBoard, isWallBetween } from '../board/board';
import { mergedWallRooms } from '../board/level';
import { abilityLookup } from '../data/abilities';
import { spellLookup } from '../data/spells';
import {
  QuestSchema,
  type FurnitureDef,
  type MonsterBehavior,
  type MonsterDef,
  type Quest,
} from '../quest/schema';
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
  return t === ''
    ? { error: tr('editor.ops.theCannotBeEmpty', 'The {what} cannot be empty.', { what }) }
    : { value: t };
}

function pickId(
  prefix: string,
  taken: Iterable<string>,
  wanted: string | undefined,
  what: string,
): { id: string } | { error: string } {
  if (wanted === undefined) return { id: nextId(prefix, taken) };
  if (wanted.trim() === '')
    return {
      error: tr('editor.ops.theIdCannotBeEmpty', 'The {what} id cannot be empty.', { what }),
    };
  if (!ID_PATTERN.test(wanted))
    return {
      error: tr(
        'editor.ops.theIdCanOnlyUseLetters',
        'The {what} id "{wanted}" can only use letters, numbers, - and _, and must start with a letter or number.',
        { what, wanted },
      ),
    };
  if (new Set(taken).has(wanted))
    return {
      error: tr('editor.ops.aWithIdAlreadyExists', 'A {what} with id {wanted} already exists.', {
        what,
        wanted,
      }),
    };
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
    return tr('editor.ops.isOutsideTheBoard', '{what}: {at} is outside the board.', {
      what,
      at: at(c),
    });
  if (isRockCell(q, c))
    return tr('editor.ops.isRock', '{what}: {at} is rock.', { what, at: at(c) });
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
  if (title.trim() === '')
    return fail(tr('editor.ops.theTitleCannotBeEmpty', 'The title cannot be empty.'));
  return ok({ ...q, title: title.trim() });
}

export function setSummary(q: Quest, summary: string): EditResult {
  if (summary.trim() === '')
    return fail(tr('editor.ops.theSummaryCannotBeEmpty', 'The summary cannot be empty.'));
  return ok({ ...q, intro: { ...q.intro, summary: summary.trim() } });
}

// ---- start

export function setStartArea(q: Quest, area: string): EditResult {
  if (!/^R\d{2}$/.test(area) || cellsOf(board, area).length === 0)
    return fail(tr('editor.ops.isNotARoomOfThe', '{area} is not a room of the board.', { area }));
  if (q.rock.rooms.includes(area))
    return fail(
      tr('editor.ops.isRockClearTheRockFirst', '{area} is rock. Clear the rock first.', { area }),
    );
  return ok({ ...q, start: { area } });
}

// ---- rock

/** The first element that stands on any of these cells and cannot be in rock, as text. */
function rockConflict(q: Quest, cells: ReadonlySet<string>): string | undefined {
  const l = layers(q);
  for (const k of cells) {
    const c = k.split(',').map(Number) as Cell;
    const hit = conflict(l, c, ['blocks', 'furniture', 'stairs', 'monsters', 'traps', 'npcs']);
    if (hit) return tr('editor.ops.isOn', '{hit} is on {at}', { hit, at: at(c) });
  }
  for (const m of q.monsters)
    if (m.cell && m.hidden && cells.has(key(m.cell)))
      return tr('editor.ops.monsterIsOn', 'monster {id} is on {at}', { id: m.id, at: at(m.cell) });
  for (const m of q.markers)
    if (cells.has(key(m.cell)))
      return tr('editor.ops.markerIsOn', 'marker {id} is on {at}', { id: m.id, at: at(m.cell) });
  for (const d of [...q.doors, ...q.secretDoors])
    for (const c of [d.a, d.b])
      if (cells.has(key(c)))
        return tr('editor.ops.doorTouches', 'door {id} touches {at}', { id: d.id, at: at(c) });
  return undefined;
}

export function setRockCell(q: Quest, cell: Cell, on: boolean): EditResult {
  if (!Number.isInteger(cell[0]) || !Number.isInteger(cell[1]) || !inBoard(board, cell[0], cell[1]))
    return fail(
      tr('editor.ops.isOutsideTheBoard2', '{at} is outside the board.', { at: at(cell) }),
    );
  const room = areaAt(board, cell[0], cell[1]) as string;
  const inRockRoom = q.rock.rooms.includes(room);
  const listed = q.rock.cells.some((c) => cellEq(c, cell));
  if (on) {
    if (inRockRoom || listed) return ok(q);
    const hit = rockConflict(q, new Set([key(cell)]));
    if (hit)
      return fail(
        tr(
          'editor.ops.cannotMakeRockRemoveItFirst',
          'Cannot make {at} rock: {hit}. Remove it first.',
          { at: at(cell), hit },
        ),
      );
    return ok({
      ...q,
      rock: { ...q.rock, cells: [...q.rock.cells.map(copy), copy(cell)].sort(byRow) },
    });
  }
  if (inRockRoom)
    return fail(
      tr(
        'editor.ops.isPartOfRockRoomClear',
        '{at} is part of rock room {room}. Clear the whole room instead.',
        { at: at(cell), room },
      ),
    );
  if (!listed) return ok(q);
  return ok({ ...q, rock: { ...q.rock, cells: q.rock.cells.filter((c) => !cellEq(c, cell)) } });
}

export function setRockRoom(q: Quest, room: string, on: boolean): EditResult {
  const roomCells = cellsOf(board, room);
  if (!/^R\d{2}$/.test(room) || roomCells.length === 0)
    return fail(tr('editor.ops.isNotARoomOfThe2', '{room} is not a room of the board.', { room }));
  if (on) {
    if (q.rock.rooms.includes(room)) return ok(q);
    if (q.start.area === room)
      return fail(
        tr(
          'editor.ops.isTheStartRoomChooseAnother',
          '{room} is the start room. Choose another start first.',
          { room },
        ),
      );
    const hit = rockConflict(q, new Set(roomCells.map(key)));
    if (hit)
      return fail(
        tr(
          'editor.ops.cannotMakeRockRemoveItFirst2',
          'Cannot make {room} rock: {hit}. Remove it first.',
          { room, hit },
        ),
      );
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
      return tr('editor.ops.isOutsideTheBoard2', '{at} is outside the board.', { at: at(c) });
  if (!neighbours(a, b))
    return tr(
      'editor.ops.andAreNotNextToEach',
      '{at} and {at2} are not next to each other. A door sits between two neighbouring squares.',
      { at: at(a), at2: at(b) },
    );
  if (!isWallBetween(board, a, b))
    return tr(
      'editor.ops.thereIsNoWallBetweenAnd',
      'There is no wall between {at} and {at2}, so a door cannot go there.',
      { at: at(a), at2: at(b) },
    );
  // [proposal] merged rooms are one room: no door on the wall that merging removed
  const gone = mergedWallRooms(board, q.areaOverrides, a, b);
  if (gone)
    return tr(
      'editor.ops.doorOnMergedWall',
      'Cannot add a door: {a} and {b} are one room. Split them first.',
      { a: gone[0], b: gone[1] },
    );
  const twin = allDoors(q).find(
    (d) =>
      d.id !== ignoreId &&
      ((cellEq(d.a, a) && cellEq(d.b, b)) || (cellEq(d.a, b) && cellEq(d.b, a))),
  );
  if (twin)
    return tr('editor.ops.doorIsAlreadyOnThatEdge', 'Door {id} is already on that edge.', {
      id: twin.id,
    });
  if (kind !== 'false')
    for (const c of [a, b])
      if (isRockCell(q, c))
        return tr(
          'editor.ops.aDoorCannotTouchRockOnly',
          'A {kind} door cannot touch rock ({at}). Only a false door may.',
          { kind, at: at(c) },
        );
  const l = layers(q);
  for (const c of [a, b]) {
    const hit = conflict(l, c, ['blocks', 'furniture']);
    if (hit)
      return tr('editor.ops.isOnSoADoorCannot', '{hit} is on {at}, so a door cannot go there.', {
        hit,
        at: at(c),
      });
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
  if (!found) return fail(tr('editor.ops.thereIsNoDoor', 'There is no door {id}.', { id }));
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
  if (!found) return fail(tr('editor.ops.thereIsNoDoor', 'There is no door {id}.', { id }));
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
    [list]: [
      ...rest[list],
      clean({
        id: newId,
        a: found.a,
        b: found.b,
        hiddenUntil: found.hiddenUntil,
        lockedUntil: found.lockedUntil,
      }),
    ],
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
                message: tr(
                  'editor.ops.noteRevealsDoorAsASecret',
                  'note {id} reveals door {newId} as a secret door, but it is not secret now. Fix the note.',
                  { id: n.id, newId },
                ),
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
  if (cells.length < 1 || cells.length > 2)
    return fail(tr('editor.ops.aBlockIsOneOrTwo', 'A block is one or two squares.'));
  if (cells.length === 2 && !neighbours(cells[0] as Cell, cells[1] as Cell))
    return fail(
      tr('editor.ops.theTwoSquaresOfABlock', 'The two squares of a block must be neighbours.'),
    );
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
    if (hit)
      return fail(
        tr('editor.ops.blockIsAlreadyOn', 'Block: {hit} is already on {at}.', { hit, at: at(c) }),
      );
  }
  return ok({ ...q, blocks: [...q.blocks, { cells: cells.map(copy) }] });
}

/** Remove the block that covers this square. */
export function removeBlock(q: Quest, cell: Cell): EditResult {
  const i = q.blocks.findIndex((b) => b.cells.some((c) => cellEq(c, cell)));
  if (i < 0)
    return fail(tr('editor.ops.thereIsNoBlockOn', 'There is no block on {at}.', { at: at(cell) }));
  return ok({ ...q, blocks: q.blocks.filter((_, j) => j !== i) });
}

// ---- furniture

export interface FurnitureOpts {
  id?: string;
  letter?: string;
  /** Quarter turns of the picture, as the editor stores them (1 to 3). */
  turn?: 1 | 2 | 3;
}

function footprintProblem(
  q: Quest,
  type: FurnitureType,
  cells: readonly Cell[],
  ignoreId?: string,
): string | undefined {
  const what = type === 'stairs' ? 'Stairs' : 'Furniture';
  if (cells.length === 0)
    return tr('editor.ops.needsAtLeastOneSquare', '{what} needs at least one square.', { what });
  if (new Set(cells.map(key)).size !== cells.length)
    return tr('editor.ops.listsTheSameSquareTwice', '{what} lists the same square twice.', {
      what,
    });
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
    if (hit)
      return tr('editor.ops.isAlreadyOn', '{what}: {hit} is already on {at}.', {
        what,
        hit,
        at: at(c),
      });
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
    turn: opts.turn,
  });
  return ok({ ...q, furniture: [...q.furniture, item] });
}

function replaceCells(q: Quest, id: string, cells: Cell[]): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(tr('editor.ops.thereIsNoFurniture', 'There is no furniture {id}.', { id }));
  const p = footprintProblem(q, f.type, cells, id);
  if (p) return fail(p);
  return ok({ ...q, furniture: q.furniture.map((x) => (x.id === id ? { ...x, cells } : x)) });
}

/** Move a piece so that its first square lands on `to`. The shape stays the same. */
export function moveFurniture(q: Quest, id: string, to: Cell): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(tr('editor.ops.thereIsNoFurniture', 'There is no furniture {id}.', { id }));
  const first = f.cells[0] as Cell;
  const dx = to[0] - first[0];
  const dy = to[1] - first[1];
  return replaceCells(
    q,
    id,
    f.cells.map((c): Cell => [c[0] + dx, c[1] + dy]),
  );
}

/**
 * Turn a piece 90 degrees clockwise, in place: around the middle of its squares, so a half turn keeps
 * the same squares and four turns bring it back. It never refuses because the new squares are taken
 * (the piece may sit on a wall, a block or another piece for a moment, so that a second turn can
 * reach a free position): it warns, and the checks of Save and Playtest look at the final position.
 * It only refuses squares outside the board. `turn` counts the quarter turns, so a picture turns too.
 */
export function rotateFurniture(q: Quest, id: string): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(tr('editor.ops.thereIsNoFurniture', 'There is no furniture {id}.', { id }));
  const xs = f.cells.map((c) => c[0]);
  const ys = f.cells.map((c) => c[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const turn = f.turn ?? 0;
  // A half square is rounded up on one turn and down on the next, so four turns give the start back.
  const snap = (v: number) => (turn % 2 === 0 ? Math.floor(v + 0.5) : Math.ceil(v - 0.5));
  const cells = f.cells.map((c): Cell => [snap(cx - (c[1] - cy)), snap(cy + (c[0] - cx))]);
  if (cells.some((c) => !inBoard(board, c[0], c[1])))
    return fail(
      tr(
        'editor.ops.thereIsNoRoomToTurn',
        'There is no room to turn it here: it would leave the board.',
      ),
    );
  const next = (turn + 1) % 4;
  const turned: FurnitureDef = { ...f, cells };
  if (next === 0) delete turned.turn;
  else turned.turn = next as 1 | 2 | 3;
  const problem = footprintProblem(q, f.type, cells, id);
  const warnings: Issue[] = problem
    ? [
        {
          severity: 'warning',
          message: tr(
            'editor.ops.turnItAgainOrMoveIt',
            '{problem} Turn it again or move it: Save and Playtest need a position that fits.',
            { problem },
          ),
          ref: { kind: 'furniture', id },
        },
      ]
    : [];
  return ok({ ...q, furniture: q.furniture.map((x) => (x.id === id ? turned : x)) }, warnings);
}

/**
 * Remove a piece. Its chest trap goes with it. A note that has the same letter and nothing else
 * on the map for that letter is reported.
 */
export function removeFurniture(q: Quest, id: string): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(tr('editor.ops.thereIsNoFurniture', 'There is no furniture {id}.', { id }));
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
            message: tr(
              'editor.ops.noteHasLetterWhichIsNo',
              'note {id} has letter {letter}, which is no longer on the map.',
              { id: n.id, letter: f.letter },
            ),
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
  if (hit)
    return tr('editor.ops.monsterIsAlreadyOn', 'Monster: {hit} is already on {at}.', {
      hit,
      at: at(cell),
    });
  return monsterStackProblem(q, cell);
}

/**
 * A monster never stands on an NPC (hidden monsters too). Door squares are allowed: the Quest
 * Book puts monsters right beside a door (quest 1, orc m16).
 */
function monsterStackProblem(q: Quest, cell: Cell): string | undefined {
  const hit = conflict(layers(q), cell, ['npcs']);
  if (hit)
    return tr(
      'editor.ops.monsterIsOnSoAMonster',
      'Monster: {hit} is on {at}, so a monster cannot stand there.',
      { hit, at: at(cell) },
    );
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
    if (!opts.hidden)
      return fail(
        tr(
          'editor.ops.aMonsterNeedsASquareUnless',
          'A monster needs a square, unless it is hidden.',
        ),
      );
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
    if (list?.some((t) => t.trim() === ''))
      return fail(
        tr('editor.ops.traitsAndSpellsCannotBeEmpty', 'Traits and spells cannot be empty text.'),
      );
  for (const [k, v] of Object.entries(opts.overrides ?? {}))
    if (v !== undefined && (!Number.isInteger(v) || v < 0))
      return fail(
        tr(
          'editor.ops.theOverrideMustBeAWhole',
          'The {k} override must be a whole number, 0 or more.',
          { k },
        ),
      );
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
  if (!m) return fail(tr('editor.ops.thereIsNoMonster', 'There is no monster {id}.', { id }));
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
  if (!q.monsters.some((m) => m.id === id))
    return fail(tr('editor.ops.thereIsNoMonster', 'There is no monster {id}.', { id }));
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
  // An ice slide needs a path of squares; the editor cannot draw one yet.
  if (kind === 'iceSlide')
    return fail(tr('editor.ops.iceSlidesAreNotInThe', 'Ice slides are not in the editor yet.'));
  if ('furniture' in target) {
    if (kind !== 'chest' && kind !== 'scripted')
      return fail(
        tr('editor.ops.aTrapGoesOnASquare', 'A {kind} trap goes on a square, not on furniture.', {
          kind,
        }),
      );
    const f = q.furniture.find((x) => x.id === target.furniture);
    if (!f)
      return fail(
        tr('editor.ops.thereIsNoFurniture5', 'There is no furniture {furniture}.', {
          furniture: target.furniture,
        }),
      );
    if (kind === 'chest' && q.traps.some((t) => t.furniture === f.id))
      return fail(
        tr('editor.ops.furnitureAlreadyHasATrap', 'Furniture {id} already has a trap.', {
          id: f.id,
        }),
      );
    placed = { furniture: f.id };
  } else {
    if (kind === 'chest')
      return fail(
        tr(
          'editor.ops.aChestTrapGoesOnA',
          'A chest trap goes on a piece of furniture, not on a square.',
        ),
      );
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
    if (hit)
      return fail(
        tr('editor.ops.trapIsOnSoATrap', 'Trap: {hit} is on {at}, so a trap cannot go there.', {
          hit,
          at: at(target.cell),
        }),
      );
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
  if (!q.traps.some((t) => t.id === id))
    return fail(tr('editor.ops.thereIsNoTrap', 'There is no trap {id}.', { id }));
  const next = { ...q, traps: q.traps.filter((t) => t.id !== id) };
  return ok(next, referencesTo(next, 'trap', id));
}

// ---- markers

export function addMarker(
  q: Quest,
  label: string,
  cell: Cell,
  visible?: 'editor' | 'players',
  id?: string,
): EditResult {
  const text = label.trim();
  if (text === '') return fail(tr('editor.ops.aMarkerNeedsALabel', 'A marker needs a label.'));
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

/** Change the label or the visibility of a marker that is already placed. */
export function updateMarker(
  q: Quest,
  id: string,
  patch: { label?: string; visible?: 'editor' | 'players' },
): EditResult {
  const m = q.markers.find((x) => x.id === id);
  if (!m) return fail(tr('editor.ops.thereIsNoMarker', 'There is no marker {id}.', { id }));
  const label = patch.label === undefined ? m.label : patch.label.trim();
  if (label === '') return fail(tr('editor.ops.aMarkerNeedsALabel', 'A marker needs a label.'));
  const next = clean({ ...m, label, visible: patch.visible ?? m.visible });
  return ok({ ...q, markers: q.markers.map((x) => (x.id === id ? next : x)) });
}

export function removeMarker(q: Quest, id: string): EditResult {
  if (!q.markers.some((m) => m.id === id))
    return fail(tr('editor.ops.thereIsNoMarker', 'There is no marker {id}.', { id }));
  return ok({ ...q, markers: q.markers.filter((m) => m.id !== id) });
}

// ---- zones (decision 68)

/** A new zone with its first square. More squares are added with `toggleZoneCell`. */
export function addZone(q: Quest, cell: Cell, id?: string): EditResult {
  const p = floorProblem(q, cell, 'Zone');
  if (p) return fail(p);
  const picked = pickId(
    'z',
    q.zones.map((z) => z.id),
    id,
    'zone',
  );
  if ('error' in picked) return fail(picked.error);
  return ok({ ...q, zones: [...q.zones, { id: picked.id, cells: [copy(cell)] }] });
}

/** Add the square to the zone, or take it out when it is already part of it. */
export function toggleZoneCell(q: Quest, zoneId: string, cell: Cell): EditResult {
  const z = q.zones.find((x) => x.id === zoneId);
  if (!z) return fail(tr('editor.ops.thereIsNoZone', 'There is no zone {zoneId}.', { zoneId }));
  let cells: [number, number][];
  if (z.cells.some((c) => cellEq(c, cell))) {
    if (z.cells.length === 1)
      return fail(
        tr(
          'editor.ops.aZoneNeedsAtLeastOne',
          'A zone needs at least one square. Delete the zone instead.',
        ),
      );
    cells = z.cells.filter((c) => !cellEq(c, cell)).map((c) => [c[0], c[1]]);
  } else {
    const p = floorProblem(q, cell, 'Zone');
    if (p) return fail(p);
    cells = [...z.cells.map((c) => [c[0], c[1]] as [number, number]), copy(cell)];
  }
  return ok({ ...q, zones: q.zones.map((x) => (x.id === zoneId ? { ...x, cells } : x)) });
}

/** Remove a zone. Notes that still point at it come back as warnings. */
export function removeZone(q: Quest, id: string): EditResult {
  if (!q.zones.some((z) => z.id === id))
    return fail(tr('editor.ops.thereIsNoZone2', 'There is no zone {id}.', { id }));
  const quest = { ...q, zones: q.zones.filter((z) => z.id !== id) };
  return ok(quest, newIssues(q, quest));
}

// ---- inspector: change properties of what is already on the map

/**
 * Change a piece of furniture's letter. `null` clears it. Stairs take no letter.
 * Warnings: a note that lost its letter on the map, or a new letter that has no note yet.
 */
export function setFurnitureLetter(q: Quest, id: string, letter: string | null): EditResult {
  const f = q.furniture.find((x) => x.id === id);
  if (!f) return fail(tr('editor.ops.thereIsNoFurniture', 'There is no furniture {id}.', { id }));
  let next: string | undefined;
  if (letter !== null) {
    const t = trimmed(letter, 'letter');
    if (t.error) return fail(t.error);
    next = t.value;
    if (f.type === 'stairs')
      return fail(tr('editor.ops.theStairsDoNotTakeA', 'The stairs do not take a letter.'));
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
  /** Spell id to its place of offer (1 = first). A spell without a place is random. `null` clears all. */
  spellOrder?: Record<string, number> | null;
  traits?: string[] | null;
  hidden?: boolean | null;
  /** Story-critical monster (decision 69). `null` or `false` clears it. */
  special?: boolean | null;
  /** Ability ids (core or the quest's own). `null` or `[]` clears them. */
  abilities?: string[] | null;
  /** An enemy of the quest (`enemyDefs`) that gives defaults (decision 70). `null` clears it. */
  enemy?: string | null;
  /** Waits for, goes toward (decision 71). `null` or `{}` clears it. */
  behavior?: MonsterBehavior | null;
  /** Attacked, not fought: no wounds and no Slain; the quest's actions say what an attack does. `null` or `false` clears it. */
  attackOnly?: boolean | null;
  /** Attacks per turn (2 or 3; 1 or `null` clears it, the enemy's own number applies). */
  attacks?: number | null;
  /** 2 draws it over 2 x 2 squares from its square (a large monster). 1 or `null` clears it. */
  size?: number | null;
}

/**
 * Change the properties of a monster. Its square stays (use `moveMonster` to move it).
 * Refused: a spell the app does not know, a spell limit without spells, a negative or fractional
 * stat, empty text, a shown monster with no square or on an occupied square.
 */
export function updateMonster(q: Quest, id: string, patch: MonsterPatch): EditResult {
  const m = q.monsters.find((x) => x.id === id);
  if (!m) return fail(tr('editor.ops.thereIsNoMonster', 'There is no monster {id}.', { id }));
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
        return fail(
          tr(
            'editor.ops.theOverrideMustBeAWhole',
            'The {k} override must be a whole number, 0 or more.',
            { k },
          ),
        );
    const kept = o ? clean({ ...o }) : {};
    set('overrides', Object.keys(kept).length ? kept : null);
  }
  if (patch.state !== undefined) set('state', patch.state);
  if (patch.traits !== undefined) {
    if (patch.traits?.some((t) => t.trim() === ''))
      return fail(
        tr('editor.ops.traitsAndSpellsCannotBeEmpty', 'Traits and spells cannot be empty text.'),
      );
    set('traits', patch.traits?.length ? patch.traits.map((t) => t.trim()) : null);
  }
  if (patch.spells !== undefined) {
    if (patch.spells?.some((t) => t.trim() === ''))
      return fail(
        tr('editor.ops.traitsAndSpellsCannotBeEmpty', 'Traits and spells cannot be empty text.'),
      );
    const known = spellLookup(q);
    const bad = patch.spells?.find((s) => !known.has(s));
    if (bad)
      return fail(
        tr('editor.ops.unknownSpellKnownSpells', 'Unknown spell "{bad}". Known spells: {join}.', {
          bad,
          join: [...known.keys()].join(', '),
        }),
      );
    set('spells', patch.spells?.length ? patch.spells : null);
  }
  if (patch.behavior !== undefined) {
    const b = patch.behavior;
    if (
      b &&
      (b.goesToward === 'marker' || b.goesToward === 'guardMarker') &&
      !q.markers.some((k) => k.id === b.marker)
    )
      return fail(
        tr(
          'editor.ops.pickAMarkerForGoesToward',
          'Pick a marker for "goes toward a marked square". Add one with the Markers tool.',
        ),
      );
    const kept = b ? clean({ ...b }) : {};
    set('behavior', Object.keys(kept).length ? kept : null);
  }
  if (patch.enemy !== undefined) {
    if (patch.enemy !== null && !q.enemyDefs.some((e) => e.id === patch.enemy))
      return fail(
        tr('editor.ops.unknownEnemy', 'Unknown enemy "{enemy}".', { enemy: patch.enemy }),
      );
    set('enemy', patch.enemy);
  }
  if (patch.spellLimit !== undefined) set('spellLimit', patch.spellLimit);
  if (patch.spellOrder !== undefined) {
    for (const [k, v] of Object.entries(patch.spellOrder ?? {}))
      if (!Number.isInteger(v) || v < 1 || v > 9)
        return fail(
          tr(
            'editor.ops.thePlaceOfMustBeA',
            'The place of {k} must be a whole number from 1 to 9.',
            { k },
          ),
        );
    set(
      'spellOrder',
      patch.spellOrder && Object.keys(patch.spellOrder).length ? patch.spellOrder : null,
    );
  }
  // A place only makes sense for a spell the monster has.
  if (next.spellOrder) {
    const have = new Set(next.spells as string[] | undefined);
    const kept = Object.fromEntries(
      Object.entries(next.spellOrder as Record<string, number>).filter(([k]) => have.has(k)),
    );
    set('spellOrder', Object.keys(kept).length ? kept : null);
  }
  if (patch.hidden !== undefined) set('hidden', patch.hidden === true ? true : null);
  if (patch.special !== undefined) set('special', patch.special === true ? true : null);
  if (patch.attackOnly !== undefined) set('attackOnly', patch.attackOnly === true ? true : null);
  if (patch.attacks !== undefined) {
    const a = patch.attacks;
    if (a !== null && (!Number.isInteger(a) || a < 1 || a > 3))
      return fail(
        tr('editor.ops.attacksPerTurnIsAWhole', 'Attacks per turn is a whole number from 1 to 3.'),
      );
    set('attacks', a === null || a === 1 ? null : a);
  }
  if (patch.size !== undefined) {
    const z = patch.size;
    if (z !== null && z !== 1 && z !== 2)
      return fail(tr('editor.ops.aMonsterIs1SquareOr', 'A monster is 1 square or 2 x 2 squares.'));
    set('size', z === null || z === 1 ? null : z);
  }
  if (patch.abilities !== undefined) {
    const known = abilityLookup(q);
    const bad = patch.abilities?.find((a) => !known.has(a));
    if (bad) return fail(tr('editor.ops.unknownAbility', 'Unknown ability "{bad}".', { bad }));
    set('abilities', patch.abilities?.length ? [...new Set(patch.abilities)] : null);
  }
  if (next.spellLimit && !(next.spells as string[] | undefined)?.length)
    return fail(
      tr('editor.ops.aSpellLimitNeedsAtLeast', 'A spell limit needs at least one spell.'),
    );
  const cell = m.cell;
  if (next.hidden !== true) {
    if (!cell)
      return fail(
        tr(
          'editor.ops.aMonsterThatIsShownNeeds',
          'A monster that is shown needs a square. Move it onto the board first.',
        ),
      );
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
  if (!t) return fail(tr('editor.ops.thereIsNoTrap', 'There is no trap {id}.', { id }));
  const kind = patch.kind ?? t.kind;
  let target: TrapTarget | undefined = patch.target;
  if (!target) {
    if (kind === 'chest' && !t.furniture)
      return fail(
        tr(
          'editor.ops.aChestTrapGoesOnA2',
          'A chest trap goes on a piece of furniture. Pick the furniture.',
        ),
      );
    if (kind !== 'chest' && kind !== 'scripted' && !t.cell)
      return fail(
        tr('editor.ops.aTrapGoesOnASquare2', 'A {kind} trap goes on a square. Pick the square.', {
          kind,
        }),
      );
    target = t.furniture ? { furniture: t.furniture } : t.cell ? { cell: t.cell } : undefined;
  }
  if (!target)
    return fail(
      tr('editor.ops.pickASquareOrAPiece', 'Pick a square or a piece of furniture for the trap.'),
    );
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

/**
 * Semantic checks of a parsed quest against the board (the Zod schema checks structure only).
 * `validateQuestIssues` returns structured issues the editor can jump to; `validateQuest`
 * returns the plain error messages of the game checks (empty means ok).
 */
import { areaAt, cellsOf, inBoard, roomIds, type Board } from '../board/board';
import {
  buildLevel,
  blocksMove,
  edgeKey,
  isWall,
  keyOf,
  mergedBoard,
  outsideOf,
  parseKey,
  type Level,
} from '../board/level';
import { footprintShapeProblem } from './footprint';
import { CORE_ABILITIES } from '../data/abilities';
import { CORE_SPELLS } from '../data/spells';
import { forEachEffect } from './effects';
import type { Condition, Effect, Quest } from './schema';

type C = readonly [number, number];
const key = (c: C) => `${c[0]},${c[1]}`;

export type IssueRefKind =
  | 'door'
  | 'block'
  | 'furniture'
  | 'monster'
  | 'trap'
  | 'marker'
  | 'zone'
  | 'note'
  | 'objective'
  | 'npc'
  | 'area'
  | 'quest';

export interface IssueRef {
  kind: IssueRefKind;
  id?: string;
  cell?: [number, number];
  area?: string;
}

export interface Issue {
  message: string;
  /** Errors block export; warnings do not. */
  severity: 'error' | 'warning';
  ref?: IssueRef;
}

export interface ValidateOptions {
  /** Also run the editor-only checks (letters have notes, an objective exists). Default true. */
  editor?: boolean;
}

/** Game checks as plain messages (what `npm run validate` and the tests use). */
export function validateQuest(quest: Quest, board: Board): string[] {
  return validateQuestIssues(quest, board, { editor: false }).map((i) => i.message);
}

/** Walk check: a normal or secret door passes (`passable` ids), a false door blocks, else the edge must not be a wall. */
function edgeOpenForWalk(
  level: Level,
  a: [number, number],
  b: [number, number],
  passable: ReadonlySet<string>,
): boolean {
  const door = level.doorAtEdge.get(edgeKey(a, b));
  return door ? passable.has(door.id) : !isWall(level, a, b);
}

const cellOf = (c: C): [number, number] => [c[0], c[1]];

/** A square target is written "x,y" and lies on the board. */
const squareOk = (id: string, board: Board) => {
  const m = /^(\d+),(\d+)$/.exec(id);
  return m !== null && Number(m[1]) < board.width && Number(m[2]) < board.height;
};

export function validateQuestIssues(
  quest: Quest,
  board: Board,
  options: ValidateOptions = {},
): Issue[] {
  const editor = options.editor ?? true;
  const issues: Issue[] = [];
  const err = (message: string, ref?: IssueRef) =>
    issues.push(ref ? { message, severity: 'error', ref } : { message, severity: 'error' });
  const warn = (message: string, ref?: IssueRef) =>
    issues.push(ref ? { message, severity: 'warning', ref } : { message, severity: 'warning' });
  const rooms = new Set(roomIds(board));
  // Merged rooms: the second room of a merge is part of the first and no longer a room of its own.
  const absorbed = new Set<string>();
  {
    let cur = board;
    for (const m of quest.areaOverrides) {
      const [a, b] = m.merge;
      const ref: IssueRef = { kind: 'area', area: b };
      const where = `areaOverrides ${a} + ${b}`;
      if (a === b) err(`${where}: a room cannot merge with itself`, ref);
      else if (!rooms.has(a) || !rooms.has(b)) err(`${where}: unknown room`, ref);
      else if (absorbed.has(a) || absorbed.has(b))
        err(`${where}: a room that was merged into another cannot be merged again`, ref);
      else {
        // the two rooms must touch, or the merged room would be in two pieces
        const touch = cellsOf(cur, b).some(([x, y]) =>
          (
            [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ] as const
          ).some(([dx, dy]) => areaAt(cur, x + dx, y + dy) === a),
        );
        if (!touch) err(`${where}: the rooms do not touch`, ref);
        absorbed.add(b);
        cur = mergedBoard(cur, [m]);
      }
    }
  }
  for (const r of absorbed) rooms.delete(r);
  const areas = new Set<string>([...rooms, 'C']);
  // Room tiles: one per room, in a room of this quest.
  {
    const tiled = new Set<string>();
    for (const t of quest.roomTiles) {
      const ref: IssueRef = { kind: 'area', area: t.area };
      if (!rooms.has(t.area))
        err(
          absorbed.has(t.area)
            ? `room tile ${t.type}: ${t.area} was merged into another room, use that one`
            : `room tile ${t.type}: unknown room ${t.area}`,
          ref,
        );
      else if (tiled.has(t.area)) err(`room tile ${t.type}: ${t.area} already has a tile`, ref);
      tiled.add(t.area);
    }
  }
  const isBoardSquare = (id: string) => squareOk(id, board);

  /**
   * Rooms with content that the heroes can never reach from the start room. Normal and secret
   * doors count as passable (a secret door can be found). False doors never open, so they stop
   * the walk, like rock, blocked squares and walls.
   */
  function checkReachable() {
    const startRoom = quest.start.area;
    if (startRoom !== undefined && (!rooms.has(startRoom) || rockRooms.has(startRoom))) return;
    const level = buildLevel(quest, board);
    // The heroes can use every edge door too (the exit leads out of the board, so it ends the walk).
    const passable = new Set(
      [...quest.doors, ...quest.secretDoors, ...quest.edgeDoors].map((d) => d.id),
    );
    const seen = new Set<string>();
    const todo: [number, number][] = [];
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++)
        if (
          startRoom !== undefined &&
          areaAt(board, x, y) === startRoom &&
          !blocksMove(level, x, y)
        ) {
          seen.add(keyOf([x, y]));
          todo.push([x, y]);
        }
    // Outside an iron entry door they begin on the square inside it.
    const entry = quest.edgeDoors.find((e) => e.id === quest.start.door);
    if (entry && !blocksMove(level, entry.cell[0], entry.cell[1])) {
      seen.add(keyOf(entry.cell));
      todo.push([entry.cell[0], entry.cell[1]]);
    }
    while (todo.length) {
      const c = todo.pop() as [number, number];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const n: [number, number] = [c[0] + dx, c[1] + dy];
        const k = keyOf(n);
        if (seen.has(k) || blocksMove(level, n[0], n[1])) continue;
        if (!edgeOpenForWalk(level, c, n, passable)) continue;
        seen.add(k);
        todo.push(n);
      }
    }
    const reached = new Set<string>();
    for (const k of seen) {
      const [x, y] = parseKey(k);
      const a = areaAt(board, x, y);
      if (a) reached.add(a);
    }
    // First thing found in each room, to name it in the message.
    const content = new Map<string, string>();
    const note = (c: C | undefined, what: string) => {
      if (!c || !inBoard(board, c[0], c[1])) return;
      const a = areaAt(board, c[0], c[1]);
      if (a && a !== 'C' && !content.has(a)) content.set(a, what);
    };
    for (const m of quest.monsters) note(m.cell, `monster ${m.id}`);
    for (const f of quest.furniture) note(f.cells[0], `furniture ${f.id}`);
    for (const t of quest.traps) note(t.cell, `trap ${t.id}`);
    for (const m of quest.markers) note(m.cell, `marker ${m.id}`);
    for (const d of [...quest.doors, ...quest.secretDoors, ...quest.falseDoors]) {
      note(d.a, `door ${d.id}`);
      note(d.b, `door ${d.id}`);
    }
    for (const [area, what] of content)
      if (!reached.has(area) && !rockRooms.has(area))
        warn(`${area} cannot be reached from the start room (it holds ${what})`, {
          kind: 'area',
          area,
        });
  }

  // ---- rock
  const rockRooms = new Set(quest.rock.rooms);
  for (const r of quest.rock.rooms)
    if (!rooms.has(r)) err(`rock.rooms: unknown room ${r}`, { kind: 'area', area: r });
  const rock = new Set<string>(quest.rock.cells.map(key));
  quest.rock.cells.forEach((c) => {
    if (!inBoard(board, c[0], c[1]))
      err(`rock.cells: ${key(c)} is outside the board`, { kind: 'quest', cell: cellOf(c) });
  });
  const isRock = (c: C) => {
    const a = areaAt(board, c[0], c[1]);
    return rock.has(key(c)) || (a !== undefined && rockRooms.has(a));
  };

  // ---- start
  const startArea = quest.start.area;
  if (startArea !== undefined) {
    if (!rooms.has(startArea))
      err(`start.area: unknown room ${startArea}`, { kind: 'area', area: startArea });
    else if (rockRooms.has(startArea))
      err(`start.area: ${startArea} is rock`, { kind: 'area', area: startArea });
  } else {
    const entry = quest.edgeDoors.find((e) => e.id === quest.start.door);
    if (!entry) err(`start.door: unknown edge door ${String(quest.start.door)}`, { kind: 'quest' });
    else if (entry.kind !== 'ironEntry')
      err(`start.door: ${entry.id} is not an iron entry door`, { kind: 'door', id: entry.id });
  }

  // ---- unique ids per namespace
  const unique = (label: string, ids: string[], kind: IssueRefKind) => {
    const seen = new Set<string>();
    for (const i of ids) {
      if (seen.has(i)) err(`${label}: duplicate id ${i}`, { kind, id: i });
      seen.add(i);
    }
    return seen;
  };
  const doorIds = unique(
    'doors',
    [
      ...quest.doors.map((d) => d.id),
      ...quest.edgeDoors.map((d) => d.id),
      ...quest.secretDoors.map((d) => d.id),
      ...quest.falseDoors.map((d) => d.id),
    ],
    'door',
  );
  const furnitureIds = unique(
    'furniture',
    quest.furniture.map((f) => f.id),
    'furniture',
  );
  const monsterIds = unique(
    'monsters',
    quest.monsters.map((m) => m.id),
    'monster',
  );
  const spellIds = new Set<string>(CORE_SPELLS.map((s) => s.id));
  for (const sp of quest.spellDefs) {
    if (spellIds.has(sp.id)) err(`spell ${sp.id}: the id is already taken`, { kind: 'quest' });
    spellIds.add(sp.id);
  }
  const enemyIds = new Set<string>();
  for (const e of quest.enemyDefs) {
    if (enemyIds.has(e.id)) err(`enemy ${e.id}: duplicate id`, { kind: 'quest' });
    enemyIds.add(e.id);
  }
  if (quest.wandering && 'enemy' in quest.wandering && quest.wandering.enemy !== undefined)
    if (!enemyIds.has(quest.wandering.enemy))
      err(`wandering: unknown enemy ${quest.wandering.enemy}`, { kind: 'quest' });
  for (const m of quest.monsters)
    if (m.enemy && !enemyIds.has(m.enemy))
      err(`monster ${m.id}: unknown enemy ${m.enemy}`, { kind: 'monster', id: m.id });
  const abilityIds = new Set<string>(CORE_ABILITIES.map((a) => a.id));
  for (const a of quest.abilityDefs) {
    if (abilityIds.has(a.id)) err(`ability ${a.id}: the id is already taken`, { kind: 'quest' });
    abilityIds.add(a.id);
  }
  for (const m of quest.monsters)
    if (m.behavior?.marker && !quest.markers.some((k) => k.id === m.behavior?.marker))
      err(`monster ${m.id}: behavior points at an unknown marker ${m.behavior.marker}`, {
        kind: 'monster',
        id: m.id,
      });
  for (const m of quest.monsters)
    for (const a of m.abilities ?? [])
      if (!abilityIds.has(a))
        err(`monster ${m.id}: unknown ability ${a}`, { kind: 'monster', id: m.id });
  for (const e of quest.enemyDefs)
    for (const a of e.abilities ?? [])
      if (!abilityIds.has(a)) err(`enemy ${e.id}: unknown ability ${a}`, { kind: 'quest' });
  for (const e of quest.enemyDefs)
    for (const sp of e.spells ?? [])
      if (!spellIds.has(sp)) err(`enemy ${e.id}: unknown spell "${sp}"`, { kind: 'quest' });
  const trapIds = unique(
    'traps',
    quest.traps.map((t) => t.id),
    'trap',
  );
  const zoneIds = unique(
    'zones',
    quest.zones.map((z) => z.id),
    'zone',
  );
  unique(
    'markers',
    quest.markers.map((m) => m.id),
    'marker',
  );
  unique(
    'notes',
    quest.notes.map((n) => n.id),
    'note',
  );
  const objectiveIds = unique(
    'objectives',
    quest.objectives.map((o) => o.id),
    'objective',
  );
  const npcIds = unique(
    'npcs',
    quest.npcs.map((n) => n.id),
    'npc',
  );
  const blockIds = quest.blocks.flatMap((b) => (b.id ? [b.id] : []));
  unique('blocks', blockIds, 'block');
  // Blocks without an id get b1, b2... by position: an explicit id must not collide with them.
  const generated = new Set(quest.blocks.flatMap((b, i) => (b.id ? [] : [`b${i + 1}`])));
  for (const i of blockIds)
    if (generated.has(i))
      err(`blocks: id ${i} collides with a generated block id`, { kind: 'block', id: i });
  const secretIds = new Set(quest.secretDoors.map((d) => d.id));

  // ---- doors
  const edges = new Map<string, string>();
  const checkDoors = (label: string, list: Quest['doors'], mayTouchRock: boolean) => {
    for (const d of list) {
      const where = `${label} ${d.id}`;
      const ref: IssueRef = { kind: 'door', id: d.id, cell: cellOf(d.a) };
      let ok = true;
      for (const c of [d.a, d.b])
        if (!inBoard(board, c[0], c[1])) {
          err(`${where}: cell ${key(c)} is outside the board`, ref);
          ok = false;
        }
      if (!ok) continue;
      if (Math.abs(d.a[0] - d.b[0]) + Math.abs(d.a[1] - d.b[1]) !== 1) {
        err(`${where}: cells ${key(d.a)} and ${key(d.b)} are not orthogonal neighbours`, ref);
        continue;
      }
      if (areaAt(board, d.a[0], d.a[1]) === areaAt(board, d.b[0], d.b[1]))
        err(`${where}: edge ${key(d.a)} | ${key(d.b)} is not on a wall (same area)`, ref);
      if (!mayTouchRock && (isRock(d.a) || isRock(d.b))) err(`${where}: touches rock`, ref);
      const ek = [key(d.a), key(d.b)].sort().join('|');
      const other = edges.get(ek);
      if (other) err(`${where}: same edge as door ${other}`, ref);
      else edges.set(ek, d.id);
    }
  };
  // Edge doors: on the outer wall of the board, on a floor square, one iron entry at most.
  const edgeSeen = new Set<string>();
  for (const e of quest.edgeDoors) {
    const ref: IssueRef = { kind: 'door', id: e.id, cell: cellOf(e.cell) };
    const [x, y] = e.cell;
    if (!inBoard(board, x, y)) {
      err(`edge door ${e.id}: cell ${key(e.cell)} is outside the board`, ref);
      continue;
    }
    const outside = outsideOf(e.cell, e.side);
    // The square outside is off the board, or rock (a tile such as the ice cave entrance covers it).
    if (inBoard(board, outside[0], outside[1]) && !isRock(outside))
      err(`edge door ${e.id}: ${key(e.cell)} is not on the ${e.side} edge of the board`, ref);
    if (isRock(e.cell)) err(`edge door ${e.id}: touches rock`, ref);
    const ek = `${key(e.cell)}${e.side}`;
    if (edgeSeen.has(ek)) err(`edge door ${e.id}: same edge as another edge door`, ref);
    edgeSeen.add(ek);
  }
  if (quest.edgeDoors.filter((e) => e.kind === 'ironEntry').length > 1)
    err('edge doors: only one iron entry door', { kind: 'quest' });
  checkDoors('door', quest.doors, false);
  checkDoors('secret door', quest.secretDoors, false);
  checkDoors('false door', quest.falseDoors, true); // a false door may lead into rock

  // ---- cells of things
  const inside = (label: string, c: C | undefined, ref: IssueRef, allowRock = false) => {
    if (!c) return;
    if (!inBoard(board, c[0], c[1])) err(`${label}: cell ${key(c)} is outside the board`, ref);
    else if (!allowRock && isRock(c)) err(`${label}: cell ${key(c)} is in rock`, ref);
  };
  quest.blocks.forEach((b, i) => {
    const ref: IssueRef = { kind: 'block', id: b.id ?? `b${i + 1}`, cell: cellOf(b.cells[0]!) };
    b.cells.forEach((c) => inside(`block ${b.id ?? `b${i + 1}`}`, c, ref));
    if (b.cells.length === 2) {
      const [p, q] = b.cells as unknown as [C, C];
      if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) !== 1)
        err(`block ${b.id ?? `b${i + 1}`}: the two cells must be neighbours`, ref);
    }
  });
  const used = new Map<string, string>();
  const occupy = (label: string, c: C, ref: IssueRef) => {
    const other = used.get(key(c));
    if (other) err(`${label}: cell ${key(c)} is already used by ${other}`, ref);
    else used.set(key(c), label);
  };
  quest.blocks.forEach((b, i) =>
    b.cells.forEach((c) =>
      occupy(`block ${b.id ?? `b${i + 1}`}`, c, {
        kind: 'block',
        id: b.id ?? `b${i + 1}`,
        cell: cellOf(c),
      }),
    ),
  );
  for (const f of quest.furniture)
    f.cells.forEach((c) => {
      const ref: IssueRef = { kind: 'furniture', id: f.id, cell: cellOf(c) };
      inside(`furniture ${f.id}`, c, ref);
      if (f.type !== 'stairs') occupy(`furniture ${f.id}`, c, ref);
    });
  for (const m of quest.monsters) {
    const ref: IssueRef = m.cell
      ? { kind: 'monster', id: m.id, cell: cellOf(m.cell) }
      : { kind: 'monster', id: m.id };
    inside(`monster ${m.id}`, m.cell, ref);
    if (m.cell && !m.hidden) occupy(`monster ${m.id}`, m.cell, ref);
    for (const sp of m.spells ?? [])
      if (!spellIds.has(sp))
        err(`monster ${m.id}: unknown spell "${sp}" (known: ${[...spellIds].join(', ')})`, ref);
    for (const k of Object.keys(m.spellOrder ?? {}))
      if (!(m.spells ?? []).includes(k))
        err(`monster ${m.id}: spellOrder names ${k}, which is not in its spells list`, ref);
    if (m.spellLimit && (m.spells ?? []).length === 0)
      err(`monster ${m.id}: spellLimit needs a spells list`, ref);
  }
  // Stairs share no square with a block, other furniture or a visible monster (the editor ops refuse it
  // too; the Rotate of the editor can pass through such a position, so Save must catch it).
  for (const f of quest.furniture)
    if (f.type === 'stairs')
      for (const c of f.cells) {
        const other = used.get(key(c));
        if (other)
          err(`furniture ${f.id}: cell ${key(c)} is already used by ${other}`, {
            kind: 'furniture',
            id: f.id,
            cell: cellOf(c),
          });
      }
  // An ice slide runs along straight, touching squares of floor (a path of single steps).
  for (const t of quest.traps) {
    if (!t.path) continue;
    const ref: IssueRef = { kind: 'trap', id: t.id, cell: cellOf(t.path[0]!) };
    t.path.forEach((c, i) => {
      inside(`trap ${t.id} path square ${i + 1}`, c, ref);
      const prev = t.path![i - 1];
      if (prev && Math.abs(prev[0] - c[0]) + Math.abs(prev[1] - c[1]) !== 1)
        err(`trap ${t.id}: slide square ${i + 1} is not next to the one before it`, ref);
    });
  }
  for (const t of quest.traps) {
    const ref: IssueRef = t.cell
      ? { kind: 'trap', id: t.id, cell: cellOf(t.cell) }
      : { kind: 'trap', id: t.id };
    inside(`trap ${t.id}`, t.cell, ref);
    if (t.furniture && !furnitureIds.has(t.furniture))
      err(`trap ${t.id}: unknown furniture ${t.furniture}`, ref);
  }
  // Traps sit on bare floor: not under a block or furniture, one trap per square.
  const solid = new Map<string, string>();
  quest.blocks.forEach((b, i) =>
    b.cells.forEach((c) => solid.set(key(c), `block ${b.id ?? `b${i + 1}`}`)),
  );
  for (const f of quest.furniture)
    if (f.type !== 'stairs') f.cells.forEach((c) => solid.set(key(c), `furniture ${f.id}`));
  const trapCells = new Map<string, string>();
  for (const t of quest.traps) {
    if (!t.cell) continue;
    const ref: IssueRef = { kind: 'trap', id: t.id, cell: cellOf(t.cell) };
    const other = solid.get(key(t.cell));
    if (other) err(`trap ${t.id}: cell ${key(t.cell)} is under ${other}`, ref);
    const twin = trapCells.get(key(t.cell));
    if (twin) err(`trap ${t.id}: same cell as trap ${twin}`, ref);
    else trapCells.set(key(t.cell), t.id);
  }
  const flagsSetEarly = new Set<string>();
  forEachEffect(quest, (e) => {
    if (e.type === 'setFlag') flagsSetEarly.add(e.flag);
  });
  quest.boardTiles.forEach((t, i) => {
    if (t.blocks && t.hiddenWhen === undefined)
      err(`board tile ${i + 1} (${t.type}): blocks needs a hiddenWhen flag`, { kind: 'quest' });
    if (t.hiddenWhen !== undefined && !flagsSetEarly.has(t.hiddenWhen))
      err(`board tile ${i + 1} (${t.type}): hiddenWhen flag ${t.hiddenWhen} is never set`, {
        kind: 'quest',
      });
  });
  // Board tiles: every square is on the board (the cave entrance may lie over rock).
  quest.boardTiles.forEach((t, i) =>
    t.cells.forEach((c) =>
      inside(`board tile ${i + 1} (${t.type})`, c, { kind: 'quest', cell: cellOf(c) }, true),
    ),
  );
  // Ice tunnels: both ends on bare floor, two different squares, one pair per design.
  {
    const ids = new Set<string>();
    const designs = new Set<number>();
    const ends = new Map<string, string>();
    for (const t of quest.tunnels) {
      const ref: IssueRef = { kind: 'quest', cell: cellOf(t.a) };
      if (ids.has(t.id)) err(`tunnel ${t.id}: duplicate id`, ref);
      ids.add(t.id);
      if (designs.has(t.design))
        err(`tunnel ${t.id}: design ${t.design} is used by another tunnel`, ref);
      designs.add(t.design);
      if (key(t.a) === key(t.b)) err(`tunnel ${t.id}: both ends are the same square`, ref);
      for (const [end, c] of [
        ['a', t.a],
        ['b', t.b],
      ] as const) {
        inside(`tunnel ${t.id} end ${end}`, c, ref);
        const other = solid.get(key(c));
        if (other) err(`tunnel ${t.id}: end ${end} ${key(c)} is under ${other}`, ref);
        const twin = ends.get(key(c));
        if (twin) err(`tunnel ${t.id}: end ${end} ${key(c)} is also an end of tunnel ${twin}`, ref);
        else ends.set(key(c), t.id);
        if (trapCells.has(key(c)))
          err(`tunnel ${t.id}: end ${end} ${key(c)} has trap ${trapCells.get(key(c))}`, ref);
      }
    }
  }
  // Stacking: a trap may share a monster's square (a chest trap sits on its chest). A monster
  // never shares an NPC square. A trap never sits on stairs or an NPC. Door squares are fine.
  // Monsters beside a door are fine: the Quest Book puts them there (quest 1, orc m16).
  const npcCells = new Map(quest.npcs.map((n) => [key(n.cell), `npc ${n.id}`]));
  const stairCells = new Map<string, string>();
  for (const f of quest.furniture)
    if (f.type === 'stairs') f.cells.forEach((c) => stairCells.set(key(c), `the stairs ${f.id}`));
  for (const m of quest.monsters) {
    if (!m.cell) continue;
    const ref: IssueRef = { kind: 'monster', id: m.id, cell: cellOf(m.cell) };
    const n = npcCells.get(key(m.cell));
    if (n) err(`monster ${m.id}: cell ${key(m.cell)} is on ${n}`, ref);
  }
  for (const t of quest.traps) {
    if (!t.cell) continue;
    const ref: IssueRef = { kind: 'trap', id: t.id, cell: cellOf(t.cell) };
    for (const [what, map] of [
      ['the stairs', stairCells],
      ['an NPC', npcCells],
    ] as const) {
      const hit = map.get(key(t.cell));
      if (hit) err(`trap ${t.id}: cell ${key(t.cell)} is on ${what} (${hit})`, ref);
    }
  }
  // A door that replaces a piece of furniture (a melted throne) may stand on its squares.
  const replaces = new Map<string, string>();
  forEachEffect(quest, (e) => {
    if (e.type === 'replaceFurnitureWithDoor') replaces.set(e.door, e.furniture);
  });
  // A door cell must be walkable: no block or furniture on either side.
  for (const [label, list] of [
    ['door', quest.doors],
    ['secret door', quest.secretDoors],
    ['false door', quest.falseDoors],
  ] as const)
    for (const d of list)
      for (const c of [d.a, d.b]) {
        const other = solid.get(key(c));
        // A throne may sit on a secret door: it hides the door until a treasure search (Q5).
        const hidingThrone =
          label === 'secret door' &&
          other !== undefined &&
          quest.furniture.some((f) => other === `furniture ${f.id}` && f.type === 'throne');
        const replaced = other !== undefined && other === `furniture ${replaces.get(d.id)}`;
        if (other && !hidingThrone && !replaced)
          err(`${label} ${d.id}: cell ${key(c)} is under ${other}`, {
            kind: 'door',
            id: d.id,
            cell: cellOf(c),
          });
      }
  quest.zones.forEach((z) =>
    z.cells.forEach((c) => inside(`zone ${z.id}`, c, { kind: 'zone', id: z.id, cell: cellOf(c) })),
  );
  quest.markers.forEach((m) =>
    inside(`marker ${m.id}`, m.cell, { kind: 'marker', id: m.id, cell: cellOf(m.cell) }),
  );
  quest.npcs.forEach((n) => {
    const ref: IssueRef = { kind: 'npc', id: n.id, cell: cellOf(n.cell) };
    inside(`npc ${n.id}`, n.cell, ref);
    const other = solid.get(key(n.cell));
    if (other?.startsWith('block')) err(`npc ${n.id}: cell ${key(n.cell)} is under ${other}`, ref);
  });
  quest.notes.forEach((n) => inside(`note ${n.id}`, n.at, { kind: 'note', id: n.id }, true));

  // ---- references in notes
  const flagsSet = new Set<string>();
  const countersAdded = new Set<string>();
  const completed = new Set<string>();
  const placed = new Set<string>();
  forEachEffect(quest, (e) => {
    if (e.type === 'setFlag') flagsSet.add(e.flag);
    else if (e.type === 'addCounter') countersAdded.add(e.counter);
    else if (e.type === 'completeObjective') completed.add(e.objective);
    else if (e.type === 'placeMonster') placed.add(e.monster);
  });
  // A door that waits for a flag, or is locked by one, needs a note that sets it.
  for (const door of [...quest.doors, ...quest.secretDoors, ...quest.falseDoors]) {
    for (const [what, flag] of [
      ['hiddenUntil', door.hiddenUntil],
      ['lockedUntil', door.lockedUntil],
    ] as const)
      if (flag !== undefined && !flagsSet.has(flag))
        err(`door ${door.id}: ${what} flag ${flag} is never set`, {
          kind: 'door',
          id: door.id,
          cell: cellOf(door.a),
        });
  }
  // Ref of the note being checked, so every message points at the note.
  let noteRef: IssueRef = { kind: 'note' };
  const needArea = (where: string, a: string) => {
    if (!areas.has(a)) err(`${where}: unknown area ${a}`, noteRef);
  };
  const needRoom = (where: string, a: string) => {
    if (!rooms.has(a)) err(`${where}: ${a} is not a room`, noteRef);
  };
  const checkCondition = (where: string, c: Condition) => {
    if ('monster' in c && !monsterIds.has(c.monster))
      err(`${where}: unknown monster ${c.monster}`, noteRef);
    if ('monstersAliveIn' in c) needArea(where, c.monstersAliveIn);
    if ('areaRevealed' in c) needRoom(where, c.areaRevealed);
    if ('doorOpened' in c && !doorIds.has(c.doorOpened))
      err(`${where}: unknown door ${c.doorOpened}`, noteRef);
    if ('monsterSeen' in c && !monsterIds.has(c.monsterSeen))
      err(`${where}: unknown monster ${c.monsterSeen}`, noteRef);
    if ('lookDone' in c && !squareOk(`${c.lookDone[0]},${c.lookDone[1]}`, board))
      err(`${where}: lookDone square is not on the board`, noteRef);
    if ('flag' in c && c.is && !flagsSet.has(c.flag))
      err(`${where}: flag ${c.flag} is never set`, noteRef);
    if ('counter' in c && c.gte > 0 && !countersAdded.has(c.counter))
      err(`${where}: counter ${c.counter} is never changed`, noteRef);
  };
  const checkEffect = (where: string, e: Effect) => {
    switch (e.type) {
      case 'revealArea':
        needRoom(where, e.area);
        break;
      case 'placeMonster': {
        const m = quest.monsters.find((x) => x.id === e.monster);
        if (!m) err(`${where}: unknown monster ${e.monster}`, noteRef);
        else {
          if (m.hidden !== true)
            err(`${where}: placeMonster needs a hidden monster, ${m.id} is not`, noteRef);
          if (!m.cell && !e.cell)
            err(`${where}: monster ${m.id} has no cell, give one in the effect`, noteRef);
        }
        inside(where, e.cell, noteRef);
        break;
      }
      case 'setMonsterState':
        if (!monsterIds.has(e.monster)) err(`${where}: unknown monster ${e.monster}`, noteRef);
        if (e.turns !== undefined && e.state !== 'stone')
          err(`${where}: turns only makes sense for state stone`, noteRef);
        break;
      case 'addSecretDoor':
        if (!secretIds.has(e.door)) err(`${where}: unknown secret door ${e.door}`, noteRef);
        break;
      case 'lookFrom':
        inside(where, e.cell, noteRef);
        break;
      case 'replaceFurnitureWithDoor':
        if (!furnitureIds.has(e.furniture))
          err(`${where}: unknown furniture ${e.furniture}`, noteRef);
        if (!doorIds.has(e.door)) err(`${where}: unknown door ${e.door}`, noteRef);
        break;
      case 'removeDoor':
        if (!doorIds.has(e.door)) err(`${where}: unknown door ${e.door}`, noteRef);
        break;
      case 'placeBlock':
        e.cells.forEach((c) => {
          inside(where, c, noteRef);
          const other = solid.get(key(c));
          if (other) err(`${where}: placeBlock cell ${key(c)} is under ${other}`, noteRef);
        });
        break;
      case 'completeObjective':
        if (!objectiveIds.has(e.objective))
          err(`${where}: unknown objective ${e.objective}`, noteRef);
        break;
      case 'spawnNpc':
        if (!npcIds.has(e.npc)) err(`${where}: unknown npc ${e.npc}`, noteRef);
        break;
      case 'promptChoice':
        e.options.forEach((o) => o.effects.forEach((x) => checkEffect(where, x)));
        break;
      default:
        break;
    }
  };
  for (const n of quest.notes) {
    const where = `note ${n.id}`;
    noteRef = { kind: 'note', id: n.id };
    const t = n.trigger;
    switch (t.type) {
      case 'areaRevealed':
      case 'areaEntered':
      case 'treasureSearch':
        needRoom(where, t.area);
        break;
      case 'secretDoorSearch':
        needArea(where, t.area); // a corridor search counts as area C
        break;
      case 'doorOpened':
        if (!doorIds.has(t.door)) err(`${where}: unknown door ${t.door}`, noteRef);
        break;
      case 'squareEntered':
        inside(where, t.cell, noteRef);
        break;
      case 'trapSprung':
      case 'trapDisarmed':
        if (!trapIds.has(t.trap)) err(`${where}: unknown trap ${t.trap}`, noteRef);
        break;
      case 'monsterSeen':
      case 'monsterKilled':
        if (t.monster && !monsterIds.has(t.monster))
          err(`${where}: unknown monster ${t.monster}`, noteRef);
        if (t.monster && t.monsterType)
          err(`${where}: ${t.type} takes a monster or a monsterType, not both`, noteRef);
        break;
      case 'spellCast':
        if (t.monster && !monsterIds.has(t.monster))
          err(`${where}: unknown monster ${t.monster}`, noteRef);
        if (t.spell && !spellIds.has(t.spell)) err(`${where}: unknown spell "${t.spell}"`, noteRef);
        if (t.monster && t.spell) {
          const m = quest.monsters.find((x) => x.id === t.monster);
          if (m && !(m.spells ?? []).includes(t.spell))
            err(`${where}: monster ${t.monster} has no spell ${t.spell}`, noteRef);
        }
        break;
      case 'zoneEntered':
        if (!zoneIds.has(t.zone)) err(`${where}: unknown zone ${t.zone}`, noteRef);
        break;
      case 'questEnds':
        if (t.ending !== undefined && t.outcome !== 'ending')
          err(`${where}: questEnds with an ending needs outcome "ending"`, noteRef);
        if (t.ending !== undefined && !(quest.endings ?? []).some((e) => e.id === t.ending))
          err(`${where}: unknown ending ${t.ending}`, noteRef);
        break;
      case 'zargonTurn':
        if (t.n !== undefined && t.every !== undefined)
          err(`${where}: zargonTurn takes n or every, not both`, noteRef);
        break;
      case 'allKilled':
        t.monsters.forEach((m) => {
          if (!monsterIds.has(m)) err(`${where}: unknown monster ${m}`, noteRef);
        });
        break;
      default:
        break;
    }
    if (n.consumesTreasure && t.type !== 'treasureSearch')
      err(`${where}: consumesTreasure only makes sense for a treasureSearch trigger`, noteRef);
    if (n.blocksSearch && t.type !== 'treasureSearch')
      err(`${where}: blocksSearch only makes sense for a treasureSearch trigger`, noteRef);
    if (n.blocksSearch && n.consumesTreasure)
      err(`${where}: blocksSearch and consumesTreasure cannot both be set`, noteRef);
    if (n.target) {
      const tg = n.target;
      const known =
        tg.kind === 'door'
          ? doorIds.has(tg.id)
          : tg.kind === 'furniture'
            ? furnitureIds.has(tg.id)
            : tg.kind === 'monster'
              ? monsterIds.has(tg.id)
              : tg.kind === 'trap'
                ? trapIds.has(tg.id)
                : tg.kind === 'marker'
                  ? quest.markers.some((m) => m.id === tg.id)
                  : tg.kind === 'zone'
                    ? zoneIds.has(tg.id)
                    : tg.kind === 'square'
                      ? isBoardSquare(tg.id)
                      : areas.has(tg.id);
      if (!known) err(`${where}: target ${tg.kind} ${tg.id} does not exist`, noteRef);
    }
    (n.when ?? []).forEach((c) => checkCondition(where, c));
    n.effects.forEach((e) => checkEffect(where, e));
  }

  // ---- endings
  const endingIds = new Set<string>();
  for (const e of quest.endings ?? []) {
    if (endingIds.has(e.id)) err(`ending ${e.id}: duplicate id`, { kind: 'quest' });
    endingIds.add(e.id);
  }

  // ---- hidden monsters, objectives, rules
  for (const m of quest.monsters)
    if (m.hidden && !placed.has(m.id))
      err(`monster ${m.id}: hidden but no note places it`, { kind: 'monster', id: m.id });
  const noteIds = new Set(quest.notes.map((n) => n.id));
  if (quest.rules.noEquipmentUntil && !noteIds.has(quest.rules.noEquipmentUntil))
    err(`rules.noEquipmentUntil: unknown note ${quest.rules.noEquipmentUntil}`, {
      kind: 'quest',
    });
  for (const o of quest.objectives) {
    const where = `objective ${o.id}`;
    const ref: IssueRef = { kind: 'objective', id: o.id };
    const d = o.done;
    const checkObjectiveCondition = (c: Condition) => {
      if ('firstTime' in c) err(`${where}: firstTime has no meaning in an objective`, ref);
      if ('monster' in c && !monsterIds.has(c.monster))
        err(`${where}: unknown monster ${c.monster}`, ref);
      if ('monsterSeen' in c && !monsterIds.has(c.monsterSeen))
        err(`${where}: unknown monster ${c.monsterSeen}`, ref);
      if ('doorOpened' in c && !doorIds.has(c.doorOpened))
        err(`${where}: unknown door ${c.doorOpened}`, ref);
      if ('areaRevealed' in c && !rooms.has(c.areaRevealed))
        err(`${where}: ${c.areaRevealed} is not a room`, ref);
      if ('flag' in c && c.is && !flagsSet.has(c.flag))
        err(`${where}: flag ${c.flag} is never set`, ref);
    };
    if (o.confirmWhen && !o.confirm) err(`${where}: confirmWhen needs a confirm label`, ref);
    o.confirmWhen?.forEach(checkObjectiveCondition);
    if (!d) {
      if (!completed.has(o.id) && !o.confirm)
        err(`${where}: no done rule and no completeObjective effect`, ref);
      continue;
    }
    if ('monsterKilled' in d && !monsterIds.has(d.monsterKilled))
      err(`${where}: unknown monster ${d.monsterKilled}`, ref);
    if ('allKilled' in d)
      for (const m of d.allKilled)
        if (!monsterIds.has(m)) err(`${where}: unknown monster ${m}`, ref);
    if ('flag' in d && !flagsSet.has(d.flag)) err(`${where}: flag ${d.flag} is never set`, ref);
    if ('when' in d) d.when.forEach(checkObjectiveCondition);
  }

  // ---- editor-only checks
  if (editor) {
    if (quest.objectives.length === 0)
      err('The quest has no objective. Add at least one.', { kind: 'quest' });
    // Letters on the map: lettered furniture needs a note with that letter (error). A single
    // letter marker label (except X, which marks a spot) should have one too (warning). A note
    // letter with nothing on the map is a warning, unless the note has an `at` cell.
    const noteLetters = new Set(quest.notes.flatMap((n) => (n.letter ? [n.letter] : [])));
    const mapLetters = new Set<string>();
    for (const f of quest.furniture) {
      if (!f.letter) continue;
      mapLetters.add(f.letter);
      if (!noteLetters.has(f.letter))
        err(`furniture ${f.id}: letter ${f.letter} has no note`, {
          kind: 'furniture',
          id: f.id,
          cell: cellOf(f.cells[0]!),
        });
    }
    for (const m of quest.markers) {
      if (!/^[A-WYZ]$/.test(m.label)) continue;
      mapLetters.add(m.label);
      if (!noteLetters.has(m.label))
        warn(`marker ${m.id}: letter ${m.label} has no note`, {
          kind: 'marker',
          id: m.id,
          cell: cellOf(m.cell),
        });
    }
    for (const n of quest.notes)
      if (n.letter && !n.at && !mapLetters.has(n.letter))
        warn(`note ${n.id}: letter ${n.letter} is not on the map`, { kind: 'note', id: n.id });

    // Furniture must sit inside one room, squares touching (same rule as the editor ops).
    for (const f of quest.furniture) {
      if (f.cells.some((c) => !inBoard(board, c[0], c[1]) || isRock(c))) continue; // reported above
      const p = footprintShapeProblem(board, f.cells, `furniture ${f.id}`);
      if (p) err(p, { kind: 'furniture', id: f.id, cell: cellOf(f.cells[0]!) });
    }
    for (const c of quest.rock.cells) {
      const a = inBoard(board, c[0], c[1]) ? areaAt(board, c[0], c[1]) : undefined;
      if (a && rockRooms.has(a))
        warn(`rock.cells: ${key(c)} is already rock because room ${a} is rock`, {
          kind: 'area',
          area: a,
          cell: cellOf(c),
        });
    }
    checkReachable();
  }
  return issues;
}

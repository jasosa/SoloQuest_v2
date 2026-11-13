/**
 * Semantic checks of a parsed quest against the board (the Zod schema checks structure only).
 * Returns a list of readable problems; empty means ok.
 */
import { areaAt, inBoard, roomIds, type Board } from '../board/board';
import type { Effect, Quest } from './schema';

type C = readonly [number, number];
const key = (c: C) => `${c[0]},${c[1]}`;

export function validateQuest(quest: Quest, board: Board): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const rooms = new Set(roomIds(board));
  const areas = new Set<string>([...rooms, 'C']);

  // ---- rock
  const rockRooms = new Set(quest.rock.rooms);
  for (const r of quest.rock.rooms) if (!rooms.has(r)) err(`rock.rooms: unknown room ${r}`);
  const rock = new Set<string>(quest.rock.cells.map(key));
  quest.rock.cells.forEach((c) => {
    if (!inBoard(board, c[0], c[1])) err(`rock.cells: ${key(c)} is outside the board`);
  });
  const isRock = (c: C) => {
    const a = areaAt(board, c[0], c[1]);
    return rock.has(key(c)) || (a !== undefined && rockRooms.has(a));
  };

  // ---- start
  if (!rooms.has(quest.start.area)) err(`start.area: unknown room ${quest.start.area}`);
  else if (rockRooms.has(quest.start.area)) err(`start.area: ${quest.start.area} is rock`);

  // ---- unique ids per namespace
  const unique = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const i of ids) {
      if (seen.has(i)) err(`${label}: duplicate id ${i}`);
      seen.add(i);
    }
    return seen;
  };
  const doorIds = unique('doors', [
    ...quest.doors.map((d) => d.id),
    ...quest.secretDoors.map((d) => d.id),
    ...quest.falseDoors.map((d) => d.id),
  ]);
  const furnitureIds = unique(
    'furniture',
    quest.furniture.map((f) => f.id),
  );
  const monsterIds = unique(
    'monsters',
    quest.monsters.map((m) => m.id),
  );
  const trapIds = unique(
    'traps',
    quest.traps.map((t) => t.id),
  );
  unique(
    'markers',
    quest.markers.map((m) => m.id),
  );
  unique(
    'notes',
    quest.notes.map((n) => n.id),
  );
  const objectiveIds = unique(
    'objectives',
    quest.objectives.map((o) => o.id),
  );
  const npcIds = unique(
    'npcs',
    quest.npcs.map((n) => n.id),
  );
  const blockIds = quest.blocks.flatMap((b) => (b.id ? [b.id] : []));
  unique('blocks', blockIds);
  const secretIds = new Set(quest.secretDoors.map((d) => d.id));

  // ---- doors
  const edges = new Map<string, string>();
  const checkDoors = (label: string, list: Quest['doors'], mayTouchRock: boolean) => {
    for (const d of list) {
      const where = `${label} ${d.id}`;
      let ok = true;
      for (const c of [d.a, d.b])
        if (!inBoard(board, c[0], c[1])) {
          err(`${where}: cell ${key(c)} is outside the board`);
          ok = false;
        }
      if (!ok) continue;
      if (Math.abs(d.a[0] - d.b[0]) + Math.abs(d.a[1] - d.b[1]) !== 1) {
        err(`${where}: cells ${key(d.a)} and ${key(d.b)} are not orthogonal neighbours`);
        continue;
      }
      if (areaAt(board, d.a[0], d.a[1]) === areaAt(board, d.b[0], d.b[1]))
        err(`${where}: edge ${key(d.a)} | ${key(d.b)} is not on a wall (same area)`);
      if (!mayTouchRock && (isRock(d.a) || isRock(d.b))) err(`${where}: touches rock`);
      const ek = [key(d.a), key(d.b)].sort().join('|');
      const other = edges.get(ek);
      if (other) err(`${where}: same edge as door ${other}`);
      else edges.set(ek, d.id);
    }
  };
  checkDoors('door', quest.doors, false);
  checkDoors('secret door', quest.secretDoors, false);
  checkDoors('false door', quest.falseDoors, true); // a false door may lead into rock

  // ---- cells of things
  const inside = (label: string, c: C | undefined, allowRock = false) => {
    if (!c) return;
    if (!inBoard(board, c[0], c[1])) err(`${label}: cell ${key(c)} is outside the board`);
    else if (!allowRock && isRock(c)) err(`${label}: cell ${key(c)} is in rock`);
  };
  quest.blocks.forEach((b, i) => {
    b.cells.forEach((c) => inside(`block ${b.id ?? i}`, c));
    if (b.cells.length === 2) {
      const [p, q] = b.cells as unknown as [C, C];
      if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) !== 1)
        err(`block ${b.id ?? i}: the two cells must be neighbours`);
    }
  });
  const used = new Map<string, string>();
  const occupy = (label: string, c: C) => {
    const other = used.get(key(c));
    if (other) err(`${label}: cell ${key(c)} is already used by ${other}`);
    else used.set(key(c), label);
  };
  quest.blocks.forEach((b, i) => b.cells.forEach((c) => occupy(`block ${b.id ?? i}`, c)));
  for (const f of quest.furniture)
    f.cells.forEach((c) => {
      inside(`furniture ${f.id}`, c);
      if (f.type !== 'stairs') occupy(`furniture ${f.id}`, c);
    });
  for (const m of quest.monsters) {
    inside(`monster ${m.id}`, m.cell);
    if (m.cell && !m.hidden) occupy(`monster ${m.id}`, m.cell);
  }
  for (const t of quest.traps) {
    inside(`trap ${t.id}`, t.cell);
    if (t.furniture && !furnitureIds.has(t.furniture))
      err(`trap ${t.id}: unknown furniture ${t.furniture}`);
  }
  quest.markers.forEach((m) => inside(`marker ${m.id}`, m.cell));
  quest.npcs.forEach((n) => inside(`npc ${n.id}`, n.cell));
  quest.notes.forEach((n) => inside(`note ${n.id}`, n.at, true));

  // ---- references in notes
  const needArea = (where: string, a: string) => {
    if (!areas.has(a)) err(`${where}: unknown area ${a}`);
  };
  const checkEffect = (where: string, e: Effect) => {
    switch (e.type) {
      case 'revealArea':
        needArea(where, e.area);
        break;
      case 'placeMonster':
        if (!monsterIds.has(e.monster)) err(`${where}: unknown monster ${e.monster}`);
        inside(where, e.cell);
        break;
      case 'setMonsterState':
        if (!monsterIds.has(e.monster)) err(`${where}: unknown monster ${e.monster}`);
        break;
      case 'addSecretDoor':
        if (!secretIds.has(e.door)) err(`${where}: unknown secret door ${e.door}`);
        break;
      case 'placeBlock':
        e.cells.forEach((c) => inside(where, c));
        break;
      case 'completeObjective':
        if (!objectiveIds.has(e.objective)) err(`${where}: unknown objective ${e.objective}`);
        break;
      case 'spawnNpc':
        if (!npcIds.has(e.npc)) err(`${where}: unknown npc ${e.npc}`);
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
    const t = n.trigger;
    switch (t.type) {
      case 'areaRevealed':
      case 'areaEntered':
      case 'treasureSearch':
      case 'secretDoorSearch':
        needArea(where, t.area);
        break;
      case 'doorOpened':
        if (!doorIds.has(t.door)) err(`${where}: unknown door ${t.door}`);
        break;
      case 'squareEntered':
        inside(where, t.cell);
        break;
      case 'trapSprung':
      case 'trapDisarmed':
        if (!trapIds.has(t.trap)) err(`${where}: unknown trap ${t.trap}`);
        break;
      case 'monsterKilled':
        if (t.monster && !monsterIds.has(t.monster)) err(`${where}: unknown monster ${t.monster}`);
        break;
      case 'allKilled':
        t.monsters.forEach((m) => {
          if (!monsterIds.has(m)) err(`${where}: unknown monster ${m}`);
        });
        break;
      default:
        break;
    }
    n.effects.forEach((e) => checkEffect(where, e));
  }
  return errors;
}

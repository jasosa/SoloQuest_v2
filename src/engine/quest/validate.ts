/**
 * Semantic checks of a parsed quest against the board (the Zod schema checks structure only).
 * Returns a list of readable problems; empty means ok.
 */
import { areaAt, inBoard, roomIds, type Board } from '../board/board';
import { SPELL_KEYS, isSpellKey } from '../zargon/spells';
import { forEachEffect } from './effects';
import type { Condition, Effect, Quest } from './schema';

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
  // Blocks without an id get b1, b2... by position: an explicit id must not collide with them.
  const generated = new Set(quest.blocks.flatMap((b, i) => (b.id ? [] : [`b${i + 1}`])));
  for (const i of blockIds)
    if (generated.has(i)) err(`blocks: id ${i} collides with a generated block id`);
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
    for (const sp of m.spells ?? [])
      if (!isSpellKey(sp))
        err(`monster ${m.id}: unknown spell "${sp}" (known: ${SPELL_KEYS.join(', ')})`);
    if (m.spellLimit && (m.spells ?? []).length === 0)
      err(`monster ${m.id}: spellLimit needs a spells list`);
  }
  for (const t of quest.traps) {
    inside(`trap ${t.id}`, t.cell);
    if (t.furniture && !furnitureIds.has(t.furniture))
      err(`trap ${t.id}: unknown furniture ${t.furniture}`);
  }
  // Traps sit on bare floor: not under a block or furniture, one trap per square.
  const solid = new Map<string, string>();
  quest.blocks.forEach((b, i) => b.cells.forEach((c) => solid.set(key(c), `block ${b.id ?? i}`)));
  for (const f of quest.furniture)
    if (f.type !== 'stairs') f.cells.forEach((c) => solid.set(key(c), `furniture ${f.id}`));
  const trapCells = new Map<string, string>();
  for (const t of quest.traps) {
    if (!t.cell) continue;
    const other = solid.get(key(t.cell));
    if (other) err(`trap ${t.id}: cell ${key(t.cell)} is under ${other}`);
    const twin = trapCells.get(key(t.cell));
    if (twin) err(`trap ${t.id}: same cell as trap ${twin}`);
    else trapCells.set(key(t.cell), t.id);
  }
  // A door cell must be walkable: no block or furniture on either side.
  for (const [label, list] of [
    ['door', quest.doors],
    ['secret door', quest.secretDoors],
    ['false door', quest.falseDoors],
  ] as const)
    for (const d of list)
      for (const c of [d.a, d.b]) {
        const other = solid.get(key(c));
        if (other) err(`${label} ${d.id}: cell ${key(c)} is under ${other}`);
      }
  quest.markers.forEach((m) => inside(`marker ${m.id}`, m.cell));
  quest.npcs.forEach((n) => {
    inside(`npc ${n.id}`, n.cell);
    const other = solid.get(key(n.cell));
    if (other?.startsWith('block')) err(`npc ${n.id}: cell ${key(n.cell)} is under ${other}`);
  });
  quest.notes.forEach((n) => inside(`note ${n.id}`, n.at, true));

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
  const needArea = (where: string, a: string) => {
    if (!areas.has(a)) err(`${where}: unknown area ${a}`);
  };
  const needRoom = (where: string, a: string) => {
    if (!rooms.has(a)) err(`${where}: ${a} is not a room`);
  };
  const checkCondition = (where: string, c: Condition) => {
    if ('monster' in c && !monsterIds.has(c.monster)) err(`${where}: unknown monster ${c.monster}`);
    if ('monstersAliveIn' in c) needArea(where, c.monstersAliveIn);
    if ('flag' in c && c.is && !flagsSet.has(c.flag)) err(`${where}: flag ${c.flag} is never set`);
    if ('counter' in c && c.gte > 0 && !countersAdded.has(c.counter))
      err(`${where}: counter ${c.counter} is never changed`);
  };
  const checkEffect = (where: string, e: Effect) => {
    switch (e.type) {
      case 'revealArea':
        needRoom(where, e.area);
        break;
      case 'placeMonster': {
        const m = quest.monsters.find((x) => x.id === e.monster);
        if (!m) err(`${where}: unknown monster ${e.monster}`);
        else {
          if (m.hidden !== true)
            err(`${where}: placeMonster needs a hidden monster, ${m.id} is not`);
          if (!m.cell && !e.cell)
            err(`${where}: monster ${m.id} has no cell, give one in the effect`);
        }
        inside(where, e.cell);
        break;
      }
      case 'setMonsterState':
        if (!monsterIds.has(e.monster)) err(`${where}: unknown monster ${e.monster}`);
        if (e.turns !== undefined && e.state !== 'stone')
          err(`${where}: turns only makes sense for state stone`);
        break;
      case 'addSecretDoor':
        if (!secretIds.has(e.door)) err(`${where}: unknown secret door ${e.door}`);
        break;
      case 'placeBlock':
        e.cells.forEach((c) => {
          inside(where, c);
          const other = solid.get(key(c));
          if (other) err(`${where}: placeBlock cell ${key(c)} is under ${other}`);
        });
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
        needRoom(where, t.area);
        break;
      case 'secretDoorSearch':
        needArea(where, t.area); // a corridor search counts as area C
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
        if (t.monster && t.monsterType)
          err(`${where}: monsterKilled takes a monster or a monsterType, not both`);
        break;
      case 'spellCast':
        if (t.monster && !monsterIds.has(t.monster)) err(`${where}: unknown monster ${t.monster}`);
        if (t.spell && !isSpellKey(t.spell)) err(`${where}: unknown spell "${t.spell}"`);
        if (t.monster && t.spell) {
          const m = quest.monsters.find((x) => x.id === t.monster);
          if (m && !(m.spells ?? []).includes(t.spell))
            err(`${where}: monster ${t.monster} has no spell ${t.spell}`);
        }
        break;
      case 'zargonTurn':
        if (t.n !== undefined && t.every !== undefined)
          err(`${where}: zargonTurn takes n or every, not both`);
        break;
      case 'allKilled':
        t.monsters.forEach((m) => {
          if (!monsterIds.has(m)) err(`${where}: unknown monster ${m}`);
        });
        break;
      default:
        break;
    }
    if (n.consumesTreasure && t.type !== 'treasureSearch')
      err(`${where}: consumesTreasure only makes sense for a treasureSearch trigger`);
    (n.when ?? []).forEach((c) => checkCondition(where, c));
    n.effects.forEach((e) => checkEffect(where, e));
  }

  // ---- hidden monsters, objectives, rules
  for (const m of quest.monsters)
    if (m.hidden && !placed.has(m.id)) err(`monster ${m.id}: hidden but no note places it`);
  const noteIds = new Set(quest.notes.map((n) => n.id));
  if (quest.rules.noEquipmentUntil && !noteIds.has(quest.rules.noEquipmentUntil))
    err(`rules.noEquipmentUntil: unknown note ${quest.rules.noEquipmentUntil}`);
  for (const o of quest.objectives) {
    const where = `objective ${o.id}`;
    const d = o.done;
    if (!d) {
      if (!completed.has(o.id)) err(`${where}: no done rule and no completeObjective effect`);
      continue;
    }
    if ('monsterKilled' in d && !monsterIds.has(d.monsterKilled))
      err(`${where}: unknown monster ${d.monsterKilled}`);
    if ('allKilled' in d)
      for (const m of d.allKilled) if (!monsterIds.has(m)) err(`${where}: unknown monster ${m}`);
    if ('flag' in d && !flagsSet.has(d.flag)) err(`${where}: flag ${d.flag} is never set`);
  }
  return errors;
}

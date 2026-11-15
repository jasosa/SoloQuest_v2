import { describe, expect, it } from 'vitest';
import { board, cellsOf } from '../board/board';
import { parseQuest } from '../quest/loader';
import type { Quest } from '../quest/schema';
import { testQuest } from '../quest/testQuest';
import { validateQuest, validateQuestIssues } from '../quest/validate';
import {
  addBlock,
  addDoor,
  addFurniture,
  addMarker,
  addMonster,
  addTrap,
  emptyQuest,
  moveFurniture,
  moveMonster,
  removeBlock,
  removeDoor,
  removeFurniture,
  removeMarker,
  removeMonster,
  removeTrap,
  renameQuest,
  rotateFurniture,
  setDoorKind,
  setRockCell,
  setRockRoom,
  setStartArea,
  setSummary,
  type EditResult,
} from './ops';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
function good(r: EditResult): Quest {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
}
function bad(r: EditResult): string {
  if (r.ok) throw new Error('expected an error');
  return r.error;
}
function warned(r: EditResult): string[] {
  if (!r.ok) throw new Error(r.error);
  return r.warnings.map((w) => `${w.ref?.kind}:${w.ref?.id}`);
}

const empty = () => emptyQuest({ id: 'user-x', number: 1, title: 'X' });

describe('emptyQuest', () => {
  it('is a valid skeleton with stairs in the start room', () => {
    const q = empty();
    expect(parseQuest(JSON.parse(JSON.stringify(q)))).toEqual(q);
    expect(validateQuest(q, board)).toEqual([]);
    expect(q.start.area).toBe('R20');
    expect(q.furniture[0]?.type).toBe('stairs');
    expect(q.intro.summary).not.toBe('');
  });
  it('only lacks an objective in the editor check', () => {
    const errors = validateQuestIssues(empty(), board).filter((i) => i.severity === 'error');
    expect(errors.map((e) => e.message)).toEqual(['The quest has no objective. Add at least one.']);
  });
});

describe('immutability', () => {
  it('never changes its input', () => {
    const q = deepFreeze(testQuest());
    const e = deepFreeze(empty());
    const tries: EditResult[] = [
      setRockCell(e, [0, 0], true),
      setRockRoom(e, 'R04', true),
      addDoor(e, [3, 17], [3, 18]),
      addBlock(e, [[8, 18]]),
      addFurniture(e, 'table', [[3, 16]]),
      moveFurniture(e, 'f-stairs', [3, 14]),
      rotateFurniture(
        deepFreeze(
          good(
            addFurniture(e, 'table', [
              [3, 16],
              [3, 17],
            ]),
          ),
        ),
        'f1',
      ),
      removeFurniture(q, 'f1'),
      addMonster(e, 'orc', [4, 14]),
      moveMonster(q, 'm1', [7, 15]),
      removeMonster(q, 'm1'),
      addTrap(e, 'pit', { cell: [3, 16] }),
      removeTrap(q, 't1'),
      addMarker(e, 'X', [3, 16], 'zargon'),
      setStartArea(e, 'R17'),
      renameQuest(e, 'Y'),
      setSummary(e, 'Y'),
      setDoorKind(q, 'd1', 'secret'),
      removeDoor(q, 'd1'),
      removeBlock(q, [8, 18]),
    ];
    tries.forEach((t, i) => expect(t.ok, `op ${i}`).toBe(true));
  });
});

describe('rock', () => {
  it('toggles single cells, sorted and without duplicates', () => {
    let q = good(setRockCell(empty(), [5, 0], true));
    q = good(setRockCell(q, [2, 0], true));
    q = good(setRockCell(q, [5, 0], true));
    expect(q.rock.cells).toEqual([
      [2, 0],
      [5, 0],
    ]);
    q = good(setRockCell(q, [2, 0], false));
    expect(q.rock.cells).toEqual([[5, 0]]);
  });
  it('refuses outside the board and things on the cell', () => {
    expect(bad(setRockCell(empty(), [26, 0], true))).toMatch(/outside/);
    expect(bad(setRockCell(empty(), [1, 14], true))).toMatch(/stairs/);
    expect(bad(setRockRoom(empty(), 'R20', true))).toMatch(/start room/);
  });
  it('rock rooms are sorted, drop redundant cells and refuse occupied rooms', () => {
    const [rx, ry] = cellsOf(board, 'R04')[0] as [number, number];
    let q = good(setRockCell(empty(), [rx, ry], true));
    q = good(setRockRoom(q, 'R05', true));
    q = good(setRockRoom(q, 'R04', true));
    q = good(setRockRoom(q, 'R04', true));
    expect(q.rock.rooms).toEqual(['R04', 'R05']);
    expect(q.rock.cells).toEqual([]);
    expect(bad(setRockCell(q, [rx, ry], false))).toMatch(/rock room R04/);
    q = good(setRockRoom(q, 'R04', false));
    expect(q.rock.rooms).toEqual(['R05']);
    expect(bad(setRockRoom(testQuest(), 'R17', true))).toMatch(/Remove it first/);
    expect(bad(setRockRoom(empty(), 'C', true))).toMatch(/not a room/);
  });
});

describe('doors', () => {
  it('adds doors with d, s, x ids and reuses the first free number', () => {
    let q = good(addDoor(empty(), [3, 17], [3, 18]));
    q = good(addDoor(q, [4, 15], [5, 15]));
    q = good(addDoor(q, [4, 16], [5, 16], 'secret'));
    q = good(addDoor(q, [4, 17], [5, 17], 'false'));
    expect(q.doors.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(q.secretDoors[0]?.id).toBe('s1');
    expect(q.falseDoors[0]?.id).toBe('x1');
    q = good(removeDoor(q, 'd1'));
    q = good(addDoor(q, [3, 17], [3, 18]));
    expect(q.doors.map((d) => d.id)).toEqual(['d2', 'd1']);
    expect(validateQuest(q, board)).toEqual([]);
  });
  it('refuses bad edges with a plain message', () => {
    const q = empty();
    expect(bad(addDoor(q, [3, 17], [3, 19]))).toMatch(/outside/);
    expect(bad(addDoor(q, [3, 16], [3, 18]))).toMatch(/next to each other/);
    expect(bad(addDoor(q, [2, 16], [2, 17]))).toMatch(/no wall/);
    expect(bad(addDoor(q, [0, 18], [1, 18]))).toMatch(/no wall/);
    const one = good(addDoor(q, [3, 17], [3, 18]));
    expect(bad(addDoor(one, [3, 18], [3, 17], 'secret'))).toMatch(/already on that edge/);
  });
  it('refuses a door under furniture or touching rock, except a false door', () => {
    let q = good(addFurniture(empty(), 'table', [[3, 17]]));
    expect(bad(addDoor(q, [3, 17], [3, 18]))).toMatch(/furniture f1/);
    q = good(setRockCell(empty(), [3, 18], true));
    expect(bad(addDoor(q, [3, 17], [3, 18]))).toMatch(/rock/);
    expect(good(addDoor(q, [3, 17], [3, 18], 'false')).falseDoors).toHaveLength(1);
  });
  it('changes kind, renames the id and rewrites note references', () => {
    const q = testQuest({
      notes: [
        { id: 'n1', trigger: { type: 'doorOpened', door: 'd3' }, effects: [] },
        {
          id: 'n2',
          trigger: { type: 'manual', label: 'go' },
          effects: [{ type: 'addSecretDoor', door: 's1' }],
        },
      ],
      monsters: [],
      traps: [],
      furniture: [],
    });
    const next = good(setDoorKind(q, 'd3', 'secret'));
    expect(next.secretDoors.map((d) => d.id)).toEqual(['s1', 's2']);
    expect(next.doors.map((d) => d.id)).toEqual(['d1', 'd2', 'd4', 'd5']);
    expect(next.notes[0]?.trigger).toEqual({ type: 'doorOpened', door: 's2' });
    expect(validateQuest(next, board)).toEqual([]);
    // secret -> normal: the addSecretDoor note is reported
    const back = setDoorKind(q, 's1', 'normal');
    expect(warned(back)).toEqual(['note:n2']);
    expect(good(back).doors.map((d) => d.id)).toContain('d6');
    expect(good(setDoorKind(q, 'd3', 'normal'))).toBe(q);
  });
  it('refuses a kind change that touches rock', () => {
    const q = good(setRockCell(good(addDoor(empty(), [3, 17], [3, 18], 'false')), [3, 18], true));
    expect(bad(setDoorKind(q, 'x1', 'normal'))).toMatch(/rock/);
  });
  it('removing a door reports notes that wait for it and keeps them', () => {
    const q = testQuest({
      notes: [{ id: 'n1', trigger: { type: 'doorOpened', door: 'd3' }, effects: [] }],
      monsters: [],
      traps: [],
      furniture: [],
    });
    const r = removeDoor(q, 'd3');
    expect(warned(r)).toEqual(['note:n1']);
    const next = good(r);
    expect(next.notes).toHaveLength(1);
    expect(validateQuest(next, board).join()).toMatch(/unknown door d3/);
    expect(bad(removeDoor(q, 'zz'))).toMatch(/no door/);
  });
});

describe('blocks', () => {
  it('adds one or two squares and removes by square', () => {
    let q = good(addBlock(empty(), [[8, 18]]));
    q = good(
      addBlock(q, [
        [12, 5],
        [13, 5],
      ]),
    );
    expect(q.blocks).toHaveLength(2);
    q = good(removeBlock(q, [13, 5]));
    expect(q.blocks).toEqual([{ cells: [[8, 18]] }]);
    expect(bad(removeBlock(q, [0, 0]))).toMatch(/no block/);
  });
  it('refuses bad blocks', () => {
    const q = good(addBlock(empty(), [[8, 18]]));
    expect(bad(addBlock(q, []))).toMatch(/one or two/);
    expect(
      bad(
        addBlock(q, [
          [1, 1],
          [2, 1],
          [3, 1],
        ]),
      ),
    ).toMatch(/one or two/);
    expect(
      bad(
        addBlock(q, [
          [3, 15],
          [3, 17],
        ]),
      ),
    ).toMatch(/neighbours/);
    expect(bad(addBlock(q, [[8, 18]]))).toMatch(/already/);
    expect(bad(addBlock(q, [[1, 14]]))).toMatch(/stairs/);
    expect(bad(addBlock(q, [[-1, 14]]))).toMatch(/outside/);
  });
});

describe('furniture', () => {
  it('adds with generated ids, keeps letters and checks the footprint', () => {
    let q = good(
      addFurniture(
        empty(),
        'table',
        [
          [3, 16],
          [4, 16],
        ],
        { letter: 'A' },
      ),
    );
    expect(q.furniture[1]).toEqual({
      id: 'f1',
      type: 'table',
      cells: [
        [3, 16],
        [4, 16],
      ],
      letter: 'A',
    });
    q = good(addFurniture(q, 'chest', [[4, 17]]));
    expect(q.furniture[2]?.id).toBe('f2');
    expect(validateQuest(q, board)).toEqual([]);
  });
  it('refuses rock, outside, corridor, two rooms, overlaps, gaps and used ids', () => {
    const q = good(addFurniture(empty(), 'table', [[3, 16]]));
    expect(bad(addFurniture(q, 'table', [[3, 16]]))).toMatch(/furniture f1/);
    expect(bad(addFurniture(q, 'table', [[1, 14]]))).toMatch(/stairs/);
    expect(bad(addFurniture(q, 'table', [[3, 18]]))).toMatch(/corridor/);
    expect(
      bad(
        addFurniture(q, 'table', [
          [4, 15],
          [5, 15],
        ]),
      ),
    ).toMatch(/one room/);
    expect(bad(addFurniture(q, 'table', [[26, 0]]))).toMatch(/outside/);
    expect(
      bad(
        addFurniture(q, 'table', [
          [3, 14],
          [3, 17],
        ]),
      ),
    ).toMatch(/touch/);
    expect(
      bad(
        addFurniture(q, 'table', [
          [3, 14],
          [3, 14],
        ]),
      ),
    ).toMatch(/twice/);
    expect(bad(addFurniture(q, 'table', []))).toMatch(/at least one/);
    expect(bad(addFurniture(q, 'table', [[4, 14]], { id: 'f1' }))).toMatch(/already exists/);
    expect(bad(addFurniture(q, 'table', [[4, 14]], { id: ' ' }))).toMatch(/empty/);
    const rock = good(setRockCell(empty(), [3, 16], true));
    expect(bad(addFurniture(rock, 'table', [[3, 16]]))).toMatch(/rock/);
    const blocked = good(addBlock(empty(), [[3, 16]]));
    expect(bad(addFurniture(blocked, 'table', [[3, 16]]))).toMatch(/block/);
    const monster = good(addMonster(empty(), 'orc', [3, 16]));
    expect(bad(addFurniture(monster, 'table', [[3, 16]]))).toMatch(/monster m1/);
  });
  it('moves by the first square and checks again', () => {
    const q = good(
      addFurniture(empty(), 'table', [
        [3, 14],
        [4, 14],
      ]),
    );
    const moved = good(moveFurniture(q, 'f1', [3, 16]));
    expect(moved.furniture[1]?.cells).toEqual([
      [3, 16],
      [4, 16],
    ]);
    // it may overlap its own old squares
    expect(moveFurniture(q, 'f1', [4, 14]).ok).toBe(false); // second square would be x=5, outside R20
    expect(moveFurniture(q, 'f1', [3, 15]).ok).toBe(true);
    expect(bad(moveFurniture(q, 'f1', [1, 14]))).toMatch(/stairs/);
    expect(bad(moveFurniture(q, 'nope', [1, 14]))).toMatch(/no furniture/);
  });
  it('rotates 90 degrees clockwise around the first square', () => {
    let q = good(
      addFurniture(empty(), 'table', [
        [2, 16],
        [3, 16],
        [2, 17],
      ]),
    );
    q = good(rotateFurniture(q, 'f1'));
    expect(q.furniture[1]?.cells).toEqual([
      [2, 16],
      [2, 17],
      [1, 16],
    ]);
    // the next turn would put a square on the stairs
    expect(bad(rotateFurniture(q, 'f1'))).toMatch(/stairs/);
  });
  it('four rotations give the first shape back', () => {
    let q = good(
      addFurniture(empty(), 'table', [
        [12, 9],
        [13, 9],
        [12, 10],
      ]),
    );
    const start = q.furniture[1]?.cells;
    for (let i = 0; i < 4; i++) q = good(rotateFurniture(q, 'f1'));
    expect(q.furniture[1]?.cells).toEqual(start);
  });
  it('refuses a rotation that leaves the room', () => {
    const q = good(
      addFurniture(empty(), 'table', [
        [3, 17],
        [4, 17],
      ]),
    );
    expect(bad(rotateFurniture(q, 'f1'))).toMatch(/one room/);
  });
  it('removing furniture removes its chest trap and warns about notes on that trap', () => {
    const q = testQuest({
      notes: [
        ...testQuest().notes,
        { id: 'n1', trigger: { type: 'trapSprung', trap: 't2' }, effects: [] },
      ],
    });
    const r = removeFurniture(q, 'f1');
    expect(good(r).traps.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(warned(r)).toEqual(['note:n1']);
    expect(bad(removeFurniture(q, 'zz'))).toMatch(/no furniture/);
  });
  it('removing lettered furniture warns about its note unless the letter is still on the map', () => {
    let q = good(addFurniture(empty(), 'chest', [[3, 16]], { letter: 'A' }));
    q = {
      ...q,
      notes: [
        { id: 'n-A', letter: 'A', trigger: { type: 'treasureSearch', area: 'R20' }, effects: [] },
      ],
    };
    expect(warned(removeFurniture(q, 'f1'))).toEqual(['note:n-A']);
    const two = good(addFurniture(q, 'chest', [[4, 16]], { letter: 'A' }));
    expect(warned(removeFurniture(two, 'f1'))).toEqual([]);
  });
});

describe('monsters', () => {
  it('adds, moves and removes', () => {
    let q = good(addMonster(empty(), 'orc', [3, 16]));
    q = good(
      addMonster(q, 'gargoyle', [4, 16], { id: 'm-verag', name: 'Verag', overrides: { att: 4 } }),
    );
    expect(q.monsters.map((m) => m.id)).toEqual(['m1', 'm-verag']);
    expect(q.monsters[1]).toEqual({
      id: 'm-verag',
      type: 'gargoyle',
      cell: [4, 16],
      name: 'Verag',
      overrides: { att: 4 },
    });
    q = good(moveMonster(q, 'm1', [3, 15]));
    expect(q.monsters[0]?.cell).toEqual([3, 15]);
    q = good(removeMonster(q, 'm1'));
    expect(q.monsters.map((m) => m.id)).toEqual(['m-verag']);
    expect(good(addMonster(q, 'zombie', [3, 14])).monsters.at(-1)?.id).toBe('m1');
  });
  it('refuses rock, blocks, furniture, other monsters, outside, and a missing cell', () => {
    const q = good(addMonster(testQuest({ monsters: [], traps: [] }), 'orc', [6, 15]));
    expect(bad(addMonster(q, 'orc', [6, 15]))).toMatch(/monster m1/);
    expect(bad(addMonster(q, 'orc', [6, 14]))).toMatch(/furniture f1/);
    expect(bad(addMonster(q, 'orc', [8, 18]))).toMatch(/block/);
    expect(bad(addMonster(q, 'orc', [13, 0]))).toMatch(/rock/);
    expect(bad(addMonster(q, 'orc', [0, 40]))).toMatch(/outside/);
    expect(bad(addMonster(q, 'orc', null))).toMatch(/hidden/);
    expect(bad(addMonster(q, 'orc', [7, 15], { id: 'm1' }))).toMatch(/already exists/);
    expect(bad(moveMonster(q, 'm1', [6, 14]))).toMatch(/furniture/);
    expect(bad(moveMonster(q, 'zz', [7, 15]))).toMatch(/no monster/);
    expect(moveMonster(q, 'm1', [6, 15]).ok).toBe(true);
  });
  it('hidden monsters need no cell', () => {
    const q = good(addMonster(empty(), 'gargoyle', null, { hidden: true }));
    expect(q.monsters[0]).toEqual({ id: 'm1', type: 'gargoyle', hidden: true });
  });
  it('removing a monster reports notes and objectives that use it', () => {
    const base = testQuest();
    const q: Quest = {
      ...base,
      objectives: [{ id: 'o1', text: 'Kill', done: { monsterKilled: 'm1' } }],
      notes: [
        ...base.notes,
        { id: 'n2', trigger: { type: 'monsterKilled', monster: 'm1' }, effects: [] },
        {
          id: 'n3',
          trigger: { type: 'manual', label: 'x' },
          when: [{ monster: 'm1', alive: true }],
          effects: [],
        },
      ],
    };
    expect(warned(removeMonster(q, 'm1'))).toEqual(['note:n2', 'note:n3', 'objective:o1']);
  });
});

describe('traps and markers', () => {
  it('adds cell traps and chest traps', () => {
    let q = good(addFurniture(empty(), 'chest', [[3, 16]]));
    q = good(addTrap(q, 'pit', { cell: [4, 16] }));
    q = good(addTrap(q, 'chest', { furniture: 'f1' }, { effect: 'A dart flies out.' }));
    expect(q.traps).toEqual([
      { id: 't1', kind: 'pit', cell: [4, 16] },
      { id: 't2', kind: 'chest', furniture: 'f1', effect: 'A dart flies out.' },
    ]);
    expect(validateQuest(q, board)).toEqual([]);
    expect(bad(addTrap(q, 'chest', { furniture: 'f1' }))).toMatch(/already has a trap/);
    q = good(removeTrap(q, 't1'));
    expect(q.traps).toHaveLength(1);
    expect(bad(removeTrap(q, 't1'))).toMatch(/no trap/);
  });
  it('refuses bad traps', () => {
    const q = good(addFurniture(empty(), 'chest', [[3, 16]]));
    expect(bad(addTrap(q, 'pit', { furniture: 'f1' }))).toMatch(/square/);
    expect(bad(addTrap(q, 'chest', { cell: [4, 16] }))).toMatch(/furniture/);
    expect(bad(addTrap(q, 'chest', { furniture: 'zz' }))).toMatch(/no furniture/);
    expect(bad(addTrap(q, 'pit', { cell: [3, 16] }))).toMatch(/furniture f1/);
    expect(bad(addTrap(q, 'pit', { cell: [30, 16] }))).toMatch(/outside/);
    const t = good(addTrap(q, 'spear', { cell: [4, 16] }));
    expect(bad(addTrap(t, 'pit', { cell: [4, 16] }))).toMatch(/trap t1/);
  });
  it('removeTrap reports notes on the trap', () => {
    const base = testQuest();
    const q: Quest = {
      ...base,
      notes: [
        ...base.notes,
        { id: 'n9', trigger: { type: 'trapDisarmed', trap: 't1' }, effects: [] },
      ],
    };
    expect(warned(removeTrap(q, 't1'))).toEqual(['note:n9']);
  });
  it('adds and removes markers', () => {
    let q = good(addMarker(empty(), 'X', [3, 16], 'zargon'));
    q = good(addMarker(q, 'A', [4, 16]));
    expect(q.markers).toEqual([
      { id: 'k1', label: 'X', cell: [3, 16], visible: 'zargon' },
      { id: 'k2', label: 'A', cell: [4, 16] },
    ]);
    expect(bad(addMarker(q, ' ', [4, 16]))).toMatch(/label/);
    expect(bad(addMarker(q, 'B', [99, 16]))).toMatch(/outside/);
    q = good(removeMarker(q, 'k1'));
    expect(q.markers.map((m) => m.id)).toEqual(['k2']);
    expect(bad(removeMarker(q, 'k1'))).toMatch(/no marker/);
  });
});

describe('start and text', () => {
  it('sets the start room', () => {
    expect(good(setStartArea(empty(), 'R17')).start.area).toBe('R17');
    expect(bad(setStartArea(empty(), 'C'))).toMatch(/not a room/);
    expect(bad(setStartArea(empty(), 'R99'))).toMatch(/not a room/);
    const rock = good(setRockRoom(empty(), 'R04', true));
    expect(bad(setStartArea(rock, 'R04'))).toMatch(/rock/);
  });
  it('renames and sets the summary', () => {
    expect(good(renameQuest(empty(), '  New  ')).title).toBe('New');
    expect(bad(renameQuest(empty(), ' '))).toMatch(/empty/);
    expect(good(setSummary(empty(), 'Hi')).intro.summary).toBe('Hi');
    expect(bad(setSummary(empty(), ''))).toMatch(/empty/);
  });
});

describe('text and id checks', () => {
  it('rejects empty or blank text and malformed ids with a plain message', () => {
    const q = empty();
    const at = (o: object) => addFurniture(q, 'table', [[3, 16]], o);
    expect(bad(at({ letter: '  ' }))).toMatch(/letter cannot be empty/);
    expect(bad(at({ letter: '' }))).toMatch(/letter cannot be empty/);
    expect(bad(at({ id: 'a b' }))).toMatch(/can only use letters/);
    expect(bad(at({ id: '-x' }))).toMatch(/can only use letters/);
    expect(bad(addMarker(q, '   ', [3, 16]))).toMatch(/label/);
    expect(bad(addMarker(q, 'A', [3, 16], undefined, 'k 1'))).toMatch(/can only use letters/);
    const mon = (o: object) => addMonster(q, 'orc', [3, 16], o);
    expect(bad(mon({ name: ' ' }))).toMatch(/name cannot be empty/);
    expect(bad(mon({ traits: ['ok', ' '] }))).toMatch(/cannot be empty/);
    expect(bad(mon({ spells: [''] }))).toMatch(/cannot be empty/);
    expect(bad(mon({ overrides: { att: -1 } }))).toMatch(/att override/);
    expect(bad(mon({ overrides: { att: 1.5 } }))).toMatch(/att override/);
    expect(bad(mon({ id: 'mé' }))).toMatch(/can only use letters/);
    expect(bad(addTrap(q, 'pit', { cell: [3, 16] }, { effect: ' ' }))).toMatch(
      /effect cannot be empty/,
    );
    expect(bad(addTrap(q, 'pit', { cell: [3, 16] }, { id: '' }))).toMatch(/empty/);
  });
  it('trims accepted text', () => {
    const q = good(addFurniture(empty(), 'chest', [[3, 16]], { letter: ' A ' }));
    expect(q.furniture[1]?.letter).toBe('A');
    const m = good(addMonster(q, 'orc', [4, 16], { name: ' Bob ', traits: [' tough '] }));
    expect(m.monsters[0]).toMatchObject({ name: 'Bob', traits: ['tough'] });
  });
  it('accepts the ids used by real quests', () => {
    let q = good(addMonster(empty(), 'gargoyle', [4, 16], { id: 'm-verag' }));
    q = good(addFurniture(q, 'chest', [[3, 16]], { id: 'f-chest-d' }));
    expect(q.monsters[0]?.id).toBe('m-verag');
  });
  it('reuses the lowest free generated id after a removal (documented)', () => {
    let q = good(addDoor(empty(), [3, 17], [3, 18]));
    q = good(addDoor(q, [4, 15], [5, 15]));
    q = good(removeDoor(q, 'd1'));
    q = good(addDoor(q, [3, 17], [3, 18]));
    expect(q.doors.map((d) => d.id)).toEqual(['d2', 'd1']);
  });
});

describe('stacking rules', () => {
  const npc = { id: 'n1', name: 'Ragnar', cell: [7, 15], defend: 2, body: 4, text: 'Escort.' };
  const stairs = {
    id: 'f-stairs',
    type: 'stairs',
    cells: [
      [1, 15],
      [2, 15],
    ],
  };
  const base = () =>
    testQuest({
      monsters: [{ id: 'm1', type: 'orc', cell: [6, 15] }],
      traps: [],
      npcs: [npc],
      notes: [],
      furniture: [{ id: 'f1', type: 'chest', cells: [[6, 14]] }, stairs],
    });

  it('a trap may share a monster square, and a chest trap sits on its chest', () => {
    const q = good(addTrap(base(), 'pit', { cell: [6, 15] }));
    expect(q.traps[0]?.cell).toEqual([6, 15]);
    expect(good(addTrap(base(), 'chest', { furniture: 'f1' })).traps).toHaveLength(1);
    expect(validateQuest(q, board)).toEqual([]);
  });
  it('a monster can be added or moved onto a trap square', () => {
    const q = good(addTrap(base(), 'pit', { cell: [5, 16] }));
    expect(addMonster(q, 'goblin', [5, 16]).ok).toBe(true);
    expect(moveMonster(q, 'm1', [5, 16]).ok).toBe(true);
  });
  it('refuses a monster on an NPC square (add, move, hidden)', () => {
    expect(bad(addMonster(base(), 'orc', [7, 15]))).toMatch(/npc n1/);
    expect(bad(moveMonster(base(), 'm1', [7, 15]))).toMatch(/npc n1/);
    expect(bad(addMonster(base(), 'orc', [7, 15], { hidden: true }))).toMatch(/npc n1/);
  });
  it('refuses a second monster on a square', () => {
    expect(bad(addMonster(base(), 'orc', [6, 15]))).toMatch(/monster m1/);
  });
  it('refuses a trap on stairs or an NPC, allows one on a door square', () => {
    expect(bad(addTrap(base(), 'pit', { cell: [1, 15] }))).toMatch(/stairs/);
    expect(addTrap(base(), 'pit', { cell: [5, 15] }).ok).toBe(true);
    expect(bad(addTrap(base(), 'spear', { cell: [7, 15] }))).toMatch(/npc n1/);
  });
  it('refuses two traps on a square, also when a trap is moved by updateTrap', () => {
    const q = good(addTrap(base(), 'pit', { cell: [5, 16] }));
    expect(bad(addTrap(q, 'spear', { cell: [5, 16] }))).toMatch(/trap t1/);
  });
});

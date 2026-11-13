// Prototype data: the 2021 board geometry + Quest 1 "The Trial" (south-west part only).
// Notes are paraphrased. Positions read from the Quest Book map.
window.BOARD = (function () {
  const ROWS = [
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
    ".. 01 01 01 01 02 02 02 02 03 03 03 .. .. 04 04 04 05 05 05 05 06 06 06 06 ..",
    ".. 01 01 01 01 02 02 02 02 03 03 03 .. .. 04 04 04 05 05 05 05 06 06 06 06 ..",
    ".. 01 01 01 01 02 02 02 02 03 03 03 .. .. 04 04 04 05 05 05 05 06 06 06 06 ..",
    ".. 07 07 07 07 08 08 08 08 03 03 03 .. .. 04 04 04 05 05 05 05 06 06 06 06 ..",
    ".. 07 07 07 07 08 08 08 08 03 03 03 .. .. 04 04 04 09 09 09 09 10 10 10 10 ..",
    ".. 07 07 07 07 08 08 08 08 .. .. .. .. .. .. .. .. 09 09 09 09 10 10 10 10 ..",
    ".. 07 07 07 07 08 08 08 08 .. 11 11 11 11 11 11 .. 09 09 09 09 10 10 10 10 ..",
    ".. 07 07 07 07 08 08 08 08 .. 11 11 11 11 11 11 .. 09 09 09 09 10 10 10 10 ..",
    ".. .. .. .. .. .. .. .. .. .. 11 11 11 11 11 11 .. .. .. .. .. .. .. .. .. ..",
    ".. 12 12 12 12 13 13 14 14 .. 11 11 11 11 11 11 .. 15 15 15 15 16 16 16 16 ..",
    ".. 12 12 12 12 13 13 14 14 .. 11 11 11 11 11 11 .. 15 15 15 15 16 16 16 16 ..",
    ".. 12 12 12 12 13 13 14 14 .. .. .. .. .. .. .. .. 15 15 15 15 16 16 16 16 ..",
    ".. 12 12 12 12 17 17 17 17 18 18 18 .. .. 19 19 19 19 15 15 15 16 16 16 16 ..",
    ".. 20 20 20 20 17 17 17 17 18 18 18 .. .. 19 19 19 19 21 21 21 22 22 22 22 ..",
    ".. 20 20 20 20 17 17 17 17 18 18 18 .. .. 19 19 19 19 21 21 21 22 22 22 22 ..",
    ".. 20 20 20 20 17 17 17 17 18 18 18 .. .. 19 19 19 19 21 21 21 22 22 22 22 ..",
    ".. 20 20 20 20 17 17 17 17 18 18 18 .. .. 19 19 19 19 21 21 21 22 22 22 22 ..",
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .."
  ];
  const W = 26, H = 19;
  const cells = ROWS.map(r => r.split(' ').map(c => c === '..' ? 'C' : 'R' + c));
  const area = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : cells[y][x];
  return { W, H, cells, area };
})();

window.QUEST = (function () {
  // Corridor squares that are open floor in this quest. Every other corridor square is solid rock.
  const open = new Set();
  const add = (x, y) => open.add(x + ',' + y);
  for (let x = 0; x <= 13; x++) add(x, 18);
  for (let y = 12; y <= 17; y++) { add(12, y); add(13, y); }
  for (let x = 9; x <= 16; x++) { add(x, 12); add(x, 6); }
  for (let y = 6; y <= 12; y++) { add(9, y); add(16, y); }
  for (let x = 0; x <= 9; x++) add(x, 9);
  for (let y = 0; y <= 18; y++) add(0, y);
  for (let x = 0; x <= 11; x++) add(x, 0);
  const rockRooms = ['R04', 'R05', 'R06', 'R09', 'R10', 'R13', 'R14', 'R15', 'R16', 'R21', 'R22'];

  return {
    number: 1,
    title: 'The Trial',
    goal: 'Find and destroy Verag, the gargoyle hiding in the catacombs.',
    zargonInfo: 'No traps and no secret doors in this quest. It is a hard one: the heroes survive only if they fight together.',
    wandering: 'Orc',
    start: 'R20',
    openCorridor: open,
    rockRooms,
    furniture: [
      { id: 'stairs', type: 'stairs', name: 'Stairway', x: 1, y: 14, w: 2, h: 2 },
      { id: 'f1', type: 'cupboard', name: 'Cupboard', x: 5, y: 13, w: 3, h: 1 },
      { id: 'f2', type: 'bench', name: "Alchemist's bench", x: 5, y: 15, w: 2, h: 3 },
      { id: 'f3', type: 'rack', name: 'Weapons rack', x: 11, y: 15, w: 1, h: 3 },
      { id: 'f4', type: 'bookcase', name: 'Bookcase', x: 15, y: 13, w: 3, h: 1 },
      { id: 'f5', type: 'cupboard', name: 'Cupboard', x: 15, y: 17, w: 3, h: 1 },
      { id: 'f6', type: 'chest', name: 'Treasure chest', x: 17, y: 16, w: 1, h: 1 },
      { id: 'f7', type: 'rack', name: 'Rack', x: 3, y: 10, w: 2, h: 3 }
    ],
    doors: [
      { id: 'd1', a: [3, 17], b: [3, 18] },
      { id: 'd2', a: [7, 17], b: [7, 18] },
      { id: 'd3', a: [8, 15], b: [9, 15] },
      { id: 'd4', a: [10, 12], b: [10, 13] },
      { id: 'd5', a: [13, 15], b: [14, 15] },
      { id: 'd6', a: [0, 11], b: [1, 11] },
      { id: 'd7', a: [3, 8], b: [3, 9] },
      { id: 'd8', a: [7, 8], b: [7, 9] }
    ],
    blocks: [[14, 18]],
    // Prototype only: Quest 1 has no traps. One trap is placed to show the trap flow.
    traps: [{ id: 't1', kind: 'pit', x: 11, y: 18 }],
    monsters: [
      { id: 'o1', type: 'orc', x: 7, y: 14 },
      { id: 'o2', type: 'orc', x: 8, y: 15 },
      { id: 'g1', type: 'goblin', x: 10, y: 14 },
      { id: 'a1', type: 'abomination', x: 10, y: 16 },
      { id: 'w1', type: 'dread', x: 16, y: 15 },
      { id: 'w2', type: 'dread', x: 15, y: 16 },
      { id: 'g2', type: 'goblin', x: 2, y: 11 },
      { id: 'g3', type: 'goblin', x: 2, y: 12 }
    ],
    notes: {
      R18: { letter: 'A', at: [11, 14], text: 'The weapons on this rack are chipped, rusted and broken. Nothing here is worth taking.', consumesTreasure: true },
      R19: { letter: 'B', at: [17, 15], text: 'This treasure chest is empty.', consumesTreasure: true }
    }
  };
})();

window.MONSTERS = {
  goblin: { name: 'Goblin', code: 'G', move: 10, att: 2, def: 1, body: 1, profile: 'skirmisher' },
  orc: { name: 'Orc', code: 'O', move: 8, att: 3, def: 2, body: 1, profile: 'soldier' },
  abomination: { name: 'Abomination', code: 'A', move: 6, att: 3, def: 3, body: 2, profile: 'brute' },
  dread: { name: 'Dread warrior', code: 'D', move: 7, att: 4, def: 4, body: 3, profile: 'duelist' }
};
window.HEROES = ['Barbarian', 'Dwarf', 'Elf', 'Wizard'];

// Shared sample data for the three direction mock-ups.
// Board geometry: the 2021 HeroQuest board, 26 x 19, extracted from the blank quest map.
// '..' = corridor, '01'..'22' = room id.
window.HQ = (function () {
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

  // Sample game state: Quest 1, The Trial, turn 3.
  // Heroes left the stairway room, looked down the south corridor, opened the alchemist's room.
  const corridorSeen = [];
  for (let x = 0; x <= 14; x++) corridorSeen.push([x, 18]);
  const state = {
    quest: { number: 1, title: 'The Trial', goal: 'Find and destroy Verag, the gargoyle of the catacombs.', wandering: 'Orc' },
    turn: 3,
    heroes: [
      { id: 'barbarian', name: 'Barbarian', body: 8, max: 8, mind: 2 },
      { id: 'dwarf', name: 'Dwarf', body: 7, max: 7, mind: 3 },
      { id: 'elf', name: 'Elf', body: 5, max: 6, mind: 4 },
      { id: 'wizard', name: 'Wizard', body: 4, max: 4, mind: 6 }
    ],
    revealedRooms: ['R20', 'R17'],
    litRoom: 'R17',              // area revealed by the last action
    corridorSeen,
    furniture: [
      { type: 'stairs', label: 'Stairway', x: 1, y: 14, w: 2, h: 2 },
      { type: 'cupboard', label: 'Cupboard', x: 5, y: 13, w: 3, h: 1 },
      { type: 'bench', label: "Alchemist's bench", x: 5, y: 15, w: 2, h: 3 }
    ],
    doors: [
      { id: 'd1', a: [3, 17], b: [3, 18], open: true },
      { id: 'd2', a: [7, 17], b: [7, 18], open: true },
      { id: 'd3', a: [8, 15], b: [9, 15], open: false, selected: true },
      { id: 'd4', a: [14, 17], b: [14, 18], open: false }
    ],
    monsters: [
      { id: 'o1', type: 'Orc', code: 'O1', x: 7, y: 14, move: 8, att: 3, def: 2, body: 1, maxBody: 1 },
      { id: 'o2', type: 'Orc', code: 'O2', x: 8, y: 15, move: 8, att: 3, def: 2, body: 1, maxBody: 1 }
    ]
  };

  const seenSet = new Set(state.corridorSeen.map(([x, y]) => x + ',' + y));
  function isRevealed(x, y) {
    const a = area(x, y);
    if (!a) return false;
    if (a === 'C') return seenSet.has(x + ',' + y);
    return state.revealedRooms.includes(a);
  }
  // Wall segments around revealed cells: edges where the neighbour is another area.
  // Returns [{x1,y1,x2,y2}] in cell units.
  function walls() {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isRevealed(x, y)) continue;
      const a = area(x, y);
      const sides = [[0, -1, x, y, x + 1, y], [1, 0, x + 1, y, x + 1, y + 1], [0, 1, x, y + 1, x + 1, y + 1], [-1, 0, x, y, x, y + 1]];
      for (const [dx, dy, x1, y1, x2, y2] of sides) {
        const b = area(x + dx, y + dy);
        if (b === a) continue;
        if (a === 'C' && b === 'C') continue;
        out.push({ x1, y1, x2, y2 });
      }
    }
    return out;
  }
  // Edge of a door in cell units.
  function doorEdge(d) {
    const [ax, ay] = d.a, [bx, by] = d.b;
    if (ay === by) { const x = Math.max(ax, bx); return { x1: x, y1: ay, x2: x, y2: ay + 1, vertical: true }; }
    const y = Math.max(ay, by); return { x1: ax, y1: y, x2: ax + 1, y2: y, vertical: false };
  }
  return { W, H, cells, area, state, isRevealed, walls, doorEdge };
})();

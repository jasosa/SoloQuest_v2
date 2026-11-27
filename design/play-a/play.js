/* SoloQuest v2 · Direction A prototype. Plain JS, no build step.
   Engine part (reveal, line of sight, searches, traps, Zargon orders) is kept small and separate from rendering. */
(function () {
  const { W, H, area } = window.BOARD;
  const Q = window.QUEST, M = window.MONSTERS, HEROES = window.HEROES;
  const L = window.PLAY_LAYOUT || {};   // team concepts change the board size and place (layout.js)
  const S = L.S || 34;                  // cell size in px
  const MAPX = L.mapx == null ? 28 : L.mapx, MAPY = L.mapy == null ? 32 : L.mapy;      // board offset inside .map
  const k = (x, y) => x + ',' + y;

  /* ======================= engine ======================= */
  const isRockRoom = a => Q.rockRooms.includes(a);
  const isBlock = (x, y) => Q.blocks.some(([bx, by]) => bx === x && by === y);
  function isFloor(x, y) {
    const a = area(x, y);
    if (!a) return false;
    if (a === 'C') return Q.openCorridor.has(k(x, y)) && !isBlock(x, y);
    return !isRockRoom(a);
  }
  function doorBetween(x1, y1, x2, y2) {
    return Q.doors.find(d => (d.a[0] === x1 && d.a[1] === y1 && d.b[0] === x2 && d.b[1] === y2) || (d.b[0] === x1 && d.b[1] === y1 && d.a[0] === x2 && d.a[1] === y2));
  }
  // can sight pass between two orthogonal neighbours? A blocked square is "seen" when sight reaches its edge.
  function passable(st, x1, y1, x2, y2, blockOk) {
    if (!isFloor(x2, y2) && !(blockOk && isBlock(x2, y2))) return false;
    const a = area(x1, y1), b = area(x2, y2);
    if (a === b) return true;
    if (a === 'C' && b === 'C') return true;
    const d = doorBetween(x1, y1, x2, y2);
    return !!(d && st.open.has(d.id));
  }
  // line of sight, centre to centre; a line that only touches a corner still sees.
  function los(st, fx, fy, tx, ty) {
    let cx = fx, cy = fy;
    const x0 = fx + .5, y0 = fy + .5, x1 = tx + .5, y1 = ty + .5;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 40);
    for (let i = 1; i <= n; i++) {
      const px = x0 + (x1 - x0) * i / n, py = y0 + (y1 - y0) * i / n;
      const nx = Math.floor(px - 1e-9 * Math.sign(x1 - x0)), ny = Math.floor(py - 1e-9 * Math.sign(y1 - y0));
      if (nx === cx && ny === cy) continue;
      const last = nx === tx && ny === ty;
      if (nx !== cx && ny !== cy) {           // diagonal step through a corner: either way round is enough
        const viaX = passable(st, cx, cy, nx, cy) && passable(st, nx, cy, nx, ny, last);
        const viaY = passable(st, cx, cy, cx, ny) && passable(st, cx, ny, nx, ny, last);
        if (!viaX && !viaY) return false;
      } else if (!passable(st, cx, cy, nx, ny, last)) return false;
      cx = nx; cy = ny;
    }
    return true;
  }

  function initState() {
    return {
      turn: 1, rooms: new Set(), seen: new Set(), open: new Set(), doorsSeen: new Set(),
      blocksSeen: new Set(), looked: new Set(), monsters: [], counters: {}, traps: {}, searched: {}, journal: [],
      mode: 'priority', reach: {}, done: {}, grudge: {}, seed: 'q1-demo'
    };
  }
  function addMonster(st, m, extra) {
    if (st.monsters.some(x => x.id === m.id)) return;
    const t = M[m.type];
    st.counters[t.code] = (st.counters[t.code] || 0) + 1;
    st.monsters.push(Object.assign({ id: m.id, type: m.type, x: m.x, y: m.y, code: t.code + st.counters[t.code], body: t.body, dead: false, fresh: true }, extra || {}));
  }
  function contentsAt(st, x, y) {
    for (const m of Q.monsters) if (m.x === x && m.y === y) addMonster(st, m);
    for (const t of Q.traps) if (t.x === x && t.y === y && !st.traps[t.id]) st.traps[t.id] = 'hidden';
  }
  function revealRoom(st, r, added) {
    if (st.rooms.has(r)) return;
    st.rooms.add(r);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (area(x, y) === r) { added.push(k(x, y)); contentsAt(st, x, y); }
    for (const d of Q.doors) if (area(...d.a) === r || area(...d.b) === r) st.doorsSeen.add(d.id);
  }
  function lookFrom(st, fx, fy, added) {
    if (st.looked) st.looked.add(k(fx, fy));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (area(x, y) !== 'C') continue;
      const blk = isBlock(x, y);
      if (!blk && !isFloor(x, y)) continue;
      if (!los(st, fx, fy, x, y)) continue;
      if (blk) { st.blocksSeen.add(k(x, y)); continue; }
      if (!st.seen.has(k(x, y))) { st.seen.add(k(x, y)); added.push(k(x, y)); }
      contentsAt(st, x, y);
      for (const d of Q.doors) if ((d.a[0] === x && d.a[1] === y) || (d.b[0] === x && d.b[1] === y)) st.doorsSeen.add(d.id);
    }
  }
  const known = (st, x, y) => area(x, y) === 'C' ? st.seen.has(k(x, y)) : st.rooms.has(area(x, y));
  function openDoor(st, id) {
    const d = Q.doors.find(x => x.id === id);
    st.open.add(id);
    const [near, far] = known(st, ...d.a) ? [d.a, d.b] : [d.b, d.a];
    const added = [];
    if (area(...far) === 'C') lookFrom(st, far[0], far[1], added);
    else revealRoom(st, area(...far), added);
    return { added, origin: [(d.a[0] + d.b[0] + 1) / 2, (d.a[1] + d.b[1] + 1) / 2] };
  }
  // "Look from here" hint: squares from which the board itself (ignoring rock, which players cannot know)
  // would show corridor squares not seen yet. Uses only what players can see on the physical board.
  function geoPass(st, x1, y1, x2, y2) {
    const a = area(x1, y1), b = area(x2, y2);
    if (!b || st.blocksSeen.has(k(x2, y2))) return false;
    if (a === b) return true;
    if (a === 'C' && b === 'C') return true;
    const d = doorBetween(x1, y1, x2, y2); return !!(d && st.open.has(d.id));
  }
  function geoLos(st, fx, fy, tx, ty) {
    let cx = fx, cy = fy; const x0 = fx + .5, y0 = fy + .5, x1 = tx + .5, y1 = ty + .5;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 20);
    for (let i = 1; i <= n; i++) {
      const nx = Math.floor(x0 + (x1 - x0) * i / n - 1e-9 * Math.sign(x1 - x0)), ny = Math.floor(y0 + (y1 - y0) * i / n - 1e-9 * Math.sign(y1 - y0));
      if (nx === cx && ny === cy) continue;
      if (nx !== cx && ny !== cy) { if (!(geoPass(st, cx, cy, nx, cy) && geoPass(st, nx, cy, nx, ny)) && !(geoPass(st, cx, cy, cx, ny) && geoPass(st, cx, ny, nx, ny))) return false; }
      else if (!geoPass(st, cx, cy, nx, ny)) return false;
      cx = nx; cy = ny;
    }
    return true;
  }
  function lookSpots(st) {
    const out = [];
    const unseen = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (area(x, y) === 'C' && !st.seen.has(k(x, y)) && !st.blocksSeen.has(k(x, y)) && !st.looked.has(k(x, y))) unseen.push([x, y]);
    for (const key of st.seen) {
      if (st.looked.has(key)) continue;
      const [x, y] = key.split(',').map(Number);
      if (unseen.some(([ux, uy]) => geoLos(st, x, y, ux, uy))) out.push([x, y]);
    }
    return out;
  }
  const roomMonstersAlive = (st, r) => st.monsters.filter(m => !m.dead && area(m.x, m.y) === r);

  /* Zargon's orders. Positions and hero Body Points are not tracked, so each order is a rule the players apply
     on the board with their character sheets, plus a tie list that is always shown.
     The rule is drawn each Zargon turn from weights that depend on the monster type (seeded: same turn, same result). */
  const RULES = {
    closest: () => 'The closest hero it can reach',
    lastAttacker: () => 'The hero who attacked it last',
    lowestBody: () => 'The hero with the fewest Body Points left',
    highestBody: () => 'The hero with the most Body Points left',
    lowestDef: () => 'The hero with the fewest defend dice',
    highestAtt: () => 'The hero with the most attack dice',
    caster: () => 'A spellcaster (Wizard or Elf)',
    grudge: h => `The <b>${h}</b>, whatever it costs`
  };
  const WEIGHTS = {
    goblin: { lowestBody: 3, lowestDef: 3, caster: 2, closest: 2, lastAttacker: 1 },
    orc: { closest: 3, lastAttacker: 3, lowestBody: 2, highestAtt: 1, grudge: 1 },
    abomination: { highestAtt: 2, closest: 2, lastAttacker: 2, highestBody: 1, grudge: 1 },
    dread: { highestAtt: 3, highestBody: 2, grudge: 2, lastAttacker: 1 }
  };
  const PLANS = {
    skirmisher: 'Next to a hero: attack, then run back out of reach. Otherwise: move in and attack.',
    soldier: 'Move in and attack. Already next to a hero: attack and stay.',
    brute: 'Move in and attack. Never falls back.',
    duelist: 'Move in and attack. No hero in reach: block the nearest doorway.'
  };
  function rng(seedStr) {               // mulberry32 on a string hash
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function orderFor(st, m) {
    const r = rng(`${st.seed}|${st.turn}|${m.id}`);
    const w = WEIGHTS[m.type]; let roll = r() * Object.values(w).reduce((a, b) => a + b, 0), rule;
    for (const [key, val] of Object.entries(w)) { roll -= val; if (roll <= 0) { rule = key; break; } }
    if (rule === 'grudge' && !st.grudge[m.id]) st.grudge[m.id] = HEROES[Math.floor(r() * HEROES.length)];
    const tie = HEROES.slice(); for (let i = tie.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [tie[i], tie[j]] = [tie[j], tie[i]]; }
    return { rule, text: RULES[rule](st.grudge[m.id]), tie, plan: PLANS[M[m.type].profile] };
  }
  function verdict(st, m, reach, adjacent) {
    const o = orderFor(st, m), go = adjacent ? 'Attack' : 'Move in and attack';
    const tail = adjacent && M[m.type].profile === 'skirmisher' ? ', then run back out of reach' : '';
    const inReach = o.tie.filter(h => reach.includes(h));
    if (!inReach.length) return 'No hero in reach: move toward the heroes, or hold the nearest doorway.';
    if (inReach.length === 1) return `${go} the <b>${inReach[0]}</b>${tail}.`;
    if (o.rule === 'grudge' && inReach.includes(st.grudge[m.id])) return `${go} the <b>${st.grudge[m.id]}</b>${tail}.`;
    if (o.rule === 'caster' && inReach.some(h => h === 'Wizard' || h === 'Elf')) return `${go} the <b>${inReach.find(h => h === 'Wizard' || h === 'Elf')}</b>${tail}.`;
    if (o.rule === 'closest' || o.rule === 'grudge' || o.rule === 'caster') return `${go} the <b>${inReach[0]}</b>${tail}.`;
    return `Among ${inReach.join(' and ')}: ${o.text.charAt(0).toLowerCase() + o.text.slice(1)}. Tie: <span class="tgt">${inReach.join(' › ')}</span>.`;
  }

  /* ======================= UI state ======================= */
  let st = initState();
  let sel = null;            // { kind:'door'|'cell'|'room'|'trap'|'monster', ... , step }
  let anim = null;           // { added:Set, origin:[x,y], t0 }
  let zOpen = false, note = null, toast = null;
  const history = [];
  const snap = () => JSON.stringify(st, (key, v) => v instanceof Set ? { __set: [...v] } : v);
  const unsnap = s => JSON.parse(s, (key, v) => v && v.__set ? new Set(v.__set) : v);
  function commit(fn) { history.push(snap()); fn(); render(); }
  function undo() { if (!history.length) return; st = unsnap(history.pop()); st.monsters.forEach(m => m.fresh = false); sel = null; anim = null; note = null; render(); }

  /* ======================= rendering ======================= */
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('board');
  const el = (t, a, p) => { const e = document.createElementNS(ns, t); for (const n in a) e.setAttribute(n, a[n]); (p || svg).appendChild(e); return e; };
  const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
  svg.setAttribute('width', W * S + 4); svg.setAttribute('height', H * S + 4); svg.setAttribute('viewBox', `-2 -2 ${W * S + 4} ${H * S + 4}`);

  function cellFill(x, y) {
    if (!known(st, x, y)) return null;
    return area(x, y) === 'C' ? v('--corridor') : v('--floor');
  }
  function drawBoard() {
    svg.innerHTML = '';
    const defs = el('defs', {});
    const pat = el('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 6, height: 6, fill: v('--rock') }, pat);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: v('--rock-line'), 'stroke-width': 2 }, pat);
    // reveal mask: new cells appear like ink spreading from the door
    const mask = el('mask', { id: 'inkmask', maskUnits: 'userSpaceOnUse', x: -2, y: -2, width: W * S + 4, height: H * S + 4 }, defs);
    el('rect', { x: -2, y: -2, width: W * S + 4, height: H * S + 4, fill: 'black' }, mask);
    const inkCircle = el('circle', { cx: 0, cy: 0, r: 0, fill: 'white', filter: '' }, mask);

    el('rect', { x: 0, y: 0, width: W * S, height: H * S, fill: 'url(#hatch)' });
    const gOld = el('g', {}), gNew = el('g', { mask: anim ? 'url(#inkmask)' : '' });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      el('rect', { x: x * S, y: y * S, width: S, height: S, fill: 'none', stroke: v('--rock-line'), 'stroke-width': .6 });
      const f = cellFill(x, y); if (!f) continue;
      const g = anim && anim.added.has(k(x, y)) ? gNew : gOld;
      el('rect', { x: x * S, y: y * S, width: S, height: S, fill: f, stroke: '#CDBBA6', 'stroke-width': .8 }, g);
    }
    // walls of known cells
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!known(st, x, y)) continue;
      const g = anim && anim.added.has(k(x, y)) ? gNew : gOld;
      const a = area(x, y);
      for (const [dx, dy, x1, y1, x2, y2] of [[0, -1, x, y, x + 1, y], [1, 0, x + 1, y, x + 1, y + 1], [0, 1, x, y + 1, x + 1, y + 1], [-1, 0, x, y, x, y + 1]]) {
        const b = area(x + dx, y + dy);
        const wall = b !== a && !(a === 'C' && b === 'C' && isFloor(x + dx, y + dy)) || (a === 'C' && b === 'C' && !isFloor(x + dx, y + dy) && !isBlock(x + dx, y + dy));
        if (!wall) continue;
        el('line', { x1: x1 * S, y1: y1 * S, x2: x2 * S, y2: y2 * S, stroke: v('--ink'), 'stroke-width': 3.2, 'stroke-linecap': 'square' }, g);
      }
    }
    el('rect', { x: 0, y: 0, width: W * S, height: H * S, fill: 'none', stroke: v('--ink'), 'stroke-width': 3 });

    // blocked squares
    for (const key of st.blocksSeen) {
      const [x, y] = key.split(',').map(Number);
      el('rect', { x: x * S + 2, y: y * S + 2, width: S - 4, height: S - 4, fill: '#fff', stroke: v('--ink'), 'stroke-width': 1.5 });
      for (let i = 0; i < 3; i++) el('line', { x1: x * S + 2, y1: y * S + 2 + (i + 1) * (S - 4) / 4 + 0, x2: x * S + S - 2, y2: y * S + 2 + (i + 1) * (S - 4) / 4, stroke: v('--ink'), 'stroke-width': 1 });
      el('line', { x1: x * S + S / 2, y1: y * S + 2, x2: x * S + S / 2, y2: y * S + 2 + (S - 4) / 4, stroke: v('--ink'), 'stroke-width': 1 });
      el('line', { x1: x * S + S / 3, y1: y * S + 2 + (S - 4) / 4, x2: x * S + S / 3, y2: y * S + 2 + (S - 4) / 2, stroke: v('--ink'), 'stroke-width': 1 });
    }
    // furniture
    for (const f of Q.furniture) {
      if (!st.rooms.has(area(f.x, f.y))) continue;
      const g = anim && anim.added.has(k(f.x, f.y)) ? gNew : gOld;
      drawFurniture(f, g === gNew ? el('g', {}, gNew) : el('g', {}));
    }
    // doors (their tap areas go on top of everything, see below)
    const doorHits = [];
    for (const d of Q.doors) {
      if (!st.doorsSeen.has(d.id)) continue;
      const isV = d.a[1] === d.b[1];
      const ex = isV ? Math.max(d.a[0], d.b[0]) : d.a[0], ey = isV ? d.a[1] : Math.max(d.a[1], d.b[1]);
      const cx = (isV ? ex : ex + .5) * S, cy = (isV ? ey + .5 : ey) * S;
      const w = isV ? 10 : 24, h = isV ? 24 : 10, open = st.open.has(d.id);
      if (sel && sel.kind === 'door' && sel.id === d.id) el('circle', { cx, cy, r: 20, fill: v('--sel'), class: 'selring' });
      el('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, fill: open ? v('--floor') : '#fff', stroke: v('--ink'), 'stroke-width': 1.6 });
      if (open) el('line', { x1: cx - (isV ? 0 : 7), y1: cy - (isV ? 7 : 0), x2: cx + (isV ? 0 : 7), y2: cy + (isV ? 7 : 0), stroke: v('--ink'), 'stroke-width': 1, 'stroke-dasharray': '2 2' });
      else el('line', { x1: cx - (isV ? 0 : 6), y1: cy - (isV ? 6 : 0), x2: cx + (isV ? 0 : 6), y2: cy + (isV ? 6 : 0), stroke: v('--ink'), 'stroke-width': 2.2 });
      if (!open) doorHits.push({ x: cx - 22, y: cy - 22, width: 44, height: 44, class: 'hit', 'data-door': d.id });
    }
    // traps: visible as "?" until sprung or disarmed
    for (const t of Q.traps) {
      const s = st.traps[t.id]; if (!s || s === 'disarmed') continue;
      const cx = (t.x + .5) * S, cy = (t.y + .5) * S;
      if (sel && sel.kind === 'trap' && sel.id === t.id) el('circle', { cx, cy, r: 19, fill: v('--sel'), class: 'selring' });
      if (s === 'sprung') {
        el('rect', { x: t.x * S + 3, y: t.y * S + 3, width: S - 6, height: S - 6, fill: '#3B2A25', stroke: v('--ink'), 'stroke-width': 1.5 });
        el('rect', { x: t.x * S + 8, y: t.y * S + 8, width: S - 16, height: S - 16, fill: '#1E1411' });
      } else {
        el('polygon', { points: `${cx},${cy - 13} ${cx + 13},${cy + 10} ${cx - 13},${cy + 10}`, fill: '#fff', stroke: v('--ink'), 'stroke-width': 1.8, 'stroke-linejoin': 'round' });
        const q = el('text', { x: cx, y: cy + 7, 'text-anchor': 'middle', fill: v('--ink'), 'font-family': 'Bonum', 'font-weight': 700, 'font-size': 14 }); q.textContent = '?';
      }
      el('rect', { x: t.x * S - 4, y: t.y * S - 4, width: S + 8, height: S + 8, class: 'hit', 'data-trap': t.id });
    }
    // monsters
    for (const m of st.monsters) {
      if (m.dead || m.x < 0) continue;
      const cx = (m.x + .5) * S, cy = (m.y + .5) * S;
      if (sel && sel.kind === 'monster' && sel.id === m.id) el('circle', { cx, cy, r: 19, fill: v('--sel'), class: 'selring' });
      const g = el('g', { class: 'tok' + (m.fresh && anim ? ' stamp' : '') });
      if (m.fresh && anim) g.style.animationDelay = (380 + 70 * st.monsters.filter(x => x.fresh).indexOf(m)) + 'ms';
      el('circle', { cx, cy, r: 13.5, fill: v('--green'), stroke: '#F2EBDD', 'stroke-width': 2 }, g);
      const t = el('text', { x: cx, y: cy + 4.2, 'text-anchor': 'middle', fill: '#F2EBDD', 'font-family': 'Bonum', 'font-weight': 700, 'font-size': 11.5 }, g); t.textContent = m.code;
      if (M[m.type].body > 1 && m.body < M[m.type].body) el('circle', { cx: cx + 11, cy: cy - 11, r: 5, fill: v('--ink'), stroke: '#fff', 'stroke-width': 1.2 }, g);
      el('rect', { x: m.x * S - 3, y: m.y * S - 3, width: S + 6, height: S + 6, class: 'hit', 'data-monster': m.id });
    }
    // eye glyph on squares where "Look from here" can show more
    for (const [x, y] of lookSpots(st)) {
      if (st.monsters.some(m => !m.dead && m.x === x && m.y === y)) continue;
      if (Q.traps.some(t => t.x === x && t.y === y && st.traps[t.id] && st.traps[t.id] !== 'disarmed')) continue;
      const cx = (x + .5) * S, cy = (y + .5) * S;
      const g = el('g', { opacity: .7, 'pointer-events': 'none' });
      el('path', { d: `M ${cx - 9} ${cy} Q ${cx} ${cy - 8} ${cx + 9} ${cy} Q ${cx} ${cy + 8} ${cx - 9} ${cy} Z`, fill: 'none', stroke: v('--ink'), 'stroke-width': 1.4 }, g);
      el('circle', { cx, cy, r: 2.6, fill: v('--ink') }, g);
    }
    // hit areas for known floor cells (look from corridor / room actions)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!known(st, x, y)) continue;
      if (st.monsters.some(m => !m.dead && m.x === x && m.y === y)) continue;
      if (Q.traps.some(t => t.x === x && t.y === y && st.traps[t.id] && st.traps[t.id] !== 'disarmed')) continue;
      svg.insertBefore(Object.assign(document.createElementNS(ns, 'rect'), {}), null);
      const r = svg.lastChild;
      for (const [n, val] of Object.entries({ x: x * S, y: y * S, width: S, height: S, class: 'hit', 'data-cell': k(x, y) })) r.setAttribute(n, val);
      // keep door / token hit areas on top
      svg.insertBefore(r, svg.querySelector('.hit'));
    }
    for (const h of doorHits) el('rect', h);
    // letters of quest notes already read, where they happened (tap to read again)
    for (const j of st.journal) {
      const n = Q.notes[j.room]; if (!n || !n.at) continue;
      const [x, y] = n.at, cx = (x + .5) * S, cy = (y + .5) * S;
      el('rect', { x: cx - 11, y: cy - 11, width: 22, height: 22, fill: v('--ink'), stroke: v('--floor'), 'stroke-width': 1.5 });
      const t = el('text', { x: cx, y: cy + 5.5, 'text-anchor': 'middle', fill: '#F4ECDD', 'font-family': 'Bonum', 'font-weight': 700, 'font-size': 15 }); t.textContent = n.letter;
      el('rect', { x: cx - 16, y: cy - 16, width: 32, height: 32, class: 'hit', 'data-note': j.room });
    }
    if (sel && sel.kind === 'cell') {
      const [x, y] = sel.at; el('rect', { x: x * S + 3, y: y * S + 3, width: S - 6, height: S - 6, fill: 'none', stroke: v('--ink'), 'stroke-width': 2, 'stroke-dasharray': '4 3', class: 'selring' });
    }
    if (sel && sel.kind === 'room') {
      const r = sel.room;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (area(x, y) === r) el('rect', { x: x * S, y: y * S, width: S, height: S, fill: v('--sel'), opacity: .35, 'pointer-events': 'none' });
    }
    if (anim) runInk(inkCircle);
  }
  function drawFurniture(f, g) {
    const x = f.x * S, y = f.y * S, w = f.w * S, h = f.h * S;
    if (f.type === 'stairs') {
      el('rect', { x: x + 2, y: y + 2, width: w - 4, height: h - 4, fill: '#fff', stroke: v('--ink'), 'stroke-width': 1.5 }, g);
      for (let i = 1; i < 6; i++) el('path', { d: `M ${x + 2} ${y + 2 + i * 10.5} A ${i * 10.5} ${i * 10.5} 0 0 0 ${x + 2 + i * 10.5} ${y + 2}`, fill: 'none', stroke: v('--ink'), 'stroke-width': 1.2 }, g);
      return;
    }
    if (f.type === 'chest') {
      el('rect', { x: x + 6, y: y + 8, width: w - 12, height: h - 16, fill: '#fff', stroke: v('--ink'), 'stroke-width': 1.5 }, g);
      el('line', { x1: x + 6, y1: y + 14, x2: x + w - 6, y2: y + 14, stroke: v('--ink'), 'stroke-width': 1 }, g);
      return;
    }
    el('rect', { x: x + 4, y: y + 4, width: w - 8, height: h - 8, fill: '#fff', stroke: v('--ink'), 'stroke-width': 1.5 }, g);
    if (f.type === 'rack') {
      const n = Math.max(f.w, f.h) * 2;
      for (let i = 1; i < n; i++) f.h > f.w
        ? el('line', { x1: x + 8, y1: y + 4 + i * (h - 8) / n, x2: x + w - 8, y2: y + 4 + i * (h - 8) / n, stroke: v('--ink'), 'stroke-width': .9 }, g)
        : el('line', { x1: x + 4 + i * (w - 8) / n, y1: y + 8, x2: x + 4 + i * (w - 8) / n, y2: y + h - 8, stroke: v('--ink'), 'stroke-width': .9 }, g);
    } else if (f.type === 'bookcase') {
      for (let i = 1; i < 9; i++) el('line', { x1: x + 4 + i * (w - 8) / 9, y1: y + 8, x2: x + 4 + i * (w - 8) / 9, y2: y + h - 8, stroke: v('--ink'), 'stroke-width': .9 }, g);
    } else {
      el('rect', { x: x + 8, y: y + 8, width: w - 16, height: h - 16, fill: 'none', stroke: v('--ink'), 'stroke-width': .8 }, g);
    }
  }
  function runInk(circle) {
    const [ox, oy] = anim.origin; circle.setAttribute('cx', ox * S); circle.setAttribute('cy', oy * S);
    const maxR = 14 * S, dur = 650, t0 = anim.t0 || (anim.t0 = performance.now());
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = now => {
      const p = reduce ? 1 : Math.max(0, Math.min(1, (now - t0) / dur));
      const e = 1 - Math.pow(1 - p, 3);
      circle.setAttribute('r', e * maxR);
      if (p < 1) requestAnimationFrame(step); else { anim = null; st.monsters.forEach(m => m.fresh = false); }
    };
    requestAnimationFrame(step);
  }

  /* ---------- callout ---------- */
  const callout = document.getElementById('callout');
  function place(px, py) {
    // px,py: anchor in map coords. Upper half: note sits beside the anchor. Lower half: note sits above it,
    // so the explored area next to the heroes stays visible.
    const cw = 252, mapW = 920, mapH = 770, minLeft = MAPX;
    callout.style.visibility = 'hidden'; callout.hidden = false;
    const ch = callout.offsetHeight;
    let left, top, ox, oy;
    if (py > mapH * 0.5) {
      left = Math.max(minLeft, Math.min(px - 60, mapW - cw - 4)); top = Math.max(8, py - ch - 24);
      ox = (px - left) + 'px'; oy = '100%';
    } else {
      left = px + 26; ox = '0';
      if (left + cw > mapW - 4) { left = px - 26 - cw; ox = '100%'; }
      top = Math.max(8, Math.min(py - ch / 2, mapH - ch - 8)); oy = (py - top) + 'px';
    }
    callout.style.left = left + 'px'; callout.style.top = top + 'px';
    callout.style.setProperty('--ox', ox); callout.style.setProperty('--oy', oy);
    callout.style.visibility = '';
  }
  function roomAnchor(r) {
    let x0 = 99, x1 = -1, y0 = 99;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (area(x, y) === r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
    return [MAPX + (x0 + x1 + 1) / 2 * S, MAPY + y0 * S];
  }
  const px = (x, y) => [MAPX + x * S, MAPY + y * S];

  function renderCallout() {
    if (!sel) { callout.hidden = true; return; }
    let html = '', at;
    const close = '<button class="close" data-act="close" aria-label="Close">×</button>';
    if (sel.kind === 'door') {
      const d = Q.doors.find(x => x.id === sel.id);
      const isV = d.a[1] === d.b[1];
      at = px(isV ? Math.max(d.a[0], d.b[0]) : d.a[0] + .5, isV ? d.a[1] + .5 : Math.max(d.a[1], d.b[1]));
      const behind = known(st, ...d.a) && known(st, ...d.b) ? 'Both sides are explored.' : 'Opening is free. You see what is behind it.';
      html = `<div class="kind">Closed door</div><h3>Open this door?</h3><p>${behind}</p><button class="btn" data-act="open">Open the door</button>`;
    }
    if (sel.kind === 'cell') {
      at = px(sel.at[0] + .5, sel.at[1] + .5);
      html = `<div class="kind">Corridor</div><h3>A hero stands here</h3><p>Show everything this hero can see along the corridors.</p><button class="btn" data-act="look">Look from here</button>`;
    }
    if (sel.kind === 'room') {
      at = sel.anchor;
      const s = st.searched[sel.room] || { treasure: [], secret: [] };
      const alive = roomMonstersAlive(st, sel.room);
      if (!sel.step) {
        html = `<div class="kind">Room</div><h3>Search this room</h3><p>One hero, one search, on their own turn.</p>
          <button class="btn" data-act="pick" data-what="treasure">Search for treasure</button>
          <button class="btn alt" data-act="pick" data-what="secret">Search for secret doors</button>`;
      } else if (sel.step === 'pick') {
        const what = sel.what === 'treasure' ? 'treasure' : 'secret doors';
        const used = sel.what === 'treasure' ? s.treasure : [];
        const warn = alive.length ? `<p class="warn">${alive.map(m => m.code).join(', ')} still in this room. A room with monsters cannot be searched.</p>` : '';
        html = `<div class="kind">Search for ${what}</div><h3>Who searches?</h3>${warn}<div class="chips">${HEROES.map(h => `<button class="chip" data-act="search" data-hero="${h}" ${used.includes(h) || alive.length ? 'disabled' : ''}>${h}</button>`).join('')}</div>
          ${alive.length ? '<button class="btn alt" data-act="override">They have left the room</button>' : ''}`;
      } else if (sel.step === 'card') {
        html = `<div class="kind">Treasure · ${sel.hero}</div><h3>Draw a treasure card</h3><p>No quest treasure in this room. Read the card aloud.</p>
          <button class="btn" data-act="close">Done</button><button class="btn alt" data-act="wander">It was a wandering monster</button>`;
      } else if (sel.step === 'nosecret') {
        html = `<div class="kind">Secret doors · ${sel.hero}</div><h3>Nothing found</h3><p>The walls of this room hide no secret door.</p><button class="btn" data-act="close">Done</button>`;
      }
    }
    if (sel.kind === 'trap') {
      const t = Q.traps.find(x => x.id === sel.id); at = px(t.x + .5, t.y + .5);
      const step = sel.step || 'menu';
      if (step === 'menu') html = `<div class="kind">Trap</div><h3>Something is wrong here</h3><p>The kind of trap stays hidden until it springs or is disarmed.</p>
        <button class="btn" data-act="trap" data-to="jump">Jump over it</button><button class="btn alt" data-act="trap" data-to="who">Try to disarm it</button><button class="btn alt" data-act="trap" data-to="spring">Step onto it</button>`;
      if (step === 'jump') html = `<div class="kind">Jump · needs 2 moves left</div><h3>Roll 1 combat die</h3><p>Anything but a skull: you jump over.</p><div class="row"><button class="btn" data-act="trap" data-to="spring">Skull</button><button class="btn alt" data-act="trap" data-to="jumped">No skull</button></div>`;
      if (step === 'jumped') html = `<div class="kind">Jump</div><h3>You land safely</h3><p>The trap is still there for the next hero.</p><button class="btn" data-act="close">Done</button>`;
      if (step === 'who') html = `<div class="kind">Disarm</div><h3>Who tries?</h3><p>Move onto the square first.</p><button class="btn" data-act="trap" data-to="dwarf">The Dwarf</button><button class="btn alt" data-act="trap" data-to="kit">A hero with a tool kit</button>`;
      if (step === 'dwarf') html = `<div class="kind">Disarm · Dwarf</div><h3>Roll 1 combat die</h3><p>Only a <b>black shield</b> springs the trap.</p><div class="row"><button class="btn" data-act="trap" data-to="spring">Black shield</button><button class="btn alt" data-act="trap" data-to="disarm">Other</button></div>`;
      if (step === 'kit') html = `<div class="kind">Disarm · tool kit</div><h3>Roll 1 combat die</h3><p>A <b>skull</b> springs the trap.</p><div class="row"><button class="btn" data-act="trap" data-to="spring">Skull</button><button class="btn alt" data-act="trap" data-to="disarm">Shield</button></div>`;
      if (step === 'sprung') html = `<div class="kind">Trap sprung</div><h3>Pit trap!</h3><p>The hero falls in: <b>lose 1 Body Point</b>, the turn ends. Put a pit tile here. In the pit, roll 1 fewer combat die; climb out next turn.</p><button class="btn" data-act="close">Done</button>`;
      if (step === 'disarmed') html = `<div class="kind">Trap disarmed</div><h3>It was a pit trap</h3><p>The square is safe now.</p><button class="btn" data-act="close">Done</button>`;
    }
    if (sel.kind === 'monster') {
      const m = st.monsters.find(x => x.id === sel.id), t = M[m.type]; at = m.x < 0 ? [880, 120] : px(m.x + .5, m.y + .5);
      const dmg = t.body > 1 ? `<div class="row"><button class="btn alt" data-act="hurt" data-d="-1" ${m.body <= 1 ? 'disabled' : ''}>Wound −1</button><button class="btn alt" data-act="hurt" data-d="1" ${m.body >= t.body ? 'disabled' : ''}>Heal +1</button></div>` : '';
      html = `<div class="kind">${m.code} · ${t.name}</div><h3>Move ${t.move} · Att ${t.att} · Def ${t.def}</h3><p>Body ${m.body} of ${t.body}.</p>${dmg}<button class="btn" data-act="slay">Slain</button>`;
    }
    callout.innerHTML = close + html;
    place(at[0], at[1]);
  }

  /* ---------- right column ---------- */
  function renderAside() {
    document.getElementById('turn').textContent = st.turn;
    document.getElementById('undo').disabled = !history.length;
    const alive = st.monsters.filter(m => !m.dead);
    const r = document.getElementById('roster');
    r.innerHTML = alive.length ? '' : '<li class="empty">No monster in sight.</li>';
    for (const m of alive) {
      const t = M[m.type], li = document.createElement('li');
      if (m.fresh && anim) li.className = 'new';
      if (sel && sel.kind === 'monster' && sel.id === m.id) li.classList.add('sel');
      li.innerHTML = `<button data-act="selmon" data-id="${m.id}"><span class="coin">${m.code}</span><span><span class="nm">${t.name}</span><br><span class="st">${m.wandering ? `Wandering · next to the ${m.wanderAt}` : `Move ${t.move} · Att ${t.att} · Def ${t.def}`}</span></span><span class="bp">${m.body}/${t.body}</span></button>`;
      r.appendChild(li);
    }
    const hc = document.getElementById('herochips');
    if (hc) hc.innerHTML = HEROES.map(h => `<button class="chip" data-hit>${h}</button>`).join('');
    const zb = document.getElementById('zbtn');
    zb.querySelector('small').textContent = alive.length ? `${alive.length} monster${alive.length > 1 ? 's' : ''} to act` : 'no monster in sight';
  }

  /* ---------- Zargon page ---------- */
  function renderZargon() {
    const page = document.getElementById('zpage');
    page.classList.toggle('open', zOpen);
    if (!zOpen) return;
    document.getElementById('zturn').textContent = 'Turn ' + st.turn;
    const seg = document.getElementById('seg'); seg.dataset.mode = st.mode;
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === st.mode));
    document.getElementById('seghelp').textContent = st.mode === 'priority'
      ? 'Each monster goes for the first hero that fits its rule and that it can reach. Use your character sheets. If the rule does not decide, use the tie list.'
      : 'Tap the heroes each monster can reach. The app chooses the target when it can.';
    const list = document.getElementById('orders'); list.innerHTML = '';
    const alive = st.monsters.filter(m => !m.dead);
    // monsters of the same kind with the same order this turn share one entry
    const groups = [];
    for (const m of alive) {
      const o = orderFor(st, m), sig = m.type + '|' + o.text + '|' + o.tie.join();
      const g = st.mode === 'priority' && groups.find(x => x.sig === sig);
      g ? g.ms.push(m) : groups.push({ type: m.type, ms: [m], o, sig });
    }
    groups.forEach((g, i) => {
      const t = M[g.type], o = g.o;
      const gid = g.ms.map(m => m.id).join('+');
      const done = !!st.done[gid];
      const li = document.createElement('li'); li.className = 'order' + (done ? ' done' : '');
      const coins = g.ms.map(m => `<span class="coin">${m.code}</span>`).join('');
      const name = t.name + (g.ms.length > 1 ? ` <span class="x">× ${g.ms.length}</span>` : '');
      let body = '';
      if (done) body = '';
      else if (st.mode === 'priority') {
        body = `<dl><dt>Target</dt><dd>${o.text}.</dd><dt>Tie</dt><dd><span class="tgt">${o.tie.join(' › ')}</span></dd><dt>Plan</dt><dd>${o.plan}</dd></dl>`;
      } else {
        const m = g.ms[0], reach = st.reach[m.id] || [], adj = !!(st.reach[m.id + ':adj']);
        body = `<div class="rulehint">${o.text}.</div><div class="chips">${HEROES.map(h => `<button class="chip" data-act="reach" data-id="${m.id}" data-hero="${h}" aria-pressed="${reach.includes(h)}">${h}</button>`).join('')}</div>
          <button class="link" data-act="adj" data-id="${m.id}">${adj ? '✓ Already next to that hero' : 'Already next to that hero?'}</button>
          <div class="verdict">${verdict(st, m, reach, adj)}</div>`;
      }
      const wand = g.ms.some(m => m.wandering) && !done ? `<div class="rule">Wandering monster: already attacked the ${g.ms.find(m => m.wandering).wanderAt} when it appeared.</div>` : '';
      li.innerHTML = `<div class="num">${done ? '✓' : i + 1}</div><div><h4>${coins}<span>${name}</span><button class="link" data-act="zdone" data-id="${gid}">${done ? 'Reopen' : 'Done'}</button></h4>${body}${wand}</div>`;
      list.appendChild(li);
    });
    if (!list.children.length) list.innerHTML = '<li class="order"><div></div><div><i>No monster in sight. Zargon waits.</i></div></li>';
  }

  /* ---------- note card + toast ---------- */
  function renderNote() {
    const host = document.getElementById('notehost');
    if (!note) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="veil"><div class="note" role="dialog" aria-label="${note.kind || 'Quest note'} ${note.letter}"><div class="hd"><span class="letter">${note.letter}</span><div>${note.kind || 'Quest note'}<h3>${note.title}</h3></div></div><p>${note.text}</p>${note.extra ? `<p class="extra">${note.extra}</p>` : ''}<button class="btn" data-act="noteok">${note.kind ? 'It is on the board' : 'Continue'}</button></div></div>`;
  }
  function renderToast() {
    const host = document.getElementById('toasthost');
    host.innerHTML = toast ? `<div class="toast">${toast}<button data-act="undo">Undo</button></div>` : '';
  }
  function render() { drawBoard(); renderCallout(); renderAside(); renderZargon(); renderNote(); renderToast(); document.dispatchEvent(new CustomEvent('play-render', { detail: { st, sel, zOpen } })); }

  /* ======================= events ======================= */
  let toastTimer;
  function say(msg) { toast = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast = null; renderToast(); }, 3200); }

  svg.addEventListener('click', e => {
    const t = e.target;
    if (t.dataset.note) { const n = Q.notes[t.dataset.note]; note = { letter: n.letter, title: 'Read again', text: n.text }; sel = null; render(); return; }
    if (t.dataset.door) sel = { kind: 'door', id: t.dataset.door };
    else if (t.dataset.trap) sel = { kind: 'trap', id: t.dataset.trap };
    else if (t.dataset.monster) sel = { kind: 'monster', id: t.dataset.monster };
    else if (t.dataset.cell) {
      const [x, y] = t.dataset.cell.split(',').map(Number);
      sel = area(x, y) === 'C' ? { kind: 'cell', at: [x, y] } : { kind: 'room', room: area(x, y), anchor: roomAnchor(area(x, y)), tap: [x, y] };
    } else sel = null;
    render();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') { sel = null; render(); }
    if (a === 'open') {
      const id = sel.id;
      commit(() => { const r = openDoor(st, id); anim = { added: new Set(r.added), origin: r.origin }; sel = null; });
    }
    if (a === 'look') {
      const [x, y] = sel.at;
      commit(() => { const added = []; lookFrom(st, x, y, added); anim = added.length ? { added: new Set(added), origin: [x + .5, y + .5] } : null; sel = null; if (!added.length) say('Nothing new in sight from here.'); });
    }
    if (a === 'pick') { sel.step = 'pick'; sel.what = b.dataset.what; sel.override = false; renderCallout(); }
    if (a === 'override') { commit(() => { roomMonstersAlive(st, sel.room).forEach(m => { m.x = -1; m.y = -1; }); }); }
    if (a === 'search') {
      const hero = b.dataset.hero, room = sel.room, what = sel.what;
      commit(() => {
        const s = st.searched[room] || (st.searched[room] = { treasure: [], secret: [] });
        if (what === 'secret') { s.secret.push(hero); sel.step = 'nosecret'; sel.hero = hero; return; }
        s.treasure.push(hero);
        const n = Q.notes[room];
        if (n && !st.journal.some(j => j.letter === n.letter)) {
          st.journal.push({ letter: n.letter, short: n.text.split('.')[0] + '.', room });
          note = { letter: n.letter, title: 'Treasure search · ' + hero, text: n.text }; sel = null;
        } else { sel.step = 'card'; sel.hero = hero; }
      });
    }
    if (a === 'wander') {
      const hero = sel.hero;
      commit(() => {
        const id = 'wm' + (st.monsters.length + 1);
        addMonster(st, { id, type: Q.wandering.toLowerCase(), x: -1, y: -1 }, { wandering: true, wanderAt: hero, fresh: false });
        const t = M[Q.wandering.toLowerCase()], code = st.monsters[st.monsters.length - 1].code;
        sel = null;
        note = { letter: '!', kind: 'Wandering monster', title: `${t.name} ${code} attacks the ${hero}!`,
          text: `Put an ${t.name} on a free square next to the <b>${hero}</b>. It attacks the ${hero} at once with ${t.att} attack dice; this round it can attack nobody else. The ${hero} defends as usual, then goes on with the turn.`,
          extra: `No free square next to the ${hero}? Put it in the room as close to the ${hero} as you can. Then it does not attack now: it acts on Zargon's next turn.` };
      });
    }
    if (a === 'trap') {
      const to = b.dataset.to, id = sel.id;
      if (to === 'spring') commit(() => { st.traps[id] = 'sprung'; sel = { kind: 'trap', id, step: 'sprung' }; });
      else if (to === 'disarm') commit(() => { st.traps[id] = 'disarmed'; sel = { kind: 'trap', id, step: 'disarmed' }; });
      else { sel.step = to; renderCallout(); }
    }
    if (a === 'selmon') { sel = { kind: 'monster', id: b.dataset.id }; render(); }
    if (a === 'slay' || a === 'zslay') {
      const id = a === 'slay' ? sel.id : b.dataset.id;
      commit(() => { const m = st.monsters.find(x => x.id === id); m.dead = true; if (a === 'slay') sel = null; say(`${m.code} slain.`); });
    }
    if (a === 'hurt') { const d = +b.dataset.d; commit(() => { const m = st.monsters.find(x => x.id === sel.id); m.body = Math.max(1, Math.min(M[m.type].body, m.body + d)); }); }
    if (a === 'zargon') { zOpen = true; sel = null; render(); }
    if (a === 'zclose') { zOpen = false; render(); }
    if (a === 'mode') { st.mode = b.dataset.mode; renderZargon(); }
    if (a === 'reach') { const id = b.dataset.id, h = b.dataset.hero; const r = st.reach[id] || (st.reach[id] = []); const i = r.indexOf(h); i < 0 ? r.push(h) : r.splice(i, 1); renderZargon(); }
    if (a === 'adj') { const kk = b.dataset.id + ':adj'; st.reach[kk] = !st.reach[kk]; renderZargon(); }
    if (a === 'zdone') { st.done[b.dataset.id] = !st.done[b.dataset.id]; renderZargon(); }
    if (a === 'zend') { commit(() => { st.turn += 1; st.done = {}; st.reach = {}; zOpen = false; }); say(`Heroes' turn ${st.turn}.`); renderToast(); }
    if (a === 'reread') { const n = Q.notes[b.dataset.room]; note = { letter: n.letter, title: 'Read again', text: n.text }; render(); }
    if (a === 'noteok') { note = null; render(); }
    if (a === 'undo') { toast = null; undo(); }
  });

  /* ======================= scripted states (for review) ======================= */
  function setup(name) {
    st = initState();
    const d = [];
    revealRoom(st, Q.start, d);
    openDoor(st, 'd1'); openDoor(st, 'd2');
    st.turn = 3;
    st.monsters.forEach(m => m.fresh = false);
    if (name === 'idle' || !name) sel = { kind: 'door', id: 'd3' };
    if (name === 'reveal') { history.push(snap()); const r = openDoor(st, 'd3'); anim = { added: new Set(r.added), origin: r.origin, t0: performance.now() - 330 }; }
    if (name === 'look') sel = { kind: 'cell', at: [12, 18] };
    if (name === 'room') sel = { kind: 'room', room: 'R20', anchor: roomAnchor('R20'), tap: [3, 15], step: 'pick', what: 'treasure' };
    if (name === 'card') { st.searched.R20 = { treasure: ['Dwarf'], secret: [] }; sel = { kind: 'room', room: 'R20', anchor: roomAnchor('R20'), tap: [3, 15], step: 'card', hero: 'Dwarf' }; }
    if (name === 'note') {
      openDoor(st, 'd3'); st.monsters.forEach(m => { m.fresh = false; if (['R17', 'R18'].includes(area(m.x, m.y))) m.dead = true; });
      st.turn = 5; st.searched.R18 = { treasure: ['Elf'], secret: [] };
      st.journal.push({ letter: 'A', short: 'The weapons on this rack are chipped, rusted and broken.', room: 'R18' });
      note = { letter: 'A', title: 'Treasure search · Elf', text: Q.notes.R18.text };
    }
    if (name === 'trap' || name === 'sprung') { const a = []; lookFrom(st, 12, 18, a); st.monsters.forEach(m => m.fresh = false); sel = { kind: 'trap', id: 't1', step: name === 'sprung' ? 'sprung' : 'menu' }; if (name === 'sprung') st.traps.t1 = 'sprung'; }
    if (name === 'monster') sel = { kind: 'monster', id: 'o2' };
    if (name === 'letters') {
      openDoor(st, 'd3'); st.monsters.forEach(m => { m.fresh = false; if (['R17', 'R18'].includes(area(m.x, m.y))) m.dead = true; });
      st.turn = 6; st.searched.R18 = { treasure: ['Elf'], secret: [] };
      st.journal.push({ letter: 'A', short: 'The weapons on this rack are chipped, rusted and broken.', room: 'R18' });
    }
    if (name === 'wander') {
      st.searched.R20 = { treasure: ['Dwarf'], secret: [] };
      addMonster(st, { id: 'wm9', type: 'orc', x: -1, y: -1 }, { wandering: true, wanderAt: 'Dwarf', fresh: false });
      const t = M.orc;
      note = { letter: '!', kind: 'Wandering monster', title: 'Orc O3 attacks the Dwarf!',
        text: `Put an Orc on a free square next to the <b>Dwarf</b>. It attacks the Dwarf at once with ${t.att} attack dice; this round it can attack nobody else. The Dwarf defends as usual, then goes on with the turn.`,
        extra: 'No free square next to the Dwarf? Put it in the room as close to the Dwarf as you can. Then it does not attack now: it acts on Zargon\'s next turn.' };
    }
    if (name === 'zargon' || name === 'zargon-detail') {
      openDoor(st, 'd3'); st.monsters.forEach(m => m.fresh = false); st.turn = 4; zOpen = true;
      if (name === 'zargon-detail') { st.mode = 'detail'; st.reach = { o2: ['Barbarian', 'Dwarf'], 'o2:adj': true, g1: ['Dwarf', 'Elf'] }; st.done = { o1: true }; }
      if (name === 'zargon') st.done = {};
    }
  }
  const params = new URLSearchParams(location.search);
  setup(params.get('state') || 'idle');
  render();
  if (document.fonts) document.fonts.ready.then(() => { if (!anim) render(); });
})();

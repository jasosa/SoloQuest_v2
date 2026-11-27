/* Team card concepts. ?team=A|B|C (see DESIGN.md, "Team card: three alternatives").
   Plain JS, loaded after play.js. It draws only the team; the rest of the screen is play.js.
   ?tap=ask (a hero asks "fell?"), fell (the Elf fell), ally (the wolf), companion (Sir Ragnar), open (B: the drawer open). */
(function () {
  const params = new URLSearchParams(location.search);
  const V = (params.get('team') || '').toUpperCase();
  if (!['A', 'B', 'C'].includes(V)) return;
  const app = document.querySelector('.app');
  const TEAM = [
    { id: 'b', code: 'B', name: 'Barbarian', kind: 'Hero', t: 'hero' },
    { id: 'd', code: 'D', name: 'Dwarf', kind: 'Hero', t: 'hero' },
    { id: 'e', code: 'E', name: 'Elf', kind: 'Hero', t: 'hero' },
    { id: 'ba', code: 'Ba', name: 'Barbarian (alternate)', kind: 'Hero', t: 'hero' },
    { id: 'sw', code: 'Sw', name: 'Swordsman', kind: 'Mercenary', t: 'helper' },
    { id: 'sw2', code: 'Sw2', name: 'Swordsman 2', kind: 'Mercenary', t: 'helper' },
    { id: 'sn', code: 'Sn', name: 'Snowdasher', kind: 'Ally', t: 'helper', nums: 'Movement dice 10 · Attack dice 3 · Defend dice 2 · Body 5' },
    { id: 'og', code: 'OG', name: 'Old Gareth', kind: 'Mercenary', t: 'helper' },
    { id: 'sr', code: 'SR', name: 'Sir Ragnar', kind: 'Companion', t: 'npc', nums: 'Defend dice 2 · Body 4', text: 'He walks with the heroes. If he is slain, the quest notes say what follows.' },
  ];
  const GROUPS = [['Heroes', 'hero'], ['Mercenaries and allies', 'helper'], ['Companions', 'npc']];
  const fell = new Set(), stack = [];
  let open = null, drawer = false;
  const tap = params.get('tap') || '';
  if (tap === 'fell') { fell.add('e'); stack.push('e'); }
  if (tap === 'ask') open = 'd';
  if (tap === 'ask2') { fell.add('e'); stack.push('e'); open = 'sw2'; }
  if (tap === 'ally') open = 'sn';
  if (tap === 'companion') open = 'sr';
  if (tap || params.has('drawer')) drawer = true;

  const byId = id => TEAM.find(m => m.id === id);
  const coin = m => `<span class="coin tcoin ${fell.has(m.id) ? 'off' : m.t}${m.code.length > 2 ? ' long' : ''}" aria-hidden="true">${m.code}</span>`;
  const aria = m => fell.has(m.id) ? `${m.code}, ${m.name}, fell` : m.t === 'npc' ? `${m.code}, ${m.name}, companion, tap for its numbers` : `${m.code}, ${m.name}, tap if it fell`;
  const state = m => fell.has(m.id) ? 'Fell' : m.kind;
  const noteBody = m => {
    if (m.t === 'npc') return `<div class="kind">Companion</div><h3>${m.name}</h3><p class="nums">${m.nums}</p><p>${m.text}</p>`;
    return `<div class="kind">${m.kind}</div><h3>${m.name} fell?</h3>${m.nums ? `<p class="nums">${m.nums}</p>` : ''}
      <div class="row"><button class="btn" data-tact="yes">Yes, fell</button><button class="btn alt" data-tact="no">No</button></div>`;
  };

  /* ---------- A: the card in the left column, inline question ---------- */
  function rowA(m) {
    const f = fell.has(m.id), o = open === m.id;
    let h = `<li><button class="trow${f ? ' fallen' : ''}${o ? ' sel' : ''}" data-tid="${m.id}" ${f ? 'disabled' : ''} aria-expanded="${o}" aria-label="${aria(m)}">${coin(m)}<span><span class="nm">${m.name}</span>${f ? '<span class="st">Fell</span>' : m.nums && m.t === 'npc' ? `<span class="st">${m.nums.replace(' dice', '')}</span>` : ''}</span></button>`;
    if (o) {
      h += m.t === 'npc'
        ? `<div class="tinline"><p>${m.text}</p></div>`
        : `<div class="tinline"><h3>${m.name} fell?</h3>${m.nums ? `<p>${m.nums}</p>` : ''}<div class="brow"><button class="btn" data-tact="yes">Yes, fell</button><button class="btn alt" data-tact="no">No</button></div></div>`;
    }
    return h + '</li>';
  }
  function drawA() {
    host.className = 'tcard A';
    host.setAttribute('aria-label', 'Team');
    host.innerHTML = '<div class="lbl">Team</div>' + GROUPS.map(([g, t]) => `<div class="sub">${g}</div><ul class="tlist">${TEAM.filter(m => m.t === t).map(rowA).join('')}</ul>`).join('');
  }

  /* ---------- B: drawer, note beside it ---------- */
  function rowB(m, first) {
    const f = fell.has(m.id), o = open === m.id;
    return `<li class="${first ? 'gap' : ''}"><button class="trow${f ? ' fallen' : ''}${o ? ' sel' : ''}" data-tid="${m.id}" ${f ? 'disabled' : ''} aria-label="${aria(m)}">${coin(m)}<span><span class="nm">${m.name}</span><span class="st">${state(m)}</span></span></button></li>`;
  }
  function drawB() {
    host.className = 'tdrawer' + (drawer ? ' open' : '');
    host.setAttribute('aria-label', 'Team');
    const hasFell = fell.size > 0;
    host.innerHTML = `<button class="ttab" data-tact="drawer" aria-expanded="${drawer}" aria-label="Team, ${TEAM.length} entries"><span class="w">Team</span><b>${TEAM.length}</b></button>
      <div class="lbl">Team</div><ul class="tlist">${TEAM.map((m, i) => rowB(m, i > 0 && TEAM[i - 1].t !== m.t && (m.t === 'npc' || TEAM[i - 1].t === 'hero'))).join('')}</ul>`;
  }

  /* ---------- C: card under the board, note above the cell ---------- */
  function cellC(m) {
    const f = fell.has(m.id), o = open === m.id;
    return `<button class="tcell${f ? ' fallen' : ''}${o ? ' sel' : ''}" data-tid="${m.id}" ${f ? 'disabled' : ''} aria-label="${aria(m)}">${coin(m)}<span class="nm">${m.name}</span></button>`;
  }
  function drawC() {
    host.className = 'tcard C';
    host.setAttribute('aria-label', 'Team');
    host.innerHTML = `<div class="lbl">Team</div><div class="tgrid">${TEAM.map(cellC).join('')}</div>`;
  }

  /* ---------- the margin note (B, C) ---------- */
  let note = null;
  function drawNote() {
    if (V === 'A' || open == null || (V === 'B' && !drawer)) { if (note) { note.remove(); note = null; } return; }
    const m = byId(open), btn = host.querySelector(`[data-tid="${open}"]`);
    if (!note) { note = document.createElement('div'); note.className = 'callout tnote'; app.appendChild(note); }
    note.innerHTML = '<button class="close" data-tact="no" aria-label="Close">×</button>' + noteBody(m);
    note.hidden = false;
    const r = btn.getBoundingClientRect(), ar = app.getBoundingClientRect(), nh = note.offsetHeight, nw = note.offsetWidth;
    let left, top, ox, oy;
    if (V === 'B') {
      left = r.right - ar.left + 16; top = Math.max(72, Math.min(r.top - ar.top + r.height / 2 - nh / 2, 826 - nh));
      ox = '0'; oy = (r.top - ar.top + r.height / 2 - top) + 'px';
    } else {
      left = Math.max(28, Math.min(r.left - ar.left - 10, 920 - nw - 4)); top = host.getBoundingClientRect().top - ar.top - nh - 10;
      ox = (r.left - ar.left + 20 - left) + 'px'; oy = '100%';
    }
    note.style.left = left + 'px'; note.style.top = top + 'px';
    note.style.setProperty('--ox', ox); note.style.setProperty('--oy', oy);
  }

  const host = document.createElement('section');
  app.appendChild(host);
  function render() {
    ({ A: drawA, B: drawB, C: drawC })[V]();
    drawNote();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tid],[data-tact]');
    if (t && t.dataset.tid) { open = open === t.dataset.tid ? null : t.dataset.tid; render(); return; }
    if (t && t.dataset.tact) {
      const a = t.dataset.tact;
      if (a === 'yes') { fell.add(open); stack.push(open); open = null; }
      if (a === 'no') open = null;
      if (a === 'drawer') { drawer = !drawer; if (!drawer) open = null; }
      render(); return;
    }
    // a tap on the board closes the note and, in B, the drawer
    if (e.target.closest('#board')) { open = null; if (V === 'B') drawer = false; render(); }
  });
  // Undo takes the last "fell" back first, as in the app
  document.addEventListener('click', e => {
    if (e.target.closest('#undo') && stack.length) { fell.delete(stack.pop()); open = null; render(); e.stopPropagation(); }
  }, true);
  document.fonts && document.fonts.ready.then(drawNote);
  render();
})();

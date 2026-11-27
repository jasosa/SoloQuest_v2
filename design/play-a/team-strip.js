/* Team alternatives E, H, I (DESIGN.md, "Alternative E", "Alternative H", "Alternative I"). ?team=E|H|I
   E: a 44 px strip of coins above the board. H: a coin stack at the bottom left, a card on tap. I: a "Someone fell" button.
   Plain JS, loaded after play.js. Extra values:
   ?tap=ask|ask2|fell|ally|companion, ?open=1 (H card, I card open), ?zargon=1 (open Zargon's page; I shows the tie list coin row). */
(function () {
  const params = new URLSearchParams(location.search);
  const V = (params.get('team') || '').toUpperCase();
  if (!['E', 'H', 'I'].includes(V)) return;
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
  let open = null, pop = false;
  const tap = params.get('tap') || '';
  if (tap === 'fell') { fell.add('e'); stack.push('e'); }
  if (tap === 'ask') open = 'd';
  if (tap === 'ask2') { fell.add('e'); stack.push('e'); open = 'sw2'; }
  if (tap === 'ally') open = 'sn';
  if (tap === 'companion') open = 'sr';
  if ((V === 'H' || V === 'I') && (tap === 'ask' || tap === 'ask2' || tap === 'ally' || tap === 'companion' || params.has('open'))) pop = true;
  if (params.has('zargon') && V === 'I' && fell.size === 0 && !tap) { fell.add('e'); stack.push('e'); }

  const byId = id => TEAM.find(m => m.id === id);
  const coin = m => `<span class="coin tcoin ${fell.has(m.id) ? 'off' : m.t}${m.code.length > 2 ? ' long' : ''}" aria-hidden="true">${m.code}</span>`;
  const aria = m => fell.has(m.id) ? `${m.code}, ${m.name}, fell` : m.t === 'npc' ? `${m.code}, ${m.name}, companion, tap for its numbers` : `${m.code}, ${m.name}, tap if it fell`;
  const numsShort = m => m.nums.replace(/ dice/g, '');
  const noteBody = m => m.t === 'npc'
    ? `<div class="kind">Companion</div><h3>${m.name}</h3><p class="nums">${m.nums}</p><p>${m.text}</p>`
    : `<div class="kind">${m.kind}</div><h3>${m.name} fell?</h3>${m.nums ? `<p class="nums">${m.nums}</p>` : ''}
      <div class="row"><button class="btn" data-tact="yes">Yes, fell</button><button class="btn alt" data-tact="no">No</button></div>`;

  /* ---------- E: the strip ---------- */
  let strip, stackBtn, popEl, fellBtn, note = null;
  if (V === 'E') {
    strip = document.createElement('div');
    strip.className = 'tstrip'; strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', 'Team');
    app.appendChild(strip);
  }
  function drawE() {
    const chip = m => `<button class="tchip${open === m.id ? ' sel' : ''}" data-tid="${m.id}" ${fell.has(m.id) ? 'disabled' : ''} aria-label="${aria(m)}">${coin(m)}</button>`;
    strip.innerHTML = GROUPS.map(([, t]) => `<div class="tg">${TEAM.filter(m => m.t === t).map(chip).join('')}</div>`).join('<i class="hair"></i>');
  }

  /* ---------- H: the stack and the card ---------- */
  if (V === 'H') {
    stackBtn = document.createElement('button');
    stackBtn.className = 'tstack'; stackBtn.dataset.tact = 'pop';
    app.appendChild(stackBtn);
  }
  function drawStack() {
    const n = fell.size;
    stackBtn.setAttribute('aria-expanded', pop);
    stackBtn.setAttribute('aria-label', `Team, ${TEAM.length} entries${n ? `, ${n} fell` : ''}`);
    stackBtn.innerHTML = `<span class="lbl">Team</span><span class="coins">${TEAM.map(coin).join('')}</span>${n ? `<span class="fc">${n} fell</span>` : ''}`;
  }
  function rowH(m) {
    const f = fell.has(m.id), o = open === m.id;
    let h = `<li><button class="trow${f ? ' fallen' : ''}${o ? ' sel' : ''}" data-tid="${m.id}" ${f ? 'disabled' : ''} aria-expanded="${o}" aria-label="${aria(m)}">${coin(m)}<span><span class="nm">${m.name}</span>${f ? '<span class="st">Fell</span>' : m.t !== 'hero' ? `<span class="st">${m.t === 'npc' ? numsShort(m) : m.kind}</span>` : ''}</span></button>`;
    if (o) {
      h += m.t === 'npc'
        ? `<div class="tinline"><p>${m.text}</p></div>`
        : `<div class="tinline"><h3>${m.name} fell?</h3>${m.nums ? `<p>${numsShort(m)}</p>` : ''}<div class="brow"><button class="btn" data-tact="yes">Yes, fell</button><button class="btn alt" data-tact="no">No</button></div></div>`;
    }
    return h + '</li>';
  }
  const list = t => `<ul class="tlist">${TEAM.filter(m => m.t === t).map(rowH).join('')}</ul>`;
  function drawPopH() {
    popEl.className = 'tpop H'; popEl.setAttribute('aria-label', 'Team');
    popEl.innerHTML = `<div class="lbl">Team</div><div class="cols"><div><div class="sub">Heroes</div>${list('hero')}<div class="sub">Companions</div>${list('npc')}</div><div><div class="sub">Mercenaries and allies</div>${list('helper')}</div></div>`;
  }

  /* ---------- I: footer button, card, tie list ---------- */
  if (V === 'I') {
    fellBtn = document.createElement('button');
    fellBtn.className = 'btn alt'; fellBtn.id = 'sfell'; fellBtn.dataset.tact = 'pop'; fellBtn.textContent = 'Someone fell';
    const zb = document.getElementById('zbtn');
    zb.parentNode.insertBefore(fellBtn, zb);
  }
  const cell = m => `<button class="tcell2${fell.has(m.id) ? ' fallen' : ''}" data-tid="${m.id}" ${fell.has(m.id) ? 'disabled' : ''} aria-label="${aria(m)}">${coin(m)}<span class="nm">${m.name}</span></button>`;
  function drawPopI() {
    popEl.className = 'tpop I'; popEl.setAttribute('aria-label', 'Someone fell');
    if (open == null) {
      popEl.innerHTML = `<div class="lbl">Who fell?</div>` + GROUPS.map(([g, t]) => `<div class="sub">${g}</div><div class="grid">${TEAM.filter(m => m.t === t).map(cell).join('')}</div>`).join('');
    } else {
      const m = byId(open);
      popEl.innerHTML = `<button class="close" data-tact="no" aria-label="Back to the list">×</button><div class="ask"><div class="head">${coin(m)}<span class="kind">${m.kind}</span></div>` +
        (m.t === 'npc'
          ? `<h3>${m.name}</h3><p class="nums">${m.nums}</p><p>${m.text}</p>`
          : `<h3>${m.name} fell?</h3>${m.nums ? `<p class="nums">${m.nums}</p>` : ''}<div class="row"><button class="btn" data-tact="yes">Yes, fell</button><button class="btn alt" data-tact="no">No</button></div>`) + '</div>';
    }
    const r = fellBtn.getBoundingClientRect(), ar = app.getBoundingClientRect();
    popEl.style.right = (ar.width - (r.left - ar.left) + 8) + 'px';
    popEl.style.bottom = (ar.height - (r.bottom - ar.top)) + 'px';
  }
  let tie = null;
  function drawTie() {
    const page = document.getElementById('zpage');
    if (!tie) { tie = document.createElement('div'); tie.className = 'tie'; page.insertBefore(tie, document.getElementById('orders')); }
    tie.innerHTML = `<div class="lbl">Heroes and helpers in play</div><div class="coins">${TEAM.filter(m => m.t !== 'npc').map(coin).join('')}</div><p>${fell.size ? 'Grey coins fell. They are left out of every tie list.' : 'Every coin is in the tie lists. A fallen one turns grey.'}</p>`;
  }

  /* ---------- the margin note under a strip coin (E) ---------- */
  function drawNote() {
    if (V !== 'E' || open == null) { if (note) { note.remove(); note = null; } return; }
    const m = byId(open), btn = strip.querySelector(`[data-tid="${open}"]`);
    if (!note) { note = document.createElement('div'); note.className = 'callout tnote'; app.appendChild(note); }
    note.innerHTML = '<button class="close" data-tact="no" aria-label="Close">×</button>' + noteBody(m);
    const r = btn.getBoundingClientRect(), ar = app.getBoundingClientRect(), nw = note.offsetWidth;
    const cx = r.left - ar.left + r.width / 2, left = Math.max(20, Math.min(cx - 36, 920 - nw)), top = r.bottom - ar.top + 8;
    note.style.left = left + 'px'; note.style.top = top + 'px';
    note.style.setProperty('--ox', (cx - left) + 'px'); note.style.setProperty('--oy', '0');
  }

  function render() {
    if (V === 'E') { drawE(); drawNote(); return; }
    if (!popEl && pop) { popEl = document.createElement('div'); popEl.className = 'tpop'; app.appendChild(popEl); }
    if (popEl && !pop) { popEl.remove(); popEl = null; }
    if (V === 'H') { drawStack(); if (popEl) drawPopH(); }
    if (V === 'I') { fellBtn.classList.toggle('open', pop); fellBtn.setAttribute('aria-expanded', pop); if (popEl) drawPopI(); drawTie(); }
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tid],[data-tact]');
    if (t && t.dataset.tid) { open = open === t.dataset.tid ? null : t.dataset.tid; render(); return; }
    if (t && t.dataset.tact) {
      const a = t.dataset.tact;
      if (a === 'yes') { fell.add(open); stack.push(open); open = null; if (V === 'I') pop = false; }
      if (a === 'no') open = null;
      if (a === 'pop') { pop = !pop; open = null; }
      render(); return;
    }
    // a tap outside closes the note or the card
    if (!e.target.closest('.tpop, .tstack, .tnote, #sfell') && (open != null || pop)) { open = null; pop = false; render(); }
  });
  // Undo takes the last "fell" back first, as in the app
  document.addEventListener('click', e => {
    if (e.target.closest('#undo') && stack.length) { fell.delete(stack.pop()); open = null; render(); e.stopPropagation(); }
  }, true);
  document.fonts && document.fonts.ready.then(() => { render(); });
  render();
  if (params.has('zargon') && !document.getElementById('zpage').classList.contains('open')) document.getElementById('zbtn').click();
})();

/* Alternative D: left tabs (DESIGN.md, "Alternative D: left tabs"). ?team=T
   A panel with three tabs (Team, Monsters, Quest info) at the left; the board moves to the right at its full size.
   Plain JS, loaded after play.js and team-card.js. Extra values:
   ?tab=team|monsters|quest (open tab; default monsters), ?tap=ask|ask2|fell|ally|companion (Team tab), ?dot=quest (a quest action waits). */
(function () {
  const params = new URLSearchParams(location.search);
  if ((params.get('team') || '').toUpperCase() !== 'T') return;
  const app = document.querySelector('.app');
  const aside = document.querySelector('aside');
  const Q = window.QUEST;
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
  let open = null, tab = params.get('tab') || 'monsters', snap = { st: null, sel: null, zOpen: false };
  const tap = params.get('tap') || '';
  if (tap === 'fell') { fell.add('e'); stack.push('e'); }
  if (tap === 'ask') open = 'd';
  if (tap === 'ask2') { fell.add('e'); stack.push('e'); open = 'sw2'; }
  if (tap === 'ally') open = 'sn';
  if (tap === 'companion') open = 'sr';
  if (tap && !params.has('tab')) tab = 'team';

  /* ---------- structure: tabs, one panel with three panes, Zargon's turn under it ---------- */
  const scroll = aside.querySelector('.aside-scroll'), foot = aside.querySelector('.aside-foot');
  const monsters = scroll.querySelector('section.monsters');
  const wander = foot.querySelector('.wander'), addmon = foot.querySelector('#addmon');
  const wrap = document.createElement('div');
  wrap.className = 'tabwrap';
  wrap.innerHTML = `<div class="tabs" role="tablist" aria-label="Side panel">
      <button class="ptab" role="tab" id="tab-team" aria-controls="pane-team" data-tab="team"><span>Team</span></button>
      <button class="ptab" role="tab" id="tab-monsters" aria-controls="pane-monsters" data-tab="monsters"><span>Monsters</span><b class="cnt" id="cnt-monsters"></b></button>
      <button class="ptab" role="tab" id="tab-quest" aria-controls="pane-quest" data-tab="quest"><span>Quest info</span></button>
    </div>
    <div class="tpanel">
      <div class="pane" role="tabpanel" id="pane-team" aria-labelledby="tab-team"></div>
      <div class="pane" role="tabpanel" id="pane-monsters" aria-labelledby="tab-monsters"><div class="pane-body"></div><div class="pane-foot"></div></div>
      <div class="pane" role="tabpanel" id="pane-quest" aria-labelledby="tab-quest"></div>
    </div>`;
  aside.insertBefore(wrap, scroll);
  const pm = wrap.querySelector('#pane-monsters');
  pm.querySelector('.pane-body').appendChild(monsters);
  const pf = pm.querySelector('.pane-foot');
  if (wander) pf.appendChild(wander);
  if (addmon) pf.appendChild(addmon);
  scroll.remove();
  foot.classList.add('solo');

  /* ---------- Team pane ---------- */
  const byId = id => TEAM.find(m => m.id === id);
  const coin = m => `<span class="coin tcoin ${fell.has(m.id) ? 'off' : m.t}${m.code.length > 2 ? ' long' : ''}" aria-hidden="true">${m.code}</span>`;
  const aria = m => fell.has(m.id) ? `${m.code}, ${m.name}, fell` : m.t === 'npc' ? `${m.code}, ${m.name}, companion, tap for its numbers` : `${m.code}, ${m.name}, tap if it fell`;
  function drawTeam() {
    const rows = m => {
      const f = fell.has(m.id), o = open === m.id;
      return `<li><button class="trow${f ? ' fallen' : ''}${o ? ' sel' : ''}" data-tid="${m.id}" ${f ? 'disabled' : ''} aria-expanded="${o}" aria-label="${aria(m)}">${coin(m)}<span><span class="nm">${m.name}</span>${f ? '<span class="st">Fell</span>' : m.t === 'npc' ? `<span class="st">${m.nums.replace(/ dice/g, '')}</span>` : ''}</span></button></li>`;
    };
    document.getElementById('pane-team').innerHTML = GROUPS.map(([g, t]) => `<div class="sub">${g}</div><ul class="tlist">${TEAM.filter(m => m.t === t).map(rows).join('')}</ul>`).join('');
  }
  const noteBody = m => m.t === 'npc'
    ? `<div class="kind">Companion</div><h3>${m.name}</h3><p class="nums">${m.nums}</p><p>${m.text}</p>`
    : `<div class="kind">${m.kind}</div><h3>${m.name} fell?</h3>${m.nums ? `<p class="nums">${m.nums}</p>` : ''}
      <div class="row"><button class="btn" data-tact="yes">Yes, fell</button><button class="btn alt" data-tact="no">No</button></div>`;
  let note = null;
  function drawNote() {
    if (open == null || tab !== 'team') { if (note) { note.remove(); note = null; } return; }
    const m = byId(open), btn = document.querySelector(`[data-tid="${open}"]`);
    if (!note) { note = document.createElement('div'); note.className = 'callout tnote'; app.appendChild(note); }
    note.innerHTML = '<button class="close" data-tact="no" aria-label="Close">×</button>' + noteBody(m);
    const r = btn.getBoundingClientRect(), ar = app.getBoundingClientRect(), nh = note.offsetHeight;
    const left = document.querySelector('.tpanel').getBoundingClientRect().right - ar.left + 12, top = Math.max(72, Math.min(r.top - ar.top + r.height / 2 - nh / 2, 826 - nh));
    note.style.left = left + 'px'; note.style.top = top + 'px';
    note.style.setProperty('--ox', '0'); note.style.setProperty('--oy', (r.top - ar.top + r.height / 2 - top) + 'px');
  }

  /* ---------- Quest info pane: what the Quest sheet shows today, in the same order but the play parts first ---------- */
  function drawQuest() {
    const st = snap.st, j = st ? st.journal : [];
    document.getElementById('pane-quest').innerHTML = `
      <div class="lbl">Goal</div>
      <ul class="goals"><li><span class="tick" aria-hidden="true"></span><span>${Q.goal}</span></li></ul>
      <div class="lbl">Quest actions</div>
      <p class="empty">No quest action yet.</p>
      <div class="lbl">Notes read</div>
      ${j.length ? `<ul class="journal">${j.map(e => `<li><button class="jl" data-note="${e.room}"><b>${e.letter}</b>${e.short}</button></li>`).join('')}</ul>` : '<p class="empty">No quest note read yet.</p>'}
      <div class="lbl">What happened</div>
      <ul class="log"><li><i>Turn 1</i> The heroes enter the stairway room.</li>${st && st.turn > 2 ? '<li><i>Turn 2</i> A door was opened.</li>' : ''}</ul>
      <div class="lbl">About this quest</div>
      <p>${Q.zargonInfo}</p>
      <div class="lbl">At the start</div>
      <p>The heroes start in the stairway room.</p>`;
  }

  /* ---------- tabs ---------- */
  function setTab(t, keepNote) {
    tab = t;
    if (!keepNote) open = null;
    wrap.querySelectorAll('.ptab').forEach(b => { const on = b.dataset.tab === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    wrap.querySelectorAll('.pane').forEach(p => { p.hidden = p.id !== 'pane-' + t; });
    wrap.querySelector('#tab-quest').classList.toggle('dot', params.get('dot') === 'quest' && t !== 'quest');
    drawTeam(); drawNote();
  }
  function counts() {
    const n = document.querySelectorAll('#roster li:not(.empty)').length;
    const c = document.getElementById('cnt-monsters');
    if (c.textContent !== (n ? String(n) : '')) { c.textContent = n ? n : ''; if (n) { c.classList.remove('stamp'); void c.offsetWidth; c.classList.add('stamp'); } }
  }
  document.addEventListener('play-render', e => {
    const prev = snap;
    snap = e.detail;
    counts();
    // Zargon's turn or a tap on a monster brings the Monsters tab forward
    if (tab !== 'monsters' && ((snap.zOpen && !prev.zOpen) || (snap.sel && snap.sel.kind === 'monster'))) setTab('monsters');
    if (tab === 'quest') drawQuest();
  });
  wrap.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab);
  });
  wrap.addEventListener('keydown', e => {
    const order = ['team', 'monsters', 'quest'], i = order.indexOf(tab);
    if (e.key === 'ArrowRight') { setTab(order[(i + 1) % 3]); wrap.querySelector('[aria-selected="true"]').focus(); }
    if (e.key === 'ArrowLeft') { setTab(order[(i + 2) % 3]); wrap.querySelector('[aria-selected="true"]').focus(); }
  });
  // the goal line in the title band opens the Quest info tab
  const goal = document.querySelector('.goalline');
  if (goal) { goal.style.cursor = 'pointer'; goal.addEventListener('click', () => { setTab('quest'); drawQuest(); }); }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tid],[data-tact]');
    if (t && t.dataset.tid) { open = open === t.dataset.tid ? null : t.dataset.tid; drawTeam(); drawNote(); return; }
    if (t && t.dataset.tact) {
      if (t.dataset.tact === 'yes') { fell.add(open); stack.push(open); }
      open = null; drawTeam(); drawNote(); return;
    }
    if (e.target.closest('#board') && open) { open = null; drawTeam(); drawNote(); }
  });
  document.addEventListener('click', e => {
    if (e.target.closest('#undo') && stack.length) { fell.delete(stack.pop()); open = null; drawTeam(); drawNote(); e.stopPropagation(); }
  }, true);

  document.fonts && document.fonts.ready.then(drawNote);
  setTab(tab, true);
  counts();
})();

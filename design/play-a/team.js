/* Prototype of the team picker in the New game popup. Loaded after play.js; only acts for ?state=newgame*.
   States: newgame, newgame-ally, newgame-merc, newgame-custom, newgame-team. */
(function () {
  const p = new URLSearchParams(location.search).get('state') || '';
  if (!p.startsWith('newgame')) return;
  const app = document.querySelector('.app');
  app.innerHTML = '';
  const heroes = [['Barbarian', 'Core game'], ['Dwarf', 'Core game'], ['Elf', 'Core game'], ['Wizard', 'Core game'], ['Barbarian (alternate)', 'Frozen Horror']];
  const on = new Set(['Dwarf', 'Elf']);
  const types = {
    merc: { title: 'Add a mercenary', hint: 'Mercenaries of every box. Tap + to add one.', custom: 'Another mercenary: type a name',
      list: [['Crossbowman', 'Frozen Horror'], ['Halberdier', 'Frozen Horror'], ['Scout', 'Frozen Horror'], ['Swordsman', 'Frozen Horror']] },
    ally: { title: 'Add an ally', hint: 'Allies of every box. Tap + to add one.', custom: 'Another ally: type a name',
      list: [['Snowdasher', 'Frozen Horror']] },
  };
  let team = [], open = null, typing = false;
  if (p === 'newgame-team') team = [{ k: 'merc', n: 'Swordsman', c: 2 }, { k: 'merc', n: 'Scout', c: 1 }, { k: 'ally', n: 'Snowdasher', c: 1 }, { k: 'merc', n: 'Old Gareth', c: 1, custom: true }];
  if (p === 'newgame-ally') open = 'ally';
  if (p === 'newgame-merc') { open = 'merc'; team = [{ k: 'merc', n: 'Swordsman', c: 2 }, { k: 'merc', n: 'Scout', c: 1 }]; }
  if (p === 'newgame-custom') { open = 'merc'; typing = true; team = [{ k: 'merc', n: 'Swordsman', c: 2 }]; }
  const find = (k, n) => team.find(e => e.k === k && e.n === n);
  const add = (k, n, custom) => { const e = find(k, n); if (e) e.c++; else team.push({ k, n, c: 1, custom }); };
  const less = (e) => { e.c--; if (e.c <= 0) team.splice(team.indexOf(e), 1); };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function pickDialog() {
    const t = types[open];
    const rows = t.list.map(([n, box]) => {
      const e = find(open, n), c = e ? e.c : 0;
      return `<div class="pick-row ${c ? 'on' : ''}"><span class="hero-name">${n}</span><span class="box">${box}</span>
        <span class="stepper"><button class="chip" data-a="less" data-n="${n}" aria-label="Take out one ${n}" ${c ? '' : 'disabled'}>-</button><b>${c}</b><button class="chip" data-a="more" data-n="${n}" aria-label="Add one ${n}">+</button></span></div>`;
    }).join('');
    return `<div class="veil"><div class="note pick" role="dialog" aria-label="${t.title}">
      <div class="hd"><div><div>Team</div><h3>${t.title}</h3></div></div>
      <p class="hint">${t.hint}</p>
      <div class="lbl">${open === 'merc' ? 'Mercenaries' : 'Allies'}</div>
      <div class="pick-list">${rows}</div>
      ${typing ? `<div class="custom"><input aria-label="Name" placeholder="Name" value="Old Gareth"><button class="btn" data-a="addcustom">Add</button></div>`
        : `<button class="chip add" data-a="typing">${t.custom}</button>`}
      <div class="foot"><button class="btn" data-a="done">Done</button></div></div></div>`;
  }
  function teamList() {
    if (!team.length) return `<p class="team-empty">No mercenary or ally yet.</p>`;
    return `<ul class="team-list">${team.map((e, i) => `<li class="team-row"><span class="nm">${esc(e.n)}${e.c > 1 ? `<i>x${e.c}</i>` : ''}</span><span class="own"></span>
      <button class="chip" data-a="tless" data-i="${i}" aria-label="${e.c > 1 ? 'Take out one ' : 'Remove '}${esc(e.n)}">${e.c > 1 ? '-' : 'x'}</button></li>`).join('')}</ul>`;
  }
  function render() {
    app.innerHTML = `
      <header><span class="qn">Quest 1</span><h1>The Trial</h1><button class="link" style="margin-left:auto">Back</button></header>
      <div class="ng"><div class="col">
        <div class="lbl">Heroes</div>
        <div class="hero-grid">${heroes.map(([h, box]) => `<button class="hero-row" data-a="hero" data-n="${h}" aria-pressed="${on.has(h)}"><span class="hero-tick"></span><span class="hero-name">${h}</span><span class="hero-box">${box}</span></button>`).join('')}</div>
        <div class="lbl">Team</div>
        <div class="team-btns"><button class="btn alt" data-a="open" data-k="ally">Add an ally</button><button class="btn alt" data-a="open" data-k="merc">Add a mercenary</button></div>
        ${teamList()}
      </div>
      <div class="col"><h2>The Trial</h2><p class="story">Find and destroy Verag, the gargoyle hiding in the catacombs.</p>
        <p class="hint">Pick 1 to 4 heroes.</p><button class="btn grow">Start the quest</button></div></div>
      ${open ? pickDialog() : ''}`;
  }
  app.addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, n = b.dataset.n;
    if (a === 'hero') { on.has(n) ? on.delete(n) : on.add(n); }
    if (a === 'open') { open = b.dataset.k; typing = false; }
    if (a === 'more') add(open, n);
    if (a === 'less') less(find(open, n));
    if (a === 'typing') typing = true;
    if (a === 'addcustom') { const v = app.querySelector('.custom input').value.trim(); if (v) { add(open, v, true); typing = false; } }
    if (a === 'tless') less(team[+b.dataset.i]);
    if (a === 'done') open = null;
    render();
  });
  render();
})();

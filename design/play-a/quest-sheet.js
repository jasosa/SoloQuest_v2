/* Mockup of the Quest sheet (decision 67). Runs after play.js and only adds DOM around it. */
(function () {
  const app = document.querySelector('.app');
  const map = document.querySelector('.map');
  const mode = new URLSearchParams(location.search).get('s') || 'sheet';
  const S = 34, MAPX = 28, MAPY = 18;
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

  // side column: heroes and companions in place of the goal, notes and journal
  const monsters = document.querySelector('aside section:has(#roster)');
  monsters.before(el(`<section><div class="lbl">Heroes</div><div class="heroes"><button class="chip">Dwarf</button><button class="chip">Elf</button><button class="chip">Wizard</button></div></section>`));
  monsters.before(el(`<section><div class="lbl">Companions</div><ul class="npcs"><li><div class="nm">Sir Ragnar</div><div class="st">Defend 2 · Body 2</div></li></ul></section>`));

  const qchip = document.getElementById('qchip');
  if (mode === 'board') qchip.classList.add('dot');

  const sheet = () => el(`
    <aside class="qsheet" role="dialog" aria-label="Quest sheet">
      <div class="qh"><div><div class="kind">Quest 1</div><h2>The Trial</h2></div><button class="x" aria-label="Close">×</button></div>
      <section>
        <div class="lbl">At the start</div>
        <p>Place the heroes on the stairs.</p>
      </section>
      <section>
        <div class="lbl">Goal</div>
        <ul class="goals-list">
          <li><span class="box"></span><span>Find and destroy Verag</span></li>
          <li><span class="box"></span><span>Bring the heroes back to the stairs</span></li>
        </ul>
        <button class="btn alt">All surviving heroes have left by the stairs</button>
      </section>
      <section>
        <div class="lbl">Tell the app</div>
        <button class="btn alt">The last hero has crossed the marked square</button>
        <p class="hint">Press it once the last hero has stepped past the square with the ring.</p>
      </section>
      <section>
        <div class="lbl">Notes read</div>
        <ul class="read"><li><button><b>A</b><span>The weapons on this rack are chipped, rusted and broken.</span></button></li></ul>
      </section>
      <section>
        <div class="lbl">What happened</div>
        <ul class="log">
          <li><i>Turn 3</i><span>Door opened</span></li>
          <li><i>Turn 3</i><span>A new room appears</span></li>
          <li><i>Turn 2</i><span>Orc O1 slain</span></li>
          <li><i>Turn 2</i><span>Note A read</span></li>
          <li><i>Turn 1</i><span>The quest starts</span></li>
        </ul>
        <button class="more">Show all</button>
      </section>
    </aside>`);

  const forThisQuest = `
    <div class="fq">
      <div class="lbl">For this quest</div>
      <button class="nr"><b>B</b><span>A cold draft comes from this door.</span></button>
      <button class="btn alt">Pull the lever beside it</button>
    </div>`;

  function message(title, text, kind, letter) {
    const v = el(`<div class="veil light"><div class="note" role="dialog" aria-label="${title}">
      <div class="hd">${letter ? `<span class="letter">${letter}</span>` : ''}<div>${kind}<h3>${title}</h3></div></div>
      <p>${text}</p><button class="btn">Continue</button></div></div>`);
    app.appendChild(v);
  }

  if (mode === 'sheet') {
    qchip.setAttribute('aria-pressed', 'true');
    app.appendChild(sheet());
  }
  if (mode === 'element') {
    const c = document.getElementById('callout');
    const add = () => { if (!c.hidden && !c.querySelector('.fq')) c.insertAdjacentHTML('beforeend', forThisQuest); };
    add();
    new MutationObserver(add).observe(c, { childList: true });
  }
  if (mode === 'room') {
    const cx = 3, cy = 14;
    const lab = el(`<button class="roomlabel" aria-label="This room has a quest action" style="left:${MAPX + cx * S + S / 2 - 22}px; top:${MAPY + cy * S + S / 2 - 22}px"><span><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 12 L3 2 L12 7 Z" fill="none" stroke="#F4ECDD" stroke-width="1.8" stroke-linejoin="round"/></svg></span></button>`);
    map.appendChild(lab);
    const n = el(`<div class="callout" style="left:${MAPX + (cx + 2) * S}px; top:${MAPY + (cy - 7) * S}px; --ox:0; --oy:20px;">
      <button class="close" aria-label="Close">×</button>
      <div class="kind">Room</div><h3>A hero enters</h3><p>Tap when a hero steps into this room.</p>
      <button class="btn">A hero enters</button>${forThisQuest.replace('A cold draft comes from this door.', 'The air is damp and still.').replace('Pull the lever beside it', 'Everyone has left this room')}
    </div>`);
    map.appendChild(n);
  }
  if (mode === 'message')
    message('Treasure search · Elf', 'The weapons on this rack are chipped, rusted and broken. Nothing here is of use.', 'Note', 'A');
  if (mode === 'start')
    message('Start', 'Place the heroes on the stairs.', 'Quest 1 · The Trial', '');
})();

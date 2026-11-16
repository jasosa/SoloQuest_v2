/* Mockups of the Designer (proposal, nothing here is built). One screen per ?s= value. */
(function () {
  const SCREENS = [
    ['start', '1 Start screen'],
    ['quest', '2 Quest tab'],
    ['monster', '3 Monster of the quest'],
    ['ability', '4 Ability popup'],
    ['spell', '5 Spell popup'],
    ['designer', '6 Designer: enemies'],
  ];
  const s = new URLSearchParams(location.search).get('s') || 'start';
  const esc = (t) => t;

  const tabs = (active, list) =>
    `<div class="top"><span class="ttl">Editor</span>${list
      .map((t) => `<button class="tab" aria-selected="${t === active}">${t}</button>`)
      .join('')}<span class="sp">The Cellar · saved</span></div>`;
  const panel = (title, body, more) =>
    `<section class="panel"><div class="hd">${title}${more ? `<span class="more">${more}</span>` : ''}</div><div class="bd">${body}</div></section>`;
  const fld = (label, inner) => `<label class="fld"><span>${label}</span>${inner}</label>`;
  const input = (v) => `<input class="in" value="${v}">`;
  const select = (v) => `<select class="sel"><option>${v}</option></select>`;
  const tog = (label, on) => `<div class="tog ${on ? 'on' : ''}"><i></i>${label}</div>`;
  const dlg = (title, body, foot) =>
    `<div class="veil"><div class="dlg" role="dialog" aria-label="${title}"><div class="dh"><h2>${title}</h2><button class="btn alt">Close</button></div><div class="db">${body}</div><div class="df">${foot}</div></div></div>`;

  /* ---------- 1 start ---------- */
  const start = () => `
  <div class="em">
    <div class="start">
      <div class="recent">
        <h1>SoloQuest Designer</h1>
        <h2>Recent quests</h2>
        <ul>
          <li><b>The Cellar</b><span>Quest 15 · saved today</span></li>
          <li><b>Quest 12 · Barak Tor (draft of the bundled quest)</b><span>draft · yesterday</span></li>
          <li><b>Goblin Pass</b><span>Quest 16 · 3 days ago</span></li>
        </ul>
        <p class="help" style="margin-top:20px">You can also drop a quest file here to open it.</p>
      </div>
      <div class="cards">
        <button class="card-act"><b>NEW QUEST</b><span>Start an empty quest with its stairs and map.</span></button>
        <button class="card-act"><b>OPEN QUEST</b><span>Load a quest from a file, or one of the 14 bundled quests.</span></button>
        <button class="card-act"><b>DESIGNER</b><span>Abilities, spells, enemies, heroes and companions. Made once, used in any quest.</span></button>
        <button class="card-act off"><b>PACKAGER (later)</b><span>Arrange quests and export a custom campaign.</span></button>
      </div>
    </div>
    <div class="foot"><span>Editor 0.1</span><span>Quest format 1</span><span style="margin-left:auto">Works offline</span></div>
  </div>`;

  /* ---------- 2 quest tab ---------- */
  const questTab = () => `
  <div class="em">
    ${tabs('Quest', ['Quest', 'Map', 'Actions', 'Monsters', 'Designer'])}
    <div class="frame">
      <div class="col">
        ${panel(
          'Actions',
          `<ul class="list">
            <li class="grp">The quest</li>
            <li class="on">Quest starts<span class="sub">Place the heroes…</span></li>
            <li>Zargon turn 3<span class="sub">Reinforcements</span></li>
            <li class="grp">Rooms</li>
            <li>R12 · hero enters</li>
            <li class="grp">Zones</li>
            <li>z1 · hero enters</li>
          </ul>
          <div class="lbtns"><button class="btn">Add action</button></div>`,
        )}
      </div>
      <div class="col">
        ${panel(
          'General',
          `${fld('Title', input('The Cellar'))}
           <div class="row2">${fld('Number', input('15'))}${fld('Start room', select('R20 · the stairs room'))}</div>
           ${fld('Summary', '<textarea class="ta">The King sends the heroes into the old wine cellar…</textarea>')}`,
        )}
        ${panel(
          'Objectives',
          `<ul class="items">
             <li><b>o1 · Find and destroy Verag</b><p>Done when: the monster is slain</p><button class="x">Remove</button></li>
             <li><b>o2 · Bring the heroes back to the stairs</b><p>Button: “All surviving heroes have left by the stairs” · shows once the stairs are seen</p><button class="x">Remove</button></li>
           </ul>
           <div class="addrow"><select class="sel"><option>Add an objective…</option></select><button class="btn">Add</button></div>`,
        )}
      </div>
      <div class="col">
        ${panel('Rules', `${fld('Falling block rule', input('—'))}${tog('Doors are teleporters', false)}`)}
        ${panel('Ending', `${fld('Closing note', '<textarea class="ta">All the gold from the mine was fool’s gold.</textarea>')}<p class="help">Shown after every ending.</p>`)}
      </div>
    </div>
    <div class="note-mock">Mockup: lists on the left, cards in the middle, as in the Imperial Commander editor. Not built.</div>
  </div>`;

  /* shared bits for the monster screen */
  const abilityItems = `
    <ul class="items">
      <li><b>Made of stone</b><p>Rolls 1 extra defend die.</p><button class="x">Remove</button></li>
      <li><b>Fireproof</b><p>Fire spells have no effect on it.</p><button class="x">Remove</button></li>
    </ul>
    <div class="addrow"><select class="sel"><option>Add an ability…</option></select><button class="btn">Add</button><button class="btn alt">New ability…</button></div>`;
  const spellItems = `
    <ul class="items">
      <li><b>Sleep</b><p><span class="tag">strongAdjacent</span><span class="tag">strongInSight</span></p><button class="x">Remove</button>
        <div class="ctl"><select class="sel"><option>Once in the quest</option></select><span class="q">Offered 75% of turns</span><a class="lnk">Edit the spell…</a></div></li>
      <li><b>Escape</b><p><span class="tag">selfNearDeath</span> only when the quest has an escape point</p><button class="x">Remove</button>
        <div class="ctl"><select class="sel"><option>Once in the quest</option></select><a class="lnk">Edit the spell…</a></div></li>
    </ul>
    <div class="addrow"><select class="sel"><option>Add a spell…</option></select><button class="btn">Add</button><button class="btn alt">New spell…</button></div>`;
  const monsterCols = (overlay) => `
  <div class="em">
    ${tabs('Monsters', ['Quest', 'Map', 'Actions', 'Monsters', 'Designer'])}
    <div class="frame">
      <div class="col">
        ${panel(
          'Monsters of this quest',
          `<ul class="list">
            <li>m1 · Orc</li>
            <li>m2 · Goblin<span class="sub">Fireproof</span></li>
            <li class="on">m-grak · Grak <span class="star">★</span></li>
            <li>m-witch · Witch Lord <span class="star">★</span></li>
          </ul>
          <div class="lbtns"><button class="btn">Add</button><button class="btn alt">Remove</button></div>`,
        )}
      </div>
      <div class="col">
        ${panel(
          'Enemy',
          `<div class="row2">${fld('Enemy (from the Designer)', select('Orc'))}${fld('Name in this quest', input('Grak'))}</div>
           ${tog('Special monster: story-critical, drawn with a ring and a star', true)}
           <div class="stat">${['Move', 'Att', 'Def', 'Body', 'Mind'].map((k, i) => fld(k, input(['8', '4', '4', '3', '3'][i]))).join('')}</div>
           <p class="help">Stats start from the enemy and can be changed for this monster only.</p>`,
        )}
        ${panel('Abilities', abilityItems)}
        ${panel('Spells', spellItems)}
      </div>
      <div class="col">
        ${panel(
          'Behavior',
          `${fld('Starts', select('Active'))}${fld('Waits for', select('Nothing'))}${fld('Goes toward', select('The nearest hero'))}${tog('Hidden until an action places it', false)}`,
        )}
        ${panel('Actions on it', `<ul class="list"><li>When it is slain<span class="sub">Cloak</span></li></ul><div class="lbtns"><button class="btn">Add action</button></div>`)}
      </div>
    </div>
    ${overlay || ''}
  </div>`;

  /* ---------- 4 ability popup ---------- */
  const abilityPopup = monsterCols(
    dlg(
      'Ability',
      `${fld('Name', input('Marsh skin'))}
       <div class="row2">${fld('Kind', select('Immunity'))}${fld('Save in', select('The library (every quest)'))}</div>
       ${fld('What it does', '<textarea class="ta">Spells that make mud have no effect on it.</textarea>')}
       <p class="help">In your own words. It shows on the token tooltip, the margin note and Zargon’s order.</p>
       <p class="q">Used by: Grak (m-grak), Gulthor (m-gulthor)</p>`,
      '<button class="btn alt">Delete</button><button class="btn alt">Cancel</button><button class="btn">Save</button>',
    ),
  );

  /* ---------- 5 spell popup ---------- */
  const spellPopup = monsterCols(
    dlg(
      'Spell',
      `<div class="row2">${fld('Name', input('Sleep'))}${fld('Save in', select('The library (every quest)'))}</div>
       ${fld('Card text (optional, your own words)', '<input class="in" value="One hero cannot take actions until it wakes.">')}
       <div class="lbl" style="margin:4px 0 4px">When the monster may cast it</div>
       <ul class="items">
         <li><b>strongAdjacent</b><p class="q">Is a hero with high attack next to it?</p><button class="x">Remove</button></li>
         <li><b>strongInSight</b><p class="q">Is a hero with high attack in sight?</p><button class="x">Remove</button></li>
       </ul>
       <div class="addrow"><select class="sel"><option>Add a situation…</option></select><button class="btn">Add</button></div>
       <p class="help">It fits when any of them is true.</p>
       ${fld('Or one question of your own (replaces the situations)', input('Does a hero in sight carry a metal sword?'))}
       <div class="row2">${fld('Cast limit', select('Once in the quest'))}${fld('Offer only when', select('Always'))}</div>
       ${fld('Warning for the players (optional)', input('Also hits monsters in the room.'))}`,
      '<button class="btn alt">Delete</button><button class="btn alt">Cancel</button><button class="btn">Save</button>',
    ),
  );

  /* ---------- 6 designer ---------- */
  const designer = () => `
  <div class="em">
    ${tabs('Designer', ['Quest', 'Map', 'Actions', 'Monsters', 'Designer'])}
    <div class="frame">
      <div class="col">
        ${panel(
          'Library',
          `<ul class="list">
            <li>Abilities<span class="sub">4 core · 2</span></li>
            <li>Spells<span class="sub">12 core · 1</span></li>
            <li class="on">Enemies<span class="sub">9 core · 3</span></li>
            <li>Heroes<span class="sub">4 core</span></li>
            <li>Companions<span class="sub">1</span></li>
          </ul>`,
        )}
        ${panel(
          'Enemies',
          `<ul class="list">
            <li class="grp">Core</li>
            <li>Goblin</li><li>Orc</li><li>Abomination</li><li>Skeleton</li>
            <li class="grp">Mine</li>
            <li>Marsh Orc</li>
          </ul>
          <div class="lbtns"><button class="btn">New enemy</button><button class="btn alt">Copy</button></div>`,
        )}
      </div>
      <div class="col">
        ${panel(
          'Enemy: Orc',
          `<div class="row2">${fld('Name', input('Orc'))}${fld('Source', select('Core (read only)'))}</div>
           <div class="stat">${['Move', 'Att', 'Def', 'Body', 'Mind'].map((k, i) => fld(k, input(['8', '3', '2', '1', '3'][i]))).join('')}</div>
           ${fld('Hunts', select('The hero it can reach first (core rule)'))}`,
        )}
        ${panel('Abilities', `<ul class="items"></ul><div class="addrow"><select class="sel"><option>Add an ability…</option></select><button class="btn">Add</button><button class="btn alt">New ability…</button></div>`)}
        ${panel('Spells', `<ul class="items"></ul><div class="addrow"><select class="sel"><option>Add a spell…</option></select><button class="btn">Add</button><button class="btn alt">New spell…</button></div>`)}
      </div>
      <div class="col">
        ${panel('Used in', `<ul class="list"><li>Quest 3 · 6 monsters</li><li>Quest 6 · 12 monsters</li><li>The Cellar · 2</li></ul>`)}
        ${panel('Token', `<p class="help">Green coin with the type letter. Custom enemies pick a letter and a code.</p>${fld('Letter', input('O'))}`)}
      </div>
    </div>
    <div class="note-mock">Mockup: the same lists and “Add… / New…” pattern for abilities, spells, heroes and companions. Not built.</div>
  </div>`;

  const screens = { start, quest: questTab, monster: () => monsterCols(''), ability: () => abilityPopup, spell: () => spellPopup, designer };
  document.getElementById('stage').innerHTML = (screens[s] || start)();
  document.getElementById('nav').innerHTML =
    '<b>Mockups: Designer and editors (proposal, nothing here is built).</b>' +
    SCREENS.map(([k, l]) => `<a class="${k === s ? 'on' : ''}" href="?s=${k}">${l}</a>`).join('');
})();

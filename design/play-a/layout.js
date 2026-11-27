/* Board size and place for the team concepts (?team=A|B|C). Loaded before play.js.
   Without ?team the board is the app's: 34 px a square at x 28. */
(function () {
  const team = (new URLSearchParams(location.search).get('team') || '').toUpperCase();
  const cfg = {
    A: { S: 27, mapx: 214 },            // team card at the left of the board, full height
    B: { S: 33, mapx: 50 },             // pull-out drawer: a 44 px tab at the left edge
    C: { S: 32, mapx: 28 },             // team card under the board
    T: { S: 34, mapx: 28 },             // tabs panel (Team, Monsters, Quest info) at the left; board keeps 34 px, moves right
    E: { S: 34, mapx: 28, mapy: 60 },   // team strip (44 px) above the board; the board keeps 34 px and moves down 28 px
    H: { S: 34, mapx: 28 },             // coin stack bottom left, below the board; popover card on demand
    I: { S: 34, mapx: 28 },             // "Someone fell" button in the right column; card on demand
  }[team];
  if (cfg) {
    window.PLAY_LAYOUT = cfg;
    document.documentElement.style.setProperty('--mapx', cfg.mapx + 'px');
    if (cfg.mapy != null) document.documentElement.style.setProperty('--mapy', cfg.mapy + 'px');
  }
  document.documentElement.dataset.team = cfg ? team : '';
})();

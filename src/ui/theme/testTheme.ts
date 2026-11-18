import type { Theme } from './theme';

/** Development only (`?theme=test`): flat colored pictures, to check that the board uses theme images. */
const svg = (fill: string, extra = '') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="68" height="34"><rect width="68" height="34" fill="${fill}"/>${extra}</svg>`,
  )}`;

export const TEST_THEME: Theme = {
  id: 'test',
  name: 'Test',
  floor: [svg('#7d7a74'), svg('#74716b')],
  corridor: [svg('#5f5d58')],
  rock: svg('#1c1a18'),
  wall: svg('#3a2a20'),
  door: {
    closed: svg('#8a5a2b', '<rect x="30" width="8" height="34" fill="#d8b36a"/>'),
    open: svg('#4a3a2a'),
  },
  monster: { goblin: svg('#2e7d32'), orc: svg('#6a1b9a'), skeleton: svg('#eeeeee') },
  block: { single: svg('#2b2b2b'), double: svg('#3b3b3b') },
  trap: { armed: svg('#c9a227'), pit: svg('#101010'), fallingBlock: svg('#554433') },
  furniture: {
    chest: { href: svg('#8a5a2b') },
    table: { href: svg('#a9743a', '<circle cx="8" cy="17" r="6" fill="#fff"/>'), cells: [2, 1] },
  },
};

/** Development only (`?theme=board`): one picture of the whole board, whole monster tokens, stairs that turn. */
const bigSvg = (inner: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="2600" height="1900" viewBox="0 0 2600 1900">${inner}</svg>`,
  )}`;

export const TEST_BOARD_THEME: Theme = {
  id: 'test-board',
  name: 'Test board',
  board: bigSvg(
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9d4e0"/><stop offset="1" stop-color="#8fa3b8"/></linearGradient></defs><rect width="2600" height="1900" fill="url(#g)"/>',
  ),
  door: {
    closed: svg('#8a5a2b'),
    open: svg('#4a3a2a'),
    secret: svg('#7a2a7a'),
  },
  monster: { orc: svg('#6a1b9a'), skeleton: svg('#eeeeee') },
  // orcs are drawn twice as big, to check the pack's scale
  tune: { monster: { orc: { scale: 2 } } },
  block: { single: svg('#2b2b2b'), double: svg('#3b3b3b') },
  trap: { pit: svg('#101010'), spear: svg('#cc2222'), fallingBlock: svg('#554433') },
  furniture: {
    table: { href: svg('#a9743a'), cells: [3, 2] },
    stairs: {
      href: svg('#dddddd', '<rect width="34" height="34" fill="#7a1a2a"/>'),
      corner: 'topLeft',
    },
  },
};

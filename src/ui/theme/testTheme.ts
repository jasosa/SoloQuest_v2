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
  furniture: {
    chest: { href: svg('#8a5a2b') },
    table: { href: svg('#a9743a', '<circle cx="8" cy="17" r="6" fill="#fff"/>'), cells: [2, 1] },
  },
};

/**
 * `npm run overlay -- N [--grid]`: draw quest N on top of its scan.
 *
 * Reads reference/maps/qNN-map.png and src/content/quests/qNN-*.json (if it exists),
 * writes reference/overlays/qNN.png and four quarter crops qNN-zoom-{nw,ne,sw,se}.png at 100%.
 * `npm run overlay -- fh N [--grid]` does the same for Frozen Horror quest N (0 to 8): fhNN-map.png,
 * fhNN-*.json, fhNN.png (calibration in fh-maps.ts).
 * `--grid` also draws the cell coordinates (use it to read the scan before the JSON exists).
 * reference/ is git-ignored.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { board } from '../../src/engine/board/board';
import { parseQuest } from '../../src/engine/quest/loader';
import type { Quest } from '../../src/engine/quest/schema';
import { fhCalibration } from './fh-maps';
import { buildOverlaySvg, DEFAULT_CALIBRATION } from './overlay-svg';

const pad = (n: number) => String(n).padStart(2, '0');

function loadQuest(n: number, prefix: string): Quest | undefined {
  const dir = resolve('src', 'content', 'quests');
  if (!existsSync(dir)) return undefined;
  const file = readdirSync(dir).find(
    (f) => f.startsWith(`${prefix}${pad(n)}-`) && f.endsWith('.json'),
  );
  if (!file) return undefined;
  return parseQuest(JSON.parse(readFileSync(join(dir, file), 'utf8')));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const grid = args.includes('--grid');
  const fh = args[0] === 'fh';
  const prefix = fh ? 'fh' : 'q';
  const n = Number(args.find((a) => /^\d+$/.test(a)));
  const [lo, hi] = fh ? [0, 8] : [1, 14];
  if (!Number.isInteger(n) || n < lo || n > hi) {
    console.error(
      fh
        ? 'usage: npm run overlay -- fh N [--grid]   (N from 0 to 8)'
        : 'usage: npm run overlay -- N [--grid]   (N from 1 to 14)',
    );
    process.exit(1);
  }
  const scan = resolve('reference', 'maps', `${prefix}${pad(n)}-map.png`);
  if (!existsSync(scan)) {
    console.error(`Missing ${scan}. Run: npm run render:maps -- ${fh ? 'fh ' : ''}${n}`);
    process.exit(1);
  }
  const quest = loadQuest(n, prefix);
  if (!quest) console.log(`no quest file for ${n}: drawing the scan, board walls and grid only`);
  const cal = fh ? fhCalibration(n) : DEFAULT_CALIBRATION;
  const href = `data:image/png;base64,${readFileSync(scan).toString('base64')}`;
  const svg = buildOverlaySvg(board, quest, cal, { scanHref: href, grid: grid || !quest });

  const outDir = resolve('reference', 'overlays');
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: cal.width, height: cal.height } });
    await page.setContent(`<body style="margin:0">${svg}</body>`);
    const base = join(outDir, `${prefix}${pad(n)}`);
    await page.screenshot({ path: `${base}.png` });
    const hw = cal.width / 2;
    const hh = cal.height / 2;
    const quarters = {
      nw: { x: 0, y: 0 },
      ne: { x: hw, y: 0 },
      sw: { x: 0, y: hh },
      se: { x: hw, y: hh },
    };
    for (const [name, o] of Object.entries(quarters))
      await page.screenshot({
        path: `${base}-zoom-${name}.png`,
        clip: { x: o.x, y: o.y, width: hw, height: hh },
      });
    console.log(`overlay: ${base}.png and ${base}-zoom-{nw,ne,sw,se}.png`);
  } finally {
    await browser.close();
  }
}

void main();

/**
 * Render the Frozen Horror quest maps: `npm run render:maps -- fh [N ...]` (N from 0 to 10, all when
 * left out). Writes reference/maps/fhNN.png (the whole page, upright, 300 dpi) and fhNN-map.png
 * (the crop around the board). reference/ is git-ignored (copyrighted material).
 * Needs Poppler (`pdftoppm`) and Playwright's Chromium (it does the turn and crop).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { FH_MAPS, FH_QUESTS, fhCrop, uprightSize, uprightTransform } from './fh-maps';
import { DPI, pad } from './render-maps';

const DIR = 'C:/Users/Juanan/Documents/Games/Heroquest/01_Rules/Official/';
export const FH_PDFS = {
  book: `${DIR}F5815_en-us_avalon-hill-hero-quest-the-frozen-horror-quest-pack-for-ages-14-and-up-requires-hero-quest-game-system-to-play-instruction.pdf`,
  prelude: `${DIR}HeroQuest-online_quest_2_-_Into_The_Northlands.pdf`,
} as const;

export function fhPdftoppmArgs(pdf: string, page: number, outBase: string): string[] {
  const p = String(page);
  return ['-r', String(DPI), '-f', p, '-l', p, '-png', '-singlefile', pdf, outBase];
}

/** Width and height from the header of a PNG file. */
export function pngSize(buf: Buffer): [number, number] {
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

export const allFhQuests = (): number[] => [...FH_QUESTS];

export async function renderFh(quests: number[]): Promise<void> {
  const out = resolve('reference', 'maps');
  mkdirSync(out, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'fh-render-'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const q of quests) {
      const m = FH_MAPS[q];
      if (!m) throw new Error(`no Frozen Horror map for quest ${q}`);
      const pdf =
        (m.source === 'book' ? process.env.FH_BOOK_PDF : process.env.FH_PRELUDE_PDF) ??
        FH_PDFS[m.source];
      if (!existsSync(pdf)) {
        console.error(`PDF not found: ${pdf}\nSet FH_BOOK_PDF or FH_PRELUDE_PDF to its path.`);
        process.exit(1);
      }
      const raw = join(tmp, `raw${q}`);
      try {
        execFileSync('pdftoppm', fhPdftoppmArgs(pdf, m.page, raw), { stdio: 'ignore' });
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        console.error(
          code === 'ENOENT'
            ? 'pdftoppm not found. Install Poppler: winget install oschwartz10612.Poppler (or scoop install poppler).'
            : `pdftoppm failed for quest ${q}.`,
        );
        process.exit(1);
      }
      const bytes = readFileSync(`${raw}.png`);
      const [rawW, rawH] = pngSize(bytes);
      const [upW, upH] = uprightSize(m.rotation, rawW, rawH);
      const crop = fhCrop(q);
      const jobs = [
        { w: upW, h: upH, t: uprightTransform(m.rotation, rawW, rawH, { x: 0, y: 0 }) },
        { w: crop.w, h: crop.h, t: uprightTransform(m.rotation, rawW, rawH, crop) },
      ];
      const href = `data:image/png;base64,${bytes.toString('base64')}`;
      const [full, map] = await page.evaluate(
        async ({ href, jobs }) => {
          const img = new Image();
          img.src = href;
          await img.decode();
          return jobs.map((j) => {
            const cv = document.createElement('canvas');
            cv.width = j.w;
            cv.height = j.h;
            const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
            ctx.setTransform(j.t[0], j.t[1], j.t[2], j.t[3], j.t[4], j.t[5]);
            ctx.drawImage(img, 0, 0);
            return cv.toDataURL('image/png').split(',')[1] ?? '';
          });
        },
        { href, jobs },
      );
      const base = join(out, `fh${pad(q)}`);
      writeFileSync(`${base}.png`, Buffer.from(full ?? '', 'base64'));
      writeFileSync(`${base}-map.png`, Buffer.from(map ?? '', 'base64'));
      console.log(`fh quest ${q}: ${base}.png, ${base}-map.png`);
    }
  } finally {
    await browser.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

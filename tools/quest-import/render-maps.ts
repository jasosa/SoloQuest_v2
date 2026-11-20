/**
 * Render Quest Book map pages to reference/maps (git-ignored, copyrighted material).
 * Needs Poppler (`pdftoppm` on PATH). Quest N is on PDF page N + 2.
 *
 *   npm run render:maps            all 14 quests
 *   npm run render:maps -- 3 5     only quests 3 and 5
 *   npm run render:maps -- fh [N]  Frozen Horror quests 0 to 10 (see fh-render.ts)
 *
 * Writes reference/maps/qNN.png (full page, 300 dpi) and qNN-map.png (crop of the map frame).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const DPI = 300;
/** Map frame on a 150 dpi page render (see docs/QUEST_ENCODING.md). */
const FRAME_150 = { x: 200, y: 120, w: 1110, h: 800 };
const scale = DPI / 150;
export const FRAME = {
  x: FRAME_150.x * scale,
  y: FRAME_150.y * scale,
  w: FRAME_150.w * scale,
  h: FRAME_150.h * scale,
};

export const DEFAULT_PDF =
  'C:/Users/Juanan/Documents/Games/Heroquest/01_Rules/Official/HEROQUEST_CORE_QUEST_BOOK.pdf';

export const pageOf = (quest: number): number => quest + 2;
export const pad = (n: number): string => String(n).padStart(2, '0');

/** pdftoppm arguments for one page. `crop` adds the map frame crop. */
export function pdftoppmArgs(pdf: string, quest: number, outBase: string, crop: boolean): string[] {
  const page = String(pageOf(quest));
  const args = ['-r', String(DPI), '-f', page, '-l', page, '-png', '-singlefile'];
  if (crop)
    args.push(
      '-x',
      String(FRAME.x),
      '-y',
      String(FRAME.y),
      '-W',
      String(FRAME.w),
      '-H',
      String(FRAME.h),
    );
  return [...args, pdf, outBase];
}

/** Frozen Horror mode: the first argument is `fh`. Returns the quest numbers, or undefined. */
export function parseFhArgs(args: string[]): number[] | undefined {
  if (args[0] !== 'fh') return undefined;
  const nums = args.slice(1).map(Number);
  if (nums.some((q) => !Number.isInteger(q) || q < 0 || q > 10)) {
    console.error('Frozen Horror quest numbers go from 0 to 10.');
    process.exit(1);
  }
  return nums.length ? nums : Array.from({ length: 11 }, (_, i) => i);
}

async function main(): Promise<void> {
  const fh = parseFhArgs(process.argv.slice(2));
  if (fh) {
    const { renderFh } = await import('./fh-render');
    await renderFh(fh);
    return;
  }
  const pdf = process.env.QUEST_BOOK_PDF ?? DEFAULT_PDF;
  if (!existsSync(pdf)) {
    console.error(`Quest Book PDF not found: ${pdf}\nSet QUEST_BOOK_PDF to its path.`);
    process.exit(1);
  }
  const wanted = process.argv.slice(2).map(Number);
  const quests = wanted.length ? wanted : Array.from({ length: 14 }, (_, i) => i + 1);
  if (quests.some((q) => !Number.isInteger(q) || q < 1 || q > 14)) {
    console.error('Quest numbers go from 1 to 14.');
    process.exit(1);
  }
  const out = resolve('reference', 'maps');
  mkdirSync(out, { recursive: true });
  for (const q of quests) {
    const base = join(out, `q${pad(q)}`);
    try {
      execFileSync('pdftoppm', pdftoppmArgs(pdf, q, base, false), { stdio: 'inherit' });
      execFileSync('pdftoppm', pdftoppmArgs(pdf, q, `${base}-map`, true), { stdio: 'inherit' });
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      console.error(
        code === 'ENOENT'
          ? 'pdftoppm not found. Install Poppler: winget install oschwartz10612.Poppler (or scoop install poppler).'
          : `pdftoppm failed for quest ${q}.`,
      );
      process.exit(1);
    }
    console.log(`quest ${q}: ${base}.png, ${base}-map.png`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'render-maps.ts'))
  void main();

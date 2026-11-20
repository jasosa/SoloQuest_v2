import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { ART_FOLDER, ART_MANIFESTS } from '../src/ui/theme/boxArt';
import {
  manifestFiles,
  readPack,
  writePack,
  type PackFile,
  type StoredPack,
} from '../src/ui/theme/pack';

/**
 * `npm run build:pack -- frozen-horror`: writes the built-in art layer of a box as an importable
 * `.sqtextures` file into `dist-packs/` (git-ignored). It zips the same manifest and the same pictures
 * the app uses, so the file and the built-in layer cannot drift apart.
 */

const mimeOf = (name: string) =>
  name.endsWith('.webp') ? 'image/webp' : /\.jpe?g$/.test(name) ? 'image/jpeg' : 'image/png';

/** The pack of a box, with its pictures read by `read` (a path under `public/`). */
export function packOfBox(box: string, read: (path: string) => Uint8Array): StoredPack {
  const manifest = ART_MANIFESTS[box];
  const folder = ART_FOLDER[box];
  if (!manifest || folder === undefined) throw new Error(`No art layer for "${box}".`);
  const files: Record<string, PackFile> = {};
  for (const name of manifestFiles(manifest))
    files[name] = { mime: mimeOf(name), bytes: read(`${folder}${name}`) };
  return { manifest, files };
}

export function main(argv: string[]): void {
  const box = argv[0];
  if (!box)
    throw new Error(`Usage: npm run build:pack -- <${Object.keys(ART_MANIFESTS).join('|')}>`);
  const pub = resolve('public');
  const pack = packOfBox(box, (p) => readFileSync(join(pub, p)));
  const bytes = writePack(pack);
  // read it back the way the app does, so a broken file is never written
  const check = readPack(bytes);
  if (!check.ok) throw new Error(check.message);
  mkdirSync('dist-packs', { recursive: true });
  const out = join('dist-packs', `${box}.sqtextures`);
  writeFileSync(out, bytes);
  console.log(
    `${out}: ${Object.keys(pack.files).length} pictures, ${(bytes.length / 1024).toFixed(0)} KB`,
  );
}

if (process.argv[1]?.split(sep).join('/').endsWith('tools/build-pack.ts'))
  main(process.argv.slice(2));

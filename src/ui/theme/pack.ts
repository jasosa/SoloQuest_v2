import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';
import { FURNITURE_TYPES, MONSTER_TYPES, TRAP_KINDS } from '../../engine/quest/schema';
import { CORNERS, type Theme } from './theme';

/**
 * The texture pack file (decision 78): `.sqtextures`, a zip with `theme.json` and the pictures it
 * names (png, webp or jpeg). Reading never throws: a bad file gives a sentence for the person.
 * Pure code (no DOM), so it is tested without a browser.
 */

export const PACK_EXTENSION = '.sqtextures';
/** The most a pack may hold after unzipping (decision 78: about 10 MB). */
export const PACK_MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 300;
const MANIFEST_MAX_BYTES = 64 * 1024;

/** A file name inside the zip: plain relative path, no `..`, no leading slash. */
const FileName = z
  .string()
  .min(1)
  .max(120)
  .refine((n) => !n.startsWith('/') && !n.includes('\\') && !n.split('/').includes('..'), {
    message: 'unsafe file name',
  })
  .refine((n) => /\.(png|webp|jpe?g)$/i.test(n), {
    message: 'a picture must be png, webp or jpeg',
  });

const Files = z.array(FileName).min(1).max(40);

export const PackManifestSchema = z
  .object({
    format: z.literal('sqtextures'),
    version: z.literal(1),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, 'use lowercase letters, digits and dashes'),
    name: z.string().trim().min(1).max(60),
    origin: z.enum(['official', 'fan']).default('fan'),
    author: z.string().max(80).optional(),
    board: FileName.optional(),
    floor: Files.optional(),
    corridor: Files.optional(),
    rock: FileName.optional(),
    wall: FileName.optional(),
    door: z
      .object({
        closed: FileName.optional(),
        open: FileName.optional(),
        secret: FileName.optional(),
      })
      .optional(),
    block: z.object({ single: FileName.optional(), double: FileName.optional() }).optional(),
    trap: z.partialRecord(z.enum(['armed', ...TRAP_KINDS]), FileName).optional(),
    monster: z.partialRecord(z.enum(MONSTER_TYPES), FileName).optional(),
    furniture: z
      .partialRecord(
        z.enum(FURNITURE_TYPES),
        z.object({
          file: FileName,
          corner: z.enum(CORNERS).optional(),
          cells: z
            .tuple([z.number().int().min(1).max(6), z.number().int().min(1).max(6)])
            .optional(),
        }),
      )
      .optional(),
  })
  .strict();
export type PackManifest = z.infer<typeof PackManifestSchema>;

export interface PackFile {
  readonly mime: string;
  readonly bytes: Uint8Array;
}

/** A pack as kept on the device: the manifest and the picture files. */
export interface StoredPack {
  readonly manifest: PackManifest;
  readonly files: Readonly<Record<string, PackFile>>;
}

export type PackResult = { ok: true; pack: StoredPack } | { ok: false; message: string };

function mimeOf(name: string, b: Uint8Array): string | undefined {
  const ext = name.toLowerCase().split('.').pop();
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const webp =
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45;
  if (ext === 'png' && png) return 'image/png';
  if ((ext === 'jpg' || ext === 'jpeg') && jpeg) return 'image/jpeg';
  if (ext === 'webp' && webp) return 'image/webp';
  return undefined;
}

/** Every picture file a manifest names. */
export function manifestFiles(m: PackManifest): string[] {
  const out: (string | undefined)[] = [
    m.board,
    ...(m.floor ?? []),
    ...(m.corridor ?? []),
    m.rock,
    m.wall,
    m.door?.closed,
    m.door?.open,
    m.door?.secret,
    m.block?.single,
    m.block?.double,
    ...Object.values(m.trap ?? {}),
    ...Object.values(m.monster ?? {}),
    ...Object.values(m.furniture ?? {}).map((f) => f?.file),
  ];
  return [...new Set(out.filter((n): n is string => n !== undefined))];
}

export function readPack(data: Uint8Array): PackResult {
  let entries: Record<string, Uint8Array>;
  let total = 0;
  let count = 0;
  try {
    entries = unzipSync(data, {
      // refuse before unzipping: too many files or too big (a zip bomb)
      filter: (f) => {
        count += 1;
        total += f.originalSize;
        if (count > MAX_FILES) throw new Error('too many files');
        if (total > PACK_MAX_BYTES) throw new Error('too big');
        return true;
      },
    });
  } catch (e) {
    const why = (e as Error).message;
    if (why === 'too big')
      return { ok: false, message: 'This texture pack is bigger than 10 MB when unzipped.' };
    if (why === 'too many files')
      return { ok: false, message: 'This texture pack has too many files.' };
    return { ok: false, message: 'This file is not a texture pack (it is not a zip file).' };
  }
  const raw = entries['theme.json'];
  if (!raw) return { ok: false, message: 'This texture pack has no theme.json.' };
  if (raw.length > MANIFEST_MAX_BYTES)
    return { ok: false, message: 'The theme.json of this texture pack is too big.' };
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    return { ok: false, message: 'The theme.json of this texture pack is not valid JSON.' };
  }
  const parsed = PackManifestSchema.safeParse(json);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return {
      ok: false,
      message: `The theme.json is not right: ${i?.path.join('.') || 'file'}: ${i?.message ?? 'invalid'}.`,
    };
  }
  const manifest = parsed.data;
  const files: Record<string, PackFile> = {};
  for (const name of manifestFiles(manifest)) {
    const bytes = entries[name];
    if (!bytes) return { ok: false, message: `The picture ${name} is missing from the pack.` };
    const mime = mimeOf(name, bytes);
    if (!mime)
      return { ok: false, message: `The file ${name} is not a real png, webp or jpeg picture.` };
    files[name] = { mime, bytes };
  }
  return { ok: true, pack: { manifest, files } };
}

/** The pack as a file to save. Pictures are already compressed, so they are stored as they are. */
export function writePack(pack: StoredPack): Uint8Array {
  const out: Parameters<typeof zipSync>[0] = {
    'theme.json': strToU8(JSON.stringify(pack.manifest, null, 2)),
  };
  for (const [name, f] of Object.entries(pack.files)) out[name] = [f.bytes, { level: 0 }];
  return zipSync(out);
}

/** A theme from a pack. `url` turns a file name into something an `<image>` can load. */
export function themeFromPack(pack: StoredPack, url: (file: string) => string): Theme {
  const m = pack.manifest;
  const some = <T extends object>(o: T): T | undefined => (Object.keys(o).length ? o : undefined);
  // each group keeps only the slots the pack fills, so an empty group is left out
  const pick = <K extends string>(src: Partial<Record<K, string | undefined>> | undefined) =>
    Object.fromEntries(
      Object.entries(src ?? {}).flatMap(([k, f]) => (typeof f === 'string' ? [[k, url(f)]] : [])),
    ) as Partial<Record<K, string>>;
  const board = m.board ? url(m.board) : undefined;
  const rock = m.rock ? url(m.rock) : undefined;
  const wall = m.wall ? url(m.wall) : undefined;
  const door = some(pick(m.door));
  const block = some(pick(m.block));
  const trap = some(pick(m.trap));
  const monster = some(pick(m.monster));
  const furniture = some(
    Object.fromEntries(
      Object.entries(m.furniture ?? {}).map(([t, f]) => [
        t,
        {
          href: url(f.file),
          ...(f.cells ? { cells: f.cells } : {}),
          ...(f.corner ? { corner: f.corner } : {}),
        },
      ]),
    ),
  );
  return {
    id: m.id,
    name: m.name,
    ...(board ? { board } : {}),
    ...(m.floor ? { floor: m.floor.map(url) } : {}),
    ...(m.corridor ? { corridor: m.corridor.map(url) } : {}),
    ...(rock ? { rock } : {}),
    ...(wall ? { wall } : {}),
    ...(door ? { door } : {}),
    ...(block ? { block } : {}),
    ...(trap ? { trap } : {}),
    ...(monster ? { monster } : {}),
    ...(furniture ? { furniture } : {}),
  };
}

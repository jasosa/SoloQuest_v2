import { MAX_IMAGE_CHARS } from '../../engine/data/enemies';

/** Pictures are shrunk to a square this big: enough for a token and a roster coin. */
const SIZE = 128;

/**
 * Read a picture file and return a small square data URL (webp, else jpeg) under the size limit,
 * or an error message. Uses the browser canvas, so it lives in the UI.
 */
export async function shrinkImage(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!file.type.startsWith('image/')) return { ok: false, message: 'That file is not a picture.' };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, message: 'That picture could not be read.' };
  }
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: false, message: 'Pictures cannot be used on this device.' };
  // Centered square crop.
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  bitmap.close();
  for (const [type, q] of [
    ['image/webp', 0.85],
    ['image/jpeg', 0.8],
    ['image/jpeg', 0.5],
  ] as const) {
    const url = canvas.toDataURL(type, q);
    if (url.startsWith(`data:${type}`) && url.length <= MAX_IMAGE_CHARS) return { ok: true, url };
  }
  return { ok: false, message: 'That picture is too big even after shrinking.' };
}

/** Where the quest-note letters go on the editor board. Pure: read from the quest only. */
import type { Quest } from '../../engine/quest/schema';

export interface EditorLetter {
  readonly letter: string;
  readonly at: readonly [number, number];
  /** The note of this letter, or undefined when the letter is on the map but has no note yet. */
  readonly note?: string;
  /** The letter sits on its furniture or marker (no note square), so the mark is drawn in a corner. */
  readonly onThing?: boolean;
}

/**
 * One mark per lettered note, at its `at` square, else at the furniture or marker that carries
 * the letter. A letter on the map with no note is listed without `note` (drawn as missing).
 * Unlettered notes give nothing.
 */
export function editorLetters(q: Quest): EditorLetter[] {
  const where = new Map<string, readonly [number, number]>();
  for (const f of q.furniture) {
    const c = f.cells[0];
    if (f.letter && c && !where.has(f.letter)) where.set(f.letter, [c[0], c[1]]);
  }
  for (const m of q.markers)
    if (/^[A-WYZ]$/.test(m.label) && !where.has(m.label))
      where.set(m.label, [m.cell[0], m.cell[1]]);

  const out: EditorLetter[] = [];
  const noted = new Set<string>();
  for (const n of q.notes) {
    if (!n.letter) continue;
    noted.add(n.letter);
    const at = n.at ?? where.get(n.letter);
    if (at)
      out.push({
        letter: n.letter,
        at: [at[0], at[1]],
        note: n.id,
        ...(n.at ? {} : { onThing: true }),
      });
  }
  for (const [letter, at] of where) if (!noted.has(letter)) out.push({ letter, at, onThing: true });
  return out.sort((a, b) => a.letter.localeCompare(b.letter));
}

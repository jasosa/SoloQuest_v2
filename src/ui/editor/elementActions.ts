/**
 * The element a selection stands for in action targets (decision 68). Pure, no React.
 */
import type { NoteTarget, Quest } from '../../engine/quest/schema';
import type { EditSelection } from './editorStore';

/** The element a selection stands for in note targets. A marker is its square. */
export function elementOf(q: Quest, sel: EditSelection): NoteTarget | undefined {
  if (!sel || sel.kind === 'block' || sel.kind === 'tile' || sel.kind === 'roomTile')
    return undefined;
  if (sel.kind === 'tunnel') return undefined;
  if (sel.kind === 'marker') {
    const m = q.markers.find((x) => x.id === sel.id);
    return m ? { kind: 'square', id: `${m.cell[0]},${m.cell[1]}` } : undefined;
  }
  return { kind: sel.kind, id: sel.id };
}

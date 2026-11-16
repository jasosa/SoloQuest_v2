/** Actions on the selected element, shared by the keyboard shortcuts and the inspector. */
import {
  removeBlock,
  removeDoor,
  removeFurniture,
  removeMarker,
  removeMonster,
  removeTrap,
  removeZone,
  rotateFurniture,
} from '../../engine/editor';
import type { EditorStore } from './editorStore';

export function rotateSelection(store: EditorStore) {
  const st = store.getState();
  if (st.selection?.kind === 'furniture') {
    const id = st.selection.id;
    st.apply((q) => rotateFurniture(q, id));
  } else if (st.tool === 'furniture') st.setOpts({ furnitureTurned: !st.opts.furnitureTurned });
}

export function deleteSelection(store: EditorStore) {
  const st = store.getState();
  const sel = st.selection;
  if (!sel) return;
  const ok = st.apply((q) => {
    switch (sel.kind) {
      case 'door':
        return removeDoor(q, sel.id);
      case 'block':
        return removeBlock(q, sel.cell);
      case 'furniture':
        return removeFurniture(q, sel.id);
      case 'monster':
        return removeMonster(q, sel.id);
      case 'trap':
        return removeTrap(q, sel.id);
      case 'marker':
        return removeMarker(q, sel.id);
      case 'zone':
        return removeZone(q, sel.id);
    }
  });
  if (ok) st.select(null);
}

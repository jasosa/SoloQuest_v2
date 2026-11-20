/** Actions on the selected element, shared by the keyboard shortcuts and the inspector. */
import {
  removeBlock,
  removeBoardTile,
  removeEdgeDoor,
  removeTunnel,
  removeRoomTile,
  rotateBoardTile,
  rotateRoomTile,
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
  } else if (st.selection?.kind === 'tile') {
    const index = st.selection.index;
    st.apply((q) => rotateBoardTile(q, index));
  } else if (st.selection?.kind === 'roomTile') {
    const index = st.selection.index;
    st.apply((q) => rotateRoomTile(q, index));
  } else if (st.tool === 'furniture') st.setOpts({ furnitureTurned: !st.opts.furnitureTurned });
  else if (st.tool === 'tiles') st.setOpts({ tileTurned: !st.opts.tileTurned });
}

export function deleteSelection(store: EditorStore) {
  const st = store.getState();
  const sel = st.selection;
  if (!sel) return;
  const ok = st.apply((q) => {
    switch (sel.kind) {
      case 'door':
        return q.edgeDoors.some((e) => e.id === sel.id)
          ? removeEdgeDoor(q, sel.id)
          : removeDoor(q, sel.id);
      case 'tile':
        return removeBoardTile(q, sel.index);
      case 'roomTile':
        return removeRoomTile(q, sel.index);
      case 'tunnel':
        return removeTunnel(q, sel.id);
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

import { useRef } from 'react';
import { useModal } from '../shared/useModal';
import { useStore } from 'zustand';
import type { EditorStore } from './editorStore';
import { ActionForm } from './NotesPanel';

/**
 * The action popup (decision 68): the whole action in one dialog over the editor, opened by a
 * row of the Actions tab, by "Add action" or by a letter on the board. While the author picks a
 * square, a door or a room on the board the dialog steps aside and a small bar says what to click.
 */
export function ActionDialog({ store }: { store: EditorStore }) {
  const { quest, noteId, picking, tab } = useStore(store);
  const st = store.getState();
  const box = useRef<HTMLDivElement>(null);
  const note = noteId ? quest.notes.find((n) => n.id === noteId) : undefined;

  useModal(box, {
    active: Boolean(note && !picking && tab !== 'Actions'),
    onEscape: () => st.setNoteId(null),
    focus: 'title',
  });

  if (picking)
    return (
      <div className="ed-pickfloat" role="status" data-testid="pick-bar">
        <span>{picking.hint}</span>
        <button className="btn alt" onClick={() => st.setPicking(null)}>
          Cancel
        </button>
      </div>
    );
  // the Actions tab shows the action beside its list instead
  if (!note || tab === 'Actions') return null;

  return (
    <div className="ed-veil">
      <div className="ed-dialog" ref={box} role="dialog" aria-modal="true" aria-label="Action">
        <div className="ed-dialog-hd">
          <h2>Action</h2>
          <button className="btn alt" onClick={() => st.setNoteId(null)}>
            Close
          </button>
        </div>
        <div className="ed-dialog-body">
          <ActionForm key={note.id} store={store} note={note} quest={quest} />
        </div>
      </div>
    </div>
  );
}

import { useRef } from 'react';
import { useModal } from '../shared/useModal';
import { useStore } from 'zustand';
import type { EditorStore } from './editorStore';
import { ActionCard } from './ActionCard';
import { t } from '../../i18n/t';

/**
 * The action popup (decision 68): the whole action in one dialog over the editor, opened by a
 * row of the Actions tab, by "Add action" or by a letter on the board. While the author picks a
 * square, a door or a room on the board the dialog steps aside and a small bar says what to click.
 */
export function ActionDialog({ store }: { store: EditorStore }) {
  const { noteDraft, picking, tab } = useStore(store);
  const st = store.getState();
  const box = useRef<HTMLDivElement>(null);
  const note = noteDraft?.note;

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
          {t('editor.ActionDialog.cancel', 'Cancel')}
        </button>
      </div>
    );
  // the Actions tab shows the action beside its list instead
  if (!note || tab === 'Actions') return null;

  return (
    <div className="ed-veil">
      <div
        className="ed-dialog ed-actiondialog"
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={t('editor.ActionDialog.action', 'Action')}
      >
        <ActionCard store={store} popup />
      </div>
    </div>
  );
}

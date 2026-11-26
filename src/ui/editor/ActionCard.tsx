import { useStore } from 'zustand';
import { removeNote } from '../../engine/editor';
import { DetailCard } from '../shared/Frame';
import { actionKind, subjectOf } from './actionSubjects';
import type { EditorStore } from './editorStore';
import { ActionForm } from './NotesPanel';
import { isDirty, withDraft } from './noteDraft';
import { triggerSummary } from './noteForms';
import { t } from '../../i18n/t';

/** What the action is about, for the small label of the card. */
function aboutLabel(kind: string): string {
  if (kind === 'Moment') return t('editor.ActionCard.atAMoment', 'at a moment of the quest');
  if (kind === 'Place') return t('editor.ActionCard.onAPlace', 'on a place');
  return t('editor.ActionCard.onAnElement', 'on an element');
}

/**
 * The action being edited (owner decision, 2026-11-26): a detail card with the form of its draft.
 * "Save action" writes the draft into the quest as one undo step, "Cancel" drops it. The card is the
 * right side of the Actions tab (it stays open on the saved action) and the body of the action popup
 * on the other tabs (it closes).
 */
export function ActionCard({ store, popup }: { store: EditorStore; popup?: boolean }) {
  const { quest, noteDraft } = useStore(store);
  const st = store.getState();
  if (!noteDraft) return null;
  const note = noteDraft.note;
  const dirty = isDirty(quest, noteDraft);
  return (
    <DetailCard
      testId="action-card"
      label={`${t('editor.ActionCard.action', 'Action')} · ${aboutLabel(actionKind(subjectOf(note)))}`}
      title={triggerSummary(note.trigger)}
      foot={
        <>
          <button className="btn" onClick={() => st.saveNote(!popup)}>
            {t('editor.ActionCard.saveAction', 'Save action')}
          </button>
          <button className="btn alt" onClick={() => st.setNoteId(null)}>
            {t('editor.ActionCard.cancel', 'Cancel')}
          </button>
          {!noteDraft.isNew && (
            <button
              className="btn alt fr-push"
              onClick={() => {
                if (st.apply((q) => removeNote(q, note.id))) st.setNoteId(null);
              }}
            >
              {t('editor.ActionCard.deleteAction', 'Delete action')}
            </button>
          )}
        </>
      }
    >
      {dirty && (
        <p className="ed-note" data-testid="draft-note">
          {t('editor.ActionCard.notSavedYet', 'Not saved yet.')}
        </p>
      )}
      <ActionForm key={note.id} store={store} note={note} quest={withDraft(quest, noteDraft)} />
    </DetailCard>
  );
}

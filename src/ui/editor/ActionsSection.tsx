import { useStore } from 'zustand';
import { notesOf } from '../../engine/quest/targets';
import { addAction } from './addAction';
import { subjectOf, type Subject } from './actionSubjects';
import type { EditorStore } from './editorStore';
import { mainText, triggerSummary } from './noteForms';
import { t } from '../../i18n/t';

/**
 * The Actions section of the inspector (decision 68): the actions of one subject (the selected
 * element, or the quest itself) and one **Add action** button. The button opens the action popup
 * with the subject already chosen; the popup offers the triggers that fit it.
 */
export function SubjectActions({ store, subject }: { store: EditorStore; subject: Subject }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const notes =
    subject.kind === 'quest'
      ? quest.notes.filter((n) => subjectOf(n).kind === 'quest')
      : notesOf(quest.notes, subject.kind, subject.id);

  return (
    <section data-testid="element-actions">
      <div className="lbl">{t('editor.ActionsSection.actions', 'Actions')}</div>
      {notes.length === 0 ? (
        <p className="ed-note">
          {t('editor.ActionsSection.noActionHereYet', 'No action here yet.')}
        </p>
      ) : (
        <ul className="ed-notelist" data-testid="action-list">
          {notes.map((n) => (
            <li key={n.id}>
              <button onClick={() => st.setNoteId(n.id)}>
                <b>{n.letter ?? '·'}</b>
                <span>{triggerSummary(n.trigger)}</span>
                <i>{mainText(n)}</i>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn" onClick={() => addAction(store, subject)}>
        {t('editor.ActionsSection.addAction', 'Add action')}
      </button>
    </section>
  );
}

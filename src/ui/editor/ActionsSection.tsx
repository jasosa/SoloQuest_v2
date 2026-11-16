import { useStore } from 'zustand';
import { addNote } from '../../engine/editor';
import { actionTemplates, actionsOf } from './elementActions';
import type { EditorStore, EditSelection } from './editorStore';
import { mainText, triggerSummary } from './noteForms';

/**
 * The Actions section of the inspector (decision 67): the notes that belong to the selected
 * element, and chips to add one with its trigger and target already filled in. An action is a
 * normal note; a tap on a row or a new action opens it in the Notes tab.
 */
export function ElementActions({
  store,
  selection,
}: {
  store: EditorStore;
  selection: NonNullable<EditSelection>;
}) {
  const { quest } = useStore(store);
  const st = store.getState();
  const notes = actionsOf(quest, selection);
  const templates = actionTemplates(quest, selection);
  if (notes.length === 0 && templates.length === 0) return null;

  const open = (id: string) => {
    st.setNoteId(id);
    st.setPanel('notes');
  };

  return (
    <section data-testid="element-actions">
      <div className="lbl">Actions</div>
      {notes.length === 0 ? (
        <p className="ed-note">No action on this element yet.</p>
      ) : (
        <ul className="ed-notelist" data-testid="action-list">
          {notes.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n.id)}>
                <b>{n.letter ?? '·'}</b>
                <span>{triggerSummary(n.trigger)}</span>
                <i>{mainText(n)}</i>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="ed-chips" role="group" aria-label="Add an action">
        {templates.map((t) => (
          <button
            key={t.key}
            className="chip"
            onClick={() => {
              const ok = st.apply((q) =>
                addNote(q, {
                  trigger: t.trigger,
                  ...(t.target ? { target: t.target } : {}),
                  effects: [{ type: 'showText', text: 'Write the text here.' }],
                }),
              );
              if (!ok) return;
              const q = store.getState().quest;
              const made = q.notes[q.notes.length - 1];
              if (made) open(made.id);
            }}
          >
            Add: {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}

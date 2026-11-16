/**
 * Start a new action on a subject (decision 68): the first trigger that fits, the element filled
 * in, a placeholder text. The new action opens in the popup. Shared by the Actions tab, the
 * inspector of an element and the quest fields.
 */
import { addNote } from '../../engine/editor';
import { triggerChoices, triggerFor, type Subject } from './actionSubjects';
import type { EditorStore } from './editorStore';

export function addAction(store: EditorStore, subject: Subject, letter?: string): boolean {
  const st = store.getState();
  const first = triggerChoices(subject)[0];
  if (!first) return false;
  const r = triggerFor(st.quest, subject, first.type);
  if (!r.ok) {
    st.say(r.error);
    return false;
  }
  const ok = st.apply((q) =>
    addNote(q, {
      trigger: r.value.trigger,
      ...(r.value.target ? { target: r.value.target } : {}),
      ...(letter ? { letter } : {}),
      effects: [{ type: 'showText', text: 'Write the text here.' }],
    }),
  );
  if (!ok) return false;
  const q = store.getState().quest;
  const made = q.notes[q.notes.length - 1];
  if (made) st.setNoteId(made.id);
  return true;
}

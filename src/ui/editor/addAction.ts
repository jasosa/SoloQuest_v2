/**
 * Start a new action on a subject (decision 68): the first trigger that fits, the element filled
 * in and no effect. The new action opens in the form as a draft: it joins the quest when
 * the author saves it, and "Cancel" leaves no trace. Shared by the Actions tab, the inspector of
 * an element and the quest fields.
 */
import { addNote } from '../../engine/editor';
import { foreignIdsOf } from '../../engine/editor/maps';
import { withForeignIds } from '../../engine/editor/result';
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
  // run the engine operation on the quest, but keep the result: only the draft is opened
  const made = withForeignIds(foreignIdsOf(st.quest), () =>
    addNote(st.quest, {
      trigger: r.value.trigger,
      ...(r.value.target ? { target: r.value.target } : {}),
      ...(letter ? { letter } : {}),
      effects: [], // a new action starts with no effect; the author adds what it does
    }),
  );
  if (!made.ok) {
    st.say(made.error);
    return false;
  }
  const note = made.quest.notes[made.quest.notes.length - 1];
  if (!note) return false;
  st.startNewNote(note);
  return true;
}

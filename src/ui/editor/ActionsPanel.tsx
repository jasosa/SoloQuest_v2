/**
 * The list of the Actions tab (decision 68): every action of the quest, in the order of what it
 * belongs to (the quest, rooms, zones, squares, doors, furniture, monsters, traps), one row each
 * with its kind (Moment, Place or Element). A row opens the action in the card beside the list;
 * "Add action" starts one on the quest. There are no "notes" here: an action is always tied to a
 * moment of the quest, a place or an element.
 */
import { useStore } from 'zustand';
import { lettersMissingNotes } from '../../engine/editor';
import type { Note, Quest } from '../../engine/quest/schema';
import { addAction } from './addAction';
import { actionKind, subjectLabel, subjectOf, type Subject } from './actionSubjects';
import type { EditorStore } from './editorStore';
import { mainText, triggerSummary } from './noteForms';
import { PickRow } from '../shared/Frame';
import { t } from '../../i18n/t';

const ORDER: readonly Subject['kind'][] = [
  'quest',
  'area',
  'zone',
  'square',
  'door',
  'furniture',
  'monster',
  'trap',
  'marker',
];

/** The actions of a quest, grouped by the kind of thing they belong to, in a fixed order. */
export function groupActions(q: Quest): { kind: Subject['kind']; notes: Note[] }[] {
  const groups = new Map<Subject['kind'], Note[]>();
  for (const n of q.notes) {
    const k = subjectOf(n).kind;
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }
  return ORDER.filter((k) => groups.has(k)).map((k) => ({ kind: k, notes: groups.get(k)! }));
}

export function ActionsPanel({ store }: { store: EditorStore }) {
  const { quest, noteId } = useStore(store);
  const st = store.getState();
  const missing = lettersMissingNotes(quest);
  const groups = groupActions(quest);

  return (
    <>
      {missing.length > 0 && (
        <section className="fr-missing">
          <div className="lbl">
            {t('editor.ActionsPanel.lettersOnTheMap', 'Letters on the map with no action')}
          </div>
          <div className="ed-chips" data-testid="missing-letters">
            {missing.map((l) => (
              <button
                key={l}
                className="chip"
                onClick={() => addAction(store, { kind: 'area', id: quest.start.area ?? 'R01' }, l)}
              >
                {t('editor.ActionsPanel.addAction', 'Add action {l}', { l })}
              </button>
            ))}
          </div>
        </section>
      )}
      {quest.notes.length === 0 ? (
        <p className="ed-note" data-testid="no-actions">
          {t('editor.ActionsPanel.noActionYet', 'No action yet.')}
        </p>
      ) : (
        <div className="fr-picks" data-testid="note-list">
          {groups.flatMap((g) =>
            g.notes.map((n) => (
              <PickRow
                key={n.id}
                on={n.id === noteId}
                sub={mainText(n)}
                data={{ 'data-action-row': n.id }}
                name={
                  <>
                    {n.letter ? `${n.letter} · ` : ''}
                    {g.kind === 'quest' ? '' : `${subjectLabel(quest, subjectOf(n))}: `}
                    {triggerSummary(n.trigger)}
                  </>
                }
                kind={actionKind(subjectOf(n))}
                onClick={() => st.setNoteId(n.id)}
              />
            )),
          )}
        </div>
      )}
      <button className="btn alt" onClick={() => addAction(store, { kind: 'quest' })}>
        {t('editor.ActionsPanel.addAction2', 'Add action')}
      </button>
    </>
  );
}

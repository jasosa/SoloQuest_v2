/**
 * The Actions tab (decision 68): every action of the quest, grouped by what it belongs to (the
 * quest, rooms, zones, squares, doors, furniture, monsters, traps). A row opens the action in the
 * popup; "Add action" starts one on the quest. There are no "notes" here: an action is always
 * tied to a moment of the quest, a place or an element.
 */
import { useStore } from 'zustand';
import { lettersMissingNotes } from '../../engine/editor';
import type { Note, Quest } from '../../engine/quest/schema';
import { addAction } from './addAction';
import { subjectLabel, subjectOf, type Subject } from './actionSubjects';
import type { EditorStore } from './editorStore';
import { mainText, triggerSummary } from './noteForms';

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

const GROUP_NAMES: Record<Subject['kind'], string> = {
  quest: 'The quest',
  area: 'Rooms',
  zone: 'Zones',
  square: 'Squares',
  door: 'Doors',
  furniture: 'Furniture',
  monster: 'Monsters',
  trap: 'Traps',
  marker: 'Markers',
};

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
  const { quest } = useStore(store);
  const st = store.getState();
  const missing = lettersMissingNotes(quest);
  const groups = groupActions(quest);

  return (
    <>
      {missing.length > 0 && (
        <section>
          <div className="lbl">Letters on the map with no action</div>
          <div className="ed-chips" data-testid="missing-letters">
            {missing.map((l) => (
              <button
                key={l}
                className="chip"
                onClick={() => addAction(store, { kind: 'area', id: quest.start.area ?? 'R01' }, l)}
              >
                Add action {l}
              </button>
            ))}
          </div>
        </section>
      )}
      <section>
        <div className="lbl">Actions</div>
        {quest.notes.length === 0 ? (
          <p className="ed-note" data-testid="no-actions">
            No action yet.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.kind} data-testid={`actions-${g.kind}`}>
              <div className="ed-sub">{GROUP_NAMES[g.kind]}</div>
              <ul className="ed-notelist" data-testid="note-list">
                {g.notes.map((n) => (
                  <li key={n.id}>
                    <button onClick={() => st.setNoteId(n.id)}>
                      <b>{n.letter ?? '·'}</b>
                      <span>
                        {g.kind === 'quest' ? '' : `${subjectLabel(quest, subjectOf(n))}: `}
                        {triggerSummary(n.trigger)}
                      </span>
                      <i>{mainText(n)}</i>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        <button className="btn" onClick={() => addAction(store, { kind: 'quest' })}>
          Add action
        </button>
      </section>
    </>
  );
}

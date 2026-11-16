/**
 * Actions of one element in the editor (decision 67): the notes that belong to it, and the
 * ways to add one. An action is a normal note under the hood: the template only prefills its
 * trigger and target, so the format and the engine do not change. Pure, no React.
 */
import type { Note, NoteTarget, Quest, Trigger } from '../../engine/quest/schema';
import { notesOf } from '../../engine/quest/targets';
import type { EditSelection } from './editorStore';

export interface ActionTemplate {
  readonly key: string;
  readonly label: string;
  readonly trigger: Trigger;
  /** Only set when the trigger does not already name the element (a button needs it). */
  readonly target?: NoteTarget;
}

/** The element a selection stands for in note targets. A marker is its square. */
export function elementOf(q: Quest, sel: EditSelection): NoteTarget | undefined {
  if (!sel || sel.kind === 'block') return undefined;
  if (sel.kind === 'marker') {
    const m = q.markers.find((x) => x.id === sel.id);
    return m ? { kind: 'square', id: `${m.cell[0]},${m.cell[1]}` } : undefined;
  }
  return { kind: sel.kind, id: sel.id };
}

/** The notes that belong to the selected element, in quest order. */
export function actionsOf(q: Quest, sel: EditSelection): Note[] {
  const el = elementOf(q, sel);
  return el ? notesOf(q.notes, el.kind, el.id) : [];
}

const button = (target: NoteTarget): ActionTemplate => ({
  key: 'button',
  label: 'A button on it',
  trigger: { type: 'manual', label: 'Press me' },
  target,
});

/** The actions that can be added to the selected element. */
export function actionTemplates(q: Quest, sel: EditSelection): ActionTemplate[] {
  const el = elementOf(q, sel);
  if (!sel || !el) return [];
  switch (sel.kind) {
    case 'door': {
      const isFalse = q.falseDoors.some((d) => d.id === sel.id);
      return [
        ...(isFalse
          ? []
          : [
              {
                key: 'opened',
                label: 'When it is opened',
                trigger: { type: 'doorOpened', door: sel.id } as Trigger,
              },
            ]),
        button(el),
      ];
    }
    case 'monster':
      return [
        {
          key: 'seen',
          label: 'When it is seen',
          trigger: { type: 'monsterSeen', monster: sel.id },
        },
        {
          key: 'killed',
          label: 'When it is slain',
          trigger: { type: 'monsterKilled', monster: sel.id },
        },
        button(el),
      ];
    case 'trap':
      return [
        { key: 'sprung', label: 'When it springs', trigger: { type: 'trapSprung', trap: sel.id } },
        {
          key: 'disarmed',
          label: 'When it is disarmed',
          trigger: { type: 'trapDisarmed', trap: sel.id },
        },
        button(el),
      ];
    case 'marker': {
      const m = q.markers.find((x) => x.id === sel.id);
      return [
        ...(m
          ? [
              {
                key: 'here',
                label: 'When a hero is here',
                trigger: { type: 'squareEntered', cell: [m.cell[0], m.cell[1]] } as Trigger,
              },
            ]
          : []),
        button(el),
      ];
    }
    case 'furniture':
      return [button(el)];
    default:
      return [];
  }
}

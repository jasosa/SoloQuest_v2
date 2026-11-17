/**
 * What an action applies to, and which triggers fit it (decision 68). The editor shows actions,
 * not notes: an action belongs to the quest (a moment), a room, a single square, a zone or an
 * element. Under the hood it is the same note; these helpers only choose and fill the trigger and
 * the target. Pure, no React.
 */
import { board, roomIds } from '../../engine/board/board';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import type { Note, NoteTarget, Quest, Trigger } from '../../engine/quest/schema';
import { noteTarget } from '../../engine/quest/targets';
import { defaultTrigger, type Made } from './noteForms';

/** The quest itself (a moment: start, a Zargon turn...) or one place or element. */
export type Subject = { readonly kind: 'quest' } | NoteTarget;

export const subjectOf = (n: Note): Subject => noteTarget(n) ?? { kind: 'quest' };

/** A short name for the "Applies to" line: "The quest", "Room R03", "Door d1"... */
export function subjectLabel(q: Quest, s: Subject): string {
  switch (s.kind) {
    case 'quest':
      return 'The quest';
    case 'area':
      return s.id === 'C' ? 'The corridors' : `Room ${s.id}`;
    case 'square':
      return `Square ${s.id}`;
    case 'zone':
      return `Zone ${s.id}`;
    case 'door':
      return q.secretDoors.some((d) => d.id === s.id)
        ? `Secret door ${s.id}`
        : q.falseDoors.some((d) => d.id === s.id)
          ? `False door ${s.id}`
          : `Door ${s.id}`;
    case 'furniture':
      return `Furniture ${s.id}`;
    case 'monster': {
      const m = q.monsters.find((x) => x.id === s.id);
      return m ? `Monster ${s.id} (${m.name ?? MONSTER_NAMES[m.type]})` : `Monster ${s.id}`;
    }
    case 'trap':
      return `Trap ${s.id}`;
    case 'marker':
      return `Marker ${s.id}`;
  }
}

export interface TriggerChoice {
  readonly type: Trigger['type'];
  readonly label: string;
}

const button: TriggerChoice = { type: 'manual', label: 'A button' };

/** The triggers that fit a subject, in the order the author sees them. */
export function triggerChoices(s: Subject): readonly TriggerChoice[] {
  switch (s.kind) {
    case 'quest':
      return [
        { type: 'questStart', label: 'The quest starts' },
        { type: 'questEnds', label: 'The quest ends' },
        { type: 'zargonTurn', label: 'A Zargon turn ends' },
        { type: 'allKilled', label: 'All of some monsters are slain' },
        { type: 'manual', label: 'A button in the Quest sheet' },
      ];
    case 'area':
      return [
        { type: 'areaRevealed', label: 'It is revealed' },
        { type: 'areaEntered', label: 'A hero enters it' },
        { type: 'treasureSearch', label: 'It is searched for treasure' },
        { type: 'secretDoorSearch', label: 'It is searched for secret doors' },
        button,
      ];
    case 'square':
    case 'marker':
      return [{ type: 'squareEntered', label: 'A hero is here' }, button];
    case 'zone':
      return [{ type: 'zoneEntered', label: 'A hero enters it' }, button];
    case 'door':
      return [{ type: 'doorOpened', label: 'It is opened' }, button];
    case 'monster':
      return [
        { type: 'monsterSeen', label: 'It is seen' },
        { type: 'monsterKilled', label: 'It is slain' },
        { type: 'spellCast', label: 'It casts a spell' },
        button,
      ];
    case 'trap':
      return [
        { type: 'trapSprung', label: 'It springs' },
        { type: 'trapDisarmed', label: 'It is disarmed' },
        button,
      ];
    case 'furniture':
      return [button];
  }
}

const cellOf = (id: string): [number, number] | undefined => {
  const m = /^(\d+),(\d+)$/.exec(id);
  return m ? [Number(m[1]), Number(m[2])] : undefined;
};

const noFit = <T>(): Made<T> => ({
  ok: false,
  error: 'That trigger does not fit this subject.',
});

/**
 * The trigger of this type for this subject, with the element filled in. A button names its
 * subject as `target`; the other triggers name it themselves, so no explicit target is needed.
 * `previous` keeps the label, hint and repeat of a button that already exists.
 */
export function triggerFor(
  q: Quest,
  s: Subject,
  type: Trigger['type'],
  previous?: Trigger,
): Made<{ trigger: Trigger; target: NoteTarget | undefined }> {
  type Out = Made<{ trigger: Trigger; target: NoteTarget | undefined }>;
  const done = (trigger: Trigger): Out => ({ ok: true, value: { trigger, target: undefined } });
  switch (type) {
    case 'manual': {
      const old = previous?.type === 'manual' ? previous : undefined;
      const trigger: Trigger = old ?? { type: 'manual', label: 'Press me' };
      return { ok: true, value: { trigger, target: s.kind === 'quest' ? undefined : s } };
    }
    case 'areaRevealed':
    case 'areaEntered':
    case 'treasureSearch':
    case 'secretDoorSearch':
      return s.kind === 'area' ? done({ type, area: s.id }) : noFit();
    case 'squareEntered': {
      const c = s.kind === 'square' ? cellOf(s.id) : undefined;
      return c ? done({ type, cell: c }) : noFit();
    }
    case 'zoneEntered':
      return s.kind === 'zone' ? done({ type, zone: s.id, repeat: true }) : noFit();
    case 'doorOpened':
      return s.kind === 'door' ? done({ type, door: s.id }) : noFit();
    case 'monsterSeen':
    case 'monsterKilled':
    case 'spellCast':
      return s.kind === 'monster' ? done({ type, monster: s.id }) : noFit();
    case 'trapSprung':
    case 'trapDisarmed':
      return s.kind === 'trap' ? done({ type, trap: s.id }) : noFit();
    default: {
      // questStart, zargonTurn, allKilled: no element of their own
      const r = defaultTrigger(q, type);
      return r.ok ? done(r.value) : r;
    }
  }
}

/** A marker is its square in the file: its actions are actions of that square. */
export function markerSubject(q: Quest, id: string): Subject | undefined {
  const m = q.markers.find((x) => x.id === id);
  return m ? { kind: 'square', id: `${m.cell[0]},${m.cell[1]}` } : undefined;
}

/** Every subject the author can pick in the "Applies to" list (squares are picked on the board). */
export function subjectChoices(q: Quest): Subject[] {
  const out: Subject[] = [{ kind: 'quest' }];
  for (const r of roomIds(board)) out.push({ kind: 'area', id: r });
  out.push({ kind: 'area', id: 'C' });
  for (const z of q.zones) out.push({ kind: 'zone', id: z.id });
  for (const m of q.markers) out.push({ kind: 'square', id: `${m.cell[0]},${m.cell[1]}` });
  for (const d of [...q.doors, ...q.secretDoors, ...q.falseDoors])
    out.push({ kind: 'door', id: d.id });
  for (const f of q.furniture) out.push({ kind: 'furniture', id: f.id });
  for (const m of q.monsters) out.push({ kind: 'monster', id: m.id });
  for (const t of q.traps) out.push({ kind: 'trap', id: t.id });
  return out;
}

export const subjectKey = (s: Subject): string =>
  s.kind === 'quest' ? 'quest' : `${s.kind}:${s.id}`;

export function parseSubjectKey(key: string): Subject | undefined {
  if (key === 'quest') return { kind: 'quest' };
  const i = key.indexOf(':');
  if (i < 0) return undefined;
  return { kind: key.slice(0, i) as NoteTarget['kind'], id: key.slice(i + 1) };
}

export interface Retarget {
  readonly trigger: Trigger;
  readonly target: NoteTarget | null;
}

const asRetarget = (
  r: Made<{ trigger: Trigger; target: NoteTarget | undefined }>,
): Made<Retarget> =>
  r.ok ? { ok: true, value: { trigger: r.value.trigger, target: r.value.target ?? null } } : r;

/**
 * What changes when an action moves to another subject: the trigger keeps its kind when it
 * fits the new subject (an area trigger moves to another area), else the first fitting one.
 */
export function retarget(q: Quest, n: Note, to: Subject): Made<Retarget> {
  const choices = triggerChoices(to);
  const type = choices.find((c) => c.type === n.trigger.type)?.type ?? choices[0]?.type;
  if (!type) return { ok: false, error: 'Nothing fits this subject.' };
  return asRetarget(triggerFor(q, to, type, n.trigger));
}

/** The trigger changes inside the same subject (the "When" list). */
export function changeTrigger(q: Quest, n: Note, type: Trigger['type']): Made<Retarget> {
  return asRetarget(triggerFor(q, subjectOf(n), type, n.trigger));
}

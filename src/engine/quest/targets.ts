import type { Note, NoteTarget } from './schema';

/**
 * The quest element a note belongs to (decision 67). An explicit `target` wins; otherwise it is
 * derived from the trigger. Square triggers and quest-wide triggers have no element: undefined.
 * Pure, so the editor and the play screen group notes the same way.
 */
export function noteTarget(note: Note): NoteTarget | undefined {
  if (note.target) return note.target;
  const t = note.trigger;
  switch (t.type) {
    case 'doorOpened':
      return { kind: 'door', id: t.door };
    case 'trapSprung':
    case 'trapDisarmed':
      return { kind: 'trap', id: t.trap };
    case 'monsterSeen':
    case 'monsterKilled':
      return t.monster ? { kind: 'monster', id: t.monster } : undefined;
    case 'spellCast':
      return t.monster ? { kind: 'monster', id: t.monster } : undefined;
    case 'areaRevealed':
    case 'areaEntered':
    case 'treasureSearch':
    case 'secretDoorSearch':
      return { kind: 'area', id: t.area };
    case 'squareEntered':
      return { kind: 'square', id: `${t.cell[0]},${t.cell[1]}` };
    case 'questStart':
    case 'allKilled':
    case 'zargonTurn':
    case 'manual':
      return undefined;
  }
}

/** Notes of one element, in quest order. */
export function notesOf(notes: readonly Note[], kind: NoteTarget['kind'], id: string): Note[] {
  return notes.filter((n) => {
    const t = noteTarget(n);
    return t?.kind === kind && t.id === id;
  });
}

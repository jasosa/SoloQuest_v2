/**
 * Who uses an element? Used by the editor when something is removed or renamed: the notes and
 * objectives that point at it are reported, never silently rewritten or deleted.
 */
import type { Effect, Note, Quest } from '../quest/schema';
import type { Issue } from '../quest/validate';

export type RefTarget = 'door' | 'monster' | 'trap';

/** Visit the effects of one note, including the options of `promptChoice`. */
export function walkEffects(list: readonly Effect[], fn: (e: Effect) => void): void {
  for (const e of list) {
    fn(e);
    if (e.type === 'promptChoice') for (const o of e.options) walkEffects(o.effects, fn);
  }
}

function noteUses(note: Note, target: RefTarget, id: string): boolean {
  const t = note.trigger;
  let used = false;
  switch (target) {
    case 'door':
      used = t.type === 'doorOpened' && t.door === id;
      break;
    case 'trap':
      used = (t.type === 'trapSprung' || t.type === 'trapDisarmed') && t.trap === id;
      break;
    case 'monster':
      used =
        (t.type === 'monsterKilled' && t.monster === id) ||
        (t.type === 'monsterSeen' && t.monster === id) ||
        (t.type === 'monsterLeft' && t.monster === id) ||
        (t.type === 'allKilled' && t.monsters.includes(id)) ||
        (t.type === 'spellCast' && t.monster === id) ||
        (note.when ?? []).some((c) => 'monster' in c && c.monster === id);
      break;
  }
  walkEffects(note.effects, (e) => {
    if (target === 'door' && e.type === 'addSecretDoor' && e.door === id) used = true;
    if (
      target === 'monster' &&
      (e.type === 'placeMonster' || e.type === 'setMonsterState') &&
      e.monster === id
    )
      used = true;
  });
  return used;
}

/** Warnings for every note, objective or rule that points at the element. */
export function referencesTo(quest: Quest, target: RefTarget, id: string): Issue[] {
  const out: Issue[] = [];
  for (const n of quest.notes)
    if (noteUses(n, target, id))
      out.push({
        severity: 'warning',
        message: `note ${n.id} still points at ${target} ${id}, which is gone. Fix or delete the note.`,
        ref: { kind: 'note', id: n.id },
      });
  if (target === 'monster')
    for (const o of quest.objectives) {
      const d = o.done;
      if (
        d &&
        (('monsterKilled' in d && d.monsterKilled === id) ||
          ('allKilled' in d && d.allKilled.includes(id)))
      )
        out.push({
          severity: 'warning',
          message: `objective ${o.id} still points at monster ${id}, which is gone. Fix the objective.`,
          ref: { kind: 'objective', id: o.id },
        });
    }
  return out;
}

/** Rewrite door ids in note triggers and effects (used when a door changes kind and id). */
export function renameDoorRefs(quest: Quest, from: string, to: string): Quest {
  const fixEffect = (e: Effect): Effect => {
    if (e.type === 'addSecretDoor' && e.door === from) return { ...e, door: to };
    if (e.type === 'promptChoice')
      return {
        ...e,
        options: e.options.map((o) => ({ ...o, effects: o.effects.map(fixEffect) })),
      };
    return e;
  };
  return {
    ...quest,
    notes: quest.notes.map((n) => ({
      ...n,
      trigger:
        n.trigger.type === 'doorOpened' && n.trigger.door === from
          ? { ...n.trigger, door: to }
          : n.trigger,
      effects: n.effects.map(fixEffect),
    })),
  };
}

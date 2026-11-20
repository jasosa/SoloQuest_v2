/**
 * Squares to pulse after an event added something to the map (decision 66, plan 3.5): blocked
 * squares a note or trap placed, and secret doors that were put on the map or found. Monsters
 * added to the roster have their own highlight. Pure, no React.
 */
import type { Cell } from '../../engine/board/board';
import type { Level } from '../../engine/board/level';
import type { Prompt } from '../../engine/game/prompts';

export function additionCells(level: Level, prompts: readonly Prompt[]): Cell[] {
  const out: Cell[] = [];
  const door = (id: string) => {
    const d = level.doors.get(id);
    if (d) out.push([d.a[0], d.a[1]]);
  };
  for (const p of prompts) {
    if (p.kind === 'blockPlaced') for (const c of p.cells) out.push([c[0], c[1]]);
    else if (p.kind === 'secretDoorAdded') door(p.door);
    else if (p.kind === 'secretDoorsFound') for (const id of p.doors) door(id);
  }
  return out;
}

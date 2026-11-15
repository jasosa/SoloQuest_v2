/**
 * Proof that the editing model can express a real quest: rebuild quest 1 from `emptyQuest`
 * with the editing operations only: map, notes, objectives, wandering monster, rules, Zargon info.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { parseQuest } from '../quest/loader';
import type { Quest } from '../quest/schema';
import { validateQuest, validateQuestIssues } from '../quest/validate';
import { exportQuest } from './io';
import {
  addBlock,
  addDoor,
  addFurniture,
  addMarker,
  addMonster,
  addTrap,
  emptyQuest,
  removeFurniture,
  setRockCell,
  setRockRoom,
  setStartArea,
  setSummary,
  type Cell,
  type EditResult,
} from './ops';
import { addNote, setNoteText, updateNote } from './notes';
import { addObjective, setRules, setWandering, setZargonInfo } from './meta';

const q01 = parseQuest(
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../content/quests/q01-the-trial.json'), 'utf8'),
  ),
);

function ok(r: EditResult): Quest {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
}

function rebuild(src: Quest): Quest {
  let q = emptyQuest({ id: src.id, number: src.number, title: src.title });
  q = ok(setSummary(q, src.intro.summary));
  // The skeleton has stairs of its own: replace them with the ones of the source.
  q = ok(removeFurniture(q, 'f-stairs'));
  q = ok(setStartArea(q, src.start.area));
  for (const room of src.rock.rooms) q = ok(setRockRoom(q, room, true));
  for (const c of src.rock.cells) q = ok(setRockCell(q, c, true));
  for (const d of src.doors) q = ok(addDoor(q, d.a, d.b, 'normal'));
  for (const d of src.secretDoors) q = ok(addDoor(q, d.a, d.b, 'secret'));
  for (const d of src.falseDoors) q = ok(addDoor(q, d.a, d.b, 'false'));
  for (const b of src.blocks) q = ok(addBlock(q, b.cells as Cell[]));
  for (const f of src.furniture)
    q = ok(
      addFurniture(q, f.type, f.cells as Cell[], {
        id: f.id,
        ...(f.letter ? { letter: f.letter } : {}),
      }),
    );
  for (const m of src.monsters) {
    const { id, type, cell, ...rest } = m;
    q = ok(addMonster(q, type, (cell as Cell | undefined) ?? null, { id, ...rest }));
  }
  for (const t of src.traps)
    q = ok(
      addTrap(q, t.kind, t.furniture ? { furniture: t.furniture } : { cell: t.cell as Cell }, {
        id: t.id,
        ...(t.effect ? { effect: t.effect } : {}),
      }),
    );
  for (const m of src.markers) q = ok(addMarker(q, m.label, m.cell as Cell, m.visible, m.id));
  if (src.zargonInfo) q = ok(setZargonInfo(q, src.zargonInfo));
  if (src.wandering) q = ok(setWandering(q, src.wandering));
  for (const o of src.objectives)
    q = ok(addObjective(q, { id: o.id, text: o.text, ...(o.done ? { done: o.done } : {}) }));
  q = ok(setRules(q, src.rules));
  for (const n of src.notes) {
    // A plain first text effect goes in through setNoteText, the rest through the note itself.
    const first = n.effects[0];
    const plainText = first?.type === 'showText' && first.title === undefined;
    q = ok(
      addNote(q, {
        id: n.id,
        ...(n.letter ? { letter: n.letter } : {}),
        ...(n.at ? { at: n.at as Cell } : {}),
        trigger: n.trigger,
        ...(n.when ? { when: n.when } : {}),
        effects: plainText ? n.effects.slice(1) : n.effects,
        ...(n.consumesTreasure ? { consumesTreasure: true } : {}),
      }),
    );
    if (plainText) q = ok(setNoteText(q, n.id, first.text));
  }
  // A note can be reworded later with updateNote: put the first note back to its own trigger.
  const a = src.notes[0];
  if (a) q = ok(updateNote(q, a.id, { trigger: a.trigger }));
  return q;
}

describe('quest 1 rebuilt with the editing operations', () => {
  const built = rebuild(q01);

  it('has the same structure as the bundled file', () => {
    expect(built.start).toEqual(q01.start);
    expect(built.doors).toEqual(q01.doors);
    expect(built.secretDoors).toEqual(q01.secretDoors);
    expect(built.falseDoors).toEqual(q01.falseDoors);
    expect(built.blocks).toEqual(q01.blocks);
    expect(built.furniture).toEqual(q01.furniture);
    expect(built.monsters).toEqual(q01.monsters);
    expect(built.traps).toEqual(q01.traps);
    expect(built.markers).toEqual(q01.markers);
    expect(built.rock.rooms).toEqual([...q01.rock.rooms].sort());
  });

  it('has the same rock squares (single cells inside a rock room are folded into the room)', () => {
    const a = buildLevel(built, board).rock;
    const b = buildLevel(q01, board).rock;
    expect([...a].sort()).toEqual([...b].sort());
    const roomOf = (c: readonly number[]) => board.cells[c[1] as number]?.[c[0] as number];
    const wanted = q01.rock.cells.filter((c) => !q01.rock.rooms.includes(roomOf(c) as string));
    const key = (c: readonly number[]) => `${c[0]},${c[1]}`;
    expect(built.rock.cells.map(key).sort()).toEqual(wanted.map(key).sort());
  });

  it('validates and exports to the same text as the bundled file (cells order aside)', () => {
    expect(validateQuest(built, board)).toEqual([]);
    expect(validateQuestIssues(built, board)).toEqual([]);
    const a = JSON.parse(exportQuest(built));
    const b = JSON.parse(exportQuest(q01));
    const sortCells = (cells: number[][]) =>
      [...cells].sort(
        (p, q) => (p[1] as number) - (q[1] as number) || (p[0] as number) - (q[0] as number),
      );
    a.rock.cells = sortCells(a.rock.cells);
    b.rock.cells = sortCells(
      b.rock.cells.filter((c: number[]) =>
        a.rock.cells.some((d: number[]) => d[0] === c[0] && d[1] === c[1]),
      ),
    );
    expect(a).toEqual(b);
  });

  it('has the same notes, objectives, wandering, rules and intro', () => {
    expect(built.notes).toEqual(q01.notes);
    expect(built.objectives).toEqual(q01.objectives);
    expect(built.wandering).toEqual(q01.wandering);
    expect(built.rules).toEqual(q01.rules);
    expect(built.npcs).toEqual(q01.npcs);
    expect(built.zargonInfo).toEqual(q01.zargonInfo);
    expect(built.intro).toEqual(q01.intro);
    expect(built.title).toBe(q01.title);
  });

  it('exports the same quest as the bundled file', () => {
    // The only known difference: rock cells inside rock rooms are folded away (see above).
    const a = JSON.parse(exportQuest(built));
    const b = JSON.parse(exportQuest(q01));
    const inRoom = (c: number[]) =>
      built.rock.rooms.includes(board.cells[c[1] as number]?.[c[0] as number] as string);
    b.rock.cells = b.rock.cells.filter((c: number[]) => !inRoom(c));
    const sort = (cells: number[][]) =>
      [...cells].sort(
        (p, q) => (p[1] as number) - (q[1] as number) || (p[0] as number) - (q[0] as number),
      );
    a.rock.cells = sort(a.rock.cells);
    b.rock.cells = sort(b.rock.cells);
    expect(a).toEqual(b);
  });
});

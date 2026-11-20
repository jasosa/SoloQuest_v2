import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { applyCoreFile, parseCoreFile } from '../data/coreFile';
import { parseQuest } from '../quest/loader';
import { testMapsQuest } from '../quest/testMaps';
import type { Quest } from '../quest/schema';
import { validateQuestIssues } from '../quest/validate';
import { exportQuest, importQuest } from './io';
import { addAreaMerge, removeAreaMerge } from './merges';
import {
  addLink,
  addMap,
  foreignIdsOf,
  mapIdsOf,
  removeLink,
  removeMap,
  swapTo,
  updateMap,
} from './maps';
import { addNote } from './notes';
import { addMonster, emptyQuest, updateMonster, type EditResult } from './ops';
import { withForeignIds } from './result';
import { setRules } from './meta';

const ok = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};
const errors = (q: Quest) =>
  validateQuestIssues(q, board)
    .filter((i) => i.severity === 'error')
    .map((i) => i.message);
// The Frozen Horror abilities and spells come from the Core library file.
applyCoreFile(
  parseCoreFile(
    JSON.parse(
      readFileSync(resolve(__dirname, '../../content/library/frozen-horror.json'), 'utf8'),
    ),
  )!,
);

const blank = () => emptyQuest({ id: 'u', number: 1, title: 'T' });

describe('swapTo', () => {
  const q = testMapsQuest();
  it('puts another map on top and back again, losing nothing', () => {
    const two = swapTo(q, 'two');
    expect(two.mapId).toBe('two');
    expect(two.mapName).toBe('The Lower Hall');
    expect(two.doors.map((d) => d.id)).toEqual(['e1']);
    expect(two.maps?.[0]?.id).toBe('one');
    expect(two.maps?.[0]?.doors.map((d) => d.id)).toEqual(['d2', 'd3']);
    expect(swapTo(two, 'one')).toEqual(q);
    expect(errors(two)).toEqual(errors(q));
  });
  it('is a no-op for the map on top, an unknown map and a single-map quest', () => {
    expect(swapTo(q, 'one')).toBe(q);
    expect(swapTo(q, 'zzz')).toBe(q);
    const single = blank();
    expect(swapTo(single, 'map1')).toBe(single);
  });
  it('an edit on the swapped map changes that map only', () => {
    const two = swapTo(q, 'two');
    const edited = ok(addMonster(two, 'orc', [6, 1]));
    const back = swapTo(edited, 'one');
    expect(back.monsters.map((m) => m.id)).toEqual(['m1']);
    expect(back.maps?.[0]?.monsters.length).toBe(2);
    expect(back.maps?.[0]?.id).toBe('two');
  });
});

describe('ids across maps', () => {
  it('a new id skips the ids of the other maps', () => {
    const two = swapTo(testMapsQuest(), 'two');
    const foreign = foreignIdsOf(two);
    expect(foreign.has('d2')).toBe(true);
    // map one has m1 and map two has m2: the new monster of map two must be m3
    const made = withForeignIds(foreign, () => ok(addMonster(two, 'orc', [6, 1])));
    expect(made.monsters.map((m) => m.id)).toEqual(['m2', 'm3']);
    // without the other map's ids it would take m1, which map one uses
    expect(ok(addMonster(two, 'orc', [6, 1])).monsters.map((m) => m.id)).toContain('m1');
  });
});

describe('addMap, updateMap, removeMap', () => {
  it('a single-map quest becomes a double quest, its map notes name map 1', () => {
    let q = blank();
    q = ok(addNote(q, { trigger: { type: 'areaRevealed', area: 'R20' } }));
    q = ok(addNote(q, { trigger: { type: 'questStart' } }));
    q = ok(addMap(q, { name: 'Below' }));
    expect(mapIdsOf(q)).toEqual(['map1', 'map2']);
    expect(q.mapId).toBe('map1');
    expect(q.maps?.[0]).toMatchObject({ id: 'map2', name: 'Below', start: { area: 'R01' } });
    expect(q.notes.map((n) => n.map)).toEqual(['map1', undefined]);
    expect(errors(q).filter((m) => /unknown map|needs a map|mapId/.test(m))).toEqual([]);
  });
  it('refuses a repeated or bad id and an empty name', () => {
    const q = ok(addMap(blank()));
    expect(addMap(q, { id: 'map1' }).ok).toBe(false);
    expect(addMap(q, { id: 'a b' }).ok).toBe(false);
    expect(addMap(q, { name: '  ' }).ok).toBe(false);
  });
  it('renames a map: the id follows in notes and links', () => {
    const q = ok(updateMap(testMapsQuest(), 'two', { id: 'below', name: 'Below' }));
    expect(mapIdsOf(q)).toEqual(['one', 'below']);
    expect(q.links?.[0]?.b.map).toBe('below');
    expect(q.notes.find((n) => n.id === 'ask2')?.map).toBe('below');
    expect(errors(q)).toEqual(errors(testMapsQuest()));
    const first = ok(updateMap(q, 'one', { id: 'top', name: null }));
    expect(first.mapId).toBe('top');
    expect(first.mapName).toBeUndefined();
    expect(first.links?.[0]?.a.map).toBe('top');
    expect(updateMap(q, 'one', { id: 'below' }).ok).toBe(false);
  });
  it('removes a map with its notes and links; one map left is a plain quest again', () => {
    const q = ok(removeMap(testMapsQuest(), 'two'));
    expect(q.maps).toBeUndefined();
    expect(q.links).toBeUndefined();
    expect(q.mapId).toBeUndefined();
    expect(q.notes.some((n) => n.map !== undefined)).toBe(false);
    expect(q.notes.map((n) => n.id).sort()).toEqual(['ask1', 'key', 'rev17']);
  });
  it('removing map 1 promotes the other map', () => {
    const q = ok(removeMap(testMapsQuest(), 'one'));
    expect(q.maps).toBeUndefined();
    expect(q.doors.map((d) => d.id)).toEqual(['e1']);
    expect(q.monsters.map((m) => m.id)).toEqual(['m2']);
  });
  it('cannot remove the only map', () => {
    expect(removeMap(blank(), 'map1').ok).toBe(false);
  });
});

describe('links', () => {
  const base = () => {
    const { links: _l, ...rest } = testMapsQuest();
    void _l;
    return rest as Quest;
  };
  it('joins two stairways of two maps, with an id', () => {
    const q = ok(addLink(base(), { map: 'one', cell: [1, 15] }, { map: 'two', cell: [1, 1] }));
    expect(q.links).toEqual([
      { id: 'l1', a: { map: 'one', cell: [1, 15] }, b: { map: 'two', cell: [1, 1] } },
    ]);
  });
  it('refuses a missing map, the same map, a square that is no stairway, a stairway used twice', () => {
    const q = base();
    expect(addLink(q, { map: 'one', cell: [1, 15] }, { map: 'zzz', cell: [1, 1] }).ok).toBe(false);
    expect(addLink(q, { map: 'one', cell: [1, 15] }, { map: 'one', cell: [1, 16] }).ok).toBe(false);
    expect(addLink(q, { map: 'one', cell: [1, 15] }, { map: 'two', cell: [3, 3] }).ok).toBe(false);
    const linked = ok(addLink(q, { map: 'one', cell: [1, 15] }, { map: 'two', cell: [1, 1] }));
    const r = addLink(linked, { map: 'one', cell: [1, 16] }, { map: 'two', cell: [2, 1] });
    expect(r.ok).toBe(false);
  });
  it('removing a link warns about the crossMap notes that use it', () => {
    const r = removeLink(testMapsQuest(), 'l1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quest.links).toBeUndefined();
      expect(r.warnings.length).toBeGreaterThan(0);
    }
  });
});

describe('notes on a map', () => {
  it('a new lettered note names the map on show; a quest-wide note names none', () => {
    const two = swapTo(testMapsQuest(), 'two');
    const withNote = ok(addNote(two, { letter: 'C', trigger: { type: 'manual', label: 'x' } }));
    expect(withNote.notes.find((n) => n.letter === 'C')?.map).toBe('two');
    const wide = ok(addNote(two, { trigger: { type: 'questStart' } }));
    expect(wide.notes.at(-1)?.map).toBeUndefined();
  });
});

describe('merged rooms', () => {
  it('merges two touching rooms and splits them again', () => {
    const m = ok(addAreaMerge(blank(), 'R20', 'R17'));
    expect(m.areaOverrides).toEqual([{ merge: ['R20', 'R17'] }]);
    expect(ok(removeAreaMerge(m, 'R17')).areaOverrides).toEqual([]);
  });
  it('refuses rooms that do not touch, the same room and unknown rooms', () => {
    expect(addAreaMerge(blank(), 'R20', 'R05').ok).toBe(false);
    expect(addAreaMerge(blank(), 'R20', 'R20').ok).toBe(false);
    expect(addAreaMerge(blank(), 'R20', 'R99').ok).toBe(false);
    expect(removeAreaMerge(blank(), 'R17').ok).toBe(false);
  });
});

describe('monster size and rules', () => {
  it('a monster can be large (2), 1 clears it, 3 is refused', () => {
    let q = ok(addMonster(blank(), 'goblin', [11, 17]));
    const id = q.monsters[0]!.id;
    q = ok(updateMonster(q, id, { size: 2 }));
    expect(q.monsters[0]?.size).toBe(2);
    expect(updateMonster(q, id, { size: 3 }).ok).toBe(false);
    q = ok(updateMonster(q, id, { size: 1 }));
    expect(q.monsters[0]?.size).toBeUndefined();
  });
  it('doorTeleport is set and cleared', () => {
    let q = ok(
      setRules(blank(), {
        doorTeleport: { dice: '1 red die', squares: 'that many squares' },
      }),
    );
    expect(q.rules.doorTeleport).toEqual({ dice: '1 red die', squares: 'that many squares' });
    q = ok(setRules(q, { doorTeleport: null }));
    expect(q.rules).toEqual({});
  });
});

describe('the bundled double quest in the editor model', () => {
  const text = readFileSync(
    resolve(__dirname, '../../content/quests/fh09-the-heart-of-ice.json'),
    'utf8',
  );
  const q = parseQuest(JSON.parse(text));
  it('has two maps; each shows its own doors, furniture and monsters when swapped to', () => {
    const ids = mapIdsOf(q);
    expect(ids.length).toBe(2);
    const second = swapTo(q, ids[1]!);
    expect(second.doors.length).toBe(q.maps![0]!.doors.length);
    expect(second.monsters.length).toBe(q.maps![0]!.monsters.length);
    expect(second.furniture.some((f) => f.type === 'stairs')).toBe(true);
    expect(errors(second)).toEqual(errors(q));
  });
  it('round trips through export and import unchanged', () => {
    const back = importQuest(exportQuest(q));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.quest).toEqual(q);
  });
});

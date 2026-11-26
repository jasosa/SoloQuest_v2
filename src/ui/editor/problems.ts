/**
 * Pure helpers of the Problems panel: order the issues (errors first) and turn an issue ref into
 * a jump (what to select, which tab to show, what to flash on the board). No React in here.
 */
import { tr } from '../../i18n/translate';
import type { Issue, IssueRef } from '../../engine/quest/validate';
import type { Quest } from '../../engine/quest/schema';
import type { EditSelection, Panel } from './editorStore';

type Cell = readonly [number, number];

/** What flashes on the board after a jump: some squares and some whole areas. */
export interface Flash {
  readonly cells: readonly Cell[];
  readonly areas: readonly string[];
}

export interface Jump {
  readonly panel: Panel;
  readonly selection: EditSelection;
  /** The note to open in the note builder, when the issue is about a note. */
  readonly noteId: string | null;
  readonly flash: Flash;
}

const NO_FLASH: Flash = { cells: [], areas: [] };

/** Errors first, then warnings. The order inside each group is kept. */
export function sortIssues(issues: readonly Issue[]): Issue[] {
  return [
    ...issues.filter((i) => i.severity === 'error'),
    ...issues.filter((i) => i.severity !== 'error'),
  ];
}

export function countLabel(issues: readonly Issue[]): string {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.length - errors;
  if (errors > 0) return `${errors} problem${errors === 1 ? '' : 's'}`;
  if (warns > 0) return `${warns} warning${warns === 1 ? '' : 's'}`;
  return tr('editor.problems.noProblems', 'No problems');
}

/** The kind label shown on a row of the panel. */
export function refLabel(ref: IssueRef | undefined): string {
  if (!ref) return 'Quest';
  switch (ref.kind) {
    case 'door':
      return 'Door';
    case 'block':
      return 'Block';
    case 'furniture':
      return 'Furniture';
    case 'monster':
      return 'Monster';
    case 'trap':
      return 'Trap';
    case 'marker':
      return 'Marker';
    case 'zone':
      return 'Zone';
    case 'tile':
      return 'Tile';
    case 'tunnel':
      return 'Tunnel';
    case 'note':
      return 'Note';
    case 'objective':
      return 'Objective';
    case 'npc':
      return 'Helper';
    case 'area':
      return 'Area';
    case 'quest':
      return 'Quest';
  }
}

/** The title of a row of the panel: the kind and the id ("Door d2"; a block, "Block 3, 4"). */
export function refTitle(ref: IssueRef | undefined): string {
  const kind = refLabel(ref);
  if (!ref) return kind;
  if (ref.kind === 'block' && ref.cell) return `${kind} ${ref.cell[0]}, ${ref.cell[1]}`;
  if (ref.kind === 'tile' && ref.id !== undefined) return `${kind} ${Number(ref.id) + 1}`;
  if (ref.kind === 'area' && ref.area) return `${kind} ${ref.area}`;
  return ref.id ? `${kind} ${ref.id}` : kind;
}

/** The first square of the thing a ref names, when the quest tells us where it is. */
function cellOfRef(quest: Quest, ref: IssueRef): Cell | undefined {
  if (ref.cell) return ref.cell;
  const id = ref.id;
  if (!id) return undefined;
  switch (ref.kind) {
    case 'door': {
      const d = [...quest.doors, ...quest.secretDoors, ...quest.falseDoors].find(
        (x) => x.id === id,
      );
      return d?.a;
    }
    case 'furniture':
      return quest.furniture.find((f) => f.id === id)?.cells[0];
    case 'monster':
      return quest.monsters.find((m) => m.id === id)?.cell;
    case 'trap': {
      const t = quest.traps.find((x) => x.id === id);
      if (t?.cell) return t.cell;
      return t?.furniture ? quest.furniture.find((f) => f.id === t.furniture)?.cells[0] : undefined;
    }
    case 'marker':
      return quest.markers.find((m) => m.id === id)?.cell;
    case 'zone': {
      const c = quest.zones.find((z) => z.id === id)?.cells[0];
      return c ? [c[0], c[1]] : undefined;
    }
    case 'npc':
      return quest.npcs.find((n) => n.id === id)?.cell;
    case 'note':
      return quest.notes.find((n) => n.id === id)?.at;
    case 'tile': {
      const c = quest.boardTiles[Number(id)]?.cells[0];
      return c ? [c[0], c[1]] : undefined;
    }
    case 'tunnel': {
      const c = quest.tunnels.find((t) => t.id === id)?.a;
      return c ? [c[0], c[1]] : undefined;
    }
    default:
      return undefined;
  }
}

/** Where an issue leads. An issue with no ref (or a ref the quest no longer has) only shows the panel. */
export function jumpFor(quest: Quest, ref: IssueRef | undefined): Jump {
  const none: Jump = { panel: 'problems', selection: null, noteId: null, flash: NO_FLASH };
  if (!ref) return none;
  const cell = cellOfRef(quest, ref);
  const flash: Flash = { cells: cell ? [cell] : [], areas: ref.area ? [ref.area] : [] };
  switch (ref.kind) {
    case 'door':
    case 'furniture':
    case 'monster':
    case 'trap':
    case 'marker':
    case 'zone':
      return ref.id
        ? { panel: 'element', selection: { kind: ref.kind, id: ref.id }, noteId: null, flash }
        : { ...none, flash };
    case 'tile':
      return ref.id !== undefined && quest.boardTiles[Number(ref.id)]
        ? {
            panel: 'element',
            selection: { kind: 'tile', index: Number(ref.id) },
            noteId: null,
            flash,
          }
        : { ...none, flash };
    case 'tunnel':
      return ref.id
        ? {
            panel: 'element',
            selection: { kind: 'tunnel', id: ref.id, end: 'a' },
            noteId: null,
            flash,
          }
        : { ...none, flash };
    case 'block':
      return ref.cell
        ? { panel: 'element', selection: { kind: 'block', cell: ref.cell }, noteId: null, flash }
        : { ...none, flash };
    case 'note':
      return {
        panel: 'notes',
        selection: null,
        noteId: ref.id && quest.notes.some((n) => n.id === ref.id) ? ref.id : null,
        flash,
      };
    case 'area':
      return { panel: 'problems', selection: null, noteId: null, flash };
    default:
      // objective, npc, quest: nothing on the board to select, the inspector shows the quest.
      return { panel: 'element', selection: null, noteId: null, flash };
  }
}

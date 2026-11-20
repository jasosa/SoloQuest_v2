/**
 * The inspector (right column of the editor): the quest title and summary, then the properties of
 * the selected element. Every change is an engine edit operation through the store, so undo and
 * redo work and a refused change shows the engine sentence as a toast. Text fields save when
 * they lose focus; chips save at once.
 */
import { useState } from 'react';
import { useStore } from 'zustand';
import {
  setDoorKind,
  setFurnitureLetter,
  updateMarker,
  updateTrap,
  type DoorKind,
  type Issue,
  type TrapKind,
} from '../../engine/editor';
import { MONSTER_STATS } from '../../engine/data/monsters';
import {
  type FurnitureDef,
  type MonsterDef,
  type Quest,
  type TrapDef,
} from '../../engine/quest/schema';
import { FURNITURE_NAMES } from '../board/furnitureNames';
import type { EditorStore, EditSelection } from './editorStore';
import { SubjectActions } from './ActionsSection';
import { shownName } from './monsterLabel';
import { elementOf } from './elementActions';
import { ProblemsPanel } from './ProblemsPanel';
import { parseMapLetter } from './noteForms';
import { STAT_KEYS, parseOverrides, type StatKey } from './inspectorForms';
import { deleteSelection, rotateSelection } from './selectionActions';
import {
  DoorFlagFields,
  ExteriorDoorFields,
  RoomTileFields,
  TileFields,
  TunnelFields,
} from './FeatureFields';
import { t } from '../../i18n/t';

export const DOOR_KINDS: readonly { kind: DoorKind; label: string }[] = [
  { kind: 'normal', label: 'Normal' },
  { kind: 'secret', label: 'Secret' },
  { kind: 'false', label: 'False' },
];

const TRAP_KINDS_ALL: readonly { kind: TrapKind; label: string }[] = [
  { kind: 'pit', label: 'Pit' },
  { kind: 'fallingBlock', label: t('editor.Inspector.fallingBlock', 'Falling block') },
  { kind: 'spear', label: 'Spear' },
  { kind: 'stalactite', label: 'Stalactite' },
  { kind: 'swingingAxe', label: t('editor.Inspector.swingingAxe', 'Swinging axe') },
  { kind: 'wanderingTrap', label: t('editor.Inspector.wanderingMonsters', 'Wandering monsters') },
  { kind: 'slipperyIce', label: t('editor.Inspector.slipperyIce', 'Slippery ice') },
  { kind: 'chest', label: 'Chest' },
  { kind: 'scripted', label: 'Scripted' },
];

const SELECTION_NAMES: Record<NonNullable<EditSelection>['kind'], string> = {
  door: 'Door',
  block: 'Block',
  furniture: 'Furniture',
  monster: 'Monster',
  trap: 'Trap',
  marker: 'Marker',
  zone: 'Zone',
  tile: 'Tile',
  roomTile: t('editor.Inspector.roomTile', 'Room tile'),
  tunnel: t('editor.Inspector.iceTunnel', 'Ice tunnel'),
};

export function Inspector({
  store,
  issues,
  saveErrors,
}: {
  store: EditorStore;
  issues: readonly Issue[];
  saveErrors: readonly string[] | null;
}) {
  const { quest, selection, panel } = useStore(store);
  const st = store.getState();

  const door = selection?.kind === 'door' ? findDoor(quest, selection.id) : undefined;
  const edgeDoor =
    selection?.kind === 'door' ? quest.edgeDoors.find((e) => e.id === selection.id) : undefined;
  const furniture =
    selection?.kind === 'furniture'
      ? quest.furniture.find((f) => f.id === selection.id)
      : undefined;
  const monster =
    selection?.kind === 'monster' ? quest.monsters.find((m) => m.id === selection.id) : undefined;
  const marker =
    selection?.kind === 'marker' ? quest.markers.find((m) => m.id === selection.id) : undefined;
  const zone =
    selection?.kind === 'zone' ? quest.zones.find((z) => z.id === selection.id) : undefined;
  const trap =
    selection?.kind === 'trap' ? quest.traps.find((t) => t.id === selection.id) : undefined;

  const tabs = (
    <div
      className="ed-chips ed-tabs"
      role="group"
      aria-label={t('editor.Inspector.inspectorTabs', 'Inspector tabs')}
    >
      <button
        className="chip"
        aria-pressed={panel === 'element'}
        onClick={() => st.setPanel('element')}
      >
        {t('editor.Inspector.element', 'Element')}
      </button>
      <button
        className="chip"
        aria-pressed={panel === 'problems'}
        onClick={() => st.setPanel('problems')}
      >
        {t('editor.Inspector.problems', 'Problems')}
        {issues.length > 0 && (
          <>
            {' '}
            <span className="ed-badge" data-testid="problem-count">
              {issues.length}
            </span>
          </>
        )}
      </button>
    </div>
  );

  if (panel === 'problems')
    return (
      <>
        {tabs}
        <ProblemsPanel store={store} issues={issues} />
      </>
    );

  return (
    <>
      {tabs}
      {!selection && (
        <p className="ed-note" data-testid="inspector-hint">
          {t(
            'editor.Inspector.selectSomethingOnThe',
            'Select something on the map to edit it. The quest fields are in the Quest tab.',
          )}
        </p>
      )}

      {saveErrors && (
        <section className="ed-save-errors" role="alert">
          <div className="lbl">{t('editor.Inspector.cannotSaveYet', 'Cannot save yet')}</div>
          <ul>
            {saveErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {selection ? (
        <section data-testid="inspector-selection">
          <div className="lbl">{SELECTION_NAMES[selection.kind]}</div>
          <p className="ed-id" data-testid="selection-id">
            {selectionLabel(selection)}
            {furniture ? ` · ${FURNITURE_NAMES[furniture.type]}` : ''}
            {monster ? ` · ${shownName(quest, monster)}` : ''}
          </p>
          {door && <DoorFields store={store} door={door} />}
          {edgeDoor && <ExteriorDoorFields store={store} id={edgeDoor.id} />}
          {selection.kind === 'tile' && <TileFields store={store} index={selection.index} />}
          {selection.kind === 'roomTile' && (
            <RoomTileFields store={store} index={selection.index} />
          )}
          {selection.kind === 'tunnel' && (
            <TunnelFields store={store} id={selection.id} end={selection.end} />
          )}
          {furniture && <FurnitureFields store={store} furniture={furniture} />}
          {monster && <MonsterPointer store={store} />}
          {marker && <MarkerFields store={store} marker={marker} />}
          {zone && <ZoneFields store={store} zone={zone} />}
          {trap && <TrapFields key={trap.id} store={store} trap={trap} quest={quest} />}
          {/* a monster's actions are in the Monsters tab; every other element keeps them here */}
          {(() => {
            const subject = monster ? null : elementOf(quest, selection);
            return subject ? <SubjectActions store={store} subject={subject} /> : null;
          })()}
          <button className="btn" onClick={() => deleteSelection(store)}>
            {t('editor.Inspector.delete', 'Delete')}
          </button>
        </section>
      ) : null}
    </>
  );
}

function MarkerFields({ store, marker }: { store: EditorStore; marker: Quest['markers'][number] }) {
  const st = store.getState();
  return (
    <>
      <label className="ed-field">
        {t('editor.Inspector.label', 'Label')}
        <input
          key={`${marker.id}:${marker.label}`}
          defaultValue={marker.label}
          maxLength={40}
          onBlur={(e) => {
            if (e.target.value.trim() !== marker.label)
              st.apply((q) => updateMarker(q, marker.id, { label: e.target.value }));
          }}
        />
      </label>
      <div
        className="ed-chips"
        role="group"
        aria-label={t('editor.Inspector.whoSeesIt', 'Who sees it')}
      >
        {(['editor', 'players'] as const).map((v) => (
          <button
            key={v}
            className="chip"
            aria-pressed={(marker.visible ?? 'players') === v}
            onClick={() => st.apply((q) => updateMarker(q, marker.id, { visible: v }))}
          >
            {v === 'editor'
              ? t('editor.Inspector.editorOnly', 'Editor only')
              : t('editor.Inspector.playersSee', 'Players see')}
          </button>
        ))}
      </div>
    </>
  );
}

function ZoneFields({ store, zone }: { store: EditorStore; zone: Quest['zones'][number] }) {
  const st = store.getState();
  return (
    <>
      <p className="ed-note" data-testid="zone-size">
        {zone.cells.length}{' '}
        {zone.cells.length === 1
          ? t('editor.Inspector.square', 'square')
          : t('editor.Inspector.squares', 'squares')}
      </p>
      <button
        className="btn alt"
        onClick={() => {
          st.setTool('zones');
          st.setOpts({ zoneId: zone.id });
        }}
      >
        {t('editor.Inspector.editItsSquares', 'Edit its squares')}
      </button>
    </>
  );
}

function selectionLabel(selection: NonNullable<EditSelection>): string {
  switch (selection.kind) {
    case 'block':
      return t('editor.Inspector.square2', 'Square {v1}, {v2}', {
        v1: selection.cell[0],
        v2: selection.cell[1],
      });
    case 'tile':
      return t('editor.Inspector.tile', 'Tile {v1}', { v1: selection.index + 1 });
    case 'roomTile':
      return t('editor.Inspector.roomTile2', 'Room tile {v1}', { v1: selection.index + 1 });
    case 'tunnel':
      return `${selection.id}, end ${selection.end.toUpperCase()}`;
    default:
      return selection.id;
  }
}

type DoorView = {
  id: string;
  a: [number, number];
  b: [number, number];
  kind: DoorKind;
  hiddenUntil?: string;
  lockedUntil?: string;
};

function DoorFields({ store, door }: { store: EditorStore; door: DoorView }) {
  const st = store.getState();
  return (
    <>
      <div className="ed-chips">
        {DOOR_KINDS.map((d) => (
          <button
            key={d.kind}
            className="chip"
            aria-pressed={door.kind === d.kind}
            onClick={() => {
              st.apply((q) => setDoorKind(q, door.id, d.kind));
              // the id changes with the kind: select the door at the same edge again
              const q = store.getState().quest;
              const moved = [...q.doors, ...q.secretDoors, ...q.falseDoors].find(
                (x) =>
                  x.a[0] === door.a[0] &&
                  x.a[1] === door.a[1] &&
                  x.b[0] === door.b[0] &&
                  x.b[1] === door.b[1],
              );
              if (moved) st.select({ kind: 'door', id: moved.id });
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      <DoorFlagFields store={store} door={door} />
    </>
  );
}

function FurnitureFields({ store, furniture }: { store: EditorStore; furniture: FurnitureDef }) {
  const st = store.getState();
  const stairs = furniture.type === 'stairs';
  return (
    <>
      <label className="ed-field">
        {t('editor.Inspector.letter', 'Letter')}
        <input
          key={`${furniture.id}:${furniture.letter ?? ''}`}
          defaultValue={furniture.letter ?? ''}
          maxLength={1}
          disabled={stairs}
          placeholder={
            stairs
              ? t('editor.Inspector.stairsTakeNoLetter', 'Stairs take no letter')
              : t('editor.Inspector.none', 'None')
          }
          onChange={(e) => (e.target.value = e.target.value.toUpperCase())}
          onBlur={(e) => {
            const r = parseMapLetter(e.target.value);
            if (!r.ok) {
              e.target.value = furniture.letter ?? '';
              st.say(r.error);
              return;
            }
            if ((r.value ?? '') === (furniture.letter ?? '')) return;
            st.apply((q) => setFurnitureLetter(q, furniture.id, r.value));
          }}
        />
      </label>
      <button className="btn alt" onClick={() => rotateSelection(store)}>
        {t('editor.Inspector.rotate', 'Rotate')}
      </button>
      <p className="ed-note">
        {t(
          'editor.Inspector.rotateTurnsItA',
          'Rotate turns it a quarter turn (key R). It may overlap something in between: only the last position has to fit.',
        )}
      </p>
    </>
  );
}

/** The monster fields live in the Monsters tab only: here a short pointer to it. */
function MonsterPointer({ store }: { store: EditorStore }) {
  const st = store.getState();
  return (
    <>
      <p className="ed-note">
        {t(
          'editor.Inspector.statsSpellsAbilitiesAnd',
          'Stats, spells, abilities and behavior are edited in the Monsters tab.',
        )}
      </p>
      <button className="btn alt" onClick={() => st.setTab('Monsters')}>
        {t('editor.Inspector.editInTheMonsters', 'Edit in the Monsters tab')}
      </button>
    </>
  );
}

export function StatFields({
  store,
  monster,
  onSave,
}: {
  store: EditorStore;
  monster: MonsterDef;
  onSave(o: NonNullable<MonsterDef['overrides']>): void;
}) {
  // The starting point is the type's stats with the enemy's own stats on top (decision 70).
  const enemy = store.getState().quest.enemyDefs.find((e) => e.id === monster.enemy);
  const base = { ...MONSTER_STATS[monster.type], ...(enemy?.overrides ?? {}) };
  // The boxes show the stats the monster really has: its own, else the enemy's, else the type's.
  const [fields, setFields] = useState<Record<StatKey, string>>(() => ({
    move: String(monster.overrides?.move ?? base.move),
    att: String(monster.overrides?.att ?? base.att),
    def: String(monster.overrides?.def ?? base.def),
    body: String(monster.overrides?.body ?? base.body),
    mind: String(monster.overrides?.mind ?? base.mind),
  }));
  const commit = () => {
    // a box left at the starting value is no override
    const kept = Object.fromEntries(
      STAT_KEYS.map((k) => [k, fields[k] === String(base[k]) ? '' : fields[k]]),
    ) as Record<StatKey, string>;
    const r = parseOverrides(kept);
    if (!r.ok) {
      store.getState().say(r.error);
      return;
    }
    const same = STAT_KEYS.every((k) => r.overrides[k] === monster.overrides?.[k]);
    if (!same) onSave(r.overrides);
  };
  return (
    <>
      <div className="lbl">
        {t('editor.Inspector.statsTheyStartFrom', 'Stats (they start from the enemy or the type)')}
      </div>
      <div className="ed-stats">
        {STAT_KEYS.map((k) => (
          <label key={k} className="ed-field">
            {k}
            <input
              inputMode="numeric"
              value={fields[k]}
              placeholder={String(base[k])}
              maxLength={2}
              onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
              onBlur={commit}
            />
          </label>
        ))}
      </div>
    </>
  );
}

function TrapFields({ store, trap, quest }: { store: EditorStore; trap: TrapDef; quest: Quest }) {
  const st = store.getState();
  const patch = (p: Parameters<typeof updateTrap>[2]) => st.apply((q) => updateTrap(q, trap.id, p));
  const [mode, setMode] = useState<'cell' | 'furniture'>(trap.furniture ? 'furniture' : 'cell');
  const onFurniture = trap.kind === 'chest' || (trap.kind === 'scripted' && mode === 'furniture');

  const setKind = (kind: TrapKind) => {
    if (kind === trap.kind) return;
    // Carry the place over when the new kind needs the other sort of place.
    const owner = trap.furniture ? quest.furniture.find((f) => f.id === trap.furniture) : undefined;
    if (kind === 'chest' && !trap.furniture) {
      const free = quest.furniture.find(
        (f) => f.type === 'chest' && !quest.traps.some((t) => t.furniture === f.id),
      );
      patch(free ? { kind, target: { furniture: free.id } } : { kind });
    } else if (kind !== 'chest' && kind !== 'scripted' && !trap.cell) {
      const c = owner?.cells[0];
      patch(c ? { kind, target: { cell: [c[0], c[1]] } } : { kind });
    } else patch({ kind });
    setMode(kind === 'chest' ? 'furniture' : kind === 'scripted' ? mode : 'cell');
  };

  return (
    <>
      <div className="lbl">{t('editor.Inspector.kind', 'Kind')}</div>
      <div className="ed-chips ed-small">
        {TRAP_KINDS_ALL.map((k) => (
          <button
            key={k.kind}
            className="chip"
            aria-pressed={trap.kind === k.kind}
            onClick={() => setKind(k.kind)}
          >
            {k.label}
          </button>
        ))}
      </div>

      {trap.kind === 'scripted' && (
        <div className="ed-chips">
          <button className="chip" aria-pressed={mode === 'cell'} onClick={() => setMode('cell')}>
            {t('editor.Inspector.onASquare', 'On a square')}
          </button>
          <button
            className="chip"
            aria-pressed={mode === 'furniture'}
            onClick={() => setMode('furniture')}
          >
            {t('editor.Inspector.onFurniture', 'On furniture')}
          </button>
        </div>
      )}

      {onFurniture ? (
        <label className="ed-field">
          {t('editor.Inspector.furniture', 'Furniture')}
          <select
            className="es-select"
            value={trap.furniture ?? ''}
            onChange={(e) => e.target.value && patch({ target: { furniture: e.target.value } })}
          >
            {!trap.furniture && (
              <option value="">{t('editor.Inspector.pickAPiece', 'Pick a piece')}</option>
            )}
            {quest.furniture
              .filter(
                (f) =>
                  f.id === trap.furniture ||
                  (f.type !== 'stairs' && !quest.traps.some((t) => t.furniture === f.id)),
              )
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id} · {FURNITURE_NAMES[f.type]}
                </option>
              ))}
          </select>
        </label>
      ) : (
        <CellFields
          key={`${trap.id}:${trap.cell?.join(',') ?? ''}`}
          cell={trap.cell}
          onSave={(c) => patch({ target: { cell: c } })}
          say={(t) => st.say(t)}
        />
      )}

      <label className="ed-field">
        {t('editor.Inspector.effect', 'Effect')}
        <textarea
          key={`${trap.id}:${trap.effect ?? ''}`}
          defaultValue={trap.effect ?? ''}
          rows={3}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v === (trap.effect ?? '')) return;
            patch({ effect: v === '' ? null : v });
          }}
        />
      </label>
    </>
  );
}

function CellFields({
  cell,
  onSave,
  say,
}: {
  cell: [number, number] | undefined;
  onSave(c: [number, number]): void;
  say(text: string): void;
}) {
  const [x, setX] = useState(cell ? String(cell[0]) : '');
  const [y, setY] = useState(cell ? String(cell[1]) : '');
  const commit = () => {
    if (x.trim() === '' || y.trim() === '') return;
    if (!/^\d+$/.test(x.trim()) || !/^\d+$/.test(y.trim()))
      return say('A square is two whole numbers: across (0 to 25) and down (0 to 18).');
    const c: [number, number] = [Number(x), Number(y)];
    if (cell && c[0] === cell[0] && c[1] === cell[1]) return;
    if (c[0] > 25 || c[1] > 18)
      return say(
        t(
          'editor.Inspector.thatSquareIsOff',
          'That square is off the board. Across 0 to 25, down 0 to 18.',
        ),
      );
    onSave(c);
  };
  return (
    <div className="ed-stats">
      <label className="ed-field">
        {t('editor.Inspector.across', 'Across')}
        <input
          inputMode="numeric"
          value={x}
          maxLength={2}
          onChange={(e) => setX(e.target.value)}
          onBlur={commit}
        />
      </label>
      <label className="ed-field">
        {t('editor.Inspector.down', 'Down')}
        <input
          inputMode="numeric"
          value={y}
          maxLength={2}
          onChange={(e) => setY(e.target.value)}
          onBlur={commit}
        />
      </label>
    </div>
  );
}

function findDoor(quest: Quest, id: string): DoorView | undefined {
  const all = [
    ...quest.doors.map((door) => ({ door, kind: 'normal' as const })),
    ...quest.secretDoors.map((door) => ({ door, kind: 'secret' as const })),
    ...quest.falseDoors.map((door) => ({ door, kind: 'false' as const })),
  ];
  const f = all.find((x) => x.door.id === id);
  return f ? ({ ...f.door, kind: f.kind } as DoorView) : undefined;
}

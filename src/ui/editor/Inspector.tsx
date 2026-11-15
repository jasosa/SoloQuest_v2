/**
 * The inspector (right column of the editor): the quest title and summary, then the properties of
 * the selected element. Every change is an engine edit operation through the store, so undo and
 * redo work and a refused change shows the engine sentence as a toast. Text fields save when
 * they lose focus; chips save at once.
 */
import { useState } from 'react';
import { useStore } from 'zustand';
import {
  lettersMissingNotes,
  renameQuest,
  setDoorKind,
  setFurnitureLetter,
  setSummary,
  updateMonster,
  updateTrap,
  type DoorKind,
  type Issue,
  type MonsterKind,
  type TrapKind,
} from '../../engine/editor';
import { MONSTER_NAMES, MONSTER_STATS } from '../../engine/data/monsters';
import {
  MONSTER_TYPES,
  type FurnitureDef,
  type MonsterDef,
  type Quest,
  type TrapDef,
} from '../../engine/quest/schema';
import { SPELL_KEYS, SPELL_NAMES, isSpellKey } from '../../engine/zargon/spells';
import { FURNITURE_NAMES } from '../board/furnitureNames';
import type { EditorStore, EditSelection } from './editorStore';
import { NotesPanel } from './NotesPanel';
import { ProblemsPanel } from './ProblemsPanel';
import { parseMapLetter } from './noteForms';
import { STAT_KEYS, parseLines, parseOverrides, toggleIn, type StatKey } from './inspectorForms';
import { deleteSelection, rotateSelection } from './selectionActions';

export const DOOR_KINDS: readonly { kind: DoorKind; label: string }[] = [
  { kind: 'normal', label: 'Normal' },
  { kind: 'secret', label: 'Secret' },
  { kind: 'false', label: 'False' },
];

const TRAP_KINDS_ALL: readonly { kind: TrapKind; label: string }[] = [
  { kind: 'pit', label: 'Pit' },
  { kind: 'fallingBlock', label: 'Falling block' },
  { kind: 'spear', label: 'Spear' },
  { kind: 'chest', label: 'Chest' },
  { kind: 'scripted', label: 'Scripted' },
];

const STATES: readonly { state: NonNullable<MonsterDef['state']>; label: string }[] = [
  { state: 'active', label: 'Active' },
  { state: 'dormant', label: 'Dormant' },
  { state: 'stone', label: 'Stone' },
];

const SELECTION_NAMES: Record<NonNullable<EditSelection>['kind'], string> = {
  door: 'Door',
  block: 'Block',
  furniture: 'Furniture',
  monster: 'Monster',
  trap: 'Trap',
  marker: 'Marker',
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
  const missing = lettersMissingNotes(quest).length;

  const door = selection?.kind === 'door' ? findDoor(quest, selection.id) : undefined;
  const furniture =
    selection?.kind === 'furniture'
      ? quest.furniture.find((f) => f.id === selection.id)
      : undefined;
  const monster =
    selection?.kind === 'monster' ? quest.monsters.find((m) => m.id === selection.id) : undefined;
  const trap =
    selection?.kind === 'trap' ? quest.traps.find((t) => t.id === selection.id) : undefined;

  const tabs = (
    <div className="ed-chips ed-tabs" role="group" aria-label="Inspector tabs">
      <button
        className="chip"
        aria-pressed={panel === 'element'}
        onClick={() => st.setPanel('element')}
      >
        Element
      </button>
      <button
        className="chip"
        aria-pressed={panel === 'notes'}
        aria-label={missing > 0 ? `Notes, ${missing} missing` : 'Notes'}
        onClick={() => st.setPanel('notes')}
      >
        Notes
        {missing > 0 && (
          <span className="ed-badge" data-testid="missing-count">
            {missing}
          </span>
        )}
      </button>
      <button
        className="chip"
        aria-pressed={panel === 'problems'}
        aria-label={issues.length > 0 ? `Problems, ${issues.length}` : 'Problems'}
        onClick={() => st.setPanel('problems')}
      >
        Problems
        {issues.length > 0 && (
          <span className="ed-badge" data-testid="problem-count">
            {issues.length}
          </span>
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

  if (panel === 'notes')
    return (
      <>
        {tabs}
        <NotesPanel store={store} />
      </>
    );

  return (
    <>
      {tabs}
      <section>
        <div className="lbl">Quest</div>
        <label className="ed-field">
          Title
          <input
            key={quest.title}
            defaultValue={quest.title}
            maxLength={80}
            onBlur={(e) => {
              if (e.target.value !== quest.title) st.apply((q) => renameQuest(q, e.target.value));
            }}
          />
        </label>
        <p className="ed-note">Number {quest.number}</p>
        <label className="ed-field">
          Summary
          <textarea
            key={quest.intro.summary}
            defaultValue={quest.intro.summary}
            rows={4}
            onBlur={(e) => {
              if (e.target.value !== quest.intro.summary)
                st.apply((q) => setSummary(q, e.target.value));
            }}
          />
        </label>
      </section>

      {saveErrors && (
        <section className="ed-save-errors" role="alert">
          <div className="lbl">Cannot save yet</div>
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
            {selection.kind === 'block'
              ? `Square ${selection.cell[0]}, ${selection.cell[1]}`
              : selection.id}
            {furniture ? ` · ${FURNITURE_NAMES[furniture.type]}` : ''}
            {monster ? ` · ${MONSTER_NAMES[monster.type]}` : ''}
          </p>
          {door && <DoorFields store={store} door={door} />}
          {furniture && <FurnitureFields store={store} furniture={furniture} />}
          {monster && <MonsterFields store={store} monster={monster} />}
          {trap && <TrapFields key={trap.id} store={store} trap={trap} quest={quest} />}
          <button className="btn" onClick={() => deleteSelection(store)}>
            Delete
          </button>
        </section>
      ) : null}
    </>
  );
}

type DoorView = { id: string; a: [number, number]; b: [number, number]; kind: DoorKind };

function DoorFields({ store, door }: { store: EditorStore; door: DoorView }) {
  const st = store.getState();
  return (
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
  );
}

function FurnitureFields({ store, furniture }: { store: EditorStore; furniture: FurnitureDef }) {
  const st = store.getState();
  const stairs = furniture.type === 'stairs';
  return (
    <>
      <label className="ed-field">
        Letter
        <input
          key={`${furniture.id}:${furniture.letter ?? ''}`}
          defaultValue={furniture.letter ?? ''}
          maxLength={1}
          disabled={stairs}
          placeholder={stairs ? 'Stairs take no letter' : 'None'}
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
        Rotate
      </button>
    </>
  );
}

function MonsterFields({ store, monster }: { store: EditorStore; monster: MonsterDef }) {
  const st = store.getState();
  const patch = (p: Parameters<typeof updateMonster>[2]) =>
    st.apply((q) => updateMonster(q, monster.id, p));
  const spells = (monster.spells ?? []).filter(isSpellKey);
  const state = monster.state ?? 'active';

  return (
    <>
      <div className="lbl">Type</div>
      <div className="ed-chips ed-small">
        {MONSTER_TYPES.map((t: MonsterKind) => (
          <button
            key={t}
            className="chip"
            aria-pressed={monster.type === t}
            onClick={() => patch({ type: t })}
          >
            {MONSTER_NAMES[t]}
          </button>
        ))}
      </div>

      <label className="ed-field">
        Name
        <input
          key={`${monster.id}:${monster.name ?? ''}`}
          defaultValue={monster.name ?? ''}
          maxLength={60}
          placeholder={MONSTER_NAMES[monster.type]}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v === (monster.name ?? '')) return;
            patch({ name: v === '' ? null : v });
          }}
        />
      </label>

      <div className="lbl">State</div>
      <div className="ed-chips">
        {STATES.map((s) => (
          <button
            key={s.state}
            className="chip"
            aria-pressed={state === s.state}
            onClick={() => patch({ state: s.state === 'active' ? null : s.state })}
          >
            {s.label}
          </button>
        ))}
        <button
          className="chip"
          aria-pressed={monster.hidden === true}
          onClick={() => patch({ hidden: monster.hidden === true ? null : true })}
        >
          Hidden
        </button>
      </div>
      <p className="ed-note">Hidden: not on the board until a note brings it in.</p>

      <StatFields
        key={`${monster.id}:${monster.type}:${JSON.stringify(monster.overrides ?? {})}`}
        store={store}
        monster={monster}
        onSave={(o) => patch({ overrides: o })}
      />

      <div className="lbl">Spells</div>
      <div className="ed-chips ed-small">
        {SPELL_KEYS.map((k) => (
          <button
            key={k}
            className="chip"
            aria-pressed={spells.includes(k)}
            onClick={() => {
              const next = toggleIn(spells, k, SPELL_KEYS);
              // a spell limit without spells is refused: drop it with the last spell
              patch(next.length === 0 ? { spells: null, spellLimit: null } : { spells: next });
            }}
          >
            {SPELL_NAMES[k]}
          </button>
        ))}
      </div>
      <button
        className="chip ed-wide"
        aria-pressed={monster.spellLimit === 'onePerTurn'}
        disabled={spells.length === 0}
        onClick={() => patch({ spellLimit: monster.spellLimit ? null : 'onePerTurn' })}
      >
        One spell each turn
      </button>

      <label className="ed-field">
        Traits (one per line)
        <textarea
          key={`${monster.id}:${(monster.traits ?? []).join('\n')}`}
          defaultValue={(monster.traits ?? []).join('\n')}
          rows={3}
          onBlur={(e) => {
            const next = parseLines(e.target.value);
            if (next.join('\n') === (monster.traits ?? []).join('\n')) return;
            patch({ traits: next });
          }}
        />
      </label>
    </>
  );
}

function StatFields({
  store,
  monster,
  onSave,
}: {
  store: EditorStore;
  monster: MonsterDef;
  onSave(o: NonNullable<MonsterDef['overrides']>): void;
}) {
  const base = MONSTER_STATS[monster.type];
  const [fields, setFields] = useState<Record<StatKey, string>>(() => ({
    move: String(monster.overrides?.move ?? ''),
    att: String(monster.overrides?.att ?? ''),
    def: String(monster.overrides?.def ?? ''),
    body: String(monster.overrides?.body ?? ''),
    mind: String(monster.overrides?.mind ?? ''),
  }));
  const commit = () => {
    const r = parseOverrides(fields);
    if (!r.ok) {
      store.getState().say(r.error);
      return;
    }
    const same = STAT_KEYS.every((k) => r.overrides[k] === monster.overrides?.[k]);
    if (!same) onSave(r.overrides);
  };
  return (
    <>
      <div className="lbl">Stats (empty keeps the base)</div>
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
    } else if ((kind === 'pit' || kind === 'fallingBlock' || kind === 'spear') && !trap.cell) {
      const c = owner?.cells[0];
      patch(c ? { kind, target: { cell: [c[0], c[1]] } } : { kind });
    } else patch({ kind });
    setMode(kind === 'chest' ? 'furniture' : kind === 'scripted' ? mode : 'cell');
  };

  return (
    <>
      <div className="lbl">Kind</div>
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
            On a square
          </button>
          <button
            className="chip"
            aria-pressed={mode === 'furniture'}
            onClick={() => setMode('furniture')}
          >
            On furniture
          </button>
        </div>
      )}

      {onFurniture ? (
        <label className="ed-field">
          Furniture
          <select
            className="es-select"
            value={trap.furniture ?? ''}
            onChange={(e) => e.target.value && patch({ target: { furniture: e.target.value } })}
          >
            {!trap.furniture && <option value="">Pick a piece</option>}
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
        Effect
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
      return say('That square is off the board. Across 0 to 25, down 0 to 18.');
    onSave(c);
  };
  return (
    <div className="ed-stats">
      <label className="ed-field">
        Across
        <input
          inputMode="numeric"
          value={x}
          maxLength={2}
          onChange={(e) => setX(e.target.value)}
          onBlur={commit}
        />
      </label>
      <label className="ed-field">
        Down
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

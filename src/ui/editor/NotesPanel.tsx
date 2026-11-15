/**
 * The note builder (the "Notes" tab of the inspector): the list of notes A..Z and the ones
 * without a letter, the letters on the map that still have no note, and the form of one note
 * (text, trigger, conditions, effects). Every change is an engine edit operation through the
 * store, so undo and redo work and a refused change shows the engine sentence as a toast.
 * Targets (a door, a square, an area) are chosen from a list or by clicking on the board.
 */
import { useStore } from 'zustand';
import { board, roomIds } from '../../engine/board/board';
import {
  addNote,
  lettersMissingNotes,
  removeNote,
  setNoteText,
  updateNote,
  type NotePatch,
} from '../../engine/editor';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import {
  MONSTER_TYPES,
  type Condition,
  type Effect,
  type Note,
  type Quest,
  type Trigger,
} from '../../engine/quest/schema';
import { SPELL_KEYS, SPELL_NAMES } from '../../engine/zargon/spells';
import type { Cell } from '../../engine/editor';
import type { EditorStore, PickKind } from './editorStore';
import {
  CONDITION_TYPES,
  EFFECT_TYPES,
  TRIGGER_TYPES,
  cellText,
  conditionKey,
  defaultCondition,
  defaultEffect,
  defaultTrigger,
  mainText,
  mainTextIndex,
  orderedNotes,
  parseMapLetter,
  parseWhole,
  removeAt,
  replaceAt,
  triggerSummary,
  type ConditionKey,
} from './noteForms';

const ROOMS = roomIds(board);

export function NotesPanel({ store }: { store: EditorStore }) {
  const { quest, noteId, picking } = useStore(store);
  const st = store.getState();
  const note = noteId ? quest.notes.find((n) => n.id === noteId) : undefined;
  const missing = lettersMissingNotes(quest);

  return (
    <>
      {picking && (
        <div className="ed-pickbar" role="status" data-testid="pick-bar">
          <span>{picking.hint}</span>
          <button className="btn alt" onClick={() => st.setPicking(null)}>
            Cancel
          </button>
        </div>
      )}
      {note ? (
        <NoteForm key={note.id} store={store} note={note} quest={quest} />
      ) : (
        <>
          <section>
            <div className="lbl">Letters on the map with no note</div>
            {missing.length === 0 ? (
              <p className="ed-note" data-testid="no-missing">
                Every letter on the map has a note.
              </p>
            ) : (
              <div className="ed-chips" data-testid="missing-letters">
                {missing.map((l) => (
                  <button
                    key={l}
                    className="chip"
                    onClick={() => {
                      if (st.apply((q) => addNote(q, { letter: l }))) {
                        const made = store.getState().quest.notes.find((n) => n.letter === l);
                        if (made) st.setNoteId(made.id);
                      }
                    }}
                  >
                    Add note {l}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section>
            <div className="lbl">Notes</div>
            {quest.notes.length === 0 ? (
              <p className="ed-note">No notes yet.</p>
            ) : (
              <ul className="ed-notelist" data-testid="note-list">
                {orderedNotes(quest).map((n) => (
                  <li key={n.id}>
                    <button onClick={() => st.setNoteId(n.id)}>
                      <b>{n.letter ?? '·'}</b>
                      <span>{triggerSummary(n.trigger)}</span>
                      <i>{mainText(n)}</i>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="btn"
              onClick={() => {
                if (st.apply((q) => addNote(q, {}))) {
                  const q = store.getState().quest;
                  const made = q.notes[q.notes.length - 1];
                  if (made) st.setNoteId(made.id);
                }
              }}
            >
              New note
            </button>
          </section>
        </>
      )}
    </>
  );
}

// ---- small form pieces

function Text({
  label,
  value,
  onSave,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onSave(v: string): void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const save = (v: string) => {
    if (v !== value) onSave(v);
  };
  return (
    <label className="ed-field">
      {label}
      {multiline ? (
        <textarea
          key={value}
          defaultValue={value}
          rows={3}
          placeholder={placeholder}
          onBlur={(e) => save(e.target.value.trim())}
        />
      ) : (
        <input
          key={value}
          defaultValue={value}
          placeholder={placeholder}
          onBlur={(e) => save(e.target.value.trim())}
        />
      )}
    </label>
  );
}

/** A whole number field. Empty is allowed when `optional`. A bad value says why and is dropped. */
function Num({
  store,
  label,
  value,
  onSave,
  optional,
  min,
  negative,
}: {
  store: EditorStore;
  label: string;
  value: number | undefined;
  onSave(v: number | undefined): void;
  optional?: boolean;
  min?: number;
  negative?: boolean;
}) {
  return (
    <label className="ed-field">
      {label}
      <input
        key={String(value ?? '')}
        inputMode="numeric"
        defaultValue={value === undefined ? '' : String(value)}
        onBlur={(e) => {
          const r = parseWhole(e.target.value, { optional, min, negative });
          if (!r.ok) {
            e.target.value = value === undefined ? '' : String(value);
            store.getState().say(`${label}: ${r.error}`);
          } else if (r.value !== value) onSave(r.value);
        }}
      />
    </label>
  );
}

function Pick({
  store,
  kind,
  hint,
  label,
  onPick,
}: {
  store: EditorStore;
  kind: PickKind;
  hint: string;
  label: string;
  onPick(v: string | Cell): void;
}) {
  return (
    <button
      className="btn alt ed-pick"
      onClick={() => store.getState().setPicking({ kind, hint, onPick })}
    >
      {label}
    </button>
  );
}

function Choose({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange(v: string): void;
}) {
  const known = options.some((o) => o.value === value);
  return (
    <label className="ed-field">
      {label}
      <select className="es-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {!known && (
          <option value={value}>{value === '' ? 'Pick one' : `${value} (missing)`}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange(v: T): void;
}) {
  return (
    <div className="ed-chips">
      {options.map((o) => (
        <button
          key={o.value}
          className="chip"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const YES_NO = (yes: string, no: string) =>
  [
    { value: 'yes', label: yes },
    { value: 'no', label: no },
  ] as const;

const monsterOptions = (q: Quest) =>
  q.monsters.map((m) => ({
    value: m.id,
    label: `${m.id} · ${m.name ?? MONSTER_NAMES[m.type]}`,
  }));

const areaOptions = (withCorridor: boolean) =>
  [...(withCorridor ? ['C'] : []), ...ROOMS].map((a) => ({
    value: a,
    label: a === 'C' ? 'Corridor' : a,
  }));

function AreaField({
  store,
  label,
  value,
  onChange,
  corridor,
}: {
  store: EditorStore;
  label: string;
  value: string;
  onChange(v: string): void;
  corridor?: boolean;
}) {
  return (
    <>
      <Choose label={label} value={value} options={areaOptions(!!corridor)} onChange={onChange} />
      <Pick
        store={store}
        kind={corridor ? 'area' : 'room'}
        hint="Click a room or corridor on the board."
        label="Click it on the board"
        onPick={(v) => onChange(v as string)}
      />
    </>
  );
}

function CellField({
  store,
  label,
  value,
  onChange,
  onClear,
}: {
  store: EditorStore;
  label: string;
  value: Cell | undefined;
  onChange(c: Cell): void;
  onClear?: () => void;
}) {
  return (
    <div className="ed-cellfield">
      <div className="lbl">{label}</div>
      <p className="ed-id">{value ? `Square ${cellText(value)}` : 'No square'}</p>
      <div className="ed-chips">
        <Pick
          store={store}
          kind="cell"
          hint="Click a square on the board."
          label="Click it on the board"
          onPick={(v) => onChange(v as Cell)}
        />
        {onClear && value && (
          <button className="btn alt ed-pick" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ---- one note

function NoteForm({ store, note, quest }: { store: EditorStore; note: Note; quest: Quest }) {
  const st = store.getState();
  const patch = (p: NotePatch) => st.apply((q) => updateNote(q, note.id, p));
  const skip = mainTextIndex(note);

  return (
    <>
      <section>
        <button className="link ed-back" onClick={() => st.setNoteId(null)}>
          All notes
        </button>
        <div className="lbl">Note {note.letter ?? '(no letter)'}</div>
        <p className="ed-id" data-testid="note-id">
          {note.id}
        </p>
        <LetterField
          key={`${note.id}:${note.letter ?? ''}`}
          store={store}
          value={note.letter}
          onSave={(l) => patch({ letter: l })}
        />
        <CellField
          store={store}
          label="Letter drawn at"
          value={note.at as Cell | undefined}
          onChange={(c) => patch({ at: c })}
          onClear={() => patch({ at: null })}
        />
        <Text
          label="Text"
          value={mainText(note)}
          multiline
          placeholder="What the players read"
          onSave={(v) => st.apply((q) => setNoteText(q, note.id, v))}
        />
        <button
          className="chip ed-wide"
          aria-pressed={note.consumesTreasure === true}
          onClick={() => patch({ consumesTreasure: note.consumesTreasure ? null : true })}
        >
          No treasure card is drawn
        </button>
      </section>

      <section>
        <div className="lbl">When it fires</div>
        <TriggerForm
          store={store}
          quest={quest}
          trigger={note.trigger}
          onChange={(t) => patch({ trigger: t })}
        />
      </section>

      <section>
        <div className="lbl">Only if</div>
        <ConditionList
          store={store}
          quest={quest}
          conditions={note.when ?? []}
          onChange={(c) => patch({ when: c })}
        />
      </section>

      <section>
        <div className="lbl">Then</div>
        <EffectList
          store={store}
          quest={quest}
          effects={note.effects}
          skip={skip}
          onChange={(e) => patch({ effects: e })}
        />
      </section>

      <section>
        <button
          className="btn"
          onClick={() => {
            if (st.apply((q) => removeNote(q, note.id))) st.setNoteId(null);
          }}
        >
          Delete note
        </button>
      </section>
    </>
  );
}

function LetterField({
  store,
  value,
  onSave,
}: {
  store: EditorStore;
  value: string | undefined;
  onSave(l: string | null): void;
}) {
  return (
    <label className="ed-field">
      Letter
      <input
        defaultValue={value ?? ''}
        maxLength={1}
        placeholder="None"
        onChange={(e) => (e.target.value = e.target.value.toUpperCase())}
        onBlur={(e) => {
          const r = parseMapLetter(e.target.value);
          if (!r.ok) {
            e.target.value = value ?? '';
            store.getState().say(r.error);
          } else if (r.value !== (value ?? null)) onSave(r.value);
        }}
      />
    </label>
  );
}

// ---- trigger

function TriggerForm({
  store,
  quest,
  trigger: t,
  onChange,
}: {
  store: EditorStore;
  quest: Quest;
  trigger: Trigger;
  onChange(t: Trigger): void;
}) {
  const doors = quest.doors.map((d) => ({ value: d.id, label: d.id }));
  const secret = quest.secretDoors.map((d) => ({ value: d.id, label: `${d.id} (secret)` }));
  const traps = quest.traps.map((x) => ({ value: x.id, label: `${x.id} · ${x.kind}` }));
  const monsters = monsterOptions(quest);

  return (
    <>
      <Choose
        label="Trigger"
        value={t.type}
        options={TRIGGER_TYPES.map((x) => ({ value: x.type, label: x.label }))}
        onChange={(type) => {
          if (type === t.type) return;
          const r = defaultTrigger(quest, type as Trigger['type']);
          if (r.ok) onChange(r.value);
          else store.getState().say(r.error);
        }}
      />
      {t.type === 'manual' && (
        <Text
          label="Button label"
          value={t.label}
          onSave={(v) => v && onChange({ ...t, label: v })}
        />
      )}
      {(t.type === 'areaRevealed' || t.type === 'areaEntered' || t.type === 'secretDoorSearch') && (
        <AreaField
          store={store}
          label="Area"
          value={t.area}
          corridor={t.type !== 'areaRevealed'}
          onChange={(area) => onChange({ ...t, area })}
        />
      )}
      {t.type === 'treasureSearch' && (
        <>
          <AreaField
            store={store}
            label="Area"
            value={t.area}
            corridor
            onChange={(area) => onChange({ ...t, area })}
          />
          <button
            className="chip ed-wide"
            aria-pressed={t.first === true}
            onClick={() =>
              onChange(t.first ? { type: t.type, area: t.area } : { ...t, first: true })
            }
          >
            First search of the room only
          </button>
        </>
      )}
      {t.type === 'doorOpened' && (
        <>
          <Choose
            label="Door"
            value={t.door}
            options={[...doors, ...secret]}
            onChange={(door) => onChange({ ...t, door })}
          />
          <Pick
            store={store}
            kind="door"
            hint="Click a door on the board."
            label="Click it on the board"
            onPick={(v) => onChange({ ...t, door: v as string })}
          />
        </>
      )}
      {t.type === 'squareEntered' && (
        <>
          <CellField
            store={store}
            label="Square"
            value={t.cell as Cell}
            onChange={(cell) => onChange({ ...t, cell })}
          />
          <button
            className="chip ed-wide"
            aria-pressed={t.repeat === true}
            onClick={() =>
              onChange(t.repeat ? { type: t.type, cell: t.cell } : { ...t, repeat: true })
            }
          >
            Fires every time
          </button>
        </>
      )}
      {(t.type === 'trapSprung' || t.type === 'trapDisarmed') && (
        <Choose
          label="Trap"
          value={t.trap}
          options={traps}
          onChange={(trap) => onChange({ ...t, trap })}
        />
      )}
      {t.type === 'monsterKilled' && (
        <>
          <Chips
            value={t.monsterType !== undefined ? 'type' : 'one'}
            options={[
              { value: 'one', label: 'One monster' },
              { value: 'type', label: 'A kind' },
            ]}
            onChange={(mode) => {
              if (mode === 'type') onChange({ type: t.type, monsterType: 'orc' });
              else {
                const m = quest.monsters[0];
                if (m) onChange({ type: t.type, monster: m.id });
                else store.getState().say('Add a monster first.');
              }
            }}
          />
          {t.monsterType !== undefined ? (
            <Choose
              label="Kind"
              value={t.monsterType}
              options={MONSTER_TYPES.map((m) => ({ value: m, label: MONSTER_NAMES[m] }))}
              onChange={(m) =>
                onChange({ type: t.type, monsterType: m as (typeof MONSTER_TYPES)[number] })
              }
            />
          ) : (
            <Choose
              label="Monster"
              value={t.monster ?? ''}
              options={monsters}
              onChange={(monster) => onChange({ type: t.type, monster })}
            />
          )}
        </>
      )}
      {t.type === 'allKilled' && (
        <>
          <div className="lbl">All of these</div>
          <div className="ed-chips ed-small">
            {quest.monsters.map((m) => {
              const on = t.monsters.includes(m.id);
              return (
                <button
                  key={m.id}
                  className="chip"
                  aria-pressed={on}
                  onClick={() => {
                    const next = on ? t.monsters.filter((x) => x !== m.id) : [...t.monsters, m.id];
                    if (next.length === 0) store.getState().say('Keep at least one monster.');
                    else onChange({ ...t, monsters: next });
                  }}
                >
                  {m.id}
                </button>
              );
            })}
          </div>
        </>
      )}
      {t.type === 'spellCast' && (
        <>
          <Choose
            label="Monster"
            value={t.monster ?? ''}
            options={[{ value: '', label: 'Any monster' }, ...monsters]}
            onChange={(monster) => onChange(withOptional(t, 'monster', monster))}
          />
          <Choose
            label="Spell"
            value={t.spell ?? ''}
            options={[
              { value: '', label: 'Any spell' },
              ...SPELL_KEYS.map((k) => ({ value: k, label: SPELL_NAMES[k] })),
            ]}
            onChange={(spell) => onChange(withOptional(t, 'spell', spell))}
          />
        </>
      )}
      {t.type === 'zargonTurn' && (
        <div className="ed-stats ed-two">
          <Num
            store={store}
            label="Turn"
            value={t.n}
            optional
            min={1}
            onSave={(n) => onChange(withOptional(t, 'n', n))}
          />
          <Num
            store={store}
            label="Every"
            value={t.every}
            optional
            min={1}
            onSave={(every) => onChange(withOptional(t, 'every', every))}
          />
        </div>
      )}
    </>
  );
}

/** Set an optional field, or drop it when the value is empty or undefined. */
function withOptional<T extends object, K extends string>(
  obj: T,
  key: K,
  value: string | number | undefined,
): T {
  const next = { ...obj } as Record<string, unknown>;
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  return next as T;
}

// ---- conditions

function ConditionList({
  store,
  quest,
  conditions,
  onChange,
}: {
  store: EditorStore;
  quest: Quest;
  conditions: readonly Condition[];
  onChange(c: Condition[]): void;
}) {
  return (
    <>
      {conditions.map((c, i) => (
        <div className="ed-row" key={`${i}:${JSON.stringify(c)}`} data-testid="condition-row">
          <div className="ed-row-head">
            <span>{CONDITION_TYPES.find((x) => x.key === conditionKey(c))?.label}</span>
            <button
              className="chip"
              aria-label="Remove condition"
              onClick={() => onChange(removeAt(conditions, i))}
            >
              Remove
            </button>
          </div>
          <ConditionFields
            store={store}
            quest={quest}
            condition={c}
            onChange={(n) => onChange(replaceAt(conditions, i, n))}
          />
        </div>
      ))}
      <label className="ed-field">
        <select
          className="es-select"
          aria-label="Add a condition"
          value=""
          onChange={(e) => {
            const r = defaultCondition(quest, e.target.value as ConditionKey);
            if (r.ok) onChange([...conditions, r.value]);
            else store.getState().say(r.error);
          }}
        >
          <option value="">Add a condition</option>
          {CONDITION_TYPES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function ConditionFields({
  store,
  quest,
  condition: c,
  onChange,
}: {
  store: EditorStore;
  quest: Quest;
  condition: Condition;
  onChange(c: Condition): void;
}) {
  if ('flag' in c)
    return (
      <>
        <Text label="Flag" value={c.flag} onSave={(v) => v && onChange({ ...c, flag: v })} />
        <Chips
          value={c.is ? 'yes' : 'no'}
          options={YES_NO('Is set', 'Is not set')}
          onChange={(v) => onChange({ ...c, is: v === 'yes' })}
        />
      </>
    );
  if ('counter' in c)
    return (
      <>
        <Text
          label="Counter"
          value={c.counter}
          onSave={(v) => v && onChange({ ...c, counter: v })}
        />
        <Num
          store={store}
          label="At least"
          value={c.gte}
          negative
          onSave={(gte) => gte !== undefined && onChange({ ...c, gte })}
        />
      </>
    );
  if ('monster' in c)
    return (
      <>
        <Choose
          label="Monster"
          value={c.monster}
          options={monsterOptions(quest)}
          onChange={(monster) => onChange({ ...c, monster })}
        />
        <Chips
          value={c.alive ? 'yes' : 'no'}
          options={YES_NO('Alive', 'Slain')}
          onChange={(v) => onChange({ ...c, alive: v === 'yes' })}
        />
      </>
    );
  if ('monstersAliveIn' in c)
    return (
      <>
        <AreaField
          store={store}
          label="Area"
          value={c.monstersAliveIn}
          corridor
          onChange={(monstersAliveIn) => onChange({ ...c, monstersAliveIn })}
        />
        <Num
          store={store}
          label="Monsters alive"
          value={c.is}
          min={0}
          onSave={(n) => n !== undefined && onChange({ ...c, is: n })}
        />
      </>
    );
  return <p className="ed-note">Only the first time this note fires.</p>;
}

// ---- effects

function EffectList({
  store,
  quest,
  effects,
  skip,
  onChange,
}: {
  store: EditorStore;
  quest: Quest;
  effects: readonly Effect[];
  /** Index of the effect the "Text" field already shows. */
  skip?: number;
  onChange(e: Effect[]): void;
}) {
  return (
    <>
      {effects.map((e, i) =>
        i === skip ? null : (
          <div
            className="ed-row"
            key={`${i}:${e.type}`}
            data-testid="effect-row"
            data-effect={e.type}
          >
            <div className="ed-row-head">
              <span>{EFFECT_TYPES.find((x) => x.type === e.type)?.label}</span>
              <button
                className="chip"
                aria-label={`Remove effect ${EFFECT_TYPES.find((x) => x.type === e.type)?.label}`}
                onClick={() => onChange(removeAt(effects, i))}
              >
                Remove
              </button>
            </div>
            <EffectFields
              store={store}
              quest={quest}
              effect={e}
              onChange={(n) => onChange(replaceAt(effects, i, n))}
            />
          </div>
        ),
      )}
      <label className="ed-field">
        <select
          className="es-select"
          aria-label="Add an effect"
          value=""
          onChange={(ev) => {
            if (!ev.target.value) return;
            const r = defaultEffect(quest, ev.target.value as Effect['type']);
            if (r.ok) onChange([...effects, r.value]);
            else store.getState().say(r.error);
          }}
        >
          <option value="">Add an effect</option>
          {EFFECT_TYPES.map((x) => (
            <option key={x.type} value={x.type}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

const STATE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'stone', label: 'Stone' },
] as const;

function EffectFields({
  store,
  quest,
  effect: e,
  onChange,
}: {
  store: EditorStore;
  quest: Quest;
  effect: Effect;
  onChange(e: Effect): void;
}) {
  switch (e.type) {
    case 'showText':
      return (
        <>
          <Text
            label="Text"
            value={e.text}
            multiline
            onSave={(text) => text && onChange({ ...e, text })}
          />
          <Text
            label="Title (optional)"
            value={e.title ?? ''}
            onSave={(title) => onChange(withOptional(e, 'title', title))}
          />
        </>
      );
    case 'revealArea':
      return (
        <AreaField
          store={store}
          label="Room"
          value={e.area}
          onChange={(area) => onChange({ ...e, area })}
        />
      );
    case 'revealAll':
      return <p className="ed-note">Every monster, door and piece of furniture shows.</p>;
    case 'openAllDoors':
      return <p className="ed-note">Every door opens.</p>;
    case 'placeMonster':
      return (
        <>
          <Choose
            label="Monster"
            value={e.monster}
            options={monsterOptions(quest)}
            onChange={(monster) => onChange({ ...e, monster })}
          />
          <CellField
            store={store}
            label="Square (optional)"
            value={e.cell as Cell | undefined}
            onChange={(cell) => onChange({ ...e, cell })}
            onClear={() => {
              const { cell: _c, ...rest } = e;
              void _c;
              onChange(rest);
            }}
          />
        </>
      );
    case 'setMonsterState':
      return (
        <>
          <Choose
            label="Monster"
            value={e.monster}
            options={monsterOptions(quest)}
            onChange={(monster) => onChange({ ...e, monster })}
          />
          <Chips
            value={e.state}
            options={STATE_OPTIONS}
            onChange={(state) => onChange({ ...e, state })}
          />
          <Num
            store={store}
            label="For how many turns (optional)"
            value={e.turns}
            optional
            min={1}
            onSave={(turns) => onChange(withOptional(e, 'turns', turns))}
          />
        </>
      );
    case 'addSecretDoor':
      return (
        <>
          <Choose
            label="Secret door"
            value={e.door}
            options={quest.secretDoors.map((d) => ({ value: d.id, label: d.id }))}
            onChange={(door) => onChange({ ...e, door })}
          />
          <Pick
            store={store}
            kind="secretDoor"
            hint="Click a secret door on the board."
            label="Click it on the board"
            onPick={(v) => onChange({ ...e, door: v as string })}
          />
        </>
      );
    case 'placeBlock':
      return (
        <>
          {e.cells.map((c, i) => (
            <div className="ed-cellrow" key={`${i}:${c[0]},${c[1]}`}>
              <span>Square {cellText(c)}</span>
              <button
                className="chip"
                disabled={e.cells.length === 1}
                aria-label={`Remove square ${cellText(c)}`}
                onClick={() => onChange({ ...e, cells: removeAt(e.cells, i) })}
              >
                Remove
              </button>
            </div>
          ))}
          <Pick
            store={store}
            kind="cell"
            hint="Click a square on the board."
            label="Add a square on the board"
            onPick={(v) => onChange({ ...e, cells: [...e.cells, v as [number, number]] })}
          />
        </>
      );
    case 'giveItem':
      return (
        <Text label="Item" value={e.text} onSave={(text) => text && onChange({ ...e, text })} />
      );
    case 'setFlag':
      return (
        <>
          <Text label="Flag" value={e.flag} onSave={(flag) => flag && onChange({ ...e, flag })} />
          <Chips
            value={e.value ? 'yes' : 'no'}
            options={YES_NO('Set it', 'Clear it')}
            onChange={(v) => onChange({ ...e, value: v === 'yes' })}
          />
        </>
      );
    case 'addCounter':
      return (
        <>
          <Text
            label="Counter"
            value={e.counter}
            onSave={(counter) => counter && onChange({ ...e, counter })}
          />
          <Num
            store={store}
            label="Add"
            value={e.by}
            negative
            onSave={(by) => by !== undefined && onChange({ ...e, by })}
          />
        </>
      );
    case 'completeObjective':
      return (
        <Choose
          label="Objective"
          value={e.objective}
          options={quest.objectives.map((o) => ({ value: o.id, label: `${o.id} · ${o.text}` }))}
          onChange={(objective) => onChange({ ...e, objective })}
        />
      );
    case 'spawnNpc':
      return (
        <Choose
          label="Character"
          value={e.npc}
          options={quest.npcs.map((n) => ({ value: n.id, label: `${n.id} · ${n.name}` }))}
          onChange={(npc) => onChange({ ...e, npc })}
        />
      );
    case 'promptChoice':
      return (
        <>
          <Text
            label="Question"
            value={e.text}
            multiline
            onSave={(text) => text && onChange({ ...e, text })}
          />
          {e.options.map((o, i) => (
            <div className="ed-row ed-nested" key={i} data-testid="option-row">
              <div className="ed-row-head">
                <span>Answer {i + 1}</span>
                <button
                  className="chip"
                  disabled={e.options.length === 1}
                  aria-label={`Remove answer ${i + 1}`}
                  onClick={() => onChange({ ...e, options: removeAt(e.options, i) })}
                >
                  Remove
                </button>
              </div>
              <Text
                label="Button"
                value={o.label}
                onSave={(label) =>
                  label && onChange({ ...e, options: replaceAt(e.options, i, { ...o, label }) })
                }
              />
              <EffectList
                store={store}
                quest={quest}
                effects={o.effects}
                onChange={(effects) =>
                  onChange({ ...e, options: replaceAt(e.options, i, { ...o, effects }) })
                }
              />
            </div>
          ))}
          <button
            className="btn alt"
            onClick={() =>
              onChange({
                ...e,
                options: [...e.options, { label: `Answer ${e.options.length + 1}`, effects: [] }],
              })
            }
          >
            Add an answer
          </button>
        </>
      );
  }
}

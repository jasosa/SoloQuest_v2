/**
 * The note builder (the "Notes" tab of the inspector): the list of notes A..Z and the ones
 * without a letter, the letters on the map that still have no note, and the form of one note
 * (text, trigger, conditions, effects). Every change is an engine edit operation through the
 * store, so undo and redo work and a refused change shows the engine sentence as a toast.
 * Targets (a door, a square, an area) are chosen from a list or by clicking on the board.
 */
import { board, roomIds } from '../../engine/board/board';
import { isMultiMap, questMaps } from '../../engine/quest/maps';
import { shownName } from './monsterLabel';
import type { NotePatch } from '../../engine/editor';
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
import {
  changeTrigger,
  parseSubjectKey,
  retarget,
  subjectChoices,
  subjectKey,
  subjectLabel,
  subjectOf,
  triggerChoices,
  type Subject,
} from './actionSubjects';
import type { EditorStore, PickKind } from './editorStore';
import {
  CONDITION_TYPES,
  EFFECT_TYPES,
  TRIGGER_TYPES,
  cellText,
  conditionKey,
  defaultCondition,
  defaultEffect,
  parseMapLetter,
  parseWhole,
  removeAt,
  replaceAt,
  type ConditionKey,
} from './noteForms';
import { t } from '../../i18n/t';

const ROOMS = roomIds(board);

// ---- small form pieces

export function Text({
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
export function Num({
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

export function Choose({
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
          <option value={value}>
            {value === '' ? t('editor.NotesPanel.pickOne', 'Pick one') : `${value} (missing)`}
          </option>
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

export function Chips<T extends string>({
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
    label: `${m.id} · ${shownName(q, m)}`,
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
        hint={t('editor.NotesPanel.clickARoomOr', 'Click a room or corridor on the board.')}
        label={t('editor.NotesPanel.clickItOnThe', 'Click it on the board')}
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
      <p className="ed-id">
        {value
          ? t('editor.NotesPanel.square', 'Square {v1}', { v1: cellText(value) })
          : t('editor.NotesPanel.noSquare', 'No square')}
      </p>
      <div className="ed-chips">
        <Pick
          store={store}
          kind="cell"
          hint={t('editor.NotesPanel.clickASquareOn', 'Click a square on the board.')}
          label={t('editor.NotesPanel.clickItOnThe', 'Click it on the board')}
          onPick={(v) => onChange(v as Cell)}
        />
        {onClear && value && (
          <button className="btn alt ed-pick" onClick={onClear}>
            {t('editor.NotesPanel.clear', 'Clear')}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- one action

/** The "Applies to" list: the quest, a room, a zone, an element... or a square picked on the board. */
function AppliesTo({ store, quest, note }: { store: EditorStore; quest: Quest; note: Note }) {
  const st = store.getState();
  const subject = subjectOf(note);
  const move = (to: Subject) => {
    const r = retarget(quest, note, to);
    if (!r.ok) {
      st.say(r.error);
      return;
    }
    st.patchNote({ trigger: r.value.trigger, target: r.value.target });
  };
  const all = subjectChoices(quest);
  const known = all.some((s) => subjectKey(s) === subjectKey(subject));
  const options = [
    ...(known ? [] : [{ value: subjectKey(subject), label: subjectLabel(quest, subject) }]),
    ...all.map((s) => ({ value: subjectKey(s), label: subjectLabel(quest, s) })),
    { value: '__square', label: 'A square on the board…' },
  ];
  return (
    <Choose
      label={t('editor.NotesPanel.appliesTo', 'Applies to')}
      value={subjectKey(subject)}
      options={options}
      onChange={(key) => {
        if (key === '__square') {
          st.setPicking({
            kind: 'cell',
            hint: t('editor.NotesPanel.clickASquareOn', 'Click a square on the board.'),
            onPick: (v) => {
              const c = v as Cell;
              move({ kind: 'square', id: `${c[0]},${c[1]}` });
            },
          });
          return;
        }
        const to = parseSubjectKey(key);
        if (to) move(to);
      }}
    />
  );
}

export function ActionForm({
  store,
  note,
  quest,
}: {
  store: EditorStore;
  note: Note;
  quest: Quest;
}) {
  const st = store.getState();
  const patch = (p: NotePatch) => st.patchNote(p);
  const subject = subjectOf(note);
  const fits = triggerChoices(subject);
  // An old action may use a trigger that has no subject (a kind of monster slain): keep it listed.
  const whenOptions = fits.some((c) => c.type === note.trigger.type)
    ? fits
    : [
        ...fits,
        {
          type: note.trigger.type,
          label:
            TRIGGER_TYPES.find((x) => x.type === note.trigger.type)?.label ?? note.trigger.type,
        },
      ];

  return (
    <>
      <section>
        <p className="ed-id" data-testid="note-id">
          {note.id}
        </p>
        <AppliesTo store={store} quest={quest} note={note} />
        <Choose
          label={t('editor.NotesPanel.when', 'When')}
          value={note.trigger.type}
          options={whenOptions.map((c) => ({ value: c.type, label: c.label }))}
          onChange={(type) => {
            if (type === note.trigger.type) return;
            const r = changeTrigger(quest, note, type as Trigger['type']);
            if (!r.ok) {
              st.say(r.error);
              return;
            }
            patch({ trigger: r.value.trigger, target: r.value.target });
          }}
        />
        <TriggerForm
          store={store}
          quest={quest}
          trigger={note.trigger}
          onChange={(t) => patch({ trigger: t })}
        />
      </section>

      <section>
        <div className="lbl">{t('editor.NotesPanel.onlyIf', 'Only if')}</div>
        <ConditionList
          store={store}
          quest={quest}
          conditions={note.when ?? []}
          onChange={(c) => patch({ when: c })}
        />
      </section>

      <section>
        <div className="lbl">{t('editor.NotesPanel.then', 'Then')}</div>
        <EffectList
          store={store}
          quest={quest}
          effects={note.effects}
          onChange={(e) => patch({ effects: e })}
        />
      </section>

      <section>
        <div className="lbl">{t('editor.NotesPanel.extras', 'Extras')}</div>
        {isMultiMap(store.getState().canon) && (
          <Choose
            label={t('editor.NotesPanel.map', 'Map')}
            value={note.map ?? ''}
            options={[
              { value: '', label: t('editor.NotesPanel.everyMap', 'Every map') },
              ...questMaps(store.getState().canon).map((m) => ({
                value: m.id,
                label: m.name ?? m.id,
              })),
            ]}
            onChange={(v) => patch({ map: v === '' ? null : v })}
          />
        )}
        <LetterField
          key={`${note.id}:${note.letter ?? ''}`}
          store={store}
          value={note.letter}
          onSave={(l) => patch({ letter: l })}
        />
        <CellField
          store={store}
          label={t('editor.NotesPanel.letterDrawnAt', 'Letter drawn at')}
          value={note.at as Cell | undefined}
          onChange={(c) => patch({ at: c })}
          onClear={() => patch({ at: null })}
        />
        <button
          className="chip ed-wide"
          aria-pressed={note.consumesTreasure === true}
          onClick={() =>
            patch(
              note.consumesTreasure
                ? { consumesTreasure: null }
                : { consumesTreasure: true, blocksSearch: null },
            )
          }
        >
          {t('editor.NotesPanel.noTreasureCardIs', 'No treasure card is drawn')}
        </button>
        {(note.trigger.type === 'squareEntered' ||
          note.trigger.type === 'zoneEntered' ||
          note.target?.kind === 'square' ||
          note.target?.kind === 'zone') && (
          <button
            className="chip ed-wide"
            aria-pressed={note.keepMark === true}
            onClick={() => patch({ keepMark: note.keepMark ? null : true })}
          >
            {t('editor.NotesPanel.keepTheMarkOn', 'Keep the mark on the map after it fires')}
          </button>
        )}
        {(note.trigger.type === 'treasureSearch' || note.blocksSearch === true) && (
          <button
            className="chip ed-wide"
            aria-pressed={note.blocksSearch === true}
            onClick={() =>
              patch(
                note.blocksSearch
                  ? { blocksSearch: null }
                  : { blocksSearch: true, consumesTreasure: null },
              )
            }
          >
            {t('editor.NotesPanel.searchingHereIsNot', 'Searching here is not possible')}
          </button>
        )}
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
      {t('editor.NotesPanel.letter', 'Letter')}
      <input
        defaultValue={value ?? ''}
        maxLength={1}
        placeholder={t('editor.NotesPanel.none', 'None')}
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
  trigger: tv,
  onChange,
}: {
  store: EditorStore;
  quest: Quest;
  trigger: Trigger;
  onChange(t: Trigger): void;
}) {
  const monsters = monsterOptions(quest);

  return (
    <>
      {tv.type === 'manual' && (
        <>
          <Text
            label={t('editor.NotesPanel.buttonLabel', 'Button label')}
            value={tv.label}
            onSave={(v) => v && onChange({ ...tv, label: v })}
          />
          <Text
            label={t('editor.NotesPanel.hintAboveTheButton', 'Hint above the button (optional)')}
            value={tv.hint ?? ''}
            placeholder={t('editor.NotesPanel.onePlainLineFor', 'One plain line for the players')}
            onSave={(v) => {
              const { hint: _gone, ...rest } = tv;
              void _gone;
              onChange(v ? { ...rest, hint: v } : rest);
            }}
          />
          <Chips
            value={tv.repeat ? 'many' : 'once'}
            options={[
              { value: 'once', label: t('editor.NotesPanel.pressedOnce', 'Pressed once') },
              { value: 'many', label: t('editor.NotesPanel.everyTime', 'Every time') },
            ]}
            onChange={(v) => {
              const { repeat: _gone, ...rest } = tv;
              void _gone;
              onChange(v === 'many' ? { ...rest, repeat: true } : rest);
            }}
          />
        </>
      )}
      {tv.type === 'treasureSearch' && (
        <>
          <button
            className="chip ed-wide"
            aria-pressed={tv.first === true}
            onClick={() =>
              onChange(tv.first ? { type: tv.type, area: tv.area } : { ...tv, first: true })
            }
          >
            {t('editor.NotesPanel.firstSearchOfThe', 'First search of the room only')}
          </button>
        </>
      )}
      {tv.type === 'zoneEntered' && (
        <button
          className="chip ed-wide"
          aria-pressed={tv.repeat === true}
          onClick={() =>
            onChange(tv.repeat ? { type: tv.type, zone: tv.zone } : { ...tv, repeat: true })
          }
        >
          {t('editor.NotesPanel.firesEveryTime', 'Fires every time')}
        </button>
      )}
      {tv.type === 'squareEntered' && (
        <>
          <button
            className="chip ed-wide"
            aria-pressed={tv.repeat === true}
            onClick={() =>
              onChange(tv.repeat ? { type: tv.type, cell: tv.cell } : { ...tv, repeat: true })
            }
          >
            {t('editor.NotesPanel.firesEveryTime', 'Fires every time')}
          </button>
        </>
      )}
      {tv.type === 'monsterLeft' && (
        <Chips
          value={tv.reason ?? 'any'}
          options={[
            { value: 'any', label: t('editor.NotesPanel.eitherWay', 'Either way') },
            { value: 'escaped', label: 'Escaped' },
            { value: 'freed', label: 'Freed' },
          ]}
          onChange={(v) => {
            const { reason: _gone, ...rest } = tv;
            void _gone;
            onChange(v === 'any' ? rest : { ...rest, reason: v });
          }}
        />
      )}
      {(tv.type === 'monsterKilled' || tv.type === 'monsterSeen' || tv.type === 'monsterLeft') &&
        tv.monster === undefined && (
          <>
            <Chips
              value={tv.monsterType !== undefined ? 'type' : 'one'}
              options={[
                { value: 'one', label: t('editor.NotesPanel.oneMonster', 'One monster') },
                { value: 'type', label: 'A kind' },
              ]}
              onChange={(mode) => {
                if (mode === 'type') onChange({ type: tv.type, monsterType: 'orc' });
                else {
                  const m = quest.monsters[0];
                  if (m) onChange({ type: tv.type, monster: m.id });
                  else
                    store
                      .getState()
                      .say(t('editor.NotesPanel.addAMonsterFirst', 'Add a monster first.'));
                }
              }}
            />
            {tv.monsterType !== undefined ? (
              <Choose
                label={t('editor.NotesPanel.kind', 'Kind')}
                value={tv.monsterType}
                options={MONSTER_TYPES.map((m) => ({ value: m, label: MONSTER_NAMES[m] }))}
                onChange={(m) =>
                  onChange({ type: tv.type, monsterType: m as (typeof MONSTER_TYPES)[number] })
                }
              />
            ) : (
              <Choose
                label={t('editor.NotesPanel.monster', 'Monster')}
                value={tv.monster ?? ''}
                options={monsters}
                onChange={(monster) => onChange({ type: tv.type, monster })}
              />
            )}
          </>
        )}
      {tv.type === 'allKilled' && (
        <>
          <div className="lbl">{t('editor.NotesPanel.allOfThese', 'All of these')}</div>
          <div className="ed-chips ed-small">
            {quest.monsters.map((m) => {
              const on = tv.monsters.includes(m.id);
              return (
                <button
                  key={m.id}
                  className="chip"
                  aria-pressed={on}
                  onClick={() => {
                    const next = on
                      ? tv.monsters.filter((x) => x !== m.id)
                      : [...tv.monsters, m.id];
                    if (next.length === 0)
                      store
                        .getState()
                        .say(t('editor.NotesPanel.keepAtLeastOne', 'Keep at least one monster.'));
                    else onChange({ ...tv, monsters: next });
                  }}
                >
                  {m.id}
                </button>
              );
            })}
          </div>
        </>
      )}
      {tv.type === 'spellCast' && (
        <>
          <Choose
            label={t('editor.NotesPanel.monster', 'Monster')}
            value={tv.monster ?? ''}
            options={[
              { value: '', label: t('editor.NotesPanel.anyMonster', 'Any monster') },
              ...monsters,
            ]}
            onChange={(monster) => onChange(withOptional(tv, 'monster', monster))}
          />
          <Choose
            label={t('editor.NotesPanel.spell', 'Spell')}
            value={tv.spell ?? ''}
            options={[
              { value: '', label: t('editor.NotesPanel.anySpell', 'Any spell') },
              ...SPELL_KEYS.map((k) => ({ value: k, label: SPELL_NAMES[k] })),
            ]}
            onChange={(spell) => onChange(withOptional(tv, 'spell', spell))}
          />
        </>
      )}
      {tv.type === 'zargonTurn' && (
        <div className="ed-stats ed-two">
          <Num
            store={store}
            label={t('editor.NotesPanel.turn', 'Turn')}
            value={tv.n}
            optional
            min={1}
            onSave={(n) => onChange(withOptional(tv, 'n', n))}
          />
          <Num
            store={store}
            label={t('editor.NotesPanel.every', 'Every')}
            value={tv.every}
            optional
            min={1}
            onSave={(every) => onChange(withOptional(tv, 'every', every))}
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

export function ConditionList({
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
              aria-label={t('editor.NotesPanel.removeCondition', 'Remove condition')}
              onClick={() => onChange(removeAt(conditions, i))}
            >
              {t('editor.NotesPanel.remove', 'Remove')}
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
          aria-label={t('editor.NotesPanel.addACondition', 'Add a condition')}
          value=""
          onChange={(e) => {
            const r = defaultCondition(quest, e.target.value as ConditionKey);
            if (r.ok) onChange([...conditions, r.value]);
            else store.getState().say(r.error);
          }}
        >
          <option value="">{t('editor.NotesPanel.addACondition', 'Add a condition')}</option>
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
        <Text
          label={t('editor.NotesPanel.flag', 'Flag')}
          value={c.flag}
          onSave={(v) => v && onChange({ ...c, flag: v })}
        />
        <Chips
          value={c.is ? 'yes' : 'no'}
          options={YES_NO(
            t('editor.NotesPanel.isSet', 'Is set'),
            t('editor.NotesPanel.isNotSet', 'Is not set'),
          )}
          onChange={(v) => onChange({ ...c, is: v === 'yes' })}
        />
      </>
    );
  if ('counter' in c)
    return (
      <>
        <Text
          label={t('editor.NotesPanel.counter', 'Counter')}
          value={c.counter}
          onSave={(v) => v && onChange({ ...c, counter: v })}
        />
        <Num
          store={store}
          label={t('editor.NotesPanel.atLeast', 'At least')}
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
          label={t('editor.NotesPanel.monster', 'Monster')}
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
          label={t('editor.NotesPanel.area', 'Area')}
          value={c.monstersAliveIn}
          corridor
          onChange={(monstersAliveIn) => onChange({ ...c, monstersAliveIn })}
        />
        <Num
          store={store}
          label={t('editor.NotesPanel.monstersAlive', 'Monsters alive')}
          value={c.is}
          min={0}
          onSave={(n) => n !== undefined && onChange({ ...c, is: n })}
        />
      </>
    );
  if ('areaRevealed' in c)
    return (
      <AreaField
        store={store}
        label={t('editor.NotesPanel.room', 'Room')}
        value={c.areaRevealed}
        onChange={(areaRevealed) => onChange({ ...c, areaRevealed })}
      />
    );
  if ('doorOpened' in c)
    return (
      <Choose
        label={t('editor.NotesPanel.door', 'Door')}
        value={c.doorOpened}
        options={[
          ...quest.doors.map((d) => ({ value: d.id, label: d.id })),
          ...quest.edgeDoors.map((d) => ({
            value: d.id,
            label: `${d.id} (${d.kind === 'ironEntry' ? 'entry' : 'exit'})`,
          })),
          ...quest.secretDoors.map((d) => ({ value: d.id, label: `${d.id} (secret)` })),
        ]}
        onChange={(doorOpened) => onChange({ ...c, doorOpened })}
      />
    );
  if ('lookDone' in c)
    return (
      <CellField
        store={store}
        label={t('editor.NotesPanel.square2', 'Square')}
        value={c.lookDone as Cell}
        onChange={(lookDone) => onChange({ ...c, lookDone })}
      />
    );
  if ('monsterSeen' in c)
    return (
      <Choose
        label={t('editor.NotesPanel.monster', 'Monster')}
        value={c.monsterSeen}
        options={monsterOptions(quest)}
        onChange={(monsterSeen) => onChange({ ...c, monsterSeen })}
      />
    );
  return (
    <p className="ed-note">
      {t('editor.NotesPanel.onlyTheFirstTime', 'Only the first time this note fires.')}
    </p>
  );
}

// ---- effects

function EffectList({
  store,
  quest,
  effects,
  onChange,
}: {
  store: EditorStore;
  quest: Quest;
  effects: readonly Effect[];
  onChange(e: Effect[]): void;
}) {
  return (
    <>
      {effects.map((e, i) => (
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
              aria-label={t('editor.NotesPanel.removeEffect', 'Remove effect {label}', {
                label: EFFECT_TYPES.find((x) => x.type === e.type)?.label ?? '',
              })}
              onClick={() => onChange(removeAt(effects, i))}
            >
              {t('editor.NotesPanel.remove', 'Remove')}
            </button>
          </div>
          <EffectFields
            store={store}
            quest={quest}
            effect={e}
            onChange={(n) => onChange(replaceAt(effects, i, n))}
          />
        </div>
      ))}
      <label className="ed-field">
        <select
          className="es-select"
          aria-label={t('editor.NotesPanel.addAnEffect', 'Add an effect')}
          value=""
          onChange={(ev) => {
            if (!ev.target.value) return;
            const r = defaultEffect(quest, ev.target.value as Effect['type']);
            if (r.ok) onChange([...effects, r.value]);
            else store.getState().say(r.error);
          }}
        >
          <option value="">{t('editor.NotesPanel.addAnEffect', 'Add an effect')}</option>
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
  { value: 'passive', label: 'Passive' },
  { value: 'away', label: 'Away (not on the map)' },
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
            label={t('editor.NotesPanel.text', 'Text')}
            value={e.text}
            multiline
            onSave={(text) => text && onChange({ ...e, text })}
          />
          <Text
            label={t('editor.NotesPanel.titleOptional', 'Title (optional)')}
            value={e.title ?? ''}
            onSave={(title) => onChange(withOptional(e, 'title', title))}
          />
        </>
      );
    case 'revealArea':
      return (
        <AreaField
          store={store}
          label={t('editor.NotesPanel.room', 'Room')}
          value={e.area}
          onChange={(area) => onChange({ ...e, area })}
        />
      );
    case 'revealAll':
      return (
        <p className="ed-note">
          {t(
            'editor.NotesPanel.everyMonsterDoorAnd',
            'Every monster, door and piece of furniture shows.',
          )}
        </p>
      );
    case 'openAllDoors':
      return (
        <p className="ed-note">{t('editor.NotesPanel.everyDoorOpens', 'Every door opens.')}</p>
      );
    case 'placeMonster':
      return (
        <>
          <Choose
            label={t('editor.NotesPanel.monster', 'Monster')}
            value={e.monster}
            options={monsterOptions(quest)}
            onChange={(monster) => onChange({ ...e, monster })}
          />
          <CellField
            store={store}
            label={t('editor.NotesPanel.squareOptional', 'Square (optional)')}
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
            label={t('editor.NotesPanel.monster', 'Monster')}
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
            label={t('editor.NotesPanel.forHowManyTurns', 'For how many turns (optional)')}
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
            label={t('editor.NotesPanel.secretDoor', 'Secret door')}
            value={e.door}
            options={quest.secretDoors.map((d) => ({ value: d.id, label: d.id }))}
            onChange={(door) => onChange({ ...e, door })}
          />
          <Pick
            store={store}
            kind="secretDoor"
            hint={t('editor.NotesPanel.clickASecretDoor', 'Click a secret door on the board.')}
            label={t('editor.NotesPanel.clickItOnThe', 'Click it on the board')}
            onPick={(v) => onChange({ ...e, door: v as string })}
          />
        </>
      );
    case 'replaceFurnitureWithDoor':
      return (
        <>
          <Choose
            label={t('editor.NotesPanel.furniture', 'Furniture')}
            value={e.furniture}
            options={quest.furniture.map((f) => ({ value: f.id, label: f.id }))}
            onChange={(furniture) => onChange({ ...e, furniture })}
          />
          <Choose
            label={t('editor.NotesPanel.doorItOpens', 'Door (it opens)')}
            value={e.door}
            options={quest.doors.map((d) => ({ value: d.id, label: d.id }))}
            onChange={(door) => onChange({ ...e, door })}
          />
        </>
      );
    case 'lookFrom':
      return (
        <>
          <p className="ed-note">
            {t(
              'editor.NotesPanel.squareWhatCanBe',
              'Square {v1}: what can be seen from there shows.',
              { v1: cellText(e.cell) },
            )}
          </p>
          <Pick
            store={store}
            kind="cell"
            hint={t('editor.NotesPanel.clickASquareOn', 'Click a square on the board.')}
            label={t('editor.NotesPanel.clickItOnThe', 'Click it on the board')}
            onPick={(v) => onChange({ ...e, cell: v as [number, number] })}
          />
        </>
      );
    case 'removeDoor':
      return (
        <>
          <Choose
            label={t('editor.NotesPanel.door', 'Door')}
            value={e.door}
            options={quest.doors.map((d) => ({ value: d.id, label: d.id }))}
            onChange={(door) => onChange({ ...e, door })}
          />
          <Pick
            store={store}
            kind="door"
            hint={t('editor.NotesPanel.clickADoorOn', 'Click a door on the board.')}
            label={t('editor.NotesPanel.clickItOnThe', 'Click it on the board')}
            onPick={(v) => onChange({ ...e, door: v as string })}
          />
        </>
      );
    case 'crossMap':
      return (
        <Choose
          label={t('editor.NotesPanel.linkTheHeroesCross', 'Link (the heroes cross it)')}
          value={e.link}
          options={(quest.links ?? []).map((l) => ({ value: l.id, label: l.id }))}
          onChange={(link) => onChange({ ...e, link })}
        />
      );
    case 'placeBlock':
      return (
        <>
          {e.cells.map((c, i) => (
            <div className="ed-cellrow" key={`${i}:${c[0]},${c[1]}`}>
              <span>{t('editor.NotesPanel.square', 'Square {v1}', { v1: cellText(c) })}</span>
              <button
                className="chip"
                disabled={e.cells.length === 1}
                aria-label={t('editor.NotesPanel.removeSquare', 'Remove square {v1}', {
                  v1: cellText(c),
                })}
                onClick={() => onChange({ ...e, cells: removeAt(e.cells, i) })}
              >
                {t('editor.NotesPanel.remove', 'Remove')}
              </button>
            </div>
          ))}
          <Pick
            store={store}
            kind="cell"
            hint={t('editor.NotesPanel.clickASquareOn', 'Click a square on the board.')}
            label={t('editor.NotesPanel.addASquareOn', 'Add a square on the board')}
            onPick={(v) => onChange({ ...e, cells: [...e.cells, v as [number, number]] })}
          />
        </>
      );
    case 'giveItem':
      return (
        <Text
          label={t('editor.NotesPanel.item', 'Item')}
          value={e.text}
          onSave={(text) => text && onChange({ ...e, text })}
        />
      );
    case 'setFlag':
      return (
        <>
          <Text
            label={t('editor.NotesPanel.flag', 'Flag')}
            value={e.flag}
            onSave={(flag) => flag && onChange({ ...e, flag })}
          />
          <Chips
            value={e.value ? 'yes' : 'no'}
            options={YES_NO(
              t('editor.NotesPanel.setIt', 'Set it'),
              t('editor.NotesPanel.clearIt', 'Clear it'),
            )}
            onChange={(v) => onChange({ ...e, value: v === 'yes' })}
          />
        </>
      );
    case 'addCounter':
      return (
        <>
          <Text
            label={t('editor.NotesPanel.counter', 'Counter')}
            value={e.counter}
            onSave={(counter) => counter && onChange({ ...e, counter })}
          />
          <Num
            store={store}
            label={t('editor.NotesPanel.add', 'Add')}
            value={e.by}
            negative
            onSave={(by) => by !== undefined && onChange({ ...e, by })}
          />
        </>
      );
    case 'completeObjective':
      return (
        <Choose
          label={t('editor.NotesPanel.objective', 'Objective')}
          value={e.objective}
          options={quest.objectives.map((o) => ({ value: o.id, label: `${o.id} · ${o.text}` }))}
          onChange={(objective) => onChange({ ...e, objective })}
        />
      );
    case 'spawnNpc':
      return (
        <Choose
          label={t('editor.NotesPanel.character', 'Character')}
          value={e.npc}
          options={quest.npcs.map((n) => ({ value: n.id, label: `${n.id} · ${n.name}` }))}
          onChange={(npc) => onChange({ ...e, npc })}
        />
      );
    case 'promptChoice':
      return (
        <>
          <Text
            label={t('editor.NotesPanel.question', 'Question')}
            value={e.text}
            multiline
            onSave={(text) => text && onChange({ ...e, text })}
          />
          {e.options.map((o, i) => (
            <div className="ed-row ed-nested" key={i} data-testid="option-row">
              <div className="ed-row-head">
                <span>{t('editor.NotesPanel.answer', 'Answer {v1}', { v1: i + 1 })}</span>
                <button
                  className="chip"
                  disabled={e.options.length === 1}
                  aria-label={t('editor.NotesPanel.removeAnswer', 'Remove answer {v1}', {
                    v1: i + 1,
                  })}
                  onClick={() => onChange({ ...e, options: removeAt(e.options, i) })}
                >
                  {t('editor.NotesPanel.remove', 'Remove')}
                </button>
              </div>
              <Text
                label={t('editor.NotesPanel.button', 'Button')}
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
                options: [
                  ...e.options,
                  {
                    label: t('editor.NotesPanel.answer', 'Answer {v1}', {
                      v1: e.options.length + 1,
                    }),
                    effects: [],
                  },
                ],
              })
            }
          >
            {t('editor.NotesPanel.addAnAnswer', 'Add an answer')}
          </button>
        </>
      );
  }
}

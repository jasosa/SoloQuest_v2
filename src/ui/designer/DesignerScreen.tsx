import { useCallback, useEffect, useRef, useState } from 'react';
import { CORE_ABILITIES } from '../../engine/data/abilities';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import {
  CORE_SPELLS,
  SPELL_TAG_IDS,
  SPELL_TAG_QUESTIONS,
  isSpellTag,
} from '../../engine/data/spells';
import { MONSTER_TYPES } from '../../engine/quest/schema';
import {
  LIBRARY_KINDS,
  LIBRARY_KIND_NAMES,
  checkedItem,
  type LibraryItem,
  type LibraryKind,
  type LibraryStore,
} from '../../persist/library';
import { shrinkImage } from './imageFile';

export interface DesignerScreenProps {
  store: LibraryStore;
  onBack(): void;
}

type Data = Record<string, unknown>;

const NEW_NAME: Readonly<Record<LibraryKind, string>> = {
  ability: 'New ability',
  spell: 'New spell',
  enemy: 'New enemy',
  hero: 'New hero',
  companion: 'New companion',
};
const ONE: Readonly<Record<LibraryKind, string>> = {
  ability: 'ability',
  spell: 'spell',
  enemy: 'enemy',
  hero: 'hero',
  companion: 'companion',
};

/** The time of a save (the library store takes it as an argument). */
const stamp = () => Date.now();

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'item';

function freeId(taken: readonly string[], name: string): string {
  const base = slug(name);
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`;
}

function blank(kind: LibraryKind, id: string): Data {
  const name = NEW_NAME[kind];
  switch (kind) {
    case 'ability':
      return { id, name, text: 'Describe it in your own words.' };
    case 'spell':
      return { id, name, tags: ['heroAdjacent'] };
    case 'enemy':
      return { id, name, base: 'goblin' };
    case 'hero':
      return { id, name };
    case 'companion':
      return { id, name, defend: 2, body: 2, text: 'What the helper does.' };
  }
}

function Picture({ data, onChange }: { data: Data; onChange(next: Data): void }) {
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  const image = typeof data.image === 'string' ? data.image : undefined;
  return (
    <div className="ed-field">
      Picture (optional)
      <div className="dz-pic">
        {image ? (
          <img src={image} alt="" className="dz-pic-img" data-testid="dz-pic" />
        ) : (
          <span className="dz-pic-none">No picture: the letter icon is used.</span>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          data-testid="dz-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            void shrinkImage(f).then((r) => {
              if (r.ok) {
                setProblem('');
                onChange({ ...data, image: r.url });
              } else setProblem(r.message);
            });
          }}
        />
        <button className="btn alt" onClick={() => input.current?.click()}>
          {image ? 'Change picture' : 'Add a picture'}
        </button>
        {image && (
          <button
            className="btn alt"
            onClick={() => {
              const { image: _drop, ...rest } = data;
              void _drop;
              onChange(rest);
            }}
          >
            Remove picture
          </button>
        )}
      </div>
      {problem && <p className="ed-note">{problem}</p>}
    </div>
  );
}

const Text = ({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  rows?: number;
}) => (
  <label className="ed-field">
    {label}
    {rows ? (
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    )}
  </label>
);

/** A list of ids shown as rows with Remove, then a dropdown and Add (no chips). */
function IdList({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: readonly string[];
  options: readonly { id: string; name: string }[];
  onChange(next: string[]): void;
}) {
  const [pick, setPick] = useState('');
  const name = (id: string) => options.find((o) => o.id === id)?.name ?? id;
  const free = options.filter((o) => !values.includes(o.id));
  return (
    <div className="ed-field" data-testid={`dz-list-${label.toLowerCase()}`}>
      {label}
      <ul className="ed-items">
        {values.map((v) => (
          <li key={v} data-id={v}>
            <b>{name(v)}</b>
            <button className="chip" onClick={() => onChange(values.filter((x) => x !== v))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="ed-addrow">
        <select
          className="es-select"
          aria-label={`Add to ${label}`}
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">Pick one…</option>
          {free.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button
          className="btn alt"
          disabled={pick === ''}
          onClick={() => {
            onChange([...values, pick]);
            setPick('');
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

const STATS = ['move', 'att', 'def', 'body', 'mind'] as const;

function Form({
  kind,
  data,
  onChange,
  all,
}: {
  kind: LibraryKind;
  data: Data;
  onChange(d: Data): void;
  all: readonly LibraryItem[];
}) {
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');
  const set = (k: string, v: unknown) => {
    const next = { ...data };
    if (v === undefined || v === '') delete next[k];
    else next[k] = v;
    onChange(next);
  };
  const list = (k: string) => (Array.isArray(data[k]) ? (data[k] as string[]) : []);
  const named = (k: LibraryKind) =>
    all.filter((i) => i.kind === k).map((i) => ({ id: i.id, name: i.name }));

  return (
    <div className="dz-form">
      <Text label="Name" value={str('name')} onChange={(v) => set('name', v)} />
      {kind === 'ability' && (
        <>
          <label className="ed-field">
            Kind
            <select
              className="es-select"
              value={str('kind') || 'ability'}
              onChange={(e) =>
                set('kind', e.target.value === 'ability' ? undefined : e.target.value)
              }
            >
              <option value="ability">Ability</option>
              <option value="weakness">Weakness</option>
              <option value="immunity">Immunity</option>
            </select>
          </label>
          <Text
            label="What it does"
            value={str('text')}
            rows={3}
            onChange={(v) => set('text', v)}
          />
        </>
      )}
      {kind === 'spell' && (
        <>
          <Text
            label="What it does (your own words, optional)"
            value={str('text')}
            rows={2}
            onChange={(v) => set('text', v)}
          />
          <IdList
            label="Situations"
            values={list('tags')}
            options={SPELL_TAG_IDS.map((t) => ({
              id: t,
              name: `${t} · ${SPELL_TAG_QUESTIONS[t]}`,
            }))}
            onChange={(next) => set('tags', next.filter(isSpellTag))}
          />
          <Text
            label="Or one question of your own"
            value={str('question')}
            onChange={(v) => set('question', v)}
          />
          <label className="ed-field">
            Offer it only when
            <select
              className="es-select"
              value={str('offerWhen') || 'always'}
              onChange={(e) =>
                set('offerWhen', e.target.value === 'always' ? undefined : e.target.value)
              }
            >
              <option value="always">Always</option>
              <option value="escapePoint">The quest has an escape point</option>
            </select>
          </label>
          <Text
            label="Warning (optional)"
            value={str('warning')}
            onChange={(v) => set('warning', v)}
          />
        </>
      )}
      {kind === 'enemy' && (
        <>
          <label className="ed-field">
            Behaves like
            <select
              className="es-select"
              value={str('base')}
              onChange={(e) => set('base', e.target.value)}
            >
              {MONSTER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MONSTER_NAMES[t]}
                </option>
              ))}
            </select>
          </label>
          <Text
            label="Letter (1 or 2)"
            value={str('letter')}
            onChange={(v) => set('letter', v.slice(0, 2))}
          />
          <div className="ed-field">
            Stats (empty = the type&apos;s own)
            <div className="dz-stats">
              {STATS.map((s) => {
                const o = (data.overrides ?? {}) as Record<string, number>;
                return (
                  <label key={s}>
                    {s}
                    <input
                      inputMode="numeric"
                      value={o[s] === undefined ? '' : String(o[s])}
                      onChange={(e) => {
                        const next = { ...o };
                        const n = Number(e.target.value);
                        if (e.target.value.trim() === '' || !Number.isInteger(n) || n < 0)
                          delete next[s];
                        else next[s] = n;
                        set('overrides', Object.keys(next).length ? next : undefined);
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>
          <IdList
            label="Abilities"
            values={list('abilities')}
            options={[
              ...CORE_ABILITIES.map((a) => ({ id: a.id, name: a.name })),
              ...named('ability'),
            ]}
            onChange={(next) => set('abilities', next.length ? next : undefined)}
          />
          <IdList
            label="Spells"
            values={list('spells')}
            options={[...CORE_SPELLS.map((s) => ({ id: s.id, name: s.name })), ...named('spell')]}
            onChange={(next) => set('spells', next.length ? next : undefined)}
          />
          <Text
            label="Traits (one per line)"
            value={list('traits').join('\n')}
            rows={2}
            onChange={(v) => {
              const t = v.split('\n').filter((l) => l.trim() !== '');
              set('traits', t.length ? t : undefined);
            }}
          />
        </>
      )}
      {kind === 'companion' && (
        <>
          <div className="dz-stats">
            {(['defend', 'body'] as const).map((s) => (
              <label key={s}>
                {s}
                <input
                  inputMode="numeric"
                  value={String(data[s] ?? '')}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    set(s, e.target.value.trim() === '' || !Number.isInteger(n) ? 0 : n);
                  }}
                />
              </label>
            ))}
          </div>
          <Text
            label="What it does"
            value={str('text')}
            rows={3}
            onChange={(v) => set('text', v)}
          />
        </>
      )}
      {(kind === 'enemy' || kind === 'hero' || kind === 'companion') && (
        <Picture data={data} onChange={onChange} />
      )}
    </div>
  );
}

/**
 * The Designer (decision 70): the library of abilities, spells, enemies, heroes and companions,
 * one list per kind with a form to edit the selected item. Items are saved to the library by
 * the Save button, and the whole library can be exported to a file or imported from one.
 */
export function DesignerScreen({ store, onBack }: DesignerScreenProps) {
  const [kind, setKind] = useState<LibraryKind>('enemy');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Data | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [message, setMessage] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => setItems(await store.list()), [store]);
  useEffect(() => {
    // The list comes from storage, so it is loaded after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const ofKind = items.filter((i) => i.kind === kind);
  const checked = draft ? checkedItem(kind, draft) : undefined;

  const pick = (id: string | null) => {
    setSelected(id);
    setIsNew(false);
    setMessage('');
    setDraft(id ? structuredClone(ofKind.find((i) => i.id === id)?.data ?? null) : null);
  };
  const switchKind = (k: LibraryKind) => {
    setKind(k);
    setSelected(null);
    setDraft(null);
    setIsNew(false);
    setMessage('');
  };
  const create = () => {
    const id = freeId(
      items.filter((i) => i.kind === kind).map((i) => i.id),
      NEW_NAME[kind],
    );
    setSelected(id);
    setIsNew(true);
    setMessage('');
    setDraft(blank(kind, id));
  };
  const save = async () => {
    if (!draft) return;
    try {
      // A new item gets its id from the name it has now.
      const id = isNew
        ? freeId(
            ofKind.map((i) => i.id),
            String(draft.name ?? ''),
          )
        : (selected ?? String(draft.id));
      await store.save(kind, { ...draft, id }, stamp());
      setMessage('Saved to the library.');
      setSelected(id);
      setDraft({ ...draft, id });
      setIsNew(false);
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const remove = async () => {
    if (!selected) return;
    if (!isNew) await store.remove(kind, selected);
    pick(null);
    await refresh();
  };
  const exportFile = async () => {
    const text = await store.exportAll();
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soloquest-library.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = await store.importAll(await f.text(), stamp());
      setMessage(
        `Imported: ${r.added} added, ${r.replaced} replaced${r.skipped ? `, ${r.skipped} skipped` : ''}.`,
      );
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <div className="app designer">
      <header>
        <span className="qn">Designer</span>
        <h1>Library</h1>
        <button className="link" onClick={onBack} style={{ marginLeft: 'auto' }}>
          Back
        </button>
      </header>
      <nav className="dz-tabs" aria-label="Library">
        {LIBRARY_KINDS.map((k) => (
          <button
            key={k}
            className={'chip' + (k === kind ? ' on' : '')}
            aria-pressed={k === kind}
            onClick={() => switchKind(k)}
          >
            {LIBRARY_KIND_NAMES[k]} ({items.filter((i) => i.kind === k).length})
          </button>
        ))}
        <span className="dz-spacer" />
        <button className="btn alt" onClick={() => void exportFile()}>
          Export library
        </button>
        <button className="btn alt" onClick={() => file.current?.click()}>
          Import library
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="dz-import"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void importFile(f);
          }}
        />
      </nav>
      <div className="dz-body">
        <aside className="dz-list" aria-label={LIBRARY_KIND_NAMES[kind]}>
          <button className="btn" onClick={create}>
            New {ONE[kind]}
          </button>
          <ul>
            {ofKind.map((i) => (
              <li key={i.id}>
                <button
                  className={'dz-row' + (i.id === selected ? ' on' : '')}
                  onClick={() => pick(i.id)}
                >
                  {typeof i.data.image === 'string' && (
                    <img src={i.data.image} alt="" className="dz-thumb" />
                  )}
                  {i.name}
                </button>
              </li>
            ))}
            {isNew && selected && draft && (
              <li>
                <span className="dz-row on">{String(draft.name ?? '')} (new)</span>
              </li>
            )}
            {ofKind.length === 0 && !isNew && (
              <li className="ed-note">Nothing here yet. Make the first one.</li>
            )}
          </ul>
        </aside>
        <section className="dz-edit">
          {draft ? (
            <>
              <Form kind={kind} data={draft} onChange={setDraft} all={items} />
              <div className="dz-actions">
                <button className="btn" disabled={!checked} onClick={() => void save()}>
                  Save
                </button>
                <button className="btn alt" onClick={() => void remove()}>
                  {isNew ? 'Discard' : `Delete ${ONE[kind]}`}
                </button>
                {!checked && <span className="ed-note">Fill in the required fields to save.</span>}
              </div>
            </>
          ) : (
            <p className="ed-note">Pick an item, or make a new one.</p>
          )}
          {message && (
            <p className="ed-note" role="status" data-testid="dz-message">
              {message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

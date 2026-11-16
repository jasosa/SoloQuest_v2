import { useCallback, useEffect, useRef, useState } from 'react';
import { CORE_ABILITIES } from '../../engine/data/abilities';
import { HERO_NAMES, HEROES } from '../../engine/data/heroes';
import { MONSTER_NAMES, MONSTER_STATS } from '../../engine/data/monsters';
import {
  CORE_SPELLS,
  SPELL_TAG_IDS,
  SPELL_TAG_QUESTIONS,
  isSpellTag,
} from '../../engine/data/spells';
import { usageOf, type UsageKind, type UsageRow } from '../../engine/editor/usage';
import { MONSTER_TYPES, type MonsterType, type Quest } from '../../engine/quest/schema';
import {
  LIBRARY_KINDS,
  LIBRARY_KIND_NAMES,
  checkedItem,
  type LibraryItem,
  type LibraryKind,
  type LibraryStore,
} from '../../persist/library';
import { MONSTER_LETTER } from '../play/monsterCodes';
import { Col, Dialog, Fld, Frame, ListPanel, Panel, TopBar } from '../shared/Frame';
import { shrinkImage } from './imageFile';

type Data = Record<string, unknown>;

/** The quests to look at for the "Used in" panel. */
export type QuestSource = () => Promise<readonly { title: string; quest: Quest }[]>;

export interface DesignerBodyProps {
  store: LibraryStore;
  quests?: QuestSource;
}

export interface DesignerScreenProps extends DesignerBodyProps {
  onBack(): void;
}

interface Row {
  readonly id: string;
  readonly name: string;
  readonly core: boolean;
  readonly data: Data;
  readonly image?: string;
}

const ONE: Readonly<Record<LibraryKind, string>> = {
  ability: 'ability',
  spell: 'spell',
  enemy: 'enemy',
  hero: 'hero',
  companion: 'companion',
};
const TITLE: Readonly<Record<LibraryKind, string>> = {
  ability: 'Ability',
  spell: 'Spell',
  enemy: 'Enemy',
  hero: 'Hero',
  companion: 'Companion',
};
const STATS = ['move', 'att', 'def', 'body', 'mind'] as const;
const LIMITS = [
  { n: 1, label: 'Once in the quest' },
  { n: 2, label: 'Twice' },
  { n: 3, label: '3 times' },
  { n: 4, label: '4 times' },
  { n: 5, label: '5 times' },
];

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

function coreRows(kind: LibraryKind): Row[] {
  switch (kind) {
    case 'ability':
      return CORE_ABILITIES.map((a) => ({ id: a.id, name: a.name, core: true, data: { ...a } }));
    case 'spell':
      return CORE_SPELLS.map((s) => ({ id: s.id, name: s.name, core: true, data: { ...s } }));
    case 'enemy':
      return MONSTER_TYPES.map((t) => ({
        id: t,
        name: MONSTER_NAMES[t],
        core: true,
        data: { id: t, name: MONSTER_NAMES[t], base: t, letter: MONSTER_LETTER[t] },
      }));
    case 'hero':
      return HEROES.map((h) => ({
        id: h,
        name: HERO_NAMES[h],
        core: true,
        data: { id: h, name: HERO_NAMES[h] },
      }));
    case 'companion':
      return [];
  }
}

function blank(kind: LibraryKind, id: string): Data {
  const name = `New ${ONE[kind]}`;
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

const str = (d: Data, k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
const list = (d: Data, k: string) => (Array.isArray(d[k]) ? (d[k] as string[]) : []);

/** Set or clear one key of a data object. */
function put(d: Data, k: string, v: unknown): Data {
  const next = { ...d };
  if (v === undefined || v === '') delete next[k];
  else next[k] = v;
  return next;
}

function Picture({
  data,
  onChange,
  disabled,
}: {
  data: Data;
  onChange(next: Data): void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  const image = typeof data.image === 'string' ? data.image : undefined;
  return (
    <div>
      <div className="fr-pic">
        {image ? (
          <img src={image} alt="" data-testid="dz-pic" />
        ) : (
          <span className="fr-help">No picture: the letter icon is used.</span>
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
        <button className="btn alt" disabled={disabled} onClick={() => input.current?.click()}>
          {image ? 'Change picture' : 'Add a picture'}
        </button>
        {image && (
          <button
            className="btn alt"
            disabled={disabled}
            onClick={() => onChange(put(data, 'image', undefined))}
          >
            Remove picture
          </button>
        )}
      </div>
      {problem && <p className="fr-help">{problem}</p>}
    </div>
  );
}

function AbilityFields({
  data,
  onChange,
  disabled,
}: {
  data: Data;
  onChange(d: Data): void;
  disabled?: boolean;
}) {
  return (
    <>
      <Fld label="Kind">
        <select
          className="fr-sel"
          aria-label="Kind"
          disabled={disabled}
          value={str(data, 'kind') || 'ability'}
          onChange={(e) =>
            onChange(put(data, 'kind', e.target.value === 'ability' ? undefined : e.target.value))
          }
        >
          <option value="ability">Ability</option>
          <option value="weakness">Weakness</option>
          <option value="immunity">Immunity</option>
        </select>
      </Fld>
      <Fld label="What it does">
        <textarea
          className="fr-ta"
          aria-label="What it does"
          disabled={disabled}
          value={str(data, 'text')}
          onChange={(e) => onChange(put(data, 'text', e.target.value))}
        />
      </Fld>
      <p className="fr-help">
        In your own words. It shows on the token tooltip, the margin note and Zargon&apos;s order.
      </p>
    </>
  );
}

function SpellFields({
  data,
  onChange,
  disabled,
}: {
  data: Data;
  onChange(d: Data): void;
  disabled?: boolean;
}) {
  const tags = list(data, 'tags').filter(isSpellTag);
  const free = SPELL_TAG_IDS.filter((t) => !tags.includes(t));
  const [pick, setPick] = useState('');
  return (
    <>
      <Fld label="Card text (optional, your own words)">
        <input
          className="fr-in"
          aria-label="Card text"
          disabled={disabled}
          value={str(data, 'text')}
          onChange={(e) => onChange(put(data, 'text', e.target.value))}
        />
      </Fld>
      <div className="fr-hd" style={{ border: 0, padding: '4px 0' }}>
        When the monster may cast it
      </div>
      <ul className="fr-items" data-testid="dz-tags">
        {tags.map((t) => (
          <li key={t} data-tag={t}>
            <b>{t}</b>
            <p className="fr-q">{SPELL_TAG_QUESTIONS[t]}</p>
            <button
              className="x"
              disabled={disabled}
              aria-label={`Remove ${t}`}
              onClick={() =>
                onChange(
                  put(
                    data,
                    'tags',
                    tags.filter((x) => x !== t),
                  ),
                )
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="fr-addrow">
        <select
          className="fr-sel"
          aria-label="Add a situation"
          disabled={disabled}
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">Add a situation…</option>
          {free.map((t) => (
            <option key={t} value={t}>
              {t} · {SPELL_TAG_QUESTIONS[t]}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={disabled || pick === ''}
          aria-label="Add the situation"
          onClick={() => {
            onChange(put(data, 'tags', [...tags, pick]));
            setPick('');
          }}
        >
          Add
        </button>
      </div>
      <p className="fr-help">It fits when any of them is true.</p>
      <Fld label="Or one question of your own (replaces the situations)">
        <input
          className="fr-in"
          aria-label="Own question"
          disabled={disabled}
          value={str(data, 'question')}
          onChange={(e) => onChange(put(data, 'question', e.target.value))}
        />
      </Fld>
      <Fld label="Offer only when">
        <select
          className="fr-sel"
          aria-label="Offer only when"
          disabled={disabled}
          value={str(data, 'offerWhen') || 'always'}
          onChange={(e) =>
            onChange(
              put(data, 'offerWhen', e.target.value === 'always' ? undefined : e.target.value),
            )
          }
        >
          <option value="always">Always</option>
          <option value="escapePoint">The quest has an escape point</option>
        </select>
      </Fld>
      <Fld label="Warning for the players (optional)">
        <input
          className="fr-in"
          aria-label="Warning"
          disabled={disabled}
          value={str(data, 'warning')}
          onChange={(e) => onChange(put(data, 'warning', e.target.value))}
        />
      </Fld>
    </>
  );
}

/** The popup of "New ability…" and "New spell…" in an enemy: saves to the library. */
function NewItemPopup({
  kind,
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  kind: 'ability' | 'spell';
  draft: Data;
  onChange(d: Data): void;
  onCancel(): void;
  onSave(): void;
}) {
  const valid = checkedItem(kind, draft) !== undefined;
  return (
    <Dialog
      title={TITLE[kind]}
      foot={
        <>
          <button className="btn alt" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn" disabled={!valid} onClick={onSave}>
            Save
          </button>
        </>
      }
    >
      <div className="fr-row2">
        <Fld label="Name">
          <input
            className="fr-in"
            aria-label="Name"
            value={str(draft, 'name')}
            onChange={(e) => onChange(put(draft, 'name', e.target.value))}
          />
        </Fld>
        <Fld label="Save in">
          <select className="fr-sel" aria-label="Save in" disabled value="library">
            <option value="library">The library (every quest)</option>
          </select>
        </Fld>
      </div>
      {kind === 'ability' ? (
        <AbilityFields data={draft} onChange={onChange} />
      ) : (
        <SpellFields data={draft} onChange={onChange} />
      )}
    </Dialog>
  );
}

/**
 * The Designer (decision 70), as in the mockup: the library lists on the left, the cards of the
 * selected item in the middle, where it is used and its token on the right. Core items are read
 * only; "Mine" items save as they change. Export and import move the library between devices.
 */
export function DesignerBody({ store, quests }: DesignerBodyProps) {
  const [kind, setKind] = useState<LibraryKind>('enemy');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Data | null>(null);
  const [message, setMessage] = useState('');
  const [popup, setPopup] = useState<{ kind: 'ability' | 'spell'; draft: Data } | null>(null);
  const [usage, setUsage] = useState<readonly UsageRow[]>([]);
  const [abPick, setAbPick] = useState('');
  const [spPick, setSpPick] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => setItems(await store.list()), [store]);
  useEffect(() => {
    // The list comes from storage, so it is loaded after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const mine = items.filter((i) => i.kind === kind);
  const cores = coreRows(kind);
  const rows: Row[] = [
    ...cores,
    ...mine.map((i) => ({
      id: i.id,
      name: i.name,
      core: false,
      data: i.data,
      ...(typeof i.data.image === 'string' ? { image: i.data.image } : {}),
    })),
  ];
  const sel = rows.find((r) => r.id === selected);
  const isCore = sel?.core === true;
  const data: Data | null = sel ? (sel.core ? sel.data : (draft ?? sel.data)) : null;

  // Where the selected item is used: the quests made here (the bundled ones are not read).
  const usageKind: UsageKind | null =
    kind === 'ability' || kind === 'spell' || kind === 'enemy' ? kind : null;
  useEffect(() => {
    let live = true;
    if (!quests || !selected || !usageKind) return;
    void quests().then((qs) => {
      if (live) setUsage(usageOf(usageKind, selected, qs));
    });
    return () => {
      live = false;
    };
  }, [quests, selected, usageKind]);

  const pick = (id: string | null) => {
    setSelected(id);
    setMessage('');
    setUsage([]);
    setAbPick('');
    setSpPick('');
    const row = rows.find((r) => r.id === id);
    setDraft(row ? structuredClone(row.data) : null);
  };
  const switchKind = (k: LibraryKind) => {
    setKind(k);
    setSelected(null);
    setDraft(null);
    setMessage('');
    setUsage([]);
  };

  /** Change the selected "Mine" item: kept in the draft and saved at once when it is valid. */
  const change = (next: Data) => {
    setDraft(next);
    if (!selected || isCore || !checkedItem(kind, next)) return;
    void store
      .save(kind, next, stamp())
      .then(refresh)
      .catch((e: Error) => setMessage(e.message));
  };
  const make = async (d: Data) => {
    await store.save(kind, d, stamp());
    await refresh();
    setSelected(String(d.id));
    setDraft(structuredClone(d));
    setMessage('');
  };
  const create = () => {
    const id = freeId(
      rows.map((r) => r.id),
      `New ${ONE[kind]}`,
    );
    void make(blank(kind, id));
  };
  const copy = () => {
    if (!sel) return;
    const d = structuredClone(sel.data);
    delete d.core;
    const name = `${sel.name} copy`;
    void make({
      ...d,
      id: freeId(
        rows.map((r) => r.id),
        name,
      ),
      name,
    });
  };
  const remove = async () => {
    if (!selected || isCore) return;
    await store.remove(kind, selected);
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

  const count = (k: LibraryKind) => {
    const c = coreRows(k).length;
    const m = items.filter((i) => i.kind === k).length;
    return c && m ? `${c} core · ${m}` : c ? `${c} core` : String(m);
  };

  /** Save the popup's item to the library and give it to the enemy being edited. */
  const savePopup = async () => {
    if (!popup || !draft) return;
    const pk = popup.kind;
    const taken = items.filter((i) => i.kind === pk).map((i) => i.id);
    const core = pk === 'ability' ? CORE_ABILITIES.map((a) => a.id) : CORE_SPELLS.map((s) => s.id);
    const id = freeId([...taken, ...core], str(popup.draft, 'name'));
    try {
      await store.save(pk, { ...popup.draft, id }, stamp());
    } catch (e) {
      setMessage((e as Error).message);
      return;
    }
    await refresh();
    setPopup(null);
    const key = pk === 'ability' ? 'abilities' : 'spells';
    change(put(draft, key, [...list(draft, key), id]));
  };

  // ---------- the cards of the middle column ----------
  const abilityName = (id: string) =>
    CORE_ABILITIES.find((a) => a.id === id)?.name ??
    items.find((i) => i.kind === 'ability' && i.id === id)?.name ??
    id;
  const abilityText = (id: string) =>
    CORE_ABILITIES.find((a) => a.id === id)?.text ??
    String(items.find((i) => i.kind === 'ability' && i.id === id)?.data.text ?? '');
  const spellInfo = (id: string): { name: string; tags: string[] } | undefined => {
    const c = CORE_SPELLS.find((s) => s.id === id);
    if (c) return { name: c.name, tags: [...c.tags] };
    const i = items.find((x) => x.kind === 'spell' && x.id === id);
    return i ? { name: i.name, tags: list(i.data, 'tags') } : undefined;
  };

  const enemyCards = (d: Data) => {
    const base = (str(d, 'base') || 'goblin') as MonsterType;
    const o = (d.overrides ?? {}) as Record<string, number>;
    const stats = { ...MONSTER_STATS[base], ...o } as Record<string, number>;
    const abilities = list(d, 'abilities');
    const spells = list(d, 'spells');
    const spellIds = [...new Set(spells)];
    const setCount = (id: string, n: number) => {
      const m = new Map(spellIds.map((x) => [x, spells.filter((y) => y === x).length] as const));
      if (n <= 0) m.delete(id);
      else m.set(id, n);
      const next = [...m].flatMap(([x, c]) => Array<string>(c).fill(x));
      change(put(d, 'spells', next.length ? next : undefined));
    };
    const freeAbilities = [
      ...CORE_ABILITIES.map((a) => ({ id: a.id, name: a.name })),
      ...items.filter((i) => i.kind === 'ability').map((i) => ({ id: i.id, name: i.name })),
    ].filter((a) => !abilities.includes(a.id));
    const freeSpells = [
      ...CORE_SPELLS.map((s) => ({ id: s.id, name: s.name })),
      ...items.filter((i) => i.kind === 'spell').map((i) => ({ id: i.id, name: i.name })),
    ].filter((s) => !spellIds.includes(s.id));
    return (
      <>
        <Panel title={`Enemy: ${str(d, 'name')}`} testId="dz-card">
          <div className="fr-row2">
            <Fld label="Name">
              <input
                className="fr-in"
                aria-label="Name"
                disabled={isCore}
                value={str(d, 'name')}
                onChange={(e) => change(put(d, 'name', e.target.value))}
              />
            </Fld>
            <Fld label="Source">
              <select className="fr-sel" aria-label="Source" disabled value="x">
                <option value="x">{isCore ? 'Core (read only)' : 'Mine (this device)'}</option>
              </select>
            </Fld>
          </div>
          <div className="fr-stat" data-testid="dz-stats">
            {STATS.map((s) => (
              <Fld key={s} label={s}>
                <input
                  className="fr-in"
                  aria-label={s}
                  inputMode="numeric"
                  disabled={isCore}
                  value={String(stats[s])}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    const next = { ...o };
                    if (
                      e.target.value.trim() === '' ||
                      !Number.isInteger(n) ||
                      n < 0 ||
                      n === MONSTER_STATS[base][s]
                    )
                      delete next[s];
                    else next[s] = n;
                    change(put(d, 'overrides', Object.keys(next).length ? next : undefined));
                  }}
                />
              </Fld>
            ))}
          </div>
          <Fld label={isCore ? 'Hunts' : 'Behaves like'}>
            {isCore ? (
              <select className="fr-sel" aria-label="Hunts" disabled value="x">
                <option value="x">The hero it can reach first (core rule)</option>
              </select>
            ) : (
              <select
                className="fr-sel"
                aria-label="Behaves like"
                value={base}
                onChange={(e) => change(put(d, 'base', e.target.value))}
              >
                {MONSTER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MONSTER_NAMES[t]}
                  </option>
                ))}
              </select>
            )}
          </Fld>
        </Panel>

        <Panel title="Abilities" testId="dz-abilities">
          <ul className="fr-items">
            {abilities.map((id) => (
              <li key={id} data-id={id}>
                <b>{abilityName(id)}</b>
                <p>{abilityText(id)}</p>
                <button
                  className="x"
                  disabled={isCore}
                  aria-label={`Remove ${abilityName(id)}`}
                  onClick={() =>
                    change(
                      put(
                        d,
                        'abilities',
                        abilities.filter((x) => x !== id),
                      ),
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="fr-addrow">
            <select
              className="fr-sel"
              aria-label="Add an ability"
              disabled={isCore}
              value={abPick}
              onChange={(e) => setAbPick(e.target.value)}
            >
              <option value="">Add an ability…</option>
              {freeAbilities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={isCore || abPick === ''}
              aria-label="Add the ability"
              onClick={() => {
                change(put(d, 'abilities', [...abilities, abPick]));
                setAbPick('');
              }}
            >
              Add
            </button>
            <button
              className="btn alt"
              disabled={isCore}
              onClick={() => setPopup({ kind: 'ability', draft: blank('ability', 'new-ability') })}
            >
              New ability…
            </button>
          </div>
        </Panel>

        <Panel title="Spells" testId="dz-spells">
          <ul className="fr-items">
            {spellIds.map((id) => {
              const sp = spellInfo(id);
              const n = spells.filter((y) => y === id).length;
              return (
                <li key={id} data-id={id}>
                  <b>{sp?.name ?? id}</b>
                  <p>
                    {sp
                      ? sp.tags.map((t) => (
                          <span key={t} className="fr-tag">
                            {t}
                          </span>
                        ))
                      : 'Unknown spell.'}
                  </p>
                  <button
                    className="x"
                    disabled={isCore}
                    aria-label={`Remove ${sp?.name ?? id}`}
                    onClick={() => setCount(id, 0)}
                  >
                    Remove
                  </button>
                  <div className="ctl">
                    <select
                      className="fr-sel"
                      aria-label={`${sp?.name ?? id} cast limit`}
                      disabled={isCore}
                      value={String(n)}
                      onChange={(e) => setCount(id, Number(e.target.value))}
                    >
                      {LIMITS.map((l) => (
                        <option key={l.n} value={l.n}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="fr-addrow">
            <select
              className="fr-sel"
              aria-label="Add a spell"
              disabled={isCore}
              value={spPick}
              onChange={(e) => setSpPick(e.target.value)}
            >
              <option value="">Add a spell…</option>
              {freeSpells.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={isCore || spPick === ''}
              aria-label="Add the spell"
              onClick={() => {
                change(put(d, 'spells', [...spells, spPick]));
                setSpPick('');
              }}
            >
              Add
            </button>
            <button
              className="btn alt"
              disabled={isCore}
              onClick={() => setPopup({ kind: 'spell', draft: blank('spell', 'new-spell') })}
            >
              New spell…
            </button>
          </div>
        </Panel>
      </>
    );
  };

  const centre = (d: Data) => {
    if (kind === 'enemy') return enemyCards(d);
    return (
      <Panel title={`${TITLE[kind]}: ${str(d, 'name')}`} testId="dz-card">
        <div className="fr-row2">
          <Fld label="Name">
            <input
              className="fr-in"
              aria-label="Name"
              disabled={isCore}
              value={str(d, 'name')}
              onChange={(e) => change(put(d, 'name', e.target.value))}
            />
          </Fld>
          <Fld label="Source">
            <select className="fr-sel" aria-label="Source" disabled value="x">
              <option value="x">{isCore ? 'Core (read only)' : 'Mine (this device)'}</option>
            </select>
          </Fld>
        </div>
        {kind === 'ability' && <AbilityFields data={d} onChange={change} disabled={isCore} />}
        {kind === 'spell' && <SpellFields data={d} onChange={change} disabled={isCore} />}
        {kind === 'companion' && (
          <>
            <div className="fr-row2">
              {(['defend', 'body'] as const).map((s) => (
                <Fld key={s} label={s}>
                  <input
                    className="fr-in"
                    aria-label={s}
                    inputMode="numeric"
                    value={String(d[s] ?? '')}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      change(
                        put(d, s, e.target.value.trim() === '' || !Number.isInteger(n) ? 0 : n),
                      );
                    }}
                  />
                </Fld>
              ))}
            </div>
            <Fld label="What it does">
              <textarea
                className="fr-ta"
                aria-label="What it does"
                value={str(d, 'text')}
                onChange={(e) => change(put(d, 'text', e.target.value))}
              />
            </Fld>
          </>
        )}
        {kind === 'hero' && isCore && (
          <p className="fr-help">A core hero. Make a copy to add a hero of your own.</p>
        )}
      </Panel>
    );
  };

  return (
    <>
      <Frame>
        <Col label="Library">
          <ListPanel title="Library" testId="dz-library">
            <ul className="fr-list">
              {LIBRARY_KINDS.map((k) => (
                <li key={k} className={k === kind ? 'on' : undefined}>
                  <button
                    className="fr-pick"
                    aria-pressed={k === kind}
                    aria-label={`${LIBRARY_KIND_NAMES[k]} (${count(k)})`}
                    onClick={() => switchKind(k)}
                  >
                    {LIBRARY_KIND_NAMES[k]}
                    <span className="sub">{count(k)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </ListPanel>
          <ListPanel title={LIBRARY_KIND_NAMES[kind]} testId="dz-items" grow>
            <ul className="fr-list">
              {cores.length > 0 && <li className="fr-grp">Core</li>}
              {rows
                .filter((r) => r.core)
                .map((r) => (
                  <li key={r.id} className={r.id === selected ? 'on' : undefined}>
                    <button className="fr-pick" onClick={() => pick(r.id)}>
                      {r.name}
                    </button>
                  </li>
                ))}
              {cores.length > 0 && <li className="fr-grp">Mine</li>}
              {rows
                .filter((r) => !r.core)
                .map((r) => (
                  <li key={r.id} className={r.id === selected ? 'on' : undefined}>
                    <button className="fr-pick" onClick={() => pick(r.id)}>
                      {r.image && <img src={r.image} alt="" className="fr-thumb" />}
                      {r.name}
                    </button>
                  </li>
                ))}
              {mine.length === 0 && (
                <li>
                  <span className="fr-help">Nothing of your own yet.</span>
                </li>
              )}
            </ul>
            <div className="fr-lbtns">
              <button className="btn" onClick={create}>
                New {ONE[kind]}
              </button>
              <button className="btn alt" disabled={!sel} onClick={copy}>
                Copy
              </button>
            </div>
          </ListPanel>
        </Col>

        <Col label="Card">
          {data && sel ? (
            <>
              {centre(data)}
              {!isCore && (
                <button
                  className="btn alt"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => void remove()}
                >
                  Delete {ONE[kind]}
                </button>
              )}
            </>
          ) : (
            <Panel title={LIBRARY_KIND_NAMES[kind]}>
              <p className="fr-help">Pick an item, or make a new one.</p>
            </Panel>
          )}
          {message && (
            <p className="fr-help" role="status" data-testid="dz-message">
              {message}
            </p>
          )}
        </Col>

        <Col label="Details">
          {sel && usageKind && (
            <Panel title="Used in" testId="dz-used">
              {usage.length === 0 ? (
                <p className="fr-help">Not used in your quests yet.</p>
              ) : (
                <ul className="fr-list">
                  {usage.map((u) => (
                    <li key={u.quest}>
                      {u.quest} · {u.count}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
          {data && sel && kind === 'enemy' && (
            <Panel title="Token">
              <p className="fr-help">
                Green coin with the type letter. Custom enemies pick a letter and a picture.
              </p>
              <Fld label="Letter">
                <input
                  className="fr-in"
                  aria-label="Letter (1 or 2)"
                  disabled={isCore}
                  maxLength={2}
                  value={str(data, 'letter')}
                  onChange={(e) => change(put(data, 'letter', e.target.value.slice(0, 2)))}
                />
              </Fld>
              <Picture data={data} onChange={change} disabled={isCore} />
            </Panel>
          )}
          {data && sel && (kind === 'hero' || kind === 'companion') && (
            <Panel title="Picture">
              <Picture data={data} onChange={change} disabled={isCore} />
            </Panel>
          )}
          <Panel title="Library file">
            <div className="fr-lbtns" style={{ padding: 0 }}>
              <button className="btn alt" onClick={() => void exportFile()}>
                Export
              </button>
              <button className="btn alt" onClick={() => file.current?.click()}>
                Import
              </button>
            </div>
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
          </Panel>
        </Col>
      </Frame>
      {popup && (
        <NewItemPopup
          kind={popup.kind}
          draft={popup.draft}
          onChange={(d) => setPopup({ ...popup, draft: d })}
          onCancel={() => setPopup(null)}
          onSave={() => void savePopup()}
        />
      )}
    </>
  );
}

/** The Designer on its own (from the start screen): the top bar with the one tab, and Back. */
export function DesignerScreen({ store, quests, onBack }: DesignerScreenProps) {
  return (
    <div className="app fr designer">
      <TopBar tabs={['Designer']} active="Designer">
        <button className="link" onClick={onBack}>
          Back
        </button>
      </TopBar>
      <DesignerBody store={store} quests={quests} />
    </div>
  );
}

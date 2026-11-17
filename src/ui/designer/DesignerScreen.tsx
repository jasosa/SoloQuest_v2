import { useCallback, useEffect, useRef, useState } from 'react';
import { CORE_ABILITIES } from '../../engine/data/abilities';
import {
  applyCoreFile,
  CORE_EXTRA,
  CORE_FILE_FORMAT,
  CORE_RETIRED,
  type CoreKind,
} from '../../engine/data/coreFile';
import { addTombstone, buildCoreExport, readPending } from '../../content/corePending';
import { questEntries } from '../quests';
import { HERO_NAMES, HEROES } from '../../engine/data/heroes';
import { MONSTER_NAMES, MONSTER_STATS } from '../../engine/data/monsters';
import { PLAN_TEXT, RULE_TEXT } from '../../engine/zargon/texts';
import {
  PROFILES,
  PROFILE_OF_TYPE,
  RULE_KEYS,
  WEIGHTS,
  type Profile,
  type RuleKey,
} from '../../engine/zargon/weights';
import {
  CORE_SPELLS,
  SPELL_TAG_IDS,
  SPELL_TAG_QUESTIONS,
  isSpellTag,
} from '../../engine/data/spells';
import {
  enemyDiffersFromLibrary,
  keepCoreItemInQuest,
  refreshEnemyInQuest,
} from '../../engine/editor/library';
import { usageOf, type UsageKind, type UsageRow } from '../../engine/editor/usage';
import {
  EnemyDefSchema,
  MONSTER_TYPES,
  type Origin,
  type AbilityDefData,
  type MonsterType,
  type Quest,
  type SpellDefData,
} from '../../engine/quest/schema';
import {
  LIBRARY_KINDS,
  LIBRARY_KIND_NAMES,
  checkedItem,
  type LibraryItem,
  type LibraryKind,
  type LibraryStore,
} from '../../persist/library';
import { MONSTER_LETTER } from '../play/monsterCodes';
import { Col, Dialog, Fld, Frame, ListPanel, Panel, Toggle, TopBar } from '../shared/Frame';
import { useFitMode } from '../FitToScreen';
import { shrinkImage } from './imageFile';

type Data = Record<string, unknown>;

/**
 * Owner mode (decision 76): the owner can change Core items. Everyone else sees Core read only.
 * The choice is kept on this device; without one, the development build is in owner mode.
 */
const OWNER_KEY = 'soloquest-owner-mode';
function ownerModeOn(): boolean {
  try {
    const v = localStorage.getItem(OWNER_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* storage unavailable: fall through */
  }
  return import.meta.env.DEV;
}
function rememberOwnerMode(on: boolean): void {
  try {
    localStorage.setItem(OWNER_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
const ORIGIN_LABEL: Readonly<Record<Origin, string>> = {
  official: 'official',
  'fan-made': 'fan-made',
};

/** The quests to look at for the "Used in" panel. */
export type QuestSource = () => Promise<readonly { title: string; quest: Quest }[]>;

/**
 * Change every quest made here (saved and draft). The function returns the changed quest, or
 * undefined to leave it. Resolves to the number of quests that changed.
 */
export type QuestUpdater = (fn: (q: Quest) => Quest | undefined) => Promise<number>;

export interface DesignerBodyProps {
  store: LibraryStore;
  quests?: QuestSource;
  updateQuests?: QuestUpdater;
}

export interface DesignerScreenProps extends DesignerBodyProps {
  onBack(): void;
}

/** Core items are official. Others say so, and an item with no origin is fan-made. */
const originOf = (r: { core: boolean; data: Record<string, unknown> }): Origin =>
  r.core ? 'official' : r.data.origin === 'official' ? 'official' : 'fan-made';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly core: boolean;
  /** A core item that has been changed (saved in the library under its own id). */
  readonly edited?: boolean;
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
const PROFILE_LABELS: Readonly<Record<Profile, string>> = {
  skirmisher: 'Skirmisher: attacks, then runs back',
  fighter: 'Fighter: attacks, sometimes moves back',
  relentless: 'Relentless: never falls back',
  caster: 'Caster: a spell first',
};
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

/** The monsters and heroes of the game itself are not deleted (the rules need them). */
const builtIn = (kind: LibraryKind, id: string): boolean =>
  (kind === 'enemy' && (MONSTER_TYPES as readonly string[]).includes(id)) ||
  (kind === 'hero' && (HEROES as readonly string[]).includes(id));

/** Core items that the Core files add (the built-in ones are in code). */
function extraRows(kind: 'enemy' | 'hero' | 'companion'): Row[] {
  return CORE_EXTRA[kind].map((it) => ({
    id: it.data.id,
    name: it.data.name,
    core: true,
    data: { ...it.data } as Data,
  }));
}

function coreRows(kind: LibraryKind): Row[] {
  switch (kind) {
    case 'ability':
      return CORE_ABILITIES.map((a) => ({ id: a.id, name: a.name, core: true, data: { ...a } }));
    case 'spell':
      return CORE_SPELLS.map((s) => {
        const { core: _flag, ...rest } = s;
        void _flag;
        return { id: s.id, name: s.name, core: true, data: { ...rest } as Data };
      });
    case 'enemy':
      return [
        ...MONSTER_TYPES.filter((t) => !CORE_RETIRED.enemy.has(t)).map((t) => ({
          id: t as string,
          name: MONSTER_NAMES[t],
          core: true,
          data: { id: t, name: MONSTER_NAMES[t], base: t, letter: MONSTER_LETTER[t] } as Data,
        })),
        ...extraRows('enemy'),
      ];
    case 'hero':
      return [
        ...HEROES.filter((h) => !CORE_RETIRED.hero.has(h)).map((h) => ({
          id: h as string,
          name: HERO_NAMES[h],
          core: true,
          data: { id: h, name: HERO_NAMES[h] } as Data,
        })),
        ...extraRows('hero'),
      ];
    case 'companion':
      return extraRows('companion');
  }
}

function blank(kind: LibraryKind, id: string): Data {
  const name = `New ${ONE[kind]}`;
  switch (kind) {
    case 'ability':
      return { id, name, origin: 'fan-made', text: 'Describe it in your own words.' };
    case 'spell':
      return { id, name, origin: 'fan-made', tags: ['heroAdjacent'] };
    case 'enemy':
      return { id, name, origin: 'fan-made', base: 'goblin' };
    case 'hero':
      return { id, name, origin: 'fan-made' };
    case 'companion':
      return {
        id,
        name,
        origin: 'fan-made',
        defend: 2,
        body: 2,
        text: 'What the helper does.',
      };
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
      <Fld label="When it is cast">
        <select
          className="fr-sel"
          aria-label="When it is cast"
          disabled={disabled}
          value={str(data, 'timing') || 'either'}
          onChange={(e) =>
            onChange(put(data, 'timing', e.target.value === 'either' ? undefined : e.target.value))
          }
        >
          <option value="either">It may move first, then cast</option>
          <option value="beforeMoving">Cast first, then it may move</option>
          <option value="afterMoving">Move first, then cast</option>
          <option value="instead">Cast instead of moving</option>
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
export function DesignerBody({ store, quests, updateQuests }: DesignerBodyProps) {
  const [owner, setOwner] = useState(ownerModeOn);
  const [del, setDel] = useState<{
    id: string;
    name: string;
    own: readonly UsageRow[];
    bundled: readonly UsageRow[];
  } | null>(null);
  const [kind, setKind] = useState<LibraryKind>('enemy');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Data | null>(null);
  const [message, setMessage] = useState('');
  const [popup, setPopup] = useState<{ kind: 'ability' | 'spell'; draft: Data } | null>(null);
  const [usage, setUsage] = useState<readonly UsageRow[]>([]);
  const [questList, setQuestList] = useState<readonly { title: string; quest: Quest }[]>([]);
  const [abPick, setAbPick] = useState('');
  const [spPick, setSpPick] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => setItems(await store.list()), [store]);
  useEffect(() => {
    // The list comes from storage, so it is loaded after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const kindItems = items.filter((i) => i.kind === kind);
  const baseCores = coreRows(kind);
  const coreIds = new Set(baseCores.map((c) => c.id));
  const cores: Row[] = baseCores.map((c) => {
    const saved = kindItems.find((i) => i.id === c.id);
    return saved ? { ...c, name: saved.name, data: saved.data, edited: true } : c;
  });
  const mine = kindItems.filter((i) => !coreIds.has(i.id));
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
  const locked = isCore && !owner;
  const data: Data | null = sel ? (draft ?? sel.data) : null;
  const sourceLabel = !isCore
    ? 'My library (this device)'
    : !owner
      ? 'Core (read only)'
      : sel?.edited
        ? 'Core (changed)'
        : 'Core (you can change it)';

  // Where the selected item is used: the quests made here (the bundled ones are not read).
  const usageKind: UsageKind | null =
    kind === 'ability' || kind === 'spell' || kind === 'enemy' ? kind : null;
  useEffect(() => {
    let live = true;
    if (!quests || !selected || !usageKind) return;
    void quests().then((qs) => {
      if (live) {
        setUsage(usageOf(usageKind, selected, qs));
        setQuestList(qs);
      }
    });
    return () => {
      live = false;
    };
  }, [quests, selected, usageKind]);

  // The selected enemy as the quests would copy it, and how many quests hold a different copy.
  const parsedEnemy = kind === 'enemy' && data ? EnemyDefSchema.safeParse(data) : undefined;
  const enemyDef = parsedEnemy?.success ? parsedEnemy.data : undefined;
  const outdated = enemyDef
    ? questList.filter((q) => enemyDiffersFromLibrary(q.quest, enemyDef)).length
    : 0;

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
    if (!selected || locked || !checkedItem(kind, next)) return;
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
    if (!selected || locked) return;
    await store.remove(kind, selected);
    // a core item goes back to the core data, a made one is gone
    if (isCore) {
      const row = coreRows(kind).find((c) => c.id === selected);
      setDraft(row ? structuredClone(row.data) : null);
    } else pick(null);
    await refresh();
  };
  /** What taking the selected Core item out of Core would touch: your quests and the bundled ones. */
  const askDelete = async () => {
    if (!sel || !isCore || !owner || builtIn(kind, sel.id)) return;
    const own = usageKind && quests ? usageOf(usageKind, sel.id, await quests()) : [];
    const bundled = usageKind
      ? usageOf(
          usageKind,
          sel.id,
          questEntries.flatMap((q) =>
            q.level
              ? [{ title: `Quest ${q.number}: ${q.level.quest.title}`, quest: q.level.quest }]
              : [],
          ),
        )
      : [];
    setDel({ id: sel.id, name: sel.name, own, bundled });
  };
  const confirmDelete = async () => {
    if (!del || !sel) return;
    const id = del.id;
    // quests of yours that use an ability or spell keep it: a copy goes into the quest first
    if ((kind === 'ability' || kind === 'spell') && updateQuests && data) {
      const def = (kind === 'ability' ? CORE_ABILITIES : CORE_SPELLS).find((x) => x.id === id);
      if (def) {
        const { core: _core, ...plain } = def as typeof def & { core?: boolean };
        void _core;
        await updateQuests((q) => {
          const next = keepCoreItemInQuest(q, kind, plain as never);
          return next === q ? undefined : next;
        });
      }
    }
    const tomb = addTombstone(kind as CoreKind, id, del.name);
    applyCoreFile(tomb);
    await store.remove(kind, id); // a changed copy of it in the library goes too
    setDel(null);
    pick(null);
    await refresh();
    setMessage(
      `${del.name} is out of Core on this device. Export Core to put it in the repository.`,
    );
  };
  const exportCore = async () => {
    const lib = items.map((i) => ({ kind: i.kind as CoreKind, data: i.data }));
    const coreIdOf = (k: CoreKind, id: string) =>
      coreRows(k as LibraryKind).some((r) => r.id === id);
    const file = buildCoreExport(readPending(), lib, coreIdOf);
    const text = JSON.stringify({ ...file, format: CORE_FILE_FORMAT }, null, 2) + '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'core.json';
    a.click();
    URL.revokeObjectURL(url);
    setMessage('core.json is saved. Put it in src/content/library/ and rebuild.');
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
    const ids = new Set(coreRows(k).map((x) => x.id));
    const c = ids.size;
    const m = items.filter((i) => i.kind === k && !ids.has(i.id)).length;
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
    // An enemy may start from a core monster (stats, plan and weights follow it until changed) or
    // be completely its own: then it keeps all five stats, its plan and its weights itself.
    const baseId = str(d, 'base') as MonsterType | '';
    const own = baseId === '';
    const o = (d.overrides ?? {}) as Record<string, number>;
    const baseStats = { ...MONSTER_STATS[baseId || 'goblin'] } as Record<string, number>;
    const stats = { ...baseStats, ...o } as Record<string, number>;
    const profile = (str(d, 'profile') ||
      (baseId ? PROFILE_OF_TYPE[baseId] : 'fighter')) as Profile;
    const defaultWeights: Partial<Record<RuleKey, number>> = baseId
      ? WEIGHTS[baseId]
      : { closest: 1 };
    const weights = (d.weights ?? defaultWeights) as Partial<Record<RuleKey, number>>;
    const setWeight = (k: RuleKey, n: number) => {
      const next: Partial<Record<RuleKey, number>> = { ...weights, [k]: n };
      if (!n) delete next[k];
      if (Object.keys(next).length === 0) next.closest = 1;
      change(put(d, 'weights', next));
    };
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
                disabled={locked}
                value={str(d, 'name')}
                onChange={(e) => change(put(d, 'name', e.target.value))}
              />
            </Fld>
            <Fld label="Source">
              <select className="fr-sel" aria-label="Source" disabled value="x">
                <option value="x">{sourceLabel}</option>
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
                  disabled={locked}
                  value={String(stats[s])}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    // with a base, a stat equal to the base needs no override; on its own all five are kept
                    const next = own ? { ...stats } : { ...o };
                    if (e.target.value.trim() === '' || !Number.isInteger(n) || n < 0) {
                      if (!own) delete next[s];
                    } else if (!own && n === baseStats[s]) delete next[s];
                    else next[s] = n;
                    change(put(d, 'overrides', Object.keys(next).length ? next : undefined));
                  }}
                />
              </Fld>
            ))}
          </div>
          <Fld label={locked ? 'Hunts' : 'Starts from'}>
            {locked ? (
              <select className="fr-sel" aria-label="Hunts" disabled value="x">
                <option value="x">The hero it can reach first (core rule)</option>
              </select>
            ) : (
              <select
                className="fr-sel"
                aria-label="Starts from"
                value={baseId}
                onChange={(e) => {
                  const v = e.target.value as MonsterType | '';
                  if (v === '') {
                    // on its own: keep what it has now, in its own fields
                    change({
                      ...put(d, 'base', undefined),
                      overrides: stats,
                      profile,
                      weights,
                    });
                  } else {
                    // from a core monster: take its stats, plan and weights as a start
                    change({
                      ...put(d, 'base', v),
                      overrides: undefined,
                      profile: PROFILE_OF_TYPE[v],
                      weights: { ...WEIGHTS[v] },
                    });
                  }
                }}
              >
                <option value="">Nothing: its own rules</option>
                {MONSTER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MONSTER_NAMES[t]}
                  </option>
                ))}
              </select>
            )}
          </Fld>
          <Fld label="Plan">
            <select
              className="fr-sel"
              aria-label="Plan"
              disabled={locked}
              value={profile}
              onChange={(e) => change(put(d, 'profile', e.target.value))}
            >
              {PROFILES.map((p) => (
                <option key={p} value={p}>
                  {PROFILE_LABELS[p]}
                </option>
              ))}
            </select>
          </Fld>
          <p className="fr-help">{PLAN_TEXT[profile]}</p>
          <div className="lbl">Who it goes for (weight 0 to 9, 0 never)</div>
          <div data-testid="dz-weights">
            {RULE_KEYS.map((k) => (
              <Fld key={k} label={RULE_TEXT[k]}>
                <input
                  className="fr-in"
                  aria-label={`Weight: ${k}`}
                  inputMode="numeric"
                  disabled={locked}
                  value={String(weights[k] ?? 0)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (e.target.value.trim() === '' || (Number.isInteger(n) && n >= 0 && n <= 9))
                      setWeight(k, e.target.value.trim() === '' ? 0 : n);
                  }}
                />
              </Fld>
            ))}
          </div>
        </Panel>

        <Panel title="Abilities" testId="dz-abilities">
          <ul className="fr-items">
            {abilities.map((id) => (
              <li key={id} data-id={id}>
                <b>{abilityName(id)}</b>
                <p>{abilityText(id)}</p>
                <button
                  className="x"
                  disabled={locked}
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
              disabled={locked}
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
              disabled={locked || abPick === ''}
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
              disabled={locked}
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
                    disabled={locked}
                    aria-label={`Remove ${sp?.name ?? id}`}
                    onClick={() => setCount(id, 0)}
                  >
                    Remove
                  </button>
                  <div className="ctl">
                    <select
                      className="fr-sel"
                      aria-label={`${sp?.name ?? id} cast limit`}
                      disabled={locked}
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
              disabled={locked}
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
              disabled={locked || spPick === ''}
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
              disabled={locked}
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
              disabled={locked}
              value={str(d, 'name')}
              onChange={(e) => change(put(d, 'name', e.target.value))}
            />
          </Fld>
          <Fld label="Source">
            <select className="fr-sel" aria-label="Source" disabled value="x">
              <option value="x">{sourceLabel}</option>
            </select>
          </Fld>
        </div>
        {kind === 'ability' && <AbilityFields data={d} onChange={change} disabled={locked} />}
        {kind === 'spell' && <SpellFields data={d} onChange={change} disabled={locked} />}
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
          <p className="fr-help">
            A core hero. You can rename it, give it a picture, or make a copy.
          </p>
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
            <Toggle
              label="Owner mode: Core can be changed"
              on={owner}
              onChange={(on) => {
                setOwner(on);
                rememberOwnerMode(on);
              }}
            />
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
                      <span className="sub" data-origin={originOf(r)}>
                        {r.edited ? 'changed · ' : ''}
                        {ORIGIN_LABEL[originOf(r)]}
                      </span>
                    </button>
                  </li>
                ))}
              {cores.length > 0 && <li className="fr-grp">My library</li>}
              {rows
                .filter((r) => !r.core)
                .map((r) => (
                  <li key={r.id} className={r.id === selected ? 'on' : undefined}>
                    <button className="fr-pick" onClick={() => pick(r.id)}>
                      {r.image && <img src={r.image} alt="" className="fr-thumb" />}
                      {r.name}
                      <span className="sub" data-origin={originOf(r)}>
                        {ORIGIN_LABEL[originOf(r)]}
                      </span>
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
              {isCore && owner && !builtIn(kind, sel.id) && (
                <button
                  className="btn alt"
                  style={{ alignSelf: 'flex-start' }}
                  data-testid="dz-delete-core"
                  onClick={() => void askDelete()}
                >
                  Delete from Core
                </button>
              )}
              {!locked && (!isCore || sel.edited) && (
                <button
                  className="btn alt"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => void remove()}
                >
                  {isCore ? 'Reset to core' : `Delete ${ONE[kind]}`}
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
          {sel && data && (
            <Panel title="Origin" testId="dz-origin">
              <Fld label="Origin">
                <select
                  className="fr-sel"
                  aria-label="Origin"
                  // core is always official; only the owner can call an item of the library official
                  disabled={isCore || !owner}
                  value={isCore ? 'official' : data.origin === 'official' ? 'official' : 'fan-made'}
                  onChange={(e) => change(put(data, 'origin', e.target.value))}
                >
                  <option value="official">Official</option>
                  <option value="fan-made">Fan-made</option>
                </select>
              </Fld>
              {owner && !isCore && data.origin === 'official' && (
                <Fld label="Expansion (empty: the base game)">
                  <input
                    className="fr-in"
                    aria-label="Expansion"
                    value={str(data, 'expansion')}
                    onChange={(e) => change(put(data, 'expansion', e.target.value || undefined))}
                  />
                </Fld>
              )}
              <p className="fr-help">
                Official items come from the game or its expansions. Everything else a person makes
                is fan-made.
              </p>
            </Panel>
          )}
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
              {kind === 'enemy' && updateQuests && enemyDef && (
                <>
                  <p className="fr-help" data-testid="dz-outdated">
                    {outdated === 0
                      ? 'Every quest has this version.'
                      : `${outdated} quest${outdated === 1 ? ' has' : 's have'} an older copy.`}
                  </p>
                  <button
                    className="btn alt"
                    data-testid="dz-update-all"
                    disabled={outdated === 0}
                    onClick={() => {
                      const libContent = {
                        abilities: items
                          .filter((i) => i.kind === 'ability')
                          .map((i) => i.data as unknown as AbilityDefData),
                        spells: items
                          .filter((i) => i.kind === 'spell')
                          .map((i) => i.data as unknown as SpellDefData),
                      };
                      void updateQuests((q) => refreshEnemyInQuest(q, enemyDef, libContent)).then(
                        (n) => {
                          setMessage(`Updated in ${n} quest${n === 1 ? '' : 's'}.`);
                          void quests?.().then((qs) => setQuestList(qs));
                        },
                      );
                    }}
                  >
                    Update in all quests
                  </button>
                </>
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
                  disabled={locked}
                  maxLength={2}
                  value={str(data, 'letter')}
                  onChange={(e) => change(put(data, 'letter', e.target.value.slice(0, 2)))}
                />
              </Fld>
              <Picture data={data} onChange={change} disabled={locked} />
            </Panel>
          )}
          {data && sel && (kind === 'hero' || kind === 'companion') && (
            <Panel title="Picture">
              <Picture data={data} onChange={change} disabled={locked} />
            </Panel>
          )}
          {owner && (
            <Panel title="Core file" testId="dz-core-file">
              <p className="fr-help">
                Your changes to Core (changed, new official and deleted items) go into one file for{' '}
                <code>src/content/library/</code>.
              </p>
              <div className="fr-lbtns" style={{ padding: 0 }}>
                <button
                  className="btn alt"
                  data-testid="dz-export-core"
                  onClick={() => void exportCore()}
                >
                  Export Core
                </button>
              </div>
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
      {del && (
        <Dialog
          title="Delete from Core"
          foot={
            <>
              <button className="btn alt" onClick={() => setDel(null)}>
                Cancel
              </button>
              <button
                className="btn"
                data-testid="dz-delete-confirm"
                onClick={() => void confirmDelete()}
              >
                Delete {del.name}
              </button>
            </>
          }
        >
          <p>{del.name} leaves Core. It stays in quests only as far as they already copy it.</p>
          {del.own.length > 0 ? (
            <>
              <p>These quests of yours use it (an ability or spell is copied into them first):</p>
              <ul data-testid="dz-delete-own">
                {del.own.map((u) => (
                  <li key={u.quest}>
                    {u.quest} · {u.count}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>None of your quests uses it.</p>
          )}
          {del.bundled.length > 0 && (
            <>
              <p className="warn">
                These bundled quests use it. They stop validating until you fix them:
              </p>
              <ul data-testid="dz-delete-bundled">
                {del.bundled.map((u) => (
                  <li key={u.quest}>
                    {u.quest} · {u.count}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Dialog>
      )}
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
export function DesignerScreen({ store, quests, updateQuests, onBack }: DesignerScreenProps) {
  useFitMode('width');
  return (
    <div className="app fr designer">
      <TopBar tabs={['Designer']} active="Designer">
        <button className="link" onClick={onBack}>
          Back
        </button>
      </TopBar>
      <DesignerBody store={store} quests={quests} updateQuests={updateQuests} />
    </div>
  );
}

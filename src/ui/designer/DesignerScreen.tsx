import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { NEUTRAL_BAR, barOfExpansion, useBarContext } from '../boxBars';
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
import { Col, Dialog, Fld, Panel, Toggle, TopBar } from '../shared/Frame';
import { useFitMode } from '../FitToScreen';
import { shrinkImage } from './imageFile';
import { expansionNames, expansionOf, setExpansionHidden, useHiddenExpansions } from './expansions';
import { t } from '../../i18n/t';
import { ownerModeOn, rememberOwnerMode } from '../../persist/ownerMode';

type Data = Record<string, unknown>;

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
const KIND_RANK: readonly LibraryKind[] = ['enemy', 'ability', 'spell', 'hero', 'companion'];
/** The kinds as the list shows them: the ones quests use most first. */
const KIND_ORDER: readonly LibraryKind[] = LIBRARY_KINDS.toSorted(
  (a, b) => KIND_RANK.indexOf(a) - KIND_RANK.indexOf(b),
);
const STATS = ['move', 'att', 'def', 'body', 'mind'] as const;
const PROFILE_LABELS: Readonly<Record<Profile, string>> = {
  skirmisher: 'Skirmisher: attacks, then runs back',
  fighter: 'Fighter: attacks, sometimes moves back',
  relentless: 'Relentless: never falls back',
  caster: 'Caster: a spell first',
  thief: 'Thief: steals, then runs away',
  grappler: 'Grappler: hugs a hero it wounds',
  shooter: 'Shooter: shoots from a distance',
  passive: 'Passive: no orders',
};
const LIMITS = [
  { n: 1, label: t('designer.DesignerScreen.onceInTheQuest', 'Once in the quest') },
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
  const name = t('designer.DesignerScreen.new', 'New {v1}', { v1: ONE[kind] });
  switch (kind) {
    case 'ability':
      return {
        id,
        name,
        origin: 'fan-made',
        text: t('designer.DesignerScreen.describeItInYour', 'Describe it in your own words.'),
      };
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
        text: t('designer.DesignerScreen.whatTheHelperDoes', 'What the helper does.'),
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
          <span className="fr-help">
            {t(
              'designer.DesignerScreen.noPictureTheLetter',
              'No picture: the letter icon is used.',
            )}
          </span>
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
          {image
            ? t('designer.DesignerScreen.changePicture', 'Change picture')
            : t('designer.DesignerScreen.addAPicture', 'Add a picture')}
        </button>
        {image && (
          <button
            className="btn alt"
            disabled={disabled}
            onClick={() => onChange(put(data, 'image', undefined))}
          >
            {t('designer.DesignerScreen.removePicture', 'Remove picture')}
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
      <Fld label={t('designer.DesignerScreen.kind', 'Kind')}>
        <select
          className="fr-sel"
          aria-label={t('designer.DesignerScreen.kind', 'Kind')}
          disabled={disabled}
          value={str(data, 'kind') || 'ability'}
          onChange={(e) =>
            onChange(put(data, 'kind', e.target.value === 'ability' ? undefined : e.target.value))
          }
        >
          <option value="ability">{t('designer.DesignerScreen.ability', 'Ability')}</option>
          <option value="weakness">{t('designer.DesignerScreen.weakness', 'Weakness')}</option>
          <option value="immunity">{t('designer.DesignerScreen.immunity', 'Immunity')}</option>
        </select>
      </Fld>
      <Fld label={t('designer.DesignerScreen.whatItDoes', 'What it does')}>
        <textarea
          className="fr-ta"
          aria-label={t('designer.DesignerScreen.whatItDoes', 'What it does')}
          disabled={disabled}
          value={str(data, 'text')}
          onChange={(e) => onChange(put(data, 'text', e.target.value))}
        />
      </Fld>
      <p className="fr-help">
        {t(
          'designer.helpInYourOwnWords',
          "In your own words. It shows on the token tooltip, the margin note and Zargon's order.",
        )}
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
  const tags = list(data, 'tags');
  const own = (Array.isArray(data.situations) ? data.situations : []) as {
    id: string;
    question: string;
  }[];
  const ownQuestion = (id: string) =>
    own.find((x) => x.id === id)?.question ?? (isSpellTag(id) ? SPELL_TAG_QUESTIONS[id] : id);
  const free = [...SPELL_TAG_IDS, ...own.map((x) => x.id)].filter((t) => !tags.includes(t));
  const [pick, setPick] = useState('');
  const [newId, setNewId] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const newIdOk =
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(newId.trim()) &&
    !isSpellTag(newId.trim()) &&
    !own.some((x) => x.id === newId.trim()) &&
    newQuestion.trim() !== '';
  return (
    <>
      <Fld
        label={t(
          'designer.DesignerScreen.cardTextOptionalYour',
          'Card text (optional, your own words)',
        )}
      >
        <input
          className="fr-in"
          aria-label={t('designer.DesignerScreen.cardText', 'Card text')}
          disabled={disabled}
          value={str(data, 'text')}
          onChange={(e) => onChange(put(data, 'text', e.target.value))}
        />
      </Fld>
      <div className="fr-hd" style={{ border: 0, padding: '4px 0' }}>
        {t('designer.DesignerScreen.whenTheMonsterMay', 'When the monster may cast it')}
      </div>
      <ul className="fr-items" data-testid="dz-tags">
        {tags.map((tv) => (
          <li key={tv} data-tag={tv}>
            <b>{tv}</b>
            <p className="fr-q">{ownQuestion(tv)}</p>
            <button
              className="x"
              disabled={disabled}
              aria-label={t('designer.DesignerScreen.remove2', 'Remove {tv}', { tv })}
              onClick={() =>
                onChange(
                  put(
                    data,
                    'tags',
                    tags.filter((x) => x !== tv),
                  ),
                )
              }
            >
              {t('designer.DesignerScreen.remove', 'Remove')}
            </button>
          </li>
        ))}
      </ul>
      <div className="fr-addrow">
        <select
          className="fr-sel"
          aria-label={t('designer.DesignerScreen.addASituation', 'Add a situation')}
          disabled={disabled}
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">
            {t('designer.DesignerScreen.addASituation2', 'Add a situation…')}
          </option>
          {free.map((t) => (
            <option key={t} value={t}>
              {t} · {ownQuestion(t)}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={disabled || pick === ''}
          aria-label={t('designer.DesignerScreen.addTheSituation', 'Add the situation')}
          onClick={() => {
            onChange(put(data, 'tags', [...tags, pick]));
            setPick('');
          }}
        >
          {t('designer.DesignerScreen.add', 'Add')}
        </button>
      </div>
      <p className="fr-help">
        {t('designer.DesignerScreen.itFitsWhenAny', 'It fits when any of them is true.')}
      </p>
      <div className="fr-hd" style={{ border: 0, padding: '4px 0' }}>
        {t('designer.DesignerScreen.situationsOfYourOwn', 'Situations of your own')}
      </div>
      <ul className="fr-items" data-testid="dz-situations">
        {own.map((x) => (
          <li key={x.id} data-situation={x.id}>
            <b>{x.id}</b>
            <input
              className="fr-in"
              aria-label={t('designer.DesignerScreen.questionOf', 'Question of {id}', { id: x.id })}
              disabled={disabled}
              value={x.question}
              onChange={(e) =>
                onChange(
                  put(
                    data,
                    'situations',
                    own.map((y) => (y.id === x.id ? { id: x.id, question: e.target.value } : y)),
                  ),
                )
              }
            />
            <button
              className="x"
              disabled={disabled || tags.includes(x.id)}
              title={
                tags.includes(x.id)
                  ? t(
                      'designer.DesignerScreen.removeItFromTheList',
                      'Remove it from the list above first',
                    )
                  : undefined
              }
              aria-label={t('designer.DesignerScreen.removeSituation', 'Remove situation {id}', {
                id: x.id,
              })}
              onClick={() =>
                onChange(
                  put(
                    data,
                    'situations',
                    own.filter((y) => y.id !== x.id),
                  ),
                )
              }
            >
              {t('designer.DesignerScreen.remove', 'Remove')}
            </button>
          </li>
        ))}
      </ul>
      <div className="fr-addrow">
        <input
          className="fr-in"
          aria-label={t('designer.DesignerScreen.situationId', 'Situation id')}
          placeholder={t('designer.DesignerScreen.idShortNoSpaces', 'Id (short, no spaces)')}
          disabled={disabled}
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
        />
        <input
          className="fr-in"
          aria-label={t('designer.DesignerScreen.situationQuestion', 'Situation question')}
          placeholder={t(
            'designer.DesignerScreen.aQuestionThePlayersCan',
            'A question the players can answer',
          )}
          disabled={disabled}
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
        />
        <button
          className="btn"
          disabled={disabled || !newIdOk}
          aria-label={t('designer.DesignerScreen.addSituation', 'Add situation')}
          onClick={() => {
            const id = newId.trim();
            onChange({
              ...put(data, 'situations', [...own, { id, question: newQuestion.trim() }]),
              tags: [...tags, id],
            });
            setNewId('');
            setNewQuestion('');
          }}
        >
          {t('designer.DesignerScreen.addSituation', 'Add situation')}
        </button>
      </div>
      {newId.trim() !== '' && !newIdOk && (
        <p className="fr-help">
          {t(
            'designer.DesignerScreen.theIdUsesLettersNumbers',
            'The id uses letters, numbers, - and _, and is not a fixed situation or one you already added.',
          )}
        </p>
      )}
      <Fld
        label={t(
          'designer.DesignerScreen.orOneQuestionOf',
          'Or one question of your own (replaces the situations)',
        )}
      >
        <input
          className="fr-in"
          aria-label={t('designer.DesignerScreen.ownQuestion', 'Own question')}
          disabled={disabled}
          value={str(data, 'question')}
          onChange={(e) => onChange(put(data, 'question', e.target.value))}
        />
      </Fld>
      <Fld label={t('designer.DesignerScreen.offerOnlyWhen', 'Offer only when')}>
        <select
          className="fr-sel"
          aria-label={t('designer.DesignerScreen.offerOnlyWhen', 'Offer only when')}
          disabled={disabled}
          value={str(data, 'offerWhen') || 'always'}
          onChange={(e) =>
            onChange(
              put(data, 'offerWhen', e.target.value === 'always' ? undefined : e.target.value),
            )
          }
        >
          <option value="always">{t('designer.DesignerScreen.always', 'Always')}</option>
          <option value="escapePoint">
            {t('designer.DesignerScreen.theQuestHasAn', 'The quest has an escape point')}
          </option>
        </select>
      </Fld>
      <Fld label={t('designer.DesignerScreen.whenItIsCast', 'When it is cast')}>
        <select
          className="fr-sel"
          aria-label={t('designer.DesignerScreen.whenItIsCast', 'When it is cast')}
          disabled={disabled}
          value={str(data, 'timing') || 'either'}
          onChange={(e) =>
            onChange(put(data, 'timing', e.target.value === 'either' ? undefined : e.target.value))
          }
        >
          <option value="either">
            {t('designer.DesignerScreen.itMayMoveFirst', 'It may move first, then cast')}
          </option>
          <option value="beforeMoving">
            {t('designer.DesignerScreen.castFirstThenIt', 'Cast first, then it may move')}
          </option>
          <option value="afterMoving">
            {t('designer.DesignerScreen.moveFirstThenCast', 'Move first, then cast')}
          </option>
          <option value="instead">
            {t('designer.DesignerScreen.castInsteadOfMoving', 'Cast instead of moving')}
          </option>
        </select>
      </Fld>
      <Fld
        label={t(
          'designer.DesignerScreen.warningForThePlayers',
          'Warning for the players (optional)',
        )}
      >
        <input
          className="fr-in"
          aria-label={t('designer.DesignerScreen.warning', 'Warning')}
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
      onClose={onCancel}
      foot={
        <>
          <button className="btn alt" onClick={onCancel}>
            {t('designer.DesignerScreen.cancel', 'Cancel')}
          </button>
          <button className="btn" disabled={!valid} onClick={onSave}>
            {t('designer.DesignerScreen.save', 'Save')}
          </button>
        </>
      }
    >
      <div className="fr-row2">
        <Fld label={t('designer.DesignerScreen.name', 'Name')}>
          <input
            className="fr-in"
            aria-label={t('designer.DesignerScreen.name', 'Name')}
            value={str(draft, 'name')}
            onChange={(e) => onChange(put(draft, 'name', e.target.value))}
          />
        </Fld>
        <Fld label={t('designer.DesignerScreen.saveIn', 'Save in')}>
          <select
            className="fr-sel"
            aria-label={t('designer.DesignerScreen.saveIn', 'Save in')}
            disabled
            value="library"
          >
            <option value="library">
              {t('designer.DesignerScreen.theLibraryEveryQuest', 'The library (every quest)')}
            </option>
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
  const bars = useBarContext();
  const [owner, setOwner] = useState(ownerModeOn);
  const [del, setDel] = useState<{
    id: string;
    name: string;
    own: readonly UsageRow[];
    bundled: readonly UsageRow[];
  } | null>(null);
  const [kind, setKind] = useState<LibraryKind>('enemy');
  /** Which layer the list shows: Core, or My library (decision 76). */
  const [scope, setScope] = useState<'core' | 'mine'>('core');
  // Which box the Core list shows: 'all', 'base' (the base game) or an expansion name.
  const [box, setBox] = useState('all');
  const hiddenExpansions = useHiddenExpansions();
  /** The pack dialog: share My library as a file. */
  const [pack, setPack] = useState<{ name: string; author: string } | null>(null);
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
  // The box of an item: the expansion it belongs to, or the base game.
  const boxKey = (r: Row) => expansionOf(kind, r.id, r.data) ?? 'base';
  const boxName = (r: Row) =>
    boxKey(r) === 'base' ? t('designer.DesignerScreen.baseGame', 'Base game') : boxKey(r);
  const boxes = [...new Set(rows.filter((r) => r.core && boxKey(r) !== 'base').map(boxKey))].sort(
    (a, b) => a.localeCompare(b),
  );
  const activeBox = box === 'all' || box === 'base' || boxes.includes(box) ? box : 'all';
  const sel = rows.find((r) => r.id === selected);
  const isCore = sel?.core === true;
  const locked = isCore && !owner;
  const data: Data | null = sel ? (draft ?? sel.data) : null;
  const sourceLabel = !isCore
    ? t('designer.DesignerScreen.myLibraryThisDevice', 'My library (this device)')
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
    setScope('mine');
    setSelected(String(d.id));
    setDraft(structuredClone(d));
    setMessage('');
  };
  const create = () => {
    const id = freeId(
      rows.map((r) => r.id),
      t('designer.DesignerScreen.new', 'New {v1}', { v1: ONE[kind] }),
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
              ? [
                  {
                    title: t('designer.DesignerScreen.quest', 'Quest {number}: {title}', {
                      number: q.number,
                      title: q.level.quest.title,
                    }),
                    quest: q.level.quest,
                  },
                ]
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
  /** Everything of My library as a pack file: a name, an author, and no Core items. */
  const exportFile = async () => {
    if (!pack) return;
    const name = pack.name.trim();
    if (name === '') return;
    const coreIds = (k: LibraryKind) => new Set(coreRows(k).map((r) => r.id));
    const cache = new Map<LibraryKind, Set<string>>();
    const isCoreItem = (k: LibraryKind, id: string) => {
      if (!cache.has(k)) cache.set(k, coreIds(k));
      return cache.get(k)!.has(id);
    };
    const text = await store.exportPack(
      { name, author: pack.author },
      (k, id) => !isCoreItem(k, id),
    );
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(name)}.sqlibrary.json`;
    a.click();
    URL.revokeObjectURL(url);
    setPack(null);
    setMessage(`${slug(name)}.sqlibrary.json is saved. Send it to someone: they import it here.`);
  };
  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      // a pack from someone else is fan-made, whatever it says: only the owner brings in official items
      const r = await store.importAll(await f.text(), stamp(), { fanMade: !owner });
      const from = r.name ? `"${r.name}"${r.author ? ` by ${r.author}` : ''}: ` : '';
      setMessage(
        t(
          'designer.DesignerScreen.importedAddedReplaced',
          'Imported {from}{added} added, {replaced} replaced{v1}.',
          {
            from,
            added: r.added,
            replaced: r.replaced,
            v1: r.skipped ? `, ${r.skipped} skipped` : '',
          },
        ),
      );
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const expansionList = expansionNames(
    items.map((i) => ({ kind: i.kind, id: i.id, data: i.data })),
  );
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
        <Panel
          title={t('designer.DesignerScreen.enemy', 'Enemy: {v1}', { v1: str(d, 'name') })}
          testId="dz-card"
          className="lib-top"
        >
          <div className="fr-row2">
            <Fld label={t('designer.DesignerScreen.name', 'Name')}>
              <input
                className="fr-in"
                aria-label={t('designer.DesignerScreen.name', 'Name')}
                disabled={locked}
                value={str(d, 'name')}
                onChange={(e) => change(put(d, 'name', e.target.value))}
              />
            </Fld>
            <Fld label={t('designer.DesignerScreen.source', 'Source')}>
              <select
                className="fr-sel"
                aria-label={t('designer.DesignerScreen.source', 'Source')}
                disabled
                value="x"
              >
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
          <Fld
            label={
              locked
                ? t('designer.DesignerScreen.hunts', 'Hunts')
                : t('designer.DesignerScreen.startsFrom', 'Starts from')
            }
          >
            {locked ? (
              <select
                className="fr-sel"
                aria-label={t('designer.DesignerScreen.hunts', 'Hunts')}
                disabled
                value="x"
              >
                <option value="x">
                  {t(
                    'designer.DesignerScreen.theHeroItCan',
                    'The hero it can reach first (core rule)',
                  )}
                </option>
              </select>
            ) : (
              <select
                className="fr-sel"
                aria-label={t('designer.DesignerScreen.startsFrom', 'Starts from')}
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
                <option value="">
                  {t('designer.DesignerScreen.nothingItsOwnRules', 'Nothing: its own rules')}
                </option>
                {MONSTER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MONSTER_NAMES[t]}
                  </option>
                ))}
              </select>
            )}
          </Fld>
          <Fld label={t('designer.DesignerScreen.plan', 'Plan')}>
            <select
              className="fr-sel"
              aria-label={t('designer.DesignerScreen.plan', 'Plan')}
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
          <div className="fr-row2">
            <Fld label={t('designer.DesignerScreen.attacksPerTurn', 'Attacks per turn')}>
              <select
                className="fr-sel"
                aria-label={t('designer.DesignerScreen.attacksPerTurn', 'Attacks per turn')}
                disabled={locked}
                value={String(d.attacks ?? 1)}
                onChange={(e) =>
                  change(
                    put(
                      d,
                      'attacks',
                      Number(e.target.value) > 1 ? Number(e.target.value) : undefined,
                    ),
                  )
                }
              >
                <option value="1">{t('designer.DesignerScreen.one', 'One')}</option>
                <option value="2">{t('designer.DesignerScreen.two', 'Two')}</option>
                <option value="3">{t('designer.DesignerScreen.three', 'Three')}</option>
              </select>
            </Fld>
            <Fld label={t('designer.DesignerScreen.size', 'Size')}>
              <select
                className="fr-sel"
                aria-label={t('designer.DesignerScreen.size', 'Size')}
                disabled={locked}
                value={String(d.size ?? 1)}
                onChange={(e) =>
                  change(
                    put(d, 'size', Number(e.target.value) > 1 ? Number(e.target.value) : undefined),
                  )
                }
              >
                <option value="1">{t('designer.DesignerScreen.oneSquare', 'One square')}</option>
                <option value="2">
                  {t('designer.DesignerScreen.large2X2', 'Large: 2 x 2 squares')}
                </option>
              </select>
            </Fld>
          </div>
          <div className="lbl">
            {t('designer.DesignerScreen.whoItGoesFor', 'Who it goes for (weight 0 to 9, 0 never)')}
          </div>
          <div data-testid="dz-weights" className="lib-weights">
            {RULE_KEYS.map((k) => (
              <Fld key={k} label={RULE_TEXT[k]}>
                <input
                  className="fr-in"
                  aria-label={t('designer.DesignerScreen.weight', 'Weight: {k}', { k })}
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

        <Panel title={t('designer.DesignerScreen.abilities', 'Abilities')} testId="dz-abilities">
          <ul className="fr-items">
            {abilities.map((id) => (
              <li key={id} data-id={id}>
                <b>{abilityName(id)}</b>
                <p>{abilityText(id)}</p>
                <button
                  className="x"
                  disabled={locked}
                  aria-label={t('designer.DesignerScreen.remove3', 'Remove {v1}', {
                    v1: abilityName(id),
                  })}
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
                  {t('designer.DesignerScreen.remove', 'Remove')}
                </button>
              </li>
            ))}
          </ul>
          <div className="fr-addrow">
            <select
              className="fr-sel"
              aria-label={t('designer.DesignerScreen.addAnAbility', 'Add an ability')}
              disabled={locked}
              value={abPick}
              onChange={(e) => setAbPick(e.target.value)}
            >
              <option value="">
                {t('designer.DesignerScreen.addAnAbility2', 'Add an ability…')}
              </option>
              {freeAbilities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={locked || abPick === ''}
              aria-label={t('designer.DesignerScreen.addTheAbility', 'Add the ability')}
              onClick={() => {
                change(put(d, 'abilities', [...abilities, abPick]));
                setAbPick('');
              }}
            >
              {t('designer.DesignerScreen.add', 'Add')}
            </button>
            <button
              className="btn alt"
              disabled={locked}
              onClick={() => setPopup({ kind: 'ability', draft: blank('ability', 'new-ability') })}
            >
              {t('designer.DesignerScreen.newAbility', 'New ability…')}
            </button>
          </div>
        </Panel>

        <Panel title={t('designer.DesignerScreen.spells', 'Spells')} testId="dz-spells">
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
                      : t('designer.DesignerScreen.unknownSpell', 'Unknown spell.')}
                  </p>
                  <button
                    className="x"
                    disabled={locked}
                    aria-label={t('designer.DesignerScreen.remove3', 'Remove {v1}', {
                      v1: sp?.name ?? id,
                    })}
                    onClick={() => setCount(id, 0)}
                  >
                    {t('designer.DesignerScreen.remove', 'Remove')}
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
              aria-label={t('designer.DesignerScreen.addASpell', 'Add a spell')}
              disabled={locked}
              value={spPick}
              onChange={(e) => setSpPick(e.target.value)}
            >
              <option value="">{t('designer.DesignerScreen.addASpell2', 'Add a spell…')}</option>
              {freeSpells.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={locked || spPick === ''}
              aria-label={t('designer.DesignerScreen.addTheSpell', 'Add the spell')}
              onClick={() => {
                change(put(d, 'spells', [...spells, spPick]));
                setSpPick('');
              }}
            >
              {t('designer.DesignerScreen.add', 'Add')}
            </button>
            <button
              className="btn alt"
              disabled={locked}
              onClick={() => setPopup({ kind: 'spell', draft: blank('spell', 'new-spell') })}
            >
              {t('designer.DesignerScreen.newSpell', 'New spell…')}
            </button>
          </div>
        </Panel>
      </>
    );
  };

  const centre = (d: Data) => {
    if (kind === 'enemy') return enemyCards(d);
    return (
      <Panel title={`${TITLE[kind]}: ${str(d, 'name')}`} testId="dz-card" className="lib-top">
        <div className="fr-row2">
          <Fld label={t('designer.DesignerScreen.name', 'Name')}>
            <input
              className="fr-in"
              aria-label={t('designer.DesignerScreen.name', 'Name')}
              disabled={locked}
              value={str(d, 'name')}
              onChange={(e) => change(put(d, 'name', e.target.value))}
            />
          </Fld>
          <Fld label={t('designer.DesignerScreen.source', 'Source')}>
            <select
              className="fr-sel"
              aria-label={t('designer.DesignerScreen.source', 'Source')}
              disabled
              value="x"
            >
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
            <Fld label={t('designer.DesignerScreen.whatItDoes', 'What it does')}>
              <textarea
                className="fr-ta"
                aria-label={t('designer.DesignerScreen.whatItDoes', 'What it does')}
                value={str(d, 'text')}
                onChange={(e) => change(put(d, 'text', e.target.value))}
              />
            </Fld>
          </>
        )}
        {kind === 'hero' && isCore && (
          <p className="fr-help">
            {t(
              'designer.DesignerScreen.aCoreHeroYou',
              'A core hero. You can rename it, give it a picture, or make a copy.',
            )}
          </p>
        )}
      </Panel>
    );
  };

  return (
    <>
      <div className="fr-frame lib-frame">
        <Col label={t('designer.DesignerScreen.library', 'Library')}>
          <div className="box-list" data-testid="dz-library">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                className="box-pick"
                style={{ '--box': NEUTRAL_BAR } as CSSProperties}
                aria-pressed={k === kind}
                onClick={() => switchKind(k)}
              >
                {LIBRARY_KIND_NAMES[k]} <span className="box-count">{count(k)}</span>
              </button>
            ))}
          </div>
          <Toggle
            label={t('designer.DesignerScreen.ownerModeCoreCan', 'Owner mode: Core can be changed')}
            on={owner}
            onChange={(on) => {
              setOwner(on);
              rememberOwnerMode(on);
            }}
          />
          <section className="lib-files">
            {owner && (
              <div data-testid="dz-core-file">
                <div className="fr-sub">{t('designer.DesignerScreen.coreFile', 'Core file')}</div>
                <p className="fr-help">
                  {t(
                    'designer.DesignerScreen.yourChangesToCore',
                    'Changed, new and deleted Core items go into one file for',
                  )}{' '}
                  <code>
                    {t('designer.DesignerScreen.srcContentLibrary', 'src/content/library/')}
                  </code>
                  .
                </p>
                <button
                  className="btn alt"
                  data-testid="dz-export-core"
                  onClick={() => void exportCore()}
                >
                  {t('designer.DesignerScreen.exportCore', 'Export Core')}
                </button>
              </div>
            )}
            <div data-testid="dz-expansions">
              <div className="fr-sub">{t('designer.DesignerScreen.expansions', 'Expansions')}</div>
              {expansionList.length === 0 ? (
                <p className="fr-help">
                  {t(
                    'designer.DesignerScreen.noExpansionInThe',
                    'No expansion in the library yet.',
                  )}
                </p>
              ) : (
                <>
                  {expansionList.map((name) => (
                    <Toggle
                      key={name}
                      label={`${name} in the add menus`}
                      on={!hiddenExpansions.has(name)}
                      onChange={(on) => setExpansionHidden(name, !on)}
                    />
                  ))}
                  <p className="fr-help">
                    {t(
                      'designer.DesignerScreen.switchingOneOffHides',
                      "Switching one off hides its items from the quest editor's add menus. Quests that already use them keep working.",
                    )}
                  </p>
                </>
              )}
            </div>
            <div>
              <div className="fr-sub">
                {t('designer.DesignerScreen.myLibraryFile', 'My library file')}
              </div>
              <p className="fr-help">
                {t(
                  'designer.DesignerScreen.shareWhatYouMade',
                  'Share what you made as a pack file. Core items are not in it. A pack you import is fan-made.',
                )}
              </p>
              <div className="lib-btnrow">
                <button
                  className="btn alt"
                  data-testid="dz-export-pack"
                  onClick={() =>
                    setPack({
                      name: t('designer.DesignerScreen.myLibrary2', 'My library'),
                      author: '',
                    })
                  }
                >
                  {t('designer.DesignerScreen.export', 'Export')}
                </button>
                <button className="btn alt" onClick={() => file.current?.click()}>
                  {t('designer.DesignerScreen.import', 'Import')}
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
            </div>
          </section>
        </Col>

        <Col label={LIBRARY_KIND_NAMES[kind]}>
          <div className="lib-items" data-testid="dz-items">
            <div
              className="fr-scope"
              role="group"
              aria-label={t('designer.DesignerScreen.layer', 'Layer')}
            >
              <button
                className="chip"
                aria-pressed={scope === 'core'}
                data-testid="dz-scope-core"
                onClick={() => {
                  setScope('core');
                  if (sel && !sel.core) pick(null);
                }}
              >
                {t('designer.DesignerScreen.core', 'Core {count}', { count: cores.length })}
              </button>
              <button
                className="chip"
                aria-pressed={scope === 'mine'}
                data-testid="dz-scope-mine"
                onClick={() => {
                  setScope('mine');
                  if (sel?.core) pick(null);
                }}
              >
                {t('designer.DesignerScreen.myLibrary', 'My library {count}', {
                  count: mine.length,
                })}
              </button>
            </div>
            {scope === 'core' && boxes.length > 0 && (
              <div
                className="fr-scope"
                role="group"
                aria-label={t('designer.DesignerScreen.box', 'Box')}
                data-testid="dz-boxes"
              >
                {['all', 'base', ...boxes].map((b) => (
                  <button
                    key={b}
                    className="chip"
                    aria-pressed={activeBox === b}
                    data-testid={`dz-box-${b}`}
                    onClick={() => setBox(b)}
                  >
                    {b === 'all'
                      ? t('designer.DesignerScreen.allBoxes', 'All boxes')
                      : b === 'base'
                        ? t('designer.DesignerScreen.baseGame', 'Base game')
                        : b}
                  </button>
                ))}
              </div>
            )}
            <div className="lib-grid">
              {rows
                .filter((r) =>
                  scope === 'core'
                    ? r.core && (activeBox === 'all' || boxKey(r) === activeBox)
                    : !r.core,
                )
                .map((r) => (
                  <button
                    key={r.id}
                    className="qcard bar"
                    style={
                      {
                        '--box': barOfExpansion(expansionOf(kind, r.id, r.data), !r.core, bars),
                      } as CSSProperties
                    }
                    aria-pressed={r.id === selected}
                    onClick={() => pick(r.id)}
                  >
                    <span className="qtitle">
                      {r.image && <img src={r.image} alt="" className="fr-thumb" />}
                      {r.name}
                    </span>
                    <span className="qnum">
                      {r.core ? boxName(r) : t('designer.DesignerScreen.myLibrary2', 'My library')}
                    </span>
                    <span className="qnote" data-origin={originOf(r)}>
                      {r.edited ? t('designer.DesignerScreen.changed', 'changed · ') : ''}
                      {ORIGIN_LABEL[originOf(r)]}
                    </span>
                  </button>
                ))}
              <button className="qcard lib-new" onClick={create}>
                <span className="qtitle">
                  {t('designer.DesignerScreen.new', 'New {v1}', { v1: ONE[kind] })}
                </span>
              </button>
            </div>
            {scope === 'mine' && mine.length === 0 && (
              <p className="fr-help">
                {t('designer.DesignerScreen.nothingOfYourOwn', 'Nothing of your own yet.')}
              </p>
            )}
          </div>
        </Col>

        <Col label={t('designer.DesignerScreen.card', 'Card')}>
          <section className="detail lib-detail">
            {data && sel ? (
              <>
                {locked && kind !== 'hero' && (
                  <Panel
                    title={t('designer.DesignerScreen.coreItem', 'Core item')}
                    testId="dz-readonly"
                    className="lib-top"
                  >
                    <p className="fr-help">
                      {t(
                        'designer.DesignerScreen.coreItemsComeWith',
                        'Core items come with the game and are read only. Make a copy in My library to change it.',
                      )}
                    </p>
                    <button className="btn" data-testid="dz-edit-copy" onClick={copy}>
                      {t('designer.DesignerScreen.editACopy', 'Edit a copy')}
                    </button>
                  </Panel>
                )}
                {centre(data)}
                {kind === 'enemy' && (
                  <Panel title={t('designer.DesignerScreen.token', 'Token')} className="lib-token">
                    <p className="fr-help">
                      {t(
                        'designer.DesignerScreen.greenCoinWithThe',
                        'Green coin with the type letter. Custom enemies pick a letter and a picture.',
                      )}
                    </p>
                    <Fld label={t('designer.DesignerScreen.letter', 'Letter')}>
                      <input
                        className="fr-in"
                        aria-label={t('designer.DesignerScreen.letter1Or2', 'Letter (1 or 2)')}
                        disabled={locked}
                        maxLength={2}
                        value={str(data, 'letter')}
                        onChange={(e) => change(put(data, 'letter', e.target.value.slice(0, 2)))}
                      />
                    </Fld>
                    <Picture data={data} onChange={change} disabled={locked} />
                  </Panel>
                )}
                {(kind === 'hero' || kind === 'companion') && (
                  <Panel title={t('designer.DesignerScreen.picture', 'Picture')}>
                    <Picture data={data} onChange={change} disabled={locked} />
                  </Panel>
                )}
                <Panel title={t('designer.DesignerScreen.origin', 'Origin')} testId="dz-origin">
                  <Fld label={t('designer.DesignerScreen.origin', 'Origin')}>
                    <select
                      className="fr-sel"
                      aria-label={t('designer.DesignerScreen.origin', 'Origin')}
                      // core is always official; only the owner can call an item of the library official
                      disabled={isCore || !owner}
                      value={
                        isCore ? 'official' : data.origin === 'official' ? 'official' : 'fan-made'
                      }
                      onChange={(e) => change(put(data, 'origin', e.target.value))}
                    >
                      <option value="official">
                        {t('designer.DesignerScreen.official', 'Official')}
                      </option>
                      <option value="fan-made">
                        {t('designer.DesignerScreen.fanMade', 'Fan-made')}
                      </option>
                    </select>
                  </Fld>
                  {owner && !isCore && data.origin === 'official' && (
                    <Fld
                      label={t(
                        'designer.DesignerScreen.expansionEmptyTheBase',
                        'Expansion (empty: the base game)',
                      )}
                    >
                      <input
                        className="fr-in"
                        aria-label={t('designer.DesignerScreen.expansion', 'Expansion')}
                        value={str(data, 'expansion')}
                        onChange={(e) =>
                          change(put(data, 'expansion', e.target.value || undefined))
                        }
                      />
                    </Fld>
                  )}
                  <p className="fr-help">
                    {t(
                      'designer.DesignerScreen.officialItemsComeFrom',
                      'Official items come from the game or its expansions. Everything else a person makes is fan-made.',
                    )}
                  </p>
                </Panel>
                {usageKind && (
                  <Panel title={t('designer.DesignerScreen.usedIn', 'Used in')} testId="dz-used">
                    {usage.length === 0 ? (
                      <p className="fr-help">
                        {t('designer.DesignerScreen.notUsedInYour', 'Not used in your quests yet.')}
                      </p>
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
                            ? t(
                                'designer.DesignerScreen.everyQuestHasThis',
                                'Every quest has this version.',
                              )
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
                            void updateQuests((q) =>
                              refreshEnemyInQuest(q, enemyDef, libContent),
                            ).then((n) => {
                              setMessage(
                                t(
                                  'designer.DesignerScreen.updatedInQuest',
                                  'Updated in {n} quest{v1}.',
                                  { n, v1: n === 1 ? '' : 's' },
                                ),
                              );
                              void quests?.().then((qs) => setQuestList(qs));
                            });
                          }}
                        >
                          {t('designer.DesignerScreen.updateInAllQuests', 'Update in all quests')}
                        </button>
                      </>
                    )}
                  </Panel>
                )}
                <div className="lib-actions">
                  <button className="btn alt" onClick={copy}>
                    {t('designer.DesignerScreen.copy', 'Copy')}
                  </button>
                  {!locked && (!isCore || sel.edited) && (
                    <button className="btn alt" onClick={() => void remove()}>
                      {isCore
                        ? t('designer.DesignerScreen.resetToCore', 'Reset to core')
                        : t('designer.DesignerScreen.delete', 'Delete {v1}', { v1: ONE[kind] })}
                    </button>
                  )}
                  {isCore && owner && !builtIn(kind, sel.id) && (
                    <button
                      className="btn alt"
                      data-testid="dz-delete-core"
                      onClick={() => void askDelete()}
                    >
                      {t('designer.DesignerScreen.deleteFromCore', 'Delete from Core')}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2>{LIBRARY_KIND_NAMES[kind]}</h2>
                <p className="fr-help">
                  {t('designer.DesignerScreen.pickAnItemOr', 'Pick an item, or make a new one.')}
                </p>
              </>
            )}
            {message && (
              <p className="fr-help" role="status" data-testid="dz-message">
                {message}
              </p>
            )}
          </section>
        </Col>
      </div>
      {pack && (
        <Dialog
          title={t('designer.DesignerScreen.shareMyLibraryAs', 'Share my library as a pack')}
          onClose={() => setPack(null)}
          foot={
            <>
              <button className="btn alt" onClick={() => setPack(null)}>
                {t('designer.DesignerScreen.cancel', 'Cancel')}
              </button>
              <button
                className="btn"
                data-testid="dz-pack-save"
                disabled={pack.name.trim() === ''}
                onClick={() => void exportFile()}
              >
                {t('designer.DesignerScreen.saveThePackFile', 'Save the pack file')}
              </button>
            </>
          }
        >
          <Fld label={t('designer.DesignerScreen.nameOfThePack', 'Name of the pack')}>
            <input
              className="fr-in"
              aria-label={t('designer.DesignerScreen.nameOfThePack', 'Name of the pack')}
              value={pack.name}
              maxLength={80}
              onChange={(e) => setPack({ ...pack, name: e.target.value })}
            />
          </Fld>
          <Fld label={t('designer.DesignerScreen.authorOptional', 'Author (optional)')}>
            <input
              className="fr-in"
              aria-label={t('designer.DesignerScreen.author', 'Author')}
              value={pack.author}
              maxLength={80}
              onChange={(e) => setPack({ ...pack, author: e.target.value })}
            />
          </Fld>
          <p className="fr-help">
            {t(
              'designer.DesignerScreen.theFileHasWhat',
              'The file has what you made: abilities, spells, enemies, heroes and companions. It has no Core items. Whoever imports it sees its name and author.',
            )}
          </p>
        </Dialog>
      )}
      {del && (
        <Dialog
          title={t('designer.DesignerScreen.deleteFromCore', 'Delete from Core')}
          onClose={() => setDel(null)}
          foot={
            <>
              <button className="btn alt" onClick={() => setDel(null)}>
                {t('designer.DesignerScreen.cancel', 'Cancel')}
              </button>
              <button
                className="btn"
                data-testid="dz-delete-confirm"
                onClick={() => void confirmDelete()}
              >
                {t('designer.DesignerScreen.delete2', 'Delete {name}', { name: del.name })}
              </button>
            </>
          }
        >
          <p>
            {t(
              'designer.DesignerScreen.leavesCoreItStays',
              '{name} leaves Core. It stays in quests only as far as they already copy it.',
              { name: del.name },
            )}
          </p>
          {del.own.length > 0 ? (
            <>
              <p>
                {t(
                  'designer.DesignerScreen.theseQuestsOfYours',
                  'These quests of yours use it (an ability or spell is copied into them first):',
                )}
              </p>
              <ul data-testid="dz-delete-own">
                {del.own.map((u) => (
                  <li key={u.quest}>
                    {u.quest} · {u.count}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>{t('designer.DesignerScreen.noneOfYourQuests', 'None of your quests uses it.')}</p>
          )}
          {del.bundled.length > 0 && (
            <>
              <p className="warn">
                {t(
                  'designer.DesignerScreen.theseBundledQuestsUse',
                  'These bundled quests use it. They stop validating until you fix them:',
                )}
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
      <TopBar
        tabs={['Library']}
        active="Library"
        title={t('designer.DesignerScreen.library', 'Library')}
        hint={t('designer.DesignerScreen.madeOnce', 'Made once, used in any quest.')}
        onBack={onBack}
      />
      <DesignerBody store={store} quests={quests} updateQuests={updateQuests} />
    </div>
  );
}

import { useState } from 'react';
import { HEROES, HERO_NAMES } from '../../engine/data/heroes';
import {
  addPreset,
  grantedAlly,
  heroMember,
  newMemberId,
  offeredPresets,
  presetCount,
  removeLastPreset,
  teamWarnings,
  type OfferedPreset,
  type TeamMember,
  type TeamRule,
} from '../../engine/data/team';
import type { PackManifest } from '../../engine/pack/schema';
import { NoteCard } from '../shared/NoteCard';
import { t } from '../../i18n/t';

type Kind = 'mercenary' | 'ally';

/** One row of the hero list (concept): a square tick, the name, the box it comes from. */
function HeroRow({
  name,
  box,
  on,
  onToggle,
}: {
  name: string;
  box: string;
  on: boolean;
  onToggle(): void;
}) {
  return (
    <div className="hero-wrap">
      <button className="hero-row" aria-pressed={on} onClick={onToggle}>
        <span className="hero-tick" aria-hidden="true" />
        <span className="hero-name">{name}</span>
      </button>
      <span className="hero-box" data-on={on}>
        {box}
      </span>
    </div>
  );
}

/** A row of the team list: a type or a custom entry, with how many there are. */
interface TeamRow {
  readonly key: string;
  readonly name: string;
  readonly count: number;
  readonly kind: Kind;
  /** A custom entry has its own id; a preset entry is taken out by type. */
  readonly custom?: TeamMember;
}

/**
 * The team of the start page (decision 38, 114): the heroes, then two buttons, "Add an ally" and
 * "Add a mercenary", and the list of what was added. The value is the free team list. Warnings never
 * stop the game. Entries belong to no hero.
 */
export function TeamPicker({
  value,
  onChange,
  packs,
  rule,
}: {
  value: readonly TeamMember[];
  onChange(next: TeamMember[]): void;
  /** Every installed pack: all its heroes, mercenaries and allies are offered on any quest. */
  packs: readonly PackManifest[];
  rule: TeamRule | undefined;
}) {
  const [adding, setAdding] = useState<Kind | null>(null);
  const [typing, setTyping] = useState(false);
  const [name, setName] = useState('');

  const offered = offeredPresets(packs);
  const packHeroes = offered.filter((o) => o.kind === 'hero');
  const presets = (kind: Kind) => offered.filter((o) => o.kind === kind);
  const granted = grantedAlly(packs, rule?.grantsAlly);

  const toggleHero = (m: TeamMember) =>
    onChange(value.some((x) => x.id === m.id) ? value.filter((x) => x.id !== m.id) : [...value, m]);
  const addCustom = () => {
    const n = name.trim();
    if (!n || !adding) return;
    onChange([...value, { id: newMemberId(value, adding, n), name: n, kind: adding }]);
    setName('');
    setTyping(false);
  };
  const close = () => {
    setAdding(null);
    setTyping(false);
    setName('');
  };

  /** The rows of the team list, in the order the entries were added; same types are merged. */
  const rows: TeamRow[] = [];
  for (const m of value) {
    if (m.kind === 'hero') continue;
    const kind: Kind = m.kind;
    const preset = presets(kind).find((p) => presetCount([m], kind, p.name) > 0);
    if (!preset) {
      rows.push({ key: m.id, name: m.name, count: 1, kind, custom: m });
      continue;
    }
    const key = `${kind}:${preset.name}`;
    const row = rows.find((r) => r.key === key);
    if (row) rows[rows.indexOf(row)] = { ...row, count: row.count + 1 };
    else rows.push({ key, name: preset.name, count: 1, kind });
  }
  const takeOut = (row: TeamRow) =>
    onChange(
      row.custom
        ? value.filter((x) => x.id !== row.custom!.id)
        : removeLastPreset(value, row.kind, row.name),
    );
  const warnings = teamWarnings(value, rule);

  const pickRow = (kind: Kind, p: OfferedPreset) => {
    const n = presetCount(value, kind, p.name);
    const mark =
      kind === 'ally' && granted?.id === p.id ? t('select.fromTheQuest', ' (from the quest)') : '';
    return (
      <div className={n > 0 ? 'pick-row on' : 'pick-row'} key={`${kind}:${p.id}`}>
        <span className="hero-name">
          {p.name}
          {mark}
        </span>
        <span className="box">{p.box}</span>
        <span className="stepper">
          <button
            className="chip"
            disabled={n === 0}
            aria-label={t('select.takeOutOne', 'Take out one {name}', { name: p.name })}
            onClick={() => onChange(removeLastPreset(value, kind, p.name))}
          >
            -
          </button>
          <b aria-label={t('select.countOf', '{name}: {count}', { name: p.name, count: n })}>{n}</b>
          <button
            className="chip"
            aria-label={t('select.addOne', 'Add one {name}', { name: p.name })}
            onClick={() => onChange(addPreset(value, kind, p.name))}
          >
            +
          </button>
        </span>
      </div>
    );
  };

  const dialog = (kind: Kind) => {
    const title =
      kind === 'mercenary'
        ? t('select.addAMercenary', 'Add a mercenary')
        : t('select.addAnAlly', 'Add an ally');
    return (
      <NoteCard kind={t('select.team', 'Team')} title={title} onClose={close} className="pick-note">
        <p className="hint">
          {kind === 'mercenary'
            ? t('select.mercenariesOfEveryBox', 'Mercenaries of every box. Tap + to add one.')
            : t('select.alliesOfEveryBox', 'Allies of every box. Tap + to add one.')}
        </p>
        <div className="lbl">
          {kind === 'mercenary'
            ? t('select.mercenaries', 'Mercenaries')
            : t('select.allies', 'Allies')}
        </div>
        <div className="pick-list">{presets(kind).map((p) => pickRow(kind, p))}</div>
        {typing ? (
          <form
            className="custom"
            onSubmit={(e) => {
              e.preventDefault();
              addCustom();
            }}
          >
            <input
              autoFocus
              value={name}
              maxLength={40}
              data-testid="team-name"
              placeholder={t('select.name', 'Name')}
              aria-label={t('select.name', 'Name')}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn" disabled={!name.trim()}>
              {t('select.add', 'Add')}
            </button>
          </form>
        ) : (
          <button className="chip add" onClick={() => setTyping(true)}>
            {kind === 'mercenary'
              ? t('select.anotherMercenary', 'Another mercenary: type a name')
              : t('select.anotherAlly', 'Another ally: type a name')}
          </button>
        )}
        <div className="foot">
          <button className="btn" onClick={close}>
            {t('select.done', 'Done')}
          </button>
        </div>
      </NoteCard>
    );
  };

  return (
    <>
      <div className="hero-list" role="group" aria-label={t('select.heroes', 'Heroes')}>
        {HEROES.map((h) => (
          <HeroRow
            key={h}
            name={HERO_NAMES[h]}
            box={t('select.coreGame', 'Core game')}
            on={value.some((x) => x.id === h)}
            onToggle={() => toggleHero(heroMember(h))}
          />
        ))}
        {packHeroes.map((h) => {
          const m: TeamMember = { id: `hero:${h.id}`, name: h.name, kind: 'hero', as: h.as };
          return (
            <HeroRow
              key={m.id}
              name={h.name}
              box={h.box}
              on={value.some((x) => x.id === m.id)}
              onToggle={() => toggleHero(m)}
            />
          );
        })}
      </div>

      <div className="lbl">{t('select.team', 'Team')}</div>
      <div className="team-btns">
        <button className="btn alt" onClick={() => setAdding('ally')}>
          {t('select.addAnAlly', 'Add an ally')}
        </button>
        <button className="btn alt" onClick={() => setAdding('mercenary')}>
          {t('select.addAMercenary', 'Add a mercenary')}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="hint">{t('select.noMercenaryOrAlly', 'No mercenary or ally yet.')}</p>
      ) : (
        <ul className="team-list" aria-label={t('select.team', 'Team')}>
          {rows.map((r) => (
            <li className="team-row" key={r.key}>
              <span className="nm">
                {r.name}
                {r.count > 1 && <i>{` x${r.count}`}</i>}
              </span>
              <button
                className="chip"
                aria-label={
                  r.count > 1
                    ? t('select.takeOutOne', 'Take out one {name}', { name: r.name })
                    : t('select.removeEntry', 'Remove {name}', { name: r.name })
                }
                onClick={() => takeOut(r)}
              >
                {r.count > 1 ? '-' : 'x'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {warnings.map((w) => (
        <p key={w} className="team-warn" role="note">
          {w}
        </p>
      ))}
      {adding && dialog(adding)}
    </>
  );
}

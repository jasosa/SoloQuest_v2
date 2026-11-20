import { useState } from 'react';
import { HEROES, HERO_NAMES } from '../../engine/data/heroes';
import {
  heroMember,
  labelOf,
  newMemberId,
  teamWarnings,
  withValidOwners,
  type TeamMember,
  type TeamRule,
} from '../../engine/data/team';
import type { PackManifest } from '../../engine/pack/schema';

/**
 * The three groups of the New game popup (decision 38): heroes, mercenaries, animal allies. The
 * value is the free team list. Warnings never stop the game.
 */
export function TeamPicker({
  value,
  onChange,
  packs,
  rule,
}: {
  value: readonly TeamMember[];
  onChange(next: TeamMember[]): void;
  /** The pack of the quest and the packs it needs: their heroes and allies are offered. */
  packs: readonly PackManifest[];
  rule: TeamRule | undefined;
}) {
  const [adding, setAdding] = useState<'mercenary' | 'ally' | null>(null);
  const [name, setName] = useState('');
  const [owner, setOwner] = useState<string | undefined>();

  const heroes = value.filter((m) => m.kind === 'hero');
  const mercs = value.filter((m) => m.kind === 'mercenary');
  const allies = value.filter((m) => m.kind === 'ally');
  const packHeroes = packs.flatMap((p) => p.team.heroes);
  const packAllies = packs.flatMap((p) => p.team.allies);
  const packMercs = packs.flatMap((p) => p.team.mercenaries);
  const grants = rule?.grantsAlly;

  const set = (next: TeamMember[]) => onChange(withValidOwners(next));
  const toggleHero = (m: TeamMember) =>
    set(value.some((x) => x.id === m.id) ? value.filter((x) => x.id !== m.id) : [...value, m]);
  const ownerId = owner && heroes.some((h) => h.id === owner) ? owner : heroes[0]?.id;
  const addEntry = (kind: 'mercenary' | 'ally', label: string) => {
    const n = label.trim();
    if (!n) return;
    set([...value, { id: newMemberId(value, kind, n), name: n, kind, owner: ownerId }]);
    setAdding(null);
    setName('');
  };
  const presetOn = (kind: 'mercenary' | 'ally', presetName: string) =>
    value.find((m) => m.kind === kind && m.name === presetName);
  const togglePreset = (kind: 'mercenary' | 'ally', presetName: string) => {
    const on = presetOn(kind, presetName);
    if (on) set(value.filter((m) => m.id !== on.id));
    else addEntry(kind, presetName);
  };
  const warnings = teamWarnings(value, rule);

  const form = (kind: 'mercenary' | 'ally') => (
    <form
      className="team-form"
      onSubmit={(e) => {
        e.preventDefault();
        addEntry(kind, name);
      }}
    >
      <label>
        <span className="lbl">{kind === 'mercenary' ? 'Mercenary name' : 'Animal name'}</span>
        <input
          autoFocus
          value={name}
          maxLength={40}
          data-testid="team-name"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="lbl">Belongs to</div>
      <div className="pick-heroes" role="group" aria-label="Owner">
        {heroes.length === 0 && <p className="hint">Pick a hero first.</p>}
        {heroes.map((h) => (
          <button
            type="button"
            key={h.id}
            className="chip"
            aria-pressed={ownerId === h.id}
            onClick={() => setOwner(h.id)}
          >
            {h.name}
          </button>
        ))}
      </div>
      <div className="team-form-btns">
        <button type="submit" className="btn" disabled={!name.trim() || !ownerId}>
          Add
        </button>
        <button
          type="button"
          className="btn alt"
          onClick={() => {
            setAdding(null);
            setName('');
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <>
      <div className="lbl">Heroes</div>
      <div className="pick-heroes" role="group" aria-label="Heroes">
        {HEROES.map((h) => {
          const m = heroMember(h);
          return (
            <button
              key={h}
              className="chip"
              aria-pressed={value.some((x) => x.id === h)}
              onClick={() => toggleHero(m)}
            >
              {HERO_NAMES[h]}
            </button>
          );
        })}
        {packHeroes.map((h) => {
          const m: TeamMember = { id: `hero:${h.id}`, name: h.name, kind: 'hero', as: h.as };
          return (
            <button
              key={m.id}
              className="chip"
              aria-pressed={value.some((x) => x.id === m.id)}
              onClick={() => toggleHero(m)}
            >
              {h.name}
            </button>
          );
        })}
      </div>

      <div className="lbl">Mercenaries</div>
      <div className="pick-heroes" role="group" aria-label="Mercenaries">
        {packMercs.map((p) => (
          <button
            key={p.id}
            className="chip"
            aria-pressed={presetOn('mercenary', p.name) !== undefined}
            disabled={heroes.length === 0}
            onClick={() => togglePreset('mercenary', p.name)}
          >
            {p.name}
          </button>
        ))}
        {mercs
          .filter((m) => !packMercs.some((p) => p.name === m.name))
          .map((m) => (
            <button
              key={m.id}
              className="chip"
              aria-pressed
              aria-label={`${labelOf(value, m.id)}, tap to take it out`}
              onClick={() => set(value.filter((x) => x.id !== m.id))}
            >
              {labelOf(value, m.id)}
            </button>
          ))}
        <button
          className="chip add"
          disabled={heroes.length === 0}
          onClick={() => setAdding(adding === 'mercenary' ? null : 'mercenary')}
        >
          Add a mercenary
        </button>
      </div>
      {adding === 'mercenary' && form('mercenary')}

      <div className="lbl">Animal allies</div>
      <div className="pick-heroes" role="group" aria-label="Animal allies">
        {packAllies.map((p) => (
          <button
            key={p.id}
            className="chip"
            aria-pressed={presetOn('ally', p.name) !== undefined}
            disabled={heroes.length === 0}
            onClick={() => togglePreset('ally', p.name)}
          >
            {presetOn('ally', p.name) ? labelOf(value, presetOn('ally', p.name)!.id) : p.name}
            {grants === p.id ? ' (from the quest)' : ''}
          </button>
        ))}
        {allies
          .filter((m) => !packAllies.some((p) => p.name === m.name))
          .map((m) => (
            <button
              key={m.id}
              className="chip"
              aria-pressed
              aria-label={`${labelOf(value, m.id)}, tap to take it out`}
              onClick={() => set(value.filter((x) => x.id !== m.id))}
            >
              {labelOf(value, m.id)}
            </button>
          ))}
        <button
          className="chip add"
          disabled={heroes.length === 0}
          onClick={() => setAdding(adding === 'ally' ? null : 'ally')}
        >
          Add an animal ally
        </button>
      </div>
      {adding === 'ally' && form('ally')}

      {warnings.map((w) => (
        <p key={w} className="team-warn" role="note">
          {w}
        </p>
      ))}
    </>
  );
}

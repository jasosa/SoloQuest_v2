import { useState } from 'react';
import { useStore } from 'zustand';
import { addAbility, addSpell, updateMonster } from '../../engine/editor';
import { abilityLookup } from '../../engine/data/abilities';
import { spellLookup, spellQuestions } from '../../engine/data/spells';
import type { MonsterDef } from '../../engine/quest/schema';
import type { EditorStore } from './editorStore';

const LIMITS = [
  { n: 1, label: 'Once in the quest' },
  { n: 2, label: 'Twice' },
  { n: 3, label: '3 times' },
  { n: 4, label: '4 times' },
  { n: 5, label: '5 times' },
];

type Patch = Parameters<typeof updateMonster>[2];

/**
 * The abilities of a monster (decision 70): one row per ability with its text and Remove, a
 * dropdown with Add, and "New ability…" that makes one and opens its popup. No chips.
 */
export function MonsterAbilities({ store, monster }: { store: EditorStore; monster: MonsterDef }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const [pick, setPick] = useState('');
  const lookup = abilityLookup(quest);
  const mine = monster.abilities ?? [];
  const patch = (p: Patch) => st.apply((q) => updateMonster(q, monster.id, p));
  const free = [...lookup.values()].filter((a) => !mine.includes(a.id));

  return (
    <section data-testid="monster-abilities">
      <div className="lbl">Abilities</div>
      <ul className="ed-items">
        {mine.map((id) => {
          const a = lookup.get(id);
          const own = quest.abilityDefs.some((x) => x.id === id);
          return (
            <li key={id} data-ability={id}>
              <b>{a?.name ?? id}</b>
              <p>{a?.text ?? 'Unknown ability.'}</p>
              <button
                className="chip"
                aria-label={`Remove ${a?.name ?? id}`}
                onClick={() => patch({ abilities: mine.filter((x) => x !== id) })}
              >
                Remove
              </button>
              {own && (
                <button className="link ed-edit" onClick={() => st.setAbilityId(id)}>
                  Edit the ability…
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="ed-addrow">
        <select
          className="es-select"
          aria-label="Add an ability"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">Add an ability…</option>
          {free.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={pick === ''}
          onClick={() => {
            if (patch({ abilities: [...mine, pick] })) setPick('');
          }}
        >
          Add
        </button>
        <button
          className="btn alt"
          onClick={() => {
            if (
              !st.apply((q) => addAbility(q, { name: 'New ability', text: 'Write what it does.' }))
            )
              return;
            const made = store.getState().quest.abilityDefs.at(-1);
            if (!made) return;
            patch({ abilities: [...mine, made.id] });
            st.setAbilityId(made.id);
          }}
        >
          New ability…
        </button>
      </div>
    </section>
  );
}

/**
 * The spells of a monster: one row per spell with its situations, a cast limit (how many times
 * it is listed) and Remove, a dropdown with Add, and "New spell…". No chips.
 */
export function MonsterSpells({ store, monster }: { store: EditorStore; monster: MonsterDef }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const [pick, setPick] = useState('');
  const lookup = spellLookup(quest);
  const list = monster.spells ?? [];
  const ids = [...new Set(list)];
  const count = (id: string) => list.filter((x) => x === id).length;
  const patch = (p: Patch) => st.apply((q) => updateMonster(q, monster.id, p));
  /** The spell list for these counts, in the order of first appearance. */
  const build = (counts: Map<string, number>) =>
    [...counts].flatMap(([id, n]) => Array<string>(n).fill(id));
  const withCount = (id: string, n: number) => {
    const m = new Map(ids.map((x) => [x, count(x)] as const));
    if (n <= 0) m.delete(id);
    else m.set(id, n);
    const next = build(m);
    // a spell limit without spells is refused: drop it with the last spell
    patch(next.length === 0 ? { spells: null, spellLimit: null } : { spells: next });
  };
  const free = [...lookup.values()].filter((s) => !ids.includes(s.id));

  return (
    <section data-testid="monster-spells">
      <div className="lbl">Spells</div>
      <ul className="ed-items">
        {ids.map((id) => {
          const sp = lookup.get(id);
          const own = quest.spellDefs.some((x) => x.id === id);
          return (
            <li key={id} data-spell={id}>
              <b>{sp?.name ?? id}</b>
              <p>{sp ? spellQuestions(sp).join(' · ') : 'Unknown spell.'}</p>
              <button
                className="chip"
                aria-label={`Remove ${sp?.name ?? id}`}
                onClick={() => withCount(id, 0)}
              >
                Remove
              </button>
              <div className="ed-ctl">
                <select
                  className="es-select"
                  aria-label={`${sp?.name ?? id} cast limit`}
                  value={String(count(id))}
                  onChange={(e) => withCount(id, Number(e.target.value))}
                >
                  {LIMITS.map((l) => (
                    <option key={l.n} value={l.n}>
                      {l.label}
                    </option>
                  ))}
                </select>
                {own && (
                  <button className="link ed-edit" onClick={() => st.setSpellId(id)}>
                    Edit the spell…
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="ed-addrow">
        <select
          className="es-select"
          aria-label="Add a spell"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">Add a spell…</option>
          {free.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={pick === ''}
          onClick={() => {
            if (patch({ spells: [...list, pick] })) setPick('');
          }}
        >
          Add
        </button>
        <button
          className="btn alt"
          onClick={() => {
            if (!st.apply((q) => addSpell(q, { name: 'New spell', tags: ['any'] }))) return;
            const made = store.getState().quest.spellDefs.at(-1);
            if (!made) return;
            patch({ spells: [...list, made.id] });
            st.setSpellId(made.id);
          }}
        >
          New spell…
        </button>
      </div>
      <button
        className="chip ed-wide"
        aria-pressed={monster.spellLimit === 'onePerTurn'}
        disabled={list.length === 0}
        onClick={() => patch({ spellLimit: monster.spellLimit ? null : 'onePerTurn' })}
      >
        One spell each turn
      </button>
    </section>
  );
}

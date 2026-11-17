import { useState } from 'react';
import { useStore } from 'zustand';
import {
  abilityChanged,
  addAbility,
  addLibraryAbilityToMonster,
  addLibrarySpellToMonster,
  addSpell,
  setMonsterEnemyFromLibrary,
  enemyDiffersFromLibrary,
  spellChanged,
  updateEnemyFromLibrary,
  updateMonster,
} from '../../engine/editor';
import { useLibrary } from '../designer/LibraryContext';
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

/** Where a spell is offered on Zargon's turn: at random, or in a fixed place. */
const PLACES = [
  { n: 0, label: 'Offered at random' },
  { n: 1, label: 'Offered first' },
  { n: 2, label: 'Offered second' },
  { n: 3, label: 'Offered third' },
  { n: 4, label: 'Offered fourth' },
  { n: 5, label: 'Offered fifth' },
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
  const lib = useLibrary();
  const lookup = abilityLookup(quest);
  const mine = monster.abilities ?? [];
  const patch = (p: Patch) => st.apply((q) => updateMonster(q, monster.id, p));
  const free = [...lookup.values()].filter((a) => !mine.includes(a.id));
  // library abilities the quest does not have yet (a copy is made when one is added)
  const fromLib = lib.abilities.filter((a) => !lookup.has(a.id) || abilityChanged(a));

  return (
    <section data-testid="monster-abilities">
      <div className="lbl">Abilities</div>
      <ul className="fr-items">
        {mine.map((id) => {
          const a = lookup.get(id);
          const own = quest.abilityDefs.some((x) => x.id === id);
          return (
            <li key={id} data-ability={id}>
              <b>{a?.name ?? id}</b>
              <p>{a?.text ?? 'Unknown ability.'}</p>
              <button
                className="x"
                aria-label={`Remove ${a?.name ?? id}`}
                onClick={() => patch({ abilities: mine.filter((x) => x !== id) })}
              >
                Remove
              </button>
              {own && (
                <button className="lnk" onClick={() => st.setAbilityId(id)}>
                  Edit the ability…
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="fr-addrow">
        <select
          className="fr-sel"
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
          {fromLib.length > 0 && (
            <optgroup label="From the library">
              {fromLib.map((a) => (
                <option key={a.id} value={`lib:${a.id}`}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          className="btn"
          disabled={pick === ''}
          onClick={() => {
            if (pick.startsWith('lib:')) {
              const def = lib.abilities.find((a) => a.id === pick.slice(4));
              if (def && st.apply((q) => addLibraryAbilityToMonster(q, monster.id, def)))
                setPick('');
              return;
            }
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
  const lib = useLibrary();
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
  const fromLib = lib.spells.filter((s) => !lookup.has(s.id) || spellChanged(s));

  return (
    <section data-testid="monster-spells">
      <div className="lbl">Spells</div>
      <ul className="fr-items">
        {ids.map((id) => {
          const sp = lookup.get(id);
          const own = quest.spellDefs.some((x) => x.id === id);
          return (
            <li key={id} data-spell={id}>
              <b>{sp?.name ?? id}</b>
              <p>{sp ? spellQuestions(sp).join(' · ') : 'Unknown spell.'}</p>
              <button
                className="x"
                aria-label={`Remove ${sp?.name ?? id}`}
                onClick={() => withCount(id, 0)}
              >
                Remove
              </button>
              <div className="ctl">
                <select
                  className="fr-sel"
                  aria-label={`${sp?.name ?? id} order`}
                  value={String(monster.spellOrder?.[id] ?? 0)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    const order = { ...monster.spellOrder };
                    if (n === 0) delete order[id];
                    else order[id] = n;
                    patch({ spellOrder: order });
                  }}
                >
                  {PLACES.map((l) => (
                    <option key={l.n} value={l.n}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <select
                  className="fr-sel"
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
                  <button className="lnk" onClick={() => st.setSpellId(id)}>
                    Edit the spell…
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="fr-addrow">
        <select
          className="fr-sel"
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
          {fromLib.length > 0 && (
            <optgroup label="From the library">
              {fromLib.map((s) => (
                <option key={s.id} value={`lib:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          className="btn"
          disabled={pick === ''}
          onClick={() => {
            if (pick.startsWith('lib:')) {
              const def = lib.spells.find((s) => s.id === pick.slice(4));
              if (def && st.apply((q) => addLibrarySpellToMonster(q, monster.id, def))) setPick('');
              return;
            }
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
        type="button"
        role="switch"
        className="fr-tog"
        aria-checked={monster.spellLimit === 'onePerTurn'}
        disabled={list.length === 0}
        onClick={() => patch({ spellLimit: monster.spellLimit ? null : 'onePerTurn' })}
      >
        <i />
        One spell each turn
      </button>
    </section>
  );
}

/**
 * The enemy of a monster (decision 70): none (the plain type), an enemy the quest already has, or
 * one from the library (copied into the quest). An enemy gives the name, stats, abilities, spells,
 * letter and picture as defaults; the monster's own fields win.
 */
export function MonsterEnemy({ store, monster }: { store: EditorStore; monster: MonsterDef }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const lib = useLibrary();
  const mine = new Set(quest.enemyDefs.map((e) => e.id));
  const fromLib = lib.enemies.filter((e) => !mine.has(e.id));
  const current = quest.enemyDefs.find((e) => e.id === monster.enemy);
  const libraryVersion = lib.enemies.find((e) => e.id === monster.enemy);

  return (
    <section data-testid="monster-enemy">
      <label className="ed-field">
        Enemy
        <select
          className="fr-sel"
          aria-label="Enemy"
          value={monster.enemy ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith('lib:')) {
              const def = lib.enemies.find((x) => x.id === v.slice(4));
              if (def)
                st.apply((q) =>
                  setMonsterEnemyFromLibrary(q, monster.id, def, {
                    abilities: lib.abilities,
                    spells: lib.spells,
                  }),
                );
              return;
            }
            const def = quest.enemyDefs.find((x) => x.id === v);
            st.apply((q) =>
              updateMonster(q, monster.id, def ? { enemy: v, type: def.base } : { enemy: null }),
            );
          }}
        >
          <option value="">None (the plain type)</option>
          {quest.enemyDefs.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
          {fromLib.length > 0 && (
            <optgroup label="From the library">
              {fromLib.map((e) => (
                <option key={e.id} value={`lib:${e.id}`}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {current && libraryVersion && enemyDiffersFromLibrary(quest, libraryVersion) && (
        <>
          <p className="ed-note" data-testid="enemy-newer">
            The library has a different version of {current.name} (its stats, abilities or spells
            changed). This quest keeps its own copy until you update it.
          </p>
          <button
            className="btn alt"
            onClick={() =>
              st.apply((q) =>
                updateEnemyFromLibrary(q, libraryVersion, {
                  abilities: lib.abilities,
                  spells: lib.spells,
                }),
              )
            }
          >
            Update from the library
          </button>
        </>
      )}
      {current && (
        <p className="ed-note">
          {current.name}: letter {current.letter ?? 'of its type'}
          {current.image ? ', has a picture' : ', no picture'}. Edit enemies in the Designer.
        </p>
      )}
    </section>
  );
}

import { useStore } from 'zustand';
import { addMonster, updateMonster } from '../../engine/editor';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import { abilityLookup } from '../../engine/data/abilities';
import { MONSTER_TYPES, type MonsterType } from '../../engine/quest/schema';
import { Col, Fld, Frame, ListPanel, Panel, Toggle } from '../shared/Frame';
import { SubjectActions } from './ActionsSection';
import type { EditorStore } from './editorStore';
import { StatFields } from './Inspector';
import { parseLines } from './inspectorForms';
import { MonsterAbilities, MonsterEnemy, MonsterSpells } from './MonsterLists';
import { deleteSelection } from './selectionActions';

const STATES = [
  { value: 'active', label: 'Active' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'stone', label: 'Stone' },
] as const;

/**
 * The Monsters tab (the mockup of decision 70): the monsters of the quest on the left, the enemy,
 * its abilities and spells in the middle, its behavior and its actions on the right.
 */
export function MonstersTab({ store }: { store: EditorStore }) {
  const { quest, selection } = useStore(store);
  const st = store.getState();
  const lookup = abilityLookup(quest);
  const monster =
    selection?.kind === 'monster' ? quest.monsters.find((m) => m.id === selection.id) : undefined;
  const patch = (p: Parameters<typeof updateMonster>[2]) =>
    monster ? st.apply((q) => updateMonster(q, monster.id, p)) : false;

  return (
    <Frame>
      <Col label="Monsters of this quest">
        <ListPanel title="Monsters of this quest" testId="monster-list">
          <ul className="fr-list">
            {quest.monsters.map((m) => {
              const first = (m.abilities ?? [])[0];
              return (
                <li key={m.id} className={m.id === monster?.id ? 'on' : undefined}>
                  <button
                    className="fr-pick"
                    data-monster-row={m.id}
                    onClick={() => st.select({ kind: 'monster', id: m.id })}
                  >
                    {m.id} · {m.name ?? MONSTER_NAMES[m.type]}
                    {m.special && <span className="star"> ★</span>}
                    {first && <span className="sub">{lookup.get(first)?.name ?? first}</span>}
                  </button>
                </li>
              );
            })}
            {quest.monsters.length === 0 && (
              <li>
                <span className="fr-help">No monster yet.</span>
              </li>
            )}
          </ul>
          <div className="fr-lbtns">
            <button
              className="btn"
              onClick={() => {
                if (!st.apply((q) => addMonster(q, 'goblin', null, { hidden: true }))) return;
                const made = store.getState().quest.monsters.at(-1);
                if (made) st.select({ kind: 'monster', id: made.id });
              }}
            >
              Add
            </button>
            <button
              className="btn alt"
              disabled={!monster}
              onClick={() => {
                deleteSelection(store);
              }}
            >
              Remove
            </button>
          </div>
        </ListPanel>
      </Col>

      <Col label="Monster">
        {monster ? (
          <>
            <Panel title="Enemy" testId="monster-card">
              <MonsterEnemy store={store} monster={monster} />
              <Fld label="Type">
                <select
                  className="fr-sel"
                  aria-label="Type"
                  value={monster.type}
                  onChange={(e) => patch({ type: e.target.value as MonsterType })}
                >
                  {MONSTER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MONSTER_NAMES[t]}
                    </option>
                  ))}
                </select>
              </Fld>
              <Fld label="Name in this quest">
                <input
                  className="fr-in"
                  aria-label="Name"
                  key={`${monster.id}:${monster.name ?? ''}`}
                  defaultValue={monster.name ?? ''}
                  maxLength={60}
                  placeholder={MONSTER_NAMES[monster.type]}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (monster.name ?? '')) patch({ name: v === '' ? null : v });
                  }}
                />
              </Fld>
              <Toggle
                label="Special monster: story-critical, drawn with a ring and a star"
                on={monster.special === true}
                onChange={(on) => patch({ special: on })}
              />
              <StatFields
                key={`${monster.id}:${monster.type}:${JSON.stringify(monster.overrides ?? {})}`}
                store={store}
                monster={monster}
                onSave={(o) => patch({ overrides: o })}
              />
              <p className="fr-help">
                Stats start from the enemy and can be changed for this monster only.
              </p>
              <Fld label="Traits (one per line)">
                <textarea
                  className="fr-ta"
                  aria-label="Traits (one per line)"
                  key={`${monster.id}:${(monster.traits ?? []).join('\n')}`}
                  defaultValue={(monster.traits ?? []).join('\n')}
                  onBlur={(e) => {
                    const next = parseLines(e.target.value);
                    if (next.join('\n') !== (monster.traits ?? []).join('\n'))
                      patch({ traits: next });
                  }}
                />
              </Fld>
            </Panel>
            <Panel title="Abilities">
              <MonsterAbilities store={store} monster={monster} />
            </Panel>
            <Panel title="Spells">
              <MonsterSpells store={store} monster={monster} />
            </Panel>
          </>
        ) : (
          <Panel title="Monster">
            <p className="fr-help">Pick a monster on the left, or add one.</p>
          </Panel>
        )}
      </Col>

      <Col label="Behavior">
        {monster && (
          <>
            <Panel title="Behavior">
              <Fld label="Starts">
                <select
                  className="fr-sel"
                  aria-label="Starts"
                  value={monster.state ?? 'active'}
                  onChange={(e) =>
                    patch({
                      state:
                        e.target.value === 'active'
                          ? null
                          : (e.target.value as 'dormant' | 'stone'),
                    })
                  }
                >
                  {STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Fld>
              <Toggle
                label="Hidden until an action places it"
                on={monster.hidden === true}
                onChange={(on) => patch({ hidden: on ? true : null })}
              />
            </Panel>
            <Panel title="Actions on it">
              <SubjectActions store={store} subject={{ kind: 'monster', id: monster.id }} />
            </Panel>
          </>
        )}
      </Col>
    </Frame>
  );
}

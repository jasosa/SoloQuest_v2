/**
 * The quest fields of the inspector (shown with nothing selected): the objectives, the text only
 * editor-only anchors, the wandering monster and the two simple quest rules. Every change is an engine
 * edit operation through the store (`meta.ts`), so undo works and a refused change shows the
 * engine sentence as a toast. Text fields save when they lose focus, chips save at once. Warnings
 * of a change (for example a note that completed a removed objective) show on the board, as for
 * every other edit.
 */
import { useState } from 'react';
import { useStore } from 'zustand';
import {
  addAbility,
  removeEnemy,
  addSpell,
  addEnding,
  addNpc,
  addObjective,
  removeNpc,
  setEndText,
  updateNpc,
  removeEnding,
  removeObjective,
  setRules,
  setWandering,
  updateEnding,
  updateObjective,
} from '../../engine/editor';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import {
  MONSTER_TYPES,
  type MonsterType,
  type ObjectiveDef,
  type Quest,
} from '../../engine/quest/schema';
import type { EditorStore } from './editorStore';
import { Choose, ConditionList, Num, Text } from './NotesPanel';
import { shownName } from './monsterLabel';
import { OBJECTIVE_RULES, objectiveRuleKey, ruleOf, type ObjectiveRuleKey } from './objectiveForms';

type WanderMode = 'none' | 'monster' | 'text';

export type QuestPart =
  'objectives' | 'endings' | 'abilities' | 'wandering' | 'rules' | 'characters';

/** `only` shows one part (a panel of the Quest tab); without it every part shows. */
export function QuestPanel({ store, only }: { store: EditorStore; only?: QuestPart }) {
  const show = (part: QuestPart) => only === undefined || only === part;
  const { quest } = useStore(store);
  const st = store.getState();
  const w = quest.wandering;
  // Local choice only matters while there is no wandering monster in the quest (free text, empty).
  const [pickedText, setMode] = useState<boolean>(false);
  const mode: WanderMode = w ? ('monster' in w ? 'monster' : 'text') : pickedText ? 'text' : 'none';
  const wText = w && 'text' in w ? w.text : '';
  const wMonster: MonsterType = w && 'monster' in w ? w.monster : 'orc';
  const wCount = w && 'monster' in w ? w.count : undefined;
  const wEnemy = w && 'monster' in w ? w.enemy : undefined;
  const setMonster = (patch: { monster?: MonsterType; count?: number; enemy?: string }) =>
    st.apply((q) =>
      setWandering(q, {
        monster: patch.monster ?? wMonster,
        count: 'count' in patch ? patch.count : wCount,
        enemy: 'enemy' in patch ? patch.enemy : wEnemy,
      }),
    );

  return (
    <div className="ed-quest" data-testid="quest-panel">
      {show('objectives') && (
        <section>
          <div className="lbl">Objectives</div>
          {quest.objectives.length === 0 ? (
            <p className="ed-note" data-testid="no-objectives">
              No objectives yet. A quest needs at least one.
            </p>
          ) : (
            quest.objectives.map((o) => (
              <div className="ed-row" key={o.id} data-testid="objective-row" data-objective={o.id}>
                <div className="ed-row-head">
                  <span data-testid="objective-id">{o.id}</span>
                  <button
                    className="chip"
                    aria-label={`Remove objective ${o.id}`}
                    onClick={() => st.apply((q) => removeObjective(q, o.id))}
                  >
                    Remove
                  </button>
                </div>
                <label className="ed-field">
                  What the heroes must do
                  <textarea
                    key={`${o.id}:${o.text}`}
                    defaultValue={o.text}
                    rows={2}
                    aria-label={`Objective ${o.id} text`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === o.text) return;
                      if (!st.apply((q) => updateObjective(q, o.id, { text: v })))
                        e.target.value = o.text;
                    }}
                  />
                </label>
                <ObjectiveRule store={store} quest={quest} objective={o} />
              </div>
            ))
          )}
          <p className="ed-note">
            A note completes an objective with the effect "Complete an objective", using its id.
          </p>
          <button
            className="btn"
            onClick={() => st.apply((q) => addObjective(q, { text: 'New objective' }))}
          >
            Add an objective
          </button>
        </section>
      )}

      {show('endings') && (
        <section>
          <div className="lbl">Endings</div>
          {(quest.endings ?? []).map((e) => (
            <div className="ed-row" key={e.id} data-testid="ending-row" data-ending={e.id}>
              <div className="ed-row-head">
                <span>{e.id}</span>
                <button
                  className="chip"
                  aria-label={`Remove ending ${e.id}`}
                  onClick={() => st.apply((q) => removeEnding(q, e.id))}
                >
                  Remove
                </button>
              </div>
              <label className="ed-field">
                Label
                <input
                  key={`${e.id}:l:${e.label}`}
                  defaultValue={e.label}
                  aria-label={`Ending ${e.id} label`}
                  onBlur={(ev) => {
                    const v = ev.target.value.trim();
                    if (v === e.label) return;
                    if (!st.apply((q) => updateEnding(q, e.id, { label: v })))
                      ev.target.value = e.label;
                  }}
                />
              </label>
              <label className="ed-field">
                Text for the players
                <textarea
                  key={`${e.id}:t:${e.text ?? ''}`}
                  defaultValue={e.text ?? ''}
                  rows={2}
                  aria-label={`Ending ${e.id} text`}
                  onBlur={(ev) => {
                    const v = ev.target.value.trim();
                    if (v === (e.text ?? '')) return;
                    st.apply((q) => updateEnding(q, e.id, { text: v === '' ? null : v }));
                  }}
                />
              </label>
            </div>
          ))}
          <label className="ed-field">
            Text on the end screen after every ending
            <textarea
              key={quest.endText ?? ''}
              defaultValue={quest.endText ?? ''}
              rows={2}
              aria-label="End text"
              onBlur={(ev) => {
                const v = ev.target.value.trim();
                if (v !== (quest.endText ?? '')) st.apply((q) => setEndText(q, v));
              }}
            />
          </label>
          <p className="ed-note">
            An ending shows in the End quest list, next to the stairs and "All heroes fell". It
            shows no reward.
          </p>
          <button
            className="btn"
            onClick={() => st.apply((q) => addEnding(q, { label: 'New ending' }))}
          >
            Add an ending
          </button>
        </section>
      )}

      {show('characters') && (
        <section data-testid="characters-section">
          <div className="lbl">Characters</div>
          {quest.npcs.map((n) => (
            <div className="ed-row" key={n.id} data-testid="npc-row" data-npc={n.id}>
              <div className="ed-row-head">
                <span>{n.id}</span>
                <button
                  className="chip"
                  aria-label={`Remove character ${n.id}`}
                  onClick={() => st.apply((q) => removeNpc(q, n.id))}
                >
                  Remove
                </button>
              </div>
              <Text
                label="Name"
                value={n.name}
                onSave={(name) => name && st.apply((q) => updateNpc(q, n.id, { name }))}
              />
              <div className="ed-stats ed-two">
                <Num
                  store={store}
                  label="Defend dice"
                  value={n.defend}
                  min={0}
                  onSave={(defend) =>
                    defend !== undefined && st.apply((q) => updateNpc(q, n.id, { defend }))
                  }
                />
                <Num
                  store={store}
                  label="Body points"
                  value={n.body}
                  min={0}
                  onSave={(body) =>
                    body !== undefined && st.apply((q) => updateNpc(q, n.id, { body }))
                  }
                />
                <Num
                  store={store}
                  label="Move dice"
                  value={n.move}
                  optional
                  min={0}
                  onSave={(move) => st.apply((q) => updateNpc(q, n.id, { move: move ?? null }))}
                />
                <Num
                  store={store}
                  label="Attack dice"
                  value={n.attack}
                  optional
                  min={0}
                  onSave={(attack) =>
                    st.apply((q) => updateNpc(q, n.id, { attack: attack ?? null }))
                  }
                />
              </div>
              <p className="ed-id">
                Appears on square {n.cell[0]}, {n.cell[1]}
              </p>
              <button
                className="btn alt ed-pick"
                onClick={() =>
                  st.setPicking({
                    kind: 'cell',
                    hint: 'Click the square where the character appears.',
                    onPick: (v) => {
                      const c = v as [number, number];
                      st.apply((q) => updateNpc(q, n.id, { cell: c }));
                    },
                  })
                }
              >
                Pick the square on the board
              </button>
              <Text
                label="What the players need to know"
                value={n.text}
                multiline
                onSave={(text) => st.apply((q) => updateNpc(q, n.id, { text }))}
              />
            </div>
          ))}
          <p className="ed-note">
            A character joins the heroes when an action has the effect "Bring in a character". It is
            shown as a chip, never tracked.
          </p>
          <button
            className="btn"
            onClick={() =>
              st.setPicking({
                kind: 'cell',
                hint: 'Click the square where the character appears.',
                onPick: (v) =>
                  st.apply((q) =>
                    addNpc(q, {
                      name: 'New character',
                      cell: v as [number, number],
                      defend: 2,
                      body: 2,
                    }),
                  ),
              })
            }
          >
            Add a character
          </button>
        </section>
      )}

      {show('abilities') && (
        <section data-testid="abilities-section">
          <div className="lbl">Abilities and spells of this quest</div>
          <ul className="ed-items">
            {quest.abilityDefs.map((a) => (
              <li key={a.id} data-ability={a.id}>
                <b>{a.name}</b>
                <p>
                  {a.kind === 'weakness'
                    ? 'Weakness'
                    : a.kind === 'immunity'
                      ? 'Immunity'
                      : 'Ability'}
                  : {a.text}
                </p>
                <button
                  className="chip"
                  aria-label={`Edit ability ${a.id}`}
                  onClick={() => st.setAbilityId(a.id)}
                >
                  Edit
                </button>
              </li>
            ))}
            {quest.spellDefs.map((sp) => (
              <li key={sp.id} data-spell={sp.id}>
                <b>{sp.name}</b>
                <p>Spell: {sp.question ?? sp.tags.join(', ')}</p>
                <button
                  className="chip"
                  aria-label={`Edit spell ${sp.id}`}
                  onClick={() => st.setSpellId(sp.id)}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
          {quest.enemyDefs.length > 0 && (
            <div data-testid="enemies-section">
              <div className="lbl">Enemies of this quest</div>
              <ul className="ed-items">
                {quest.enemyDefs.map((e) => {
                  const n = quest.monsters.filter((m) => m.enemy === e.id).length;
                  return (
                    <li key={e.id} data-enemy={e.id}>
                      <b>{e.name}</b>
                      <p>
                        {n === 0
                          ? 'No monster uses it.'
                          : `${n} monster${n === 1 ? '' : 's'} use it.`}
                      </p>
                      <button
                        className="chip"
                        aria-label={`Remove enemy ${e.id}`}
                        onClick={() => st.apply((q) => removeEnemy(q, e.id))}
                      >
                        {n === 0 ? 'Remove' : 'Remove, keep its monsters as plain ones'}
                      </button>
                      {n > 0 && (
                        <button
                          className="chip"
                          aria-label={`Remove enemy ${e.id} with its monsters`}
                          onClick={() =>
                            st.apply((q) => removeEnemy(q, e.id, { withMonsters: true }))
                          }
                        >
                          Remove with its monsters
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="ed-note">
                An enemy stays in the quest when it is removed from the Library. Take it out here.
              </p>
            </div>
          )}
          <p className="ed-note">
            Your own abilities and spells show next to the core ones when you add them to a monster.
            A monster with an ability is not a special monster.
          </p>
          <div className="ed-addrow">
            <button
              className="btn"
              onClick={() => {
                if (
                  !st.apply((q) =>
                    addAbility(q, { name: 'New ability', text: 'Write what it does.' }),
                  )
                )
                  return;
                const made = store.getState().quest.abilityDefs.at(-1);
                if (made) st.setAbilityId(made.id);
              }}
            >
              Add an ability
            </button>
            <button
              className="btn"
              onClick={() => {
                if (!st.apply((q) => addSpell(q, { name: 'New spell', tags: ['any'] }))) return;
                const made = store.getState().quest.spellDefs.at(-1);
                if (made) st.setSpellId(made.id);
              }}
            >
              Add a spell
            </button>
          </div>
        </section>
      )}

      {show('wandering') && (
        <section>
          <div className="lbl">Wandering monster</div>
          <div className="ed-chips" role="group" aria-label="Wandering monster">
            <button
              className="chip"
              aria-pressed={mode === 'none'}
              onClick={() => {
                setMode(false);
                if (w) st.apply((q) => setWandering(q, null));
              }}
            >
              None
            </button>
            <button
              className="chip"
              aria-pressed={mode === 'monster'}
              onClick={() => {
                setMode(false);
                if (!w || 'text' in w) st.apply((q) => setWandering(q, { monster: wMonster }));
              }}
            >
              A monster
            </button>
            <button
              className="chip ed-wide"
              aria-pressed={mode === 'text'}
              onClick={() => {
                setMode(true);
                if (w && 'monster' in w) st.apply((q) => setWandering(q, null));
              }}
            >
              Free text
            </button>
          </div>
          {mode === 'monster' && (
            <label className="ed-field">
              Monster
              <select
                className="es-select"
                value={wMonster}
                onChange={(e) => setMonster({ monster: e.target.value as MonsterType })}
              >
                {MONSTER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MONSTER_NAMES[t]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === 'monster' && (
            <>
              <Num
                store={store}
                label="How many come from a wandering monster trap"
                value={wCount ?? 1}
                min={1}
                onSave={(n) => n !== undefined && setMonster({ count: n })}
              />
              {quest.enemyDefs.length > 0 && (
                <Choose
                  label="It is this enemy of the quest"
                  value={wEnemy ?? ''}
                  options={[
                    { value: '', label: 'A plain monster of that kind' },
                    ...quest.enemyDefs.map((e) => ({ value: e.id, label: e.name })),
                  ]}
                  onChange={(enemy) => setMonster({ enemy: enemy === '' ? undefined : enemy })}
                />
              )}
            </>
          )}
          {mode === 'text' && (
            <label className="ed-field">
              What appears
              <input
                key={wText}
                defaultValue={wText}
                placeholder="Text for the players"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === wText) return;
                  if (v === '' && wText === '') return;
                  if (!st.apply((q) => setWandering(q, { text: v }))) e.target.value = wText;
                }}
              />
            </label>
          )}
        </section>
      )}

      {show('rules') && (
        <section>
          <div className="lbl">Rules</div>
          <label className="ed-field">
            Falling block rule
            <input
              key={quest.rules.fallingBlock ?? ''}
              defaultValue={quest.rules.fallingBlock ?? ''}
              placeholder="None"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (quest.rules.fallingBlock ?? '')) return;
                st.apply((q) => setRules(q, { fallingBlock: v === '' ? null : v }));
              }}
            />
          </label>
          <label className="ed-field">
            No equipment until note
            <select
              className="es-select"
              value={quest.rules.noEquipmentUntil ?? ''}
              onChange={(e) =>
                st.apply((q) =>
                  setRules(q, { noEquipmentUntil: e.target.value === '' ? null : e.target.value }),
                )
              }
            >
              <option value="">None</option>
              {quest.rules.noEquipmentUntil &&
                !quest.notes.some((n) => n.id === quest.rules.noEquipmentUntil) && (
                  <option value={quest.rules.noEquipmentUntil}>
                    {quest.rules.noEquipmentUntil} (missing)
                  </option>
                )}
              {quest.notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id}
                </option>
              ))}
            </select>
          </label>
          <RuleExtras store={store} quest={quest} />
        </section>
      )}
    </div>
  );
}

/** The rules `bounty` (gold per kind of monster) and `doorTeleport` (dice and squares). */
function RuleExtras({ store, quest }: { store: EditorStore; quest: Quest }) {
  const st = store.getState();
  const bounty = quest.rules.bounty ?? {};
  const tele = quest.rules.doorTeleport;
  const free = MONSTER_TYPES.filter((t) => bounty[t] === undefined);
  const setBounty = (next: Partial<Record<MonsterType, number>>) =>
    st.apply((q) => setRules(q, { bounty: Object.keys(next).length === 0 ? null : next }));
  const setTele = (patch: { dice?: string; squares?: string }) => {
    const dice = (patch.dice ?? tele?.dice ?? '').trim();
    const squares = (patch.squares ?? tele?.squares ?? '').trim();
    if (dice === '' && squares === '') return st.apply((q) => setRules(q, { doorTeleport: null }));
    if (dice === '' || squares === '') {
      st.say('The door teleport rule needs both the dice and the squares.');
      return false;
    }
    return st.apply((q) => setRules(q, { doorTeleport: { dice, squares } }));
  };
  return (
    <>
      <div className="lbl">Bounty (gold for a kind of monster)</div>
      {(Object.entries(bounty) as [MonsterType, number][]).map(([type, gold]) => (
        <div className="ed-row" key={type} data-testid="bounty-row" data-type={type}>
          <div className="ed-row-head">
            <span>{MONSTER_NAMES[type]}</span>
            <button
              className="chip"
              aria-label={`Remove bounty ${type}`}
              onClick={() => {
                const { [type]: _gone, ...rest } = bounty;
                void _gone;
                setBounty(rest);
              }}
            >
              Remove
            </button>
          </div>
          <label className="ed-field">
            Gold
            <input
              key={`${type}:${gold}`}
              inputMode="numeric"
              defaultValue={String(gold)}
              aria-label={`Bounty ${type} gold`}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v === gold) return;
                if (!Number.isInteger(v) || v < 0) {
                  st.say('Gold is a whole number, 0 or more.');
                  e.target.value = String(gold);
                  return;
                }
                setBounty({ ...bounty, [type]: v });
              }}
            />
          </label>
        </div>
      ))}
      {free.length > 0 && (
        <label className="ed-field">
          Add a bounty
          <select
            className="es-select"
            aria-label="Add a bounty"
            value=""
            onChange={(e) => {
              if (e.target.value) setBounty({ ...bounty, [e.target.value]: 10 });
            }}
          >
            <option value="">Pick a monster</option>
            {free.map((t) => (
              <option key={t} value={t}>
                {MONSTER_NAMES[t]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="lbl">Door teleport</div>
      <label className="ed-field">
        Dice
        <input
          key={`dice:${tele?.dice ?? ''}`}
          defaultValue={tele?.dice ?? ''}
          placeholder="None"
          aria-label="Door teleport dice"
          onBlur={(e) => {
            if (e.target.value.trim() !== (tele?.dice ?? '')) setTele({ dice: e.target.value });
          }}
        />
      </label>
      <label className="ed-field">
        Squares
        <input
          key={`squares:${tele?.squares ?? ''}`}
          defaultValue={tele?.squares ?? ''}
          placeholder="None"
          aria-label="Door teleport squares"
          onBlur={(e) => {
            if (e.target.value.trim() !== (tele?.squares ?? ''))
              setTele({ squares: e.target.value });
          }}
        />
      </label>
    </>
  );
}

/** Done rule, confirm button and its conditions of one objective. */
function ObjectiveRule({
  store,
  quest,
  objective: o,
}: {
  store: EditorStore;
  quest: Quest;
  objective: ObjectiveDef;
}) {
  const st = store.getState();
  const d = o.done;
  const key = objectiveRuleKey(o);
  const setDone = (done: ObjectiveDef['done'] | null) =>
    st.apply((q) => updateObjective(q, o.id, { done }));
  return (
    <>
      <Choose
        label="Done when"
        value={key}
        options={OBJECTIVE_RULES.map((r) => ({ value: r.key, label: r.label }))}
        onChange={(k) => {
          if (k === key) return;
          const r = ruleOf(quest, k as ObjectiveRuleKey);
          if (r.ok) setDone(r.value);
          else st.say(r.error);
        }}
      />
      {d && 'monsterKilled' in d && (
        <Choose
          label="Monster"
          value={d.monsterKilled}
          options={quest.monsters.map((m) => ({
            value: m.id,
            label: `${m.id} · ${shownName(quest, m)}`,
          }))}
          onChange={(monsterKilled) => setDone({ monsterKilled })}
        />
      )}
      {d && 'allKilled' in d && (
        <div className="ed-chips ed-small">
          {quest.monsters.map((m) => {
            const on = d.allKilled.includes(m.id);
            return (
              <button
                key={m.id}
                className="chip"
                aria-pressed={on}
                onClick={() => {
                  const next = on ? d.allKilled.filter((x) => x !== m.id) : [...d.allKilled, m.id];
                  if (next.length === 0) st.say('Keep at least one monster.');
                  else setDone({ allKilled: next });
                }}
              >
                {m.id}
              </button>
            );
          })}
        </div>
      )}
      {d && 'flag' in d && (
        <Text label="Flag" value={d.flag} onSave={(flag) => flag && setDone({ flag })} />
      )}
      {d && 'when' in d && (
        <ConditionList
          store={store}
          quest={quest}
          conditions={d.when}
          onChange={(when) =>
            when.length > 0 ? setDone({ when }) : st.say('Keep at least one condition.')
          }
        />
      )}
      <Text
        label="Confirm button (optional)"
        value={o.confirm ?? ''}
        placeholder="For example: The heroes left through the exit"
        onSave={(confirm) => st.apply((q) => updateObjective(q, o.id, { confirm }))}
      />
      {o.confirm && (
        <>
          <div className="lbl">The button shows only if</div>
          <ConditionList
            store={store}
            quest={quest}
            conditions={o.confirmWhen ?? []}
            onChange={(confirmWhen) => st.apply((q) => updateObjective(q, o.id, { confirmWhen }))}
          />
        </>
      )}
    </>
  );
}

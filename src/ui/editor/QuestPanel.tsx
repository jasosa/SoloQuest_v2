/**
 * The quest fields of the inspector (shown with nothing selected): the objectives, the text only
 * Zargon sees, the wandering monster and the two simple quest rules. Every change is an engine
 * edit operation through the store (`meta.ts`), so undo works and a refused change shows the
 * engine sentence as a toast. Text fields save when they lose focus, chips save at once. Warnings
 * of a change (for example a note that completed a removed objective) show on the board, as for
 * every other edit.
 */
import { useState } from 'react';
import { useStore } from 'zustand';
import {
  addObjective,
  removeObjective,
  setRules,
  setWandering,
  setZargonInfo,
  updateObjective,
} from '../../engine/editor';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import { MONSTER_TYPES, type MonsterType } from '../../engine/quest/schema';
import type { EditorStore } from './editorStore';

type WanderMode = 'none' | 'monster' | 'text';

export function QuestPanel({ store }: { store: EditorStore }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const w = quest.wandering;
  // Local choice only matters while there is no wandering monster in the quest (free text, empty).
  const [pickedText, setMode] = useState<boolean>(false);
  const mode: WanderMode = w ? ('monster' in w ? 'monster' : 'text') : pickedText ? 'text' : 'none';
  const wText = w && 'text' in w ? w.text : '';
  const wMonster: MonsterType = w && 'monster' in w ? w.monster : 'orc';

  return (
    <div className="ed-quest" data-testid="quest-panel">
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
              {o.done && <p className="ed-note">It also has a done rule, kept as it is.</p>}
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

      <section>
        <div className="lbl">For Zargon only</div>
        <label className="ed-field">
          Zargon info
          <textarea
            key={quest.zargonInfo ?? ''}
            defaultValue={quest.zargonInfo ?? ''}
            rows={3}
            placeholder="Hints only Zargon reads"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (quest.zargonInfo ?? '')) st.apply((q) => setZargonInfo(q, v));
            }}
          />
        </label>
      </section>

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
              onChange={(e) =>
                st.apply((q) => setWandering(q, { monster: e.target.value as MonsterType }))
              }
            >
              {MONSTER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MONSTER_NAMES[t]}
                </option>
              ))}
            </select>
          </label>
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
      </section>
    </div>
  );
}

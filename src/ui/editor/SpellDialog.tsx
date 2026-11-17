import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { removeSpell, updateSpell } from '../../engine/editor';
import {
  SPELL_TAG_IDS,
  SPELL_TAG_QUESTIONS,
  isSpellTag,
  type SpellTag,
  type SpellTiming,
} from '../../engine/data/spells';
import { useLibrary } from '../designer/LibraryContext';
import type { EditorStore } from './editorStore';

/**
 * The spell popup (decision 70): name, own text, the situations that decide when a monster may
 * cast it (each shows its question), or one question of the author's own, a warning and the
 * escape-point rule. Situations are added from a dropdown, never chips.
 */
export function SpellDialog({ store }: { store: EditorStore }) {
  const { quest, spellId } = useStore(store);
  const st = store.getState();
  const head = useRef<HTMLHeadingElement>(null);
  const lib = useLibrary();
  const [saved, setSaved] = useState('');
  const sp = spellId ? quest.spellDefs.find((x) => x.id === spellId) : undefined;

  useEffect(() => {
    if (sp) head.current?.focus();
  }, [sp?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') st.setSpellId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sp?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sp) return null;
  const tags = sp.tags.filter(isSpellTag);
  const free = SPELL_TAG_IDS.filter((t) => !tags.includes(t));
  const used = quest.monsters.filter((m) => (m.spells ?? []).includes(sp.id));
  const setTags = (next: SpellTag[]) => st.apply((q) => updateSpell(q, sp.id, { tags: next }));

  return (
    <div className="ed-veil">
      <div className="ed-dialog" role="dialog" aria-modal="true" aria-label="Spell">
        <div className="ed-dialog-hd">
          <h2 ref={head} tabIndex={-1}>
            Spell
          </h2>
          <button className="btn alt" onClick={() => st.setSpellId(null)}>
            Close
          </button>
        </div>
        <div className="ed-dialog-body">
          <label className="ed-field">
            Name
            <input
              key={`${sp.id}:n:${sp.name}`}
              defaultValue={sp.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === sp.name) return;
                if (!st.apply((q) => updateSpell(q, sp.id, { name: v }))) e.target.value = sp.name;
              }}
            />
          </label>
          <label className="ed-field">
            What it does (your own words, optional)
            <textarea
              key={`${sp.id}:t:${sp.text ?? ''}`}
              defaultValue={sp.text ?? ''}
              rows={2}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (sp.text ?? '')) return;
                st.apply((q) => updateSpell(q, sp.id, { text: v === '' ? null : v }));
              }}
            />
          </label>

          <div className="lbl">When the monster may cast it</div>
          <ul className="ed-items" data-testid="spell-tags">
            {tags.map((t) => (
              <li key={t} data-tag={t}>
                <b>{t}</b>
                <p className="ed-q">{SPELL_TAG_QUESTIONS[t]}</p>
                <button
                  className="chip"
                  aria-label={`Remove ${t}`}
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="ed-addrow">
            <select
              className="es-select"
              aria-label="Add a situation"
              data-testid="add-tag"
              value=""
              onChange={(e) => {
                if (isSpellTag(e.target.value)) setTags([...tags, e.target.value]);
              }}
            >
              <option value="">Add a situation…</option>
              {free.map((t) => (
                <option key={t} value={t}>
                  {t} · {SPELL_TAG_QUESTIONS[t]}
                </option>
              ))}
            </select>
          </div>
          <p className="ed-note">It fits when any of them is true.</p>

          <label className="ed-field">
            Or one question of your own (replaces the situations)
            <input
              key={`${sp.id}:q:${sp.question ?? ''}`}
              defaultValue={sp.question ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (sp.question ?? '')) return;
                st.apply((q) => updateSpell(q, sp.id, { question: v === '' ? null : v }));
              }}
            />
          </label>
          <label className="ed-field">
            Offer it only when
            <select
              className="es-select"
              value={sp.offerWhen ?? 'always'}
              onChange={(e) =>
                st.apply((q) =>
                  updateSpell(q, sp.id, { offerWhen: e.target.value as 'always' | 'escapePoint' }),
                )
              }
            >
              <option value="always">Always</option>
              <option value="escapePoint">The quest has an escape point</option>
            </select>
          </label>
          <label className="ed-field">
            When it is cast
            <select
              className="es-select"
              aria-label="When it is cast"
              value={sp.timing ?? 'either'}
              onChange={(e) =>
                st.apply((q) => updateSpell(q, sp.id, { timing: e.target.value as SpellTiming }))
              }
            >
              <option value="either">It may move first, then cast</option>
              <option value="beforeMoving">Cast first, then it may move</option>
              <option value="afterMoving">Move first, then cast</option>
              <option value="instead">Cast instead of moving</option>
            </select>
          </label>
          <label className="ed-field">
            Warning for the players (optional)
            <input
              key={`${sp.id}:w:${sp.warning ?? ''}`}
              defaultValue={sp.warning ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (sp.warning ?? '')) return;
                st.apply((q) => updateSpell(q, sp.id, { warning: v === '' ? null : v }));
              }}
            />
          </label>
          <p className="ed-note" data-testid="spell-used">
            {used.length === 0
              ? 'No monster knows it yet.'
              : `Known by: ${used.map((m) => m.name ?? m.id).join(', ')}`}
          </p>
          <button
            className="btn alt"
            data-testid="save-in-library"
            onClick={() =>
              void lib.save('spell', sp).then((m) => setSaved(m || 'Saved in the library.'))
            }
          >
            Save in the library
          </button>
          {saved && (
            <p className="ed-note" role="status">
              {saved}
            </p>
          )}
          <button
            className="btn alt"
            onClick={() => {
              if (st.apply((q) => removeSpell(q, sp.id))) st.setSpellId(null);
            }}
          >
            Delete spell
          </button>
        </div>
      </div>
    </div>
  );
}

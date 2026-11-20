import { useRef, useState } from 'react';
import { useModal } from '../shared/useModal';
import { useStore } from 'zustand';
import { removeAbility, updateAbility } from '../../engine/editor';
import { useLibrary } from '../designer/LibraryContext';
import type { EditorStore } from './editorStore';
import { t } from '../../i18n/t';

const KINDS = [
  { value: 'ability', label: 'Ability' },
  { value: 'weakness', label: 'Weakness' },
  { value: 'immunity', label: 'Immunity' },
] as const;

/**
 * The ability popup (decision 70): name, kind and text of one ability of the quest, in the same
 * dialog shell as the action popup. Edits are saved as the author leaves a field.
 */
export function AbilityDialog({ store }: { store: EditorStore }) {
  const { quest, abilityId } = useStore(store);
  const st = store.getState();
  const box = useRef<HTMLDivElement>(null);
  const lib = useLibrary();
  const [saved, setSaved] = useState('');
  const a = abilityId ? quest.abilityDefs.find((x) => x.id === abilityId) : undefined;

  useModal(box, { active: Boolean(a), onEscape: () => st.setAbilityId(null), focus: 'title' });

  if (!a) return null;
  const used = quest.monsters.filter((m) => (m.abilities ?? []).includes(a.id));

  return (
    <div className="ed-veil">
      <div
        className="ed-dialog"
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={t('editor.AbilityDialog.ability', 'Ability')}
      >
        <div className="ed-dialog-hd">
          <h2>{t('editor.AbilityDialog.ability', 'Ability')}</h2>
          <button className="btn alt" onClick={() => st.setAbilityId(null)}>
            {t('editor.AbilityDialog.close', 'Close')}
          </button>
        </div>
        <div className="ed-dialog-body">
          <label className="ed-field">
            Name
            <input
              key={`${a.id}:n:${a.name}`}
              defaultValue={a.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === a.name) return;
                if (!st.apply((q) => updateAbility(q, a.id, { name: v }))) e.target.value = a.name;
              }}
            />
          </label>
          <label className="ed-field">
            Kind
            <select
              className="es-select"
              value={a.kind ?? 'ability'}
              onChange={(e) =>
                st.apply((q) =>
                  updateAbility(q, a.id, {
                    kind: e.target.value as 'ability' | 'weakness' | 'immunity',
                  }),
                )
              }
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ed-field">
            What it does
            <textarea
              key={`${a.id}:t:${a.text}`}
              defaultValue={a.text}
              rows={3}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === a.text) return;
                if (!st.apply((q) => updateAbility(q, a.id, { text: v }))) e.target.value = a.text;
              }}
            />
          </label>
          <p className="ed-note">
            In your own words. It shows on the token tooltip, the margin note and Zargon&apos;s
            order.
          </p>
          <p className="ed-note" data-testid="ability-used">
            {used.length === 0
              ? t('editor.AbilityDialog.noMonsterUsesIt', 'No monster uses it yet.')
              : t('editor.AbilityDialog.usedBy', 'Used by: {v1}', {
                  v1: used.map((m) => m.name ?? m.id).join(', '),
                })}
          </p>
          <button
            className="btn alt"
            data-testid="save-in-library"
            onClick={() =>
              void lib.save('ability', a).then((m) => setSaved(m || 'Saved in the library.'))
            }
          >
            {t('editor.AbilityDialog.saveInTheLibrary', 'Save in the library')}
          </button>
          {saved && (
            <p className="ed-note" role="status">
              {saved}
            </p>
          )}
          <button
            className="btn alt"
            onClick={() => {
              if (st.apply((q) => removeAbility(q, a.id))) st.setAbilityId(null);
            }}
          >
            {t('editor.AbilityDialog.deleteAbility', 'Delete ability')}
          </button>
        </div>
      </div>
    </div>
  );
}

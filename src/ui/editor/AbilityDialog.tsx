import { useRef, useState } from 'react';
import { useModal } from '../shared/useModal';
import { useStore } from 'zustand';
import { removeAbility, updateAbility } from '../../engine/editor';
import { useLibrary } from '../designer/LibraryContext';
import type { AbilityDefData } from '../../engine/quest/schema';
import type { EditorStore } from './editorStore';
import { t } from '../../i18n/t';

const KINDS = [
  { value: 'ability', label: 'Ability' },
  { value: 'weakness', label: 'Weakness' },
  { value: 'immunity', label: 'Immunity' },
] as const;

/**
 * The ability popup (decision 70): name, kind and text of one ability of the quest, in the same
 * dialog shell as the action popup. Edits stay in the popup until "Save"; "Cancel" drops them.
 */
export function AbilityDialog({ store }: { store: EditorStore }) {
  const { quest, abilityId } = useStore(store);
  const a = abilityId ? quest.abilityDefs.find((x) => x.id === abilityId) : undefined;
  return a ? <AbilityForm key={a.id} store={store} a={a} /> : null;
}

function AbilityForm({ store, a }: { store: EditorStore; a: AbilityDefData }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const box = useRef<HTMLDivElement>(null);
  const lib = useLibrary();
  const [saved, setSaved] = useState('');
  const [name, setName] = useState(a.name);
  const [kind, setKind] = useState<'ability' | 'weakness' | 'immunity'>(a.kind ?? 'ability');
  const [text, setText] = useState(a.text);
  const dirty = name !== a.name || kind !== (a.kind ?? 'ability') || text !== a.text;

  useModal(box, { active: true, onEscape: () => st.setAbilityId(null), focus: 'title' });

  const save = () => {
    if (!dirty) return st.setAbilityId(null);
    if (st.apply((q) => updateAbility(q, a.id, { name: name.trim(), text: text.trim(), kind })))
      st.setAbilityId(null);
  };
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
          <button className="btn" onClick={save}>
            {t('editor.AbilityDialog.save', 'Save')}
          </button>
          <button className="btn alt" onClick={() => st.setAbilityId(null)}>
            {t('editor.AbilityDialog.cancel', 'Cancel')}
          </button>
        </div>
        <div className="ed-dialog-body">
          <label className="ed-field">
            {t('editor.AbilityDialog.name', 'Name')}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="ed-field">
            {t('editor.AbilityDialog.kind', 'Kind')}
            <select
              className="es-select"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'ability' | 'weakness' | 'immunity')}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ed-field">
            {t('editor.AbilityDialog.whatItDoes', 'What it does')}
            <textarea value={text} rows={3} onChange={(e) => setText(e.target.value)} />
          </label>
          <p className="ed-note">
            {t(
              'designer.helpInYourOwnWords',
              "In your own words. It shows on the token tooltip, the margin note and Zargon's order.",
            )}
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
              void lib
                .save('ability', { ...a, name: name.trim(), text: text.trim(), kind })
                .then((m) =>
                  setSaved(
                    m || t('editor.AbilityDialog.savedInTheLibrary', 'Saved in the library.'),
                  ),
                )
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

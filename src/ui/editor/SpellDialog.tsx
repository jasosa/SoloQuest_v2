import { useRef, useState } from 'react';
import { useModal } from '../shared/useModal';
import { useStore } from 'zustand';
import { removeSpell, updateSpell } from '../../engine/editor';
import { SPELL_TAG_IDS, spellTagQuestion, type SpellTiming } from '../../engine/data/spells';
import { useLibrary } from '../designer/LibraryContext';
import type { EditorStore } from './editorStore';
import { t } from '../../i18n/t';

/**
 * The spell popup (decision 70): name, own text, the situations that decide when a monster may
 * cast it (each shows its question), or one question of the author's own, a warning and the
 * escape-point rule. Situations are added from a dropdown, never chips.
 */
export function SpellDialog({ store }: { store: EditorStore }) {
  const { quest, spellId } = useStore(store);
  const st = store.getState();
  const box = useRef<HTMLDivElement>(null);
  const lib = useLibrary();
  const [saved, setSaved] = useState('');
  const [newId, setNewId] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const sp = spellId ? quest.spellDefs.find((x) => x.id === spellId) : undefined;

  useModal(box, { active: Boolean(sp), onEscape: () => st.setSpellId(null), focus: 'title' });

  if (!sp) return null;
  const tags = [...sp.tags];
  const own = sp.situations ?? [];
  const free = [...SPELL_TAG_IDS, ...own.map((x) => x.id)].filter((t) => !tags.includes(t));
  const used = quest.monsters.filter((m) => (m.spells ?? []).includes(sp.id));
  const setTags = (next: string[]) => st.apply((q) => updateSpell(q, sp.id, { tags: next }));

  return (
    <div className="ed-veil">
      <div
        className="ed-dialog"
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={t('editor.SpellDialog.spell', 'Spell')}
      >
        <div className="ed-dialog-hd">
          <h2>{t('editor.SpellDialog.spell', 'Spell')}</h2>
          <button className="btn alt" onClick={() => st.setSpellId(null)}>
            {t('editor.SpellDialog.close', 'Close')}
          </button>
        </div>
        <div className="ed-dialog-body">
          <label className="ed-field">
            {t('editor.SpellDialog.name', 'Name')}
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
            {t('editor.SpellDialog.whatItDoesYour', 'What it does (your own words, optional)')}
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

          <div className="lbl">
            {t('editor.SpellDialog.whenTheMonsterMay', 'When the monster may cast it')}
          </div>
          <ul className="ed-items" data-testid="spell-tags">
            {tags.map((tv) => (
              <li key={tv} data-tag={tv}>
                <b>{tv}</b>
                <p className="ed-q">{spellTagQuestion(sp, tv)}</p>
                <button
                  className="chip"
                  aria-label={t('editor.SpellDialog.remove2', 'Remove {tv}', { tv })}
                  onClick={() => setTags(tags.filter((x) => x !== tv))}
                >
                  {t('editor.SpellDialog.remove', 'Remove')}
                </button>
              </li>
            ))}
          </ul>
          <div className="ed-addrow">
            <select
              className="es-select"
              aria-label={t('editor.SpellDialog.addASituation', 'Add a situation')}
              data-testid="add-tag"
              value=""
              onChange={(e) => {
                if (e.target.value !== '') setTags([...tags, e.target.value]);
              }}
            >
              <option value="">{t('editor.SpellDialog.addASituation2', 'Add a situation…')}</option>
              {free.map((t) => (
                <option key={t} value={t}>
                  {t} · {spellTagQuestion(sp, t)}
                </option>
              ))}
            </select>
          </div>
          <p className="ed-note">
            {t('editor.SpellDialog.itFitsWhenAny', 'It fits when any of them is true.')}
          </p>

          <div className="lbl">
            {t('editor.SpellDialog.situationsOfYourOwn', 'Situations of your own')}
          </div>
          <ul className="ed-items" data-testid="spell-situations">
            {own.map((x) => (
              <li key={x.id} data-situation={x.id}>
                <b>{x.id}</b>
                <input
                  aria-label={t('editor.SpellDialog.questionOf', 'Question of {id}', { id: x.id })}
                  key={`${sp.id}:s:${x.id}:${x.question}`}
                  defaultValue={x.question}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === x.question) return;
                    if (
                      !st.apply((q) =>
                        updateSpell(q, sp.id, {
                          situations: own.map((y) =>
                            y.id === x.id ? { id: x.id, question: v } : y,
                          ),
                        }),
                      )
                    )
                      e.target.value = x.question;
                  }}
                />
                <button
                  className="chip"
                  aria-label={t('editor.SpellDialog.removeSituation', 'Remove situation {id}', {
                    id: x.id,
                  })}
                  onClick={() =>
                    st.apply((q) =>
                      updateSpell(q, sp.id, { situations: own.filter((y) => y.id !== x.id) }),
                    )
                  }
                >
                  {t('editor.SpellDialog.remove', 'Remove')}
                </button>
              </li>
            ))}
          </ul>
          <div className="ed-addrow">
            <input
              aria-label={t('editor.SpellDialog.situationId', 'Situation id')}
              placeholder={t('editor.SpellDialog.idShortNoSpaces', 'Id (short, no spaces)')}
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />
            <input
              aria-label={t('editor.SpellDialog.situationQuestion', 'Situation question')}
              placeholder={t(
                'editor.SpellDialog.aQuestionThePlayersCan',
                'A question the players can answer',
              )}
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
            />
            <button
              className="btn"
              disabled={newId.trim() === '' || newQuestion.trim() === ''}
              onClick={() => {
                const id = newId.trim();
                if (
                  st.apply((q) =>
                    updateSpell(q, sp.id, {
                      situations: [...own, { id, question: newQuestion }],
                      tags: [...tags, id],
                    }),
                  )
                ) {
                  setNewId('');
                  setNewQuestion('');
                }
              }}
            >
              {t('editor.SpellDialog.addSituation', 'Add situation')}
            </button>
          </div>

          <label className="ed-field">
            {t(
              'editor.SpellDialog.orOneQuestionOf',
              'Or one question of your own (replaces the situations)',
            )}
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
            {t('editor.SpellDialog.offerItOnlyWhen', 'Offer it only when')}
            <select
              className="es-select"
              value={sp.offerWhen ?? 'always'}
              onChange={(e) =>
                st.apply((q) =>
                  updateSpell(q, sp.id, { offerWhen: e.target.value as 'always' | 'escapePoint' }),
                )
              }
            >
              <option value="always">{t('editor.SpellDialog.always', 'Always')}</option>
              <option value="escapePoint">
                {t('editor.SpellDialog.theQuestHasAn', 'The quest has an escape point')}
              </option>
            </select>
          </label>
          <label className="ed-field">
            {t('editor.SpellDialog.whenItIsCast', 'When it is cast')}
            <select
              className="es-select"
              aria-label={t('editor.SpellDialog.whenItIsCast', 'When it is cast')}
              value={sp.timing ?? 'either'}
              onChange={(e) =>
                st.apply((q) => updateSpell(q, sp.id, { timing: e.target.value as SpellTiming }))
              }
            >
              <option value="either">
                {t('editor.SpellDialog.itMayMoveFirst', 'It may move first, then cast')}
              </option>
              <option value="beforeMoving">
                {t('editor.SpellDialog.castFirstThenIt', 'Cast first, then it may move')}
              </option>
              <option value="afterMoving">
                {t('editor.SpellDialog.moveFirstThenCast', 'Move first, then cast')}
              </option>
              <option value="instead">
                {t('editor.SpellDialog.castInsteadOfMoving', 'Cast instead of moving')}
              </option>
            </select>
          </label>
          <label className="ed-field">
            {t('editor.SpellDialog.warningForThePlayers', 'Warning for the players (optional)')}
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
              ? t('editor.SpellDialog.noMonsterKnowsIt', 'No monster knows it yet.')
              : t('editor.SpellDialog.knownBy', 'Known by: {v1}', {
                  v1: used.map((m) => m.name ?? m.id).join(', '),
                })}
          </p>
          <button
            className="btn alt"
            data-testid="save-in-library"
            onClick={() =>
              void lib
                .save('spell', sp)
                .then((m) =>
                  setSaved(m || t('editor.SpellDialog.savedInTheLibrary', 'Saved in the library.')),
                )
            }
          >
            {t('editor.SpellDialog.saveInTheLibrary', 'Save in the library')}
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
            {t('editor.SpellDialog.deleteSpell', 'Delete spell')}
          </button>
        </div>
      </div>
    </div>
  );
}

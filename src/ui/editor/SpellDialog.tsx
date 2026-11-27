import { useRef, useState } from 'react';
import { useModal } from '../shared/useModal';
import { useStore } from 'zustand';
import { removeSpell, updateSpell } from '../../engine/editor';
import { SPELL_TAG_IDS, spellTagQuestion, type SpellTiming } from '../../engine/data/spells';
import { useLibrary } from '../designer/LibraryContext';
import type { SpellDefData } from '../../engine/quest/schema';
import type { EditorStore } from './editorStore';
import { t } from '../../i18n/t';

/**
 * The spell popup (decision 70): name, own text, the situations that decide when a monster may
 * cast it (each shows its question), or one question of the author's own, a warning and the
 * escape-point rule. Situations are added from a dropdown, never chips. Edits stay in the popup
 * until "Save"; "Cancel" drops them.
 */
export function SpellDialog({ store }: { store: EditorStore }) {
  const { quest, spellId } = useStore(store);
  const sp = spellId ? quest.spellDefs.find((x) => x.id === spellId) : undefined;
  return sp ? <SpellForm key={sp.id} store={store} sp={sp} /> : null;
}

function SpellForm({ store, sp }: { store: EditorStore; sp: SpellDefData }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const box = useRef<HTMLDivElement>(null);
  const lib = useLibrary();
  const [saved, setSaved] = useState('');
  const [newId, setNewId] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [name, setName] = useState(sp.name);
  const [text, setText] = useState(sp.text ?? '');
  const [tags, setTags] = useState<string[]>([...sp.tags]);
  const [own, setOwn] = useState<{ id: string; question: string }[]>([...(sp.situations ?? [])]);
  const [question, setQuestion] = useState(sp.question ?? '');
  const [warning, setWarning] = useState(sp.warning ?? '');
  const [offerWhen, setOfferWhen] = useState<'always' | 'escapePoint'>(sp.offerWhen ?? 'always');
  const [timing, setTiming] = useState<SpellTiming>(sp.timing ?? 'either');
  // the spell as the popup shows it now: the fields typed so far
  const patch = {
    name: name.trim(),
    text: text.trim() === '' ? null : text.trim(),
    tags,
    situations: own,
    question: question.trim() === '' ? null : question.trim(),
    warning: warning.trim() === '' ? null : warning.trim(),
    offerWhen,
    timing,
  };
  const cur: SpellDefData = {
    id: sp.id,
    name: patch.name,
    tags,
    situations: own,
    ...(patch.text ? { text: patch.text } : {}),
    ...(patch.question ? { question: patch.question } : {}),
    ...(patch.warning ? { warning: patch.warning } : {}),
    ...(offerWhen === 'escapePoint' ? { offerWhen } : {}),
    ...(timing !== 'either' ? { timing } : {}),
  };
  const dirty =
    name !== sp.name ||
    text !== (sp.text ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(sp.tags) ||
    JSON.stringify(own) !== JSON.stringify(sp.situations ?? []) ||
    question !== (sp.question ?? '') ||
    warning !== (sp.warning ?? '') ||
    offerWhen !== (sp.offerWhen ?? 'always') ||
    timing !== (sp.timing ?? 'either');

  useModal(box, { active: true, onEscape: () => st.setSpellId(null), focus: 'title' });

  const save = () => {
    if (!dirty) return st.setSpellId(null);
    if (st.apply((q) => updateSpell(q, sp.id, patch))) st.setSpellId(null);
  };
  const free = [...SPELL_TAG_IDS, ...own.map((x) => x.id)].filter((t) => !tags.includes(t));
  const used = quest.monsters.filter((m) => (m.spells ?? []).includes(sp.id));

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
          <button className="btn" onClick={save}>
            {t('editor.SpellDialog.save', 'Save')}
          </button>
          <button className="btn alt" onClick={() => st.setSpellId(null)}>
            {t('editor.SpellDialog.cancel', 'Cancel')}
          </button>
        </div>
        <div className="ed-dialog-body">
          <label className="ed-field">
            {t('editor.SpellDialog.name', 'Name')}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="ed-field">
            {t('editor.SpellDialog.whatItDoesYour', 'What it does (your own words, optional)')}
            <textarea value={text} rows={2} onChange={(e) => setText(e.target.value)} />
          </label>

          <div className="lbl">
            {t('editor.SpellDialog.whenTheMonsterMay', 'When the monster may cast it')}
          </div>
          <ul className="ed-items" data-testid="spell-tags">
            {tags.map((tv) => (
              <li key={tv} data-tag={tv}>
                <b>{tv}</b>
                <p className="ed-q">{spellTagQuestion(cur, tv)}</p>
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
                  {t} · {spellTagQuestion(cur, t)}
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
                  value={x.question}
                  onChange={(e) =>
                    setOwn(
                      own.map((y) => (y.id === x.id ? { id: x.id, question: e.target.value } : y)),
                    )
                  }
                />
                <button
                  className="chip"
                  aria-label={t('editor.SpellDialog.removeSituation', 'Remove situation {id}', {
                    id: x.id,
                  })}
                  onClick={() => {
                    setOwn(own.filter((y) => y.id !== x.id));
                    setTags(tags.filter((g) => g !== x.id));
                  }}
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
                setOwn([...own, { id, question: newQuestion.trim() }]);
                setTags([...tags, id]);
                setNewId('');
                setNewQuestion('');
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
            <input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </label>
          <label className="ed-field">
            {t('editor.SpellDialog.offerItOnlyWhen', 'Offer it only when')}
            <select
              className="es-select"
              value={offerWhen}
              onChange={(e) => setOfferWhen(e.target.value as 'always' | 'escapePoint')}
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
              value={timing}
              onChange={(e) => setTiming(e.target.value as SpellTiming)}
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
            <input value={warning} onChange={(e) => setWarning(e.target.value)} />
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
                .save('spell', cur)
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

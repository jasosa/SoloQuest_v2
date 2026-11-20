import { useEffect, useMemo, useState } from 'react';
import {
  AREA_ALL,
  addNewTexts,
  areasOf,
  isTranslated,
  progressByArea,
  removeOldTexts,
  rowsFor,
  type RowFilter,
} from '../../i18n/editorModel';
import { baseOf, compare, placeholderProblem, type LanguageFile } from '../../i18n/file';
import type { LanguageStore } from '../../persist/languages';
import { t } from '../../i18n/t';
import { Dialog } from '../shared/Frame';

const PAGE = 50;

/** The texts of one language next to the English ones, to change and save (decision 92). */
export function TranslationEditor({
  store,
  code,
  english,
  onBack,
}: {
  store: LanguageStore;
  code: string;
  english: Readonly<Record<string, string>>;
  onBack(): void;
}) {
  const [file, setFile] = useState<LanguageFile | null>(null);
  const [strings, setStrings] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [area, setArea] = useState(AREA_ALL);
  const [filter, setFilter] = useState<RowFilter>('all');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void store.load(code).then((f) => {
      if (!live || !f) return;
      setFile(f);
      setStrings(f.strings);
    });
    return () => {
      live = false;
    };
  }, [store, code]);

  const areas = useMemo(() => areasOf(english), [english]);
  const progress = useMemo(() => progressByArea(english, strings), [english, strings]);
  const keys = useMemo(
    () => rowsFor(english, strings, { area, filter, search }),
    [english, strings, area, filter, search],
  );
  const diff = useMemo(() => compare(english, strings), [english, strings]);
  const currentBase = useMemo(() => baseOf(english), [english]);

  if (!file) return null;

  const change = (key: string, text: string) => {
    setStrings((s) => ({ ...s, [key]: text }));
    setDirty(true);
    setSaved(null);
  };
  const save = async () => {
    const next: LanguageFile = { ...file, base: currentBase, strings };
    await store.save(next);
    setFile(next);
    setDirty(false);
    setSaved(t('translations.saved', 'Saved.'));
  };
  const areaName = (a: string) =>
    a === 'interface'
      ? t('translations.interface', 'Interface')
      : a === 'library'
        ? t('translations.library', 'Library')
        : (english[`quest:${a}:title`] ?? a);
  const olderBase = file.base !== currentBase || diff.extra.length > 0 || diff.missing.length > 0;

  return (
    <Dialog
      title={t('translations.translate', 'Translate {name}', { name: file.language.name })}
      wide
      onClose={onBack}
      foot={
        <>
          <button className="btn" disabled={!dirty} onClick={() => void save()}>
            {t('translations.save', 'Save')}
          </button>
          <button className="btn alt" onClick={onBack}>
            {t('translations.backToTheList', 'Back to the list')}
          </button>
        </>
      }
    >
      {olderBase && (diff.missing.length > 0 || diff.extra.length > 0) && (
        <p className="fr-help" data-testid="older-base">
          {t(
            'translations.olderBase',
            'This file was made for another English version: {added} texts are new and {gone} are gone.',
            { added: diff.missing.length, gone: diff.extra.length },
          )}{' '}
          {diff.missing.length > 0 && (
            <button
              className="chip"
              onClick={() => {
                setStrings(addNewTexts(english, strings));
                setDirty(true);
              }}
            >
              {t('translations.addTheNewTexts', 'Add the new texts')}
            </button>
          )}{' '}
          {diff.extra.length > 0 && (
            <button
              className="chip"
              onClick={() => {
                setStrings(removeOldTexts(english, strings));
                setDirty(true);
              }}
            >
              {t('translations.removeTheOldTexts', 'Remove the old texts')}
            </button>
          )}
        </p>
      )}
      <div className="chips" role="group" aria-label={t('translations.progress', 'Progress')}>
        {progress.map((p) => (
          <button
            key={p.area}
            className="chip"
            aria-pressed={area === p.area}
            onClick={() => {
              setArea(area === p.area ? AREA_ALL : p.area);
              setShown(PAGE);
            }}
          >
            {areaName(p.area)}{' '}
            {t('translations.areaProgress', '{done} of {total}', { done: p.done, total: p.total })}
          </button>
        ))}
      </div>
      <div className="chips">
        <label className="fr-fld">
          <span>{t('translations.show', 'Show')}</span>
          <select
            className="fr-sel"
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setShown(PAGE);
            }}
          >
            <option value={AREA_ALL}>{t('translations.all', 'All')}</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {areaName(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="fr-fld">
          <span>{t('translations.filter', 'Filter')}</span>
          <select
            className="fr-sel"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as RowFilter);
              setShown(PAGE);
            }}
          >
            <option value="all">{t('translations.all', 'All')}</option>
            <option value="todo">{t('translations.notTranslatedYet', 'Not translated yet')}</option>
            <option value="problems">{t('translations.problems', 'Problems')}</option>
          </select>
        </label>
        <label className="fr-fld">
          <span>{t('translations.search', 'Search')}</span>
          <input
            className="fr-in"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShown(PAGE);
            }}
          />
        </label>
      </div>
      {saved && (
        <p className="fr-help" role="status">
          {saved}
        </p>
      )}
      <p className="fr-help">
        {t(
          'translations.count',
          '{count} texts. Words in curly braces, like {example}, are filled in when you play: keep them.',
          { count: keys.length, example: '{name}' },
        )}
      </p>
      <ul className="fr-recent" data-testid="translation-rows">
        {keys.slice(0, shown).map((key) => {
          const own = strings[key] ?? '';
          const problem = placeholderProblem(english[key]!, own);
          return (
            <li key={key} data-key={key} style={{ display: 'block' }}>
              <div className="fr-qnum">
                {key}
                {!isTranslated(english, strings, key) &&
                  t('translations.notTranslated', ' · Not translated')}
                {problem && t('translations.check', ' · Check: {problem}', { problem })}
              </div>
              <div className="fr-open-static" style={{ background: 'var(--paper-2)' }}>
                {english[key]}
              </div>
              <textarea
                className="fr-ta"
                aria-label={t('translations.translationOf', 'Translation of {key}', { key })}
                value={own}
                rows={Math.min(6, Math.max(2, Math.ceil(english[key]!.length / 70)))}
                onChange={(e) => change(key, e.target.value)}
              />
            </li>
          );
        })}
      </ul>
      {keys.length > shown && (
        <button className="btn alt" onClick={() => setShown(shown + PAGE)}>
          {t('translations.show50More', 'Show 50 more')}
        </button>
      )}
    </Dialog>
  );
}

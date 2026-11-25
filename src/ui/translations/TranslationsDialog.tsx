import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BUILTIN_UPDATE_CODE,
  ENGLISH_CODE,
  isEnglishCode,
  LANGUAGE_EXTENSION,
  LANGUAGE_MAX_BYTES,
  copyOfEnglish,
  englishEditsFile,
  languageToText,
  parseLanguageFile,
} from '../../i18n/file';
import { progressByArea } from '../../i18n/editorModel';
import type { LanguageStore, LanguageSummary } from '../../persist/languages';
import { t } from '../../i18n/t';
import { ownerModeOn, rememberOwnerMode } from '../../persist/ownerMode';
import { Dialog, Toggle } from '../shared/Frame';
import { TranslationEditor } from './TranslationEditor';

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/**
 * Languages of the app (decision 92): English is built in and fixed; the others are files kept on
 * this device that can be made from English, imported, edited, exported, used and deleted.
 */
export function TranslationsDialog({
  store,
  english,
  onClose,
  reload = () => location.reload(),
}: {
  store: LanguageStore;
  /** The English file as it is now: interface, library and the quests of the device. */
  english: () => Promise<Record<string, string>>;
  onClose(): void;
  /** Called after another language is chosen: the page loads again in it. */
  reload?: () => void;
}) {
  const [languages, setLanguages] = useState<LanguageSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', author: '' });
  const [englishTexts, setEnglishTexts] = useState<Record<string, string>>({});
  /** The built-in English (never changed), the texts the user changed in it, and the two together. */
  const [builtin, setBuiltin] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  /** The changes of the owner to the built-in English (owner mode), applied under the device edits. */
  const [update, setUpdate] = useState<Record<string, string>>({});
  const [owner, setOwner] = useState(ownerModeOn);
  const [resettingUpdate, setResettingUpdate] = useState(false);
  const [resetting, setResetting] = useState(false);
  /** Something that shows only after the page loads again was changed. */
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Record<string, number>>({});
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const list = await store.list();
    const base = await english();
    const own = (await store.load(ENGLISH_CODE))?.strings ?? {};
    const up = (await store.load(BUILTIN_UPDATE_CODE))?.strings ?? {};
    const eng = { ...base, ...up, ...own };
    setBuiltin(base);
    setEdits(own);
    setUpdate(up);
    setLanguages(list);
    setActive(await store.getActive());
    setEnglishTexts(eng);
    const counts: Record<string, number> = {};
    for (const l of list) {
      const file = await store.load(l.code);
      if (file) counts[l.code] = progressByArea(eng, file.strings).reduce((n, a) => n + a.done, 0);
    }
    setDone(counts);
  }, [store, english]);
  useEffect(() => {
    let live = true;
    void (async () => {
      if (live) await refresh();
    })();
    return () => {
      live = false;
    };
  }, [refresh]);

  const total = Object.keys(englishTexts).length;
  const editedCount = Object.keys(edits).length;
  const updateCount = Object.keys(update).length;
  /** What the app ships: the built-in English with the update of the owner. */
  const shipped = { ...builtin, ...update };

  const choose = async (code: string | null) => {
    await store.setActive(code);
    setActive(code);
    reload();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > LANGUAGE_MAX_BYTES) {
      setMessage({
        text: t('translations.msgTooBig', 'This file is too big for a translation (5 MB at most).'),
        bad: true,
      });
      return;
    }
    const r = parseLanguageFile(await file.text());
    if (!r.ok) {
      setMessage({ text: r.message, bad: true });
      return;
    }
    const isEnglish = isEnglishCode(r.file.language.code);
    const isUpdate = r.file.language.code === BUILTIN_UPDATE_CODE;
    if (isUpdate && !owner) {
      setMessage({
        text: t('translations.updateNeedsOwner', 'Only owner mode can import an English update.'),
        bad: true,
      });
      return;
    }
    const replaced = languages.some((l) => l.code === r.file.language.code);
    try {
      // a file of English texts is merged into the edited English: English is never replaced or deleted
      await store.save(
        isUpdate
          ? englishEditsFile(builtin, { ...update, ...r.file.strings }, BUILTIN_UPDATE_CODE)
          : isEnglish
            ? englishEditsFile(shipped, { ...edits, ...r.file.strings })
            : r.file,
      );
    } catch {
      setMessage({
        text: t('translations.msgNotStored', 'The translation could not be stored on this device.'),
        bad: true,
      });
      return;
    }
    if (isEnglish || active === r.file.language.code) setPending(true);
    setMessage({
      text: isEnglish
        ? t('translations.mergedEnglish', 'Merged {count} texts into English.', {
            count: Object.keys(r.file.strings).length,
          })
        : `${replaced ? 'Updated' : 'Added'} ${r.file.language.name}.`,
      bad: false,
    });
    await refresh();
  };

  const create = async () => {
    const code = form.code.trim();
    if (!form.name.trim())
      return setMessage({
        text: t('translations.msgNeedsName', 'The language needs a name.'),
        bad: true,
      });
    if (!CODE.test(code) || code === ENGLISH_CODE)
      return setMessage({
        text: t(
          'translations.msgBadCode',
          'The language code looks like "es" or "pt-BR". "en" is the built-in English.',
        ),
        bad: true,
      });
    if (languages.some((l) => l.code === code))
      return setMessage({
        text: t('translations.msgCodeTaken', 'There is a language with this code already.'),
        bad: true,
      });
    try {
      await store.save(copyOfEnglish(englishTexts, form.name, code, form.author.trim()));
    } catch {
      return setMessage({
        text: t('translations.msgNotStored', 'The translation could not be stored on this device.'),
        bad: true,
      });
    }
    setCreating(false);
    setForm({ name: '', code: '', author: '' });
    setMessage({
      text: t('translations.msgMade', 'Made {name} from English.', { name: form.name.trim() }),
      bad: false,
    });
    await refresh();
    setEditing(code);
  };

  /** Closing after a change that shows only on the next load reloads the page. */
  const close = () => (pending ? reload() : onClose());

  if (editing)
    return (
      <TranslationEditor
        store={store}
        code={editing}
        english={englishTexts}
        builtin={builtin}
        shipped={shipped}
        onBack={(saved) => {
          if (saved && (editing === active || (editing && isEnglishCode(editing)))) return reload();
          setEditing(null);
          void refresh();
        }}
      />
    );

  return (
    <Dialog
      title={t('translations.translations', 'Translations')}
      wide
      onClose={close}
      foot={
        <>
          <button className="btn alt" onClick={() => setCreating(true)}>
            {t('translations.newLanguage', 'New language')}
          </button>
          <button className="btn alt" onClick={() => input.current?.click()}>
            {t('translations.importAFile', 'Import a file')}
          </button>
          <button className="btn" onClick={close}>
            {t('translations.close', 'Close')}
          </button>
        </>
      }
    >
      <p className="fr-help">
        {t(
          'translations.aTranslationChangesThe',
          'A translation changes the words of the app and of the quests. It never changes the rules or your saved games. A text that a language does not have is shown in English.',
        )}
      </p>
      <Toggle
        label={t(
          'translations.ownerMode',
          'Owner mode: you can also prepare an update of the English the app ships',
        )}
        on={owner}
        onChange={(on) => {
          setOwner(on);
          rememberOwnerMode(on);
        }}
      />
      <input
        ref={input}
        type="file"
        hidden
        accept={`${LANGUAGE_EXTENSION},.json,application/json`}
        aria-label={t('translations.translationFile', 'Translation file')}
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {message && (
        <p className="fr-help" role={message.bad ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      {creating && (
        <form
          data-testid="new-language"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label className="fr-fld">
            <span>{t('translations.name', 'Name')}</span>
            <input
              className="fr-in"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('translations.espanol', 'Espanol')}
            />
          </label>
          <label className="fr-fld">
            <span>{t('translations.code', 'Code')}</span>
            <input
              className="fr-in"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder={t('translations.es', 'es')}
            />
          </label>
          <label className="fr-fld">
            <span>{t('translations.authorOptional', 'Author (optional)')}</span>
            <input
              className="fr-in"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
            />
          </label>
          <p className="fr-help">
            {t(
              'translations.theNewLanguageStarts',
              'The new language starts as a copy of the English texts, ready to change.',
            )}
          </p>
          <button type="submit" className="btn">
            {t('translations.makeItFromEnglish', 'Make it from English')}
          </button>{' '}
          <button type="button" className="btn alt" onClick={() => setCreating(false)}>
            {t('translations.cancel', 'Cancel')}
          </button>
        </form>
      )}
      <ul className="fr-recent" data-testid="language-list">
        <li data-language="en">
          <div className="fr-open-static">
            <span className="fr-qnum">
              {t(
                'translations.builtInEnglish',
                '{total} texts · {edited} changed by you · Stays on this device. English cannot be deleted.',
                { total, edited: editedCount },
              )}
            </span>
            <span className="fr-qtitle">{t('translations.english', 'English')}</span>
          </div>
          {active === null ? (
            <span className="fr-qnote">{t('translations.inUse', 'In use')}</span>
          ) : (
            <button className="chip" onClick={() => void choose(null)}>
              {t('translations.useEnglish', 'Use English')}
            </button>
          )}
          <button className="chip" onClick={() => setEditing(ENGLISH_CODE)}>
            {t('translations.edit', 'Edit')}
          </button>
          <button
            className="chip"
            onClick={() =>
              download(
                `${ENGLISH_CODE}${LANGUAGE_EXTENSION}`,
                languageToText(englishEditsFile(shipped, edits)),
              )
            }
          >
            {t('translations.export', 'Export')}
          </button>
          {resetting ? (
            <button
              className="chip main"
              onClick={async () => {
                await store.save(englishEditsFile(shipped, {}));
                setResetting(false);
                setPending(true);
                setMessage({
                  text: t('translations.resetDone', 'English is back to the original texts.'),
                  bad: false,
                });
                await refresh();
              }}
            >
              {t('translations.reallyReset', 'Really reset all')}
            </button>
          ) : (
            <button
              className="chip"
              disabled={editedCount === 0}
              onClick={() => setResetting(true)}
            >
              {t('translations.resetAll', 'Undo all my changes')}
            </button>
          )}
        </li>
        {owner && (
          <li data-language="en-core" data-testid="owner-english">
            <div className="fr-open-static">
              <span className="fr-qnum">
                {t(
                  'translations.ownerEnglish',
                  'English update · {count} changed · Not shipped yet. Export it, then run npm run i18n:apply.',
                  { count: updateCount },
                )}
              </span>
              <span className="fr-qtitle">
                {t('translations.builtInEnglishTitle', 'English update')}
              </span>
            </div>
            <button className="chip" onClick={() => setEditing(BUILTIN_UPDATE_CODE)}>
              {t('translations.editBuiltInEnglish', 'Edit the English update')}
            </button>
            <button
              className="chip"
              onClick={() =>
                download(
                  `english-update${LANGUAGE_EXTENSION}`,
                  languageToText(
                    englishEditsFile(
                      builtin,
                      update,
                      BUILTIN_UPDATE_CODE,
                      new Date().toISOString().slice(0, 10),
                    ),
                  ),
                )
              }
            >
              {t('translations.exportBuiltIn', 'Export the English update')}
            </button>
            {resettingUpdate ? (
              <button
                className="chip main"
                onClick={async () => {
                  await store.save(englishEditsFile(builtin, {}, BUILTIN_UPDATE_CODE));
                  setResettingUpdate(false);
                  setPending(true);
                  await refresh();
                }}
              >
                {t('translations.reallyResetBuiltIn', 'Really reset')}
              </button>
            ) : (
              <button
                className="chip"
                disabled={updateCount === 0}
                onClick={() => setResettingUpdate(true)}
              >
                {t('translations.resetBuiltIn', 'Undo my changes to the English update')}
              </button>
            )}
          </li>
        )}
        {languages.map((l) => (
          <li key={l.code} data-language={l.code}>
            <div className="fr-open-static">
              <span className="fr-qnum">
                {t('translations.ofTranslated', '{code}{author} · {done} of {total} translated', {
                  code: l.code,
                  author: l.author ? ` · ${l.author}` : '',
                  done: done[l.code] ?? 0,
                  total,
                })}
              </span>
              <span className="fr-qtitle">{l.name}</span>
            </div>
            {active === l.code ? (
              <span className="fr-qnote">{t('translations.inUse', 'In use')}</span>
            ) : (
              <button className="chip" onClick={() => void choose(l.code)}>
                {t('translations.use', 'Use')}
              </button>
            )}
            <button className="chip" onClick={() => setEditing(l.code)}>
              {t('translations.edit', 'Edit')}
            </button>
            <button
              className="chip"
              onClick={async () => {
                const file = await store.load(l.code);
                if (file) download(`${l.code}${LANGUAGE_EXTENSION}`, languageToText(file));
              }}
            >
              {t('translations.export', 'Export')}
            </button>
            {deleting === l.code ? (
              <button
                className="chip main"
                onClick={async () => {
                  const wasActive = active === l.code;
                  await store.remove(l.code);
                  setDeleting(null);
                  await refresh();
                  if (wasActive) reload();
                }}
              >
                {t('translations.reallyDelete', 'Really delete')}
              </button>
            ) : (
              <button className="chip" onClick={() => setDeleting(l.code)}>
                {t('translations.delete', 'Delete')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {languages.length === 0 && (
        <p className="fr-help">
          {t(
            'translations.noTranslationYetMake',
            'No translation yet. Make one from English, or import a {LANGUAGE_EXTENSION} file.',
            { LANGUAGE_EXTENSION },
          )}
        </p>
      )}
    </Dialog>
  );
}

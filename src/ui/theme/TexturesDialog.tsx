import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NO_SELECTION,
  type ActiveSelection,
  type PackSummary,
  type ThemeStore,
} from '../../persist/themes';
import { Dialog } from '../shared/Frame';
import {
  expansionProblem,
  fits,
  normalizeSelection,
  refreshTheme,
  removePack,
  selectionLine,
  stopPack,
  applyPack,
  type Change,
} from './activate';
import { PACK_EXTENSION, PACK_MAX_BYTES, readPack, writePack, type StoredPack } from './pack';
import { PackPreview } from './PackPreview';
import { t } from '../../i18n/t';

function download(name: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const size = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / (1024 * 1024)).toFixed(1)} MB`;

/** Choose the look of the board: the built-in one or an imported texture pack (decision 78). */
export function TexturesDialog({ store, onClose }: { store: ThemeStore; onClose(): void }) {
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [selection, setSelection] = useState<ActiveSelection>(NO_SELECTION);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<StoredPack | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const list = await store.list();
    setPacks(list);
    setSelection(normalizeSelection(await store.getSelection(), list));
  }, [store]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const list = await store.list();
      const current = normalizeSelection(await store.getSelection(), list);
      if (!live) return;
      setPacks(list);
      setSelection(current);
    })();
    return () => {
      live = false;
    };
  }, [store]);

  const inUse = (id: string) => selection.core === id || selection.expansions.includes(id);

  const report = (r: Change) => {
    if (r.message) setMessage({ text: r.message, bad: !r.ok });
    else setMessage(null);
  };

  const use = async (id: string) => {
    report(await applyPack(store, id));
    setDeleting(null);
    await refresh();
  };
  const stop = async (id: string) => {
    report(await stopPack(store, id));
    setDeleting(null);
    await refresh();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > PACK_MAX_BYTES + 1024 * 1024) {
      setMessage({
        text: t(
          'theme.TexturesDialog.thisFileIsToo',
          'This file is too big for a texture pack (about 10 MB at most).',
        ),
        bad: true,
      });
      return;
    }
    const r = readPack(new Uint8Array(await file.arrayBuffer()));
    if (!r.ok) {
      setMessage({ text: r.message, bad: true });
      return;
    }
    const replaced = packs.some((p) => p.id === r.pack.manifest.id);
    try {
      await store.save(r.pack);
    } catch {
      setMessage({
        text: t(
          'theme.TexturesDialog.theTexturePackCould',
          'The texture pack could not be stored on this device.',
        ),
        bad: true,
      });
      return;
    }
    // a replaced pack that is in use is loaded again, so the board shows the new pictures
    if (replaced && inUse(r.pack.manifest.id)) await refreshTheme(store);
    setMessage({
      text: `${replaced ? 'Updated' : 'Added'} ${r.pack.manifest.name}.`,
      bad: false,
    });
    await refresh();
  };

  // The list by family: each core pack, then the expansion packs made for it; expansion packs whose core
  // pack is not installed come last.
  const cores = packs.filter((p) => !p.box);
  const families: { pack: PackSummary; sub: boolean }[] = [];
  for (const c of cores) {
    families.push({ pack: c, sub: false });
    for (const e of packs.filter((p) => p.box && fits(p, c))) families.push({ pack: e, sub: true });
  }
  for (const e of packs.filter((p) => p.box && !cores.some((c) => fits(p, c))))
    families.push({ pack: e, sub: true });

  const packRow = (p: PackSummary, sub: boolean) => {
    // an expansion pack can be used only while the core pack it is made for is in use
    const needs = p.box ? expansionProblem(p, selection.core, packs) : null;
    return (
      <li key={p.id} data-pack={p.id} className={sub ? 'sub' : undefined}>
        <div className="fr-open-static">
          <span className="fr-qnum">
            {p.box
              ? t('theme.TexturesDialog.for', 'For {box}', { box: p.box })
              : t('theme.TexturesDialog.forTheCoreGame', 'Core pack')}{' '}
            ·{' '}
            {p.origin === 'official'
              ? t('theme.TexturesDialog.official', 'Official')
              : t('theme.TexturesDialog.fanMade', 'Fan-made')}
            {p.family
              ? ` · ${t('theme.TexturesDialog.family', 'Family {family}', { family: p.family })}`
              : ''}
            {p.author ? ` · ${p.author}` : ''} · {size(p.bytes)}
            {p.included
              ? ` · ${t('theme.TexturesDialog.includedWithTheApp', 'Included with the app')}`
              : ''}
          </span>
          <span className="fr-qtitle">{p.name}</span>
          {needs && !inUse(p.id) && (
            <span className="fr-qnote" data-testid={`needs-${p.id}`}>
              {needs}
            </span>
          )}
        </div>
        {inUse(p.id) ? (
          <>
            <span className="fr-qnote">{t('theme.TexturesDialog.inUse', 'In use')}</span>
            <button className="chip" onClick={() => void stop(p.id)}>
              {t('theme.TexturesDialog.stopUsingIt', 'Stop using it')}
            </button>
          </>
        ) : (
          <button className="chip" disabled={needs !== null} onClick={() => void use(p.id)}>
            {t('theme.TexturesDialog.use', 'Use')}
          </button>
        )}
        <button
          className="chip"
          data-testid={`preview-${p.id}`}
          onClick={async () => setPreviewing((await store.load(p.id)) ?? null)}
        >
          {t('theme.TexturesDialog.preview', 'Preview')}
        </button>
        <button
          className="chip"
          onClick={async () => {
            const pack = await store.load(p.id);
            if (pack) download(`${p.id}${PACK_EXTENSION}`, writePack(pack));
          }}
        >
          {t('theme.TexturesDialog.export', 'Export')}
        </button>
        {p.included ? null : deleting === p.id ? (
          <button
            className="chip main"
            onClick={async () => {
              report(await removePack(store, p.id));
              setDeleting(null);
              await refresh();
            }}
          >
            {t('theme.TexturesDialog.reallyDelete', 'Really delete')}
          </button>
        ) : (
          <button className="chip" onClick={() => setDeleting(p.id)}>
            {t('theme.TexturesDialog.delete', 'Delete')}
          </button>
        )}
      </li>
    );
  };

  return (
    <>
      <Dialog
        title={t('theme.TexturesDialog.texturePacks', 'Texture packs')}
        onClose={onClose}
        foot={
          <>
            <button className="btn alt" onClick={() => input.current?.click()}>
              {t('theme.TexturesDialog.importAPack', 'Import a pack')}
            </button>
            <button className="btn" onClick={onClose}>
              {t('theme.TexturesDialog.close', 'Close')}
            </button>
          </>
        }
      >
        <p className="fr-help">
          {t(
            'theme.TexturesDialog.aTexturePackChanges',
            'A texture pack changes how the board looks: floor, walls, doors, furniture and monster pictures. It never changes the rules or your saved games.',
          )}
        </p>
        <input
          ref={input}
          type="file"
          hidden
          accept={`${PACK_EXTENSION},application/zip`}
          aria-label={t('theme.TexturesDialog.texturePackFile', 'Texture pack file')}
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
        <p className="fr-help" data-testid="applied">
          {selectionLine(selection, packs) ??
            t('theme.TexturesDialog.builtInLook', 'Built-in look: no pack in use.')}
        </p>
        <ul className="fr-recent" data-testid="pack-list">
          <li>
            <div className="fr-open-static">
              <span className="fr-qnum">{t('theme.TexturesDialog.builtIn', 'Built in')}</span>
              <span className="fr-qtitle">{t('theme.TexturesDialog.classic', 'Classic')}</span>
            </div>
            {selection.core === null ? (
              <span className="fr-qnote">{t('theme.TexturesDialog.inUse', 'In use')}</span>
            ) : (
              <button className="chip" onClick={() => void stop(selection.core ?? '')}>
                {t('theme.TexturesDialog.useClassic', 'Use Classic')}
              </button>
            )}
          </li>
          {families.map(({ pack, sub }) => packRow(pack, sub))}
        </ul>
        {packs.length === 0 && (
          <p className="fr-help">
            {t(
              'theme.TexturesDialog.noTexturePackYet',
              'No texture pack yet. Import a {PACK_EXTENSION} file to add one.',
              { PACK_EXTENSION },
            )}
          </p>
        )}
      </Dialog>
      {previewing && (
        <PackPreview
          pack={previewing}
          onClose={() => setPreviewing(null)}
          onSave={async (manifest) => {
            const next: StoredPack = { ...previewing, manifest };
            try {
              await store.save(next);
            } catch {
              setMessage({
                text: t(
                  'theme.TexturesDialog.theChangesCouldNot',
                  'The changes could not be stored on this device.',
                ),
                bad: true,
              });
              return;
            }
            // a pack in use is loaded again, so the game shows the new sizes at once
            if (inUse(manifest.id)) await refreshTheme(store);
            setPreviewing(next);
            setMessage({
              text: t('theme.TexturesDialog.savedTheChangesTo', 'Saved the changes to {name}.', {
                name: manifest.name,
              }),
              bad: false,
            });
            await refresh();
          }}
        />
      )}
    </>
  );
}

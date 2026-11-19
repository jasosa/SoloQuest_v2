import { useCallback, useEffect, useRef, useState } from 'react';
import type { PackSummary, ThemeStore } from '../../persist/themes';
import { Dialog } from '../shared/Frame';
import { applyPack } from './activate';
import { PACK_EXTENSION, PACK_MAX_BYTES, readPack, writePack, type StoredPack } from './pack';
import { PackPreview } from './PackPreview';

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
  const [active, setActive] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<StoredPack | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setPacks(await store.list());
    setActive(await store.getActive());
  }, [store]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const list = await store.list();
      const current = await store.getActive();
      if (!live) return;
      setPacks(list);
      setActive(current);
    })();
    return () => {
      live = false;
    };
  }, [store]);

  const choose = async (id: string | null) => {
    await applyPack(store, id);
    setDeleting(null);
    await refresh();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > PACK_MAX_BYTES + 1024 * 1024) {
      setMessage({
        text: 'This file is too big for a texture pack (about 10 MB at most).',
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
      setMessage({ text: 'The texture pack could not be stored on this device.', bad: true });
      return;
    }
    // a replaced pack that is in use is loaded again, so the board shows the new pictures
    if (replaced && active === r.pack.manifest.id) await applyPack(store, r.pack.manifest.id);
    setMessage({
      text: `${replaced ? 'Updated' : 'Added'} ${r.pack.manifest.name}.`,
      bad: false,
    });
    await refresh();
  };

  return (
    <>
      <Dialog
        title="Texture packs"
        onClose={onClose}
        foot={
          <>
            <button className="btn alt" onClick={() => input.current?.click()}>
              Import a pack
            </button>
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        <p className="fr-help">
          A texture pack changes how the board looks: floor, walls, doors, furniture and monster
          pictures. It never changes the rules or your saved games.
        </p>
        <input
          ref={input}
          type="file"
          hidden
          accept={`${PACK_EXTENSION},application/zip`}
          aria-label="Texture pack file"
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
        <ul className="fr-recent" data-testid="pack-list">
          <li>
            <div className="fr-open-static">
              <span className="fr-qnum">Built in</span>
              <span className="fr-qtitle">Classic</span>
            </div>
            {active === null ? (
              <span className="fr-qnote">In use</span>
            ) : (
              <button className="chip" onClick={() => void choose(null)}>
                Use Classic
              </button>
            )}
          </li>
          {packs.map((p) => (
            <li key={p.id} data-pack={p.id}>
              <div className="fr-open-static">
                <span className="fr-qnum">
                  {p.box ? `For ${p.box}` : 'For the core game'} ·{' '}
                  {p.origin === 'official' ? 'Official' : 'Fan-made'}
                  {p.author ? ` · ${p.author}` : ''} · {size(p.bytes)}
                </span>
                <span className="fr-qtitle">{p.name}</span>
              </div>
              {active === p.id ? (
                <span className="fr-qnote">In use</span>
              ) : p.extends && !packs.some((x) => x.id === p.extends) ? (
                <span className="fr-qnote" data-testid={`needs-${p.id}`}>
                  Needs the pack {p.extends}
                </span>
              ) : (
                <button className="chip" onClick={() => void choose(p.id)}>
                  Use
                </button>
              )}
              <button
                className="chip"
                data-testid={`preview-${p.id}`}
                onClick={async () => setPreviewing((await store.load(p.id)) ?? null)}
              >
                Preview
              </button>
              <button
                className="chip"
                onClick={async () => {
                  const pack = await store.load(p.id);
                  if (pack) download(`${p.id}${PACK_EXTENSION}`, writePack(pack));
                }}
              >
                Export
              </button>
              {deleting === p.id ? (
                <button
                  className="chip main"
                  onClick={async () => {
                    if (active === p.id) await applyPack(store, null);
                    await store.remove(p.id);
                    setDeleting(null);
                    await refresh();
                  }}
                >
                  Really delete
                </button>
              ) : (
                <button className="chip" onClick={() => setDeleting(p.id)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
        {packs.length === 0 && (
          <p className="fr-help">No texture pack yet. Import a {PACK_EXTENSION} file to add one.</p>
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
              setMessage({ text: 'The changes could not be stored on this device.', bad: true });
              return;
            }
            // a pack in use is loaded again, so the game shows the new sizes at once
            if (active === manifest.id) await applyPack(store, manifest.id);
            setPreviewing(next);
            setMessage({ text: `Saved the changes to ${manifest.name}.`, bad: false });
            await refresh();
          }}
        />
      )}
    </>
  );
}

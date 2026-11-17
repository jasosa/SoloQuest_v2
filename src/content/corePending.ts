/**
 * The owner's Core changes that are not in the repository yet (decision 76): items taken out of
 * Core, kept on this device as a Core file. They apply at start, and "Export Core" puts them in
 * the file to drop into `src/content/library/`.
 */
import {
  CORE_FILE_FORMAT,
  type CoreFile,
  type CoreItem,
  type CoreKind,
} from '../engine/data/coreFile';

const KEY = 'soloquest-core-pending';

const empty = (): CoreFile => ({ format: CORE_FILE_FORMAT, items: [] });

export function readPending(): CoreFile {
  try {
    const raw = localStorage.getItem(KEY);
    const f = raw ? (JSON.parse(raw) as CoreFile) : undefined;
    if (f && f.format === CORE_FILE_FORMAT && Array.isArray(f.items)) return f;
  } catch {
    /* storage missing or broken: nothing is pending */
  }
  return empty();
}

function write(file: CoreFile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(file));
  } catch {
    /* ignore */
  }
}

/** Remember that an item was taken out of Core. */
export function addTombstone(kind: CoreKind, id: string, name: string): CoreFile {
  const keep = readPending().items.filter((i) => !(i.kind === kind && i.data.id === id));
  const next: CoreFile = {
    format: CORE_FILE_FORMAT,
    items: [...keep, { kind, deleted: true, data: { id, name } }],
  };
  write(next);
  return next;
}

export function clearPending(): void {
  write(empty());
}

/**
 * The file "Export Core" gives: what was taken out, the core items that were changed, and the
 * official items made in the library (with their expansion). Library items that are fan-made
 * stay out. `isCoreId` says if an id is a core item of that kind today.
 */
export function buildCoreExport(
  pending: CoreFile,
  library: readonly { kind: CoreKind; data: Record<string, unknown> }[],
  isCoreId: (kind: CoreKind, id: string) => boolean,
): CoreFile {
  const items: CoreItem[] = [...pending.items];
  for (const it of library) {
    const id = String(it.data.id);
    const changedCore = isCoreId(it.kind, id);
    if (!changedCore && it.data.origin !== 'official') continue;
    const { expansion, origin: _origin, ...rest } = it.data;
    void _origin;
    items.push({
      kind: it.kind,
      ...(typeof expansion === 'string' && expansion ? { expansion } : {}),
      data: { ...rest, id, name: String(it.data.name) },
    });
  }
  return { format: CORE_FILE_FORMAT, items };
}

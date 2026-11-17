/**
 * Which edited copy replaces which bundled quest in the quest list.
 * Kept in localStorage: a map from the bundled quest number to the id of a user quest.
 * The bundled quest files are never changed. Every access is wrapped: storage can be missing.
 */
const KEY = 'soloquest-quest-overrides';

export function getOverrides(): Record<number, string> {
  try {
    const raw = localStorage.getItem(KEY);
    const data: unknown = raw ? JSON.parse(raw) : {};
    const out: Record<number, string> = {};
    if (data && typeof data === 'object')
      for (const [k, v] of Object.entries(data)) if (typeof v === 'string') out[Number(k)] = v;
    return out;
  } catch {
    return {};
  }
}

function write(map: Record<number, string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable: the edit just does not replace the bundled quest */
  }
}

export function setOverride(number: number, userQuestId: string): void {
  write({ ...getOverrides(), [number]: userQuestId });
}

export function clearOverride(number: number): void {
  const map = getOverrides();
  delete map[number];
  write(map);
}

/**
 * What the quest list shows about past games: how many times a quest was played to its end and how
 * the last one went. Kept per quest on this device (localStorage). No scores, no heroes (decision 101).
 */
export type Result = 'won' | 'lost';

export interface QuestRecord {
  readonly plays: number;
  readonly last: Result;
  /** Milliseconds since 1970, of the last game. */
  readonly at: number;
}

const KEY = 'soloquest-history';
const listeners = new Set<() => void>();

function read(): Record<string, QuestRecord> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, QuestRecord>) : {};
  } catch {
    return {};
  }
}

let stored = read();

export function getRecord(questId: string): QuestRecord | undefined {
  const r = stored[questId];
  return r && typeof r.plays === 'number' ? r : undefined;
}

/** Put a record back as it was (undefined removes it). */
export function setRecord(questId: string, record: QuestRecord | undefined): void {
  const next = { ...stored };
  if (record) next[questId] = record;
  else delete next[questId];
  stored = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* storage unavailable: the record lasts until the page closes */
  }
  listeners.forEach((l) => l());
}

/** A game of this quest ended. Returns the record it replaced, for an Undo. */
export function addResult(questId: string, result: Result, at: number): QuestRecord | undefined {
  const before = getRecord(questId);
  setRecord(questId, { plays: (before?.plays ?? 0) + 1, last: result, at });
  return before;
}

export function onHistoryChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

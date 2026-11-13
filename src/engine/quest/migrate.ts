import { SCHEMA_VERSION } from './schema';

export class QuestVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestVersionError';
  }
}

/**
 * Bring raw quest data to the current schema version.
 * Stub: only version 1 exists. When version 2 arrives, add a step per version here.
 */
export function migrateQuest(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new QuestVersionError('Quest file must be a JSON object.');
  const v = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (v === undefined) throw new QuestVersionError('Quest file has no schemaVersion.');
  if (v !== SCHEMA_VERSION)
    throw new QuestVersionError(
      `Unsupported quest schemaVersion ${JSON.stringify(v)}. This app reads version ${SCHEMA_VERSION}.`,
    );
  return raw;
}

import { migrateQuest } from './migrate';
import { QuestSchema, type Quest } from './schema';

export class QuestParseError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(
      `Quest file is not valid (${issues.length} problem${issues.length === 1 ? '' : 's'}):\n` +
        issues.map((i) => `  - ${i}`).join('\n'),
    );
    this.name = 'QuestParseError';
    this.issues = issues;
  }
}

function pathText(path: PropertyKey[]): string {
  return path.length ? path.map(String).join('.') : '(root)';
}

/** Parse raw JSON data into a Quest. Throws QuestVersionError or QuestParseError with a readable message. */
export function parseQuest(data: unknown): Quest {
  const migrated = migrateQuest(data);
  const result = QuestSchema.safeParse(migrated);
  if (!result.success)
    throw new QuestParseError(
      result.error.issues.slice(0, 20).map((i) => `${pathText(i.path)}: ${i.message}`),
    );
  return result.data;
}

export const USER_QUEST_PREFIX = 'user-';

export function isUserQuestId(id: string): boolean {
  return /^user-[a-z0-9][a-z0-9-]*$/.test(id) && id.length <= 80;
}

/** `user-<slug of the title>`, made unique against `taken` with -2, -3... */
export function newUserQuestId(title: string, taken: Iterable<string> = []): string {
  const slug =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'quest';
  const used = new Set(taken);
  let id = `${USER_QUEST_PREFIX}${slug}`;
  for (let n = 2; used.has(id); n++) id = `${USER_QUEST_PREFIX}${slug}-${n}`;
  return id;
}

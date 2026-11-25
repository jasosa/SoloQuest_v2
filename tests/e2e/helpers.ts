import type { Page } from '@playwright/test';

/** Every quest opens with a "Start" message sheet (decision 67). Close it, as a player would. */
export async function dismissStart(page: Page): Promise<void> {
  const sheet = page.getByRole('dialog', { name: 'Start' });
  await page.locator('#board').waitFor();
  if (await sheet.isVisible()) await sheet.getByRole('button', { name: 'Continue' }).click();
}

/** Open a quest by URL and close its start sheet. */
export async function gotoQuest(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await dismissStart(page);
}

/** Open the Quest sheet from the title band (no-op when it is open). */
export async function openQuestSheet(page: Page): Promise<void> {
  const chip = page.getByTestId('quest-chip');
  if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
  await page.getByRole('dialog', { name: 'Quest sheet' }).waitFor();
}

export async function closeQuestSheet(page: Page): Promise<void> {
  const sheet = page.getByRole('dialog', { name: 'Quest sheet' });
  if (await sheet.isVisible()) await page.keyboard.press('Escape');
}

/** Open the end sheet (goal and ending) from the goal line of the title band. */
export async function openEndSheet(page: Page): Promise<void> {
  await page.getByTestId('goal-line').click();
  await page.getByRole('dialog', { name: 'Goal and ending' }).waitFor();
}

/** End the quest: open the end sheet, choose a way, answer the one confirmation. */
export async function endQuestWith(page: Page, way: string): Promise<void> {
  await openEndSheet(page);
  await page.getByRole('dialog').getByRole('button', { name: way, exact: true }).click();
  await page.getByTestId('end-confirm').click();
}

/** The quest card of a pack's quest page (Quest 1 is not Quest 10). */
export const questCard = (page: Page, number: number) =>
  page
    .locator('.qcard')
    .filter({ has: page.locator('.qnum', { hasText: new RegExp(`^Quest ${number}$`) }) });

/** From Home: Single Quest, the pack, the quest. Leaves the page where the heroes are chosen. */
export async function openQuest(
  page: Page,
  number: number,
  pack: 'core' | 'frozen-horror' = 'core',
): Promise<void> {
  await page.getByTestId('home-single').click();
  await page.getByTestId(`pack-${pack}`).click();
  await questCard(page, number).click();
  await page.getByTestId('choose-heroes').click();
}

/** From Home: Settings. */
export async function openSettings(page: Page): Promise<void> {
  await page.getByTestId('home-settings').click();
}

/** On the heroes page: choose the heroes and start (the quest, or a new game over a saved one). */
export async function newGame(page: Page, heroes: string[]): Promise<void> {
  for (const h of heroes) await page.getByRole('button', { name: h, exact: true }).click();
  await page.getByTestId('start-game').click();
}

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

import { expect, test } from '@playwright/test';

test.describe('the start flow: screenshots of the six screens', () => {
  test('screens', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.screenshot({ path: 'test-results/start-1-home.png' });
    await page.getByTestId('home-single').click();
    await page.screenshot({ path: 'test-results/start-2-single-packs.png' });
    await page.getByTestId('pack-frozen-horror').click();
    await page.screenshot({ path: 'test-results/start-3-single-quests.png' });
    await page.locator('.qcard', { hasText: 'Quest 1' }).click();
    await page.screenshot({ path: 'test-results/start-3b-quest-start.png' });
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    await page.getByTestId('home-campaign').click();
    await page.screenshot({ path: 'test-results/start-4-campaign-packs.png' });
    await page.getByTestId('pack-frozen-horror').click();
    await page.screenshot({ path: 'test-results/start-6-campaign-heroes.png' });
    await expect(page.getByTestId('start-game')).toBeDisabled();
  });
});

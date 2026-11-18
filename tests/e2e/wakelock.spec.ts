import { expect, test } from '@playwright/test';
import { newGame } from './helpers';

declare global {
  interface Window {
    __wl: { requests: number; releases: number };
  }
}

test.describe('wake lock (M8)', () => {
  test.beforeEach(async ({ page }) => {
    // a stand-in for the Screen Wake Lock API that counts what the app asks
    await page.addInitScript(() => {
      window.__wl = { requests: 0, releases: 0 };
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            window.__wl.requests += 1;
            const lock = {
              released: false,
              release: async () => {
                lock.released = true;
                window.__wl.releases += 1;
              },
            };
            return lock;
          },
        },
      });
    });
  });

  test('the screen is kept awake while a quest is played, and let go when leaving it', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    expect(await page.evaluate(() => window.__wl.requests)).toBe(0); // not on the select screen
    await newGame(page, ['Dwarf']);
    await expect.poll(() => page.evaluate(() => window.__wl.requests)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Continue' }).click();
    const held = await page.evaluate(() => window.__wl.requests - window.__wl.releases);
    expect(held).toBe(1); // exactly one lock is held
    await page
      .getByRole('link', { name: 'Quests' })
      .or(page.getByRole('button', { name: 'Quests' }))
      .click();
    await expect(page.getByTestId('new-game')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.__wl.requests - window.__wl.releases))
      .toBe(0);
  });

  test('a browser without the API, or one that refuses it, plays on', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: { request: async () => Promise.reject(new Error('refused')) },
      });
    });
    await page.goto('/?nosave=1');
    await newGame(page, ['Dwarf']);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#board')).toBeVisible();
  });
});

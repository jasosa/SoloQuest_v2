import { expect, test } from '@playwright/test';

test.describe('editor polish (M8)', () => {
  test('an empty title is refused and the field goes back to the title of the quest', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^New quest/ }).click();
    await page.getByLabel('Title').first().fill('The Cellar');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    const title = page.getByTestId('quest-general').getByLabel('Title');
    await title.fill('');
    await title.blur();
    await expect(title).toHaveValue('The Cellar');
    await expect(page.locator('header.page-head h1')).toHaveText('The Cellar');
  });

  test('when this device cannot store a quest, the start screen says so', async ({ page }) => {
    // no IndexedDB: storing fails
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
    });
    await page.goto('/?editor=1');
    await page.getByRole('button', { name: /^New quest/ }).click();
    await page.getByLabel('Title').first().fill('Nowhere');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    const err = page.getByTestId('store-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('could not be stored');
    await expect(err).toContainText('Export');
  });

  test('when the draft cannot be kept, the editor says so', async ({ page }) => {
    await page.goto('/?editor=1');
    await page.getByRole('button', { name: /^New quest/ }).click();
    await page.getByLabel('Title').first().fill('Draft quest');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    await expect(page.locator('header.page-head h1')).toHaveText('Draft quest');
    await expect(page.locator('.ed-nostore')).toHaveCount(0);
    // from now on the browser refuses to write
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = function () {
        throw new DOMException('full', 'QuotaExceededError');
      };
    });
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    const title = page.getByTestId('quest-general').getByLabel('Title');
    await title.fill('Draft quest 2');
    await title.blur();
    await expect(page.locator('.ed-nostore')).toContainText('cannot keep a draft');
    await expect(page.locator('.ed-nostore')).toHaveAttribute('role', 'alert');
  });

  test('the file chooser shows keyboard focus', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^Open quest/ }).click();
    const input = page.getByLabel('Choose a .hqquest.json file').or(page.locator('.es-file input'));
    await input.first().focus();
    const outline = await page
      .locator('.es-file')
      .evaluate(
        (el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth,
      );
    expect(outline).toBe('solid 2px');
  });
});

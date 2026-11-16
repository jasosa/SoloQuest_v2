import { expect, test, type Page } from '@playwright/test';
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `test-results/${name}.png` });
};

// A 1 x 1 red png, enough to test the picture flow.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function open(page: Page) {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: 'Designer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
}

test.describe('designer: the library', () => {
  test('make an ability, a spell and an enemy that uses them; they are listed', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('button', { name: /^Abilities/ }).click();
    await page.getByRole('button', { name: 'New ability' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Bog skin');
    await page.getByLabel('What it does').fill('Mud spells fail on it.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('dz-message')).toHaveText('Saved to the library.');
    await expect(page.getByRole('button', { name: 'Bog skin' })).toBeVisible();

    await page.getByRole('button', { name: /^Spells/ }).click();
    await page.getByRole('button', { name: 'New spell' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Mud');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mud' })).toBeVisible();

    await page.getByRole('button', { name: /^Enemies/ }).click();
    await page.getByRole('button', { name: 'New enemy' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Marsh Orc');
    await page.getByLabel('Behaves like').selectOption('orc');
    await page.getByLabel('Letter (1 or 2)').fill('M');
    await page.getByLabel('att').fill('4');
    await page.getByLabel('Add to Abilities').selectOption('bog-skin');
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await expect(
      page.getByTestId('dz-list-abilities').locator('[data-id="bog-skin"]'),
    ).toBeVisible();
    await page.getByLabel('Add to Spells').selectOption('mud');
    await page.getByRole('button', { name: 'Add', exact: true }).last().click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Marsh Orc' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Enemies \(1\)/ })).toBeVisible();
    await shot(page, 'designer-enemy');
  });

  test('a picture is shrunk and shown; Save is off until the item is valid', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /^Heroes/ }).click();
    await page.getByRole('button', { name: 'New hero' }).click();
    await page
      .getByTestId('dz-file')
      .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('dz-pic')).toBeVisible();
    await page.getByLabel('Name', { exact: true }).fill('');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await page.getByLabel('Name', { exact: true }).fill('Knight');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Knight' }).locator('img')).toBeVisible();
    await page.getByRole('button', { name: 'Remove picture' }).click();
    await expect(page.getByTestId('dz-pic')).toHaveCount(0);
  });

  test('delete, and import a library file', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /^Companions/ }).click();
    await page.getByRole('button', { name: 'New companion' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Delete companion' }).click();
    await expect(page.getByRole('button', { name: /^Companions \(0\)/ })).toBeVisible();

    const file = JSON.stringify({
      format: 'soloquest-library',
      version: 1,
      items: [
        { kind: 'ability', data: { id: 'x', name: 'Imported', text: 'Fine.' } },
        { kind: 'ability', data: { id: 'bad' } },
      ],
    });
    await page.getByTestId('dz-import').setInputFiles({
      name: 'lib.json',
      mimeType: 'application/json',
      buffer: Buffer.from(file),
    });
    await expect(page.getByTestId('dz-message')).toContainText('1 added');
    await expect(page.getByTestId('dz-message')).toContainText('1 skipped');
    await page.getByRole('button', { name: /^Abilities/ }).click();
    await expect(page.getByRole('button', { name: 'Imported' })).toBeVisible();
  });
});

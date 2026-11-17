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

const lib = (page: Page) => page.getByTestId('dz-library');
const items = (page: Page) => page.getByTestId('dz-items');
const card = (page: Page) => page.getByTestId('dz-card');

async function open(page: Page) {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^DESIGNER/ }).click();
  await expect(page.getByRole('tab', { name: 'Designer' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
}
const kind = (page: Page, name: RegExp) => lib(page).getByRole('button', { name }).click();
const make = (page: Page, one: string) =>
  items(page)
    .getByRole('button', { name: `New ${one}`, exact: true })
    .click();
const name = (page: Page, v: string) => card(page).getByLabel('Name', { exact: true }).fill(v);

test.describe('designer: the library', () => {
  test('core items are listed and can be changed, and reset; Copy makes one of your own', async ({
    page,
  }) => {
    await open(page);
    await expect(lib(page).getByRole('button', { name: /^Enemies \(9 core\)/ })).toBeVisible();
    await expect(lib(page).getByRole('button', { name: /^Heroes \(4 core\)/ })).toBeVisible();
    await items(page).getByRole('button', { name: 'Orc', exact: true }).click();
    await expect(page.getByLabel('Source')).toContainText('Core (you can change it)');
    await expect(page.getByLabel('att', { exact: true })).toHaveValue('3');
    await shot(page, 'designer-core-enemy');
    // change a core enemy: it is marked as changed, and can be reset
    await page.getByLabel('att', { exact: true }).fill('5');
    await expect(items(page).getByRole('button', { name: /^Orc/ })).toContainText('changed');
    await expect(page.getByLabel('Source')).toContainText('Core (changed)');
    await page.getByRole('button', { name: 'Reset to core' }).click();
    await expect(page.getByLabel('att', { exact: true })).toHaveValue('3');
    await expect(items(page).getByRole('button', { name: /^Orc/ })).not.toContainText('changed');
    // a core hero can be renamed
    await kind(page, /^Heroes/);
    await items(page).getByRole('button', { name: 'Elf', exact: true }).click();
    await name(page, 'Elf of the Wood');
    await expect(items(page).getByRole('button', { name: /^Elf of the Wood/ })).toBeVisible();
    await kind(page, /^Enemies/);
    await items(page).getByRole('button', { name: 'Orc', exact: true }).click();
    await items(page).getByRole('button', { name: 'Copy', exact: true }).click();
    await expect(card(page).getByLabel('Name', { exact: true })).toHaveValue('Orc copy');
    await expect(lib(page).getByRole('button', { name: /^Enemies \(9 core · 1\)/ })).toBeVisible();
  });

  test('make an ability, a spell and an enemy that uses them', async ({ page }) => {
    await open(page);
    await kind(page, /^Abilities/);
    await make(page, 'ability');
    await name(page, 'Bog skin');
    await card(page).getByLabel('What it does').fill('Mud spells fail on it.');
    await expect(items(page).getByRole('button', { name: 'Bog skin' })).toBeVisible();

    await kind(page, /^Spells/);
    await make(page, 'spell');
    await name(page, 'Mud');
    await expect(items(page).getByRole('button', { name: 'Mud', exact: true })).toBeVisible();

    await kind(page, /^Enemies/);
    await make(page, 'enemy');
    await name(page, 'Marsh Orc');
    await card(page).getByLabel('Starts from').selectOption('orc');
    await page.getByLabel('Letter (1 or 2)').fill('M');
    await page.getByLabel('att', { exact: true }).fill('4');
    await page.getByLabel('Add an ability').selectOption({ label: 'Bog skin' });
    await page.getByRole('button', { name: 'Add the ability' }).click();
    await expect(
      page.getByTestId('dz-abilities').getByText('Mud spells fail on it.'),
    ).toBeVisible();
    await page.getByLabel('Add a spell').selectOption({ label: 'Mud' });
    await page.getByRole('button', { name: 'Add the spell' }).click();
    await expect(
      page.getByTestId('dz-spells').getByText('Mud', { exact: true }).first(),
    ).toBeVisible();
    await expect(items(page).getByRole('button', { name: 'Marsh Orc' })).toBeVisible();
    await expect(lib(page).getByRole('button', { name: /^Enemies \(9 core · 1\)/ })).toBeVisible();
    await shot(page, 'designer-enemy');
  });

  test('New ability… in an enemy opens the popup and saves to the library', async ({ page }) => {
    await open(page);
    await make(page, 'enemy');
    await page.getByRole('button', { name: 'New ability…' }).click();
    const dlg = page.getByRole('dialog', { name: 'Ability' });
    await dlg.getByLabel('Name').fill('Quick feet');
    await dlg.getByLabel('What it does').fill('Moves twice as far.');
    await dlg.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('dz-abilities').getByText('Quick feet')).toBeVisible();
    await kind(page, /^Abilities/);
    await expect(items(page).getByRole('button', { name: 'Quick feet' })).toBeVisible();
  });

  test('a picture is shrunk and shown; hero and companion cards', async ({ page }) => {
    await open(page);
    await kind(page, /^Heroes/);
    await make(page, 'hero');
    await page
      .getByTestId('dz-file')
      .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('dz-pic')).toBeVisible();
    await name(page, 'Knight');
    await expect(items(page).getByRole('button', { name: 'Knight' }).locator('img')).toBeVisible();
    await page.getByRole('button', { name: 'Remove picture' }).click();
    await expect(page.getByTestId('dz-pic')).toHaveCount(0);
    await kind(page, /^Companions/);
    await make(page, 'companion');
    await expect(card(page).getByLabel('defend')).toHaveValue('2');
  });

  test('delete, and import a library file', async ({ page }) => {
    await open(page);
    await kind(page, /^Companions/);
    await make(page, 'companion');
    await page.getByRole('button', { name: 'Delete companion' }).click();
    await expect(lib(page).getByRole('button', { name: /^Companions \(0\)/ })).toBeVisible();
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
    await kind(page, /^Abilities/);
    await expect(items(page).getByRole('button', { name: 'Imported' })).toBeVisible();
  });

  test('use the library in a quest: an enemy on a monster, an ability from the library, save an ability', async ({
    page,
  }) => {
    await open(page);
    await kind(page, /^Abilities/);
    await make(page, 'ability');
    await name(page, 'Bog skin');
    await card(page).getByLabel('What it does').fill('Mud spells fail on it.');
    await kind(page, /^Enemies/);
    await make(page, 'enemy');
    await name(page, 'Marsh Skeleton');
    await card(page).getByLabel('Starts from').selectOption('skeleton');
    await page.getByLabel('Letter (1 or 2)').fill('M');
    await page.getByRole('button', { name: 'Back', exact: true }).click();

    await page.getByRole('button', { name: /^NEW QUEST/ }).click();
    await page.getByLabel('Title').first().fill('Marsh');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    await page.locator('.ed-tools').getByRole('button', { name: 'Monsters', exact: true }).click();
    const box = (await page.locator('#editor-board').boundingBox())!;
    const k = box.width / (26 * 34 + 4);
    const at = (x: number, y: number) => ({
      x: box.x + ((x + 0.5) * 34 + 2) * k,
      y: box.y + ((y + 0.5) * 34 + 2) * k,
    });
    await page.mouse.click(at(4, 17).x, at(4, 17).y);
    await page.locator('.ed-tools').getByRole('button', { name: 'Select', exact: true }).click();
    await page.mouse.click(at(4, 17).x, at(4, 17).y);
    // a monster is edited in the Monsters tab
    await page.getByRole('tab', { name: 'Monsters' }).click();
    const insp = page.getByRole('tabpanel').or(page.locator('.fr-frame'));

    await insp.getByLabel('Enemy', { exact: true }).selectOption({ label: 'Marsh Skeleton' });
    await expect(page.getByTestId('monster-list')).toContainText('Skeleton');
    await expect(insp.getByTestId('monster-enemy')).toContainText('letter M');
    const abilities = page.getByTestId('monster-abilities');
    await abilities.getByLabel('Add an ability').selectOption({ label: 'Bog skin' });
    await abilities.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(abilities.locator('[data-ability]')).toBeVisible();
    await abilities.getByRole('button', { name: 'New ability…' }).click();
    await page.getByRole('dialog', { name: 'Ability' }).getByLabel('Name').fill('Quick feet');
    await page.getByRole('dialog', { name: 'Ability' }).getByLabel('Name').blur();
    await page.getByTestId('save-in-library').click();
    await expect(page.getByText('Saved in the library.')).toBeVisible();
  });

  test('a custom enemy is in the Monsters tool and can be added from the Monsters tab, with its stats', async ({
    page,
  }) => {
    await open(page);
    await kind(page, /^Enemies/);
    await make(page, 'enemy');
    await name(page, 'Marsh Skeleton');
    await card(page).getByLabel('Starts from').selectOption('skeleton');
    await page.getByLabel('att', { exact: true }).fill('4');
    await page.getByLabel('Letter (1 or 2)').fill('M');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: /^NEW QUEST/ }).click();
    await page.getByLabel('Title').first().fill('Marsh');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();

    // on the map: the custom monster is a chip next to the core types
    await page.locator('.ed-tools').getByRole('button', { name: 'Monsters', exact: true }).click();
    const chips = page.getByTestId('custom-monsters');
    await expect(chips).toContainText('Marsh Skeleton');
    await chips.getByRole('button', { name: /Marsh Skeleton/ }).click();
    const box = (await page.locator('#editor-board').boundingBox())!;
    const k = box.width / (26 * 34 + 4);
    await page.mouse.click(box.x + ((4 + 0.5) * 34 + 2) * k, box.y + ((17 + 0.5) * 34 + 2) * k);

    // in the Monsters tab: it is a Marsh Skeleton, and its stats show the enemy's attack
    await page.getByRole('tab', { name: 'Monsters' }).click();
    await expect(page.getByTestId('monster-list')).toContainText('Marsh Skeleton');
    await page.getByTestId('monster-list').getByRole('button').first().click();
    await expect(page.getByTestId('monster-card').getByLabel('att', { exact: true })).toHaveValue(
      '4',
    );
    // the board token has the enemy's letter, not the skeleton's
    await page.getByRole('tab', { name: 'Map' }).click();
    await expect(page.locator('[data-monster="m1"]')).toContainText('M');
    await page.getByRole('tab', { name: 'Monsters' }).click();

    // and the list adds one too, from the same menu
    await page.getByLabel('Monster to add').selectOption({ label: 'Marsh Skeleton' });
    await page
      .getByTestId('monster-list')
      .getByRole('button', { name: 'Add', exact: true })
      .click();
    await expect(page.getByTestId('monster-list').locator('li')).toHaveCount(2);
  });

  test('an enemy can be completely its own: stats, plan, weights and a picture, shown on the map', async ({
    page,
  }) => {
    await open(page);
    await kind(page, /^Enemies/);
    await make(page, 'enemy');
    await name(page, 'Slime');
    await card(page).getByLabel('Starts from').selectOption('');
    for (const [stat, v] of [
      ['move', '4'],
      ['att', '2'],
      ['def', '1'],
      ['body', '6'],
      ['mind', '0'],
    ] as const)
      await page.getByLabel(stat, { exact: true }).fill(v);
    await page.getByLabel('Plan').selectOption('relentless');
    await page.getByLabel('Weight: lowestBody').fill('3');
    await page.getByLabel('Weight: closest').fill('1');
    await page
      .getByTestId('dz-file')
      .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('dz-pic')).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();

    await page.getByRole('button', { name: /^NEW QUEST/ }).click();
    await page.getByLabel('Title').first().fill('Slime quest');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    await page.locator('.ed-tools').getByRole('button', { name: 'Monsters', exact: true }).click();
    await page.getByTestId('custom-monsters').getByRole('button', { name: /Slime/ }).click();
    const box = (await page.locator('#editor-board').boundingBox())!;
    const k = box.width / (26 * 34 + 4);
    await page.mouse.click(box.x + ((4 + 0.5) * 34 + 2) * k, box.y + ((17 + 0.5) * 34 + 2) * k);
    // the picture is on the editor token
    await expect(page.locator('[data-monster="m1"] [data-token-image="m1"]')).toHaveCount(1);
    // the Monsters tab shows its own stats and no type to pick
    await page.getByRole('tab', { name: 'Monsters' }).click();
    await page.getByTestId('monster-list').getByRole('button').first().click();
    await expect(page.getByTestId('monster-card').getByLabel('body', { exact: true })).toHaveValue(
      '6',
    );
    await expect(page.getByTestId('monster-card').getByLabel('Type')).toHaveCount(0);
  });
});

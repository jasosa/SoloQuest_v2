import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const lib = (page: Page) => page.getByTestId('dz-library');
const items = (page: Page) => page.getByTestId('dz-items');
const card = (page: Page) => page.getByTestId('dz-card');

async function open(page: Page) {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^LIBRARY/ }).click();
  await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
}
const kind = (page: Page, name: RegExp) => lib(page).getByRole('button', { name }).click();
const make = (page: Page, one: string) =>
  items(page)
    .getByRole('button', { name: `New ${one}`, exact: true })
    .click();
const name = (page: Page, v: string) => card(page).getByLabel('Name', { exact: true }).fill(v);
const ownerMode = (page: Page) => page.getByRole('switch', { name: /Owner mode/ });

test.describe('Library layers (decision 76)', () => {
  test('a switch shows one layer at a time; a new item is in My library', async ({ page }) => {
    await open(page);
    await kind(page, /^Enemies/);
    // Core first
    await expect(page.getByTestId('dz-scope-core')).toHaveAttribute('aria-pressed', 'true');
    await expect(items(page).getByRole('button', { name: /^Orc/ })).toBeVisible();
    await page.getByTestId('dz-scope-mine').click();
    await expect(items(page).getByRole('button', { name: /^Orc/ })).toHaveCount(0);
    await expect(items(page)).toContainText('Nothing of your own yet.');
    // a new item goes to My library and the list shows that layer
    await make(page, 'enemy');
    await name(page, 'Slime');
    await expect(page.getByTestId('dz-scope-mine')).toHaveAttribute('aria-pressed', 'true');
    await expect(items(page).getByRole('button', { name: /^Slime/ })).toBeVisible();
    await expect(page.getByTestId('dz-scope-mine')).toContainText('1');
    // back to Core: it is not listed there, and nothing stays selected
    await page.getByTestId('dz-scope-core').click();
    await expect(items(page).getByRole('button', { name: /^Slime/ })).toHaveCount(0);
    await expect(card(page)).toHaveCount(0);
    // the switch buttons are big enough for a finger
    for (const id of ['dz-scope-core', 'dz-scope-mine']) {
      expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('a Core item is read only: "Edit a copy" makes one in My library to change', async ({
    page,
  }) => {
    await open(page);
    await ownerMode(page).click(); // off: a normal person
    await kind(page, /^Enemies/);
    await items(page).getByRole('button', { name: /^Orc/ }).click();
    await expect(page.getByTestId('dz-readonly')).toContainText('read only');
    await expect(page.getByLabel('att', { exact: true })).toBeDisabled();
    await page.getByTestId('dz-edit-copy').click();
    // now in My library, the copy is selected and can be changed
    await expect(page.getByTestId('dz-scope-mine')).toHaveAttribute('aria-pressed', 'true');
    await expect(items(page).getByRole('button', { name: /^Orc copy/ })).toBeVisible();
    await expect(page.getByTestId('dz-readonly')).toHaveCount(0);
    await page.getByLabel('att', { exact: true }).fill('9');
    await expect(page.getByLabel('att', { exact: true })).toHaveValue('9');
    // the Core orc is as it was
    await page.getByTestId('dz-scope-core').click();
    await items(page).getByRole('button', { name: /^Orc/ }).click();
    await expect(page.getByLabel('att', { exact: true })).not.toHaveValue('9');
  });

  test('an expansion can be switched off for the add menus; quests that use it keep working', async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByTestId('dz-expansions')).toContainText('Frozen Horror');
    // the owner makes an official enemy of an expansion
    await kind(page, /^Enemies/);
    await make(page, 'enemy');
    await name(page, 'Frosty');
    await page.getByLabel('Origin', { exact: true }).selectOption('official');
    await page.getByLabel('Expansion', { exact: true }).fill('Test pack');
    const toggle = page.getByRole('switch', { name: /Test pack in the add menus/ });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // a quest that uses it
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: /^NEW QUEST/ }).click();
    await page.getByLabel('Title').first().fill('Frost quest');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    await page.locator('.ed-tools').getByRole('button', { name: 'Monsters', exact: true }).click();
    const chips = page.getByTestId('custom-monsters');
    await expect(chips.getByRole('button', { name: /Frosty/ })).toBeVisible();
    await chips.getByRole('button', { name: /Frosty/ }).click();
    const box = (await page.locator('#editor-board').boundingBox())!;
    const k = box.width / (26 * 34 + 4);
    await page.mouse.click(box.x + ((4 + 0.5) * 34 + 2) * k, box.y + ((17 + 0.5) * 34 + 2) * k);
    await expect(page.locator('[data-monster]')).toHaveCount(1);

    // switch the expansion off: the quest keeps its monster and its own copy of the enemy
    await page.getByRole('tab', { name: 'Library' }).click();
    await page.getByRole('switch', { name: /Test pack in the add menus/ }).click();
    await page.getByRole('tab', { name: 'Map' }).click();
    await page.locator('.ed-tools').getByRole('button', { name: 'Monsters', exact: true }).click();
    await expect(page.locator('[data-monster]')).toHaveCount(1);
    await expect(chips.getByRole('button', { name: /Frosty/ })).toBeVisible();
    // a new quest does not offer it
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: /^NEW QUEST/ }).click();
    await page.getByLabel('Title').first().fill('Second quest');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    await page.locator('.ed-tools').getByRole('button', { name: 'Monsters', exact: true }).click();
    await expect(
      page.getByTestId('custom-monsters').getByRole('button', { name: /Frosty/ }),
    ).toHaveCount(0);
    // and the Library screen still lists it
    await page.getByRole('tab', { name: 'Library' }).click();
    await kind(page, /^Enemies/);
    await page.getByTestId('dz-scope-mine').click();
    await expect(items(page).getByRole('button', { name: /^Frosty/ })).toBeVisible();
  });

  test('My library goes out as a pack file with a name and author, and comes in as fan-made', async ({
    page,
  }) => {
    await open(page);
    await kind(page, /^Enemies/);
    await make(page, 'enemy');
    await name(page, 'Slime');
    await kind(page, /^Abilities/);
    await make(page, 'ability');
    await name(page, 'Sticky');
    // the pack dialog asks for a name
    await page.getByTestId('dz-export-pack').click();
    const dlg = page.getByRole('dialog', { name: 'Share my library as a pack' });
    await dlg.getByLabel('Name of the pack').fill('');
    await expect(dlg.getByTestId('dz-pack-save')).toBeDisabled();
    await dlg.getByLabel('Name of the pack').fill('Swamp things');
    await dlg.getByLabel('Author').fill('Someone');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dlg.getByTestId('dz-pack-save').click(),
    ]);
    expect(download.suggestedFilename()).toBe('swamp-things.sqlibrary.json');
    const file = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    expect(file.name).toBe('Swamp things');
    expect(file.author).toBe('Someone');
    // only what was made: no Core item (the nine monsters, the core abilities) is in it
    const listed = file.items.map(
      (i: { kind: string; data: { name: string } }) => `${i.kind}:${i.data.name}`,
    );
    expect(listed.sort()).toEqual(['ability:Sticky', 'enemy:Slime']);
    await expect(dlg).toHaveCount(0);

    // someone else imports a pack that calls its items official: without owner mode it is fan-made
    await ownerMode(page).click();
    const official = JSON.stringify({
      format: 'soloquest-library',
      version: 1,
      name: 'Pretend official',
      author: 'Mallory',
      items: [
        {
          kind: 'enemy',
          data: { id: 'ghoul', name: 'Ghoul', base: 'zombie', letter: 'G', origin: 'official' },
        },
      ],
    });
    await page.getByTestId('dz-import').setInputFiles({
      name: 'pack.sqlibrary.json',
      mimeType: 'application/json',
      buffer: Buffer.from(official),
    });
    await expect(page.getByTestId('dz-message')).toContainText(
      '"Pretend official" by Mallory: 1 added',
    );
    await kind(page, /^Enemies/);
    await page.getByTestId('dz-scope-mine').click();
    await expect(items(page).getByRole('button', { name: /^Ghoul/ })).toContainText('fan-made');
  });
});

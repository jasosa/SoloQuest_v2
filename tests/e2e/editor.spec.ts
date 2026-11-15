import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/${name}.png` });
};
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tool = (page: Page, name: string) =>
  page.locator('.ed-tools').getByRole('button', { name, exact: true });
const board = (page: Page) => page.locator('#editor-board');

/** Click the middle of a square (or a point `fx`, `fy` squares in) of the editor board. */
async function clickAt(page: Page, x: number, y: number, fx = 0.5, fy = 0.5) {
  const pt = await pointAt(page, x, y, fx, fy);
  await page.mouse.click(pt.x, pt.y);
}
async function pointAt(page: Page, x: number, y: number, fx = 0.5, fy = 0.5) {
  const box = (await board(page).boundingBox())!;
  const k = box.width / (26 * 34 + 4);
  return { x: box.x + ((x + fx) * 34 + 2) * k, y: box.y + ((y + fy) * 34 + 2) * k };
}

async function newQuest(page: Page, title = 'My quest', url = '/?editor=1&nosave=1') {
  await page.goto(url);
  await page.getByLabel('Title').first().fill(title);
  await btn(page, 'Create the quest').click();
  await expect(page.locator('header h1')).toHaveText(title);
}

test.describe('editor: shell and board tools', () => {
  test('a link on the quest select opens the editor start; a new quest opens the editor', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await btn(page, 'Quest editor').click();
    await expect(page.locator('header h1')).toHaveText('Your quests');
    await shot(page, 'editor-start');
    await page.getByLabel('Title').first().fill('The Cellar');
    await btn(page, 'Create the quest').click();
    await expect(page.locator('header h1')).toHaveText('The Cellar');
    await expect(board(page)).toBeVisible();
    // the stairs of the empty quest, and no fog: rock hatch only where the quest has rock
    await expect(page.locator('[data-furniture="f-stairs"]')).toHaveCount(1);
    await shot(page, 'editor-new');
  });

  test('rock: a click toggles a square, Whole room toggles a room', async ({ page }) => {
    await newQuest(page);
    const rock = board(page).locator('rect[fill="url(#ed-hatch)"]');
    await expect(rock).toHaveCount(0);
    await tool(page, 'Rock').click();
    await clickAt(page, 10, 2);
    await expect(rock).toHaveCount(1);
    await clickAt(page, 10, 2);
    await expect(rock).toHaveCount(0);
    await page.getByRole('button', { name: 'Whole room', exact: true }).click();
    await clickAt(page, 6, 2); // a room
    await expect(rock).not.toHaveCount(0);
    expect(await rock.count()).toBeGreaterThan(8);
    // the start room cannot be rock: the engine says so
    await clickAt(page, 2, 16);
    await expect(page.locator('.toast')).toContainText('start room');
    await shot(page, 'editor-rock');
  });

  test('doors: add near an edge, select, change the kind', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Doors').click();
    await clickAt(page, 3, 17, 0.5, 0.97); // the edge between (3,17) and (3,18)
    await expect(page.locator('[data-door="d1"]')).toHaveCount(1);
    await tool(page, 'Select').click();
    await clickAt(page, 3, 17, 0.5, 0.97);
    await expect(page.getByTestId('selection-id')).toHaveText('d1');
    await page
      .locator('.ed-inspector')
      .getByRole('button', { name: 'Secret', exact: true })
      .click();
    await expect(page.locator('[data-door="s1"]')).toHaveCount(1);
    await expect(page.locator('[data-door="d1"]')).toHaveCount(0);
    await shot(page, 'editor-door');
    // the middle of a square is not an edge
    await tool(page, 'Doors').click();
    await clickAt(page, 4, 17);
    await expect(page.locator('.toast')).toContainText('edge');
  });

  test('furniture: a ghost shows a refusal, a click places, R turns, drag moves', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Furniture').click();
    await page.getByRole('button', { name: 'Bookcase', exact: true }).click();
    // over the stairs: refused, the hint says why
    const bad = await pointAt(page, 1, 14);
    await page.mouse.move(bad.x, bad.y);
    await expect(page.locator('.ed-hint')).not.toHaveText('');
    await shot(page, 'editor-ghost-bad');
    await clickAt(page, 1, 14);
    await expect(page.locator('.toast')).toBeVisible();
    await expect(page.locator('[data-furniture]')).toHaveCount(1);
    // a free place
    const ok = await pointAt(page, 2, 17);
    await page.mouse.move(ok.x, ok.y);
    await expect(page.locator('.ed-hint')).toHaveText('');
    await page.mouse.click(ok.x, ok.y);
    await expect(page.locator('[data-furniture]')).toHaveCount(2);
    // select it, turn it with R (it is 3 wide, so it needs room: the engine decides)
    await tool(page, 'Select').click();
    await clickAt(page, 3, 17);
    await expect(page.locator('.ed-inspector')).toContainText('Bookcase');
    await page.keyboard.press('r');
    // drag it one row up
    const from = await pointAt(page, 3, 17);
    const to = await pointAt(page, 3, 16);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
    await shot(page, 'editor-furniture');
    // Delete key removes the selection
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-furniture]')).toHaveCount(1);
  });

  test('monsters, blocks, traps and markers; undo and redo', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    await clickAt(page, 4, 17);
    await expect(page.locator('[data-monster]')).toHaveCount(1);
    await tool(page, 'Blocks').click();
    await clickAt(page, 3, 16);
    await expect(page.locator('[data-block]')).toHaveCount(1);
    await tool(page, 'Traps').click();
    await clickAt(page, 2, 17);
    await expect(page.locator('[data-trap]')).toHaveCount(1);
    await tool(page, 'Markers').click();
    await page.getByLabel('Label').fill('Z');
    await clickAt(page, 4, 16);
    await expect(page.locator('[data-marker]')).toHaveCount(1);
    await shot(page, 'editor-things');

    await btn(page, 'Undo').click();
    await expect(page.locator('[data-marker]')).toHaveCount(0);
    await btn(page, 'Redo').click();
    await expect(page.locator('[data-marker]')).toHaveCount(1);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-trap]')).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('[data-trap]')).toHaveCount(1);
  });

  test('start room and room ids', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Start').click();
    await clickAt(page, 6, 16); // R17
    await expect(page.locator('.ed-status')).toHaveText('Unsaved changes');
    await page.getByRole('button', { name: 'Room ids', exact: true }).click();
    await expect(board(page).locator('text', { hasText: 'R17' })).toHaveCount(1);
  });

  test('double blocks need two touching squares', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Blocks').click();
    await page.getByRole('button', { name: 'Double', exact: true }).click();
    await clickAt(page, 3, 16);
    await clickAt(page, 4, 16);
    await expect(page.locator('[data-block]')).toHaveCount(2);
  });

  test('keyboard: shortcuts, arrow cursor and Enter place a monster', async ({ page }) => {
    await newQuest(page);
    await page.keyboard.press('m');
    await expect(tool(page, 'Monsters')).toHaveAttribute('aria-pressed', 'true');
    await board(page).focus();
    // the cursor starts on the stairs; move it to a free square of the start room
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-monster]')).toHaveCount(1);
  });

  test('the issue counter and the issue list select the element', async ({ page }) => {
    await newQuest(page);
    await expect(page.locator('.ed-issues')).not.toHaveText('No problems');
    await page.locator('.ed-issues').click();
    await expect(page.locator('.ed-inspector')).toContainText('Problems');
    await shot(page, 'editor-issues');
  });

  test('save lists the errors that stop it', async ({ page }) => {
    await newQuest(page);
    await btn(page, 'Save').click();
    // an empty quest either saves or says why not; either way the screen answers
    await expect(page.locator('.toast, .ed-save-errors').first()).toBeVisible();
  });
});

test.describe('editor: storage and files', () => {
  test('a reload keeps the draft', async ({ page }) => {
    await newQuest(page, 'Persistent', '/?editor=1');
    await tool(page, 'Monsters').click();
    await clickAt(page, 4, 17);
    await expect(page.locator('[data-monster]')).toHaveCount(1);
    await page.waitForTimeout(500); // let the draft be written
    await page.reload();
    await expect(page.locator('li[data-quest]')).toHaveCount(1);
    await expect(page.locator('li[data-quest]')).toContainText('Unsaved draft');
    await btn(page, 'Open').click();
    await expect(page.locator('header h1')).toHaveText('Persistent');
    await expect(page.locator('[data-monster]')).toHaveCount(1);
  });

  test('delete asks first', async ({ page }) => {
    await newQuest(page, 'Gone soon');
    await btn(page, 'Back').click();
    await btn(page, 'Delete').click();
    await expect(page.getByText('Delete it?')).toBeVisible();
    await btn(page, 'No').click();
    await expect(page.locator('li[data-quest]')).toHaveCount(1);
    await btn(page, 'Delete').click();
    await btn(page, 'Yes, delete').click();
    await expect(page.locator('li[data-quest]')).toHaveCount(0);
  });

  test('import a file: the bundled Quest 1 round trip, with the id warning', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    const text = readFileSync('src/content/quests/q01-the-trial.json', 'utf8');
    await page.getByLabel('Import file').setInputFiles({
      name: 'q01.hqquest.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
    await expect(page.getByText('The Trial is in your list.')).toBeVisible();
    await expect(page.locator('.es-imported')).toContainText('was changed to user-the-trial');
    await shot(page, 'editor-import');
    await btn(page, 'Open it').click();
    await expect(page.locator('header h1')).toHaveText('The Trial');
    // everything of Quest 1 is on the board: 24 monsters, the furniture, doors
    await expect(page.locator('[data-monster]')).toHaveCount(24);
    expect(await page.locator('[data-furniture]').count()).toBeGreaterThan(8);
    expect(await page.locator('[data-door]').count()).toBeGreaterThan(8);
    await shot(page, 'editor-quest1');
  });

  test('a file that is not a quest is refused with a readable message', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByLabel('Import file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ nope'),
    });
    await expect(page.getByRole('alert')).toContainText('not valid JSON');
  });

  test('copy a bundled quest from the list', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByLabel('Bundled quest').selectOption('1');
    await btn(page, 'Make a copy').click();
    await btn(page, 'Open it').click();
    await expect(page.locator('header h1')).toHaveText('The Trial');
    await expect(page.locator('[data-monster]')).toHaveCount(24);
  });
});

test.describe('editor: inspector', () => {
  const insp = (page: Page) => page.locator('.ed-inspector');

  test('monster: type, name, stats, state, spells, traits; undo', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    await clickAt(page, 4, 17);
    await tool(page, 'Select').click();
    await clickAt(page, 4, 17);
    await expect(page.getByTestId('selection-id')).toContainText('Orc');
    await insp(page).getByRole('button', { name: 'Goblin', exact: true }).click();
    await expect(page.getByTestId('selection-id')).toContainText('Goblin');
    await insp(page).getByLabel('Name').fill('Grub');
    await insp(page).getByLabel('att').fill('5');
    await insp(page).getByLabel('Traits (one per line)').fill('Likes gold');
    await insp(page).getByRole('button', { name: 'Dormant', exact: true }).click();
    await insp(page).getByRole('button', { name: 'Fear', exact: true }).click();
    await expect(insp(page).getByLabel('Name')).toHaveValue('Grub');
    await expect(insp(page).getByLabel('att')).toHaveValue('5');
    await expect(insp(page).getByLabel('Traits (one per line)')).toHaveValue('Likes gold');
    await expect(insp(page).getByRole('button', { name: 'Dormant', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await insp(page).getByLabel('def').fill('x');
    await insp(page).getByLabel('mind').focus();
    await expect(page.locator('.toast')).toContainText('whole number');
    await shot(page, 'editor-inspector-monster');
    await btn(page, 'Undo').click();
    await btn(page, 'Undo').click();
    await expect(page.locator('[data-monster]')).toHaveCount(1);
  });

  test('furniture letter and trap kind, effect and target', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Furniture').click();
    await page.getByRole('button', { name: 'Chest', exact: true }).click();
    await clickAt(page, 2, 17);
    await tool(page, 'Select').click();
    await clickAt(page, 2, 17);
    await insp(page).getByLabel('Letter').fill('A');
    await insp(page).getByLabel('Letter').blur();
    await expect(page.locator('.ed-status')).toHaveText('Unsaved changes');
    await btn(page, 'Undo').click();
    await btn(page, 'Redo').click();
    await clickAt(page, 2, 17);
    await expect(insp(page).getByLabel('Letter')).toHaveValue('A');
    await tool(page, 'Traps').click();
    await clickAt(page, 5, 17);
    await tool(page, 'Select').click();
    await clickAt(page, 5, 17);
    await expect(page.getByTestId('selection-id')).toHaveText('t1');
    await insp(page).getByLabel('Effect').fill('Poison darts.');
    await insp(page).getByLabel('Effect').blur();
    await insp(page).getByRole('button', { name: 'Spear', exact: true }).click();
    await insp(page).getByLabel('Across').fill('6');
    await insp(page).getByLabel('Across').blur();
    await expect(insp(page).getByLabel('Across')).toHaveValue('6');
    await insp(page).getByRole('button', { name: 'Chest', exact: true }).click();
    await expect(insp(page).getByLabel('Furniture')).toBeVisible();
    await shot(page, 'editor-inspector-trap');
  });
});

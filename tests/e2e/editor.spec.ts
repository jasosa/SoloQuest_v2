import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { dismissStart } from './helpers';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/${name}.png` });
};
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
// A tile chip may end with its count, "Ice Vault 0 of 2".
const tool = (page: Page, name: string) =>
  page
    .locator('.ed-tools')
    .getByRole('button', { name: new RegExp(String.raw`^${name}( \d+ of \d+)?$`) });
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
  await page.getByRole('button', { name: /^NEW QUEST/ }).click();
  await page.getByLabel('Title').first().fill(title);
  await btn(page, 'Create the quest').click();
  await expect(page.locator('.fr-title')).toHaveText(title);
}

test.describe('editor: shell and board tools', () => {
  test('a link on the quest select opens the editor start; a new quest opens the editor', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await btn(page, 'Quest editor').click();
    await expect(page.getByRole('heading', { name: 'Quest editor' })).toBeVisible();
    await shot(page, 'editor-start');
    await page.getByRole('button', { name: /^NEW QUEST/ }).click();
    await page.getByLabel('Title').first().fill('The Cellar');
    await btn(page, 'Create the quest').click();
    await expect(page.locator('.fr-title')).toHaveText('The Cellar');
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
    await page.getByRole('button', { name: 'Open Persistent' }).click();
    await expect(page.locator('.fr-title')).toHaveText('Persistent');
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
    await expect(page.locator('.fr-title')).toHaveText('The Trial');
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

  test('edit a bundled quest now: it opens in the editor as your own copy', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
    await page.getByLabel('Bundled quest').selectOption('1');
    await btn(page, 'Edit it now').click();
    await expect(page.locator('.fr-title')).toHaveText('The Trial');
    await expect(page.locator('[data-monster]')).toHaveCount(24);
  });

  test('an edit of a bundled quest that is not saved yet is what the quest list plays', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
    await page.getByLabel('Bundled quest').selectOption('1');
    await btn(page, 'Edit it now').click();
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    const title = page.getByTestId('quest-general').getByLabel('Title');
    await title.fill('The Trial, edited');
    await title.blur();
    await expect(page.locator('.fr-title')).toHaveText('The Trial, edited');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByTestId('home-single').click();
    await page.getByTestId('pack-core').click();
    await expect(page.locator('.qcard .qtitle').first()).toHaveText('The Trial, edited');
  });

  test('an edited Frozen Horror quest stays in the Frozen Horror tab (bug)', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
    await page.getByLabel('Bundled quest').selectOption('102');
    await btn(page, 'Edit it now').click();
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    const title = page.getByTestId('quest-general').getByLabel('Title');
    await title.fill('Trial by Ice, edited');
    await title.blur();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByTestId('home-single').click();
    await page.getByTestId('pack-frozen-horror').click();
    await expect(page.locator('.qcard', { hasText: 'Trial by Ice, edited' })).toHaveCount(1);
    await expect(page.locator('.qcard')).toHaveCount(10);
    await page.getByTestId('back').click();
    await page.getByTestId('pack-core').click();
    await expect(page.locator('.qcard')).toHaveCount(14);
  });

  test('copy a bundled quest from the list', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
    await page.getByLabel('Bundled quest').selectOption('1');
    await btn(page, 'Make a copy').click();
    await btn(page, 'Open it').click();
    await expect(page.locator('.fr-title')).toHaveText('The Trial');
    await expect(page.locator('[data-monster]')).toHaveCount(24);
  });

  test('editor header: import with a confirm, export a file, bad file shows errors', async ({
    page,
  }) => {
    await newQuest(page, 'The Cellar');
    const q1 = readFileSync('src/content/quests/q01-the-trial.json', 'utf8');
    const file = (name: string, text: string) => ({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
    for (const name of ['Import', 'Export']) {
      expect((await btn(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    // a blank draft is replaced at once, as one undo step
    await page.getByLabel('Import file').setInputFiles(file('q1.hqquest.json', q1));
    await expect(page.locator('.fr-title')).toHaveText('The Trial');
    await expect(page.locator('[data-monster]')).toHaveCount(24);

    // export: the file name comes from the title, and there is no userText
    const [dl] = await Promise.all([page.waitForEvent('download'), btn(page, 'Export').click()]);
    expect(dl.suggestedFilename()).toBe('the-trial.hqquest.json');
    const out = readFileSync((await dl.path())!, 'utf8');
    expect(out).not.toContain('userText');
    expect(JSON.parse(out).title).toBe('The Trial');
    await expect(page.locator('.toast')).toContainText('Exported the-trial.hqquest.json');

    // a bad file: readable errors, nothing changes
    await page.getByLabel('Import file').setInputFiles(file('bad.hqquest.json', '{ not json'));
    const dialog = page.getByRole('dialog', { name: 'The file could not be used' });
    await expect(dialog).toContainText('not valid JSON');
    await shot(page, 'editor-import-error');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.fr-title')).toHaveText('The Trial');

    // a good file on a draft with content asks first
    const other = JSON.stringify({ ...JSON.parse(q1), title: 'Second Trial' });
    await page.getByLabel('Import file').setInputFiles(file('two.hqquest.json', other));
    const sheet = page.getByRole('dialog', { name: 'Replace the draft' });
    await expect(sheet).toBeVisible();
    await shot(page, 'editor-import-confirm');
    for (const b of await sheet.getByRole('button').all()) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await sheet.getByRole('button', { name: 'Keep my draft' }).click();
    await expect(page.locator('.fr-title')).toHaveText('The Trial');
    await page.getByLabel('Import file').setInputFiles(file('two.hqquest.json', other));
    await sheet.getByRole('button', { name: 'Replace the draft' }).click();
    await expect(page.locator('.fr-title')).toHaveText('Second Trial');
    await btn(page, 'Undo').click();
    await expect(page.locator('.fr-title')).toHaveText('The Trial');
  });

  test('export refuses a draft with errors and counts them', async ({ page }) => {
    await newQuest(page, 'Broken');
    // a new quest has no objective yet, which is an error
    await expect(page.locator('.ed-issues')).not.toHaveAttribute('data-errors', '0');
    let downloaded = false;
    page.on('download', () => (downloaded = true));
    await page.getByTestId('export').click();
    await expect(page.locator('.toast')).toHaveText(/^Cannot export: \d+ problems?/);
    await page.waitForTimeout(300);
    expect(downloaded).toBe(false);
  });
});

test.describe('editor: inspector', () => {
  const insp = (page: Page) => page.locator('.ed-inspector');

  test('monster: the map inspector points to the Monsters tab, where type, name, stats, state, spells, traits are edited; undo', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    await clickAt(page, 4, 17);
    await tool(page, 'Select').click();
    await clickAt(page, 4, 17);
    await expect(page.getByTestId('selection-id')).toContainText('Orc');
    // no monster form and no actions list beside the map (no duplicates of the Monsters tab)
    await expect(insp(page).getByLabel('Name')).toHaveCount(0);
    await expect(page.getByTestId('element-actions')).toHaveCount(0);
    await insp(page).getByRole('button', { name: 'Edit in the Monsters tab' }).click();

    const card = page.getByTestId('monster-card');
    await card.getByLabel('Type').selectOption('goblin');
    await expect(page.getByTestId('monster-list')).toContainText('Goblin');
    await card.getByLabel('Name').fill('Grub');
    await card.getByLabel('Name').blur();
    await card.getByLabel('att', { exact: true }).fill('5');
    await card.getByLabel('att', { exact: true }).blur();
    await card.getByLabel('Traits (one per line)').fill('Likes gold');
    await card.getByLabel('Traits (one per line)').blur();
    await page.getByLabel('Starts').selectOption('dormant');
    const spells = page.getByTestId('monster-spells');
    await spells.getByLabel('Add a spell').selectOption({ label: 'Fear' });
    await spells.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(spells.locator('[data-spell="fear"]')).toBeVisible();
    await expect(card.getByLabel('Name')).toHaveValue('Grub');
    await expect(card.getByLabel('att', { exact: true })).toHaveValue('5');
    await expect(card.getByLabel('Traits (one per line)')).toHaveValue('Likes gold');
    await expect(page.getByLabel('Starts')).toHaveValue('dormant');
    await card.getByLabel('def', { exact: true }).fill('x');
    await card.getByLabel('mind', { exact: true }).focus();
    await expect(page.locator('.toast')).toContainText('whole number');
    await shot(page, 'editor-inspector-monster');
    await btn(page, 'Undo').click();
    await btn(page, 'Undo').click();
    await page.getByRole('tab', { name: 'Map' }).click();
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

test.describe('editor: actions (decision 68)', () => {
  const insp = (page: Page) => page.locator('.ed-inspector');
  const actionsTab = (page: Page) => page.getByRole('tab', { name: /^Actions/ });
  const dlg = (page: Page) => page.getByRole('dialog', { name: 'Action' });

  async function chestWithLetter(page: Page, letter: string) {
    await tool(page, 'Furniture').click();
    await page.getByRole('button', { name: 'Chest', exact: true }).click();
    await clickAt(page, 2, 17);
    await tool(page, 'Select').click();
    await clickAt(page, 2, 17);
    await insp(page).getByLabel('Letter').fill(letter);
    await insp(page).getByLabel('Letter').blur();
  }

  test('the furniture letter takes one capital, never X; chips and fields are 44 px', async ({
    page,
  }) => {
    await newQuest(page);
    await chestWithLetter(page, 'x');
    await expect(page.locator('.toast')).toContainText('not X');
    await expect(insp(page).getByLabel('Letter')).toHaveValue('');
    await insp(page).getByLabel('Letter').fill('b');
    await expect(insp(page).getByLabel('Letter')).toHaveValue('B');
    await insp(page).getByLabel('Letter').blur();
    await expect(page.locator('.toast')).toHaveCount(0);
    await tool(page, 'Furniture').click();
    for (const c of await page.locator('.ed-small .chip').all())
      expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test('a letter with no action is listed; one tap adds it; message, trigger, condition, effects', async ({
    page,
  }) => {
    await newQuest(page);
    await chestWithLetter(page, 'A');
    await expect(actionsTab(page).getByTestId('missing-count')).toHaveText('1');
    await actionsTab(page).click();
    await expect(page.getByTestId('missing-letters')).toContainText('Add action A');
    await btn(page, 'Add action A').click();
    // in the Actions tab the action sits beside the list, not in a popup
    await expect(page.getByTestId('action-card')).toBeVisible();
    await expect(dlg(page)).toHaveCount(0);
    await expect(page.getByTestId('note-id')).toHaveText('n-A');
    await expect(actionsTab(page).getByTestId('missing-count')).toHaveCount(0);

    const message = page
      .getByTestId('action-card')
      .locator('[data-effect="showText"]')
      .first()
      .getByLabel(/^Text/);
    await message.fill('A dusty chest.');
    await message.blur();

    // applies to a room, and the trigger is chosen from the ones that fit a room
    await page.getByTestId('action-card').getByLabel('Applies to').selectOption('area:R20');
    await expect(page.getByTestId('action-card').getByLabel('When')).toContainText(
      'A hero enters it',
    );
    await page.getByTestId('action-card').getByLabel('When').selectOption('areaEntered');

    // letter shown at, picked on the board (the popup steps aside while picking)
    await page
      .getByTestId('action-card')
      .getByRole('button', { name: 'Click it on the board' })
      .first()
      .click();
    await expect(dlg(page)).toHaveCount(0);
    await expect(page.getByTestId('pick-bar')).toBeVisible();
    await clickAt(page, 4, 16);
    await expect(dlg(page)).toContainText('Square 4, 16');

    // a condition and effects
    const addEffect = dlg(page).getByLabel('Add an effect').last();
    await dlg(page).getByLabel('Add a condition').selectOption('firstTime');
    await expect(page.getByTestId('condition-row')).toHaveCount(1);
    await addEffect.selectOption('setFlag');
    await addEffect.selectOption('addCounter');
    await addEffect.selectOption('promptChoice');
    await addEffect.selectOption('revealAll');
    await addEffect.selectOption('placeBlock');
    await expect(page.getByTestId('effect-row')).toHaveCount(6); // the message is the first
    const flag = page.locator('[data-effect="setFlag"]').getByRole('textbox', { name: 'Flag' });
    await flag.fill('alarm');
    await flag.blur();
    await page.getByRole('button', { name: 'Add an answer' }).click();
    await expect(page.getByTestId('option-row')).toHaveCount(2);
    await shot(page, 'editor-action-popup');

    // an effect that needs a monster says so
    await dlg(page).getByLabel('Add an effect').last().selectOption('placeMonster');
    await expect(page.locator('.toast')).toContainText('Add a monster first');

    // undo (the title band stays usable) goes back one change at a time
    await btn(page, 'Undo').click();
    await expect(page.getByTestId('option-row')).toHaveCount(1);

    // the list groups it under the room
    await btn(page, 'Close').click();
    await expect(dlg(page)).toHaveCount(0);
    await actionsTab(page).click(); // picking a square on the board moved us to the Map tab
    await expect(page.getByTestId('actions-area')).toContainText('A dusty chest.');
    await expect(page.getByTestId('actions-area')).toContainText('Hero enters');
    await shot(page, 'editor-actions-list');
  });

  test('a letter on the board: missing style, then solid; a tap opens the action', async ({
    page,
  }) => {
    await newQuest(page);
    await chestWithLetter(page, 'A');
    const mark = page.locator('#editor-board [data-letter="A"]');
    await expect(mark).toHaveAttribute('data-missing', 'true');
    await shot(page, 'editor-letter-missing');

    // a tap on a letter with no action makes its action and opens it, over the board
    await clickAt(page, 2, 17, 0.82, 0.18);
    await expect(page.getByTestId('note-id')).toHaveText('n-A');
    await expect(mark).not.toHaveAttribute('data-missing', 'true');
    await expect(mark).toHaveAttribute('data-note', 'n-A');
    await btn(page, 'Close').click();
    await expect(dlg(page)).toHaveCount(0);

    await clickAt(page, 2, 17, 0.82, 0.18);
    await expect(page.getByTestId('note-id')).toHaveText('n-A');
    await btn(page, 'Close').click();

    await tool(page, 'Monsters').click();
    await expect(page.locator('[data-letter-hit]')).toHaveCount(0);
  });

  test('an action on a door: pick a square on the board, Escape cancels, delete and undo', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Doors').click();
    await clickAt(page, 3, 17, 0.5, 0.97);
    await expect(page.locator('[data-door="d1"]')).toHaveCount(1);
    await tool(page, 'Select').click();
    await clickAt(page, 3, 17, 0.5, 0.97);
    await insp(page).getByRole('button', { name: 'Add action' }).click();
    await expect(dlg(page).getByLabel('Applies to')).toHaveValue('door:d1');
    await expect(dlg(page).getByLabel('When')).toHaveValue('doorOpened');

    // "A square on the board" asks for a click; Escape cancels
    await dlg(page).getByLabel('Applies to').selectOption('__square');
    await expect(page.getByTestId('pick-bar')).toContainText('Click a square');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pick-bar')).toHaveCount(0);
    await expect(dlg(page)).toBeVisible();
    await dlg(page).getByLabel('Applies to').selectOption('__square');
    await clickAt(page, 4, 17);
    await expect(dlg(page).getByLabel('Applies to')).toHaveValue('square:4,17');
    await expect(dlg(page).getByLabel('When')).toHaveValue('squareEntered');

    await btn(page, 'Delete action').click();
    await expect(dlg(page)).toHaveCount(0);
    await actionsTab(page).click();
    await expect(page.getByTestId('no-actions')).toBeVisible();
    await btn(page, 'Undo').click();
    await expect(page.getByTestId('note-list')).toBeVisible();
  });
});

test.describe('editor: actions of an element and of the quest (decision 68)', () => {
  const insp = (page: Page) => page.locator('.ed-inspector');
  const dlg = (page: Page) => page.getByRole('dialog', { name: 'Action' });

  async function selectedDoor(page: Page) {
    await newQuest(page);
    await tool(page, 'Doors').click();
    await clickAt(page, 3, 17, 0.5, 0.97);
    await tool(page, 'Select').click();
    await clickAt(page, 3, 17, 0.5, 0.97);
  }

  test('select a door, add an action with a button, edit it, read it back from the door', async ({
    page,
  }) => {
    await selectedDoor(page);
    const actions = page.getByTestId('element-actions');
    await expect(actions).toContainText('No action here yet.');
    await shot(page, 'editor-actions-empty');
    await actions.getByRole('button', { name: 'Add action' }).click();

    // the popup names the element and offers the triggers that fit a door
    await expect(dlg(page).getByLabel('Applies to')).toHaveValue('door:d1');
    const when = dlg(page).getByLabel('When');
    await expect(when.locator('option')).toHaveText(['It is opened', 'A button']);
    await when.selectOption('manual');
    await expect(dlg(page).getByLabel('Button label')).toHaveValue('Press me');
    const hint = dlg(page).getByLabel('Hint above the button (optional)');
    await hint.fill('Press it when the last hero is through.');
    await hint.blur();
    await dlg(page).getByRole('button', { name: 'Every time', exact: true }).click();
    await shot(page, 'editor-action-button');
    await btn(page, 'Close').click();

    // back on the door, the section lists it, and a row opens it again
    await expect(page.getByTestId('action-list')).toContainText('Button: Press me');
    await page.getByTestId('action-list').getByRole('button').first().click();
    await expect(dlg(page).getByLabel('Button label')).toHaveValue('Press me');
    // the action can move to the quest: its button then lives in the Quest sheet
    await dlg(page).getByLabel('Applies to').selectOption('quest');
    await expect(dlg(page).getByLabel('When')).toHaveValue('manual');
  });

  test('a monster offers seen, slain, escapes or is freed, casts a spell and a button', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    await clickAt(page, 4, 17);
    await tool(page, 'Select').click();
    await clickAt(page, 4, 17);
    await page.getByRole('tab', { name: 'Monsters' }).click(); // a monster's actions live there
    await page.getByTestId('element-actions').getByRole('button', { name: 'Add action' }).click();
    await expect(dlg(page).getByLabel('When').locator('option')).toHaveText([
      'It is seen',
      'It is slain',
      'It escapes or is freed',
      'It casts a spell',
      'A button',
    ]);
  });

  test('the quest start message is an action of the quest, not a loose note', async ({ page }) => {
    await newQuest(page);
    await page.getByRole('tab', { name: 'Quest' }).click();
    const quest = page.getByTestId('quest-actions');
    await expect(quest).toContainText('No action yet.');
    await quest.getByRole('button', { name: 'Add action' }).click();
    await expect(dlg(page).getByLabel('Applies to')).toHaveValue('quest');
    await expect(dlg(page).getByLabel('When')).toHaveValue('questStart');
    await expect(dlg(page).getByLabel('When').locator('option')).toHaveText([
      'The quest starts',
      'The quest ends',
      'A Zargon turn ends',
      'All of some monsters are slain',
      'A button in the Quest sheet',
    ]);
    const message = dlg(page).locator('[data-effect="showText"]').first().getByLabel(/^Text/);
    await message.fill('Place the heroes on the stairs.');
    await message.blur();
    await btn(page, 'Close').click();
    await expect(page.getByTestId('note-list')).toContainText(/quest starts/i);
  });

  test('the quest ends is a trigger of the quest', async ({ page }) => {
    await newQuest(page);
    await page.getByRole('tab', { name: 'Quest' }).click();
    await page.getByTestId('quest-actions').getByRole('button', { name: 'Add action' }).click();
    await expect(dlg(page).getByLabel('When').locator('option')).toContainText(['The quest ends']);
    await dlg(page).getByLabel('When').selectOption('questEnds');
    await expect(dlg(page).getByLabel('When')).toHaveValue('questEnds');
    const message = dlg(page).locator('[data-effect="showText"]').first().getByLabel(/^Text/);
    await message.fill('The cellar goes quiet.');
    await message.blur();
    await btn(page, 'Close').click();
    await expect(page.getByTestId('note-list')).toContainText('The quest ends');
  });

  test('zones: paint squares with the Zones tool, select the zone, give it an action', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Zones').click();
    await clickAt(page, 3, 16);
    await clickAt(page, 4, 16);
    await expect(page.locator('[data-zone-cell="z1"]')).toHaveCount(2);
    await clickAt(page, 4, 16); // a second click on a square takes it out
    await expect(page.locator('[data-zone-cell="z1"]')).toHaveCount(1);
    await clickAt(page, 4, 16);
    await shot(page, 'editor-zone');
    await tool(page, 'Select').click();
    await clickAt(page, 3, 16);
    await expect(page.getByTestId('selection-id')).toHaveText('z1');
    await expect(page.getByTestId('zone-size')).toHaveText('2 squares');
    await page.getByTestId('element-actions').getByRole('button', { name: 'Add action' }).click();
    await expect(dlg(page).getByLabel('Applies to')).toHaveValue('zone:z1');
    await expect(dlg(page).getByLabel('When')).toHaveValue('zoneEntered');
    await btn(page, 'Close').click();
    // a new zone starts with the "New zone" chip
    await tool(page, 'Zones').click();
    await page.getByTestId('zone-chips').getByRole('button', { name: 'New zone' }).click();
    await clickAt(page, 8, 16);
    await expect(page.locator('[data-zone-cell="z2"]')).toHaveCount(1);
  });

  test('a marker can be edited after it is placed, and takes actions on its square', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Markers').click();
    await clickAt(page, 4, 16);
    await tool(page, 'Select').click();
    await clickAt(page, 4, 16);
    await expect(page.getByTestId('selection-id')).toHaveText('k1');
    await insp(page).getByLabel('Label').fill('7');
    await insp(page).getByLabel('Label').blur();
    await insp(page).getByRole('button', { name: 'Players see', exact: true }).click();
    await expect(page.locator('[data-marker="k1"]')).toContainText('7');
    await page.getByTestId('element-actions').getByRole('button', { name: 'Add action' }).click();
    await expect(dlg(page).getByLabel('Applies to')).toHaveValue('square:4,16');
    await expect(dlg(page).getByLabel('When')).toHaveValue('squareEntered');
  });
});

test.describe('editor: abilities and spells of a monster (decisions 69 and 70)', () => {
  const abilityDlg = (page: Page) => page.getByRole('dialog', { name: 'Ability' });
  const spellDlg = (page: Page) => page.getByRole('dialog', { name: 'Spell' });

  async function selectedMonster(page: Page) {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    await clickAt(page, 4, 17);
    await tool(page, 'Select').click();
    await clickAt(page, 4, 17);
    // a monster is edited in the Monsters tab only
    await page.getByRole('tab', { name: 'Monsters' }).click();
  }

  test('abilities: a dropdown and Add, no chips; a new ability opens its popup', async ({
    page,
  }) => {
    await selectedMonster(page);
    const section = page.getByTestId('monster-abilities');
    await expect(section.locator('.chip').filter({ hasText: 'Fireproof' })).toHaveCount(0);

    // pick from the core library with the dropdown and Add
    const add = section.getByRole('button', { name: 'Add', exact: true });
    await expect(add).toBeDisabled();
    await section.getByLabel('Add an ability').selectOption({ label: 'Fireproof' });
    await add.click();
    await expect(section.locator('[data-ability="fireImmune"]')).toContainText(
      'Fire spells have no effect on it.',
    );
    // the ability that is on the monster is not offered again
    await expect(section.getByLabel('Add an ability').locator('option')).not.toContainText([
      'Fireproof',
    ]);

    // a new ability: made, added to the monster, and opened in its popup
    await section.getByRole('button', { name: 'New ability…' }).click();
    await expect(abilityDlg(page)).toBeVisible();
    await abilityDlg(page).getByLabel('Name').fill('Bog skin');
    await abilityDlg(page).getByLabel('Name').blur();
    await abilityDlg(page).getByLabel('Kind').selectOption('immunity');
    const text = abilityDlg(page).getByLabel('What it does');
    await text.fill('Mud spells fail.');
    await text.blur();
    await expect(page.getByTestId('ability-used')).toContainText('m1');
    await shot(page, 'editor-ability-popup');
    await abilityDlg(page).getByRole('button', { name: 'Close' }).click();
    await expect(section.locator('[data-ability="ab1"]')).toContainText('Bog skin');
    await expect(section.locator('[data-ability="ab1"]')).toContainText('Mud spells fail.');

    // an ability is taken off with its row button
    await section.getByRole('button', { name: 'Remove Fireproof' }).click();
    await expect(section.locator('[data-ability="fireImmune"]')).toHaveCount(0);
  });

  test('spells: dropdown and Add, a cast limit, a new spell with situations from a dropdown', async ({
    page,
  }) => {
    await selectedMonster(page);
    const section = page.getByTestId('monster-spells');
    await section.getByLabel('Add a spell').selectOption({ label: 'Sleep' });
    await section.getByRole('button', { name: 'Add', exact: true }).click();
    const row = section.locator('[data-spell="sleep"]');
    await expect(row).toContainText('rolls 3 or more attack dice right next to it?');
    await expect(row.getByLabel('Sleep cast limit')).toHaveValue('1');
    await row.getByLabel('Sleep cast limit').selectOption({ label: 'Twice' });
    await expect(row.getByLabel('Sleep cast limit')).toHaveValue('2');
    await row.getByLabel('Sleep cast limit').selectOption({ label: 'Once in the quest' });
    // the place where the spell is offered: random by default, or a fixed place
    await expect(row.getByLabel('Sleep order')).toHaveValue('0');
    await row.getByLabel('Sleep order').selectOption({ label: 'Offered first' });
    await expect(row.getByLabel('Sleep order')).toHaveValue('1');
    await row.getByLabel('Sleep order').selectOption({ label: 'Offered at random' });

    // a new spell: its popup lists the situations with their questions
    await section.getByRole('button', { name: 'New spell…' }).click();
    await expect(spellDlg(page)).toBeVisible();
    await expect(page.getByTestId('spell-tags')).toContainText('Can it see a hero?');
    await spellDlg(page).getByLabel('Name').fill('Mud');
    await spellDlg(page).getByLabel('Name').blur();
    await spellDlg(page).getByLabel('Add a situation').selectOption('heroAdjacent');
    await expect(page.getByTestId('spell-tags')).toContainText(
      'Is a hero on a square right next to it?',
    );
    await spellDlg(page).getByRole('button', { name: 'Remove any' }).click();
    await expect(page.locator('[data-tag="any"]')).toHaveCount(0);
    // the last situation cannot go without a question of the author's own
    await spellDlg(page).getByRole('button', { name: 'Remove heroAdjacent' }).click();
    await expect(page.locator('.toast')).toContainText('needs a situation or a question');
    await spellDlg(page)
      .getByLabel('Or one question of your own (replaces the situations)')
      .fill('Is it raining?');
    await spellDlg(page).getByLabel('Or one question of your own (replaces the situations)').blur();
    await spellDlg(page).getByLabel('Offer it only when').selectOption('escapePoint');
    await shot(page, 'editor-spell-popup');
    await spellDlg(page).getByRole('button', { name: 'Close' }).click();
    await expect(section.locator('[data-spell="sp1"]')).toContainText('Is it raining?');
    await expect(section.locator('[data-spell="sp1"]').getByLabel('Mud cast limit')).toHaveValue(
      '1',
    );

    // the special flag is a single toggle
    const special = page.getByRole('switch', { name: /Special monster/ });
    await special.click();
    await expect(special).toHaveAttribute('aria-checked', 'true');
  });

  test('the quest fields list its own abilities and spells; deleting one warns', async ({
    page,
  }) => {
    await selectedMonster(page);
    const section = page.getByTestId('monster-abilities');
    await section.getByRole('button', { name: 'New ability…' }).click();
    await abilityDlg(page).getByRole('button', { name: 'Close' }).click();
    await page.getByRole('tab', { name: 'Quest' }).click(); // the quest fields are in the Quest tab
    const own = page.getByTestId('abilities-section');
    await expect(own).toContainText('New ability');
    await own.getByRole('button', { name: 'Edit ability ab1' }).click();
    await abilityDlg(page).getByRole('button', { name: 'Delete ability' }).click();
    await page.getByRole('tab', { name: 'Map' }).click();
    await expect(page.locator('.ed-warnings')).toContainText('ab1');
  });
});

test.describe('editor: reference image', () => {
  /** A small PNG made in the page: a pale sheet with a dark frame (not a quest map). */
  async function makePng(page: Page): Promise<Buffer> {
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 520;
      c.height = 380;
      const g = c.getContext('2d')!;
      g.fillStyle = '#e8e0c8';
      g.fillRect(0, 0, 520, 380);
      g.strokeStyle = '#a03030';
      g.lineWidth = 6;
      g.strokeRect(20, 20, 480, 340);
      return c.toDataURL('image/png').split(',')[1]!;
    });
    return Buffer.from(b64!, 'base64');
  }

  test('load, align four corners, opacity, hide and clear', async ({ page }) => {
    await newQuest(page);
    const png = await makePng(page);
    const layer = page.getByTestId('reference-layer');
    await expect(layer).toHaveCount(0);

    await page
      .getByTestId('reference-file')
      .setInputFiles({ name: 'sheet.png', mimeType: 'image/png', buffer: png });
    const dialog = page.getByRole('dialog', { name: 'Align the reference image' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('top left');
    await shot(page, 'editor-reference-align');

    const img = dialog.getByAltText('Reference to align');
    const box = (await img.boundingBox())!;
    const tap = (fx: number, fy: number) =>
      page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await tap(20 / 520, 20 / 380);
    await expect(dialog).toContainText('top right');
    await tap(500 / 520, 20 / 380);
    await tap(500 / 520, 360 / 380);
    await expect(dialog).toContainText('bottom left');
    await tap(20 / 520, 360 / 380);
    await expect(dialog).toHaveCount(0);

    await expect(layer).toHaveCount(1);
    const layerImg = layer.locator('img');
    await expect(layerImg).toHaveCSS('opacity', '0.5');
    // the frame corners land on the board corners: the layer matrix is a plain scale and shift
    const m = await layerImg.evaluate((el) => getComputedStyle(el).transform);
    expect(m).toMatch(/^matrix3d|^matrix/);
    await shot(page, 'editor-reference');

    await page.getByLabel('Opacity').fill('0.9');
    await expect(layerImg).toHaveCSS('opacity', '0.9');

    // the board still takes clicks through the image
    await tool(page, 'Rock').click();
    await clickAt(page, 10, 2);
    await expect(board(page).locator('rect[fill="url(#ed-hatch)"]')).toHaveCount(1);

    await btn(page, 'Hide image').click();
    await expect(layer).toHaveCount(0);
    await btn(page, 'Show image').click();
    await expect(layer).toHaveCount(1);

    await btn(page, 'Clear image').click();
    await expect(layer).toHaveCount(0);
    await expect(btn(page, 'Load image')).toBeVisible();
  });

  /** A large scan sized PNG (3000 x 2200) with a dark frame and some texture. */
  async function makeLargePng(page: Page): Promise<Buffer> {
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 3000;
      c.height = 2200;
      const g = c.getContext('2d')!;
      g.fillStyle = '#e8e0c8';
      g.fillRect(0, 0, 3000, 2200);
      for (let i = 0; i < 4000; i++) {
        g.fillStyle = `rgba(${(i * 37) % 120},60,40,0.15)`;
        g.fillRect((i * 7919) % 3000, (i * 104729) % 2200, 40, 40);
      }
      g.strokeStyle = '#a03030';
      g.lineWidth = 20;
      g.strokeRect(100, 100, 2800, 2000);
      return c.toDataURL('image/png').split(',')[1]!;
    });
    return Buffer.from(b64!, 'base64');
  }

  for (const how of ['touch', 'mouse'] as const) {
    test(`a large image: four ${how} taps align it, it is drawn and kept after a reload`, async ({
      page,
    }) => {
      await newQuest(page, 'Big map', '/?editor=1');
      const png = await makeLargePng(page);
      await page
        .getByTestId('reference-file')
        .setInputFiles({ name: 'scan.png', mimeType: 'image/png', buffer: png });
      const dialog = page.getByRole('dialog', { name: 'Align the reference image' });
      await expect(dialog).toBeVisible();
      const img = dialog.getByAltText('Reference to align');
      await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(3000);
      const box = (await img.boundingBox())!;
      const tap = async (fx: number, fy: number) => {
        const x = box.x + box.width * fx;
        const y = box.y + box.height * fy;
        if (how === 'touch') await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
      };
      await tap(100 / 3000, 100 / 2200);
      await expect(dialog).toContainText('top right');
      await expect(dialog.locator('.ed-align-dot')).toHaveCount(1);
      await tap(2900 / 3000, 100 / 2200);
      await tap(2900 / 3000, 2100 / 2200);
      await expect(dialog).toContainText('bottom left');
      await tap(100 / 3000, 2100 / 2200);
      await expect(dialog).toHaveCount(0);
      const layerImg = page.getByTestId('reference-layer').locator('img');
      await expect(layerImg).toHaveCount(1);
      await expect
        .poll(() => layerImg.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth))
        .toBe(3000);
      await shot(page, `editor-reference-large-${how}`);

      // kept on this device: back to the list, open the quest again
      await page.waitForTimeout(800);
      await page.reload();
      await page.locator('li[data-quest] .fr-open').first().click();
      await expect(page.getByTestId('reference-layer')).toHaveCount(1);
    });
  }

  test('corners that cross show the message above the picker and start again', async ({ page }) => {
    await newQuest(page);
    await page
      .getByTestId('reference-file')
      .setInputFiles({ name: 'sheet.png', mimeType: 'image/png', buffer: await makePng(page) });
    const dialog = page.getByRole('dialog', { name: 'Align the reference image' });
    const box = (await dialog.getByAltText('Reference to align').boundingBox())!;
    const tap = (fx: number, fy: number) =>
      page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await tap(0.1, 0.1);
    await tap(0.9, 0.9);
    await tap(0.9, 0.1);
    await tap(0.1, 0.9);
    await expect(dialog).toContainText('four sided');
    await expect(page.locator('.toast')).toBeVisible();
    await expect(page.locator('.toast')).toBeInViewport();
    expect(
      await page.locator('.toast').evaluate((t) => {
        const r = t.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === t;
      }),
    ).toBe(true);
    await expect(dialog).toContainText('top left');
  });

  test('an image the browser cannot show gives a message and no picker', async ({ page }) => {
    await newQuest(page);
    await page.getByTestId('reference-file').setInputFiles({
      name: 'broken.png',
      mimeType: 'image/png',
      buffer: Buffer.from('this is not a png'),
    });
    await expect(page.locator('.toast')).toContainText('cannot read that image');
    await expect(page.getByRole('dialog', { name: 'Align the reference image' })).toHaveCount(0);
  });

  test('a file that is not an image is refused', async ({ page }) => {
    await newQuest(page);
    await page
      .getByTestId('reference-file')
      .setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.locator('.toast')).toContainText('not an image');
    await expect(page.getByRole('dialog', { name: 'Align the reference image' })).toHaveCount(0);
  });
});

test.describe('editor: problems panel and playtest', () => {
  const insp = (page: Page) => page.locator('.ed-inspector');

  test('the panel lists errors first, rows are 44 px, a row jumps and flashes the element', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Furniture').click();
    await page.getByRole('button', { name: 'Chest', exact: true }).click();
    await clickAt(page, 2, 17);
    await tool(page, 'Select').click();
    await clickAt(page, 2, 17);
    await insp(page).getByLabel('Letter').fill('A');
    await insp(page).getByLabel('Letter').blur();

    // the header count and the tab badge agree
    await page.locator('.ed-issues').click();
    const rows = page.getByTestId('problem-row');
    const n = await rows.count();
    expect(n).toBeGreaterThan(1);
    await expect(page.locator('.ed-issues')).toHaveText(/^\d+ (problems?|warnings?)$/);
    await expect(page.getByTestId('problem-count')).toHaveText(String(n));
    // errors first
    const kinds = await rows.locator('b').allTextContents();
    expect(kinds[0]).toBe('Problem');
    const firstWarning = kinds.indexOf('Warning');
    if (firstWarning >= 0)
      expect(kinds.slice(firstWarning).every((k) => k === 'Warning')).toBe(true);
    for (let i = 0; i < n; i++)
      expect((await rows.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot(page, 'editor-problems');

    // playtest waits until the errors are fixed
    await expect(page.getByTestId('playtest')).toBeDisabled();

    // the row about the lettered chest jumps to it
    await rows.filter({ hasText: 'Furniture' }).first().click();
    await expect(page.getByTestId('selection-id')).toContainText('f');
    await expect(page.locator('[data-flash]')).toHaveCount(1);
    await shot(page, 'editor-problems-jump');
    // the flash goes away on its own
    await expect(page.locator('[data-flash]')).toHaveCount(0, { timeout: 4000 });
  });

  test('playtest plays the draft; Zargon view shows what is hidden and changes nothing', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
    await page.getByLabel('Bundled quest').selectOption('1');
    await btn(page, 'Make a copy').click();
    await btn(page, 'Open it').click();
    await expect(page.locator('.fr-title')).toHaveText('The Trial');
    await expect(page.getByTestId('playtest')).toBeEnabled();
    await page.getByTestId('playtest').click();
    await dismissStart(page);

    await expect(page.locator('.app.play')).toBeVisible();
    await expect(page.locator('.qn')).toHaveText('Playtest');
    await expect(page.locator('[data-zargon-view]')).toHaveCount(0);
    const turn = await page.locator('.turn').textContent();
    const seen = await page.locator('[data-monster]').count();
    await shot(page, 'playtest-heroes-view');

    const toggle = page.getByTestId('zargon-view');
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-zmonster]')).not.toHaveCount(0);
    await expect(page.locator('[data-zdoor]')).not.toHaveCount(0);
    // a view only: the game itself is the same
    await expect(page.locator('.turn')).toHaveText(turn!);
    await expect(page.locator('[data-monster]')).toHaveCount(seen);
    await expect(btn(page, 'Undo')).toBeDisabled();
    await shot(page, 'playtest-zargon-view');

    await toggle.click();
    await expect(page.locator('[data-zargon-view]')).toHaveCount(0);

    await btn(page, 'Back to editor').click();
    await expect(page.locator('.fr-title')).toHaveText('The Trial');
    await expect(page.locator('#editor-board')).toBeVisible();
  });
});

test.describe('editor: quest fields', () => {
  const insp = (page: Page) => page.locator('.ed-inspector');
  const tab = (page: Page, name: RegExp) => insp(page).getByRole('button', { name });
  const quest = (page: Page) => page.locator('.fr-frame');
  const goQuest = (page: Page) => page.getByRole('tab', { name: 'Quest' }).click();
  const goMap = (page: Page) => page.getByRole('tab', { name: 'Map' }).click();

  test('add, edit, undo and remove an objective; the Problems error and the note effect follow', async ({
    page,
  }) => {
    await newQuest(page);
    // no objective: the Problems tab says so
    await tab(page, /^Problems/).click();
    await expect(page.getByTestId('problems-panel')).toContainText('no objective');
    await goQuest(page);
    await expect(page.getByTestId('no-objectives')).toBeVisible();

    await btn(page, 'Add an objective').click();
    await expect(page.getByTestId('objective-id')).toHaveText('o1');
    await expect(page.getByTestId('no-objectives')).toHaveCount(0);

    // edit the text, one undo step
    const text = quest(page).getByLabel('Objective o1 text');
    await text.fill('Find the lost key.');
    await text.blur();
    await expect(text).toHaveValue('Find the lost key.');
    await btn(page, 'Undo').click();
    await expect(quest(page).getByLabel('Objective o1 text')).toHaveValue('New objective');
    await btn(page, 'Redo').click();
    await expect(quest(page).getByLabel('Objective o1 text')).toHaveValue('Find the lost key.');
    // an empty text is refused and the old text stays
    await text.fill('   ');
    await text.blur();
    await expect(page.locator('.toast')).toContainText('needs text');
    await expect(quest(page).getByLabel('Objective o1 text')).toHaveValue('Find the lost key.');

    // touch targets
    for (const b of await quest(page).locator('.ed-quest .chip, .ed-quest .btn').all())
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // the 'no objective' error is gone
    await goMap(page);
    await tab(page, /^Problems/).click();
    await expect(page.getByTestId('problems-panel')).not.toContainText('no objective');

    // an action can complete it
    await goQuest(page);
    await quest(page).getByRole('button', { name: 'Add action' }).click();
    await page
      .getByRole('dialog', { name: 'Action' })
      .getByLabel('Add an effect')
      .last()
      .selectOption('completeObjective');
    await expect(
      page.locator('[data-effect="completeObjective"]').getByRole('combobox'),
    ).toContainText('o1 · Find the lost key.');
    await shot(page, 'editor-quest-objective-effect');

    // removing it warns about the note
    await btn(page, 'Close').click();
    await shot(page, 'editor-quest-fields');
    await quest(page).getByRole('button', { name: 'Remove objective o1' }).click();
    await expect(page.getByTestId('objective-row')).toHaveCount(0);
    await goMap(page);
    await expect(page.locator('.ed-warnings')).toContainText('o1');
    await btn(page, 'Undo').click();
    await goQuest(page);
    await expect(page.getByTestId('objective-row')).toHaveCount(1);
  });

  test('wandering monster and rules save and undo', async ({ page }) => {
    await newQuest(page);
    await goQuest(page);
    await expect(quest(page).getByLabel('Zargon info')).toHaveCount(0); // decision 66
    await quest(page).getByRole('button', { name: 'A monster', exact: true }).click();
    await expect(quest(page).getByRole('combobox', { name: 'Monster', exact: true })).toHaveValue(
      'orc',
    );
    await quest(page)
      .getByRole('combobox', { name: 'Monster', exact: true })
      .selectOption('goblin');
    await btn(page, 'Undo').click();
    await expect(quest(page).getByRole('combobox', { name: 'Monster', exact: true })).toHaveValue(
      'orc',
    );
    await quest(page).getByRole('button', { name: 'Free text', exact: true }).click();
    const what = quest(page).getByLabel('What appears');
    await what.fill('A ghost laughs.');
    await what.blur();
    await expect(quest(page).getByLabel('What appears')).toHaveValue('A ghost laughs.');
    await quest(page).getByRole('button', { name: 'None', exact: true }).click();
    await expect(quest(page).getByLabel('What appears')).toHaveCount(0);
    await shot(page, 'editor-quest-wandering');
  });
});

test.describe('editor: endings and blocked search', () => {
  const insp = (page: Page) => page.locator('.fr-frame');

  test('add, edit, undo and remove an ending', async ({ page }) => {
    await newQuest(page);
    await page.getByRole('tab', { name: 'Quest' }).click();
    await expect(page.getByTestId('ending-row')).toHaveCount(0);
    await btn(page, 'Add an ending').click();
    await expect(page.getByTestId('ending-row')).toHaveCount(1);
    const label = insp(page).getByLabel('Ending e1 label');
    await expect(label).toHaveValue('New ending');
    await label.fill('The captive died');
    await label.blur();
    const text = insp(page).getByLabel('Ending e1 text');
    await text.fill('The rescue failed.');
    await text.blur();
    await expect(insp(page).getByLabel('Ending e1 text')).toHaveValue('The rescue failed.');
    await btn(page, 'Undo').click();
    await expect(insp(page).getByLabel('Ending e1 text')).toHaveValue('');
    await expect(insp(page).getByLabel('Ending e1 label')).toHaveValue('The captive died');
    await btn(page, 'Redo').click();
    // an empty label is refused
    await insp(page).getByLabel('Ending e1 label').fill('  ');
    await insp(page).getByLabel('Ending e1 label').blur();
    await expect(page.locator('.toast')).toContainText('needs a label');
    await expect(insp(page).getByLabel('Ending e1 label')).toHaveValue('The captive died');
    for (const b of await insp(page).locator('.ed-quest .chip, .ed-quest .btn').all())
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot(page, 'editor-quest-endings');
    await insp(page).getByRole('button', { name: 'Remove ending e1' }).click();
    await expect(page.getByTestId('ending-row')).toHaveCount(0);
    await btn(page, 'Undo').click();
    await expect(page.getByTestId('ending-row')).toHaveCount(1);
  });

  test('the "Searching here is not possible" toggle excludes "No treasure card is drawn"', async ({
    page,
  }) => {
    await newQuest(page);
    await page.getByRole('tab', { name: 'Quest' }).click();
    await insp(page).getByRole('button', { name: 'Add action' }).click();
    // only a treasure search trigger offers the toggle
    await expect(btn(page, 'Searching here is not possible')).toHaveCount(0);
    await page.getByLabel('Applies to').selectOption('area:R20');
    await page.getByLabel('When').selectOption('treasureSearch');
    const block = btn(page, 'Searching here is not possible');
    const card = btn(page, 'No treasure card is drawn');
    await expect(block).toHaveAttribute('aria-pressed', 'false');
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await block.click();
    await expect(block).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    expect((await block.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await card.click();
    await expect(block).toHaveAttribute('aria-pressed', 'false');
    await btn(page, 'Undo').click();
    await expect(block).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('editor: Frozen Horror features', () => {
  const inspector = (page: Page) => page.locator('.ed-inspector');

  test('the Quest tab keeps only quest settings and points to the Map', async ({ page }) => {
    await newQuest(page);
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    await expect(page.getByLabel('Leave')).toBeVisible();
    await expect(page.getByLabel('Suggested texture pack')).toBeVisible();
    await expect(page.getByTestId('features-pointer')).toContainText('Map tab');
    for (const gone of ['Tunnel end A', 'Tile squares', 'Edge door square', 'Tile room'])
      await expect(page.getByLabel(gone)).toHaveCount(0);
  });

  test('tiles: slippery ice as 2 x 1, turn it, make it 2 x 3, undo, flag it', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Tiles').click();
    await tool(page, 'Slippery ice').click();
    await expect(page.getByTestId('tile-sizes').getByRole('button')).toHaveText([
      '1 x 1',
      '2 x 1',
      '3 x 1',
      '3 x 2',
    ]);
    await page.getByTestId('tile-sizes').getByRole('button', { name: '2 x 1' }).click();
    // the ghost shows the footprint before the click
    const at = await pointAt(page, 10, 13);
    await page.mouse.move(at.x, at.y);
    await expect(board(page).locator('rect[stroke-dasharray="4 3"]')).toHaveCount(2);
    await clickAt(page, 10, 13);
    await expect(page.locator('[data-board-tile="slipperyIce"]')).toHaveCount(1);
    await expect(page.getByTestId('tile-size')).toContainText('2 x 1');
    await shot(page, 'editor-tile-slippery');

    // turn (the inspector button), then change the size
    await inspector(page).getByRole('button', { name: 'Turn', exact: true }).click();
    await expect(page.getByTestId('tile-size')).toContainText('1 x 2');
    await inspector(page).getByRole('button', { name: '2 x 3', exact: true }).click();
    await expect(page.getByTestId('tile-size')).toContainText('2 x 3');
    await btn(page, 'Undo').click();
    await btn(page, 'Undo').click();
    await tool(page, 'Select').click();
    await clickAt(page, 10, 13);
    await expect(page.getByTestId('tile-size')).toContainText('2 x 1');

    // a tile that overlaps is refused with a reason
    await tool(page, 'Tiles').click();
    await tool(page, 'Cage').click();
    await clickAt(page, 10, 12);
    await expect(page.locator('.toast')).toContainText('overlap');

    // the R key turns the selected tile
    await tool(page, 'Select').click();
    await clickAt(page, 10, 13);
    await page.keyboard.press('r');
    await expect(page.getByTestId('tile-size')).toContainText('1 x 2');

    // a flag takes it away; blocking needs the flag first
    await inspector(page)
      .getByRole('switch', { name: /Blocks sight/ })
      .click();
    await expect(page.locator('.toast')).toContainText('flag');
    await inspector(page).getByLabel('Gone when this flag is set').fill('iceMelted');
    await inspector(page).getByLabel('Gone when this flag is set').blur();
    await expect(page.locator('[data-tile-flag="iceMelted"]')).toHaveCount(1);
    await inspector(page)
      .getByRole('switch', { name: /Blocks sight/ })
      .click();
    await expect(inspector(page).getByRole('switch', { name: /Blocks sight/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // the flag is never set by an action: the Problems list says so
    await inspector(page)
      .getByRole('button', { name: /^Problems/ })
      .click();
    await expect(page.locator('.ed-inspector')).toContainText('iceMelted is never set');

    await btn(page, 'Element').click();
    await inspector(page).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('[data-board-tile]')).toHaveCount(0);
  });

  test('tiles: fixed sizes, limits per quest, laid chasm that grows, room tiles over squares', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Tiles').click();
    await tool(page, 'Ice cave entrance').click();
    await expect(page.getByTestId('tile-sizes')).toHaveCount(0); // one size only
    await expect(page.getByTestId('tile-limit')).toContainText('1 of 6 x 5');
    await clickAt(page, 14, 1);
    await expect(page.locator('[data-board-tile="iceCaveEntrance"]')).toHaveCount(1);
    await expect(page.getByTestId('tile-size')).toContainText('6 x 5');
    await expect(page.getByTestId('tile-size')).toContainText('1 of 1 in this quest');
    // a second one is refused: the box holds one
    await clickAt(page, 3, 12);
    await expect(page.locator('.toast')).toContainText('the box has 1 of 6 x 5');
    await expect(page.locator('[data-board-tile="iceCaveEntrance"]')).toHaveCount(1);

    // the river: 1 x 8 and 1 x 3, one of each
    await tool(page, 'Icy river').click();
    await expect(page.getByTestId('tile-sizes').getByRole('button')).toHaveText(['1 x 8', '1 x 3']);
    await page.getByTestId('tile-sizes').getByRole('button', { name: '1 x 3' }).click();
    await clickAt(page, 9, 12);
    await expect(page.getByTestId('tile-size')).toContainText('1 x 3');
    await expect(
      page.getByTestId('tile-sizes').getByRole('button', { name: '1 x 3' }),
    ).toBeDisabled();

    // chasm is laid square by square
    await tool(page, 'Chasm').click();
    await clickAt(page, 12, 14);
    await clickAt(page, 13, 14);
    await expect(page.locator('[data-board-tile="chasm"]')).toHaveCount(1);
    await expect(page.getByTestId('tile-size')).toContainText('2 squares');

    // an Ice Vault 3 x 2 over a room and a corridor
    await tool(page, 'Ice Vault').click();
    await expect(page.getByTestId('tile-limit')).toContainText('1 of 3 x 2 and 1 of 4 x 3');
    await page.getByTestId('tile-sizes').getByRole('button', { name: '3 x 2' }).click();
    await clickAt(page, 4, 15);
    await expect(page.locator('[data-room-tile="iceVault"]')).toHaveCount(1);
    await expect(page.getByTestId('room-tile-info')).toContainText('Ice Vault, 3 x 2');
    await expect(page.getByTestId('room-tile-info')).toContainText('1 of 2 in this quest');
    await expect(page.getByRole('button', { name: /^Ice Vault 1 of 2$/ })).toBeVisible();
    // turn it with the inspector, delete it
    await inspector(page).getByRole('button', { name: 'Turn', exact: true }).click();
    await expect(page.getByTestId('room-tile-info')).toContainText('Ice Vault, 2 x 3');
    await tool(page, 'Living Fog Room').click();
    await clickAt(page, 12, 3);
    await expect(page.locator('[data-room-tile="livingFog"]')).toHaveCount(1);
    await shot(page, 'editor-tiles');
    await inspector(page).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('[data-room-tile="livingFog"]')).toHaveCount(0);
    await expect(page.locator('[data-room-tile="iceVault"]')).toHaveCount(1);
  });

  test('doors: an ice tunnel is two taps, with a design number you can change', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Doors').click();
    await tool(page, 'Ice tunnel').click();
    await clickAt(page, 4, 18);
    await expect(page.locator('.ed-hint')).toHaveText('Pick the other end of the tunnel.');
    await clickAt(page, 20, 18);
    await expect(page.locator('[data-tunnel]')).toHaveCount(2);
    await expect(page.locator('[data-tunnel="tun1:a"]')).toHaveAttribute('data-design', '1');
    await expect(page.getByTestId('tunnel-info')).toContainText('design 1, end A');
    // the next one takes the next free design
    await clickAt(page, 5, 18);
    await clickAt(page, 19, 18);
    await expect(page.locator('[data-tunnel="tun2:a"]')).toHaveAttribute('data-design', '2');
    await shot(page, 'editor-tunnels');

    // change the design of the second; a design that is used is off
    const designs = inspector(page).getByRole('group', { name: 'Tunnel design' });
    await designs.getByRole('button', { name: '7' }).click();
    await expect(page.locator('[data-tunnel="tun2:b"]')).toHaveAttribute('data-design', '7');
    await expect(designs.getByRole('button', { name: '1', exact: true })).toBeDisabled();

    // select end B of the first with the Select tool and delete: both ends go
    await tool(page, 'Select').click();
    await clickAt(page, 20, 18);
    await expect(page.getByTestId('tunnel-info')).toContainText('end B');
    await inspector(page).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('[data-tunnel^="tun1"]')).toHaveCount(0);
    await expect(page.locator('[data-tunnel]')).toHaveCount(2);
    await btn(page, 'Undo').click();
    await expect(page.locator('[data-tunnel]')).toHaveCount(4);
  });

  test('doors: an iron entry on the board edge becomes the start; a second one is refused', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Doors').click();
    await tool(page, 'Iron entry').click();
    await clickAt(page, 5, 5); // the middle of a square inside the board: no edge
    await expect(page.locator('.toast')).toContainText('outer edge');
    await clickAt(page, 0, 9, 0.06, 0.5); // the west edge of (0,9)
    await expect(page.locator('[data-edge-door="in"]')).toHaveCount(1);
    await expect(page.locator('[data-edge-door="in"]')).toHaveAttribute(
      'data-edge-kind',
      'ironEntry',
    );
    await expect(page.getByTestId('selection-id')).toHaveText('in');
    const start = inspector(page).getByRole('button', { name: 'The heroes start here' });
    await expect(start).toBeEnabled();
    await start.click();
    await expect(start).toBeDisabled();

    await clickAt(page, 0, 5, 0.06, 0.5);
    await expect(page.locator('.toast')).toContainText('iron entry');
    await tool(page, 'Wooden exit').click();
    await clickAt(page, 25, 9, 0.95, 0.5); // the east edge of (25,9)
    await expect(page.locator('[data-edge-door="out"]')).toHaveAttribute(
      'data-edge-kind',
      'woodenExit',
    );
    await expect(start).toHaveCount(0);
    await shot(page, 'editor-exterior-doors');

    // the kind chips: the start door cannot become an exit
    await tool(page, 'Select').click();
    await clickAt(page, 0, 9, 0.06, 0.5);
    await inspector(page).getByRole('button', { name: 'Wooden exit', exact: true }).click();
    await expect(page.locator('.toast')).toContainText('start');
    await inspector(page).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('[data-edge-door="in"]')).toHaveCount(0);
  });

  test('a door can be hidden or locked until a flag', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Doors').click();
    await clickAt(page, 3, 17, 0.5, 0.97);
    await tool(page, 'Select').click();
    await clickAt(page, 3, 17, 0.5, 0.97);
    await expect(inspector(page).getByLabel('Hidden until flag')).toHaveValue('');
    await inspector(page).getByLabel('Hidden until flag').fill('leverPulled');
    await inspector(page).getByLabel('Hidden until flag').blur();
    await inspector(page).getByLabel('Locked until flag').fill('keyFound');
    await inspector(page).getByLabel('Locked until flag').blur();
    // the flags stay when the kind changes (the id changes with it)
    await inspector(page).getByRole('button', { name: 'Secret', exact: true }).click();
    await expect(inspector(page).getByLabel('Hidden until flag')).toHaveValue('leverPulled');
    await expect(inspector(page).getByLabel('Locked until flag')).toHaveValue('keyFound');
  });

  test('everything survives an export and an import (Frozen Horror quest 0 plus new features)', async ({
    page,
  }) => {
    const source = readFileSync('src/content/quests/fh00-into-the-northlands.json', 'utf8');
    const original = JSON.parse(source);
    await newQuest(page, 'Other');
    await page.getByLabel('Import file').setInputFiles({
      name: 'fh0.hqquest.json',
      mimeType: 'application/json',
      buffer: Buffer.from(source),
    });
    await expect(page.locator('.fr-title')).toHaveText(original.title);
    await expect(page.locator('[data-tunnel]')).toHaveCount(6);
    await expect(page.locator('[data-board-tile]')).toHaveCount(2);
    await expect(page.locator('[data-room-tile]')).toHaveCount(2);
    await expect(page.locator('[data-edge-door="in"]')).toHaveCount(1);
    await expect(page.locator('[data-tile-flag="cageOpen"]')).toHaveCount(1);
    await shot(page, 'editor-fh00');

    // the box holds three pairs: a fourth is refused, then export
    await tool(page, 'Doors').click();
    await tool(page, 'Ice tunnel').click();
    await expect(page.getByTestId('tunnel-limit')).toContainText('3 of 3 pairs');
    await clickAt(page, 13, 9);
    await clickAt(page, 14, 9);
    await expect(page.locator('.toast')).toContainText('3 pairs');
    await expect(page.locator('[data-tunnel]')).toHaveCount(6);
    const [dl] = await Promise.all([page.waitForEvent('download'), btn(page, 'Export').click()]);
    const out = readFileSync((await dl.path())!, 'utf8');
    const json = JSON.parse(out);
    expect(json.boardTiles).toEqual(original.boardTiles);
    expect(json.roomTiles).toEqual(original.roomTiles);
    expect(json.edgeDoors).toEqual(original.edgeDoors);
    expect(json.start).toEqual(original.start);
    expect(json.tunnels).toEqual(original.tunnels);
    expect(json.doors).toEqual(original.doors);

    // import the exported file into a fresh draft: the map shows it all again
    await newQuest(page, 'Third');
    await page.getByLabel('Import file').setInputFiles({
      name: 'again.hqquest.json',
      mimeType: 'application/json',
      buffer: Buffer.from(out),
    });
    await expect(page.locator('.fr-title')).toHaveText(original.title);
    await expect(page.locator('[data-tunnel]')).toHaveCount(6);
    await expect(page.locator('[data-board-tile]')).toHaveCount(2);
    await expect(page.locator('[data-edge-door]')).toHaveCount(original.edgeDoors.length);
  });

  test('a door flag of a bundled Frozen Horror quest survives in the file the editor writes', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
    await page.getByLabel('Bundled quest').selectOption('105');
    await page.getByRole('button', { name: 'Edit it now' }).click();
    await expect(board(page)).toBeVisible();
    // the door of quest 5 that is hidden until a flag keeps the flag in the file
    const [dl] = await Promise.all([page.waitForEvent('download'), btn(page, 'Export').click()]);
    const json = JSON.parse(readFileSync((await dl.path())!, 'utf8'));
    const hidden = json.doors.filter((d: { hiddenUntil?: string }) => d.hiddenUntil);
    expect(hidden.length).toBeGreaterThan(0);
  });

  test('a quest can suggest a texture pack', async ({ page }) => {
    await newQuest(page);
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    await page.getByLabel('Suggested texture pack').fill('my-pack');
    await page.getByLabel('Suggested texture pack').blur();
    await expect(page.getByLabel('Suggested texture pack')).toHaveValue('my-pack');
  });
});

test('a copy of Frozen Horror quest 0 opens in the editor and keeps its tunnels (bug)', async ({
  page,
}) => {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
  await page.getByLabel('Bundled quest').selectOption('0');
  await page.getByRole('button', { name: 'Edit it now' }).click();
  await expect(board(page)).toBeVisible();
  await expect(page.locator('[data-tunnel]')).toHaveCount(6); // three tunnels, two ends each
  await expect(page.locator('[data-edge-door="in"]')).toHaveCount(1);
  await expect(page.locator('[data-board-tile="iceCaveEntrance"]')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Quest', exact: true }).click();
  await expect(page.getByLabel('Leave')).toHaveValue('through the cave');
});

test('the editor lists the Frozen Horror quests that share a number with a core quest (bug)', async ({
  page,
}) => {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
  const options = page.getByLabel('Bundled quest').locator('option');
  await expect(options).toHaveCount(1 + 14 + 10);
  await page.getByLabel('Bundled quest').selectOption('103');
  await page.getByRole('button', { name: 'Edit it now' }).click();
  await expect(board(page)).toBeVisible();
  await page.getByRole('tab', { name: 'Quest', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('The Rescue');
});

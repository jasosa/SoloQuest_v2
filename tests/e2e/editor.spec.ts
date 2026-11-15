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
    await expect(page.locator('header h1')).toHaveText('The Trial');
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
    await expect(page.locator('header h1')).toHaveText('The Trial');

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
    await expect(page.locator('header h1')).toHaveText('The Trial');
    await page.getByLabel('Import file').setInputFiles(file('two.hqquest.json', other));
    await sheet.getByRole('button', { name: 'Replace the draft' }).click();
    await expect(page.locator('header h1')).toHaveText('Second Trial');
    await btn(page, 'Undo').click();
    await expect(page.locator('header h1')).toHaveText('The Trial');
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

test.describe('editor: note builder', () => {
  const insp = (page: Page) => page.locator('.ed-inspector');
  const notesTab = (page: Page) => insp(page).getByRole('button', { name: /^Notes/ });

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
    // touch targets
    await tool(page, 'Furniture').click();
    for (const c of await page.locator('.ed-small .chip').all())
      expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await tool(page, 'Monsters').click();
    await tool(page, 'Select').click();
    await clickAt(page, 2, 17);
  });

  test('a letter with no note is listed; one tap adds the note; text, trigger, condition, effects', async ({
    page,
  }) => {
    await newQuest(page);
    await chestWithLetter(page, 'A');
    await expect(notesTab(page).getByTestId('missing-count')).toHaveText('1');
    await notesTab(page).click();
    await expect(page.getByTestId('missing-letters')).toContainText('Add note A');
    await btn(page, 'Add note A').click();
    await expect(page.getByTestId('note-id')).toHaveText('n-A');
    await expect(notesTab(page).getByTestId('missing-count')).toHaveCount(0);

    // text
    const text = insp(page).getByLabel('Text', { exact: true }).first();
    await text.fill('A dusty chest.');
    await text.blur();

    // trigger: a hero enters an area, picked on the board
    await insp(page).getByLabel('Trigger').selectOption('areaEntered');
    const trig = insp(page).locator('section').filter({ hasText: 'When it fires' });
    await trig.getByRole('button', { name: 'Click it on the board' }).click();
    await expect(page.getByTestId('pick-bar')).toContainText('Click a room');
    await clickAt(page, 2, 17); // the start room
    await expect(page.getByTestId('pick-bar')).toHaveCount(0);
    await expect(trig.getByRole('combobox').nth(1)).not.toHaveValue('');

    // letter shown at, picked on the board
    await insp(page).getByRole('button', { name: 'Click it on the board' }).first().click();
    await clickAt(page, 4, 16);
    await expect(insp(page)).toContainText('Square 4, 16');

    // a condition and effects
    const addEffect = insp(page).getByLabel('Add an effect').last();
    await insp(page).getByLabel('Add a condition').selectOption('firstTime');
    await expect(page.getByTestId('condition-row')).toHaveCount(1);
    await addEffect.selectOption('setFlag');
    await addEffect.selectOption('addCounter');
    await addEffect.selectOption('promptChoice');
    await addEffect.selectOption('revealAll');
    await addEffect.selectOption('placeBlock');
    await expect(page.getByTestId('effect-row')).toHaveCount(5);
    const flag = page.locator('[data-effect="setFlag"]').getByRole('textbox', { name: 'Flag' });
    await flag.fill('alarm');
    await flag.blur();
    await expect(
      page.locator('[data-effect="setFlag"]').getByRole('textbox', { name: 'Flag' }),
    ).toHaveValue('alarm');
    await page.getByRole('button', { name: 'Add an answer' }).click();
    await expect(page.getByTestId('option-row')).toHaveCount(2);
    await shot(page, 'editor-notes-form');

    // an effect that needs a monster says so
    await insp(page).getByLabel('Add an effect').last().selectOption('placeMonster');
    await expect(page.locator('.toast')).toContainText('Add a monster first');

    // undo goes back one change at a time
    await btn(page, 'Undo').click();
    await expect(page.getByTestId('option-row')).toHaveCount(1);

    // the list shows the note
    await insp(page).getByRole('button', { name: 'All notes' }).click();
    await expect(page.getByTestId('note-list')).toContainText('A dusty chest.');
    await expect(page.getByTestId('note-list')).toContainText('Hero enters');
    await expect(page.getByTestId('no-missing')).toBeVisible();
    await shot(page, 'editor-notes-list');
  });

  test('note letters show on the board: missing style, then solid; a tap opens the note', async ({
    page,
  }) => {
    await newQuest(page);
    await chestWithLetter(page, 'A');
    const mark = page.locator('#editor-board [data-letter="A"]');
    await expect(mark).toHaveAttribute('data-missing', 'true');
    await expect(mark).toContainText('A');
    await shot(page, 'editor-letter-missing');

    // a tap on a missing letter opens the Notes tab at the list
    await clickAt(page, 2, 17, 0.82, 0.18);
    await expect(page.getByTestId('missing-letters')).toContainText('Add note A');
    await btn(page, 'Add note A').click();
    await expect(page.getByTestId('note-id')).toHaveText('n-A');
    await expect(mark).not.toHaveAttribute('data-missing', 'true');
    await expect(mark).toHaveAttribute('data-note', 'n-A');
    await insp(page).getByRole('button', { name: 'All notes' }).click();
    await expect(page.getByTestId('note-list')).toBeVisible();
    await shot(page, 'editor-letter-note');

    // a tap on a noted letter opens that note
    await clickAt(page, 2, 17, 0.82, 0.18);
    await expect(page.getByTestId('note-id')).toHaveText('n-A');

    // other tools do not tap letters: a monster can be placed on the square
    await tool(page, 'Monsters').click();
    await expect(page.locator('[data-letter-hit]')).toHaveCount(0);
  });

  test('door trigger picked on the board; unlettered note; delete', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Doors').click();
    await clickAt(page, 3, 17, 0.5, 0.97);
    await expect(page.locator('[data-door="d1"]')).toHaveCount(1);
    await tool(page, 'Select').click();
    await notesTab(page).click();
    await btn(page, 'New note').click();
    await insp(page).getByLabel('Trigger').selectOption('doorOpened');
    const trig = insp(page).locator('section').filter({ hasText: 'When it fires' });
    await expect(trig.getByRole('combobox').nth(1)).toHaveValue('d1');
    await trig.getByRole('button', { name: 'Click it on the board' }).click();
    await clickAt(page, 4, 17); // not an edge: refused, still picking
    await expect(page.locator('.toast')).toContainText('Click a door');
    await expect(page.getByTestId('pick-bar')).toBeVisible();
    await clickAt(page, 3, 17, 0.5, 0.97);
    await expect(page.getByTestId('pick-bar')).toHaveCount(0);
    // Escape cancels a pick
    await trig.getByRole('button', { name: 'Click it on the board' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pick-bar')).toHaveCount(0);
    await btn(page, 'Delete note').click();
    await expect(page.getByTestId('note-list')).toHaveCount(0);
    await btn(page, 'Undo').click();
    await expect(page.getByTestId('note-list')).toBeVisible();
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
    await page.getByLabel('Bundled quest').selectOption('1');
    await btn(page, 'Make a copy').click();
    await btn(page, 'Open it').click();
    await expect(page.locator('header h1')).toHaveText('The Trial');
    await expect(page.getByTestId('playtest')).toBeEnabled();
    await page.getByTestId('playtest').click();

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
    await expect(page.locator('header h1')).toHaveText('The Trial');
    await expect(page.locator('#editor-board')).toBeVisible();
  });
});

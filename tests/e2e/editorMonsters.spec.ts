import { expect, test, type Page } from '@playwright/test';
import { monsterCard } from './helpers';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/${name}.png` });
};
const board = (page: Page) => page.locator('#editor-board');
const tool = (page: Page, name: string) =>
  page.locator('.ed-tools').getByRole('button', { name, exact: true });
const kinds = (page: Page) => page.getByTestId('monster-kind-list');
const placing = (page: Page) => page.getByTestId('placing');

async function clickAt(page: Page, x: number, y: number) {
  const box = (await board(page).boundingBox())!;
  const k = box.width / (26 * 34 + 4);
  await page.mouse.click(box.x + ((x + 0.5) * 34 + 2) * k, box.y + ((y + 0.5) * 34 + 2) * k);
}

async function newQuest(page: Page) {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^New quest/ }).click();
  await page.getByLabel('Title').first().fill('Monsters');
  await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
  await expect(page.locator('header.page-head h1')).toHaveText('Monsters');
}

test.describe('editor: the Monsters tool, kinds and cards', () => {
  test('the list of kinds: by box, no Custom group, My library always there', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    await expect(page.locator('.ed-inspector h2').first()).toHaveText('Monsters');
    const list = kinds(page);
    await expect(list.getByRole('button', { name: /^Core game/ })).toContainText('9');
    await expect(list.getByRole('button', { name: /^Frozen Horror/ })).toContainText('8');
    await expect(list.getByRole('button', { name: /^My library/ })).toContainText('0');
    // a quest with no enemy of its own has no "This quest" kind
    await expect(list.getByRole('button', { name: /^This quest/ })).toHaveCount(0);
    await expect(page.getByText('Custom monsters')).toHaveCount(0);
    await expect(page.getByTestId('placing')).toHaveCount(0);
    for (const b of await list.getByRole('button').all())
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot(page, 'monsters-kinds');
  });

  test('every bar is the colour of its box from My collection; what the player made is neutral', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    const colour = (name: RegExp) =>
      kinds(page)
        .getByRole('button', { name })
        .evaluate((e) => getComputedStyle(e).borderLeftColor);
    const core = await colour(/^Core game/);
    expect(core).toBe('rgb(110, 31, 42)');
    expect(await colour(/^Frozen Horror/)).toBe('rgb(59, 107, 140)');
    // what the player made (My library, This quest) is neutral: the --muted token
    expect(await colour(/^My library/)).toBe('rgb(109, 90, 78)');
  });

  test('open Frozen Horror, pick Yeti, go back and place with the pick still on, Clear', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    await kinds(page)
      .getByRole('button', { name: /^Frozen Horror/ })
      .click();
    // the kind rows are gone: a header with the Back button, the kind and its count
    const head = page.getByTestId('monster-kind-open');
    await expect(head).toContainText('Frozen Horror');
    await expect(head).toContainText('8');
    await expect(kinds(page)).toHaveCount(0);
    await expect(page.locator('.mk-card')).toHaveCount(8);
    await expect(monsterCard(page, 'Yeti')).toContainText('8 · 3 · 3 · 5 · 2');
    expect(
      (await page.getByRole('button', { name: 'Back to the kinds' }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    await monsterCard(page, 'Yeti').click();
    await expect(monsterCard(page, 'Yeti')).toHaveAttribute('aria-pressed', 'true');
    await expect(placing(page)).toContainText('Placing Yeti');
    await shot(page, 'monsters-picked');

    // back to the list: the pick stays, and the board still places a Yeti
    await page.getByRole('button', { name: 'Back to the kinds' }).click();
    await expect(kinds(page)).toBeVisible();
    await expect(placing(page)).toContainText('Placing Yeti');
    await shot(page, 'monsters-list-picked');
    await clickAt(page, 4, 17);
    await expect(page.locator('[data-monster]')).toHaveCount(1);
    await clickAt(page, 5, 17);
    await expect(page.locator('[data-monster]')).toHaveCount(2);
    await expect(placing(page)).toContainText('Placing Yeti');
    // the library enemy was copied into the quest the first time: This quest has it now
    await expect(kinds(page).getByRole('button', { name: /^This quest/ })).toContainText('1');

    // Clear drops the pick; a tap on the board then places nothing and says why
    await placing(page).getByRole('button', { name: 'Clear' }).click();
    await expect(placing(page)).toHaveCount(0);
    await clickAt(page, 6, 17);
    await expect(page.locator('.toast')).toContainText('Pick a monster');
    await expect(page.locator('[data-monster]')).toHaveCount(2);
  });

  test('Esc and another tool drop the pick; the tool stays on after Esc', async ({ page }) => {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    await kinds(page)
      .getByRole('button', { name: /^Core game/ })
      .click();
    await monsterCard(page, 'Orc').click();
    await expect(placing(page)).toContainText('Placing Orc');
    await page.keyboard.press('Escape');
    await expect(placing(page)).toHaveCount(0);
    await expect(tool(page, 'Monsters')).toHaveAttribute('aria-pressed', 'true');
    // pick again, change tool and come back: nothing is picked
    await monsterCard(page, 'Orc').click();
    await expect(placing(page)).toBeVisible();
    await tool(page, 'Rock').click();
    await tool(page, 'Monsters').click();
    await expect(placing(page)).toHaveCount(0);
    await expect(kinds(page)).toBeVisible();
  });

  test('My library with no enemy: the hint, and the word Library goes to the Library tab', async ({
    page,
  }) => {
    await newQuest(page);
    await tool(page, 'Monsters').click();
    await kinds(page)
      .getByRole('button', { name: /^My library/ })
      .click();
    await expect(page.locator('.mk-card')).toHaveCount(0);
    await expect(page.getByTestId('make-enemies')).toContainText('Make enemies in the Library');
    await shot(page, 'monsters-my-library-empty');
    await page.getByTestId('make-enemies').getByRole('button', { name: 'Library' }).click();
    await expect(page.getByRole('tab', { name: 'Library', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('many kinds scroll inside the card; the card does not grow', async ({ page }) => {
    await page.setViewportSize({ width: 1194, height: 520 });
    await newQuest(page);
    await tool(page, 'Monsters').click();
    const list = kinds(page);
    const card = page.locator('.ed-inspector');
    const before = await card.boundingBox();
    // clone rows as a stand-in for many expansions
    await list.evaluate((el) => {
      const row = el.firstElementChild!;
      for (let i = 0; i < 20; i++) el.appendChild(row.cloneNode(true));
    });
    const m = await list.evaluate((el) => ({ s: el.scrollHeight, c: el.clientHeight }));
    expect(m.s).toBeGreaterThan(m.c);
    const after = await card.boundingBox();
    expect(after!.height).toBe(before!.height);
    await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });
});

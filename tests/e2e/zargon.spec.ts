import { expect, test, type Page } from '@playwright/test';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(450); // let the slide finish
  await page.screenshot({ path: `test-results/${name}.png` });
};
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const zbutton = (page: Page) => page.locator('.zargon-btn');
const zpage = (page: Page) => page.locator('.zpage');
const orders = (page: Page) => page.locator('.zpage .orders li.order');

const quest1 = (page: Page, open: string, team = 'dwarf,elf,wizard', seed = 5) =>
  page.goto(`/?quest=1&team=${team}&nosave=1&seed=${seed}&open=${open}`);

test.describe("Zargon's turn page", () => {
  test('slides in over the column, with orders, tie list and plan', async ({ page }) => {
    await quest1(page, 'd1,d2');
    await expect(zbutton(page)).toContainText('2 monsters to act');
    await expect(zpage(page)).not.toHaveClass(/open/);
    await zbutton(page).click();
    await expect(zpage(page)).toHaveClass(/open/);
    await expect(zpage(page).locator('h2')).toHaveText("Zargon's turn");
    await expect(zpage(page)).toContainText('Turn 1');
    await expect(zpage(page).locator('.seg-help')).toContainText('character sheets');
    await expect(orders(page).first().locator('dt', { hasText: 'Target' })).toBeVisible();
    await expect(orders(page).first().locator('dt', { hasText: 'Tie' })).toBeVisible();
    await expect(orders(page).first().locator('dt', { hasText: 'Plan' })).toBeVisible();
    await expect(orders(page).first().locator('.tgt')).toContainText('›');
    // the coins match the tokens on the map
    await expect(orders(page).first().locator('.coin').first()).toHaveText(/^O\d$/);
    await shot(page, 'zargon-priority');
    await page.getByRole('button', { name: 'Back to the map' }).click();
    await expect(zpage(page)).not.toHaveClass(/open/);
  });

  test('no monsters: a friendly empty state', async ({ page }) => {
    await quest1(page, '');
    await expect(zbutton(page)).toContainText('no monster to act');
    await zbutton(page).click();
    await expect(zpage(page)).toContainText('No monster in sight. Zargon waits.');
  });

  test('the same seed gives the same orders after a reload', async ({ page }) => {
    const read = async () => {
      await quest1(page, 'd1,d2', 'dwarf,elf,wizard', 7);
      await zbutton(page).click();
      return orders(page).allInnerTexts();
    };
    const a = await read();
    const b = await read();
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  test('Done marks an entry, moves it down, ticks the roster; undo restores', async ({ page }) => {
    await quest1(page, 'd1,d2');
    await zbutton(page).click();
    const before = await orders(page).count();
    await orders(page).first().getByRole('button', { name: /^Done/ }).click();
    await expect(page.locator('.zpage .order.done').first()).toBeVisible();
    await expect(orders(page).last()).toHaveClass(/done/);
    await expect(page.locator('.roster .tickdone').first()).toBeVisible();
    await shot(page, 'zargon-done');
    // the right column button counts what is left
    await page.getByRole('button', { name: 'Back to the map' }).click();
    await expect(zbutton(page)).not.toContainText('2 monsters to act');
    await btn(page, 'Undo').first().click();
    await expect(page.locator('.zpage .order.done')).toHaveCount(0);
    await expect(page.locator('.roster .tickdone')).toHaveCount(0);
    await expect(zbutton(page)).toContainText('2 monsters to act');
    expect(await orders(page).count()).toBe(before);
  });

  test('"Who can it reach?" gives a result that changes with the taps', async ({ page }) => {
    await quest1(page, 'd1,d2');
    await zbutton(page).click();
    await page.getByRole('button', { name: 'Who can it reach?', exact: true }).click();
    await expect(zpage(page).locator('.seg')).toHaveAttribute('data-mode', 'reach');
    await expect(zpage(page).locator('.seg-help')).toContainText('Tap the heroes');
    const first = orders(page).first();
    await expect(first.locator('.verdict')).toContainText('It can reach no hero.');
    await first.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await expect(first.locator('.verdict')).toContainText('Target: Dwarf');
    await first.getByRole('button', { name: 'Elf', exact: true }).click();
    await first.getByRole('button', { name: 'Wizard', exact: true }).click();
    await expect(first.locator('.verdict')).not.toContainText('It can reach no hero.');
    await first.getByRole('button', { name: /Already next to the Dwarf/ }).click();
    await expect(first.getByRole('button', { name: /Already next to the Dwarf/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await shot(page, 'zargon-reach');
  });

  test("End Zargon's turn: turn counter, page closes, done and reach are cleared", async ({
    page,
  }) => {
    await quest1(page, 'd1,d2');
    await zbutton(page).click();
    await orders(page).first().getByRole('button', { name: /^Done/ }).click();
    await page.getByRole('button', { name: 'Who can it reach?', exact: true }).click();
    // reach mode keeps the reveal order: the first monster is the one marked done, use the second
    await orders(page).nth(1).getByRole('button', { name: 'Dwarf', exact: true }).click();
    await btn(page, "End Zargon's turn").click();
    await expect(page.locator('header .turn')).toContainText('Turn 2');
    await expect(zpage(page)).not.toHaveClass(/open/);
    await expect(page.locator('.toast')).toContainText("Heroes' turn 2");
    await zbutton(page).click();
    await expect(zpage(page)).toContainText('Turn 2');
    await expect(page.locator('.zpage .order.done')).toHaveCount(0);
    await page.getByRole('button', { name: 'Who can it reach?', exact: true }).click();
    await expect(
      orders(page).nth(1).getByRole('button', { name: 'Dwarf', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('the page can be ended with monsters not done, and closes with Esc', async ({ page }) => {
    await quest1(page, 'd1,d2');
    await zbutton(page).click();
    await page.keyboard.press('Escape');
    await expect(zpage(page)).not.toHaveClass(/open/);
    await zbutton(page).click();
    await btn(page, "End Zargon's turn").click();
    await expect(page.locator('header .turn')).toContainText('Turn 2');
  });

  test('a fresh wanderer shows its note and no Done; it joins the orders next turn', async ({
    page,
  }) => {
    await quest1(page, 'd1,d2,d3');
    await page.waitForTimeout(900);
    await page.locator('[data-room-cell="9,13"]').click();
    for (const hero of ['Dwarf', 'Elf']) {
      await btn(page, 'Search for treasure').click();
      await btn(page, 'The room is clear, search anyway').click();
      await btn(page, hero).click();
      if (hero === 'Dwarf') {
        await btn(page, 'Continue').click();
        await page.locator('[data-room-cell="9,13"]').click();
      }
    }
    await btn(page, 'It was a wandering monster').click();
    await btn(page, 'Placed next to the Elf').click();
    await btn(page, 'Done').click();
    await zbutton(page).click();
    const note = page.locator('.zpage .order', { hasText: 'already attacked this round' });
    await expect(note).toHaveCount(1);
    await expect(note.getByRole('button', { name: /^Done/ })).toHaveCount(0);
    await shot(page, 'zargon-fresh');
    await btn(page, "End Zargon's turn").click();
    await zbutton(page).click();
    await expect(
      page.locator('.zpage .order', { hasText: 'already attacked this round' }),
    ).toHaveCount(0);
  });

  test('a caster asks "Could it cast it?": No shows the next spell, Yes ends its casting', async ({
    page,
  }) => {
    await page.goto('/?quest=test&team=dwarf,elf,wizard&nosave=1&seed=3&open=d1');
    await btn(page, 'Wake the guardian').click();
    await btn(page, 'Done').click();
    await zbutton(page).click();
    const caster = orders(page).first(); // the placed guardian is the only monster in sight
    await expect(orders(page)).toHaveCount(1);
    await expect(caster.locator('.spell')).toContainText('Read the Dread spell card.');
    await expect(caster.locator('.spell')).toContainText('If it cannot cast:');
    await expect(caster.locator('.spell')).toContainText('Could it cast it?');
    // no spell effect text is shown, only the name and the pointer to the card
    const first = await caster.locator('.sname b').innerText();
    await shot(page, 'zargon-spell');

    await btn(page, 'No').click();
    const second = await caster.locator('.sname b').innerText();
    expect(second).not.toBe(first);
    await btn(page, 'No').click();
    // both spells declined: no spell this turn, and the normal plan
    await expect(caster).toContainText('No spell this turn.');
    await expect(caster.locator('.spell')).toHaveCount(0);
    await expect(caster.locator('dt', { hasText: 'Plan' })).toBeVisible();
    await shot(page, 'zargon-no-spell');
    // undo brings the question back
    await btn(page, 'Back to the map').click();
    await btn(page, 'Undo').first().click();
    await zbutton(page).click();
    await expect(caster.locator('.spell')).toHaveCount(1);

    await btn(page, 'Yes, it cast it').click();
    await expect(caster).toContainText('It already cast a spell this turn.');
    await expect(caster.locator('dt', { hasText: 'Plan' })).toHaveCount(0);
    // Done is still there
    await caster.getByRole('button', { name: /^Done/ }).click();
    await expect(page.locator('.zpage .order.done')).toHaveCount(1);
  });
});

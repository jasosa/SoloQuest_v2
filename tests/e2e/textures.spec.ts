import { strToU8, zipSync } from 'fflate';
import { expect, test } from '@playwright/test';
import { newGame } from './helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

function pack(id: string, name: string): Buffer {
  const manifest = {
    format: 'sqtextures',
    version: 1,
    id,
    name,
    floor: ['floor.png'],
    wall: 'w.png',
  };
  return Buffer.from(
    zipSync({
      'theme.json': strToU8(JSON.stringify(manifest)),
      'floor.png': new Uint8Array(PNG),
      'w.png': new Uint8Array(PNG),
    }),
  );
}

const file = (name: string, buffer: Buffer) => ({ name, mimeType: 'application/zip', buffer });

test.describe('texture packs (decision 78)', () => {
  test('import a pack, use it in a quest, go back to Classic', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await expect(dlg.getByTestId('pack-list')).toContainText('Classic');
    await expect(dlg).toContainText('In use');

    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('a.sqtextures', pack('mine', 'My stones')));
    await expect(dlg.locator('[data-pack="mine"]')).toContainText('My stones');
    await expect(dlg.locator('[data-pack="mine"]')).toContainText('Fan-made');
    await dlg
      .locator('[data-pack="mine"]')
      .getByRole('button', { name: 'Use', exact: true })
      .click();
    await expect(dlg.locator('[data-pack="mine"]')).toContainText('In use');
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();

    // play a quest: the floor uses the pack's picture
    await newGame(page, ['Dwarf']);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-themed="floor"]').first()).toBeAttached();
  });

  test('a bad file is refused with a sentence, and nothing is added', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('bad.sqtextures', Buffer.from('nope')));
    await expect(dlg.getByRole('alert')).toContainText('not a texture pack');
    await expect(dlg.locator('[data-pack]')).toHaveCount(0);
  });

  test('delete asks twice, and deleting the pack in use goes back to Classic', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('a.sqtextures', pack('mine', 'My stones')));
    const row = dlg.locator('[data-pack="mine"]');
    await row.getByRole('button', { name: 'Use', exact: true }).click();
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(row).toBeVisible(); // not deleted yet
    await row.getByRole('button', { name: 'Really delete' }).click();
    await expect(dlg.locator('[data-pack]')).toHaveCount(0);
    await expect(dlg.getByTestId('pack-list')).toContainText('In use');
  });

  test('the dialog buttons are at least 44 px tall', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('a.sqtextures', pack('mine', 'My stones')));
    for (const name of ['Use', 'Export', 'Delete', 'Import a pack', 'Close']) {
      const b = dlg.getByRole('button', { name, exact: true }).first();
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('the quest select screen says which texture pack is in use', async ({ page }) => {
    await page.goto('/?nosave=1');
    const link = page.getByTestId('textures-link');
    await expect(link).toHaveText('Textures');
    await link.click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('a.sqtextures', pack('mine', 'My stones')));
    await dlg
      .locator('[data-pack="mine"]')
      .getByRole('button', { name: 'Use', exact: true })
      .click();
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(link).toHaveText('Textures: My stones');
    // back to Classic: the name goes away
    await link.click();
    await dlg.getByRole('button', { name: 'Use Classic' }).click();
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(link).toHaveText('Textures');
  });

  test('Preview shows a sample board, checks the pictures and lists the empty slots', async ({
    page,
  }) => {
    const manifest = {
      format: 'sqtextures',
      version: 1,
      id: 'tiny',
      name: 'Tiny pack',
      monster: { orc: 'orc.png' },
    };
    const tiny = Buffer.from(
      zipSync({
        'theme.json': strToU8(JSON.stringify(manifest)),
        'orc.png': new Uint8Array(PNG),
      }),
    );
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg.getByLabel('Texture pack file').setInputFiles(file('tiny.sqtextures', tiny));
    await dlg.getByTestId('preview-tiny').click();
    const prev = page.getByRole('dialog', { name: 'Preview: Tiny pack' });
    await expect(prev.getByTestId('pack-sample')).toBeVisible();
    // the orc picture is 1 x 1 px but shown about 32 px wide: it is reported
    await expect(prev.getByRole('status').first()).toContainText('monster orc: 1 x 1 px');
    // everything else is empty
    await expect(prev.getByTestId('pack-missing')).toContainText('board picture');
    await expect(prev.getByTestId('pack-missing')).toContainText('furniture table');
    await expect(prev.getByTestId('pack-missing')).not.toContainText('monster orc');
    // the sample draws the orc with the pack's picture and everything else with the built-in drawing
    await expect(prev.locator('image')).toHaveCount(1);
    await prev.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(prev).toHaveCount(0);
    await expect(dlg).toBeVisible();
  });

  test('Preview: adjust the size and position of a picture, save it, and it is kept', async ({
    page,
  }) => {
    const manifest = {
      format: 'sqtextures',
      version: 1,
      id: 'tune-me',
      name: 'Tune me',
      monster: { orc: 'orc.png' },
    };
    const zipped = Buffer.from(
      zipSync({
        'theme.json': strToU8(JSON.stringify(manifest)),
        'orc.png': new Uint8Array(PNG),
      }),
    );
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg.getByLabel('Texture pack file').setInputFiles(file('tune.sqtextures', zipped));
    await dlg.getByTestId('preview-tune-me').click();
    const prev = page.getByRole('dialog', { name: 'Preview: Tune me' });
    const orc = prev.locator('[data-slot="monster.orc"] image');
    await expect(orc).toHaveAttribute('width', '32');
    await expect(prev.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    // nothing picked yet: the sample and the knobs are not pinned, so the board picture below stays reachable
    await expect(prev.getByTestId('pack-work')).not.toHaveClass(/pinned/);
    // tapping the picture in the sample chooses it
    await prev.locator('[data-slot="monster.orc"]').click();
    await expect(prev.getByLabel('Picture to adjust')).toHaveValue('monster.orc');
    // while adjusting, they stay pinned at the top of the dialog
    await expect(prev.getByTestId('pack-work')).toHaveClass(/pinned/);
    // a tap on + is 1%: five taps, 105%, drawn 33.6 px wide
    for (let i = 0; i < 5; i++) await prev.getByRole('button', { name: 'Size: more' }).click();
    await expect(prev.getByTestId('pack-adjust')).toContainText('105%');
    await expect(orc).toHaveAttribute('width', '33.6');
    // the slider moves in 1% steps too, for bigger changes: 125%, drawn 40 px wide
    await prev.getByLabel('Size', { exact: true }).fill('1.25');
    await expect(prev.getByTestId('pack-adjust')).toContainText('125%');
    await expect(orc).toHaveAttribute('width', '40');
    await prev.getByRole('button', { name: 'Size: more' }).click();
    await expect(prev.getByTestId('pack-adjust')).toContainText('126%');
    await prev.getByRole('button', { name: 'Size: less' }).click();
    await expect(prev.getByTestId('pack-adjust')).toContainText('125%');
    await expect(prev.getByText('Unsaved changes')).toBeVisible();
    // the buttons are big enough for a finger
    for (const name of ['Size: less', 'Size: more', 'Right: more', 'Down: less']) {
      expect(
        (await prev.getByRole('button', { name }).boundingBox())!.height,
      ).toBeGreaterThanOrEqual(44);
    }
    // a position too: half a square to the right, then a hundredth back
    await prev.getByLabel('Right', { exact: true }).fill('0.5');
    await prev.getByRole('button', { name: 'Right: less' }).click();
    await expect(prev.getByTestId('pack-adjust')).toContainText('+0.49 square');
    await prev.getByRole('button', { name: 'Right: more' }).click();
    await expect(prev.getByTestId('pack-adjust')).toContainText('+0.50 square');
    // held down, a button keeps going (and gets faster): the size passes 140% within a few seconds
    const more = prev.getByRole('button', { name: 'Size: more' });
    const box = (await more.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const sizeNow = async () =>
      Number(((await prev.getByTestId('pack-adjust').innerText()).match(/(\d+)%/) ?? [])[1] ?? 0);
    await expect.poll(sizeNow, { timeout: 4000 }).toBeGreaterThan(140);
    await page.mouse.up();
    await prev.getByLabel('Size', { exact: true }).fill('1.25');
    await prev.getByRole('button', { name: 'Save changes' }).click();
    await expect(dlg.getByRole('status')).toContainText('Saved the changes to Tune me');
    await expect(prev.getByText('Unsaved changes')).toHaveCount(0);

    // close and open again: the change was kept
    await prev.getByRole('button', { name: 'Close', exact: true }).click();
    await dlg.getByTestId('preview-tune-me').click();
    const again = page.getByRole('dialog', { name: 'Preview: Tune me' });
    await again.locator('[data-slot="monster.orc"]').click();
    await expect(again.getByTestId('pack-adjust')).toContainText('125%');
    await expect(again.getByTestId('pack-adjust')).toContainText('+0.50 square');
    // reset puts it back
    await again.getByRole('button', { name: 'Reset this picture' }).click();
    await expect(again.locator('[data-slot="monster.orc"] image')).toHaveAttribute('width', '32');
  });
});

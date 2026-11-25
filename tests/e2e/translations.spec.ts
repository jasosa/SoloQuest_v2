import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openSettings } from './helpers';

const START = 'quest:q01-the-trial:notes.n-start.effects.0.text';

test.describe('translations (decision 92)', () => {
  test('make a language, translate the interface and a quest note, use it, export, delete, import', async ({
    page,
  }) => {
    await page.goto('/');
    await openSettings(page);
    await page.getByTestId('translations-link').click();
    const dlg = page.getByRole('dialog', { name: 'Translations' });

    // English is built in and has no edit, export or delete
    const en = dlg.locator('[data-language="en"]');
    await expect(en).toContainText('Stays on this device');
    await expect(en).toContainText('cannot be deleted');
    await expect(en).toContainText('In use');
    await expect(en.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    // a new language is a copy of English
    await dlg.getByRole('button', { name: 'New language' }).click();
    await dlg.getByLabel('Name').fill('Espanol');
    await dlg.getByLabel('Code').fill('es');
    await dlg.getByRole('button', { name: 'Make it from English' }).click();
    const editor = page.getByRole('dialog', { name: 'Translate Espanol' });

    // a select screen text
    await editor.getByRole('searchbox').fill('select.myCollection');
    await editor.getByLabel('Translation of select.myCollection').fill('Inicio');
    // a quest note text
    await editor.getByRole('searchbox').fill(START);
    await expect(editor.locator(`[data-key="${START}"]`)).toContainText('Not translated');
    await editor.getByLabel(`Translation of ${START}`).fill('Pon a los heroes en la escalera.');
    await expect(editor.locator(`[data-key="${START}"]`)).not.toContainText('Not translated');
    await editor.getByRole('searchbox').fill('quest:q01-the-trial:title');
    await editor.getByLabel('Translation of quest:q01-the-trial:title').fill('La Prueba');
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editor).toContainText('Saved.');
    await editor.getByRole('button', { name: 'Back to the list' }).click();
    await expect(dlg.locator('[data-language="es"]')).toContainText('Espanol');

    // use it: the page loads again in the new language
    await Promise.all([
      page.waitForNavigation(),
      dlg.locator('[data-language="es"]').getByRole('button', { name: 'Use', exact: true }).click(),
    ]);
    await expect(page.getByTestId('home-collection')).toContainText('Inicio');
    await page.getByTestId('home-single').click();
    await page.getByTestId('pack-core').click();
    await expect(page.getByRole('button', { name: /La Prueba/ })).toBeVisible();
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    await openSettings(page);
    await expect(page.getByTestId('translations-link')).toContainText('Espanol');

    // the quest note shows in the language
    await page.goto('/?quest=1');
    await expect(page.getByRole('dialog', { name: 'Start' })).toContainText(
      'Pon a los heroes en la escalera.',
    );

    // export, delete, import the same file
    await page.goto('/');
    await openSettings(page);
    await page.getByTestId('translations-link').click();
    const list = page.getByRole('dialog', { name: 'Translations' });
    const download = page.waitForEvent('download');
    await list.locator('[data-language="es"]').getByRole('button', { name: 'Export' }).click();
    const file = await (await download).path();
    const exported = JSON.parse(readFileSync(file, 'utf8')) as {
      format: string;
      language: { code: string };
      strings: Record<string, string>;
    };
    expect(exported.format).toBe('soloquest-language');
    expect(exported.strings['select.myCollection']).toBe('Inicio');
    expect(exported.strings[START]).toBe('Pon a los heroes en la escalera.');

    await Promise.all([
      page.waitForNavigation(),
      list
        .locator('[data-language="es"]')
        .getByRole('button', { name: 'Delete' })
        .click()
        .then(() =>
          list
            .locator('[data-language="es"]')
            .getByRole('button', { name: 'Really delete' })
            .click(),
        ),
    ]);
    await expect(page.getByTestId('home-single')).toBeVisible();
    await openSettings(page);
    await page.getByTestId('translations-link').click();
    const again = page.getByRole('dialog', { name: 'Translations' });
    await expect(again.locator('[data-language="es"]')).toHaveCount(0);

    await again.getByLabel('Translation file').setInputFiles(file);
    await expect(again.locator('[data-language="es"]')).toContainText('Espanol');
    await expect(again).toContainText('Added Espanol');

    // a file of English texts is merged into English; English is never replaced or deleted
    await again.getByLabel('Translation file').setInputFiles({
      name: 'en.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          ...exported,
          language: { name: 'English (edited)', code: 'en' },
          strings: { 'select.myCollection': 'Pick one' },
        }),
      ),
    });
    await expect(again).toContainText('Merged 1 texts into English');
    await expect(
      again.locator('[data-language="en"]').getByRole('button', { name: 'Delete' }),
    ).toHaveCount(0);
    await expect(again.locator('[data-language="en"]')).toContainText('1 changed');

    // a broken file gives a friendly message
    await again.getByLabel('Translation file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not json'),
    });
    await expect(again.getByRole('alert')).toContainText('not valid JSON');
  });

  test('English can be changed and reset, never deleted', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    await page.getByTestId('translations-link').click();
    const dlg = page.getByRole('dialog', { name: 'Translations' });
    const en = dlg.locator('[data-language="en"]');
    await expect(en).toContainText('cannot be deleted');
    await expect(en.getByRole('button', { name: 'Delete' })).toHaveCount(0);

    // change a text of English
    await en.getByRole('button', { name: 'Edit' }).click();
    const editor = page.getByRole('dialog', { name: 'Edit English' });
    await editor.getByRole('searchbox').fill('select.myCollection');
    const field = editor.getByLabel('Translation of select.myCollection');
    await expect(field).toHaveValue('My collection');
    await field.fill('Pick a quest');
    await expect(editor.locator('[data-key="select.myCollection"]')).toContainText('Changed');
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editor).toContainText('Saved.');
    await Promise.all([
      page.waitForNavigation(),
      editor.getByRole('button', { name: 'Back to the list' }).click(),
    ]);
    await expect(page.getByTestId('home-collection')).toContainText('Pick a quest');

    // a language made now starts from the changed English, and falls back to it
    await openSettings(page);
    await page.getByTestId('translations-link').click();
    const again = page.getByRole('dialog', { name: 'Translations' });
    await expect(again.locator('[data-language="en"]')).toContainText('1 changed');

    // reset one text, then everything
    await again.locator('[data-language="en"]').getByRole('button', { name: 'Edit' }).click();
    const ed2 = page.getByRole('dialog', { name: 'Edit English' });
    await ed2.getByRole('searchbox').fill('select.myCollection');
    await ed2.getByRole('button', { name: 'Reset select.myCollection' }).click();
    await expect(ed2.getByLabel('Translation of select.myCollection')).toHaveValue('My collection');
    await ed2.getByRole('button', { name: 'Save', exact: true }).click();
    await Promise.all([
      page.waitForNavigation(),
      ed2.getByRole('button', { name: 'Back to the list' }).click(),
    ]);
    await expect(page.getByTestId('home-single')).toBeVisible();

    // reset all to the original
    await openSettings(page);
    await page.getByTestId('translations-link').click();
    const d3 = page.getByRole('dialog', { name: 'Translations' });
    const en3 = d3.locator('[data-language="en"]');
    await expect(en3.getByRole('button', { name: 'Undo all my changes' })).toBeDisabled();
    await en3.getByRole('button', { name: 'Edit' }).click();
    const ed3 = page.getByRole('dialog', { name: 'Edit English' });
    await ed3.getByRole('searchbox').fill('select.singleQuest');
    await ed3.getByLabel('Translation of select.singleQuest').fill('Begin');
    await ed3.getByRole('button', { name: 'Save', exact: true }).click();
    await Promise.all([
      page.waitForNavigation(),
      ed3.getByRole('button', { name: 'Back to the list' }).click(),
    ]);
    await openSettings(page);
    await page.getByTestId('translations-link').click();
    const d4 = page.getByRole('dialog', { name: 'Translations' });
    await d4.getByRole('button', { name: 'Undo all my changes' }).click();
    await Promise.all([
      page.waitForNavigation(),
      d4
        .getByRole('button', { name: 'Really reset all' })
        .click()
        .then(() => d4.getByRole('button', { name: 'Close' }).click()),
    ]);
    await openSettings(page);
    await page.getByTestId('translations-link').click();
    await expect(
      page.getByRole('dialog', { name: 'Translations' }).locator('[data-language="en"]'),
    ).toContainText('0 changed');
  });

  test('change English and export the update file', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    await page.getByTestId('translations-link').click();
    const dlg = page.getByRole('dialog', { name: 'Translations' });
    const en = dlg.locator('[data-language="en"]');
    await expect(dlg.locator('[data-language="en-core"]')).toHaveCount(0);
    await en.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit English' });
    await editor.getByRole('searchbox').fill('select.myCollection');
    await editor.getByLabel('Translation of select.myCollection').fill('Pick a quest');
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await Promise.all([
      page.waitForNavigation(),
      editor.getByRole('button', { name: 'Back to the list' }).click(),
    ]);
    // it shows in the app at once
    await expect(page.getByTestId('home-collection')).toContainText('Pick a quest');

    await openSettings(page);
    await page.getByTestId('translations-link').click();
    const again = page.getByRole('dialog', { name: 'Translations' });
    await expect(again.locator('[data-language="en"]')).toContainText('1 changed');
    const download = page.waitForEvent('download');
    await again.getByRole('button', { name: 'Export', exact: true }).click();
    const file = await (await download).path();
    const update = JSON.parse(readFileSync(file, 'utf8')) as {
      format: string;
      date: string;
      base: string;
      language: { code: string };
      strings: Record<string, string>;
    };
    expect(update.format).toBe('soloquest-language');
    expect(update.language.code).toBe('en-core');
    expect(update.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(update.base).toMatch(/^en-/);
    // only the changed key
    expect(update.strings).toEqual({ 'select.myCollection': 'Pick a quest' });

    // undo the change
    await again.getByRole('button', { name: 'Undo all my changes' }).click();
    await Promise.all([
      page.waitForNavigation(),
      again
        .getByRole('button', { name: 'Really reset all' })
        .click()
        .then(() => again.getByRole('button', { name: 'Close' }).click()),
    ]);
    await expect(page.getByTestId('home-single')).toBeVisible();
  });
});

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const START = 'quest:q01-the-trial:notes.n-start.effects.0.text';

test.describe('translations (decision 92)', () => {
  test('make a language, translate the interface and a quest note, use it, export, delete, import', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('translations-link').click();
    const dlg = page.getByRole('dialog', { name: 'Translations' });

    // English is built in and has no edit, export or delete
    const en = dlg.locator('[data-language="en"]');
    await expect(en).toContainText('Built in');
    await expect(en).toContainText('In use');
    await expect(en.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await expect(en.getByRole('button', { name: 'Edit' })).toHaveCount(0);

    // a new language is a copy of English
    await dlg.getByRole('button', { name: 'New language' }).click();
    await dlg.getByLabel('Name').fill('Espanol');
    await dlg.getByLabel('Code').fill('es');
    await dlg.getByRole('button', { name: 'Make it from English' }).click();
    const editor = page.getByRole('dialog', { name: 'Translate Espanol' });

    // a select screen text
    await editor.getByRole('searchbox').fill('select.chooseAQuest');
    await editor.getByLabel('Translation of select.chooseAQuest').fill('Elige una mision');
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
    await expect(page.getByRole('heading', { name: 'Elige una mision' })).toBeVisible();
    await expect(page.getByRole('button', { name: /La Prueba/ })).toBeVisible();
    await expect(page.getByTestId('translations-link')).toContainText('Espanol');

    // the quest note shows in the language
    await page.goto('/?quest=1');
    await expect(page.getByRole('dialog', { name: 'Start' })).toContainText(
      'Pon a los heroes en la escalera.',
    );

    // export, delete, import the same file
    await page.goto('/');
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
    expect(exported.strings['select.chooseAQuest']).toBe('Elige una mision');
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
    await expect(page.getByRole('heading', { name: 'Choose a quest' })).toBeVisible();
    await page.getByTestId('translations-link').click();
    const again = page.getByRole('dialog', { name: 'Translations' });
    await expect(again.locator('[data-language="es"]')).toHaveCount(0);

    await again.getByLabel('Translation file').setInputFiles(file);
    await expect(again.locator('[data-language="es"]')).toContainText('Espanol');
    await expect(again).toContainText('Added Espanol');

    // English can be neither imported over nor deleted
    await again.getByLabel('Translation file').setInputFiles({
      name: 'en.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({ ...exported, language: { name: 'English', code: 'en' } }),
      ),
    });
    await expect(again.getByRole('alert')).toContainText('supplied by the app');
    await expect(
      again.locator('[data-language="en"]').getByRole('button', { name: 'Delete' }),
    ).toHaveCount(0);

    // a broken file gives a friendly message
    await again.getByLabel('Translation file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not json'),
    });
    await expect(again.getByRole('alert')).toContainText('not valid JSON');
  });
});

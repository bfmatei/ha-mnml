import type { Page } from 'playwright';

import { VIEWPORTS, launch, signedIn } from './browser.ts';
import { readEnv } from './env.ts';

const env = readEnv();
const NEW = 'walk-new';
const LEFT = 'walk-left';

const problems: string[] = [];
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'ok' : 'FAIL'} ${what}`);
  if (!ok) {
    problems.push(what);
  }
};

async function settle(page: Page, ms = 1500): Promise<void> {
  await page.waitForTimeout(ms);
}

async function library(page: Page): Promise<void> {
  await page.goto(`${env.HA_URL}/mnml`, { waitUntil: 'domcontentloaded' });
  await page.locator('mnml-library .library-row').first().waitFor({ timeout: 30000 });
}

const row = (page: Page, name: string) =>
  page.locator('mnml-library .library-row').filter({ has: page.locator(`text="${name}"`) });

async function status(page: Page, name: string): Promise<string> {
  const classes = (await row(page, name).first().getAttribute('class')) ?? '';
  return /status-(\w+)/.exec(classes)?.[1] ?? 'missing';
}

async function rowAction(page: Page, name: string, action: string): Promise<void> {
  await row(page, name)
    .first()
    .getByRole('button', { name: `More for ${name}` })
    .click();
  await page.getByRole('menuitem', { name: action }).click();
}

async function builderAction(page: Page, name: string, action: string): Promise<void> {
  await page
    .locator('mnml-builder .builder-head')
    .getByRole('button', { name: `More for ${name}` })
    .click();
  await page.getByRole('menuitem', { name: action }).click();
}

async function named(page: Page, name: string): Promise<void> {
  await page.locator('dialog.dialog input[aria-label="Name"]').fill(name);
  await page.locator('dialog.dialog').getByRole('button', { name: 'OK' }).click();
}

async function saved(page: Page): Promise<void> {
  await page.locator('mnml-builder').getByRole('button', { name: 'Save' }).click();
  await settle(page, 2000);
}

async function builderProblem(page: Page): Promise<string | undefined> {
  const said = await page.locator('mnml-builder .problem').allTextContents();
  return said.length === 0 ? undefined : said.join(' | ');
}

const browser = await launch();
const { context, page } = await signedIn(browser, env, VIEWPORTS.desktop);
page.on('dialog', (dialog) => {
  void dialog.accept();
});
const errors: string[] = [];
page.on('pageerror', (error) => {
  if ((error.stack ?? '').includes('/mnml-files/')) {
    errors.push(error.message);
  }
});

await library(page);
check(
  (await page.locator('mnml-library .library-row').count()) > 10,
  'the library lists the templates',
);

await page.goto(`${env.HA_URL}/mnml/templates/room`, { waitUntil: 'domcontentloaded' });
await page.locator('mnml-builder .builder-head').waitFor({ timeout: 30000 });
await settle(page, 3000);
check((await builderProblem(page)) === undefined, 'room opens without a problem');
check(
  (await page.locator('mnml-builder .outline-row').count()) > 3,
  'the outline shows the parts of room',
);
check(
  (await page.locator('mnml-builder mnml-preview .cards > *').count()) > 0,
  'the preview draws room',
);
await page.locator('mnml-builder .outline-row').nth(1).locator('.outline-name').click();
await settle(page);
check(
  (await page.locator('mnml-builder .inspector h2').count()) === 1,
  'a part picked shows in the inspector',
);

await page.locator('mnml-builder').getByRole('tab', { name: 'Slots' }).click();
await settle(page);
const label = page.locator('mnml-builder .slot').first().locator('input[aria-label="Label"]');
await label.fill('Walked');
await label.dispatchEvent('change');
await settle(page);
check(
  (await page.locator('mnml-builder .slot .badge.changed').count()) === 1,
  'the slot edited is marked changed',
);
check(
  /1 change to the shipped template/.test(
    (await page.locator('mnml-builder .builder-title .muted').textContent()) ?? '',
  ),
  'the header counts the change',
);
await saved(page);
check((await builderProblem(page)) === undefined, 'the change is saved');
await library(page);
check((await status(page, 'room')) === 'customised', 'room is customised in the library');

await page.goto(`${env.HA_URL}/mnml/templates/room`, { waitUntil: 'domcontentloaded' });
await page.locator('mnml-builder .builder-head').waitFor({ timeout: 30000 });
await settle(page, 3000);
await builderAction(page, 'room', 'Reset to shipped');
await settle(page);
check(
  ((await page.locator('mnml-builder .builder-title .muted').textContent()) ?? '').includes(
    'as shipped',
  ),
  'Reset to shipped puts the shipped room in the draft',
);
await saved(page);
await library(page);
check((await status(page, 'room')) === 'shipped', 'room is shipped again once saved');

await page.locator('mnml-library').getByRole('button', { name: 'New template' }).click();
await named(page, NEW);
await page.locator('mnml-builder .builder-head').waitFor({ timeout: 30000 });
await settle(page, 2000);
check((await builderProblem(page)) === undefined, 'a new template opens');
await saved(page);
await library(page);
check((await status(page, NEW)) === 'own', 'the new template is kept as one of the home');

await rowAction(page, NEW, 'Duplicate');
await named(page, `${NEW}-copy`);
await page.locator('mnml-builder .builder-head').waitFor({ timeout: 30000 });
check(
  ((await page.locator('mnml-builder .builder-title h1').textContent()) ?? '').includes(
    `${NEW}-copy`,
  ),
  'a duplicate opens under its own name',
);
await page.locator('mnml-builder').getByRole('button', { name: 'Back to the library' }).click();
await settle(page);

await page.locator('mnml-library').getByRole('button', { name: 'New template' }).click();
await named(page, LEFT);
await page.locator('mnml-builder .builder-head').waitFor({ timeout: 30000 });
await page.locator('mnml-builder').getByRole('button', { name: 'Back to the library' }).click();
await settle(page);
check((await row(page, LEFT).count()) === 0, 'a new template left unsaved is not in the library');
await page.locator('mnml-library').getByRole('button', { name: 'New template' }).click();
await named(page, LEFT);
await settle(page);
check(
  (await page.locator('dialog.dialog .problem-line').count()) === 0 &&
    (await page.locator('mnml-builder').count()) === 1,
  'its name is free again',
);
await page.locator('mnml-builder').getByRole('button', { name: 'Back to the library' }).click();
await settle(page);

for (const name of [NEW]) {
  await rowAction(page, name, 'Delete');
  await page.locator('dialog.dialog').getByRole('button', { name: 'Delete' }).click();
  await settle(page, 2000);
  check((await row(page, name).count()) === 0, `${name} is deleted`);
}

check(
  errors.length === 0,
  `no page error from MNML${errors.length === 0 ? '' : `: ${errors.join(' | ')}`}`,
);
await context.close();
await browser.close();
console.log(problems.length === 0 ? 'walk: all ok' : `walk: ${problems.length} failed`);
process.exitCode = problems.length === 0 ? 0 : 1;

import type { Page } from 'playwright';

import { VIEWPORTS, errorCards, launch, signedIn } from './browser.ts';
import { readEnv } from './env.ts';
import { connect } from './socket.ts';

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
  await page.goto(`${env.HA_URL}/mnml/templates`, { waitUntil: 'domcontentloaded' });
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

async function roomsIn(url_path: string): Promise<number> {
  const session = await connect(env);
  try {
    const config = await session.call<{
      views: { sections: { cards: { template?: string }[] }[] }[];
    }>({ type: 'lovelace/config', url_path });
    return config.views
      .flatMap((view) => view.sections)
      .flatMap((section) => section.cards)
      .filter((card) => card.template === 'room').length;
  } finally {
    session.close();
  }
}

async function forgetBuilt(): Promise<void> {
  const session = await connect(env);
  try {
    const kept = await session.call<{ dashboards: Record<string, unknown> }>({
      type: 'mnml/dashboards/list',
    });
    const boards = await session.call<{ id: string; url_path: string }[]>({
      type: 'lovelace/dashboards/list',
    });
    for (const url_path of Object.keys(kept.dashboards)) {
      const board = boards.find((each) => each.url_path === url_path);
      if (board !== undefined) {
        await session.call({ type: 'lovelace/dashboards/delete', dashboard_id: board.id });
      }
      await session.call({ type: 'mnml/dashboards/delete', url_path });
    }
  } finally {
    session.close();
  }
}

async function boardsPage(page: Page): Promise<void> {
  await page.goto(`${env.HA_URL}/mnml`, { waitUntil: 'domcontentloaded' });
  await page.locator('mnml-dashboards .library-head').waitFor({ timeout: 30000 });
  await settle(page);
}

const dialogButton = (page: Page, name: string) =>
  page.locator('dialog.dialog').getByRole('button', { name, exact: true });

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
const tilesListed = await page.locator('mnml-library .library-row').count();
await page.locator('mnml-library').getByRole('checkbox', { name: 'Pop-ups and parts' }).check();
await settle(page, 500);
check(
  tilesListed >= 9 && (await page.locator('mnml-library .library-row').count()) > 40,
  `the library lists the tiles (${tilesListed}), and every template with Pop-ups and parts`,
);

await page.goto(`${env.HA_URL}/mnml/templates/room`, { waitUntil: 'domcontentloaded' });
await page.locator('mnml-builder .builder-head').waitFor({ timeout: 30000 });
await page.locator('mnml-builder .simple-row').first().waitFor({ timeout: 30000 });
const lockChip = page.locator('mnml-builder input[type="checkbox"][data-path="card/chips?/#lock"]');
check(
  (await lockChip.count()) === 1 && (await lockChip.isChecked()),
  'the room opens on Simple, its lock chip switched on',
);
await lockChip.uncheck();
await settle(page, 500);
check(
  (await page.locator('mnml-builder').getByRole('button', { name: 'Save' }).isEnabled()) &&
    !(await lockChip.isChecked()),
  'switching the lock chip off is a change to save',
);
await lockChip.check();
await settle(page, 500);
check(
  !(await page.locator('mnml-builder').getByRole('button', { name: 'Save' }).isEnabled()),
  'switching it on again is no change at all',
);
await page.locator('mnml-builder').getByRole('tab', { name: 'Card' }).click();
await settle(page, 500);
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

await forgetBuilt();
await boardsPage(page);
check(
  (await page.locator('mnml-dashboards .start').count()) === 1,
  'with no dashboard built, the Dashboards tab offers to build one',
);
await page.locator('mnml-dashboards').getByRole('button', { name: 'Quick start' }).click();
await dialogButton(page, 'Make it').click();
await dialogButton(page, 'Open it').click();
await page.waitForURL(`${env.HA_URL}/dashboard-home**`, { timeout: 30000 });
await page.locator('mnml-template-card').first().waitFor({ timeout: 30000 });
await settle(page, 3000);
check(
  (await page.locator('mnml-template-card').count()) > 3,
  'the quick start makes a dashboard of template cards, and opens it',
);
const quickErrors = await errorCards(page);
check(
  quickErrors.length === 0,
  `the quick start's dashboard draws no error card${quickErrors.length === 0 ? '' : `: ${quickErrors.join(' | ')}`}`,
);
const quickRooms = await roomsIn('dashboard-home');
check(quickRooms > 0, `the quick start has the rooms with lights (${quickRooms})`);

await boardsPage(page);
check(
  (await page.locator('mnml-dashboards').getByRole('button', { name: 'Edit Home' }).count()) ===
    1 && (await page.locator('mnml-dashboards [aria-label^="Undo"]').count()) === 0,
  'the dashboard is listed, with nothing to undo yet',
);
await page.locator('mnml-dashboards').getByRole('button', { name: 'Edit Home' }).click();
await page.locator('mnml-plan-editor .plan-section').first().waitFor({ timeout: 30000 });
await page.locator('mnml-plan-editor').getByRole('button', { name: 'Customize Kitchen' }).click();
await page
  .locator('mnml-plan-editor dialog.customize mnml-template-card-editor')
  .waitFor({ timeout: 30000 });
await settle(page, 2000);
check(
  (await page
    .locator('mnml-plan-editor dialog.customize')
    .getByText('Find in an area', { exact: true })
    .count()) > 0,
  "Customize opens the template card's editor on the room, found in its area",
);
await page
  .locator('mnml-plan-editor dialog.customize')
  .getByRole('button', { name: 'Done' })
  .click();
await settle(page, 500);
check(
  (await page.locator('mnml-plan-editor dialog.customize').count()) === 0,
  'Done with nothing changed closes it',
);
await page.locator('mnml-plan-editor input.fact-input').first().fill('Walk home');
await page.locator('mnml-plan-editor').getByRole('checkbox', { name: 'Show Kitchen' }).click();
await page.locator('mnml-plan-editor').getByRole('button', { name: 'Rebuild' }).click();
await dialogButton(page, 'Rebuild').click();
await dialogButton(page, 'Cancel').click();
await settle(page);
check(
  (await page
    .locator('mnml-dashboards')
    .getByRole('button', { name: 'Edit Walk home' })
    .count()) === 1 && (await roomsIn('dashboard-home')) === quickRooms - 1,
  'a rebuild takes the new title and drops the room unticked',
);

await page
  .locator('mnml-dashboards')
  .getByRole('button', { name: 'Undo the last rebuild of Walk home' })
  .click();
await dialogButton(page, 'Undo').click();
await settle(page);
check(
  (await page.locator('mnml-dashboards').getByRole('button', { name: 'Edit Home' }).count()) ===
    1 && (await roomsIn('dashboard-home')) === quickRooms,
  'an undo brings back the title and the rooms from before the rebuild',
);

await page.locator('mnml-dashboards').getByRole('button', { name: 'Share Home' }).click();
const shared = await page
  .locator('dialog.dialog textarea[aria-label="The dashboard template"]')
  .inputValue();
check(
  shared.includes('mnml_dashboard:') &&
    !shared.includes('person.') &&
    !shared.includes('kitchen') &&
    !shared.includes('living'),
  'Share writes a dashboard template with no area or person of the home in it',
);
await dialogButton(page, 'Cancel').click();
await page.locator('mnml-dashboards').getByRole('button', { name: 'Forget Home' }).click();
await dialogButton(page, 'Delete it too').click();
await settle(page);
const left = await connect(env);
const boardsLeft = await left.call<{ url_path: string }[]>({ type: 'lovelace/dashboards/list' });
left.close();
check(
  (await page.locator('mnml-dashboards .start').count()) === 1 &&
    !boardsLeft.some((board) => board.url_path === 'dashboard-home'),
  'forgetting with Delete it too removes the dashboard from Home Assistant',
);

await page.locator('mnml-dashboards').getByRole('button', { name: 'From a template' }).click();
await page
  .locator('dialog.dialog textarea[aria-label="A dashboard template in YAML"]')
  .fill(shared);
await dialogButton(page, 'Next').click();
await dialogButton(page, 'Open in the builder').click();
await page.locator('mnml-plan-editor .plan-section').first().waitFor({ timeout: 30000 });
await page.locator('mnml-plan-editor').getByRole('button', { name: 'Create' }).click();
await dialogButton(page, 'Open it').click();
await page.waitForURL(`${env.HA_URL}/dashboard-home**`, { timeout: 30000 });
await page.locator('mnml-template-card').first().waitFor({ timeout: 30000 });
await settle(page, 3000);
const remadeErrors = await errorCards(page);
check(
  remadeErrors.length === 0 && (await roomsIn('dashboard-home')) === quickRooms,
  `a dashboard made from the shared template draws its rooms with no error card${remadeErrors.length === 0 ? '' : `: ${remadeErrors.join(' | ')}`}`,
);
await forgetBuilt();

check(
  errors.length === 0,
  `no page error from MNML${errors.length === 0 ? '' : `: ${errors.join(' | ')}`}`,
);
await context.close();
await browser.close();
console.log(problems.length === 0 ? 'walk: all ok' : `walk: ${problems.length} failed`);
process.exitCode = problems.length === 0 ? 0 : 1;

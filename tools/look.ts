import { mkdirSync } from 'node:fs';

import type { BrowserContext, BrowserContextOptions, Page } from 'playwright';

import { DEMO } from '../demo/home.ts';
import { drawn } from '../src/home/view.ts';
import { SHIPPED } from '../src/templates/shipped.ts';

import { VIEWPORTS, errorCards, launch, navigate, signedIn, useTheme } from './browser.ts';
import { readEnv } from './env.ts';

const env = readEnv();
const LOOKS_AT_ONCE = 4;
const PANEL_PAGES = 4;
const LOOKS: readonly (readonly [string, boolean])[] = [
  ['default', false],
  ['default', true],
  ['MNML', false],
  ['MNML', true],
];

const HASHES: string[] = [];
const collect = (value: unknown): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collect(item);
    }
  } else if (value !== null && typeof value === 'object') {
    const hash: unknown = Reflect.get(value, 'hash');
    if (typeof hash === 'string') {
      HASHES.push(hash);
    }
    for (const item of Object.values(value)) {
      collect(item);
    }
  }
};
collect(drawn(DEMO));

const opened = (page: Page): Promise<{ open: boolean; head: boolean; body: number }> =>
  page.evaluate(() => {
    const shells: Element[] = [];
    const walk = (node: Element): void => {
      if (node.localName === 'mnml-popups-card') {
        shells.push(node);
      }
      for (const child of [...(node.shadowRoot?.children ?? []), ...node.children]) {
        walk(child);
      }
    };
    walk(document.documentElement);
    const dialog = shells[0]?.shadowRoot?.querySelector('dialog[open]');
    return {
      open: dialog !== null && dialog !== undefined,
      head: [...(dialog?.querySelector('.head')?.children ?? [])].some(
        (node) => node.getBoundingClientRect().height > 0,
      ),
      body: [...(dialog?.querySelector('.body')?.children ?? [])].filter(
        (node) => node.getBoundingClientRect().height > 0,
      ).length,
    };
  });

const cardEditors = (page: Page): Promise<{ opened: number; problems: string[] }> =>
  page.evaluate(async () => {
    const root = document.querySelector('home-assistant');
    const hass: unknown = root === null ? undefined : Reflect.get(root, 'hass');
    const connection: unknown =
      typeof hass === 'object' && hass !== null ? Reflect.get(hass, 'connection') : undefined;
    const send: unknown =
      typeof connection === 'object' && connection !== null
        ? Reflect.get(connection, 'sendMessagePromise')
        : undefined;
    if (root === null || typeof send !== 'function') {
      return { opened: 0, problems: ['no connection'] };
    }
    const config: unknown = await Reflect.apply(send, connection, [
      { type: 'lovelace/config', url_path: 'mnml-examples' },
    ]);
    const cards: Record<string, unknown>[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item);
        }
      } else if (value !== null && typeof value === 'object') {
        const type: unknown = Reflect.get(value, 'type');
        if (typeof type === 'string' && type.startsWith('custom:mnml-')) {
          cards.push(Object.fromEntries(Object.entries(value)));
        }
        for (const item of Object.values(value)) {
          walk(item);
        }
      }
    };
    walk(config);
    const problems: string[] = [];
    let count = 0;
    for (const card of cards) {
      const made: unknown = customElements.get(String(card['type']).slice('custom:'.length));
      const open: unknown =
        typeof made === 'function' ? Reflect.get(made, 'getConfigElement') : undefined;
      if (typeof open !== 'function') {
        continue;
      }
      try {
        const editor: unknown = await Reflect.apply(open, made, []);
        if (!(editor instanceof HTMLElement)) {
          problems.push(`${String(card['type'])}: no editor element`);
          continue;
        }
        Reflect.set(editor, 'hass', hass);
        const setConfig: unknown = Reflect.get(editor, 'setConfig');
        if (typeof setConfig === 'function') {
          Reflect.apply(setConfig, editor, [card]);
        }
        root.shadowRoot?.append(editor);
        await new Promise((resolve) => {
          setTimeout(resolve, 300);
        });
        if (!editor.shadowRoot?.querySelector('ha-form, .gallery, .kinds')) {
          problems.push(`${String(card['type'])}: no form`);
        }
        editor.remove();
        count += 1;
      } catch (error) {
        problems.push(
          `${String(card['type'])}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { opened: count, problems };
  });

async function panel(page: Page): Promise<string[]> {
  await page.goto(`${env.HA_URL}/mnml/templates`, { waitUntil: 'domcontentloaded' });
  await page
    .locator('mnml-panel .library-row')
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => undefined);
  const listed = await page.locator('mnml-panel .library-row').count();
  const problems = listed > 0 ? [] : ['the panel lists no template'];
  const names = Object.keys(SHIPPED);
  const pages = await Promise.all(
    Array.from({ length: PANEL_PAGES }, () => page.context().newPage()),
  );
  const found: string[][] = names.map(() => []);
  await Promise.all(
    pages.map(async (worker, index) => {
      for (let at = index; at < names.length; at += PANEL_PAGES) {
        const name = names[at] ?? '';
        await worker.goto(`${env.HA_URL}/mnml/templates/${name}`, {
          waitUntil: 'domcontentloaded',
        });
        const built = await worker
          .locator('mnml-panel .builder')
          .first()
          .waitFor({ timeout: 6000 })
          .then(() => true)
          .catch(() => false);
        await worker.waitForTimeout(300);
        const said = await worker.locator('mnml-panel .problem').allTextContents();
        found[at] = said.map((text) => `${name}: ${text}`);
        if (!built) {
          found[at]?.push(`${name}: no builder`);
        }
      }
    }),
  );
  await Promise.all(pages.map((worker) => worker.close()));
  return [...problems, ...found.flat()];
}

const settled = async (
  page: Page,
  wanted: boolean,
  within: number,
): Promise<Awaited<ReturnType<typeof opened>>> => {
  const until = Date.now() + within;
  let shown = await opened(page);
  while (
    Date.now() < until &&
    (shown.open !== wanted || (wanted && (!shown.head || shown.body === 0)))
  ) {
    await page.waitForTimeout(100);
    shown = await opened(page);
  }
  return shown;
};

async function look(name: string, size: BrowserContextOptions, theme: string, dark: boolean) {
  let broken = 0;
  const { context, page } = await signedIn(browser, env, size);
  await page.goto(`${env.HA_URL}/mnml-examples/cards`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await useTheme(page, theme, dark);
  const errors = await errorCards(page);
  const label = `${theme}-${dark ? 'dark' : 'light'}-${name}`;
  await page.screenshot({ path: `out/look/${label}.png`, fullPage: true });
  console.log(`${label} cards: ${errors.length === 0 ? 'no error card' : errors.join(' | ')}`);
  broken += errors.length;
  await page.goto(`${env.HA_URL}/mnml-examples/templates`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const templateErrors = await errorCards(page);
  console.log(
    `${label} templates: ${templateErrors.length === 0 ? 'no error card' : templateErrors.join(' | ')}`,
  );
  broken += templateErrors.length;
  await page.goto(`${env.HA_URL}/mnml-examples/cards`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const editors = await cardEditors(page);
  const editorProblems = editors.opened > 0 ? editors.problems : ['no editor opened'];
  console.log(
    `${label} card editors: ${editors.opened} opened, ${editorProblems.length === 0 ? 'no problem' : editorProblems.join(' | ')}`,
  );
  broken += editorProblems.length;
  if (theme === 'MNML') {
    const [panelProblems, failed] = await Promise.all([
      panel(page),
      popups(context, label, name, dark, theme),
    ]);
    await page.screenshot({ path: `out/look/${label}-panel.png` });
    console.log(
      `${label} panel: ${Object.keys(SHIPPED).length} templates opened, ${panelProblems.length === 0 ? 'no problem' : panelProblems.join(' | ')}`,
    );
    console.log(
      `${label} demo: ${HASHES.length} pop-ups, ${failed.length === 0 ? 'no error card' : failed.join(' | ')}`,
    );
    broken += panelProblems.length + failed.length;
  }
  await context.close();
  return broken;
}

async function popups(
  context: BrowserContext,
  label: string,
  name: string,
  dark: boolean,
  theme: string,
): Promise<string[]> {
  const page = await context.newPage();
  await page.goto(`${env.HA_URL}/mnml-demo/home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await useTheme(page, theme, dark);
  const failed = [...(await errorCards(page))];
  await page.screenshot({ path: `out/look/demo/${label}.png`, fullPage: true });
  for (const hash of HASHES) {
    await navigate(page, hash);
    const shown = await settled(page, true, 2500);
    failed.push(...(await errorCards(page)).map((text) => `${hash}: ${text}`));
    if (!shown.open) {
      failed.push(`${hash}: opened nothing`);
    } else if (!shown.head || shown.body === 0) {
      failed.push(`${hash}: ${shown.head ? 'a blank body' : 'no header'}`);
    }
    if ((dark && name === 'desktop') || (!dark && name === 'phone')) {
      await page.screenshot({ path: `out/look/demo/${label}-${hash.slice(1)}.png` });
    }
    await page.evaluate(() => {
      history.back();
    });
    await settled(page, false, 1000);
  }
  await page.close();
  return failed;
}

mkdirSync('out/look/demo', { recursive: true });
const browser = await launch();
const jobs = Object.entries(VIEWPORTS).flatMap(([name, size]) =>
  LOOKS.map(
    ([theme, dark]) =>
      () =>
        look(name, size, theme, dark),
  ),
);
let next = 0;
const counts = await Promise.all(
  Array.from({ length: Math.min(LOOKS_AT_ONCE, jobs.length) }, async () => {
    let broken = 0;
    for (let job = jobs[next++]; job !== undefined; job = jobs[next++]) {
      broken += await job();
    }
    return broken;
  }),
);
await browser.close();
process.exitCode = counts.reduce((sum, count) => sum + count, 0) === 0 ? 0 : 1;

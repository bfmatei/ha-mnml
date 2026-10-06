import { mkdirSync } from 'node:fs';

import type { Page } from 'playwright';

import { DEMO } from '../demo/home.ts';
import { drawn } from '../src/home/view.ts';
import { SHIPPED } from '../src/templates/shipped.ts';

import { VIEWPORTS, errorCards, launch, navigate, signedIn, useTheme } from './browser.ts';
import { readEnv } from './env.ts';

const env = readEnv();
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
  await page.goto(`${env.HA_URL}/mnml`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const listed = await page.locator('mnml-panel .library-row').count();
  const problems = listed > 0 ? [] : ['the panel lists no template'];
  for (const name of Object.keys(SHIPPED)) {
    await page.goto(`${env.HA_URL}/mnml/templates/${name}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const said = await page.locator('mnml-panel .problem').allTextContents();
    problems.push(...said.map((text) => `${name}: ${text}`));
    if ((await page.locator('mnml-panel .builder').count()) === 0) {
      problems.push(`${name}: no builder`);
    }
  }
  return problems;
}

mkdirSync('out/look/demo', { recursive: true });
const browser = await launch();
let broken = 0;
for (const [name, size] of Object.entries(VIEWPORTS)) {
  for (const [theme, dark] of LOOKS) {
    const { context, page } = await signedIn(browser, env, size);
    await page.goto(`${env.HA_URL}/mnml-examples/cards`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await useTheme(page, theme, dark);
    const errors = await errorCards(page);
    const look = `${theme}-${dark ? 'dark' : 'light'}-${name}`;
    await page.screenshot({ path: `out/look/${look}.png`, fullPage: true });
    console.log(`${look} cards: ${errors.length === 0 ? 'no error card' : errors.join(' | ')}`);
    broken += errors.length;
    await page.goto(`${env.HA_URL}/mnml-examples/templates`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    const templateErrors = await errorCards(page);
    console.log(
      `${look} templates: ${templateErrors.length === 0 ? 'no error card' : templateErrors.join(' | ')}`,
    );
    broken += templateErrors.length;
    await page.goto(`${env.HA_URL}/mnml-examples/cards`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    const editors = await cardEditors(page);
    const editorProblems = editors.opened > 0 ? editors.problems : ['no editor opened'];
    console.log(
      `${look} card editors: ${editors.opened} opened, ${editorProblems.length === 0 ? 'no problem' : editorProblems.join(' | ')}`,
    );
    broken += editorProblems.length;
    if (theme === 'MNML') {
      const panelProblems = await panel(page);
      await page.screenshot({ path: `out/look/${look}-panel.png` });
      console.log(
        `${look} panel: ${Object.keys(SHIPPED).length} templates opened, ${panelProblems.length === 0 ? 'no problem' : panelProblems.join(' | ')}`,
      );
      broken += panelProblems.length;
      await page.goto(`${env.HA_URL}/mnml-demo/home`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      await useTheme(page, theme, dark);
      const failed = [...(await errorCards(page))];
      await page.screenshot({ path: `out/look/demo/${look}.png`, fullPage: true });
      for (const hash of HASHES) {
        await navigate(page, hash);
        await page.waitForTimeout(1200);
        failed.push(...(await errorCards(page)).map((text) => `${hash}: ${text}`));
        const shown = await opened(page);
        if (!shown.open) {
          failed.push(`${hash}: opened nothing`);
        } else if (!shown.head || shown.body === 0) {
          failed.push(`${hash}: ${shown.head ? 'a blank body' : 'no header'}`);
        }
        if ((dark && name === 'desktop') || (!dark && name === 'phone')) {
          await page.screenshot({ path: `out/look/demo/${look}-${hash.slice(1)}.png` });
        }
        await page.evaluate(() => {
          history.back();
        });
        await page.waitForTimeout(500);
      }
      console.log(
        `${look} demo: ${HASHES.length} pop-ups, ${failed.length === 0 ? 'no error card' : failed.join(' | ')}`,
      );
      broken += failed.length;
    }
    await context.close();
  }
}
await browser.close();
process.exitCode = broken === 0 ? 0 : 1;

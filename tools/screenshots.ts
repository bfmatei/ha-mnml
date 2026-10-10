import { mkdirSync } from 'node:fs';

import type { Browser, BrowserContextOptions } from 'playwright';

import { VIEWPORTS, launch, navigate, signedIn, useTheme } from './browser.ts';
import { readEnv } from './env.ts';

const env = readEnv();
const OUT = 'docs/screenshots';
const POPUPS = [
  '#living',
  '#living-lights',
  '#car-suv',
  '#proxmox',
  '#office-3d-printer',
  '#media',
];

async function demo(browser: Browser, size: BrowserContextOptions, dark: boolean) {
  const opened = await signedIn(browser, env, size);
  await opened.page.goto(`${env.HA_URL}/mnml-demo/home`, { waitUntil: 'domcontentloaded' });
  await opened.page.waitForTimeout(5000);
  await useTheme(opened.page, 'MNML', dark);
  return opened;
}

async function useGlass(glass: boolean): Promise<void> {
  const headers = { authorization: `Bearer ${env.HA_TOKEN}`, 'content-type': 'application/json' };
  const listed = await fetch(`${env.HA_URL}/api/config/config_entries/entry?domain=mnml`, {
    headers,
  });
  const [entry] = (await listed.json()) as { entry_id: string }[];
  if (entry === undefined) {
    throw new Error('MNML has no entry in the demo');
  }
  const flow = await fetch(`${env.HA_URL}/api/config/config_entries/options/flow`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ handler: entry.entry_id }),
  });
  const { flow_id } = (await flow.json()) as { flow_id: string };
  const saved = await fetch(`${env.HA_URL}/api/config/config_entries/options/flow/${flow_id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ glass, default_theme: false }),
  });
  if (!saved.ok) {
    throw new Error(`setting the design answered ${saved.status}: ${await saved.text()}`);
  }
  await new Promise((done) => setTimeout(done, 4000));
}

mkdirSync(OUT, { recursive: true });
const browser = await launch();
await useGlass(true);
for (const [name, size] of Object.entries(VIEWPORTS)) {
  for (const dark of [false, true]) {
    const { context, page } = await demo(browser, size, dark);
    const look = `${name}-${dark ? 'dark' : 'light'}`;
    await page.screenshot({ path: `${OUT}/${look}.png`, fullPage: true });
    console.log(`${OUT}/${look}.png`);
    if (name === 'desktop' && dark) {
      for (const hash of POPUPS) {
        await navigate(page, hash);
        await page.waitForTimeout(2500);
        const file = `${OUT}/popup-${hash.slice(1)}.png`;
        await page.locator('mnml-popups-card').locator('dialog .panel').screenshot({ path: file });
        console.log(file);
        await page.evaluate(() => {
          history.back();
        });
        await page.waitForTimeout(800);
      }
      await page.goto(`${env.HA_URL}/mnml/templates`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(8000);
      await page.screenshot({ path: `${OUT}/panel-library.png` });
      console.log(`${OUT}/panel-library.png`);
      await page.goto(`${env.HA_URL}/mnml/templates/room`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(8000);
      await page.screenshot({ path: `${OUT}/panel-simple.png` });
      console.log(`${OUT}/panel-simple.png`);
      await page.locator('mnml-panel .tabs:not(.panes) .tab').filter({ hasText: 'Card' }).click();
      await page.waitForTimeout(2000);
      await page.locator('mnml-panel .outline-name').nth(1).click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/panel-builder.png` });
      console.log(`${OUT}/panel-builder.png`);
      await page.locator('mnml-panel .tabs:not(.panes) .tab').filter({ hasText: 'Slots' }).click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/panel-slots.png` });
      console.log(`${OUT}/panel-slots.png`);
    }
    await context.close();
  }
}
{
  const { context, page } = await signedIn(browser, env, VIEWPORTS.desktop);
  await page.goto(`${env.HA_URL}/config/integrations/integration/mnml`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(5000);
  await page.getByRole('button', { name: /^(Configure|Options)$/ }).click();
  await page.waitForTimeout(3000);
  await page.getByRole('dialog').screenshot({ path: `${OUT}/options.png` });
  console.log(`${OUT}/options.png`);
  await context.close();
}
await useGlass(false);
for (const dark of [false, true]) {
  const { context, page } = await demo(browser, VIEWPORTS.desktop, dark);
  const look = `flat-desktop-${dark ? 'dark' : 'light'}`;
  await page.screenshot({ path: `${OUT}/${look}.png`, fullPage: true });
  console.log(`${OUT}/${look}.png`);
  await context.close();
}
await useGlass(true);
await browser.close();

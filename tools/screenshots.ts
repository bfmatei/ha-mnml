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

mkdirSync(OUT, { recursive: true });
const browser = await launch();
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
await browser.close();

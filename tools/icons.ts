import { readFileSync } from 'node:fs';

import { launch } from './browser.ts';

const BRAND = 'custom_components/mnml/brand';
const ICONS = [
  { source: 'icon-light.svg', name: 'icon' },
  { source: 'icon-dark.svg', name: 'dark_icon' },
] as const;
const SIZES = [
  { size: 256, suffix: '' },
  { size: 512, suffix: '@2x' },
] as const;

const browser = await launch();
const page = await browser.newPage();
for (const { source, name } of ICONS) {
  const svg = readFileSync(`${BRAND}/${source}`).toString('base64');
  for (const { size, suffix } of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}img{display:block}</style><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${svg}">`,
    );
    await page
      .locator('img')
      .screenshot({ path: `${BRAND}/${name}${suffix}.png`, omitBackground: true });
    console.log(`wrote ${BRAND}/${name}${suffix}.png (${size} px) from ${source}`);
  }
}
await browser.close();

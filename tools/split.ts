import { readFileSync } from 'node:fs';

import { launch } from './browser.ts';

const OUT = 'docs/screenshots';
const PAIRS = [
  { light: 'desktop-light', dark: 'desktop-dark', split: 'desktop', line: '#9d5e08' },
  {
    light: 'flat-desktop-light',
    dark: 'flat-desktop-dark',
    split: 'flat-desktop',
    line: '#9d5e08',
  },
] as const;

function sizeOf(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

const source = (png: Buffer): string => `data:image/png;base64,${png.toString('base64')}`;
const browser = await launch();
for (const { light: lightName, dark: darkName, split, line } of PAIRS) {
  const light = readFileSync(`${OUT}/${lightName}.png`);
  const dark = readFileSync(`${OUT}/${darkName}.png`);
  const { width, height } = sizeOf(light);
  const other = sizeOf(dark);
  if (other.width !== width || other.height !== height) {
    throw new Error(
      `${lightName} is ${width}x${height} and ${darkName} is ${other.width}x${other.height}`,
    );
  }
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<style>
  html, body { margin: 0; background: transparent; }
  .stage { position: relative; width: ${width}px; height: ${height}px; }
  .stage img, .stage svg { position: absolute; inset: 0; display: block; }
  .dark { clip-path: polygon(100% 0, 100% 100%, 0 100%); }
</style>
<div class="stage">
  <img src="${source(light)}" width="${width}" height="${height}">
  <img class="dark" src="${source(dark)}" width="${width}" height="${height}">
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <line x1="${width}" y1="0" x2="0" y2="${height}" stroke="${line}" stroke-width="2" />
  </svg>
</div>`);
  await page.locator('.stage').screenshot({ path: `${OUT}/${split}.png` });
  await page.close();
  console.log(
    `wrote ${OUT}/${split}.png (${width}x${height}): ${lightName} top left, ${darkName} bottom right`,
  );
}
await browser.close();

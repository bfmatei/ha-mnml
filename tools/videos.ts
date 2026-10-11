import { mkdirSync, renameSync, rmSync } from 'node:fs';

import type { Browser, Locator, Page } from 'playwright';

import { VIEWPORTS, launch, signedIn } from './browser.ts';
import { readEnv } from './env.ts';
import { connect } from './socket.ts';

const env = readEnv();
const OUT = 'out/videos';
const NAME = 'my-garden';

const OVERLAY = `
(() => {
  const start = () => {
    if (document.getElementById('rec-cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = 'rec-cursor';
    cursor.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))';
    cursor.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const caption = document.createElement('div');
    caption.id = 'rec-caption';
    caption.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483646;pointer-events:none;max-width:80vw;padding:12px 22px;border-radius:14px;background:rgba(15,15,20,.88);color:#fff;font:600 22px/1.3 system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .35s';
    document.body.append(caption, cursor);
    const place = (x, y) => {
      cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      try { sessionStorage.setItem('rec-pos', x + ',' + y); } catch {}
    };
    let saved = [40, 40];
    try { saved = (sessionStorage.getItem('rec-pos') || '40,40').split(',').map(Number); } catch {}
    place(saved[0], saved[1]);
    addEventListener('mousemove', (event) => place(event.clientX, event.clientY), true);
    addEventListener('mousedown', (event) => {
      const ring = document.createElement('div');
      ring.style.cssText = 'position:fixed;z-index:2147483645;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #ffd54a;transition:transform .5s,opacity .5s;opacity:1;left:' + event.clientX + 'px;top:' + event.clientY + 'px';
      document.body.append(ring);
      requestAnimationFrame(() => { ring.style.transform = 'scale(3.2)'; ring.style.opacity = '0'; });
      setTimeout(() => ring.remove(), 600);
    }, true);
  };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
`;

interface Point {
  x: number;
  y: number;
}

type Target = Locator | Point;

interface Recording {
  page: Page;
  wait: (ms: number) => Promise<void>;
  say: (text: string, ms?: number) => Promise<void>;
  hush: () => Promise<void>;
  go: (path: string, ms?: number) => Promise<void>;
  hover: (target: Target, pause?: number) => Promise<void>;
  click: (target: Target, pause?: number) => Promise<void>;
  drag: (from: Point, to: Point) => Promise<void>;
  type: (target: Locator, text: string) => Promise<void>;
  finish: () => Promise<void>;
}

const isPoint = (target: Target): target is Point => 'x' in target;

async function point(target: Target): Promise<Point> {
  if (isPoint(target)) {
    return target;
  }
  await target.first().scrollIntoViewIfNeeded();
  const box = await target.first().boundingBox();
  if (box === null) {
    throw new Error('nothing to point at');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function start(
  browser: Browser,
  name: string,
  size: { width: number; height: number },
  phone: boolean,
): Promise<Recording> {
  const dir = `${OUT}/raw-${name}`;
  const { context, page } = await signedIn(browser, env, {
    viewport: size,
    recordVideo: { dir, size },
    ...(phone ? { isMobile: true, hasTouch: true } : {}),
  });
  await context.addInitScript(OVERLAY);
  let at: Point = { x: 40, y: 40 };
  const wait = (ms: number): Promise<void> => page.waitForTimeout(ms);
  const travel = async (to: Point): Promise<void> => {
    const steps = Math.max(12, Math.min(40, Math.round(Math.hypot(to.x - at.x, to.y - at.y) / 18)));
    await page.mouse.move(to.x, to.y, { steps });
    at = to;
  };
  const recording: Recording = {
    page,
    wait,
    say: async (text, ms = 2200) => {
      await page.evaluate((words) => {
        const caption = document.getElementById('rec-caption');
        if (caption !== null) {
          caption.textContent = words;
          caption.style.opacity = '1';
        }
      }, text);
      await wait(ms);
    },
    hush: async () => {
      await page.evaluate(() => {
        const caption = document.getElementById('rec-caption');
        if (caption !== null) {
          caption.style.opacity = '0';
        }
      });
      await wait(400);
    },
    go: async (path, ms = 4000) => {
      await page.goto(`${env.HA_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await wait(ms);
      await page.mouse.move(at.x, at.y);
    },
    hover: async (target, pause = 900) => {
      await travel(await point(target));
      await wait(pause);
    },
    click: async (target, pause = 900) => {
      await travel(await point(target));
      await wait(250);
      await page.mouse.down();
      await page.mouse.up();
      await wait(pause);
    },
    drag: async (from, to) => {
      await travel(from);
      await wait(300);
      await page.mouse.down();
      await wait(200);
      await page.mouse.move(from.x - 12, from.y + 4, { steps: 6 });
      await page.mouse.move(to.x, to.y, { steps: 40 });
      at = to;
      await wait(400);
      await page.mouse.up();
      await wait(1500);
    },
    type: async (target, text) => {
      await recording.click(target, 300);
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(text, { delay: 90 });
      await wait(500);
    },
    finish: async () => {
      await wait(1200);
      const video = page.video();
      await context.close();
      if (video !== null) {
        renameSync(await video.path(), `${OUT}/${name}.webm`);
        console.log(`${OUT}/${name}.webm`);
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
  return recording;
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

async function forgetTemplate(): Promise<void> {
  const session = await connect(env);
  try {
    await session.call({ type: 'mnml/templates/delete', name: NAME }).catch(() => undefined);
  } finally {
    session.close();
  }
}

const dialogButton = (page: Page, name: string): Locator =>
  page.locator('dialog.dialog').getByRole('button', { name, exact: true });

async function tour(browser: Browser): Promise<void> {
  const r = await start(
    browser,
    '01-tour-of-the-dashboard',
    VIEWPORTS.desktop.viewport ?? { width: 1440, height: 900 },
    false,
  );
  const { page } = r;
  await r.go('/mnml-demo/home', 5000);
  await r.say('MNML: a minimal, flat dashboard for Home Assistant', 3200);
  await r.say('Everything on one screen: rooms, people, garage, infrastructure', 3000);
  await r.hush();
  await r.say('The strip on top shows what matters at a glance', 2000);
  const glances: Point[] = [
    { x: 318, y: 86 },
    { x: 385, y: 86 },
    { x: 438, y: 86 },
    { x: 517, y: 86 },
    { x: 1283, y: 86 },
    { x: 1340, y: 86 },
    { x: 1397, y: 86 },
  ];
  for (const glance of glances) {
    await r.hover(glance, 1500);
  }
  await r.say('Things that need you appear only when there is a problem', 3000);
  await r.hush();
  await page.mouse.wheel(0, 380);
  await r.wait(1500);
  await r.say('Each room is a tile: temperature, humidity, and one-tap chips', 3200);
  await r.hover({ x: 450, y: 510 }, 1200);
  await page.mouse.wheel(0, 500);
  await r.wait(1500);
  await r.say('People, cars and servers get their own tiles', 3000);
  await r.hush();
  await page.mouse.wheel(0, -2000);
  await r.wait(1200);
  const close = async (): Promise<void> => {
    await page.keyboard.press('Escape');
    await r.wait(1500);
  };
  await r.say('Tap a tile to open its pop-up', 2000);
  await r.click({ x: 352, y: 452 }, 3000);
  await r.say('The living room: lights, climate, sensors and more', 3500);
  await close();
  await r.click({ x: 735, y: 740 }, 3000);
  await r.say('A car: range, doors, tyres and charging', 3500);
  await close();
  await r.click({ x: 355, y: 856 }, 3000);
  await r.say('A server: CPU, memory, guests and failed checks', 3500);
  await close();
  await r.hush();
  await r.say('Light and dark follow your Home Assistant theme', 2500);
  for (const dark of [true, false, true]) {
    await page.evaluate((isDark) => {
      document.querySelector('home-assistant')?.dispatchEvent(
        new CustomEvent('settheme', {
          detail: { theme: 'MNML', dark: isDark },
          bubbles: true,
          composed: true,
        }),
      );
    }, dark);
    await r.wait(3500);
  }
  await r.hush();
  await r.finish();
}

async function dashboards(browser: Browser): Promise<void> {
  await forgetBuilt();
  const r = await start(browser, '02-build-a-dashboard', { width: 1440, height: 900 }, false);
  const { page } = r;
  const boards = page.locator('mnml-dashboards');
  const plan = page.locator('mnml-plan-editor');
  await r.go('/mnml', 6000);
  await r.say('The MNML panel: build a whole dashboard from your home in one click', 3500);
  await r.say('Choose Quick start', 1800);
  await r.click(boards.getByRole('button', { name: 'Quick start' }), 1500);
  await r.say('MNML looks at your areas, people, cars and devices', 3200);
  await r.click(dialogButton(page, 'Make it'), 2500);
  await r.say('Done. Open it to see the result', 2500);
  await r.click(dialogButton(page, 'Open it'), 1000);
  await page.waitForURL(`${env.HA_URL}/dashboard-home**`, { timeout: 30000 });
  await r.wait(6000);
  await r.say('A complete dashboard, made from your own areas and devices', 3500);
  await page.mouse.wheel(0, 600);
  await r.wait(2500);
  await r.hush();
  await r.go('/mnml', 4000);
  await r.say('Back in the panel, edit the dashboard at any time', 2800);
  await r.click(boards.getByRole('button', { name: 'Edit Home' }), 3500);
  await r.say('Give it a title, and choose its sections and rooms', 3200);
  await r.type(plan.locator('input.fact-input').first(), 'Our flat');
  await r.say('Untick a room to leave it out', 2200);
  await r.click(plan.getByRole('checkbox', { name: 'Show Kitchen' }), 1500);
  await r.say('Customize changes how a single room looks', 2400);
  await r.click(plan.getByRole('button', { name: 'Customize Living' }), 3500);
  await r.say('The same editor as the dashboard card editor', 2800);
  await r.click(plan.locator('dialog.customize').getByRole('button', { name: 'Done' }), 1500);
  await r.say('Rebuild applies your changes to the dashboard', 2400);
  await r.click(plan.getByRole('button', { name: 'Rebuild' }), 2500);
  await r.click(dialogButton(page, 'Rebuild'), 3500);
  await r.click(dialogButton(page, 'Cancel'), 2500);
  await r.say('Made a mistake? Undo brings the last version back', 3000);
  await r.click(boards.getByRole('button', { name: /^Undo the last rebuild/ }), 2000);
  await r.click(dialogButton(page, 'Undo'), 3000);
  await r.say('Share writes a template with nothing of your home in it', 3200);
  await r.click(boards.getByRole('button', { name: /^Share/ }), 4500);
  await r.click(dialogButton(page, 'Cancel'), 1500);
  await r.say('Forget removes it again, and can delete the dashboard too', 3200);
  await r.click(boards.getByRole('button', { name: /^Forget/ }), 2500);
  await r.click(dialogButton(page, 'Delete it too'), 3500);
  await r.hush();
  await r.finish();
  await forgetBuilt();
}

function chipBoxes(page: Page): Promise<(Point & { key: string })[]> {
  return page.evaluate(() => {
    const found: { key: string; x: number; y: number }[] = [];
    const walk = (root: ParentNode): void => {
      for (const element of root.querySelectorAll('*')) {
        const key = element.getAttribute('data-part');
        if (key?.startsWith('card/chips?/') === true) {
          const box = element.getBoundingClientRect();
          if (box.width > 0) {
            found.push({ key, x: box.left + box.width / 2, y: box.top + box.height / 2 });
          }
        }
        if (element.shadowRoot !== null) {
          walk(element.shadowRoot);
        }
      }
    };
    walk(document);
    return found.toSorted((a, b) => a.x - b.x);
  });
}

async function editing(browser: Browser): Promise<void> {
  const r = await start(
    browser,
    '03-design-and-edit-a-template',
    { width: 1440, height: 900 },
    false,
  );
  const { page } = r;
  const builder = page.locator('mnml-builder');
  await r.go('/mnml/templates', 5000);
  await r.say('Templates are the building blocks of every MNML card', 3200);
  await r.say('Search the library, or browse what ships with MNML', 2400);
  await r.type(page.locator('mnml-library input[aria-label="Search templates"]'), 'room');
  await r.wait(1200);
  await r.say('Open the room template to see how it is made', 2400);
  await r.click(
    page.locator('mnml-library .library-row').filter({ has: page.locator('text="room"') }),
    1000,
  );
  await builder.locator('.builder-head').waitFor({ timeout: 30000 });
  await r.wait(5000);
  await r.say('The Design tab shows the card large, with a panel beside it', 3500);
  await r.say('Hover to see what you can change. Click to pick a part', 3000);
  await r.hover({ x: 355, y: 266 }, 1200);
  await r.click({ x: 355, y: 266 }, 1800);
  await r.say('The panel shows what the part displays, and how it looks', 3500);
  await r.click({ x: 843, y: 256 }, 1800);
  await r.say('Each chip is a part you can switch off, move, copy or delete', 3500);
  await r.say('Switch a part off with its Shown box', 2200);
  await r.click(builder.locator('.stage-switch input'), 2200);
  await r.say('The chip leaves the card, and Save lights up', 2800);
  await r.click(builder.locator('.stage-switch input'), 1800);
  await r.say('Switch it back on, and there is nothing to save', 2800);
  await r.hush();
  await r.say('Try the card on another room of your home', 2400);
  const area = builder.locator('select[aria-label="Try it on"]');
  await r.click(area, 600);
  const options = await area.locator('option').allTextContents();
  const other = options.find((option) => option !== 'Living');
  if (other !== undefined) {
    await area.selectOption({ label: other });
    await r.wait(3500);
  }
  await area.selectOption({ label: 'Living' });
  await r.wait(2500);
  await r.hush();
  await r.say('Pick the card itself to see what you can add to it', 2600);
  await r.click(builder.locator('.stage-crumbs .crumb').first(), 1500);
  await r.say('Click Toggle to add a chip to the card', 2400);
  await r.click(builder.getByRole('button', { name: 'Toggle' }).first(), 2200);
  await r.say('The new chip is added: pick the entity it controls in the panel', 3000);
  const boxes = await chipBoxes(page);
  const first = boxes[0];
  const last = boxes.at(-1);
  if (first !== undefined && last !== undefined && first.key !== last.key) {
    await r.say('Drag a part onto a neighbour to move it', 2600);
    await r.drag(last, first);
    await r.say('Moved. Everything stays in a draft until you save', 2800);
  }
  await r.hush();
  await r.say('Need more control? More tools has the outline, slots and YAML', 3200);
  await r.click(builder.locator('button.tab.more'), 1500);
  for (const tab of ['Card', 'Slots', 'YAML']) {
    await r.click(builder.getByRole('tab', { name: tab, exact: true }), 3200);
  }
  await r.say('Everything stays in a draft. Undo, Redo, or leave without saving', 3200);
  await r.click(builder.getByRole('button', { name: 'Undo' }), 1500);
  await r.hush();
  await r.finish();
}

async function making(browser: Browser): Promise<void> {
  await forgetTemplate();
  const r = await start(browser, '04-make-your-own-template', { width: 1440, height: 900 }, false);
  const { page } = r;
  const builder = page.locator('mnml-builder');
  const library = page.locator('mnml-library');
  await r.go('/mnml/templates', 5000);
  await r.say('Make your own card: no code, no YAML', 3000);
  await r.click(library.getByRole('button', { name: 'New template' }), 1500);
  await r.say('Give it a name', 2000);
  await r.type(page.locator('dialog.dialog input[aria-label="Name"]'), NAME);
  await r.click(dialogButton(page, 'OK'), 1000);
  await builder.locator('.builder-head').waitFor({ timeout: 30000 });
  await r.wait(3000);
  await r.say('Start from something close to what you want', 3200);
  await r.hover(builder.locator('.start').nth(1), 1200);
  await r.hover(builder.locator('.start').nth(2), 1200);
  await r.say('We will make a tile', 2000);
  await r.click(builder.locator('.start').first(), 3500);
  await r.say('It starts with real entities of your home, so you can see it at once', 3600);
  await r.say('Click the title to change how the tile looks', 2600);
  await r.click({ x: 360, y: 246 }, 2500);
  await r.say('Type a name for it', 2000);
  await r.type(builder.locator('.stage-look input').first(), 'Garden');
  await r.click({ x: 700, y: 600 }, 800);
  await r.wait(1200);
  await r.say('Click a value to choose what it shows', 2600);
  await r.click({ x: 392, y: 266 }, 2500);
  await r.say('Pick any entity, or let each room find its own', 3200);
  await r.click(builder.getByRole('button', { name: 'Changes with the room' }), 2500);
  await r.say('Now it finds the right sensor by itself wherever it is used', 3600);
  await r.say('Move parts around with Earlier and Later', 2600);
  await r.click(builder.getByRole('button', { name: 'Later' }), 2800);
  await r.say('Pick the tile itself to add values, chips and buttons to it', 3400);
  await r.click(builder.locator('.stage-crumbs .crumb').first(), 3200);
  await r.say('Save when you are happy with it', 2500);
  await r.click(builder.getByRole('button', { name: 'Save' }), 3000);
  await r.say('It joins the library, next to the shipped templates', 3000);
  await r.click(builder.getByRole('button', { name: 'Back to the library' }), 3000);
  await r.say('Use it on any dashboard, share it, or delete it from here', 3600);
  const row = library.locator('.library-row').filter({ has: page.locator(`text="${NAME}"`) });
  await r.click(row.first().getByRole('button', { name: `More for ${NAME}` }), 1800);
  await r.click(page.getByRole('menuitem', { name: 'Delete' }), 1500);
  await r.click(dialogButton(page, 'Delete'), 2500);
  await r.hush();
  await r.finish();
  await forgetTemplate();
}

async function onPhone(browser: Browser): Promise<void> {
  const r = await start(browser, '05-on-your-phone', { width: 390, height: 844 }, true);
  const { page } = r;
  await r.go('/mnml-demo/home', 6000);
  await r.say('MNML on a phone: the same dashboard in one column', 3200);
  await r.hush();
  for (let step = 0; step < 5; step += 1) {
    await page.mouse.wheel(0, 420);
    await r.wait(1400);
  }
  await r.say('Everything stays within reach of a thumb', 2600);
  for (let step = 0; step < 5; step += 1) {
    await page.mouse.wheel(0, -420);
    await r.wait(700);
  }
  await r.hush();
  await r.say('Tap a room to open its pop-up as a sheet', 2600);
  await page.evaluate(() => {
    history.pushState(null, '', '#living');
    window.dispatchEvent(new CustomEvent('location-changed'));
  });
  await r.wait(3500);
  await page.mouse.wheel(0, 300);
  await r.say('Swipe to scroll, tap outside to close', 2800);
  await page.keyboard.press('Escape');
  await r.wait(1500);
  await r.hush();
  await r.finish();
}

mkdirSync(OUT, { recursive: true });
const browser = await launch();
try {
  await tour(browser);
  await dashboards(browser);
  await editing(browser);
  await making(browser);
  await onPhone(browser);
} finally {
  await browser.close();
}

import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOUSE } from '../builder/fixture.ts';
import type { Template, Templates } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { SHIPPED_TEMPLATES } from '../store/shipped.ts';
import { homes } from '../templates/corpus.ts';
import { OWNER } from '../templates/families.ts';
import { fakeHass } from '../test/hass.ts';
import { define, mounted, text } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlTemplateGallery } from './gallery.ts';

define('mnml-template-gallery', MnmlTemplateGallery);

type Shown = (entries: { isIntersecting: boolean; target: Element }[]) => void;

const observed: Element[] = [];
const disconnected = { count: 0 };
let shown: Shown | undefined;
Object.assign(globalThis, {
  IntersectionObserver: class {
    constructor(callback: Shown) {
      shown = callback;
    }
    observe(target: Element): void {
      observed.push(target);
    }
    unobserve(): void {}
    disconnect(): void {
      disconnected.count += 1;
    }
  },
});
const built: Record<string, unknown>[] = [];
const cards: HTMLElement[] = [];
window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement(config: object): HTMLElement {
      built.push({ ...config });
      const card = document.createElement('div');
      cards.push(card);
      return card;
    },
  });

const HASS = fakeHass({ areas: { hall: { area_id: 'hall', name: 'Hall' } } });

const ONE: Template = {
  card: { type: 'custom:mnml-heading-card', title: 'One', icon: 'mdi:numeric-1' },
};
const TWO: Template = {
  card: { type: 'custom:mnml-heading-card', title: 'Two', icon: 'mdi:numeric-2' },
};

async function shipped(): Promise<Templates> {
  await SHIPPED_TEMPLATES.need(Object.keys(OWNER));
  return SHIPPED_TEMPLATES.templates();
}

interface Shelf {
  readonly gallery: MnmlTemplateGallery;
  readonly root: ShadowRoot;
}

async function opened(templates?: Templates, own: Templates = {}): Promise<Shelf> {
  const gallery = document.createElement('mnml-template-gallery');
  assert.ok(gallery instanceof MnmlTemplateGallery);
  gallery.hass = HASS;
  gallery.templates = templates ?? (await shipped());
  gallery.own = own;
  const root = await mounted(gallery);
  return { gallery, root };
}

const labelled = (root: ParentNode, label: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const named = (targets: readonly Element[]): (string | undefined)[] =>
  targets.map((target) => (target instanceof HTMLElement ? target.dataset['template'] : undefined));

test('the gallery lists the tiles by family, and folds the pop-ups and parts', async () => {
  const { root } = await opened();
  assert.ok(labelled(root, 'Use Section heading'));
  assert.ok(labelled(root, 'Use Room'));
  assert.equal(labelled(root, 'Use Light'), null);
  const fold = [...root.querySelectorAll('button')].find((each) =>
    /^Pop-ups and parts \(\d+\)$/.test(text(each)),
  );
  assert.ok(fold);
  fold.click();
  await until(() => labelled(root, 'Use Light') !== null, 'the pop-ups and parts');
});

test('when a template finds nothing anywhere and some of the home is in no area, the gallery points to the area assistant', async () => {
  const { root } = await opened();
  assert.equal(root.querySelector('.stranded'), null);
  const gallery = document.createElement('mnml-template-gallery');
  assert.ok(gallery instanceof MnmlTemplateGallery);
  gallery.hass = fakeHass(HOUSE);
  gallery.templates = await shipped();
  const scattered = await mounted(gallery);
  assert.match(
    text(scattered.querySelector('.stranded')),
    /^Some templates find nothing here, because some of the home is in no area\. Sort the home into areas$/,
  );
  assert.ok(scattered.querySelector('.stranded a[href="/mnml/areas"]'));
  gallery.remove();
});

test('a tile is named by the title and icon of its template, its code name small, under the title of its family', async () => {
  const { root } = await opened();
  const tile = labelled(root, 'Use Proxmox VE server');
  assert.ok(tile);
  assert.equal(text(tile.querySelector('.tile-name')), 'Proxmox VE server');
  assert.equal(Reflect.get(tile.querySelector('ha-icon') ?? {}, 'icon'), 'mdi:server');
  assert.equal(text(tile.querySelector('.tile-code')), 'proxmox-server');
  const headings = [...root.querySelectorAll('.heading')].map((heading) => text(heading));
  assert.ok(headings.includes('Shipped: Proxmox VE server'));
  assert.ok(headings.includes('Shipped: Common parts'));
  assert.equal(
    headings.some((heading) => heading === 'Shipped: server' || heading === 'Shipped: common'),
    false,
  );
  const filter = labelled(root, 'Filter the templates');
  assert.ok(filter instanceof HTMLInputElement);
  filter.value = 've server';
  filter.dispatchEvent(new Event('input'));
  await until(() => labelled(root, 'Use Room') === null, 'the filter');
  assert.ok(labelled(root, 'Use Proxmox VE server'));
  assert.equal(labelled(root, 'Use Room'), null);
});

test("the home's own templates come first, under Yours", async () => {
  const { root } = await opened({ ...(await shipped()), mine: ONE }, { mine: ONE });
  assert.equal(text(root.querySelector('.heading')), 'Yours');
  assert.ok(root.querySelector('.tiles')?.querySelector('[aria-label="Use Mine"]'));
});

test('a filter narrows the gallery and looks among the pop-ups and parts too', async () => {
  const { root } = await opened();
  const filter = labelled(root, 'Filter the templates');
  assert.ok(filter instanceof HTMLInputElement);
  filter.value = 'vacuum';
  filter.dispatchEvent(new Event('input'));
  await until(() => labelled(root, 'Use Section heading') === null, 'the filter');
  assert.equal(labelled(root, 'Use Section heading'), null);
  assert.ok(labelled(root, 'Use Vacuum'));
});

test('typing in the filter keeps the box being typed in', async () => {
  const { root } = await opened();
  const filter = labelled(root, 'Filter the templates');
  assert.ok(filter instanceof HTMLInputElement);
  filter.focus();
  filter.value = 'vac';
  filter.dispatchEvent(new Event('input'));
  await until(() => labelled(root, 'Use Section heading') === null, 'the filter');
  assert.equal(labelled(root, 'Filter the templates'), filter);
  assert.equal(root.activeElement, filter);
  assert.equal(labelled(root, 'Use Section heading'), null);
});

test('a tile picked says which template, for the editor to write', async () => {
  const { gallery, root } = await opened();
  const picked: unknown[] = [];
  gallery.addEventListener('template-picked', (event) => {
    picked.push(event instanceof CustomEvent ? event.detail : undefined);
  });
  labelled(root, 'Use Room')?.click();
  assert.deepEqual(picked, [{ template: 'room' }]);
});

test('a preview is drawn only when its tile is shown', async () => {
  built.length = 0;
  observed.length = 0;
  await opened();
  assert.equal(built.length, 0);
  const first = observed[0];
  assert.ok(first && shown);
  shown([{ isIntersecting: true, target: first }]);
  await until(() => first.children.length > 0, 'the preview');
  assert.equal(built.length, 1);
  assert.equal(built[0]?.['type'], 'custom:mnml-template-card');
  assert.equal(first.children[0], cards.at(-1), 'the preview sits in its tile');
});

test("a preview in the gallery leaves the dashboard's pop-ups alone", async () => {
  cards.length = 0;
  observed.length = 0;
  await opened();
  const first = observed[0];
  assert.ok(first && shown);
  shown([{ isIntersecting: true, target: first }]);
  await until(() => cards.length > 0, 'the preview');
  assert.equal(Reflect.get(cards[0] ?? {}, 'preview'), true);
});

test('a preview in the gallery is inert, so no part of it takes the keyboard or a press', async () => {
  observed.length = 0;
  await opened();
  const first = observed[0];
  assert.ok(first);
  assert.ok(first.hasAttribute('inert'));
});

test('a new hass reaches the previews already drawn', async () => {
  cards.length = 0;
  observed.length = 0;
  const { gallery } = await opened();
  const first = observed[0];
  assert.ok(first && shown);
  shown([{ isIntersecting: true, target: first }]);
  await until(() => first.children.length > 0, 'the preview');
  const card = cards.at(-1);
  assert.ok(card);
  const latest = { ...HASS };
  gallery.hass = latest;
  await gallery.updateComplete;
  assert.equal(Reflect.get(card, 'hass'), latest);
});

test('a preview is drawn again when its template changes, and kept while it stays the same', async () => {
  built.length = 0;
  observed.length = 0;
  const { gallery } = await opened({ one: ONE, two: TWO });
  assert.ok(shown);
  shown(observed.map((target) => ({ isIntersecting: true, target })));
  await until(() => built.length === 2, 'both previews');
  await gallery.updateComplete;
  observed.length = 0;
  gallery.templates = { one: { ...ONE, description: 'Changed.' }, two: TWO };
  await gallery.updateComplete;
  assert.deepEqual(named(observed), ['one']);
});

const HOME = homes()['devices'];
assert.ok(HOME);
const DAIKIN = HOME.devices['daikin_ac'];
assert.ok(DAIKIN);
const DEVICE_HASS = fakeHass({
  states: HOME.states,
  areas: HOME.areas,
  devices: { ...HOME.devices, daikin_ac: { ...DAIKIN, area_id: null } },
  entities: HOME.entities,
});

const heading = (title: string, icon: string): Template['card'] => ({
  type: 'custom:mnml-heading-card',
  title,
  icon,
});

const FOR_DEVICES: Templates = {
  one: ONE,
  'vacuum-card': {
    title: 'Vacuum',
    icon: 'mdi:robot-vacuum',
    slots: {
      vacuum: { kind: 'entity', required: true, discover: { domain: 'vacuum' } },
      map: { kind: 'entity', discover: { domain: 'image' } },
    },
    card: heading('Vacuum', 'mdi:robot-vacuum'),
  },
  'vacuum-chip': {
    title: 'Vacuum chip',
    icon: 'mdi:robot-vacuum-variant',
    slots: { vacuum: { kind: 'entity', required: true, discover: { domain: 'vacuum' } } },
    card: heading('Chip', 'mdi:robot-vacuum-variant'),
  },
  'ac-item': {
    title: 'AC item',
    icon: 'mdi:air-conditioner',
    slots: {
      climate: {
        kind: 'entity',
        required: true,
        discover: { domain: 'climate', attribute: { hvac_modes: 'cool' } },
      },
    },
    card: heading('AC', 'mdi:air-conditioner'),
  },
};

async function forDevices(hass: HomeAssistant = DEVICE_HASS): Promise<Shelf> {
  const shelf = await opened(FOR_DEVICES);
  shelf.gallery.hass = hass;
  await shelf.gallery.updateComplete;
  labelled(shelf.root, 'For a device')?.click();
  await shelf.gallery.updateComplete;
  return shelf;
}

const labels = (root: ParentNode): (string | null)[] =>
  [...root.querySelectorAll('.tile')].map((tile) => tile.getAttribute('aria-label'));

test('For a device lists the devices a template stands for by area, then those in no area, each with its guessed kind and its cards best first', async () => {
  const { root } = await forDevices();
  assert.equal(labelled(root, 'For a device')?.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(
    [...root.querySelectorAll('.heading')].map((each) => text(each)),
    ['Living', 'Not in an area'],
  );
  const robot = root.querySelector('[aria-label="Roborock S8"]');
  assert.ok(robot);
  assert.equal(text(robot.querySelector('.device-name')), 'Roborock S8');
  assert.equal(text(robot.querySelector('.device-kind')), 'Vacuum');
  assert.equal(Reflect.get(robot.querySelector('ha-icon') ?? {}, 'icon'), 'mdi:robot-vacuum');
  assert.deepEqual(labels(robot), [
    'Use Vacuum for Roborock S8',
    'Use Vacuum chip for Roborock S8',
  ]);
  assert.deepEqual(labels(root), [
    'Use Vacuum for Roborock S8',
    'Use Vacuum chip for Roborock S8',
    'Use AC item for Bedroom AC',
  ]);
});

test('a card picked for a device says which template and which device, and its preview is drawn on that device', async () => {
  built.length = 0;
  observed.length = 0;
  const { gallery, root } = await forDevices();
  const picked: unknown[] = [];
  gallery.addEventListener('template-picked', (event) => {
    picked.push(event instanceof CustomEvent ? event.detail : undefined);
  });
  labelled(root, 'Use Vacuum chip for Roborock S8')?.click();
  assert.deepEqual(picked, [{ template: 'vacuum-chip', device: 'roborock_s8' }]);
  const target = observed.find(
    (each) => each instanceof HTMLElement && each.dataset['device'] === 'daikin_ac',
  );
  assert.ok(target && shown);
  shown([{ isIntersecting: true, target }]);
  await until(() => built.at(-1)?.['device'] === 'daikin_ac', 'the preview');
  assert.deepEqual(built.at(-1), {
    type: 'custom:mnml-template-card',
    template: 'ac-item',
    device: 'daikin_ac',
  });
});

test('the filter finds a device by its name or its cards by their title, and an empty home says no device fits', async () => {
  const { root } = await forDevices();
  const filter = labelled(root, 'Filter the templates');
  assert.ok(filter instanceof HTMLInputElement);
  filter.value = 'bedroom';
  filter.dispatchEvent(new Event('input'));
  await until(() => labels(root).length === 1, 'the filter');
  assert.deepEqual(labels(root), ['Use AC item for Bedroom AC']);
  filter.value = 'chip';
  filter.dispatchEvent(new Event('input'));
  await until(() => labels(root)[0] === 'Use Vacuum chip for Roborock S8', 'the filter');
  assert.deepEqual(labels(root), ['Use Vacuum chip for Roborock S8']);
  const empty = await forDevices({ ...HASS, devices: {}, entities: {} });
  assert.match(text(empty.root), /No device in this home fits a template/);
  labelled(empty.root, 'For a device')?.click();
  await until(() => labelled(empty.root, 'Use One') !== null, 'every template');
  assert.ok(labelled(empty.root, 'Use One'), 'back to every template');
});

test('a gallery taken off the page stops watching its tiles, and watches them again when back', async () => {
  observed.length = 0;
  const { gallery } = await opened({ one: ONE, two: TWO });
  assert.deepEqual(named(observed), ['one', 'two']);
  const before = disconnected.count;
  gallery.remove();
  assert.equal(disconnected.count, before + 1);
  observed.length = 0;
  document.body.append(gallery);
  await until(() => observed.length === 2, 'the tiles watched');
  assert.deepEqual(named(observed), ['one', 'two']);
});

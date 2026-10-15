import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Suggestion } from '../builder/areas.ts';
import { HOME, SCATTERED } from '../builder/fixture.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { fakeHass } from '../test/hass.ts';
import { define, mounted, press, text } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlAreas } from './areas.ts';
import type { AreasHost } from './areas.ts';

define('mnml-areas', MnmlAreas);

interface Page {
  element: MnmlAreas;
  root: ShadowRoot;
  assigned: (readonly Suggestion[])[];
  done: string[];
}

async function page(
  given: { undoable?: boolean; assign?: () => Promise<boolean>; hass?: HomeAssistant } = {},
): Promise<Page> {
  const assigned: (readonly Suggestion[])[] = [];
  const done: string[] = [];
  const host: AreasHost = {
    assign: (chosen) => {
      assigned.push(chosen);
      return given.assign?.() ?? Promise.resolve(true);
    },
    undo: () => {
      done.push('undo');
      return Promise.resolve(true);
    },
    leave: () => {
      done.push('leave');
    },
  };
  const element = new MnmlAreas();
  element.hass = given.hass ?? fakeHass(SCATTERED);
  element.host = host;
  element.undoable = given.undoable ?? false;
  return { element, root: await mounted(element), assigned, done };
}

function section(root: ShadowRoot, name: string): HTMLElement {
  const found = [...root.querySelectorAll<HTMLElement>('section')].find(
    (each) => text(each.querySelector('h2')) === name,
  );
  assert.ok(found, name);
  return found;
}

function box(root: ParentNode, label: string): HTMLInputElement {
  const found = root.querySelector(`input[aria-label="${label}"]`);
  assert.ok(found instanceof HTMLInputElement, label);
  return found;
}

function untick(root: ParentNode, label: string): void {
  const input = box(root, label);
  input.checked = false;
  input.dispatchEvent(new Event('change'));
}

const previewOf = (at: HTMLElement): unknown => {
  const card = at.querySelector('mnml-live-card');
  return card === null ? undefined : Reflect.get(card, 'config');
};

const previewHass = (at: HTMLElement): unknown =>
  Reflect.get(at.querySelector('mnml-live-card') ?? {}, 'hass');

test('the page groups what it can place by area, the areas Home Assistant has first, each with its room as it would be and a tick for each thing', async () => {
  const { element, root } = await page();
  assert.deepEqual(
    [...root.querySelectorAll('section h2')].map((each) => text(each)),
    ['Attic', 'Office'],
  );
  const attic = section(root, 'Attic');
  assert.equal(attic.querySelector('.badge'), null);
  assert.match(text(attic), /Attic bulb\s*A device with 1 entity, by its name/);
  assert.deepEqual(previewOf(attic), {
    type: 'custom:mnml-template-card',
    template: 'room',
    area: 'attic',
    slots: undefined,
  });
  const office = section(root, 'Office');
  assert.equal(text(office.querySelector('.badge')), 'New area');
  assert.match(text(office), /Office desk\s*light\.office_desk, by its name/);
  const hass = previewHass(office);
  assert.equal(Reflect.get(Reflect.get(hass ?? {}, 'areas') ?? {}, 'office')?.name, 'Office');
  assert.match(text(root), /2 devices and 1 entity are in no area, so no room shows them\./);
  assert.equal(text(root.querySelector('.action.primary')), 'Assign 4 in Home Assistant');
  element.remove();
});

test('what is unticked stays out of the assign and out of the room preview, and a group unticked has no preview', async () => {
  const { element, root, assigned } = await page();
  untick(root, 'Attic bulb');
  await element.updateComplete;
  const devices = Reflect.get(previewHass(section(root, 'Attic')) ?? {}, 'devices');
  assert.equal(Reflect.get(Reflect.get(devices ?? {}, 'bulb') ?? {}, 'area_id'), undefined);
  assert.equal(Reflect.get(Reflect.get(devices ?? {}, 'thermometer') ?? {}, 'area_id'), 'attic');
  untick(section(root, 'Office'), 'Everything for Office');
  await element.updateComplete;
  assert.equal(previewOf(section(root, 'Office')), undefined);
  assert.equal(box(root, 'Office desk').checked, false);
  press(root, 'Assign 1 in Home Assistant');
  await until(() => /Placed/.test(text(root)), 'what was placed');
  assert.deepEqual(
    assigned[0]?.map(({ id }) => id),
    ['thermometer'],
  );
  assert.match(text(root), /Placed 1 device\./);
  element.remove();
});

test('an assign Home Assistant refuses part way says why, and the page stays', async () => {
  const { element, root } = await page({
    assign: () => Promise.reject(new Error('Not everything could be placed: Cannot save.')),
  });
  press(root, 'Assign 4 in Home Assistant');
  await until(() => root.querySelector('.problem-line') !== null, 'the reason');
  assert.equal(
    text(root.querySelector('.problem-line')),
    'Not everything could be placed: Cannot save.',
  );
  assert.equal(root.querySelectorAll('section').length, 2);
  element.remove();
});

test('Undo shows only when there is something to undo, and says when everything is back', async () => {
  const none = await page();
  assert.ok(![...none.root.querySelectorAll('button')].some((each) => text(each) === 'Undo'));
  none.element.remove();
  const { element, root, done } = await page({ undoable: true });
  press(root, 'Undo');
  await until(() => /Everything is back/.test(text(root)), 'that everything is back');
  assert.deepEqual(done, ['undo']);
  assert.match(text(root), /Everything is back where it was\./);
  press(root, 'Back');
  assert.deepEqual(done, ['undo', 'leave']);
  element.remove();
});

test('a long group shows six and a button for the rest', async () => {
  const many = Object.fromEntries(
    Array.from({ length: 9 }, (_, index) => [
      `sensor.office_${index}`,
      { entity_id: `sensor.office_${index}`, platform: 'template' },
    ]),
  );
  const { element, root } = await page({
    hass: fakeHass({ ...SCATTERED, entities: { ...SCATTERED.entities, ...many } }),
  });
  const office = section(root, 'Office');
  assert.equal(office.querySelectorAll('.plan-row').length, 7);
  press(office, '5 more');
  await element.updateComplete;
  assert.equal(section(root, 'Office').querySelectorAll('.plan-row').length, 12);
  element.remove();
});

test('with nothing it can place, the page says so, offers no assign, and points to the devices page', async () => {
  const { element, root } = await page({ hass: fakeHass(HOME) });
  assert.match(text(root), /MNML finds nothing more it can place by its name\./);
  assert.ok(root.querySelector('a[href="/config/devices/dashboard"]'));
  assert.equal(root.querySelector('.action.primary'), null);
  element.remove();
});

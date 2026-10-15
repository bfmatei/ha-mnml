import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import { defaultPlan } from '../builder/plan.ts';
import type { Plan } from '../contract/plan.ts';
import type { Value } from '../contract/templates.ts';
import { readTemplates } from '../templates/shipped.ts';
import { fakeHass } from '../test/hass.ts';
import { define, mounted, press, text } from '../test/render.ts';
import { until } from '../test/until.ts';

import { MnmlLiveCard } from './live-card.ts';
import { MnmlPlanEditor } from './plan-editor.ts';

const TEMPLATES = readTemplates();
const HASS = fakeHass(HOME);
const opened: FakeEditor[] = [];

class FakeEditor extends HTMLElement {
  config: unknown;
  hass: unknown;
  setConfig(config: unknown): void {
    this.config = config;
  }
  change(config: Record<string, Value>): void {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true }));
  }
}

class FakeTemplateCard extends HTMLElement {
  static getConfigElement(): Promise<HTMLElement> {
    const editor = new FakeEditor();
    opened.push(editor);
    return Promise.resolve(editor);
  }
}

define('mnml-fake-editor', FakeEditor);
define('mnml-template-card', FakeTemplateCard);
define('mnml-plan-editor', MnmlPlanEditor);
define('mnml-live-card', MnmlLiveCard);

async function editor(): Promise<{
  element: MnmlPlanEditor;
  root: ShadowRoot;
  saved: Plan[];
}> {
  const saved: Plan[] = [];
  const element = new MnmlPlanEditor();
  element.hass = HASS;
  element.templates = TEMPLATES;
  element.plan = defaultPlan(HOME, TEMPLATES);
  element.address = 'dashboard-home';
  element.fresh = true;
  element.host = {
    save: (plan) => {
      saved.push(plan);
      return Promise.resolve();
    },
    leave: () => undefined,
    sortAreas: () => undefined,
  };
  return { element, root: await mounted(element), saved };
}

async function customized(
  element: MnmlPlanEditor,
  root: ShadowRoot,
  open: string,
  config: Record<string, Value>,
): Promise<HTMLDialogElement> {
  const before = opened.length;
  press(root, open);
  await until(() => opened.length > before, "the template card's editor");
  const fake = opened.at(-1);
  assert.ok(fake);
  fake.change(config);
  const dialog = root.querySelector('dialog.customize');
  assert.ok(dialog instanceof HTMLDialogElement);
  press(dialog, 'Done');
  await element.updateComplete;
  return dialog;
}

async function saved(element: MnmlPlanEditor, root: ShadowRoot, plans: Plan[]): Promise<Plan> {
  const before = plans.length;
  press(root, 'Create');
  await until(() => plans.length > before, 'the plan saved');
  const plan = plans.at(-1);
  assert.ok(plan);
  element.remove();
  return plan;
}

test("Customize opens the template card's editor on the row's card, and keeps what it overrides", async () => {
  const { element, root, saved: plans } = await editor();
  const dialog = await customized(element, root, 'Customize Kitchen', {
    type: 'custom:mnml-template-card',
    template: 'room',
    area: 'kitchen',
    slots: { name: 'Cook' },
  });
  assert.deepEqual(opened.at(-1)?.config, {
    type: 'custom:mnml-template-card',
    template: 'room',
    area: 'kitchen',
  });
  const title = dialog.getAttribute('aria-labelledby');
  assert.ok(title);
  assert.equal(text(dialog.querySelector(`h2[id="${title}"]`)), 'Customize Kitchen');
  assert.equal(dialog.isConnected, false);
  const plan = await saved(element, root, plans);
  assert.deepEqual(plan.rooms[0], { area: 'kitchen', slots: { name: 'Cook' } });
});

test('a customized card that does not draw, or is another template, is refused in the dialog', async () => {
  const { element, root } = await editor();
  const other = await customized(element, root, 'Customize Kitchen', {
    type: 'custom:mnml-template-card',
    template: 'lights',
  });
  assert.equal(other.isConnected, true);
  assert.match(text(other), /drawn by the Room template/);
  element.remove();
});

test('a car is added through its editor once it has a key and draws', async () => {
  const { element, root, saved: plans } = await editor();
  const example = TEMPLATES['car']?.example ?? {};
  const keyless = await customized(element, root, 'Add a car', {
    type: 'custom:mnml-template-card',
    template: 'car',
    slots: Object.fromEntries(Object.entries(example).filter(([name]) => name !== 'key')),
  });
  assert.equal(keyless.isConnected, true);
  assert.match(text(keyless), /Short name is needed/);
  assert.doesNotMatch(text(keyless), /the slot key/);
  keyless.querySelector<HTMLButtonElement>('button')?.click();
  await element.updateComplete;
  await customized(element, root, 'Add a car', {
    type: 'custom:mnml-template-card',
    template: 'car',
    slots: { ...example, key: 'sedan' },
  });
  const plan = await saved(element, root, plans);
  assert.equal(plan.cars.length, 1);
  assert.equal(plan.cars[0]?.key, 'sedan');
  assert.equal(plan.cars[0]?.slots['key'], undefined);
});

test('Customize shows the card as it is edited, drawn but inert', async () => {
  const { element, root } = await editor();
  press(root, 'Customize Kitchen');
  await until(() => root.querySelector('dialog.customize') !== null, 'the dialog');
  const dialog = root.querySelector('dialog.customize');
  assert.ok(dialog instanceof HTMLDialogElement);
  const preview = dialog.querySelector('mnml-live-card');
  assert.ok(preview instanceof MnmlLiveCard);
  assert.ok(preview.hasAttribute('inert'));
  assert.equal(preview.hass, HASS);
  assert.deepEqual(preview.config, {
    type: 'custom:mnml-template-card',
    template: 'room',
    area: 'kitchen',
  });
  const edited = {
    type: 'custom:mnml-template-card',
    template: 'room',
    area: 'kitchen',
    slots: { name: 'Cook' },
  };
  opened.at(-1)?.change(edited);
  assert.deepEqual(dialog.querySelector<MnmlLiveCard>('mnml-live-card')?.config, edited);
  press(dialog, 'Cancel');
  element.remove();
});

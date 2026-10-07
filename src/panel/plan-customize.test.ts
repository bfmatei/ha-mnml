import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import { defaultPlan } from '../builder/plan.ts';
import type { Plan } from '../contract/builder.ts';
import type { Value } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { readTemplates } from '../templates/shipped.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlLiveCard } from './live-card.ts';
import { MnmlPlanEditor } from './plan-editor.ts';

const TEMPLATES = readTemplates();
const HASS = { ...HOME, locale: { language: 'en' } } as never as HomeAssistant;
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
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
  this.open = false;
};

const later = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

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
  };
  return { element, root: await mounted(element), saved };
}

function press(root: ParentNode, label: string): void {
  const found = [...root.querySelectorAll('button')].find(
    (each) => each.getAttribute('aria-label') === label || text(each) === label,
  );
  assert.ok(found, label);
  found.click();
}

async function customized(
  element: MnmlPlanEditor,
  root: ShadowRoot,
  open: string,
  config: Record<string, Value>,
): Promise<HTMLDialogElement> {
  press(root, open);
  await later();
  const fake = opened.at(-1);
  assert.ok(fake);
  fake.change(config);
  const dialog = root.querySelector('dialog.customize');
  assert.ok(dialog instanceof HTMLDialogElement);
  press(dialog, 'Done');
  await later();
  await element.updateComplete;
  return dialog;
}

async function saved(element: MnmlPlanEditor, root: ShadowRoot, plans: Plan[]): Promise<Plan> {
  press(root, 'Create');
  await later();
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
  assert.match(text(other), /drawn by the room template/);
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
  assert.match(text(keyless), /the slot key is required|A car needs a key/);
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

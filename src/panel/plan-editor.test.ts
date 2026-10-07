import assert from 'node:assert/strict';

import { test } from 'vitest';

import { HOME } from '../builder/fixture.ts';
import { defaultPlan } from '../builder/plan.ts';
import type { Plan } from '../contract/builder.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { readTemplates } from '../templates/shipped.ts';
import { define, mounted, text } from '../test/render.ts';

import { MnmlLiveCard } from './live-card.ts';
import { MnmlPlanEditor } from './plan-editor.ts';

define('mnml-plan-editor', MnmlPlanEditor);
define('mnml-live-card', MnmlLiveCard);

const TEMPLATES = readTemplates();
const HASS = { ...HOME, locale: { language: 'en' } } as never as HomeAssistant;

async function editor(
  options: { fresh?: boolean; taken?: string[]; plan?: Plan } = {},
): Promise<{ element: MnmlPlanEditor; root: ShadowRoot; saved: [Plan, string][] }> {
  const saved: [Plan, string][] = [];
  const element = new MnmlPlanEditor();
  element.hass = HASS;
  element.templates = TEMPLATES;
  element.plan = options.plan ?? defaultPlan(HOME, TEMPLATES);
  element.address = 'dashboard-home';
  element.fresh = options.fresh ?? true;
  element.taken = new Set(options.taken ?? []);
  element.host = {
    save: (plan, address) => {
      saved.push([plan, address]);
      return Promise.resolve();
    },
    leave: () => undefined,
  };
  return { element, root: await mounted(element), saved };
}

function control<T extends Element>(root: ShadowRoot, selector: string): T {
  const found = root.querySelector<T>(selector);
  assert.ok(found, selector);
  return found;
}

function labelled(root: ShadowRoot, label: string): HTMLInputElement | HTMLButtonElement {
  const found = [
    ...root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'),
  ].find((each) => each.getAttribute('aria-label') === label || text(each) === label);
  assert.ok(found, label);
  return found;
}

async function save(element: MnmlPlanEditor, root: ShadowRoot): Promise<void> {
  labelled(root, element.fresh ? 'Create' : 'Rebuild').click();
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}

test('an area with no light offers no room, and one ticked comes last', async () => {
  const plan: Plan = { ...defaultPlan(HOME, TEMPLATES), rooms: [{ area: 'living' }] };
  const { element, root, saved } = await editor({ plan });
  const hallway = labelled(root, 'Show Hallway');
  assert.ok(hallway instanceof HTMLInputElement);
  assert.equal(hallway.disabled, true);
  assert.match(text(root), /A room tile needs a light here/);
  labelled(root, 'Show Kitchen').dispatchEvent(new Event('change'));
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].rooms, [{ area: 'living' }, { area: 'kitchen' }]);
  element.remove();
});

test('rooms move up and down, and the plan keeps the order', async () => {
  const { element, root, saved } = await editor();
  const down = [...root.querySelectorAll<HTMLButtonElement>('[aria-label="Move down"]')];
  assert.equal(down.length, 2);
  assert.equal(down[1]?.disabled, true);
  down[0]?.click();
  await element.updateComplete;
  await save(element, root);
  assert.deepEqual(saved[0]?.[0].rooms, [{ area: 'living' }, { area: 'kitchen' }]);
  element.remove();
});

test('a person unticked and a pop-up opening chosen reach the saved plan, with the address', async () => {
  const { element, root, saved } = await editor();
  labelled(root, 'Show person.bob').dispatchEvent(new Event('change'));
  const phone = [...root.querySelectorAll('select')][0];
  assert.ok(phone);
  phone.value = 'unfold';
  phone.dispatchEvent(new Event('change'));
  await element.updateComplete;
  await save(element, root);
  const [plan, address] = saved[0] ?? [];
  assert.deepEqual(plan?.people, [{ entity: 'person.jane' }]);
  assert.deepEqual(plan?.open, { phone: 'unfold', tablet: 'unfold', desktop: 'unfold' });
  assert.equal(address, 'dashboard-home');
  element.remove();
});

test('an address without a hyphen, or taken, is refused before anything is saved', async () => {
  const { element, root, saved } = await editor({ taken: ['dashboard-flat'] });
  const inputs = [...root.querySelectorAll<HTMLInputElement>('input.fact-input')];
  const address = inputs[2];
  assert.ok(address);
  address.value = 'home';
  address.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.match(text(control(root, '.problem-line')), /at least one -/);
  address.value = 'dashboard-flat';
  address.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.match(text(control(root, '.problem-line')), /\/dashboard-flat is taken/);
  assert.deepEqual(saved, []);
  element.remove();
});

test('an icon that is not mdi: and a name is refused, and a title is trimmed', async () => {
  const { element, root, saved } = await editor();
  const [title, iconInput] = [...root.querySelectorAll<HTMLInputElement>('input.fact-input')];
  assert.ok(title && iconInput);
  iconInput.value = 'home';
  iconInput.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.match(text(control(root, '.problem-line')), /An icon is mdi:/);
  iconInput.value = 'mdi:home-city';
  iconInput.dispatchEvent(new Event('input'));
  title.value = '  Our flat  ';
  title.dispatchEvent(new Event('input'));
  await save(element, root);
  assert.equal(saved[0]?.[0].title, 'Our flat');
  assert.equal(saved[0]?.[0].icon, 'mdi:home-city');
  element.remove();
});

test('a dashboard MNML built is rebuilt at its own address, which is not asked', async () => {
  const { element, root, saved } = await editor({ fresh: false });
  assert.equal(root.querySelectorAll('input.fact-input').length, 2);
  await save(element, root);
  assert.equal(saved[0]?.[1], 'dashboard-home');
  element.remove();
});

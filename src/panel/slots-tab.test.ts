import assert from 'node:assert/strict';

import { render } from 'lit';
import { test } from 'vitest';

import type { Template, WrittenTemplate } from '../contract/templates.ts';
import { homes } from '../templates/corpus.ts';
import { drawn } from '../test/render.ts';

import { drawSlots } from './slots-tab.ts';
import type { SlotsActions } from './slots-tab.ts';

const actions = (edit: (next: WrittenTemplate) => void, shipped?: Template): SlotsActions => ({
  name: 'garden',
  hass: undefined,
  open: new Map(),
  areas: [],
  shipped,
  update: edit,
  redraw: () => {},
});

function change(root: HTMLElement, label: string, value: string): void {
  const input = root.querySelector(`input[aria-label="${label}"]`);
  assert.ok(input instanceof HTMLInputElement, label);
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

test('two fields of a slot changed one after the other both stay, without a redraw between them', () => {
  let template: WrittenTemplate = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = drawn(
    drawSlots(
      () => template,
      actions((next) => {
        template = next;
      }),
    ),
  );
  change(box, 'Label', 'Title');
  change(box, 'Help', 'The heading');
  assert.deepEqual(template.slots?.['title'], {
    kind: 'text',
    label: 'Title',
    help: 'The heading',
  });
});

test('a slot that differs from the shipped template is marked changed, and one as shipped is not', () => {
  const shipped: Template = {
    slots: { title: { kind: 'text' }, icon: { kind: 'icon' } },
    card: { type: 'x' },
  };
  const template: Template = {
    slots: {
      title: { kind: 'text', label: 'Title' },
      icon: { kind: 'icon' },
      extra: { kind: 'flag' },
    },
    card: { type: 'x' },
  };
  const box = drawn(
    drawSlots(
      () => template,
      actions(() => {}, shipped),
    ),
  );
  const marked = [...box.querySelectorAll('.slot')]
    .filter((slot) => slot.querySelector('.badge.changed') !== null)
    .map((slot) => slot.querySelector('.slot-name')?.textContent);
  assert.deepEqual(marked, ['title', 'extra']);
});

test("a template of the home's own marks no slot changed", () => {
  const template: Template = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = drawn(
    drawSlots(
      () => template,
      actions(() => {}),
    ),
  );
  assert.equal(box.querySelector('.badge.changed'), null);
});

test('a new slot is added under the name typed, and a name taken is refused', () => {
  let template: WrittenTemplate = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = drawn(
    drawSlots(
      () => template,
      actions((next) => {
        template = next;
      }),
    ),
  );
  const input = box.querySelector('input[aria-label="The new slot"]');
  const add = box.querySelector('button[aria-label="Add the slot"]');
  assert.ok(input instanceof HTMLInputElement && add instanceof HTMLButtonElement);
  input.value = 'title';
  input.dispatchEvent(new Event('input'));
  add.click();
  assert.deepEqual(Object.keys(template.slots ?? {}), ['title']);
  assert.equal(input.validationMessage, 'A slot of that name is there already');
  input.value = 'subtitle';
  input.dispatchEvent(new Event('input'));
  add.click();
  assert.deepEqual(template.slots?.['subtitle'], { kind: 'text' });
});

test('a slot name typed is still the one added after the tab draws again', () => {
  let template: WrittenTemplate = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = document.createElement('div');
  const draw = (): void => {
    render(
      drawSlots(
        () => template,
        actions((next) => {
          template = next;
        }),
      ),
      box,
    );
  };
  draw();
  const input = box.querySelector('input[aria-label="The new slot"]');
  const kind = box.querySelector('.add-slot select');
  assert.ok(input instanceof HTMLInputElement && kind instanceof HTMLSelectElement);
  input.value = 'lamp';
  input.dispatchEvent(new Event('input'));
  kind.value = 'entity';
  kind.dispatchEvent(new Event('change'));
  draw();
  const add = box.querySelector('button[aria-label="Add the slot"]');
  assert.ok(add instanceof HTMLButtonElement);
  add.click();
  assert.deepEqual(template.slots?.['lamp'], { kind: 'entity' });
});

test('a choice shows the value the template holds after a redraw, even one the user changed', () => {
  const template: Template = { slots: { title: { kind: 'text' } }, card: { type: 'x' } };
  const box = document.createElement('div');
  const draw = (): void => {
    render(
      drawSlots(
        () => template,
        actions(() => {}),
      ),
      box,
    );
  };
  draw();
  const kind = box.querySelector('select[aria-label="Kind"]');
  assert.ok(kind instanceof HTMLSelectElement);
  kind.value = 'entity';
  kind.dispatchEvent(new Event('change'));
  draw();
  assert.equal(kind.value, 'text');
});

function messyHass(): SlotsActions['hass'] {
  const registries = homes()['messy'];
  assert.ok(registries);
  return {
    areas: registries.areas,
    devices: registries.devices,
    entities: registries.entities,
    states: Object.fromEntries(
      Object.entries(registries.states).map(([id, state]) => [
        id,
        { entity_id: id, state: 'on', ...state },
      ]),
    ),
  } as unknown as SlotsActions['hass'];
}

test('trying a rule in an area explains the matches, the pick and what almost matched', () => {
  const template: Template = {
    slots: {
      window: { kind: 'entity', discover: { domain: 'binary_sensor', device_class: 'window' } },
      lock: { kind: 'entity', discover: { domain: 'lock' } },
    },
    card: { type: 'x' },
  };
  const box = drawn(
    drawSlots(() => template, {
      ...actions(() => {}),
      hass: messyHass(),
      areas: [{ value: 'den', label: 'Den' }],
    }),
  );
  const traces = [...box.querySelectorAll('.trace')].map((trace) => trace.textContent ?? '');
  assert.equal(traces.length, 2, 'each slot with a rule explains itself');
  const [window, lock] = traces;
  assert.match(
    window ?? '',
    /binary_sensor with device class window: 2 matches, took binary_sensor\.den_window_a/,
  );
  assert.match(window ?? '', /tied with binary_sensor\.den_window_b/);
  assert.match(window ?? '', /binary_sensor\.den_vent has no device class/);
  assert.match(lock ?? '', /no lock in Den/);
});

test('a rule with the newer filters is drawn as a sentence, and the rest can be added as words', () => {
  const template: Template = {
    slots: {
      power: {
        kind: 'entity',
        discover: {
          domain: 'sensor',
          unit: 'W',
          label: 'main',
          exclude: { entity_category: 'diagnostic' },
        },
      },
    },
    card: { type: 'x' },
  };
  const box = drawn(
    drawSlots(() => template, {
      ...actions(() => {}),
      hass: messyHass(),
      areas: [{ value: 'den', label: 'Den' }],
    }),
  );
  assert.equal(box.querySelector('.rule-yaml'), null, 'the form can draw it');
  const text = box.querySelector('.finding')?.textContent ?? '';
  assert.match(text, /with unit/);
  assert.match(text, /labelled/);
  for (const word of ['in the category', 'with state class', 'named like', 'made by', 'of model']) {
    assert.ok(box.querySelector(`button[aria-label="Add: ${word}"]`), `${word} can be added`);
  }
});

function slotNamed(root: ParentNode, name: string): Element {
  const found = [...root.querySelectorAll('.slot')].find(
    (slot) => slot.querySelector(':scope > .slot-head .slot-name')?.textContent === name,
  );
  assert.ok(found, name);
  return found;
}

function tick(root: ParentNode, label: string): void {
  const input = root.querySelector(`:scope > .slot-facts input[aria-label="${label}"]`);
  assert.ok(input instanceof HTMLInputElement, label);
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

test('a slot that names a shape shows the shape by name with its fields, and an edit writes only what differs from the shape', () => {
  let template: WrittenTemplate = {
    slots: { energy: { shape: 'meter', label: 'Energy' } },
    card: { type: 'x' },
  };
  const box = document.createElement('div');
  const draw = (): void => {
    render(
      drawSlots(
        () => template,
        actions((next) => {
          template = next;
        }),
      ),
      box,
    );
  };
  draw();
  const energy = slotNamed(box, 'energy');
  assert.match(energy.querySelector(':scope > .slot-head')?.textContent ?? '', /a meter/);
  const fields = [...energy.querySelectorAll(':scope > .fields .slot-name')].map(
    (name) => name.textContent,
  );
  assert.deepEqual(fields, ['power', 'today', 'total']);
  assert.equal(
    energy.querySelector('button[aria-label="Delete the slot power"]'),
    null,
    "a shape's field stays",
  );
  assert.equal(energy.querySelector('.fields .add-slot'), null, 'and none is added to it');
  tick(slotNamed(energy, 'power'), 'Required');
  assert.deepEqual(template.slots?.['energy'], {
    shape: 'meter',
    label: 'Energy',
    fields: { power: { required: true } },
  });
  draw();
  change(slotNamed(box, 'energy').querySelector(':scope > .slot-facts') ?? box, 'Help', 'Its use');
  assert.deepEqual(template.slots?.['energy'], {
    shape: 'meter',
    label: 'Energy',
    help: 'Its use',
    fields: { power: { required: true } },
  });
});

function fact(slot: Element, label: string): HTMLInputElement {
  const input = slot.querySelector(`:scope > .slot-facts input[aria-label="${label}"]`);
  assert.ok(input instanceof HTMLInputElement, label);
  return input;
}

function typeIn(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

test("a slot that names a shape shows what the shape gives as each field's placeholder, and an edit back to it, or a field cleared, is no override", () => {
  let template: WrittenTemplate = {
    slots: {
      words: { shape: 'lock_words', label: 'Words', default: { secured: 'Shut' } },
      checks: { shape: 'checks' },
    },
    card: { type: 'x' },
  };
  const box = document.createElement('div');
  const draw = (): void => {
    render(
      drawSlots(
        () => template,
        actions((next) => {
          template = next;
        }),
      ),
      box,
    );
  };
  draw();
  const words = (): Element => slotNamed(box, 'words');
  const failed = (): Element => slotNamed(slotNamed(box, 'checks'), 'failed');
  assert.equal(fact(words(), 'Label').value, 'Words');
  assert.equal(fact(words(), 'Label').placeholder, 'Lock words');
  assert.equal(fact(words(), 'Default').value, '{"secured":"Shut"}');
  assert.equal(
    fact(words(), 'Default').placeholder,
    '{"secured":"Locked","selectivelocked":"Partly locked"}',
  );
  assert.equal(fact(failed(), 'Label').value, '');
  assert.equal(fact(failed(), 'Label').placeholder, 'Failed checks');

  typeIn(fact(words(), 'Label'), '');
  typeIn(fact(words(), 'Default'), '');
  draw();
  assert.deepEqual(template.slots?.['words'], { shape: 'lock_words' });
  assert.equal(fact(words(), 'Label').value, '');
  assert.equal(fact(words(), 'Label').placeholder, 'Lock words');
  assert.equal(fact(words(), 'Default').value, '');

  typeIn(fact(words(), 'Label'), 'Lock words');
  assert.deepEqual(template.slots?.['words'], { shape: 'lock_words' });
  assert.equal(fact(words(), 'Label').value, '', "the shape's own value shows as the placeholder");
  typeIn(fact(words(), 'Default'), '{ secured: Locked, selectivelocked: Partly locked }');
  assert.deepEqual(template.slots?.['words'], { shape: 'lock_words' });
  assert.equal(fact(words(), 'Default').value, '');

  typeIn(fact(failed(), 'Label'), 'Failures');
  draw();
  assert.deepEqual(template.slots?.['checks'], {
    shape: 'checks',
    fields: { failed: { label: 'Failures' } },
  });
  assert.equal(fact(failed(), 'Label').value, 'Failures');
  typeIn(fact(failed(), 'Label'), '');
  draw();
  assert.deepEqual(template.slots?.['checks'], { shape: 'checks' });
  assert.equal(fact(failed(), 'Label').value, '');
  assert.equal(fact(failed(), 'Label').placeholder, 'Failed checks');
});

test('a field that names a shape, inside a slot written out, is shown and edited as its shape', () => {
  let template: WrittenTemplate = {
    slots: { plug: { kind: 'object', fields: { energy: { shape: 'meter' } } } },
    card: { type: 'x' },
  };
  const box = drawn(
    drawSlots(
      () => template,
      actions((next) => {
        template = next;
      }),
    ),
  );
  const energy = slotNamed(slotNamed(box, 'plug'), 'energy');
  assert.match(energy.querySelector(':scope > .slot-head')?.textContent ?? '', /a meter/);
  tick(slotNamed(energy, 'today'), 'Required');
  assert.deepEqual(template.slots?.['plug'], {
    kind: 'object',
    fields: { energy: { shape: 'meter', fields: { today: { required: true } } } },
  });
});

test('a slot naming a shape that is not known says why, and can be deleted', () => {
  let template: WrittenTemplate = {
    slots: { energy: { shape: 'metre' }, title: { kind: 'text' } },
    card: { type: 'x' },
  };
  const box = drawn(
    drawSlots(
      () => template,
      actions((next) => {
        template = next;
      }),
    ),
  );
  const energy = slotNamed(box, 'energy');
  assert.match(energy.textContent ?? '', /the shape metre, which is not known/);
  const remove = energy.querySelector('button[aria-label="Delete the slot energy"]');
  assert.ok(remove instanceof HTMLButtonElement);
  remove.click();
  assert.deepEqual(template.slots, { title: { kind: 'text' } });
});

test("the device words come from discovery's vocabulary, and a rule on an attribute or a device anchor is edited as YAML and kept", () => {
  let template: WrittenTemplate = {
    slots: {
      ac: {
        kind: 'object',
        fields: { entity: { kind: 'entity' } },
        discover: {
          device: { domain: 'climate', attribute: { hvac_modes: 'cool' } },
          fields: { entity: { domain: 'climate', attribute: { hvac_modes: 'cool' } } },
        },
      },
      cooler: {
        kind: 'entity',
        discover: { domain: 'climate', attribute: { hvac_modes: 'cool' } },
      },
      plain: { kind: 'entity', discover: { domain: 'sensor' } },
    },
    card: { type: 'x' },
  };
  const box = drawn(
    drawSlots(
      () => template,
      actions((next) => {
        template = next;
      }),
    ),
  );
  for (const word of ['on a device of type', 'on a device of the integration']) {
    assert.ok(box.querySelector(`button[aria-label="Add: ${word}"]`), `${word} can be added`);
  }
  const areas = [...box.querySelectorAll('textarea[aria-label="The rule in YAML"]')];
  assert.equal(areas.length, 2, 'the anchored rule and the attribute rule are YAML');
  const anchored = areas[0];
  assert.ok(anchored instanceof HTMLTextAreaElement);
  anchored.value =
    'device: [{ domain: climate, attribute: { hvac_modes: cool } }, { model: dock }]\nscope: area\nfields: { entity: { domain: climate } }';
  anchored.dispatchEvent(new Event('change', { bubbles: true }));
  assert.deepEqual(template.slots?.['ac']?.discover, {
    device: [{ domain: 'climate', attribute: { hvac_modes: 'cool' } }, { model: 'dock' }],
    scope: 'area',
    fields: { entity: { domain: 'climate' } },
  });
  anchored.value = 'device: { attribute: { hvac_modes: [cool] } }\nfields: {}';
  anchored.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(anchored.getAttribute('aria-invalid'), 'true', 'an attribute takes one word');
});

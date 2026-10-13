import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define, mounted } from '../test/render.ts';

import { MnmlRelated } from './related.ts';

define('mnml-related', MnmlRelated);

interface Asked {
  readonly got: unknown[];
  readonly stopped: boolean;
  dispose(): void;
}

function ask(from: Element, context = 'related'): Asked {
  const got: unknown[] = [];
  const asked = { got, stopped: true, dispose: (): void => undefined };
  const reached = (): void => {
    asked.stopped = false;
  };
  document.body.addEventListener('context-request', reached);
  const request = new Event('context-request', { bubbles: true, composed: true });
  Object.assign(request, {
    context,
    subscribe: true,
    callback: (value: unknown, dispose: () => void): void => {
      got.push(value);
      asked.dispose = dispose;
    },
  });
  from.dispatchEvent(request);
  document.body.removeEventListener('context-request', reached);
  return asked;
}

async function wrapped(): Promise<{ related: MnmlRelated; picker: HTMLElement }> {
  const related = document.createElement('mnml-related');
  assert.ok(related instanceof MnmlRelated);
  const picker = document.createElement('span');
  related.append(picker);
  await mounted(related);
  return { related, picker };
}

const ROBOT = {
  entities: new Set<string>(),
  devices: new Set(['robo', 'dock']),
  areas: new Set(['living']),
};

test("a picker inside asks for its related context and gets the device's, which follows a change", async () => {
  const { related, picker } = await wrapped();
  related.related = ROBOT;
  await related.updateComplete;
  const asked = ask(picker);
  assert.equal(asked.stopped, true, 'the request goes no further');
  assert.deepEqual(asked.got, [ROBOT]);
  related.related = {
    entities: new Set<string>(),
    devices: new Set(['dock', 'robo']),
    areas: new Set(['living']),
  };
  await related.updateComplete;
  assert.equal(asked.got.length, 1, 'the same device drawn again tells nothing');
  const mini = {
    entities: new Set<string>(),
    devices: new Set(['mini']),
    areas: new Set<string>(),
  };
  related.related = mini;
  await related.updateComplete;
  assert.deepEqual(asked.got, [ROBOT, mini]);
  asked.dispose();
  related.related = ROBOT;
  await related.updateComplete;
  assert.equal(asked.got.length, 2, 'a picker gone is told nothing more');
});

function consumed(from: Element): unknown[] {
  const got: unknown[] = [];
  let unsubscribe: (() => void) | undefined;
  const request = new Event('context-request', { bubbles: true, composed: true });
  Object.assign(request, {
    context: 'related',
    subscribe: true,
    callback: (value: unknown, dispose: () => void): void => {
      if (unsubscribe !== undefined && unsubscribe !== dispose) {
        unsubscribe();
      }
      unsubscribe = dispose;
      got.push(value);
    },
  });
  from.dispatchEvent(request);
  return got;
}

test("a picker that lets go of a provider whose dispose changes, as Home Assistant's do, is told every change", async () => {
  const { related, picker } = await wrapped();
  related.related = ROBOT;
  await related.updateComplete;
  const got = consumed(picker);
  const mini = {
    entities: new Set<string>(),
    devices: new Set(['mini']),
    areas: new Set<string>(),
  };
  related.related = mini;
  await related.updateComplete;
  related.related = ROBOT;
  await related.updateComplete;
  assert.deepEqual(got, [ROBOT, mini, ROBOT]);
});

test('without a device, and for any other context, the request goes on to Home Assistant', async () => {
  const { related, picker } = await wrapped();
  assert.equal(ask(picker).stopped, false);
  related.related = ROBOT;
  await related.updateComplete;
  assert.equal(ask(picker, 'hassUi').stopped, false);
});

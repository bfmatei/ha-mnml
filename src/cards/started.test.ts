import assert from 'node:assert/strict';

import { test } from 'vitest';

import { define } from '../test/render.ts';

import { started } from './started.ts';

const tick = (): Promise<string> =>
  new Promise((resolve) => {
    setImmediate(() => {
      resolve('pending');
    });
  });

class HomeAssistantApp extends HTMLElement {}

test('on a page where Home Assistant has not started yet, the cards wait until it has', async () => {
  const app = document.createElement('home-assistant');
  document.body.append(app);
  const waiting = started().then(() => 'started');
  assert.equal(await Promise.race([waiting, tick()]), 'pending');
  define('home-assistant', HomeAssistantApp);
  assert.equal(await waiting, 'started');
  app.remove();
});

test('on a page where Home Assistant runs already, or without it, the cards load at once', async () => {
  define('home-assistant', HomeAssistantApp);
  const app = document.createElement('home-assistant');
  document.body.append(app);
  assert.equal(await Promise.race([started().then(() => 'started'), tick()]), 'started');
  app.remove();
  assert.equal(await Promise.race([started().then(() => 'started'), tick()]), 'started');
});

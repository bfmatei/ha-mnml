import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { Template } from '../contract/templates.ts';
import { MnmlCardEditor } from '../editors/card-editor.ts';
import { MnmlRowMenu } from '../editors/row-menu.ts';
import { MnmlWords } from '../editors/words.ts';
import { fakeHass } from '../test/hass.ts';
import { define, everything, mounted } from '../test/render.ts';
import { EDITORS_EN } from '../words/panel/editors-en.ts';
import { EDITORS_RO } from '../words/panel/editors-ro.ts';
import { PANEL_EN } from '../words/panel/en.ts';
import { PANEL_RO } from '../words/panel/ro.ts';

import { MnmlBuilder } from './template-builder.ts';
import type { BuilderHost } from './template-builder.ts';

class FakeForm extends HTMLElement {
  hass: unknown;
  data: unknown;
  schema: unknown;
}

define('ha-form', FakeForm);
define('mnml-row-menu', MnmlRowMenu);
define('mnml-words', MnmlWords);
define('mnml-card-editor', MnmlCardEditor);
define('mnml-builder', MnmlBuilder);

const HOLE = '\u0000';

function said(word: unknown): string[] {
  try {
    const say = word as (...values: unknown[]) => unknown;
    return String(say(HOLE, HOLE, HOLE)).split(HOLE);
  } catch {
    return [];
  }
}

function english(en: unknown, ro: unknown): string[] {
  if (typeof en === 'string') {
    return en === ro || /^[a-z_]+$/.test(en) ? [] : [en];
  }
  if (typeof en === 'function') {
    const theirs = new Set(said(ro).map((piece) => piece.trim()));
    return said(en)
      .map((piece) => piece.trim())
      .filter((piece) => /[a-z]{3}/i.test(piece) && !/^[a-z_]+$/.test(piece) && !theirs.has(piece));
  }
  if (typeof en === 'object' && en !== null && typeof ro === 'object' && ro !== null) {
    return Object.entries(en).flatMap(([key, word]) => english(word, Reflect.get(ro, key)));
  }
  return [];
}

const ENGLISH = [...new Set([...english(PANEL_EN, PANEL_RO), ...english(EDITORS_EN, EDITORS_RO)])];

const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'label'];
const PROPERTIES = ['header', 'secondary', 'label', 'placeholder', 'helper', 'said'];

function textsOf(node: Node): string[] {
  const texts = [...node.childNodes]
    .filter((child) => child.nodeType === Node.TEXT_NODE)
    .map((child) => child.textContent ?? '');
  if (node instanceof Element) {
    texts.push(...ATTRIBUTES.map((name) => node.getAttribute(name) ?? ''));
  }
  texts.push(
    ...PROPERTIES.map((name): unknown => Reflect.get(node, name)).filter(
      (value): value is string => typeof value === 'string',
    ),
  );
  return texts;
}

function shown(root: ParentNode): string[] {
  return [root, ...everything(root)]
    .filter((node) => !(node instanceof Element) || node.localName !== 'style')
    .flatMap(textsOf)
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

const escaped = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

function leftInEnglish(root: ParentNode): string[] {
  const texts = shown(root);
  return ENGLISH.flatMap((word) => {
    const found = new RegExp(String.raw`(^|[^\p{L}])${escaped(word)}([^\p{L}]|$)`, 'u');
    return texts.filter((text) => found.test(text)).map((text) => `${word} in "${text}"`);
  });
}

const ROOM: Template = {
  description: 'A room.',
  slots: { owner: { kind: 'text' }, ajar: { kind: 'flag' } },
  card: {
    type: 'custom:mnml-tile-card',
    name: '[[owner]]',
    'chips?': [{ id: 'ajar', if: 'ajar', type: 'indicator', color: 'orange' }],
  },
};

const HOST: BuilderHost = {
  templates: () => ({ room: ROOM }),
  areas: () => [],
  save: () => Promise.resolve(),
  leave: () => undefined,
  history: () => Promise.resolve(undefined),
  duplicate: () => undefined,
  exportOne: () => undefined,
  open: () => undefined,
};

test('the English the tables say is found when the panel speaks English', () => {
  assert.ok(ENGLISH.length > 300, String(ENGLISH.length));
  assert.ok(ENGLISH.includes('Cancel'), ENGLISH.slice(0, 40).join(' | '));
  assert.ok(ENGLISH.includes('More for'), ENGLISH.filter((w) => w.startsWith('More')).join(' | '));
});

async function built(language: string): Promise<{ builder: MnmlBuilder; root: ShadowRoot }> {
  const builder = document.createElement('mnml-builder');
  assert.ok(builder instanceof MnmlBuilder);
  builder.host = HOST;
  builder.hass = fakeHass({ language });
  builder.draft = { name: 'room', template: structuredClone(ROOM), shipped: ROOM, conflicts: [] };
  const root = await mounted(builder);
  return { builder, root };
}

async function picked(builder: MnmlBuilder, root: ShadowRoot, key: string): Promise<void> {
  const stage = root.querySelector('mnml-preview');
  assert.ok(stage);
  const pick: unknown = Reflect.get(stage, 'pick');
  assert.equal(typeof pick, 'function');
  Reflect.apply(pick as (key: string) => void, undefined, [key]);
  await builder.updateComplete;
}

test('under English the same check finds the English, so it would see any left', async () => {
  const { builder, root } = await built('en');
  await picked(builder, root, 'card/chips?/#ajar');
  assert.ok(leftInEnglish(root).length > 10);
  builder.remove();
});

test('under Romanian the builder says nothing in English, on every tab', async () => {
  const { builder, root } = await built('ro');
  const tabs = (): HTMLButtonElement[] =>
    [...root.querySelectorAll('[role="tab"]')].filter(
      (tab): tab is HTMLButtonElement => tab instanceof HTMLButtonElement,
    );
  assert.deepEqual(leftInEnglish(root), [], PANEL_RO.builder.tabs.design);
  await picked(builder, root, 'card/chips?/#ajar');
  assert.deepEqual(leftInEnglish(root), [], 'a chip picked');
  await picked(builder, root, 'card');
  assert.deepEqual(leftInEnglish(root), [], 'the card picked');
  const more = root.querySelector('button.tab.more');
  assert.ok(more instanceof HTMLButtonElement);
  more.click();
  await builder.updateComplete;
  assert.deepEqual(
    tabs().map((tab) => tab.textContent?.trim()),
    Object.values(PANEL_RO.builder.tabs),
  );
  const opened = await tabs().reduce<Promise<string[]>>(async (earlier, tab) => {
    const left = await earlier;
    tab.click();
    await builder.updateComplete;
    return [...left, ...leftInEnglish(root).map((word) => `${tab.textContent?.trim()}: ${word}`)];
  }, Promise.resolve([]));
  assert.deepEqual(opened, []);
  builder.remove();
});

test('under Romanian a card editor says nothing in English', async () => {
  const editor = document.createElement('mnml-card-editor');
  assert.ok(editor instanceof MnmlCardEditor);
  editor.hass = fakeHass({ language: 'ro' });
  editor.setConfig({ type: 'custom:mnml-tile-card', entity: 'light.a' });
  const root = await mounted(editor);
  const texts = shown(root);
  assert.ok(texts.includes('Subiect'), texts.join(' | '));
  assert.deepEqual(leftInEnglish(root), []);
  editor.remove();
});

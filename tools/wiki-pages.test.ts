import assert from 'node:assert/strict';

import { test } from 'vitest';

import { pageName, sidebar, wikiPage } from './wiki-pages.ts';

const PAGES = new Map([
  ['README.md', 'Home'],
  ['docs/keys.md', 'Writing-the-cards'],
  ['docs/cards.md', 'How-the-cards-work'],
]);
const REPO = 'owner/repo';

test('a page is named after its title, and the README is the Home page', () => {
  assert.equal(pageName('README.md', '# MNML\n'), 'Home');
  assert.equal(pageName('docs/editors.md', '# Editing in the UI\n\nText'), 'Editing-in-the-UI');
  assert.equal(pageName('docs/x.md', 'no title'), 'x');
});

test('a link to another doc becomes a link to its page, keeping the anchor', () => {
  const page = wikiPage(
    'See [keys](keys.md#mnml-tile-card) and [cards](cards.md).',
    'docs/editors.md',
    PAGES,
    REPO,
  );
  assert.ok(page.includes('[keys](Writing-the-cards#mnml-tile-card)'));
  assert.ok(page.includes('[cards](How-the-cards-work)'));
});

test('links from the README into docs and to other files become pages and absolute links', () => {
  const page = wikiPage(
    '[keys](docs/keys.md) [agents](AGENTS.md) ![shot](docs/screenshots/a.png) [up](#install) [site](https://x.y)',
    'README.md',
    PAGES,
    REPO,
  );
  assert.ok(page.includes('[keys](Writing-the-cards)'));
  assert.ok(page.includes('[agents](https://github.com/owner/repo/blob/main/AGENTS.md)'));
  assert.ok(
    page.includes(
      '![shot](https://raw.githubusercontent.com/owner/repo/main/docs/screenshots/a.png)',
    ),
  );
  assert.ok(page.includes('[up](#install)'));
  assert.ok(page.includes('[site](https://x.y)'));
});

test('a link inside a code block is left as written', () => {
  const page = wikiPage('```md\n[keys](keys.md)\n```\n[keys](keys.md)', 'docs/x.md', PAGES, REPO);
  assert.ok(page.includes('```md\n[keys](keys.md)\n```'));
  assert.ok(page.includes('\n[keys](Writing-the-cards)'));
});

test('each page says where it is made from, and the sidebar lists the pages in order', () => {
  assert.ok(
    wikiPage('# T\n', 'docs/keys.md', PAGES, REPO).startsWith(
      '> This page is made from [docs/keys.md](https://github.com/owner/repo/blob/main/docs/keys.md)',
    ),
  );
  assert.equal(
    sidebar([
      { name: 'Home', title: 'Home' },
      { name: 'Writing-the-cards', title: 'Writing the cards' },
    ]),
    '- [Home](Home)\n- [Writing the cards](Writing-the-cards)\n',
  );
});

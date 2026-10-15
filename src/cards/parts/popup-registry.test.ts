import assert from 'node:assert/strict';

import { test } from 'vitest';

import { checkPopups, createPopupRegistry } from './popup-registry.ts';

test('announced pop-ups are listed by owner; a duplicate hash keeps its first owner until it withdraws', () => {
  const { announce, withdraw, announced, onAnnounce } = createPopupRegistry();
  const first = {};
  const second = {};
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    errors.push(args);
  };
  try {
    let calls = 0;
    const stop = onAnnounce(() => {
      calls += 1;
    });
    announce(first, [{ hash: '#a', cards: [{ type: 'x', name: 'first' }] }]);
    announce(second, [
      { hash: '#a', cards: [{ type: 'x', name: 'second' }] },
      { hash: '#b', cards: [] },
    ]);
    assert.deepEqual(
      announced().map((popup) => [popup.hash, popup.cards[0]?.['name']]),
      [
        ['#a', 'first'],
        ['#b', undefined],
      ],
    );
    assert.equal(errors.length, 1);
    withdraw(first);
    assert.deepEqual(
      announced().map((popup) => popup.cards[0]?.['name']),
      ['second', undefined],
    );
    assert.equal(calls, 3);
    stop();
    withdraw(second);
    assert.equal(calls, 3);
    assert.deepEqual(announced(), []);
  } finally {
    console.error = original;
  }
});

test('pop-ups are checked as the popups card checks its own: a hash, cards, and conditions that hold what Home Assistant requires of their kind', () => {
  const header = { type: 'custom:mnml-header-card', name: 'A' };
  assert.equal(checkPopups([{ hash: '#a', cards: [header] }]).length, 1);
  assert.throws(
    () => checkPopups([{ hash: 'a', cards: [] }]),
    /popups\[0\]: every popup needs a hash/,
  );
  assert.throws(() => checkPopups([{ hash: '#a' }]), /popups\[0\]: every popup needs cards/);
  const ruled = (visibility: unknown): unknown[] => [
    { hash: '#a', cards: [header, { type: 'map', visibility }] },
  ];
  assert.equal(
    checkPopups(ruled([{ condition: 'screen', media_query: '(min-width: 0px)' }])).length,
    1,
  );
  assert.equal(checkPopups(ruled([{ condition: 'sun', after: 'sunset' }])).length, 1);
  assert.throws(
    () => checkPopups(ruled([{ condition: 'screen' }])),
    /popups\[0\]\.cards\[1\]\.visibility\[0\]: a screen condition needs media_query/,
  );
});

function collectErrors(run: () => void): string[] {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    errors.push(args.map(String).join(' '));
  };
  try {
    run();
  } finally {
    console.error = original;
  }
  return errors;
}

test('a duplicate hash is reported once, and again only after the pop-ups change', () => {
  const { announce, announced } = createPopupRegistry();
  const first = {};
  const second = {};
  const errors = collectErrors(() => {
    announce(first, [{ hash: '#a', cards: [] }]);
    announce(second, [{ hash: '#a', cards: [] }]);
    announced();
    announced();
    announced();
    announce(second, [{ hash: '#a', cards: [{ type: 'x' }] }]);
    announced();
  });
  assert.equal(errors.length, 2);
});

test("the popups card's own pop-up keeps a hash a template also announces, and the clash is reported", () => {
  const { announce, announced } = createPopupRegistry();
  const owner = {};
  let found: string[] = [];
  const errors = collectErrors(() => {
    announce(owner, [
      { hash: '#a', cards: [{ type: 'x', name: 'announced' }] },
      { hash: '#b', cards: [{ type: 'x', name: 'b' }] },
    ]);
    found = announced([{ hash: '#a', cards: [{ type: 'x', name: 'own' }] }]).map((popup) =>
      String(popup.cards[0]?.['name']),
    );
  });
  assert.deepEqual(found, ['own', 'b']);
  assert.deepEqual(errors, [
    "mnml: #a is the popups card's own and is announced by a template too; the popups card's keeps it",
  ]);
});

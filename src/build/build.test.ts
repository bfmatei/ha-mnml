import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { test } from 'vitest';

import { COMMON_FAMILY } from '../templates/families.ts';
import { familyNames, readFamily } from '../templates/shipped.ts';

import { buildBundle, familiesModule } from './bundle.ts';
import { BUNDLE } from './names.ts';

function loaded(dir: string, entry: string, seen = new Set<string>()): string {
  if (seen.has(entry)) {
    return '';
  }
  seen.add(entry);
  const code = readFileSync(join(dir, entry), 'utf8');
  const imported = [...code.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)].map(
    (match) => match[1] ?? '',
  );
  return [code, ...imported.map((name) => loaded(dir, name, seen))].join('\n');
}

const editorsFile = (dir: string): string => {
  const found = readdirSync(dir).find((name) => /^cards-editors-[\w-]+\.js$/.test(name));
  assert.ok(found, 'the editors are a file of their own');
  return found;
};

test('the bundle is one ES module that registers every card', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    await buildBundle(file);
    const code = readFileSync(file, 'utf8');
    assert.ok(code.includes('customElements.define'));
    const loader = readFileSync(join(dir, 'cards-loader.js'), 'utf8');
    assert.ok(loader.includes('whenDefined'), 'the loader waits for Home Assistant');
    assert.ok(!loader.includes('customElements.define'), 'the loader defines no card itself');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the build reports the bundle in bytes, as written, not in characters', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    const bytes = await buildBundle(file);
    const code = readFileSync(file, 'utf8');
    assert.ok(code.includes('\u2014'), 'the bundle holds a multi-byte glyph');
    assert.equal(bytes, statSync(file).size);
    assert.notEqual(bytes, code.length);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the bundle is minified, and names its source map by the content of the map, so a cached map never meets a newer bundle', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    await buildBundle(file);
    const code = readFileSync(file, 'utf8');
    const map = readFileSync(`${file}.map`, 'utf8');
    const version = createHash('sha256').update(map).digest('hex').slice(0, 8);
    assert.ok(!/\n\s+(?:const|let|return|function|if|for) /.test(code), 'no formatted statements');
    assert.ok(code.endsWith(`\n//# sourceMappingURL=cards.js.map?v=${version}\n`));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the source map leads a place in the bundle back to its source, which it carries', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    await buildBundle(file);
    const code = readFileSync(file, 'utf8');
    const payload = JSON.parse(readFileSync(`${file}.map`, 'utf8'));
    assert.equal(payload.sourcesContent.length, payload.sources.length);
    const at = code.indexOf('customElements.define');
    const before = code.slice(0, at).split('\n');
    const entry = new SourceMap(payload).findEntry(before.length - 1, before.at(-1)?.length ?? 0);
    assert.ok('originalSource' in entry);
    assert.match(entry.originalSource, /^src\/.+\.ts$/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the bundle carries the common templates and an index, and no YAML parser', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    await buildBundle(file);
    const code = loaded(dir, 'cards.js');
    assert.ok(code.includes('"section-heading"'), 'a common template is in it');
    assert.ok(!code.includes("A room's tile"), 'a family template is not');
    assert.ok(!code.includes('node:fs'));
    assert.ok(!code.includes('readFileSync'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('every other family is a JSON file next to the bundle, which the index names by its content', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    await buildBundle(file);
    const code = loaded(dir, 'cards.js');
    const families = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .toSorted();
    assert.deepEqual(
      families,
      familyNames()
        .filter((family) => family !== COMMON_FAMILY)
        .map((family) => `cards-${family}.json`),
    );
    const room = readFileSync(join(dir, 'cards-room.json'), 'utf8');
    assert.deepEqual(JSON.parse(room), readFamily('room'));
    const version = createHash('sha256').update(room).digest('hex').slice(0, 8);
    assert.ok(code.includes(`cards-room.json?v=${version}`));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('HACS installs the zip the release attaches, and the integration serves the bundle the build writes', () => {
  assert.equal(BUNDLE, 'mnml-cards.js');
  assert.deepEqual(JSON.parse(readFileSync('hacs.json', 'utf8')), {
    name: 'MNML',
    homeassistant: '2026.10.0b0',
    render_readme: true,
    hide_default_branch: true,
    zip_release: true,
    filename: 'mnml.zip',
  });
  const release = readFileSync('.github/workflows/release.yml', 'utf8');
  assert.ok(
    release.includes('gh release create "$GITHUB_REF_NAME" mnml.zip'),
    'the release attaches mnml.zip',
  );
  const constants = readFileSync('custom_components/mnml/const.py', 'utf8');
  assert.ok(
    constants.includes(`BUNDLE: Final = "${BUNDLE}"`),
    'the integration serves the bundle by the name the build gives it',
  );
});

test('a family that cannot be fetched or read names its file, whatever went wrong', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  const original = globalThis.fetch;
  try {
    const file = join(dir, 'families.mjs');
    writeFileSync(
      file,
      familiesModule({ room: 'room' }, { room: 'cards-room.json?v=abcd1234' }, {}),
    );
    const { loadFamily } = (await import(pathToFileURL(file).href)) as {
      loadFamily: (family: string) => Promise<unknown>;
    };
    globalThis.fetch = (): Promise<Response> => Promise.reject(new TypeError('Failed to fetch'));
    await assert.rejects(loadFamily('room'), /^Error: cards-room\.json: Failed to fetch$/);
    globalThis.fetch = (): Promise<Response> =>
      Promise.resolve(new Response('<html>', { status: 200 }));
    await assert.rejects(loadFamily('room'), /^Error: cards-room\.json: /);
    globalThis.fetch = (): Promise<Response> =>
      Promise.resolve(new Response('', { status: 404, statusText: 'Not Found' }));
    await assert.rejects(
      loadFamily('room'),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'cards-room.json: 404 Not Found' &&
        Reflect.get(error, 'status') === 404,
    );
  } finally {
    globalThis.fetch = original;
    rmSync(dir, { recursive: true });
  }
});

test('the panel is a file of its own beside the bundle, with its map, not named by the bundle, and only it carries a YAML parser', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    await buildBundle(file);
    const code = loaded(dir, 'cards.js');
    const panel = loaded(dir, 'cards-panel.js');
    assert.ok(readFileSync(join(dir, 'cards-panel.js.map'), 'utf8').startsWith('{'));
    assert.ok(!code.includes('cards-panel.js'));
    assert.ok(panel.includes('mnml-panel'));
    assert.ok(panel.includes('YAMLParseError'));
    assert.ok(!code.includes('YAMLParseError'));
    assert.ok(!loaded(dir, editorsFile(dir)).includes('YAMLParseError'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the card editors are a file of their own beside the bundle, named by its content, without a YAML parser', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    await buildBundle(file);
    const code = loaded(dir, 'cards.js');
    const name = editorsFile(dir);
    const editors = loaded(dir, name);
    assert.ok(readFileSync(join(dir, `${name}.map`), 'utf8').startsWith('{'));
    assert.ok(code.includes(name), 'the cards know where the editors are');
    assert.ok(editors.includes('is not a key the editor knows'));
    assert.ok(!code.includes('is not a key the editor knows'));
    assert.ok(!editors.includes('YAMLParseError'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the css and html templates are minified', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    await buildBundle(file);
    const code = loaded(dir, 'cards.js');
    assert.ok(code.includes('--m-pill:'), 'the base style is in it');
    assert.ok(
      !/\n\s+(?:display|position|background):/.test(code),
      'no CSS laid out one rule a line',
    );
    assert.ok(!/>\n\s+</.test(code), 'no markup laid out over lines');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('a build empties the files it wrote before, so no old chunk stays beside the new ones', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    writeFileSync(join(dir, 'cards-old-1234abcd.js'), 'old');
    writeFileSync(join(dir, 'other.txt'), 'kept');
    await buildBundle(file);
    const names = readdirSync(dir);
    assert.ok(!names.includes('cards-old-1234abcd.js'));
    assert.ok(names.includes('other.txt'), 'a file the build does not own stays');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the markup minifier leaves a style binding as written, with nothing after it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'cards.js');
    await buildBundle(file);
    const code = loaded(dir, 'cards.js');
    assert.ok(code.includes('style=${'), 'the bundle binds styles');
    assert.ok(!/style=\$\{[^`;]*?\};/.test(code));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

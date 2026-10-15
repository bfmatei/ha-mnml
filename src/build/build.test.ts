import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

import { afterAll, beforeAll, test } from 'vitest';

import { COMMON_FAMILY } from '../templates/families.ts';
import { familyNames, readFamily, readShapes, readTemplates } from '../templates/shipped.ts';
import { TEMPLATE_INDEX } from '../templates/template-index.ts';

import { buildBundle, familiesModule, indexModule, sourceOf } from './bundle.ts';
import { BUNDLE } from './names.ts';

const STEM = BUNDLE.replace(/\.js$/, '');
const BUILT = mkdtempSync(join(tmpdir(), 'mnml-'));
const FILE = join(BUILT, BUNDLE);
let bytes = 0;

beforeAll(async () => {
  bytes = await buildBundle(FILE);
});

afterAll(() => {
  rmSync(BUILT, { recursive: true });
});

function loaded(entry: string, seen = new Set<string>()): string {
  if (seen.has(entry)) {
    return '';
  }
  seen.add(entry);
  const code = readFileSync(join(BUILT, entry), 'utf8');
  const imported = [...code.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)].map(
    (match) => match[1] ?? '',
  );
  return [code, ...imported.map((name) => loaded(name, seen))].join('\n');
}

const editorsFile = (): string => {
  const found = readdirSync(BUILT).find((name) =>
    new RegExp(`^${STEM}-editors-[\\w-]+\\.js$`).test(name),
  );
  assert.ok(found, 'the editors are a file of their own');
  return found;
};

test('the bundle is one ES module that registers every card', () => {
  const code = readFileSync(FILE, 'utf8');
  assert.ok(code.includes('customElements.define'));
  const loader = readFileSync(join(BUILT, `${STEM}-loader.js`), 'utf8');
  assert.ok(loader.includes('whenDefined'), 'the loader waits for Home Assistant');
  assert.ok(!loader.includes('customElements.define'), 'the loader defines no card itself');
});

test('the build reports the bundle in bytes, as written, not in characters', () => {
  const code = readFileSync(FILE, 'utf8');
  assert.ok(code.includes('\u2014'), 'the bundle holds a multi-byte glyph');
  assert.equal(bytes, statSync(FILE).size);
  assert.notEqual(bytes, code.length);
});

test('the bundle is minified, and names its source map by the content of the map, so a cached map never meets a newer bundle', () => {
  const code = readFileSync(FILE, 'utf8');
  const map = readFileSync(`${FILE}.map`, 'utf8');
  const version = createHash('sha256').update(map).digest('hex').slice(0, 8);
  assert.ok(!/\n\s+(?:const|let|return|function|if|for) /.test(code), 'no formatted statements');
  assert.ok(code.endsWith(`\n//# sourceMappingURL=${BUNDLE}.map?v=${version}\n`));
});

test('the source map leads a place in the bundle back to its source, which it carries', () => {
  const code = readFileSync(FILE, 'utf8');
  const payload = JSON.parse(readFileSync(`${FILE}.map`, 'utf8'));
  assert.equal(payload.sourcesContent.length, payload.sources.length);
  const at = code.indexOf('customElements.define');
  const before = code.slice(0, at).split('\n');
  const entry = new SourceMap(payload).findEntry(before.length - 1, before.at(-1)?.length ?? 0);
  assert.ok('originalSource' in entry);
  assert.match(entry.originalSource, /^src\/.+\.ts$/);
});

test('the source maps name a dependency from its package, never by where the checkout keeps it', () => {
  const sources = readdirSync(BUILT)
    .filter((name) => name.endsWith('.map'))
    .flatMap((name) => {
      const map: { sources: string[] } = JSON.parse(readFileSync(join(BUILT, name), 'utf8'));
      return map.sources;
    });
  assert.ok(sources.some((source) => source.startsWith('node_modules/lit-html/')));
  assert.deepEqual(
    sources.filter(
      (source) => !/^(?:src|node_modules)\//.test(source) || /\.\.|\.pnpm/.test(source),
    ),
    [],
  );
});

test('a build inside a parent workspace names its sources as a checkout of its own does', () => {
  const file = 'node_modules/.pnpm/lit-html@3.3.3/node_modules/lit-html/directives/keyed.js';
  assert.equal(sourceOf(resolve(file)), 'node_modules/lit-html/directives/keyed.js');
  assert.equal(sourceOf(resolve('../..', file)), 'node_modules/lit-html/directives/keyed.js');
  assert.equal(sourceOf(resolve('src/cards/register.ts')), 'src/cards/register.ts');
});

test('the bundle carries the common templates and an index, and no YAML parser', () => {
  const code = loaded(BUNDLE);
  assert.ok(code.includes('"section-heading"'), 'a common template is in it');
  assert.ok(!code.includes("A room's tile"), 'a family template is not');
  assert.ok(!code.includes('node:fs'));
  assert.ok(!code.includes('readFileSync'));
});

test('every other family is a JSON file next to the bundle, which the index names by its content', () => {
  const code = loaded(BUNDLE);
  const families = readdirSync(BUILT)
    .filter((name) => name.endsWith('.json'))
    .toSorted();
  assert.deepEqual(
    families,
    familyNames()
      .filter((family) => family !== COMMON_FAMILY)
      .map((family) => `${STEM}-${family}.json`)
      .toSorted(),
  );
  const room = readFileSync(join(BUILT, `${STEM}-room.json`), 'utf8');
  assert.deepEqual(JSON.parse(room), readFamily('room'));
  const version = createHash('sha256').update(room).digest('hex').slice(0, 8);
  assert.ok(code.includes(`${STEM}-room.json?v=${version}`));
});

test('every script and family the pages load has a brotli and a gzip sibling of the same content, and a map has none', () => {
  const names = readdirSync(BUILT);
  const loadable = names.filter((name) => /\.(?:js|json)$/.test(name));
  assert.ok(loadable.includes(BUNDLE) && loadable.includes(`${STEM}-room.json`));
  for (const name of loadable) {
    const plain = readFileSync(join(BUILT, name));
    assert.deepEqual(brotliDecompressSync(readFileSync(join(BUILT, `${name}.br`))), plain, name);
    assert.deepEqual(gunzipSync(readFileSync(join(BUILT, `${name}.gz`))), plain, name);
  }
  assert.deepEqual(
    names.filter((name) => /\.map\.(?:br|gz)$/.test(name)),
    [],
  );
  assert.ok(
    statSync(`${FILE}.br`).size < statSync(`${FILE}.gz`).size &&
      statSync(`${FILE}.gz`).size < statSync(FILE).size / 2,
  );
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

test('the integration serves the bundle, the loader and the panel by the names the build gives them', () => {
  const constants = readFileSync('custom_components/mnml/const.py', 'utf8');
  const written = readdirSync(BUILT);
  for (const key of ['BUNDLE', 'LOADER', 'PANEL']) {
    const name = new RegExp(`^${key}: Final = "([^"]+)"$`, 'm').exec(constants)?.[1];
    assert.ok(name !== undefined && written.includes(name), `${key} names a file the build writes`);
  }
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

test('the bundle carries the template index the card picker suggests from, so a suggestion loads no family', async () => {
  const code = readFileSync(FILE, 'utf8');
  assert.ok(code.includes('getEntitySuggestion'));
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'index.mjs');
    writeFileSync(file, indexModule(readTemplates()));
    const built = (await import(pathToFileURL(file).href)) as { TEMPLATE_INDEX: unknown };
    assert.deepEqual(built.TEMPLATE_INDEX, TEMPLATE_INDEX);
    assert.ok('room' in TEMPLATE_INDEX);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("the index carries the shipped shapes, for the home's own templates that name one", async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    const file = join(dir, 'families.mjs');
    writeFileSync(file, familiesModule({}, {}, {}));
    const { SLOT_SHAPES } = (await import(pathToFileURL(file).href)) as { SLOT_SHAPES: unknown };
    assert.deepEqual(SLOT_SHAPES, readShapes());
    assert.ok(Object.keys(readShapes()).length > 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the panel is a file of its own beside the bundle, with its map, not named by the bundle, and only it carries a YAML parser', () => {
  const code = loaded(BUNDLE);
  const panel = loaded(`${STEM}-panel.js`);
  assert.ok(readFileSync(join(BUILT, `${STEM}-panel.js.map`), 'utf8').startsWith('{'));
  assert.ok(!code.includes(`${STEM}-panel.js`));
  assert.ok(panel.includes('mnml-panel'));
  assert.ok(panel.includes('YAMLParseError'));
  assert.ok(!code.includes('YAMLParseError'));
  assert.ok(!loaded(editorsFile()).includes('YAMLParseError'));
});

test('the card editors are a file of their own beside the bundle, named by its content, without a YAML parser', () => {
  const code = loaded(BUNDLE);
  const name = editorsFile();
  const editors = loaded(name);
  assert.ok(readFileSync(join(BUILT, `${name}.map`), 'utf8').startsWith('{'));
  assert.ok(code.includes(name), 'the cards know where the editors are');
  assert.ok(editors.includes('is not a key the editor knows'));
  assert.ok(!code.includes('is not a key the editor knows'));
  assert.ok(!editors.includes('YAMLParseError'));
});

test('the css and html templates are minified', () => {
  const code = loaded(BUNDLE);
  assert.ok(code.includes('--m-pill:'), 'the base style is in it');
  assert.ok(!/\n\s+(?:display|position|background):/.test(code), 'no CSS laid out one rule a line');
  assert.ok(!/>\n\s+</.test(code), 'no markup laid out over lines');
});

test('a build empties the files it wrote before, so no old chunk stays beside the new ones', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mnml-'));
  try {
    writeFileSync(join(dir, 'cards-old-1234abcd.js'), 'old');
    writeFileSync(join(dir, 'cards-old-1234abcd.js.br'), 'old');
    writeFileSync(join(dir, 'other.txt'), 'kept');
    await buildBundle(join(dir, 'cards.js'));
    const names = readdirSync(dir);
    assert.ok(!names.includes('cards-old-1234abcd.js'));
    assert.ok(!names.includes('cards-old-1234abcd.js.br'));
    assert.ok(names.includes('other.txt'), 'a file the build does not own stays');
    assert.ok(names.includes('cards.js.br'), 'under any name the bundle is given');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('the markup minifier leaves a style binding as written, with nothing after it', () => {
  const code = loaded(BUNDLE);
  assert.ok(code.includes('style=${'), 'the bundle binds styles');
  assert.ok(!/style=\$\{[^`;]*?\};/.test(code));
});

test('every step of pnpm check runs in a job of the check workflow, so splitting it into jobs drops none', () => {
  const scripts: Record<string, string> = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  const steps = (name: string): string[] => {
    const chained = [...(scripts[name] ?? '').matchAll(/pnpm run ([\w:-]+)/g)].map(
      (match) => match[1] ?? '',
    );
    return chained.length === 0 ? [name] : chained.flatMap(steps);
  };
  const workflow = readFileSync('.github/workflows/check.yml', 'utf8');
  const missing = steps('check').filter(
    (step) => !new RegExp(`pnpm run ${step}(?: --[\\w-]+)*\\n`).test(workflow),
  );
  assert.deepEqual(missing, []);
  assert.ok(workflow.includes('pnpm run test:python-floor\n'), 'and the oldest Home Assistant too');
  assert.ok(
    readFileSync('.github/workflows/release.yml', 'utf8').includes(
      'uses: ./.github/workflows/check.yml',
    ),
    'a release runs the same checks',
  );
});

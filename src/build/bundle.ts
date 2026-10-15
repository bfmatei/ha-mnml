import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

import { minifyHTMLLiterals } from 'minify-literals';
import { build } from 'rolldown';
import type { Plugin } from 'rolldown';

import type { Templates, Value } from '../contract/templates.ts';
import { COMMON_FAMILY } from '../templates/families.ts';
import {
  familyNames,
  readFamily,
  readShapes,
  readTemplates,
  sizeOf,
} from '../templates/shipped.ts';
import { templateIndex } from '../templates/stands.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const SOURCES = resolve(ROOT, 'src');
const ENTRY = resolve(ROOT, 'src/cards/register.ts');
const FAMILIES_MODULE = resolve(ROOT, 'src/templates/families.ts');
const INDEX_MODULE = resolve(ROOT, 'src/templates/template-index.ts');
const EDITORS_ENTRY = resolve(ROOT, 'src/editors/main.ts');
const EDITORS_MODULE = resolve(ROOT, 'src/editors/where.ts');
const LOADER_ENTRY = resolve(ROOT, 'src/cards/loader.ts');
const PANEL_ENTRY = resolve(ROOT, 'src/panel/main.ts');

const hash = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 8);

const brotli = promisify(brotliCompress);
const gzipped = promisify(gzip);

export function sourceOf(path: string): string {
  const parts = relative(ROOT, path).split(sep);
  const at = parts.lastIndexOf('node_modules');
  return (at === -1 ? parts : parts.slice(at)).join('/');
}

async function compressed(dir: string, name: string, content: string): Promise<void> {
  const size = Buffer.byteLength(content);
  const [br, gz] = await Promise.all([
    brotli(content, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: size,
      },
    }),
    gzipped(content, { level: constants.Z_BEST_COMPRESSION }),
  ]);
  await Promise.all([
    writeFile(join(dir, `${name}.br`), br),
    writeFile(join(dir, `${name}.gz`), gz),
  ]);
}

function writeFamilies(
  dir: string,
  stem: string,
): {
  owner: Record<string, string>;
  files: Record<string, string>;
  sizes: Record<string, Value>;
  texts: Record<string, string>;
} {
  const owner: Record<string, string> = {};
  const files: Record<string, string> = {};
  const sizes: Record<string, Value> = {};
  const texts: Record<string, string> = {};
  for (const family of familyNames().filter((each) => each !== COMMON_FAMILY)) {
    const templates = readFamily(family);
    const text = JSON.stringify(templates);
    const file = `${stem}-${family}.json`;
    writeFileSync(join(dir, file), text);
    texts[file] = text;
    files[family] = `${file}?v=${hash(text)}`;
    for (const [name, template] of Object.entries(templates)) {
      owner[name] = family;
      const size = sizeOf(template);
      if (size !== undefined) {
        sizes[name] = size;
      }
    }
  }
  return { owner, files, sizes, texts };
}

export function familiesModule(
  owner: Record<string, string>,
  files: Record<string, string>,
  sizes: Record<string, Value>,
): string {
  return [
    `export const COMMON = ${JSON.stringify(readFamily(COMMON_FAMILY))};`,
    `export const OWNER = ${JSON.stringify(owner)};`,
    `export const SIZES = ${JSON.stringify(sizes)};`,
    `export const SLOT_SHAPES = ${JSON.stringify(readShapes())};`,
    `const FILES = ${JSON.stringify(files)};`,
    'export function loadFamily(family) {',
    '  const file = FILES[family];',
    "  const name = file.split('?')[0];",
    '  return fetch(new URL(file, import.meta.url))',
    '    .then((response) => {',
    '      if (!response.ok) {',
    '        throw Object.assign(new Error([response.status, response.statusText].join(" ").trim()), { status: response.status });',
    '      }',
    '      return response.json();',
    '    })',
    '    .catch((error) => {',
    '      throw Object.assign(new Error(name + ": " + (error instanceof Error ? error.message : String(error))), { status: error && error.status });',
    '    });',
    '}',
  ].join('\n');
}

export function indexModule(templates: Templates): string {
  return `export const TEMPLATE_INDEX = ${JSON.stringify(templateIndex(templates))};`;
}

function generated(modules: ReadonlyMap<string, string>): Plugin {
  return {
    name: 'mnml-generated-modules',
    load(id) {
      if (id === EDITORS_MODULE) {
        const editors = this.emitFile({ type: 'chunk', id: EDITORS_ENTRY, name: 'editors' });
        return `export const EDITORS = import.meta.ROLLUP_FILE_URL_${editors};`;
      }
      return modules.get(id) ?? null;
    },
  };
}

const minified: Plugin = {
  name: 'mnml-minify-literals',
  async transform(code, id) {
    if (!id.startsWith(SOURCES) || !/\b(?:css|html|svg)`/.test(code)) {
      return null;
    }
    const result = await minifyHTMLLiterals(code, { fileName: id, html: { minifyCSS: false } });
    return result === null ? null : { code: result.code, map: result.map };
  },
};

export async function buildBundle(file: string): Promise<number> {
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true });
  const stem = basename(file, '.js');
  for (const name of readdirSync(dir).filter((each) => each.startsWith(stem))) {
    rmSync(join(dir, name));
  }
  const { owner, files, sizes, texts } = writeFamilies(dir, stem);
  const entries = {
    [stem]: ENTRY,
    [`${stem}-loader`]: LOADER_ENTRY,
    [`${stem}-panel`]: PANEL_ENTRY,
  };
  const fixed = new Set(Object.keys(entries));
  const result = await build({
    input: entries,
    platform: 'browser',
    plugins: [
      generated(
        new Map([
          [FAMILIES_MODULE, familiesModule(owner, files, sizes)],
          [INDEX_MODULE, indexModule(readTemplates())],
        ]),
      ),
      minified,
    ],
    output: {
      dir,
      format: 'esm',
      minify: true,
      sourcemap: 'hidden',
      entryFileNames: (chunk) => (fixed.has(chunk.name) ? '[name].js' : `${stem}-[name]-[hash].js`),
      chunkFileNames: `${stem}-[name]-[hash].js`,
      sourcemapPathTransform: (source, map) => sourceOf(resolve(dirname(map), source)),
    },
    write: false,
    logLevel: 'warn',
  });
  let bytes = 0;
  const loaded: Record<string, string> = { ...texts };
  for (const output of result.output) {
    if (output.type !== 'chunk') {
      writeFileSync(join(dir, output.fileName), output.source);
      continue;
    }
    if (output.map === null) {
      throw new Error(`rolldown wrote no source map for ${output.fileName}`);
    }
    const map = output.map.toString();
    const code = `${output.code.trimEnd()}\n//# sourceMappingURL=${output.fileName}.map?v=${hash(map)}\n`;
    writeFileSync(join(dir, `${output.fileName}.map`), map);
    writeFileSync(join(dir, output.fileName), code);
    loaded[output.fileName] = code;
    if (output.fileName === `${stem}.js`) {
      bytes = Buffer.byteLength(code);
    }
  }
  await Promise.all(
    Object.entries(loaded).map(([name, content]) => compressed(dir, name, content)),
  );
  return bytes;
}

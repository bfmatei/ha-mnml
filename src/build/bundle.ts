import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { minifyHTMLLiterals } from 'minify-literals';
import { build } from 'rolldown';
import type { Plugin } from 'rolldown';

import type { Value } from '../contract/templates.ts';
import { COMMON_FAMILY } from '../templates/families.ts';
import { familyNames, readFamily, shapeOf } from '../templates/shipped.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const SOURCES = resolve(ROOT, 'src');
const ENTRY = resolve(ROOT, 'src/cards/register.ts');
const FAMILIES_MODULE = resolve(ROOT, 'src/templates/families.ts');
const EDITORS_ENTRY = resolve(ROOT, 'src/editors/main.ts');
const EDITORS_MODULE = resolve(ROOT, 'src/editors/where.ts');
const LOADER_ENTRY = resolve(ROOT, 'src/cards/loader.ts');
const PANEL_ENTRY = resolve(ROOT, 'src/panel/main.ts');

const hash = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 8);

function writeFamilies(
  dir: string,
  stem: string,
): {
  owner: Record<string, string>;
  files: Record<string, string>;
  shapes: Record<string, Value>;
} {
  const owner: Record<string, string> = {};
  const files: Record<string, string> = {};
  const shapes: Record<string, Value> = {};
  for (const family of familyNames().filter((each) => each !== COMMON_FAMILY)) {
    const templates = readFamily(family);
    const text = JSON.stringify(templates);
    const file = `${stem}-${family}.json`;
    writeFileSync(join(dir, file), text);
    files[family] = `${file}?v=${hash(text)}`;
    for (const [name, template] of Object.entries(templates)) {
      owner[name] = family;
      const shape = shapeOf(template);
      if (shape !== undefined) {
        shapes[name] = shape;
      }
    }
  }
  return { owner, files, shapes };
}

export function familiesModule(
  owner: Record<string, string>,
  files: Record<string, string>,
  shapes: Record<string, Value>,
): string {
  return [
    `export const COMMON = ${JSON.stringify(readFamily(COMMON_FAMILY))};`,
    `export const OWNER = ${JSON.stringify(owner)};`,
    `export const SHAPES = ${JSON.stringify(shapes)};`,
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
  const { owner, files, shapes } = writeFamilies(dir, stem);
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
      generated(new Map([[FAMILIES_MODULE, familiesModule(owner, files, shapes)]])),
      minified,
    ],
    output: {
      dir,
      format: 'esm',
      minify: true,
      sourcemap: 'hidden',
      entryFileNames: (chunk) => (fixed.has(chunk.name) ? '[name].js' : `${stem}-[name]-[hash].js`),
      chunkFileNames: `${stem}-[name]-[hash].js`,
      sourcemapPathTransform: (source, map) => relative(ROOT, resolve(dirname(map), source)),
    },
    write: false,
    logLevel: 'warn',
  });
  let bytes = 0;
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
    if (output.fileName === `${stem}.js`) {
      bytes = Buffer.byteLength(code);
    }
  }
  return bytes;
}

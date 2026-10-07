import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ORDER, pageName, sidebar, titleOf, wikiPage } from './wiki-pages.ts';

const [repo, out] = process.argv.slice(2);
if (repo === undefined || out === undefined) {
  throw new Error('usage: node tools/wiki.ts <owner/repo> <wiki folder>');
}
const docs = readdirSync('docs')
  .filter((name) => name.endsWith('.md'))
  .map((name) => `docs/${name}`);
const sources = [
  ...ORDER.filter((source) => source === 'README.md' || docs.includes(source)),
  ...docs.filter((source) => !ORDER.includes(source)).toSorted(),
];
const texts = new Map(sources.map((source) => [source, readFileSync(source, 'utf8')]));
const pages = new Map(sources.map((source) => [source, pageName(source, texts.get(source) ?? '')]));
for (const name of readdirSync(out).filter((name) => name.endsWith('.md'))) {
  rmSync(join(out, name));
}
for (const source of sources) {
  writeFileSync(
    join(out, `${pages.get(source) ?? source}.md`),
    wikiPage(texts.get(source) ?? '', source, pages, repo),
  );
}
writeFileSync(
  join(out, '_Sidebar.md'),
  sidebar(
    sources.map((source) => ({
      name: pages.get(source) ?? source,
      title: source === 'README.md' ? 'Home' : titleOf(texts.get(source) ?? '', source),
    })),
  ),
);
console.log(`wrote ${sources.length} pages and the sidebar to ${out}`);

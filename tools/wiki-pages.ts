import { posix } from 'node:path';

const LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g;
const FENCE = /^```/;

export const ORDER: readonly string[] = [
  'README.md',
  'docs/keys.md',
  'docs/templates.md',
  'docs/editors.md',
  'docs/home.md',
  'docs/design.md',
  'docs/theme.md',
  'docs/data.md',
  'docs/cards.md',
  'docs/architecture.md',
];

export function titleOf(markdown: string, source: string): string {
  return /^# (.+)$/m.exec(markdown)?.[1]?.trim() ?? posix.basename(source, '.md');
}

export function pageName(source: string, markdown: string): string {
  return source === 'README.md'
    ? 'Home'
    : titleOf(markdown, source)
        .replaceAll(/[^\p{L}\p{N}]+/gu, '-')
        .replaceAll(/^-+|-+$/g, '');
}

function rewriteLine(
  line: string,
  source: string,
  pages: ReadonlyMap<string, string>,
  repo: string,
): string {
  const base = posix.dirname(source);
  return line.replaceAll(LINK, (whole, bang: string, text: string, target: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) {
      return whole;
    }
    const [path = '', anchor] = target.split('#');
    const resolved = posix.normalize(posix.join(base, path));
    const hash = anchor === undefined ? '' : `#${anchor}`;
    const page = pages.get(resolved);
    if (page !== undefined && bang === '') {
      return `[${text}](${page}${hash})`;
    }
    const url =
      bang === ''
        ? `https://github.com/${repo}/blob/main/${resolved}`
        : `https://raw.githubusercontent.com/${repo}/main/${resolved}`;
    return `${bang}[${text}](${url}${hash})`;
  });
}

export function wikiPage(
  markdown: string,
  source: string,
  pages: ReadonlyMap<string, string>,
  repo: string,
): string {
  let fenced = false;
  const lines = markdown.split('\n').map((line) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      return line;
    }
    return fenced ? line : rewriteLine(line, source, pages, repo);
  });
  const origin = `https://github.com/${repo}/blob/main/${source}`;
  return `> This page is made from [${source}](${origin}) on every change to \`main\`; edit it there.\n\n${lines.join('\n')}`;
}

export function sidebar(entries: readonly { name: string; title: string }[]): string {
  return `${entries.map(({ name, title }) => `- [${title}](${name})`).join('\n')}\n`;
}

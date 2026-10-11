import { EDITORS } from '../editors/where.ts';

let attempt = 0;

export function editorOf(tag: string): () => Promise<HTMLElement> {
  return async () => {
    const url = new URL(EDITORS);
    if (attempt > 0) {
      url.searchParams.set('attempt', String(attempt));
    }
    try {
      await import(url.href);
    } catch (error) {
      attempt += 1;
      throw new Error(
        'The editor of MNML could not be loaded. If MNML was updated since this page was opened, reload the page.',
        { cause: error },
      );
    }
    return document.createElement(tag);
  };
}

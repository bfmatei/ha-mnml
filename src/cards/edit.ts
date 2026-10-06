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
      throw error;
    }
    return document.createElement(tag);
  };
}

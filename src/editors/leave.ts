import { field } from '../ha/field.ts';

const DIALOG = 'hui-dialog-edit-card';

function dialogOf(from: unknown): unknown {
  let node = from;
  while (node !== null && node !== undefined) {
    if (field(node, 'localName') === DIALOG) {
      return node;
    }
    node = field(node, 'parentNode') ?? field(node, 'host');
  }
  return undefined;
}

export async function openPanel(from: unknown, path: string): Promise<void> {
  const dialog = dialogOf(from);
  const close = field(dialog, 'closeDialog');
  if (typeof close === 'function') {
    const closed: unknown = await Reflect.apply(close, dialog, []);
    if (closed === false) {
      return;
    }
  }
  history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}

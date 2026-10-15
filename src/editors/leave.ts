import { field } from '../ha/field.ts';

const DIALOG = 'hui-dialog-edit-card';
const USED = ['pointerdown', 'keydown'];

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

function go(path: string): void {
  history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}

function afterClosing(dialog: EventTarget, path: string): void {
  const stop = (): void => {
    dialog.removeEventListener('dialog-closed', closed);
    for (const kind of USED) {
      dialog.removeEventListener(kind, stop, true);
    }
  };
  const closed = (event: Event): void => {
    if (field(field(event, 'detail'), 'dialog') === DIALOG) {
      stop();
      go(path);
    }
  };
  dialog.addEventListener('dialog-closed', closed);
  for (const kind of USED) {
    dialog.addEventListener(kind, stop, true);
  }
}

export async function openPanel(from: unknown, path: string): Promise<void> {
  const dialog = dialogOf(from);
  if (dialog === undefined) {
    go(path);
    return;
  }
  const close = field(dialog, 'closeDialog');
  if (typeof close !== 'function') {
    window.open(path, '_blank', 'noopener');
    return;
  }
  const closed: unknown = await Reflect.apply(close, dialog, []);
  if (closed !== false) {
    go(path);
  } else if (dialog instanceof EventTarget) {
    afterClosing(dialog, path);
  }
}

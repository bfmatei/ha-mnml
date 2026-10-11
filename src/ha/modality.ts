let keyboard = false;
let listening = false;

function typed(): void {
  keyboard = true;
}

function touched(): void {
  keyboard = false;
}

function listen(): void {
  if (listening) {
    return;
  }
  listening = true;
  window.addEventListener('keydown', typed, true);
  window.addEventListener('pointerdown', touched, true);
  window.addEventListener('touchstart', touched, true);
}

function focused(): Element | null {
  let found = document.activeElement;
  while (found?.shadowRoot?.activeElement) {
    found = found.shadowRoot.activeElement;
  }
  return found;
}

export function trackInput(): void {
  listen();
}

export function letGoOfFocus(): void {
  if (keyboard) {
    return;
  }
  const found = focused();
  if (found instanceof HTMLElement && found !== document.body) {
    found.blur();
  }
}

export function started(): Promise<unknown> {
  const waiting =
    document.querySelector('home-assistant') !== null &&
    customElements.get('home-assistant') === undefined;
  return waiting ? customElements.whenDefined('home-assistant') : Promise.resolve();
}

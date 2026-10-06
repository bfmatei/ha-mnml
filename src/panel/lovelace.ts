import { field } from '../ha/field.ts';

const WAIT = 10_000;
const ROUTE = 'mnml-lovelace';

export async function loadLovelace(): Promise<void> {
  if (window.loadCardHelpers !== undefined) {
    return;
  }
  try {
    await customElements.whenDefined('partial-panel-resolver');
    const resolver = document.createElement('partial-panel-resolver');
    const routes = field(resolver, '_getRoutes');
    const options: unknown =
      typeof routes === 'function'
        ? Reflect.apply(routes, resolver, [
            { [ROUTE]: { url_path: ROUTE, component_name: 'lovelace' } },
          ])
        : undefined;
    const load = field(field(field(options, 'routes'), ROUTE), 'load');
    if (typeof load === 'function') {
      await Reflect.apply(load, undefined, []);
    }
    await Promise.race([
      customElements.whenDefined('ha-panel-lovelace'),
      new Promise((resolve) => {
        setTimeout(resolve, WAIT);
      }),
    ]);
  } catch {}
}

import { isMapping } from '../contract/templates.ts';
import type { HomeAssistant } from '../ha/hass.ts';
import { nameOf } from '../ha/names.ts';

export interface PopupChoice<Hash extends string = string> {
  readonly value: Hash;
  readonly label: string;
}

interface Listed<Hash extends string> {
  readonly hash: Hash;
  readonly cards?: unknown;
}

const HEADER = 'custom:mnml-header-card';

function headerName(cards: unknown, hass: HomeAssistant | undefined): string | undefined {
  const list: readonly unknown[] = Array.isArray(cards) ? cards : [];
  const header = list.find((card) => isMapping(card) && card['type'] === HEADER);
  if (!isMapping(header)) {
    return undefined;
  }
  const name = header['name'];
  if (typeof name === 'string' && name.trim() !== '') {
    return name.trim();
  }
  const entity = header['entity'];
  if (typeof entity !== 'string' || hass?.states[entity] === undefined) {
    return undefined;
  }
  return nameOf(hass, entity, header['label'] === 'device' ? { label: 'device' } : {});
}

function spoken(code: string): string {
  return code.replaceAll(/[-_.]+/g, ' ').trim();
}

function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export function popupChoices<Hash extends string>(
  popups: readonly Listed<Hash>[],
  hass: HomeAssistant | undefined,
): PopupChoice<Hash>[] {
  const own = new Map(popups.map((popup) => [popup.hash, headerName(popup.cards, hass)]));
  const alone = (hash: Hash): string =>
    own.get(hash) ?? capitalised(spoken(hash.replace(/^#/, '')));
  return popups.map(({ hash }) => {
    const parent = popups
      .map((popup) => popup.hash)
      .filter((other) => other !== hash && hash.startsWith(`${other}-`))
      .toSorted((a, b) => b.length - a.length)[0];
    if (parent === undefined) {
      return { value: hash, label: alone(hash) };
    }
    const above = alone(parent);
    const named = own.get(hash);
    const rest =
      named !== undefined && named.toLowerCase().startsWith(`${above.toLowerCase()} `)
        ? named.slice(above.length + 1)
        : (named ?? spoken(hash.slice(parent.length + 1)));
    return { value: hash, label: `${above}: ${rest}` };
  });
}

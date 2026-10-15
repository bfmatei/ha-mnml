import type { LovelaceCardConfig, Popup } from '../../contract/cards.ts';
import type { PopupHash } from '../../contract/entities.ts';
import { conditionProblem } from '../../ha/conditions.ts';

interface PopupRegistry {
  announce: (owner: object, popups: readonly Popup[]) => void;
  withdraw: (owner: object) => void;
  announced: (own?: readonly Popup[]) => Popup[];
  onAnnounce: (listener: () => void) => () => void;
}

export function createPopupRegistry(): PopupRegistry {
  const owners = new Map<object, readonly Popup[]>();
  const listeners = new Set<() => void>();
  const reported = new Set<string>();
  const changed = (): void => {
    reported.clear();
    for (const listener of listeners) {
      listener();
    }
  };
  const report = (message: string): void => {
    if (!reported.has(message)) {
      reported.add(message);
      console.error(message);
    }
  };
  return {
    announce: (owner, popups) => {
      owners.set(owner, popups);
      changed();
    },
    withdraw: (owner) => {
      if (owners.delete(owner)) {
        changed();
      }
    },
    announced: (own = []) => {
      const mine = new Set(own.map((popup) => popup.hash));
      const seen = new Set<string>();
      const found: Popup[] = [...own];
      for (const popups of owners.values()) {
        for (const popup of popups) {
          if (mine.has(popup.hash)) {
            report(
              `mnml: ${popup.hash} is the popups card's own and is announced by a template too; the popups card's keeps it`,
            );
            continue;
          }
          if (seen.has(popup.hash)) {
            report(`mnml: ${popup.hash} is announced twice; the first keeps it`);
            continue;
          }
          seen.add(popup.hash);
          found.push(popup);
        }
      }
      return found;
    },
    onAnnounce: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const { announce, withdraw, announced, onAnnounce } = createPopupRegistry();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHash(value: unknown): value is PopupHash {
  return typeof value === 'string' && value.startsWith('#');
}

function checkCard(card: unknown, where: string): LovelaceCardConfig {
  if (!isRecord(card) || typeof card['type'] !== 'string') {
    throw new Error(`${where}: a card needs a type`);
  }
  const visibility = card['visibility'];
  if (visibility === undefined) {
    return { ...card, type: card['type'] };
  }
  if (!Array.isArray(visibility)) {
    throw new Error(`${where}.visibility: must be a list`);
  }
  const problem = visibility
    .map((condition, place) => conditionProblem(condition, `${where}.visibility[${place}]`))
    .find((found) => found !== undefined);
  if (problem !== undefined) {
    throw new Error(problem);
  }
  return { ...card, type: card['type'] };
}

export function checkPopups(popups: readonly unknown[]): Popup[] {
  return popups.map((popup, index) => {
    const where = `popups[${index}]`;
    if (!isRecord(popup) || !isHash(popup['hash'])) {
      throw new Error(`${where}: every popup needs a hash`);
    }
    const cards = popup['cards'];
    if (!Array.isArray(cards)) {
      throw new Error(`${where}: every popup needs cards`);
    }
    return {
      hash: popup['hash'],
      cards: cards.map((card, at) => checkCard(card, `${where}.cards[${at}]`)),
    };
  });
}

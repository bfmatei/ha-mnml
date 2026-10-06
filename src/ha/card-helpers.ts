import type { HomeAssistant } from './hass.ts';

export interface ChildCard extends HTMLElement {
  hass?: HomeAssistant;
  preview?: boolean;
  getCardSize?: () => number | Promise<number>;
  getGridOptions?: () => unknown;
}

interface CardHelpers {
  createCardElement(config: object): ChildCard;
}

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<CardHelpers>;
  }
}

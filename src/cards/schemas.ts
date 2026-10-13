import type { CustomCard } from '../contract/cards.ts';
import { CARD_STRUCTURES, CONTROL, LIST_ROW as ROW, STATE_ITEM } from '../contract/structure.ts';

import { cardKeysOf, keysOf } from './keys.ts';
import type { KeySchema } from './keys.ts';

const cardKeys = (type: CustomCard['type']): KeySchema => cardKeysOf(CARD_STRUCTURES[type]);

export const STATE_ITEMS = keysOf(STATE_ITEM);
export const CONTROLS = keysOf(CONTROL);
export const LIST_ROW = keysOf(ROW);

export const HEADING_CARD = cardKeys('custom:mnml-heading-card');
export const LIST_CARD = cardKeys('custom:mnml-list-card');
export const AGENDA_CARD = cardKeys('custom:mnml-agenda-card');
export const MESSAGES_CARD = cardKeys('custom:mnml-messages-card');
export const CLIENTS_CARD = cardKeys('custom:mnml-clients-card');
export const REPORT_CARD = cardKeys('custom:mnml-report-card');
export const WEATHER_CARD = cardKeys('custom:mnml-weather-card');
export const GLANCES_CARD = cardKeys('custom:mnml-glances-card');
export const BUTTON_CARD = cardKeys('custom:mnml-button-card');
export const SELECT_CARD = cardKeys('custom:mnml-select-card');
export const SLIDER_CARD = cardKeys('custom:mnml-slider-card');
export const ENTITY_CARD = cardKeys('custom:mnml-entity-card');
export const HEADER_CARD = cardKeys('custom:mnml-header-card');
export const TILE_CARD = cardKeys('custom:mnml-tile-card');
export const MEDIA_CARD = cardKeys('custom:mnml-media-card');
export const CAR_PLAN_CARD = cardKeys('custom:mnml-car-plan-card');
export const POPUPS_CARD = cardKeys('custom:mnml-popups-card');
export const TEMPLATE_CARD = cardKeys('custom:mnml-template-card');

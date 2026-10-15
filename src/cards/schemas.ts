import { CONTROL, LIST_ROW as ROW, STATE_ITEM } from '../contract/structure.ts';

import { keysOf } from './keys.ts';

export const STATE_ITEMS = keysOf(STATE_ITEM);
export const CONTROLS = keysOf(CONTROL);
export const LIST_ROW = keysOf(ROW);

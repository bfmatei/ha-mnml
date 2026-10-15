import type { PopupOpening, PopupScreen } from '../contract/cards.ts';

export const SCREEN_WORDS: readonly { screen: PopupScreen; label: string; otherwise: string }[] = [
  { screen: 'phone', label: 'On a phone', otherwise: 'a sheet' },
  { screen: 'tablet', label: 'On a tablet', otherwise: 'a dialog' },
  { screen: 'desktop', label: 'On a computer', otherwise: 'a dialog' },
];

export const OPENING_WORDS: readonly { opening: PopupOpening; label: string }[] = [
  { opening: 'sheet', label: 'A sheet from the bottom' },
  { opening: 'dialog', label: 'A dialog in the middle' },
  { opening: 'unfold', label: 'Unfolded from its tile' },
];

import type { Palette, Ramp, Theme } from './model.ts';

type Variables = Record<string, string>;

interface Modes {
  light: Variables;
  dark: Variables;
}

interface Definition {
  [variable: string]: string | Modes;
  modes: Modes;
}

export type ThemeFile = Record<string, Definition>;

function variables(palette: Palette): Variables {
  return {
    'primary-background-color': palette.page,
    'secondary-background-color': palette.page,
    'card-background-color': palette.card,
    'ha-card-background': palette.card,
    'primary-text-color': palette.text,
    'secondary-text-color': palette.dimmed,
    'disabled-text-color': palette.disabled,
    'text-primary-color': palette.onPrimary,
    'divider-color': palette.divider,
    'primary-color': palette.yellow,
    'accent-color': palette.purple,
    'state-icon-color': palette.icon,
    'grey-color': palette.icon,
    'text-accent-color': palette.card,
    'error-color': palette.red,
    'warning-color': palette.orange,
    'success-color': palette.green,
    'info-color': palette.blue,
    'app-header-background-color': palette.page,
    'app-header-text-color': palette.text,
    'sidebar-background-color': palette.page,
    'sidebar-text-color': palette.text,
    'sidebar-icon-color': palette.dimmed,
    'sidebar-selected-icon-color': palette.yellow,
    'sidebar-selected-text-color': palette.text,
    'red-color': palette.red,
    'pink-color': palette.red,
    'orange-color': palette.orange,
    'deep-orange-color': palette.orange,
    'amber-color': palette.yellow,
    'yellow-color': palette.yellow,
    'green-color': palette.green,
    'light-green-color': palette.green,
    'blue-color': palette.blue,
    'light-blue-color': palette.blue,
    'cyan-color': palette.blue,
    'teal-color': palette.blue,
    'purple-color': palette.purple,
    'deep-purple-color': palette.purple,
    'indigo-color': palette.purple,
    'mnml-pill-color': palette.pill,
    'mnml-card-edge-color': palette.edge,
    'ha-color-focus': palette.yellow,
    'mdc-text-field-disabled-line-color': palette.disabled,
    'mnml-popup-background-color': palette.page,
  };
}

const RAMP_STEPS: readonly (keyof Ramp)[] = [
  '05',
  '10',
  '20',
  '30',
  '40',
  '50',
  '60',
  '70',
  '80',
  '90',
  '95',
];

function ramp(family: string, values: Ramp): Variables {
  return Object.fromEntries(RAMP_STEPS.map((step) => [`ha-color-${family}-${step}`, values[step]]));
}

export function buildTheme(theme: Theme): ThemeFile {
  return {
    [theme.name]: {
      'primary-font-family': theme.font,
      'ha-font-family-body': 'var(--primary-font-family)',
      'ha-font-family-heading': 'var(--primary-font-family)',
      'ha-card-border-radius': `${theme.cardRadius}px`,
      'ha-card-border-width': '0px',
      'ha-card-box-shadow': 'none',
      'mnml-popup-border-radius': `${theme.popupRadius}px`,
      'mnml-popup-gap': `${theme.cardGap}px`,
      ...ramp('primary', theme.primaryRamp),
      modes: { light: variables(theme.light), dark: variables(theme.dark) },
    },
  };
}

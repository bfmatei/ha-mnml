import type { Hex, Material, Palette, Ramp, Theme, Tint } from './model.ts';

type Variables = Record<string, string>;

export function mix(front: Tint, back: Hex): Hex {
  const top = Number.parseInt(front.color.slice(1), 16);
  const bottom = Number.parseInt(back.slice(1), 16);
  const part = (shift: number): string =>
    Math.round(front.alpha * ((top >> shift) & 255) + (1 - front.alpha) * ((bottom >> shift) & 255))
      .toString(16)
      .padStart(2, '0');
  return `#${part(16)}${part(8)}${part(0)}`;
}

interface Field {
  background: Hex;
  hover: Hex;
  disabled: Hex;
}

export function fieldOf(palette: Palette): Field {
  const background = mix(palette.material.pill, palette.card);
  return {
    background,
    hover: mix({ color: palette.text, alpha: 0.06 }, background),
    disabled: palette.divider,
  };
}

interface Modes {
  light: Variables;
  dark: Variables;
}

interface Definition {
  [variable: string]: string | Modes;
  modes: Modes;
}

export type ThemeFile = Record<string, Definition>;

function rgb(hex: string): string {
  const packed = Number.parseInt(hex.slice(1), 16);
  return `${(packed >> 16) & 255} ${(packed >> 8) & 255} ${packed & 255}`;
}

function tint({ color, alpha }: Tint): string {
  return `rgb(${rgb(color)} / ${alpha})`;
}

function background(material: Material): string {
  const glows = material.glows.map(
    (glow) =>
      `radial-gradient(${glow.width}% ${glow.height}% at ${glow.x}% ${glow.y}%, ${tint(glow)}, transparent 70%) fixed`,
  );
  const { from, to, angle } = material.base;
  return [...glows, `linear-gradient(${angle}deg, ${from}, ${to}) fixed`].join(', ');
}

const NO_SHADOW = '0 0 0 transparent';

function shadow(material: Material): string {
  const { color, alpha } = material.shadow;
  if (alpha === 0) {
    return NO_SHADOW;
  }
  return `0 1px 2px ${tint({ color, alpha: alpha / 2 })}, 0 14px 30px -12px ${tint({ color, alpha })}`;
}

function well(material: Material): string {
  return `inset 0 1px 3px ${tint(material.well)}, 0 1px 0 ${tint(material.lip)}`;
}

interface Depth {
  near: string;
  far: string;
  nearShare: number;
  farShare: number;
}

const DEPTHS: Readonly<Record<'s' | 'm' | 'l', Depth>> = {
  s: { near: '0 1px 2px 0', far: '0 1px 3px 0', nearShare: 0.27, farShare: 0.4 },
  m: { near: '0 3px 6px -1px', far: '0 8px 16px -2px', nearShare: 0.33, farShare: 0.5 },
  l: { near: '0 6px 12px -3px', far: '0 16px 32px -6px', nearShare: 0.4, farShare: 0.67 },
};

function share(alpha: number, part: number): number {
  return Math.round(alpha * part * 100) / 100;
}

function boxShadows(material: Material): Variables {
  const { color, alpha } = material.shadow;
  return Object.fromEntries(
    Object.entries(DEPTHS).map(([size, depth]) => [
      `ha-box-shadow-${size}`,
      alpha === 0
        ? NO_SHADOW
        : `${depth.near} ${tint({ color, alpha: share(alpha, depth.nearShare) })}, ${depth.far} ${tint({ color, alpha: share(alpha, depth.farShare) })}`,
    ]),
  );
}

function controls(palette: Palette): Variables {
  const field = fieldOf(palette);
  return {
    'ha-color-form-background': field.background,
    'ha-color-form-background-hover': field.hover,
    'ha-color-form-background-disabled': field.disabled,
    'ha-switch-background-color': field.background,
    'ha-switch-border-color': palette.icon,
    'ha-switch-thumb-background-color': palette.icon,
    'ha-switch-thumb-border-color': palette.icon,
    'ha-checkbox-border-color': palette.icon,
  };
}

function popupShadow(material: Material): string {
  const { color, alpha } = material.shadow;
  if (alpha === 0) {
    return NO_SHADOW;
  }
  return `0 2px 6px ${tint({ color, alpha: alpha / 2 })}, 0 30px 80px -20px ${tint({ color, alpha: Math.min(1, alpha * 1.3) })}`;
}

function filter(material: Material): string {
  if (material.blur === 0) {
    return 'none';
  }
  return `blur(${material.blur}px) saturate(${material.saturate}%)`;
}

function colours(palette: Palette): Variables {
  return {
    'primary-background-color': palette.page,
    'secondary-background-color': palette.page,
    'card-background-color': palette.card,
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
    'ha-color-focus': palette.yellow,
  };
}

function variables(palette: Palette): Variables {
  const { material } = palette;
  return {
    ...colours(palette),
    ...controls(palette),
    'ha-card-background': tint(material.card),
    'ha-card-backdrop-filter': filter(material),
    ...boxShadows(material),
    'lovelace-background': background(material),
    'ha-section-background-color': tint(material.pill),
    'mnml-pill-color': tint(material.pill),
    'mnml-card-background-color': tint(material.card),
    'mnml-card-backdrop-filter': filter(material),
    'mnml-card-edge-color': tint(material.edge),
    'mnml-pill-raised-color': tint(material.raised),
    'mnml-popup-section-color': tint(material.section),
    'mnml-overlay-background-color': tint(material.overlay),
    'mnml-card-shadow': shadow(material),
    'mnml-button-shadow': well(material),
    'ha-view-sections-column-gap': '12px',
    'ha-view-sections-row-gap': '12px',
    'mnml-card-highlight-color': tint(material.highlight),
    'mnml-popup-background-color': tint(material.card),
    'mnml-popup-backdrop-filter': filter(material),
    'mnml-popup-scrim-color': tint(material.scrim),
    'mnml-popup-scrim-filter':
      material.blur === 0 ? 'none' : `blur(${Math.round(material.blur * 0.6)}px) saturate(120%)`,
    'mnml-popup-scroll-shadow': tint(material.scroll),
    'mnml-popup-shadow': popupShadow(material),
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
      'ha-font-family-body': theme.font,
      'ha-font-family-heading': 'var(--ha-font-family-body)',
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

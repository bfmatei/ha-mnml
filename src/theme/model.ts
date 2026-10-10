type Hex = `#${string}`;

export interface Tint {
  color: Hex;
  alpha: number;
}

interface Glow extends Tint {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Base {
  from: Hex;
  to: Hex;
  angle: number;
}

export interface Material {
  card: Tint;
  pill: Tint;
  section: Tint;
  raised: Tint;
  well: Tint;
  lip: Tint;
  scroll: Tint;
  overlay: Tint;
  shadow: Tint;
  edge: Tint;
  highlight: Tint;
  scrim: Tint;
  blur: number;
  saturate: number;
  base: Base;
  glows: Glow[];
}

export interface Palette {
  page: Hex;
  card: Hex;
  text: Hex;
  dimmed: Hex;
  disabled: Hex;
  divider: Hex;
  icon: Hex;
  onPrimary: Hex;
  red: Hex;
  orange: Hex;
  yellow: Hex;
  green: Hex;
  blue: Hex;
  purple: Hex;
  material: Material;
}

export type Ramp = Record<
  '05' | '10' | '20' | '30' | '40' | '50' | '60' | '70' | '80' | '90' | '95',
  Hex
>;

export interface Theme {
  design: 'glass' | 'flat';
  name: string;
  font: string;
  cardRadius: number;
  popupRadius: number;
  cardGap: number;
  primaryRamp: Ramp;
  light: Palette;
  dark: Palette;
}

export type Design = Theme['design'];

const GLASS: Theme = {
  design: 'glass',
  name: 'MNML',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  cardRadius: 22,
  popupRadius: 22,
  cardGap: 10,
  primaryRamp: {
    '05': '#1b1109',
    '10': '#321c04',
    '20': '#4b2a00',
    '30': '#693c00',
    '40': '#9d5e08',
    '50': '#a0610a',
    '60': '#fce566',
    '70': '#f0ecd3',
    '80': '#f4f1e0',
    '90': '#f9f7ec',
    '95': '#fcfbf5',
  },
  light: {
    page: '#ebe8ee',
    card: '#faf8fc',
    text: '#26232b',
    dimmed: '#524e58',
    disabled: '#a5a1aa',
    divider: '#d6d2da',
    icon: '#6e6a74',
    onPrimary: '#faf8fc',
    red: '#d12256',
    orange: '#be461c',
    yellow: '#9d5e08',
    green: '#007a4a',
    blue: '#18768e',
    purple: '#7058be',
    material: {
      card: { color: '#ffffff', alpha: 0.66 },
      pill: { color: '#4a3f6b', alpha: 0.1 },
      section: { color: '#ffffff', alpha: 0.5 },
      raised: { color: '#ffffff', alpha: 0.75 },
      well: { color: '#3b3150', alpha: 0.28 },
      lip: { color: '#ffffff', alpha: 0.9 },
      scroll: { color: '#2a2140', alpha: 0.2 },
      overlay: { color: '#ffffff', alpha: 0.98 },
      shadow: { color: '#3b3150', alpha: 0.3 },
      edge: { color: '#ffffff', alpha: 0.8 },
      highlight: { color: '#ffffff', alpha: 1 },
      scrim: { color: '#ffffff', alpha: 0.42 },
      blur: 28,
      saturate: 150,
      base: { from: '#efe8fa', to: '#e2edf8', angle: 155 },
      glows: [
        { color: '#c4b5f8', alpha: 0.5, x: 6, y: 0, width: 66, height: 56 },
        { color: '#a9dcf3', alpha: 0.7, x: 100, y: 12, width: 60, height: 54 },
        { color: '#b7ecd3', alpha: 0.6, x: 0, y: 58, width: 52, height: 46 },
        { color: '#fbd0ae', alpha: 0.6, x: 100, y: 70, width: 54, height: 46 },
        { color: '#f6c4d6', alpha: 0.6, x: 50, y: 100, width: 70, height: 52 },
      ],
    },
  },
  dark: {
    page: '#131318',
    card: '#1d1d24',
    text: '#f4f1fb',
    dimmed: '#b4b1be',
    disabled: '#64626b',
    divider: '#2b2b33',
    icon: '#b4b1be',
    onPrimary: '#1d1d24',
    red: '#fc618d',
    orange: '#fd9353',
    yellow: '#fce566',
    green: '#7bd88f',
    blue: '#5ad4e6',
    purple: '#a399ec',
    material: {
      card: { color: '#1e1e26', alpha: 0.62 },
      pill: { color: '#000000', alpha: 0.3 },
      section: { color: '#000000', alpha: 0.26 },
      raised: { color: '#ffffff', alpha: 0.12 },
      well: { color: '#000000', alpha: 0.65 },
      lip: { color: '#ffffff', alpha: 0.13 },
      scroll: { color: '#000000', alpha: 0.45 },
      overlay: { color: '#1e1e26', alpha: 0.98 },
      shadow: { color: '#000000', alpha: 0.55 },
      edge: { color: '#ffffff', alpha: 0.07 },
      highlight: { color: '#ffffff', alpha: 0.1 },
      scrim: { color: '#06060f', alpha: 0.5 },
      blur: 28,
      saturate: 150,
      base: { from: '#15163a', to: '#2a1030', angle: 155 },
      glows: [
        { color: '#6f63d9', alpha: 0.36, x: 6, y: 0, width: 66, height: 56 },
        { color: '#2f95b3', alpha: 0.3, x: 100, y: 12, width: 60, height: 54 },
        { color: '#8a52e0', alpha: 0.32, x: 0, y: 58, width: 52, height: 46 },
        { color: '#2a9a80', alpha: 0.26, x: 100, y: 70, width: 54, height: 46 },
        { color: '#c0447c', alpha: 0.32, x: 50, y: 100, width: 70, height: 52 },
      ],
    },
  },
};

const FLAT: Theme = {
  ...GLASS,
  design: 'flat',
  light: {
    ...GLASS.light,
    material: {
      card: { color: '#faf8fc', alpha: 1 },
      pill: { color: '#e8e6ee', alpha: 1 },
      section: { color: '#ffffff', alpha: 1 },
      raised: { color: '#ffffff', alpha: 1 },
      well: { color: '#3b3150', alpha: 0.28 },
      lip: { color: '#ffffff', alpha: 0.9 },
      scroll: { color: '#2a2140', alpha: 0.2 },
      overlay: { color: '#faf8fc', alpha: 1 },
      shadow: { color: '#3b3150', alpha: 0 },
      edge: { color: '#dcd7e3', alpha: 1 },
      highlight: { color: '#ffffff', alpha: 0 },
      scrim: { color: '#26232b', alpha: 0.4 },
      blur: 0,
      saturate: 100,
      base: { from: '#ebe8ee', to: '#ebe8ee', angle: 155 },
      glows: [],
    },
  },
  dark: {
    ...GLASS.dark,
    material: {
      card: { color: '#1d1d24', alpha: 1 },
      pill: { color: '#141419', alpha: 1 },
      section: { color: '#15151b', alpha: 1 },
      raised: { color: '#303035', alpha: 1 },
      well: { color: '#000000', alpha: 0.65 },
      lip: { color: '#ffffff', alpha: 0.13 },
      scroll: { color: '#000000', alpha: 0.45 },
      overlay: { color: '#1d1d24', alpha: 1 },
      shadow: { color: '#000000', alpha: 0 },
      edge: { color: '#2e2e38', alpha: 1 },
      highlight: { color: '#ffffff', alpha: 0 },
      scrim: { color: '#000000', alpha: 0.55 },
      blur: 0,
      saturate: 100,
      base: { from: '#131318', to: '#131318', angle: 155 },
      glows: [],
    },
  },
};

export const THEMES: Record<Design, Theme> = { glass: GLASS, flat: FLAT };

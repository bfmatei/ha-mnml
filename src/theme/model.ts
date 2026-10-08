type Hex = `#${string}`;

export interface Palette {
  page: Hex;
  card: Hex;
  pill: Hex;
  edge: Hex;
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
}

export type Ramp = Record<
  '05' | '10' | '20' | '30' | '40' | '50' | '60' | '70' | '80' | '90' | '95',
  Hex
>;

export interface Theme {
  name: string;
  font: string;
  cardRadius: number;
  popupRadius: number;
  cardGap: number;
  primaryRamp: Ramp;
  light: Palette;
  dark: Palette;
}

export const THEME: Theme = {
  name: 'MNML',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  cardRadius: 18,
  popupRadius: 18,
  cardGap: 8,
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
    page: '#ede7e5',
    card: '#faf4f2',
    pill: '#d3cdcc',
    edge: '#bfb9ba',
    text: '#29242a',
    dimmed: '#6a6568',
    disabled: '#a59fa0',
    divider: '#d3cdcc',
    icon: '#706b6e',
    onPrimary: '#faf4f2',
    red: '#d12256',
    orange: '#be461c',
    yellow: '#9d5e08',
    green: '#008150',
    blue: '#18768e',
    purple: '#7058be',
  },
  dark: {
    page: '#191919',
    card: '#222222',
    pill: '#363537',
    edge: '#3c3b3d',
    text: '#f7f1ff',
    dimmed: '#8b888f',
    disabled: '#69676c',
    divider: '#363537',
    icon: '#bab6c0',
    onPrimary: '#222222',
    red: '#fc618d',
    orange: '#fd9353',
    yellow: '#fce566',
    green: '#7bd88f',
    blue: '#5ad4e6',
    purple: '#948ae3',
  },
};

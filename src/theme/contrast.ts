import type { Palette, Theme } from './model.ts';

interface Claim {
  what: string;
  fore: string;
  back: string;
  least: number;
}

function channel(value: number): number {
  const part = value / 255;
  return part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const packed = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((packed >> 16) & 255) +
    0.7152 * channel((packed >> 8) & 255) +
    0.0722 * channel(packed & 255)
  );
}

function ratio(fore: string, back: string): number {
  const first = luminance(fore);
  const second = luminance(back);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function paletteClaims(mode: string, palette: Palette): Claim[] {
  const accents = {
    red: palette.red,
    orange: palette.orange,
    yellow: palette.yellow,
    green: palette.green,
    blue: palette.blue,
  };
  const surfaces = { page: palette.page, card: palette.card, pill: palette.pill };
  return [
    ...Object.entries(accents).map(([name, hex]) => ({
      what: `${mode}: ${name} as a value on the card`,
      fore: hex,
      back: palette.card,
      least: 4.5,
    })),
    ...Object.entries({ ...accents, purple: palette.purple }).map(([name, hex]) => ({
      what: `${mode}: ${name} as an icon on the pill`,
      fore: hex,
      back: palette.pill,
      least: 3,
    })),
    ...Object.entries(surfaces).map(([name, hex]) => ({
      what: `${mode}: an icon on the ${name}`,
      fore: palette.icon,
      back: hex,
      least: 3,
    })),
    {
      what: `${mode}: onPrimary on the primary colour`,
      fore: palette.onPrimary,
      back: palette.yellow,
      least: 4.5,
    },
    {
      what: `${mode}: the accent's text on the accent colour`,
      fore: palette.card,
      back: palette.purple,
      least: 4.5,
    },
    {
      what: `${mode}: a heading on the page`,
      fore: palette.dimmed,
      back: palette.page,
      least: 4.5,
    },
    {
      what: `${mode}: a state line on the card`,
      fore: palette.dimmed,
      back: palette.card,
      least: 4.5,
    },
    {
      what: `${mode}: the focus ring on the page`,
      fore: palette.yellow,
      back: palette.page,
      least: 3,
    },
    {
      what: `${mode}: the focus ring on the card`,
      fore: palette.yellow,
      back: palette.card,
      least: 3,
    },
    {
      what: `${mode}: the card edge against the card, at least as strong as the divider`,
      fore: palette.edge,
      back: palette.card,
      least: ratio(palette.divider, palette.card),
    },
    {
      what: `${mode}: the card edge against the page, at least as strong as the divider`,
      fore: palette.edge,
      back: palette.page,
      least: ratio(palette.divider, palette.page),
    },
  ];
}

function rampClaims(theme: Theme): Claim[] {
  const ramp = theme.primaryRamp;
  return [
    { what: 'the primary button: white on step 40', fore: '#ffffff', back: ramp['40'], least: 4.5 },
    {
      what: 'a link in light mode: step 40 on the card',
      fore: ramp['40'],
      back: theme.light.card,
      least: 4.5,
    },
    {
      what: 'a link in dark mode: step 60 on the card',
      fore: ramp['60'],
      back: theme.dark.card,
      least: 4.5,
    },
    {
      what: 'a normal primary fill in light mode: step 40 on step 90',
      fore: ramp['40'],
      back: ramp['90'],
      least: 4.5,
    },
    {
      what: 'a quiet primary fill in light mode: step 50 on step 95',
      fore: ramp['50'],
      back: ramp['95'],
      least: 4.5,
    },
    {
      what: 'a normal primary fill in dark mode: step 60 on step 10',
      fore: ramp['60'],
      back: ramp['10'],
      least: 4.5,
    },
    {
      what: 'a quiet primary fill in dark mode: step 70 on step 05',
      fore: ramp['70'],
      back: ramp['05'],
      least: 4.5,
    },
  ];
}

export function assertContrast(theme: Theme): string[] {
  const claims = [
    ...paletteClaims('light', theme.light),
    ...paletteClaims('dark', theme.dark),
    ...rampClaims(theme),
  ];
  return claims
    .filter((claim) => ratio(claim.fore, claim.back) < claim.least)
    .map(
      (claim) =>
        `${claim.what}: ${ratio(claim.fore, claim.back).toFixed(2)} against a floor of ${claim.least.toFixed(2)}`,
    );
}

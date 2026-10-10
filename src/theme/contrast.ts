import type { Palette, Theme, Tint } from './model.ts';

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

function mix(front: Tint, back: string): string {
  const top = Number.parseInt(front.color.slice(1), 16);
  const bottom = Number.parseInt(back.slice(1), 16);
  const part = (shift: number): string =>
    Math.round(front.alpha * ((top >> shift) & 255) + (1 - front.alpha) * ((bottom >> shift) & 255))
      .toString(16)
      .padStart(2, '0');
  return `#${part(16)}${part(8)}${part(0)}`;
}

function backdrops(palette: Palette): [string, string][] {
  const { base, glows } = palette.material;
  const behind: [string, string][] = [
    ['page', palette.page],
    [`the ${base.from} start of the base`, base.from],
    [`the ${base.to} end of the base`, base.to],
  ];
  for (const glow of glows) {
    behind.push([`the ${glow.color} glow over the start`, mix(glow, base.from)]);
    behind.push([`the ${glow.color} glow over the end`, mix(glow, base.to)]);
  }
  return behind;
}

function materialClaims(mode: string, palette: Palette): Claim[] {
  const { material } = palette;
  const accents = {
    red: palette.red,
    orange: palette.orange,
    yellow: palette.yellow,
    green: palette.green,
    blue: palette.blue,
  };
  const icons: Record<string, Palette['red']> = { ...accents, purple: palette.purple };
  const claims: Claim[] = [];
  for (const [where, behind] of backdrops(palette)) {
    const card = mix(material.card, behind);
    const pill = mix(material.pill, card);
    const raised = mix(material.raised, mix(material.pill, card));
    const well = mix(material.section, card);
    const lifted = mix(material.raised, well);
    claims.push(
      { what: `${mode}: text on a card over ${where}`, fore: palette.text, back: card, least: 7 },
      {
        what: `${mode}: a state line on a card over ${where}`,
        fore: palette.dimmed,
        back: card,
        least: 4.5,
      },
      {
        what: `${mode}: text on a section of a pop-up over ${where}`,
        fore: palette.text,
        back: well,
        least: 7,
      },
      {
        what: `${mode}: a state line on a section of a pop-up over ${where}`,
        fore: palette.dimmed,
        back: well,
        least: 4.5,
      },
      {
        what: `${mode}: an icon on a pill in a section of a pop-up over ${where}`,
        fore: palette.icon,
        back: lifted,
        least: 3,
      },
      { what: `${mode}: a heading over ${where}`, fore: palette.dimmed, back: behind, least: 4.5 },
      {
        what: `${mode}: an icon on a pill over ${where}`,
        fore: palette.icon,
        back: pill,
        least: 3,
      },
      {
        what: `${mode}: an icon on a raised pill over ${where}`,
        fore: palette.icon,
        back: raised,
        least: 3,
      },
      {
        what: `${mode}: the focus ring on a card over ${where}`,
        fore: palette.yellow,
        back: card,
        least: 3,
      },
    );
    for (const [name, hex] of Object.entries(accents)) {
      claims.push({
        what: `${mode}: ${name} as a value on a section of a pop-up over ${where}`,
        fore: hex,
        back: well,
        least: 4.5,
      });
      claims.push({
        what: `${mode}: ${name} as a value on a card over ${where}`,
        fore: hex,
        back: card,
        least: 4.5,
      });
    }
    for (const [name, hex] of Object.entries(icons)) {
      claims.push({
        what: `${mode}: ${name} as an icon on a tinted pill in a section of a pop-up over ${where}`,
        fore: hex,
        back: mix({ color: hex, alpha: 0.16 }, lifted),
        least: 3,
      });
      claims.push({
        what: `${mode}: ${name} as an icon on a tinted pill over ${where}`,
        fore: hex,
        back: mix({ color: hex, alpha: 0.16 }, pill),
        least: 3,
      });
      claims.push({
        what: `${mode}: ${name} as an icon on a pill over ${where}`,
        fore: hex,
        back: pill,
        least: 3,
      });
    }
  }
  return claims;
}

function paletteClaims(mode: string, palette: Palette): Claim[] {
  const accents = {
    red: palette.red,
    orange: palette.orange,
    yellow: palette.yellow,
    green: palette.green,
    blue: palette.blue,
  };
  const surfaces = { page: palette.page, card: palette.card };
  return [
    ...Object.entries(accents).map(([name, hex]) => ({
      what: `${mode}: ${name} as a value on the card`,
      fore: hex,
      back: palette.card,
      least: 4.5,
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
    ...materialClaims('light', theme.light),
    ...materialClaims('dark', theme.dark),
    ...rampClaims(theme),
  ];
  return claims
    .filter((claim) => ratio(claim.fore, claim.back) < claim.least)
    .map(
      (claim) =>
        `${claim.what}: ${ratio(claim.fore, claim.back).toFixed(2)} against a floor of ${claim.least.toFixed(2)}`,
    );
}

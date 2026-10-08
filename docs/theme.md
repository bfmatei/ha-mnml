# How the theme works

`MNML` (`mnml.yaml`, built from `src/theme/` into `custom_components/mnml/www/`, and written by the integration to `config/themes/mnml-integration/`) is the theme the cards are designed for. The cards depend on no theme: they use theme variables only, each with a fallback, and this theme supplies the values.

## What it sets

**Shape and type.**

- **The font** is the system stack.
- **Cards** have an 18 px radius, and no border or shadow of the theme's own. The cards draw their 1 px hairline themselves.
- **Pop-ups** have an 18 px radius, the cards', so a pop-up that unfolds in a tile's place keeps its corners.

**Two palettes under `modes`.** HA switches between them with the operating system when a profile's dark mode is set to Auto. They are [Monokai Pro](https://monokai.pro)'s: Filter Spectrum in the dark, Monokai Pro Light in the light.

**The whole interface.** The palettes apply to all of Home Assistant, not only the dashboard.

## The model

`THEME` in `src/theme/model.ts` is the only thing a change to the theme edits.

| Field                                  | Holds                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `name`, `font`                         | The theme's name and font stack                                                             |
| `cardRadius`, `popupRadius`, `cardGap` | Pixels. The gap is the spacing between a pop-up's cards, the same as a heading above a card |
| `primaryRamp`                          | HA's `primary` colour scale, steps `05` to `95`, shared by both modes                       |
| `light`, `dark`                        | A `Palette` each                                                                            |

A `Palette` has three surfaces, one edge, five greys, the text colour for a primary fill, and six accents. Every value is a `Hex`, because HA derives the `--rgb-*` variants from hex values only. Swapping in another Monokai Pro filter is a matter of replacing these values.

## Where each palette value goes

`buildTheme()` in `src/theme/theme.ts` spells the mapping:

| Palette     | Home Assistant variables                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`      | `primary-background-color`, `secondary-background-color`, the app header, the sidebar, `mnml-popup-background-color`                         |
| `card`      | `card-background-color`, `ha-card-background`, `text-accent-color` (the sidebar's unread badge on `accent-color`)                            |
| `pill`      | `mnml-pill-color`: pills, filled controls, slider tracks                                                                                     |
| `edge`      | `mnml-card-edge-color`: a card's hairline                                                                                                    |
| `text`      | `primary-text-color`, the header and sidebar text                                                                                            |
| `dimmed`    | `secondary-text-color`, the sidebar icons                                                                                                    |
| `disabled`  | `disabled-text-color`, the disabled line of a text field                                                                                     |
| `divider`   | `divider-color`                                                                                                                              |
| `icon`      | `state-icon-color` and `grey-color`. HA derives `--state-inactive-color` from the latter, so its own inactive icons take the theme's neutral |
| `onPrimary` | `text-primary-color`: text on a fill in the primary colour                                                                                   |
| `yellow`    | `primary-color`, Monokai's accent; also `amber-color`, `yellow-color`, the sidebar's selected icon, `ha-color-focus`                         |
| `purple`    | `accent-color`, the fill of a slider with no colour of its own; also `purple-color`, `deep-purple-color`, `indigo-color`                     |
| `red`       | `red-color`, `pink-color`, `error-color`                                                                                                     |
| `orange`    | `orange-color`, `deep-orange-color`, `warning-color`                                                                                         |
| `green`     | `green-color`, `light-green-color`, `success-color`                                                                                          |
| `blue`      | `blue-color`, `light-blue-color`, `cyan-color`, `teal-color`, `info-color`                                                                   |

The semantic colours (`error`, `warning`, `success`, `info`) follow the accents, so HA's own dialogs match them too.

**The text on a primary fill** is the card colour, so a filled button or the sidebar's selection reads against it.

- In the dark palette, that is Monokai's own background behind the bright yellow.
- In the light palette, the yellow is dark enough that nothing darker clears 4.5:1 on it.

## The accents are darkened for text

In the light palette, the accents are darker than a Monokai Pro Light editor sets them.

- **Why:** a list row colours its value text, not just an icon. So each accent the cards use (red, orange, amber, blue) clears 4.5:1 against the card colour. The editor's own values sit near 3:1, and would fail as text.
- **Green too.** No card names it, but HA renders `success-color` as the text of an `ha-alert`.

## HA's colour layer

HA's newer colour layer has two tiers, and the theme addresses the lower one.

- **Core scales.** 57 scales (`--ha-color-neutral-05`...`-95`, `-primary-`, `-red-`, `-orange-`, `-green-`) hold literal hex values.
- **Semantic tokens.** About 189 `--ha-color-*` tokens, all `var()` references into those scales.

So a theme that replaces a scale reaches every token derived from it, and never has to name a semantic token.

| Scale                    | The theme                                                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary`                | **Replaced** (`primaryRamp`). It is spelled once: a scale is shared by both modes, and each mode's semantic tokens pick their own step                                                                                                                                                  |
| `neutral`                | Left alone. HA's ladder already lands within 1.5 L\* of the theme's surfaces: 05 is 6 against a page of 8.8, 10 is 12 against a card of 13.2, 20 is 23 against a pill of 22.3, and 95 is 96 against a card of 96.6. Re-tinting it would be churn with contrast risk and no visible gain |
| `red`, `orange`, `green` | Left alone. They mean danger, warning and success, not brand, and HA's values already read correctly                                                                                                                                                                                    |

**Derived, not written.** HA's theme applier re-resolves every declaration whose value contains `var()` against the theme's own overrides. So the theme writes only what it has to decide, and the rest follows from the palette: all 84 `--state-*-color`, all 13 `--mdc-theme-*` and the semantic tokens.

- Four written keys are belt and braces, resolving to what HA would derive anyway: `ha-card-background`, `ha-font-family-heading`, `sidebar-selected-icon-color` and `app-header-text-color`.
- **`ha-color-focus` is spelled** although HA derives it. HA derives it from `neutral-60`, a fixed grey at 2.36:1 on this theme's light page.

**Out of reach: the toast.** HA's toast reads `--ha-color-neutral-10` directly. That is a scale step, so theming it for the toast's sake would also move `surface-default` in dark mode.

## Contrast is a build gate

`src/theme/contrast.ts` asserts every contrast figure that the documentation claims about the theme, in both modes:

- the accents, as values on the card and as icons on the pill;
- the text on a primary fill;
- headings and state lines;
- the focus ring;
- the hairline, which must be at least as strong as the divider;
- the primary ramp's buttons, links and fills.

`pnpm build` refuses to write the theme when one stops holding, and `contrast.test.ts` runs the same assertions under `pnpm check`.

When a palette changes, fix the claim or the colour. The build won't let them disagree.

## What the cards read

The cards read five variables of their own. The theme sets each; without it, each card falls back as below.

| Variable                      | Read by                                                                         | Without the theme                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mnml-pill-color`             | pills, filled controls, slider tracks                                           | an 8 % mix of the text colour (`--m-pill`)                                                                                 |
| `mnml-card-edge-color`        | every card's hairline                                                           | a 12 % mix of the text colour (`--m-edge`). Right in the dark palette, too weak in the light one, so the theme spells both |
| `mnml-popup-background-color` | the pop-up shell                                                                | `--primary-background-color`                                                                                               |
| `mnml-popup-border-radius`    | the pop-up shell                                                                | a fallback radius                                                                                                          |
| `mnml-popup-gap`              | the pop-up shell, and the gap between the clients and messages cards' own cards | a fallback gap                                                                                                             |

Beyond the two slider gradients, the cards write three colours of their own (see [Design](design.md#colour)).

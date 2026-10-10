# How the theme works

`MNML` is the theme the cards are designed for, in two materials: **glass** (`mnml.yaml`) and **flat** (`mnml-flat.yaml`), both built from `src/theme/` into `custom_components/mnml/www/`. Each defines a theme named MNML; the integration writes the one its **Use the glass design** option selects to `config/themes/mnml-integration/mnml.yaml`, and swaps it, reloading the themes, when the option changes. The cards depend on no theme: they use theme variables only, each with a fallback, and the theme supplies the values. The two themes set the same variables to other values: the glass one translucent, blurred and over a backdrop, the flat one opaque. Under another theme the variables are missing and each has a fallback, which draws the flat material in that theme's colours.

## What it sets

**Shape and type, in both designs.**

- **The font** is the system stack.
  **In the glass theme,**

- **Cards** have a 22 px radius, and no border of the theme's own. The cards draw their 1 px hairline and highlight, and their shadow, from the variables below.
- **Glass.** Cards, pills and pop-ups are translucent and blur what is behind them. Behind them is the view's background (`lovelace-background`): a diagonal gradient under five soft glows, fixed to the window. The glows are in the model, so a change to their colour or strength is held to the contrast claims below.
- **Pop-ups** have a 22 px radius, the cards', so a pop-up that unfolds in a tile's place keeps its corners.

**In the flat theme,** cards are the card colour, opaque, on a 1 px hairline in the `edge` colour, with no blur, no backdrop and no shadow of their own; pills, trays and the thumbs on the Lights strip are opaque colours of their own, and pop-ups are the card colour. Everything else (the radii, the wells, the palettes and the type) is the glass theme's.

**Two palettes under `modes`.** HA switches between them with the operating system when a profile's dark mode is set to Auto. They are [Monokai Pro](https://monokai.pro)'s: Filter Spectrum in the dark, Monokai Pro Light in the light.

**The whole interface.** The palettes apply to all of Home Assistant, not only the dashboard.

## The model

`GLASS` and `FLAT` in `src/theme/model.ts` are the only things a change to the themes edits; `THEMES` lists them by `design`. `FLAT` is `GLASS` with a `Material` of opaque colours, no blur and no glows.

| Field                                  | Holds                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `name`, `font`                         | The theme's name and font stack                                                             |
| `cardRadius`, `popupRadius`, `cardGap` | Pixels. The gap is the spacing between a pop-up's cards, the same as a heading above a card |
| `primaryRamp`                          | HA's `primary` colour scale, steps `05` to `95`, shared by both modes                       |
| `design`                               | `glass` or `flat`, which names the file written (`mnml.yaml`, `mnml-flat.yaml`)             |
| `light`, `dark`                        | A `Palette` each, with its `Material`                                                       |

The theme also sets the gaps of a sections view to 12 px (`ha-view-sections-column-gap`, `-row-gap`).

A `Palette` has two opaque surfaces (the page and the card, which HA's menus and dialogs keep), five greys, the text colour for a primary fill, six accents and its `Material`. Every colour is a `Hex`, because HA derives the `--rgb-*` variants from hex values only; the material has a tint (a `Hex` and an alpha) for each of the card, the pill, the raised pill (a pill on a pill), the shadow, the pop-up, the edge, the highlight and the scrim, the blur and saturation, the base gradient, and the glows. Swapping in another Monokai Pro filter is a matter of replacing these values.

## Where each palette value goes

`buildTheme()` in `src/theme/theme.ts` spells the mapping:

| Palette     | Home Assistant variables                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `page`      | `primary-background-color`, `secondary-background-color`, the app header, the sidebar, and the base of `lovelace-background`                                 |
| `card`      | `card-background-color` (menus, dialogs), `text-accent-color` (the sidebar's unread badge on `accent-color`)                                                 |
| `material`  | `ha-card-background`, `ha-card-backdrop-filter`, `lovelace-background`, and the `mnml-*` variables below: the card, pill, section, edge, highlight and scrim |
| `text`      | `primary-text-color`, the header and sidebar text                                                                                                            |
| `dimmed`    | `secondary-text-color`, the sidebar icons                                                                                                                    |
| `disabled`  | `disabled-text-color`, the disabled line of a text field                                                                                                     |
| `divider`   | `divider-color`                                                                                                                                              |
| `icon`      | `state-icon-color` and `grey-color`. HA derives `--state-inactive-color` from the latter, so its own inactive icons take the theme's neutral                 |
| `onPrimary` | `text-primary-color`: text on a fill in the primary colour                                                                                                   |
| `yellow`    | `primary-color`, Monokai's accent; also `amber-color`, `yellow-color`, the sidebar's selected icon, `ha-color-focus`                                         |
| `purple`    | `accent-color`, the fill of a slider with no colour of its own; also `purple-color`, `deep-purple-color`, `indigo-color`                                     |
| `red`       | `red-color`, `pink-color`, `error-color`                                                                                                                     |
| `orange`    | `orange-color`, `deep-orange-color`, `warning-color`                                                                                                         |
| `green`     | `green-color`, `light-green-color`, `success-color`                                                                                                          |
| `blue`      | `blue-color`, `light-blue-color`, `cyan-color`, `teal-color`, `info-color`                                                                                   |

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

`src/theme/contrast.ts` asserts every contrast figure that the documentation claims about each theme, in both modes:

- the accents, as values on the card and as icons on the pill;
- the text on a primary fill;
- headings and state lines;
- the focus ring;
- text, state lines, headings, accents and icons on the glass, including an accent icon on its own 16 % tint, over the page, both ends of the base gradient and the peak of each glow over each end, which is the worst case;
- the primary ramp's buttons, links and fills.

`pnpm build` refuses to write the theme when one stops holding, and `contrast.test.ts` runs the same assertions under `pnpm check`.

When a palette changes, fix the claim or the colour. The build won't let them disagree.

## What the cards read

The cards read the variables below of their own. The theme sets each; without it, each card falls back as below.

| Variable                      | Read by                                                                         | Without the theme                          |
| ----------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| `mnml-pill-color`             | pills, filled controls, slider tracks                                           | an 8 % mix of the text colour (`--m-pill`) |
| `mnml-card-background-color`  | every card's surface (`--m-card`)                                               | `--card-background-color`                  |
| `mnml-card-backdrop-filter`   | every card's blur of what is behind it                                          | none: the card is opaque                   |
| `mnml-card-edge-color`        | every card's hairline                                                           | a 12 % mix of the text colour (`--m-edge`) |
| `mnml-card-highlight-color`   | the 1 px light line along a card's top edge                                     | none                                       |
| `mnml-popup-background-color` | the pop-up shell: a card's fill                                                 | `--primary-background-color`               |
| `mnml-popup-section-color`    | the cards inside a pop-up: the trays it holds                                   | the pill colour                            |
| `mnml-popup-backdrop-filter`  | the pop-up shell's blur                                                         | none                                       |
| `mnml-popup-scrim-color`      | the dimming behind a pop-up                                                     | `rgb(0 0 0 / 0.55)`                        |
| `mnml-popup-scrim-filter`     | the blur of the page behind a pop-up                                            | none                                       |
| `mnml-popup-shadow`           | the pop-up shell's elevation                                                    | none                                       |
| `mnml-popup-border-radius`    | the pop-up shell                                                                | a fallback radius                          |
| `mnml-popup-gap`              | the pop-up shell, and the gap between the clients and messages cards' own cards | a fallback gap                             |

Beyond the two slider gradients, the cards write three colours of their own (see [Design](design.md#colour)).

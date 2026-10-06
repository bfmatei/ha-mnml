# Design

The visual system of the cards: surfaces, sizes, colour, feedback and motion. For how each card behaves, see [How the cards work](cards.md).

## Principles

- **Flat.** Every card is a surface in the card colour. Its hairline edge is the only line in the design.
- **One filled control per card.** Everything else has no background.
- **A state colours an icon, never a surface.**
- **Headings, not separators.** A heading sits above a card, never inside one.
- **Nothing idle.** Empty space is fine. A pill or text that carries no information is a defect.
- **Any theme.** The cards use theme variables only, so any theme renders them. The MNML theme, which the integration installs, sets the values they are designed for ([The theme](theme.md)).

## The cards' own variables

Besides Home Assistant's variables, the cards read five of their own, each with a fallback. The MNML theme sets all five. `BASE_STYLE`'s `:host` holds the colours several styles share as custom properties, which every card's styles read: `--m-pill` and `--m-edge`, from the first two variables or their fallbacks; `--m-edge-strong`, the edge under `prefers-contrast: more`; and `--m-hover`, the hover wash.

| Variable                      | Read by                                                                         | Without the theme                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mnml-pill-color`             | pills, filled controls, slider tracks                                           | an 8 % mix of the text colour (`--m-pill`)                                                                                 |
| `mnml-card-edge-color`        | every card's hairline                                                           | a 12 % mix of the text colour (`--m-edge`). Right in the dark palette, too weak in the light one, so the theme spells both |
| `mnml-popup-background-color` | the pop-up shell                                                                | `--primary-background-color`                                                                                               |
| `mnml-popup-border-radius`    | the pop-up shell                                                                | a fallback radius                                                                                                          |
| `mnml-popup-gap`              | the pop-up shell, and the gap between the clients and messages cards' own cards | a fallback gap                                                                                                             |

## Layout

- **Sizes.** In a sections view, the small cards (button, select, slider, tile) take half a section, 6 of its 12 grid columns, so two share a row; every other card takes the full section, and the pop-up shell one column of a zero-height row. `grid_options` overrides any of them. A card is as tall as its content.
- **Section headings.** A heading has its title and icon at the left, and a trailing group (`.trail`) at the right with a state line, controls, or both. A folding list's heading ends in a chevron after its summary, and the whole heading is the tap target; folded, the heading stands alone, with no surface under it.

## Surfaces and the hairline

**The edge.** Each card draws a 1 px inset hairline in the theme's `edge` colour (`--m-edge`: `--mnml-card-edge-color`, or a 12 % mix of the text colour without it).

- **Why it exists.** The card is the tap target, and without an edge you can't see the boundary of what you are pressing.
- **Why it is `::after`.** Drawn there, a hover wash cannot replace it.
- **Why it comes from the theme.** No single percentage serves both palettes. In dark, the edge is the lightest of page, card and edge, so it gains contrast against the page. In light, it sits four points of L\* below the page, so it loses contrast there.

| Palette | Against the card | Against the page |
| ------- | ---------------- | ---------------- |
| Light   | 1.78:1           | 1.58:1           |
| Dark    | 1.43:1           | 1.58:1           |

Each is at least as strong as the theme's divider colour. The hairline is on `.card` and on the full-width slider card, except a gradient slider, where it measures 1.0:1 and does nothing. It is never on a pill or a control.

## Sizes

| Element                        | Size                                                                        |
| ------------------------------ | --------------------------------------------------------------------------- |
| Item row                       | 56 px                                                                       |
| Pill (an item's icon)          | 40 px round                                                                 |
| Name / state line              | 15 px semibold / 13 px in the secondary colour, one line (`ROW_STYLE`)      |
| Control                        | 36 px button, 20 px icon (`CONTROL_STYLE`)                                  |
| Heading                        | 36 px, 14 px semibold in the secondary colour, 18 px icon (`HEADING_STYLE`) |
| Heading to its card            | 8 px, as the pop-up shell spaces its cards                                  |
| List row / table header row    | 32 px / 24 px, the header in 12 px text                                     |
| List bar column / reset button | 72 px / 28 px                                                               |
| Tile's Lights row              | 44 px, in the pill colour; its icon a 36 px pill in the card colour         |
| Problems dot                   | 12 px, ringed by 2 px of the card colour                                    |
| Slider track / slider card     | 40 px / 56 px                                                               |
| Client row                     | 40 px: the name over its 12 px FQDN, the IP right-aligned                   |
| Menu row                       | 36 px                                                                       |
| Header back / close            | 40 px rounds in the card colour                                             |

| Radius         | Where                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The card's own | `--ha-card-border-radius`, 18 px in the theme. Also the slider cards                                                          |
| 24 px          | The pop-up (`mnml-popup-border-radius`). Under 600 px its bottom corners square off, so it reads as a sheet                   |
| 16 px          | The tile's Lights strip                                                                                                       |
| 14 px          | A menu                                                                                                                        |
| 12 px          | A control, a slider track, and the tile's light button: a rounded square that reads as tappable, unlike the room's round pill |
| 10 px          | A menu row                                                                                                                    |
| 8 px           | A list row's reset button                                                                                                     |
| 2 px           | A bar, a slider marker                                                                                                        |
| `50%`          | A pill                                                                                                                        |

| Icon  | Where                                                                                    |
| ----- | ---------------------------------------------------------------------------------------- |
| 22 px | In a pill, in a header round                                                             |
| 20 px | In a control, in a slider label, in a menu row, in a list row, in the tile's Lights pill |
| 18 px | In a heading                                                                             |
| 16 px | On a reset button, in a heading's state line                                             |
| 15 px | In a state line, matched to its 13 px text                                               |

**The state line** is one line. Its items are separated by `•`, each preceded by its entity's state icon when `icon: true`. Only in a tile may it wrap, so that a phone shows both of a car's values. Text that overflows is cut with an ellipsis, never scrolled.

## Controls

**One filled primary per card**:

- the power button (the `power` fragment, `primary: true`);
- the AC's HVAC mode button;
- the vacuum's Start / Stop;
- the media card's play / pause.

Everything else has no background, with two exceptions:

- **A tile's chips** sit on the pill colour, as status badges.
- **The tile's Lights row** is a strip in the pill colour. The light button and the power button on it are filled in the card colour instead.

## Colour

**Colour is a variable, never a literal, and it colours an icon or text, never a surface.** `colorStyle()` sets `--m-color` to `var(--<color>-color)`, and the `colored` class reads it. The `Color` type is the four semantic colours: `red`, `orange`, `amber`, `blue`.

| Colour  | Means                                                                                                                                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red     | A fault: a list value past `critical` or `critical_high`; a battery under `BATTERY_CRITICAL`; a tyre under `tyre_low_share` of its target; a message of severity `error`, on its envelope. A configuration gives it to what it treats as a fault, such as water or an unlocked lock |
| Orange  | A warning: a list value past `low` or `high`; a battery under `BATTERY_LOW`; a tyre under `tyre_warn_share`; an unavailable entity, wherever it is shown; a message of severity `warning`. A configuration gives it to what it treats as a warning, such as an open window          |
| Amber   | On, by convention: a light, a switch, a playing media player                                                                                                                                                                                                                        |
| Blue    | A message of severity `info` or `notice`; by convention, a climate unit while it cools                                                                                                                                                                                              |
| Neutral | Everything else. A message of any other severity is grey: its envelope in the secondary text colour                                                                                                                                                                                 |

Every threshold has two stages, so that a slow drift and a fault don't look alike. Red and orange are also the two colours of a tile's problems dot.

**An unavailable entity keeps its place.** Its icon, pill, chip or control turns orange, and where its value would print an em dash stands in orange, so a room whose sensor is offline reads "— • —" rather than losing its line. The name beside it stays in the text colour: the warning is on the reading, not the label. A daily total is the exception (`zero_when_empty`): a total such as the day's steps may report nothing until the day's first sample, so its row reads 0 in its unit, uncoloured. [Cards](cards.md#rules) has the rule kind by kind.

**Where a fill is the reading.** In these few regions the colour is the state itself, so it fills a surface:

- the problems dot (`.dot`);
- a slider's fill (`.fill`, the colour at 38 %);
- a list row's bar (`.bar > div`, in `currentColor`);
- the car plan's open parts and low tyres (`.part.open`, `.half`, `.tyre.low`, `.warn`).

Two more fills are colour on purpose: the white temperature and hue gradients (`WHITE_GRADIENT`, `HUE_GRADIENT`), which show the colours they set; and the card's hairline, which is an edge rather than a state.

**Four literals remain**, in the slider, the menu and the pop-up shell:

- the gradient marker's `#fff`;
- its `rgb(0 0 0 / 0.3)` ring, the only thing that makes the marker visible on the pale end of the white gradient;
- the menu popover's `rgb(0 0 0 / 0.3)` shadow, the one elevation in the design;
- the pop-up backdrop's `rgb(0 0 0 / 0.55)`, a dimming that must read the same over either palette.

| Surface or ink                                                | Variable                                               |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| A card                                                        | `--card-background-color`                              |
| A pill, a filled control, a slider track, a hovered menu item | `--m-pill` (`--mnml-pill-color`, else an 8 % text mix) |
| Text                                                          | `--primary-text-color`, `--secondary-text-color`       |
| A bar's track                                                 | `--divider-color`                                      |
| A card's edge                                                 | `--m-edge`                                             |
| A slider fill without a colour of its own                     | `--accent-color`                                       |

Every colour a card names has a value in both modes of the theme.

## Sliders and menus

**Sliders.** A slider is a 40 px track in the pill colour with a translucent fill: `--m-color` at 38 %, or the accent. A 2 px solid border in the same colour closes the fill.

- **Why the border.** The fill alone sits at 1.5 to 2.7:1 against its track, and a translucent accent over that track cannot reach 3:1 and stay translucent. The border carries the value's position instead, at 3.1 to 3.5:1 in light and 4.2 to 9.6:1 in dark.
- **Gradient sliders** hide the fill. They show a white marker, and a label with a halo in the card colour so that it stays legible.

**Menus** are popovers in the card colour, under their anchor. Rows are 36 px, and the selected one is in the primary colour.

## Feedback

| Input     | Feedback                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pointer   | One rule per interactive surface: the tile, the button card, a linking item pill and any control that is not inert take an inset `--m-hover` wash. It is an 8 % mix of the text colour, which reads the same over the card, the pill or a filled control. Each rule sits behind `@media (hover: hover)` |
| Touch     | The same wash from `:active`, on the tile (except while one of its own controls is pressed) and on a linking pill. Every other control scales to 0.94. A tap is always acknowledged                                                                                                                     |
| Keyboard  | A 2 px `--primary-color` outline, from one `:focus-visible` rule in `BASE_STYLE`. Tiles and pills take Enter or Space; a slider takes the arrow keys, Home and End. HA's own surfaces follow `ha-color-focus`, which the theme spells                                                                   |
| Selection | What is pressed cannot be selected: a button, anything with `role="button"`, a linking row and a folding heading, from one rule in `BASE_STYLE`. So clicks in quick succession select no text. Values, rows that only read and a message's text stay selectable, for copying                            |

## Adapting to the user's settings

Two media queries adapt the design rather than decorate it:

- **`prefers-contrast: more`** takes the hairline to a 50 % mix of the text colour (3.0:1 in light, 4.7:1 in dark), and the slider fill's border to 3 px.
- **`forced-colors: active`** replaces what that mode destroys. The mode drops `box-shadow`, which is how the hairline is drawn, and forces every background. So:
  - the hairline becomes a real `CanvasText` border, and so do the menu's edge and a list bar's track;
  - the slider fill, a list bar's fill and the problems dot become `Highlight`, the dot ringed in `Canvas`;
  - the gradient sliders show their fill again;
  - their markers become `CanvasText`.
- **`prefers-reduced-motion: reduce`** turns every animation and transition off (see [Motion](cards.md#motion)).

## Motion, in one rule

Motion is confined to what the cards own the lifecycle of: a pop-up, a menu and a slider overlay animate in, a pop-up animates out, and press feedback transitions. State that arrives with `hass` never animates. [How the cards work](cards.md#motion) has the timings.

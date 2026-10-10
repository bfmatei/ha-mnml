# Design

The visual system of the cards: surfaces, sizes, colour, feedback and motion. For how each card behaves, see [How the cards work](cards.md).

## One design, two materials

The cards have one design, and the theme gives it a material.

- **Glass** is the design in translucent surfaces: every card is the card colour at 60 to 62 % over a blurred backdrop, with a highlight along its top and a soft shadow.
- **Flat** is the same design in opaque ones: the card colour as it is, on a hairline edge, with no blur, no backdrop and no shadow of its own.

The two are the two MNML themes, which set the same variables to other values, and the integration installs one by its **Use the glass design** option ([The theme](theme.md)). The shapes, the type and the layout are in the cards' styles and do not depend on it. Under any other theme the variables are missing and each has a fallback, which draws the flat material in that theme's colours.

## Principles

- **One row, everywhere.** An item is a rounded rectangle with a square icon tile and generous padding, in a tile's Lights strip and in a pop-up alike. Its buttons have no background: the primary one is only brighter.
- **Cards are raised, what sits in them is recessed.** A pill, a chip, the tile's Lights strip and a slider track are wells (`mnml-button-shadow`); an item's icon tile is a light fill in it, like a segmented control's thumb.
- **A state colours an icon, and tints the pill behind it.** No other surface takes a state colour.
- **Headings, not separators.** A heading sits above a card, never inside one.
- **Nothing idle.** Empty space is fine. A pill or text that carries no information is a defect.
- **Any theme.** The cards use theme variables only, so any theme renders them. The MNML themes set the values they are designed for ([The theme](theme.md)).

## The cards' own variables

Besides Home Assistant's variables, the cards read eighteen of their own, each with a fallback. The MNML theme sets all eighteen. `BASE_STYLE`'s `:host` holds the colours several styles share as custom properties, which every card's styles read: `--m-pill` and `--m-edge`, from the first two variables or their fallbacks; `--m-edge-strong`, the edge under `prefers-contrast: more`; and `--m-hover`, the hover wash.

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

## Layout

- **Sizes.** In a sections view, the small cards (button, select, slider, tile) take half a section, 6 of its 12 grid columns, so two share a row; every other card takes the full section, and the pop-up shell one column of a zero-height row. `grid_options` overrides any of them. A card is as tall as its content.
- **Section headings.** A heading has its title and icon at the left, and a trailing group (`.trail`) at the right with a state line, controls, or both. A folding list's heading ends in a chevron after its summary, and the whole heading is the tap target; folded, the heading stands alone, with no surface under it.

## Surfaces and the hairline

**The glass.** In the glass material a card is the card colour at 60 to 62 % over what is behind it, which the theme blurs (`--mnml-card-backdrop-filter`) and saturates. What is behind it is the view's own background (`lovelace-background`, fixed, so the page moves over it): a diagonal gradient under five large, soft glows in different hues, so every card picks up a little of the colour behind it and nothing in it has an edge. A pop-up is a card of the same material, larger, with a deeper shadow. What it holds is recessed, as a card's contents are: its cards are trays in the pop-up's own section colour (`--mnml-popup-section-color`) with the recess (`--mnml-button-shadow`) and no rim, shadow or blur of their own, and the pills and filled controls in them are the light fills of the Lights strip's thumbs. The page behind a pop-up is veiled and blurred (`--mnml-popup-scrim-color`, `--mnml-popup-scrim-filter`): a light veil in the light palette, a dark one in the dark.

**The edge.** In both designs, each card draws a 1 px inset hairline (`--m-edge`: `--mnml-card-edge-color`, or a 12 % mix of the text colour without it), and a 1 px highlight along its top (`--mnml-card-highlight-color`).

- **Why it exists.** The card is the tap target, and without an edge you can't see the boundary of what you are pressing.
- **Why it is `::after`.** Drawn there, a hover wash cannot replace it.
- **Why it comes from the theme.** The right strength depends on the palette and on the glass behind it.

The hairline is on `.card` and on the full-width slider card, except a gradient slider, where it does nothing. It is never on a pill or a control.

## Sizes

| Element                        | Size                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Item row                       | 56 px                                                                                               |
| Pill (an icon's tile)          | 40 px, a 12 px rounded square                                                                       |
| Name / state line              | 16 px semibold, tracked slightly tighter / 13 px in the secondary colour, one line (`ROW_STYLE`)    |
| Control                        | 36 px button, 20 px icon (`CONTROL_STYLE`)                                                          |
| Heading                        | 36 px, 12 px semibold capitals tracked 0.07em in the secondary colour, 16 px icon (`HEADING_STYLE`) |
| Heading to its card            | 8 px, as the pop-up shell spaces its cards                                                          |
| List row / table header row    | 32 px / 24 px, the header in 12 px text                                                             |
| List bar column / reset button | 72 px / 28 px                                                                                       |
| Tile's Lights row              | 56 px, as any item row, in the pill colour; its icon tile 40 px in the raised colour                |
| Problems dot                   | 12 px, ringed by 2 px of the card colour                                                            |
| Slider track / slider card     | 40 px / 56 px                                                                                       |
| Client row                     | 40 px: the name over its 12 px FQDN, the IP right-aligned                                           |
| Menu row                       | 36 px                                                                                               |
| Header back / close            | 40 px rounded squares in the card colour                                                            |

| Radius         | Where                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| The card's own | `--ha-card-border-radius`, 22 px in both themes and as the fallback. Also the slider cards                                     |
| 22 px          | The pop-up (`mnml-popup-border-radius`), as the card's own. Under 600 px its bottom corners square off, so it reads as a sheet |
| 14 px          | The tile's Lights strip, and a card inside a pop-up                                                                            |
| 14 px          | A menu                                                                                                                         |
| 12 px          | A control, a slider track, and every pill: rounded squares                                                                     |
| 10 px          | A menu row                                                                                                                     |
| 8 px           | A list row's reset button                                                                                                      |
| 2 px           | A bar, a slider marker                                                                                                         |

| Icon  | Where                                                                                    |
| ----- | ---------------------------------------------------------------------------------------- |
| 22 px | In a pill, in a header round                                                             |
| 20 px | In a control, in a slider label, in a menu row, in a list row, in the tile's Lights pill |
| 16 px | On a reset button, in a heading, in a heading's state line                               |
| 15 px | In a state line, matched to its 13 px text                                               |

**The state line** is one line. Its items are separated by `•`, each preceded by its entity's state icon when `icon: true`. Only in a tile may it wrap, so that a phone shows both of a car's values. Text that overflows is cut with an ellipsis, never scrolled.

## Controls

**One primary per card.** It is in the primary text colour while the others are secondary, a button in a row has no background, and a tile chip is a well pressed into the card, the pill colour with a soft inner shadow along its top and a light lip along its bottom:

- the power button (the `power` fragment, `primary: true`);
- the AC's HVAC mode button;
- the vacuum's Start / Stop;
- the media card's play / pause.

Everything else has no background, with one exception: **a tile's chips** sit on the pill colour, as status badges.

## Colour

**Colour is a variable, never a literal, and it colours an icon or text. A state colour also tints the pill behind its icon (16 % over the pill colour); no other surface takes one.** `colorStyle()` sets `--m-color` to `var(--<color>-color)`, and the `colored` class reads it. The `Color` type is the four semantic colours: `red`, `orange`, `amber`, `blue`.

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
- the pop-up backdrop's fallback `rgb(0 0 0 / 0.55)`, which only applies without the theme.

| Surface or ink                                                | Variable                                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| A card                                                        | `--m-card` (`--mnml-card-background-color`, else `--card-background-color`) |
| A pill, a filled control, a slider track, a hovered menu item | `--m-pill` (`--mnml-pill-color`, else an 8 % text mix)                      |
| Text                                                          | `--primary-text-color`, `--secondary-text-color`                            |
| A bar's track                                                 | `--divider-color`                                                           |
| A card's edge                                                 | `--m-edge`                                                                  |
| A slider fill without a colour of its own                     | `--accent-color`                                                            |

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

# Design

The visual system of the cards: surfaces, sizes, colour, feedback and motion. For how each card behaves, see [How the cards work](cards.md).

## One design, two materials

The cards have one design, and the theme gives it a material.

- **Glass** is the design in translucent surfaces: every card is the card colour at 60 to 62 % over a blurred backdrop, with a highlight along its top and a soft shadow.
- **Flat** is the same design in opaque ones: the card colour as it is, on a hairline edge, with no blur, no backdrop and no shadow of its own.

The two are the two MNML themes, which set the same variables to other values, and the integration installs one by its **Use the glass design** option ([The theme](theme.md)). The shapes, the type and the layout are in the cards' styles and do not depend on it. Under any other theme the variables are missing and each has a fallback, which draws the flat material in that theme's colours.

## Principles

- **A card is its pop-up, minified.** An item in a pop-up is a rounded rectangle with a square icon tile and generous padding, its name over its state line, and all its controls. The same item in a tile's Lights strip is one slim line: its icon alone, its name and state line after it, and the same controls, smaller; a slider it opens covers that line alone. Its buttons have no background: the primary one is only brighter.
- **Cards are raised, what sits in them is recessed.** A pill, a chip, the tile's Lights strip, a slider track, a small square's round well and a large square's buttons are wells (`mnml-button-shadow`); an item's icon tile is a light fill in it, like a segmented control's thumb.
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

- **Sizes.** In a sections view, the small cards (button, select, slider, tile) take half a section, 6 of its 12 grid columns, so two share a row; every other card takes the full section, and the pop-up shell one column of a zero-height row. `grid_options` overrides any of them, as the plan's `squares` does: 6 columns for a large square and 3 for a small one ([Sizes](#sizes)). A card is as tall as its content, but for a square.
- **Section headings.** A heading has its title and icon at the start, and a trailing group (`.trail`) at the end with a state line, controls, or both. A folding list's heading ends in a chevron after its summary, and the whole heading is the tap target; folded, the heading stands alone, with no surface under it.

## Surfaces and the hairline

**The glass.** In the glass material a card is the card colour at 60 to 62 % over what is behind it, which the theme blurs (`--mnml-card-backdrop-filter`) and saturates. What is behind it is the view's own background (`lovelace-background`, fixed, so the page moves over it): a diagonal gradient under five large, soft glows in different hues, so every card picks up a little of the colour behind it and nothing in it has an edge. A pop-up is a card of the same material, larger, with a deeper shadow. What it holds is recessed, as a card's contents are: its cards are trays in the pop-up's own section colour (`--mnml-popup-section-color`) with the recess (`--mnml-button-shadow`) and no rim, shadow or blur of their own, and the pills and filled controls in them are light fills, like a segmented control's thumb. The page behind a pop-up is veiled and blurred (`--mnml-popup-scrim-color`, `--mnml-popup-scrim-filter`): a light veil in the light palette, a dark one in the dark.

**The edge.** In both designs, each card draws a 1 px inset hairline (`--m-edge`: `--mnml-card-edge-color`, or a 12 % mix of the text colour without it), and a 1 px highlight along its top (`--mnml-card-highlight-color`).

- **Why it exists.** The card is the tap target, and without an edge you can't see the boundary of what you are pressing.
- **Why it is `::after`.** Drawn there, a hover wash cannot replace it.
- **Why it comes from the theme.** The right strength depends on the palette and on the glass behind it.

The hairline is on `.card` and on the full-width slider card, except a gradient slider, where it does nothing. It is never on a pill or a control.

## Sizes

| Element                        | Size                                                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Item row                       | 56 px                                                                                                                                                                         |
| Pill (an icon's tile)          | 40 px, a 12 px rounded square                                                                                                                                                 |
| Name / state line              | 16 px semibold, tracked slightly tighter / 13 px in the secondary colour, one line (`ROW_STYLE`)                                                                              |
| Control                        | 36 px button, 20 px icon (`CONTROL_STYLE`)                                                                                                                                    |
| Heading                        | 36 px, 12 px semibold capitals tracked 0.07em in the secondary colour, 16 px icon (`HEADING_STYLE`)                                                                           |
| Heading to its card            | 8 px, as the pop-up shell spaces its cards                                                                                                                                    |
| List row / table header row    | 32 px / 24 px, the header in 12 px text                                                                                                                                       |
| List bar column / reset button | 72 px / 28 px                                                                                                                                                                 |
| Tile's Lights row              | 36 px, one line in the pill colour: its icon with no tile, then its state line, with no name; each of its controls a 28 px round, a slider opened from one 36 px over the row |
| Slider track / slider card     | 40 px / 56 px                                                                                                                                                                 |
| Client row                     | 40 px: the name over its 12 px FQDN, the IP at the end                                                                                                                        |
| Menu row                       | 36 px                                                                                                                                                                         |
| Header back / close            | 40 px rounded squares in the card colour                                                                                                                                      |

| Radius         | Where                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The card's own | `--ha-card-border-radius`, 22 px in both themes and as the fallback. Also the slider cards                                                                   |
| 22 px          | The pop-up (`mnml-popup-border-radius`), as the card's own. Opened as a sheet, a phone's opening unless `open` says otherwise, its bottom corners square off |
| 14 px          | The tile's Lights strip, and a card inside a pop-up                                                                                                          |
| 14 px          | A menu                                                                                                                                                       |
| Round          | The tile's Lights row: its icon's tap target and its controls                                                                                                |
| 12 px          | A control, a slider track, and every pill: rounded squares                                                                                                   |
| 10 px          | A menu row                                                                                                                                                   |
| 8 px           | A list row's reset button                                                                                                                                    |
| 2 px           | A bar, a slider marker                                                                                                                                       |

| Icon  | Where                                                                                    |
| ----- | ---------------------------------------------------------------------------------------- |
| 22 px | In a pill, in a header round                                                             |
| 20 px | In a control, in a slider label, in a menu row, in a list row                            |
| 18 px | The icon of the tile's Lights row                                                        |
| 16 px | On a reset button, in a heading, in a heading's state line, on the Lights row's controls |
| 15 px | In a state line, matched to its 13 px text                                               |

**The state line** is one line. Its items are separated by `•`, each preceded by its entity's state icon when `icon: true`, centred on its value 3 px before it. A line with no item to show takes no space. Only in a tile may it wrap, so that a long line shows whole; in the tile's Lights row it is the row's only text, beside the icon. Text that overflows is cut with an ellipsis, never scrolled.

**Squares.** A square is as tall as it is wide (`aspect-ratio: 1`), so its size is the grid's: a large one, 6 grid columns, half a view column, is about 156 to 246 px across (Home Assistant keeps a view column between 320 and 500 px wide, and narrower on a phone under 336 px), and a small one, 3 grid columns, about 74 to 119 px.

- **A large square** has the 40 px pill 10 px in from its top corner, and the strip of issues hanging from the other: 32 x 36 px cells with square corners and 18 px icons, the strip's free corner rounded 16 px. The name, 18 px, over the first two readings at 15 px, each on its line with its icon, sits 10 px in from the bottom, clear of the column; two readings side by side would not fit beside it. The day's line runs between them, 2 px with round ends and joins: the secondary text colour at 60 % opacity, or its colour at full opacity while its `when` holds. The column is 36 px buttons 6 px from the bottom and end edges, 8 px apart, each with a 44 px target on a touch screen. The square is an inline-size container, and a narrow one tightens: under 180 px across, the name is 17 px, the strip's cells 32 px tall and the column's buttons 4 px apart, so the strip clears a column of three; under 156 px, the name is 16 px, the readings 14 px, the day's line 6 px taller, and the column's buttons 32 px.
- **Its options.** The lights' or a `nav` chip's options are a floating panel inside the square, in the card colour with a menu's shadow, 4 px around buttons drawn as the column's are and spaced as it is, its corners rounded 16 px, the buttons' 12 px and its 4 px, so the two curves run side by side. It sits on the button tapped, the toggle in the button's place, and grows to the start, wrapping upward when a row does not fit. A button that does not apply while the entity is off is at 50 % opacity, as a disabled select is, and does not press in. A part makes the whole square that part, 6 px in: the back button and the name at 15 px semi-bold, ending in an ellipsis, then the slider at the square's foot, or a menu's 36 px rows filling the rest and scrolling. The square's own content hides and its glow stays.
- **A small square** is a 42 px round well with a 22 px icon, the name under it at 11 px, and a strip of 22 x 24 px cells with 14 px icons, its free corner rounded 11 px.

## Controls

**One primary per card.** It is in the primary text colour while the others are secondary, a button in a row has no background, and a tile chip is a well pressed into the card, the pill colour with a soft inner shadow along its top and a light lip along its bottom:

- the power button (the `power` fragment, `primary: true`);
- the AC's HVAC mode button;
- the vacuum's Start / Stop;
- the media card's play / pause.

Everything else has no background, with one exception: **a tile's chips** sit on the pill colour, as status badges.

## Colour

**Colour is a variable, never a literal, and it colours an icon or text. A state colour also tints the pill behind its icon (16 % over the pill colour); no other surface takes one.** `colorStyle()` sets `--m-color` to `var(--<color>-color)`, and the `colored` class reads it. The `Color` type is the four semantic colours: `red`, `orange`, `amber`, `blue`.

| Colour  | Means                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red     | A fault: a list value past `critical` or `critical_high`; a battery under its `critical` threshold (5 % by default); a tyre under `tyre_low_share` of its target; a message or a repair of severity `critical` or `error`, on its envelope. A configuration gives it to what it treats as a fault, such as water or an unlocked lock                                                                                                  |
| Orange  | A warning: a list value past `low` or `high`; a battery under its `low` threshold (20 % by default); a tyre under `tyre_warn_share`; an unavailable entity, wherever it is shown; a message or a repair of severity `warning`. A configuration gives it to what it treats as a warning, such as an open window                                                                                                                        |
| Amber   | On, by convention: a light, a switch, a playing media player, a heating while it runs, a pending update. A switch whose on is the normal state, such as AdGuard Home's protection, a server's outlet or a car's alarm, is neutral while on and orange or red while off, so a calm home shows no amber for it; a count of updates counts only what the home depends on (Tailscale's essential devices), the rest listed in its pop-up. |
| Blue    | A message of severity `info` or `notice`; by convention, a climate unit while it cools                                                                                                                                                                                                                                                                                                                                                |
| Neutral | Everything else. A message of any other severity, and a notification of Home Assistant's, which has none, is grey: its envelope in the secondary text colour                                                                                                                                                                                                                                                                          |

Every threshold has two stages, so that a slow drift and a fault don't look alike. Red and orange are also the two colours of a tile's battery chip.

**An unavailable entity keeps its place.** Its icon, pill, chip or control turns orange, and where its value would print an em dash stands in orange, so a room whose sensor is offline reads "— • —" rather than losing its line. The name beside it stays in the text colour: the warning is on the reading, not the label. A daily total is the exception (`zero_when_empty`): a total such as the day's steps may report nothing until the day's first sample, so its row reads 0 in its unit, uncoloured. [Cards](cards.md#rules) has the rule kind by kind.

**Where a fill is the reading.** In these few regions the colour is the state itself, so it fills a surface:

- a slider's fill (`.fill`, the colour at 38 %);
- a list row's bar (`.bar > div`, in `currentColor`);
- the car plan's open parts and low tyres (`.part.open`, `.half`, `.tyre.low`, `.warn`).

Three more fills are colour on purpose: the white temperature and hue gradients (`WHITE_STOPS`, `HUE_STOPS`), which show the colours they set; the card's hairline, which is an edge rather than a state; and a large square's glow, amber from the corner of its lights button while its light is on, from 15 % to 40 % with the light's brightness (40 % for a light that has none).

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

**Sliders.** A slider is a 40 px track in the pill colour with a translucent fill: `--m-color` at 38 %, or the accent. A 2 px solid border in the same colour closes the fill. Its label is the icon, the name and the value; a name too long for the track is cut with an ellipsis, so the value always shows whole.

- **Why the border.** The fill alone sits at 1.5 to 2.7:1 against its track, and a translucent accent over that track cannot reach 3:1 and stay translucent. The border carries the value's position instead, at 3.1 to 3.5:1 in light and 4.2 to 9.6:1 in dark.
- **Over a heading**, the overlay is the heading's 36 px with no inset, so its slider is as tall as the heading's controls, and its label is in the text colour, without the heading's capitals and tracking.
- **Gradient sliders** hide the fill. They show a white marker, and a label with a halo in the card colour so that it stays legible.

**Menus** are popovers in the card colour, under their anchor and aligned with its end edge. Rows are 36 px, and the selected one is in the primary colour.

## Tooltips

An icon with no text beside it (a chip, a round button, a chevron, a glance) explains itself in a tooltip of the cards' own, not the browser's `title`: one `mnml-tooltip`, drawn in the top layer so it shows over pop-ups. It opens 400 ms after the pointer rests on the element, at once when the pointer moves to a neighbour, on keyboard focus, and for a touch held 500 ms, which then does not act; a shorter touch acts and shows no tooltip. It sits above the element, below when there is no room, kept inside the screen, and closes when the pointer leaves, on a press, on a scroll, on Escape, and when a redraw takes its element away. The first line is the name, in bold; the lines after it are the details, such as the batteries a chip counts. Text that a label already shows beside its icon gets none. A tooltip is not a name: a glance that acts is a `button` named with what its tooltip says, its value included (`aria-label`), and the car plan's drawing is an image named with its parts' states.

## Feedback

| Input     | Feedback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pointer   | One overlay washes every interactive surface (the tile, the button card, a linking item row, a glance, any control that is not inert, a header's round button, a fold's chevron): a `::before` behind the content, an 8 % mix of the text colour (`--m-hover`), clear at rest and fading in over 120 ms, so it reads the same over a card, a pill or a filled control and leaves the surface's own shadows alone. It sits behind `@media (hover: hover)`, and reduced motion turns the fade off. The tile washes wherever the pointer is on it, its item row and that row's controls included, and a surface inside it adds its own on top; a row keeps its wash while one of its controls is hovered, so a pointer crossing it changes nothing but the control it is on. A press washes only the surface pressed. A menu item and a select ease their hover colour in over the same 120 ms |
| Touch     | The same wash from `:active`, on the tile (except while one of its own controls is pressed) and on a linking pill. Every other control scales to 0.94. A tap is always acknowledged. On a phone with Home Assistant's app, a toggle also gives a light tap, a slider's value a selection tick, and a call that fails a failure buzz, Home Assistant's own haptics                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Keyboard  | A 2 px `--primary-color` outline, from one `:focus-visible` rule in `BASE_STYLE`. Tiles and pills take Enter or Space; a slider takes the arrow keys, Home and End, the arrow toward the end of the line raising it. HA's own surfaces follow `ha-color-focus`, which the theme spells                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Selection | What is pressed cannot be selected: a button, anything with `role="button"`, a linking row and a folding heading, from one rule in `BASE_STYLE`. So clicks in quick succession select no text. Values, rows that only read and a message's text stay selectable, for copying                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Adapting to the user's settings

Two media queries adapt the design rather than decorate it:

- **`prefers-contrast: more`** takes the hairline to a 50 % mix of the text colour (3.0:1 in light, 4.7:1 in dark), and the slider fill's border to 3 px.
- **`forced-colors: active`** replaces what that mode destroys. The mode drops `box-shadow`, which is how the hairline is drawn, and forces every background. So:
  - the hairline becomes a real `CanvasText` border, and so do the menu's edge and a list bar's track;
  - the slider fill and a list bar's fill become `Highlight`;
  - the gradient sliders show their fill again;
  - their markers become `CanvasText`.
- **`prefers-reduced-motion: reduce`** turns every animation and transition off (see [Motion](cards.md#motion)).

## The reading direction

The cards follow the page's reading direction, which Home Assistant sets on the document (`dir`) from the profile's language. In a right-to-left language the whole layout mirrors: a heading's title is at the right and its trail at the left, a row's controls at the left, the IP of a client row at the left.

- **The styles name no side.** Every margin, padding, inset, border and alignment of the cards is logical (`margin-inline-start`, `inset-inline`, `text-align: start`), so the browser mirrors it. `src/cards/styles.test.ts` fails on a physical side (`left`, `right`, an uneven four-value shorthand) in a card's styles.
- **What reads the direction in script.** `rightToLeft()` (`src/ha/direction.ts`) walks up to the nearest `dir`, through the shadow roots, for what a style cannot mirror:
  - the header's back arrow points right;
  - a slider fills from the right, its white and hue gradients run from the right, a press sets the value from the right edge, and the left arrow raises it (up and down keep their meaning);
  - a menu hangs from its anchor's left edge;
  - one pop-up to another slides the other way: in from the left on opening, from the right going back.
- **What does not mirror.** Numbers, times and dates read as `Intl` writes them for the language. The media card's transport keeps previous, play and next from left to right, as players do in every language. The car plan is a picture of a car, so its parts and tyre labels keep their places. Measured geometry stays physical: an unfolded pop-up grows from the side of its origin nearer the window's edge, and a tooltip centres over its element.

## Motion, in one rule

Motion is confined to what the cards own the lifecycle of: a pop-up, a menu and an overlay animate in, a pop-up animates out, and press feedback transitions. State that arrives with `hass` never animates. [How the cards work](cards.md#motion) has the timings.

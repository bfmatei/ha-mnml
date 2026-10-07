# How the cards work

The runtime behaviour of the custom elements in `src/cards/`. For every key they take, see [Writing the cards](keys.md); for what they look like, [Design](design.md); for the data three of them read, [Data](data.md).

The cards are Lit elements, as Home Assistant's frontend is. Lit is their one dependency, bundled with them. Each card draws its DOM as an `html` template; what several cards share is in `src/cards/parts/`, and what reads or draws Home Assistant's own pieces in `src/ha/`.

## The cards

| Card                 | Shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mnml-tile-card`     | A room, person, car or infrastructure system: a `name` and `icon`, or an `entity` to take them from (the name its device's with `label`), `state`, `chips`, an `item` row, `problems`; opens `popup`. `problems.batteries` turn the dot orange under 20 % and red under 5 % (`BATTERY_LOW`, `BATTERY_CRITICAL`)                                                                                                                                                                                                                                                                                                                                                                                  |
| `mnml-entity-card`   | An item: the `entity`'s name (its device's with `label`) and state icon, a `state` line, `controls`, a `popup`; nested `items` collapse                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `mnml-header-card`   | A pop-up header: a `name` and `icon`, or the `entity`'s (the name its device's with `label`), the `entity`'s `state` and `controls`, `back` and close buttons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `mnml-heading-card`  | A section heading: `title` and `icon`, with a `state` line and `controls` at the right                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `mnml-list-card`     | Rows under a `title`: bars, thresholds under (`low`, `critical`) and over (`high`, `critical_high`), a share `of` another entity, relative times, `words`, flags, a daily total read as zero while it has no value (`zero_when_empty`), or a table with `headers`. `lowest_first` orders the rows by value; `fold` folds the list to its heading until a row is orange or red; `summary` puts the lowest or highest value, or a column's sum, in the heading                                                                                                                                                                                                                                     |
| `mnml-clients-card`  | The connected clients in the `entity`'s `data` (or the list `attribute` names; `fields` maps another source's field names, see [Data](data.md#the-clients-card)), grouped by the `networks`' subnets in their order, then Other: the connection type's icon, the name with its FQDN from the optional `names` sensor's reverse lookups and hosts file, and the IP. With `fold`, each network folds to its heading and count, and Other stays open                                                                                                                                                                                                                                                |
| `mnml-agenda-card`   | The `sources`' calendar events, from today on, under week headings ("This week", "Next week", "Week of 19 Oct"), only for weeks that have something: it starts with the first, Next adds the next one below however far ahead, and Back to now returns to the first. A Next that finds nothing within a year says "Nothing until" that date, and the next Next searches the year after. An `episodes` source splits Sonarr's "Series - S01E04 - Title" into the series and "S01E04 • Title", and folds a series' episodes on one day into one row; a `movies` source shows the title. Each row has its kind's icon and the day. A calendar unavailable, or failing to answer, is named in orange |
| `mnml-messages-card` | The messages in the `entity`'s `messages` attribute, newest first, one item card each: an envelope coloured by the severity (red for `error`, orange for `warning`, blue for `notice` and `info`, grey for any other), the title, the source named by `sources` and the relative time, the text collapsed until the row is tapped, and a clear button that runs the `clear` script                                                                                                                                                                                                                                                                                                               |
| `mnml-button-card`   | A button that calls `service` on `entity`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `mnml-select-card`   | A dropdown over a `select` entity, a climate `attribute` (`hvac_modes`, `preset_modes`, `fan_modes`, `swing_modes`, `swing_horizontal_modes`) or `scenes`, checking the one `active_scene` names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `mnml-slider-card`   | A slider: a light's brightness, white temperature or hue, a climate target, a `number`, a volume                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `mnml-media-card`    | A media player: artwork, title, transport controls, volume, on / off; opens `popup`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `mnml-car-plan-card` | The car from above: `doors`, `hood`, `tailgate`, `windows`, `sunroof`, `tyres` with `tyre_targets`, `tyre_low_share` and `tyre_warn_share`. A part reads as open while its state is one of `open_states` (default `on`, `open`) and half open while it is one of `half_states` (default `intermediate`)                                                                                                                                                                                                                                                                                                                                                                                          |
| `mnml-template-card` | A template expanded in place, the home's own or MNML's with the home's changes, filled by area or by hand ([Templates](templates.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `mnml-popups-card`   | The shell holding every pop-up, opened by the URL hash                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

A **control** in `chips` or `controls` is one of the following:

| Control     | Is                                                                                    |
| ----------- | ------------------------------------------------------------------------------------- |
| `toggle`    | A toggling button; `primary: true` fills it                                           |
| `slider`    | A button that opens a slider over the card                                            |
| `select`    | An icon that opens a mode menu; `primary: true` fills it (the AC's mode button)       |
| `service`   | A button that calls a service                                                         |
| `nav`       | A coloured icon that opens a pop-up                                                   |
| `indicator` | A coloured icon, titled with its entity's name and state                              |
| `status`    | A named icon, coloured by the first of its `rules` that any of its `entities` matches |
| `tyres`     | The tyre icon: orange while a tyre drops, red while one is low                        |
| `scenes`    | An icon that opens the room's scenes, the active one checked                          |

- **Visibility and colour.** `show` hides a control by a state rule, and `when` decides its colour. A rule's `is` / `not` lists match the state lower-cased with hyphens removed, and a number as a number (`10000.0` is `10000`).
- **Unavailable devices.** An unavailable entity keeps its place and turns orange: a state prints as an orange "—", a row or chip colours, and a control that acts on it (`toggle`, `slider`, `select`, `service`) is drawn as an inert orange display rather than a button that cannot work. An entity with no value at all (`unknown`) is left out. A list row with `zero_when_empty` is the exception to both: it reads as `0` in its unit, uncoloured.
- **State lines.** An entry of a `state` line is an entity's state, an `attribute`, a literal `text`, the `minutes` of a seconds counter, the `serial` number of the entity's device, or the entity's `name`. `icon: true` puts the entity's icon in front of it.

[Writing the cards](keys.md) lists every key, and `src/contract/cards.ts` declares them.

## Lifecycle of a card

Every card but the pop-up shell and the template card extends `MnmlCard<C>` (`base.ts`), a `LitElement`. Each card is a shadow root holding its styles and what its `draw(hass, config)` returns. Each card is the `Host` it gives every part it draws: the current `hass`, `hold()`, `register()`, and `notify()`, which shows a message as Home Assistant's own toast.

| Step          | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setConfig()` | Checks the keys against the card's schema, then runs its `validate()`, which throws for a missing required key or a value outside its list (`requireString()`, `requireOneOf()` and the rest in `base.ts`); either way HA shows an error card naming it. It drains the holds and teardowns, stores the configuration, collects every entity id in it (any string shaped `domain.object_id`, except a `service`, which has the same shape), and asks for an update |
| `set hass`    | Asks for an update only when one of those state objects, `hass.entities`, `hass.devices` or `hass.locale` is a new object. While a hold is open no update runs (`shouldUpdate()`), and the last release asks for one                                                                                                                                                                                                                                              |
| `draw()`      | Returns the card as an `html` template, which Lit lays over the DOM already there, so an element that stays keeps its keyboard focus. It may return `undefined`: the card then hides its own element, so an empty card takes no space and no gap in a pop-up's column                                                                                                                                                                                             |
| disconnected  | `disconnectedCallback()` drains the holds and teardowns. A card taken down by a closing pop-up keeps its configuration and its DOM, and comes back live: the next `hass` that changes what it watches draws it again                                                                                                                                                                                                                                              |

State reaches a card through `set hass` only.

### Holds and teardowns

An interaction that a state update must not interrupt **holds** the card (`host.hold()`):

- **A slider**, for the drag, and until 600 ms after its service call has actually landed. A 5 s ceiling keeps a hung call from holding the card for ever.
- **An overlay**, or **a menu**, while it is open. Both open through `dismissable()` (`parts/overlay.ts`), which holds the card, registers the teardown, and closes on a tap outside or on Escape, and a menu on a scroll outside too. It puts focus back on the trigger before it releases the card, so the update that follows leaves focus there.

A press is not a hold. The button card's 600 ms flash is a state of the element (`pressed`), so the state that the press changes draws at once and the flash carries over.

The hold machinery is built so that it cannot get stuck:

- A hold releases once, however often its release is called.
- A drag settles on `lostpointercapture` as well as on `pointerup` and `pointercancel`. So removing the track mid-drag cannot leave a hold open.
- `register(teardown)` records what to undo: the open menu, the open overlay. `disconnectedCallback()` and `setConfig()` both drain it, zero the holds, and bump a generation counter, so that a release issued before the drain cannot decrement the new count.

The result is that a card torn down by a closing pop-up leaks no listener, cannot drive its hold count negative, and comes back live.

### Stylesheets

A card's styles are `css` values, listed in its static `styles`: the shared ones from `styles.ts` (`BASE_STYLE`, `HEADING_STYLE`, `ROW_STYLE`, `CONTROL_STYLE`, `MOTION_STYLE`), a part's from its module, and the card's own from its file. `ITEM_STYLE` in `parts/item.ts`, for example, is shared by the entity, tile, header and media cards.

- **Adopted, not inlined.** Lit makes one constructible stylesheet of each `css` value, and every element that lists it adopts that one.
- **Why:** a full render has a few hundred cards. Adopting parses about 50 KB of CSS between them, where a `<style>` per card parses more than a megabyte.
- **Fallback:** a browser without constructible stylesheets gets a `<style>` per element.
- **Shared values are custom properties.** A colour several styles share is a custom property on `BASE_STYLE`'s `:host` (`--m-pill`, `--m-hover`, `--m-edge`, `--m-edge-strong`), not a value spliced into each template, so every `css` template is a plain literal, which the build minifies.

## Reading state and calling services

A card reads `hass.states`, `hass.entities`, `hass.devices` and `hass.locale`, and nothing else of HA's object. A service call at click time reads the host's current `hass`, not the one the button was drawn with.

- **Readers** (`src/ha/hass.ts`): `stateOf`, `hasValue`, `isOn`, `numericState`, `numberAttribute`, `stringAttribute`, `listAttribute`.
- **Services:** `callService(hass, entityId, 'domain.service', data)`, and `toggleEntity()`, which calls `lock.lock` / `lock.unlock`, `climate.turn_on` / `climate.turn_off`, or else `homeassistant.toggle`.
- **`ServiceName`** is a closed union, so a typo is a compile error rather than a call that fails at runtime. A new service is added to it.
- **Errors reach the user.** Every call is wrapped in `run(host, promise)`, so a rejection becomes HA's own `hass-notification` toast rather than an unhandled rejection in the console.

## Names, formatting and icons

**Names** (`src/ha/names.ts`):

- `entityName()` is `hass.entities[id].name`. Failing that, it is the friendly name without the device name HA prefixes for `has_entity_name` entities. An empty name, HA's "Use device name", counts as none, so the entity prints its device's name.
- `nameOf()` applies a card's naming options:
  - `label: 'device'` names a row, an item or a header after its device (`name_by_user`, then `name`);
  - `strip` removes a literal suffix;
  - `strip_word` removes a word, with its optional plural and leading space, wherever it falls.
- `deviceSerial()` reads the device's `serial_number`.

**Formatting** is HA's own:

- `hass.formatEntityState()` gives precision, unit and translation.
- `hass.formatEntityAttributeValue()` has a fallback that capitalises a raw word HA does not translate, such as a swing mode.
- A timestamp is `ha-relative-time`.

The text the cards write themselves, all in English:

- the `words` dictionaries, and the minutes of a seconds counter (`minutes: true`);
- the car plan's captions (`Hood`, `Tailgate`, `Sunroof`, the corner names), its summary (`All closed`, `One tyre low`, `2 tyres dropping`) and the `—` for a missing or unavailable value (`DASH` in `src/ha/format.ts`), which a table cell and every unavailable entity share;
- the tyres chip's titles (`Tyres`, `Tyre pressure dropping`, `Tyre pressure low`);
- the messages card's `No notifications`;
- the clients card's `No clients`, and its `Other` and `Clients` headings;
- the list card's summaries, `Lowest ...` and `Highest ...`, and a table's header before its sum;
- the labels of the buttons that have no entity: `Back`, `Close`, `Reset ...`, `Clear ...`, `...: choose`, `Show the lights of ...` / `Hide ...`, and the media card's `Previous`, `Play` / `Pause`, `Next` and `Volume`.

**The state line** (`stateLine()` in `src/ha/format.ts`) is one `span` per shown item, separated by `•`:

- Each span is an inline flex box that centres the icon on the text. Its text sits in a `.value` box of its own, so a part wider than its line, as in a tile at half a narrow section, ends in an ellipsis rather than a clipped glyph.
- `vertical-align: top` keeps its baseline the line's.
- The icon's `line-height` is 0, so that `ha-icon`'s inline strut doesn't push it below the text.
- Every item follows its `when` rule, a `text` included, so a line can read "None" while a count is 0 and the count otherwise.

**Icons** are HA's elements:

- `ha-state-icon` for an entity.
- `ha-attribute-icon` for a preset or swing mode.
- `ha-icon` for a literal.
- The HVAC modes are the exception: they use `HVAC_ICONS` (`parts/menu.ts`, HA's own icons for them). `ha-attribute-icon` has none, and an entity's custom icon would override the state icons.

## Rules

**Unknown keys are errors.** A key a card does not know, at any depth it checks, makes it an error card that names the key and its path (`unknown key: rows[1].lowes`). The layout keys Home Assistant and card-mod add (`grid_options`, `visibility`, `view_layout`, `layout_options`, `card_mod`) are allowed at the top. The cards a pop-up holds are checked by those cards; the shell checks only their `visibility`.

**Sizes.** In a sections view, the button, select, slider and tile cards ask for half a section (6 of its 12 columns), the pop-up shell for 1, and every other card for the full section, each with its own height (`getGridOptions()`). `grid_options` overrides it.

A **`StateRule`** (`is`, `not`) matches the normalised state.

- **Normalising** (`normalise()`) reads a number as a number, so `0.0` is `0`; it lower-cases any other state and removes its hyphens, and reads a missing entity as `unavailable`. The rule's own entries are normalised the same way. So a rule may use the integration's spelling (`SELECTIVE-LOCKED`) or the normalised one (`selectivelocked`), and the same holds for `words` keys.
- **`EntityRule`** reads another `entity`: the current room while the vacuum is `cleaning`, or the mop drying time while the mop drying switch is `on`.
- **`when`** decides a colour, and **`show`** a visibility. A coloured pill, control or header without `when` lights on `on` (`active()` in `src/ha/rules.ts`); a list row without `when` is coloured whenever it is shown, since a flag carries its condition in `show`.
- **A `status` control's `rules`** are tried in order. The first one that any of its `entities` matches colours the chip. The tooltip lists those entities with their states, named and worded as a list row's are: a rule's `label: 'device'` names them after their device, and its `words` renders their raw states.

**No value means no row; unavailable means orange.** `hasValue()` and `isUnavailable()` in `src/ha/hass.ts` split a missing value in two:

- **No value** (`unknown`, `none`, empty): the row or state item is not shown, so nothing hides a missing value by hand. A scene, a button or a sensor the device has not reported yet has nothing to say.
- **`unavailable`**: the device is offline, which is a warning, so the element keeps its place and everything of it that takes a colour is `UNAVAILABLE` (`src/ha/rules.ts`), the orange of [Design](design.md#colour). Where its value would print, an em dash `—` stands (`unavailableValue()` in `src/ha/format.ts`): a `role="img"` glyph whose `aria-label` is HA's own word for the state, so a screen reader hears "Unavailable" rather than "em dash". The dash is the same glyph a table cell and the car plan print for a value that is missing; the colour is what tells the two apart.

Kind by kind, while the entity is `unavailable`:

| Kind                                    | Shows                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A state item                            | Its icon if it has one, then the dash, both orange                                                                                                                                                                                                                                                                                                                                                                                                      |
| A list row, a table cell                | The row stays with its icon, value (the dash) and bar orange; an empty bar. A table row stays while any of its values has a value or is unavailable                                                                                                                                                                                                                                                                                                     |
| A pill, a `nav` or `indicator` chip     | Orange, whatever `when` says (`tint()` in `src/ha/rules.ts`)                                                                                                                                                                                                                                                                                                                                                                                            |
| `toggle`, `slider`, `select`, `service` | Drawn as an inert display in the control's place, orange, titled "Name: Unavailable" (`unavailable()` in `parts/controls.ts`), so the outage is visible where the control lives. With no value they are not drawn at all (`ACTIONS`): a button that cannot work is not offered. A `service` control on a `button` entity is the exception (`pressable()`): a button's state is when it was last pressed, so `unknown` only means never, and it is drawn |
| A `status` chip                         | Its own rules first; when none holds and one of its entities is unavailable, orange, with the tooltip listing those entities the way the rule names them                                                                                                                                                                                                                                                                                                |
| `tyres`                                 | Low and dropping first; otherwise orange while a tyre sensor is unavailable, titled "Tyres: Unavailable"                                                                                                                                                                                                                                                                                                                                                |
| The slider card                         | A disabled track with no fill, its icon and the dash orange, the name in the text colour (the `unavailable` property of `mnml-slider`, `parts/slider.ts`)                                                                                                                                                                                                                                                                                               |
| The select card                         | The row without its menu: pill and dash orange                                                                                                                                                                                                                                                                                                                                                                                                          |
| A tile's problems dot                   | Orange while a leak sensor or battery it watches is unavailable, the tooltip naming an offline device once, however many of its entities it watches                                                                                                                                                                                                                                                                                                     |
| The car plan                            | A tyre label reads the dash in orange; a part's tooltip reads "Unavailable" and the part is not drawn open                                                                                                                                                                                                                                                                                                                                              |
| `nav`, `scenes`, a `serial` item        | As always: navigation works whatever the entity reads, a scenes button is about a set of scenes, and a serial comes from the registry                                                                                                                                                                                                                                                                                                                   |

## Controls, sliders and menus

- **Controls** (`parts/controls.ts`): `renderControls()` draws a lane. `colorStyle()` (`src/ha/templates.ts`) sets `--m-color` to `var(--<color>-color)`, which the `colored` class reads; `tint()` picks the colour from the rule, or orange for an unavailable entity. A toggle also says `aria-pressed` from the rule.
- **Sliders** (`parts/slider.ts`): a slider button opens its slider, an `mnml-slider` element, as an overlay over the card; the slider card draws the same element in place. The overlay closes on its X, the round close button after the slider, which gives the focus back to the slider button, 3 s after the last touch, or on a tap outside.
  - A drag sets the value when it ends.
  - The keyboard uses the arrow keys, Home and End, and commits 500 ms after the last key, or at once when the slider closes before then.
- **Menus** (`parts/menu.ts`) are popovers built with the browser's popover API. `sceneChoice()` turns a `scenes` list into options named and iconed by the scene entities, each calling `scene.turn_on`. Its current option is the scene whose name is the state of the `active_scene` select.
  - A menu is a `role="menu"` of `menuitemradio` items with `aria-checked`, or of plain `menuitem`s when there is no current value, as for scenes with none active. Its trigger carries `aria-haspopup="menu"` and `aria-expanded`.
  - It opens with the current item focused and scrolled to the middle of the menu, so a long list such as 19 scenes shows it. The arrow keys move with wrap-around, Home and End jump, Tab and Escape close it, and a choice, Escape or Tab put focus back on the trigger.
- **Folds** (`section()` with a `Fold`, `parts/section.ts`): the heading of a folding list or clients network is the tap target, and its chevron is a `button` with `aria-expanded`, labelled with the title. A tap toggles the card in place, and the card keeps the choice (`choice`, `choices`) until the page reloads; until then, `open` comes from the card's own rule.
- **Escape closes one layer.** A menu or an overlay consumes its Escape (`preventDefault()`), so the dialog's close watcher doesn't close the pop-up underneath in the same keystroke.

## Navigation

Navigation is HA's own mechanism (`src/ha/navigation.ts`), and **the URL is the only state a pop-up has.**

- `navigate(hash)` pushes the hash with a `depth` in its state, one more than the pop-up it was opened from, and dispatches `location-changed`.
- `closePopup()` goes back `depth` entries, to the view's own entry, so a closed pop-up leaves nothing in history and the browser's back button leaves the dashboard. A pop-up that `navigate()` did not open, from a link or a reload, has no depth: it replaces its entry with the URL minus its hash, keeping HA's root marker.
- `back()` goes back one entry from a pop-up opened from another one, and closes it otherwise.

**Links.** `linkTo()` (`parts/item.ts`) makes a row and its pill a way into a pop-up: an item with a `popup`, and the media card with one.

- Both build the pop-up ahead on `pointerdown` (`prebuild()`) and open it on click, and both stop the event, so a link inside a tile doesn't also open the tile's pop-up.
- The pill is the keyboard path (`onPress()`, Enter or Space), labelled with the row's name.
- The row's own controls stop their taps, so the media card's transport, volume and power buttons work without opening anything.

## The pop-up shell

Every pop-up of the dashboard lives in one `mnml-popups-card` (`cards/popups.ts`).

**Why one shell.**

- It draws no state of its own, so it is not a `MnmlCard`: it watches no entity, and draws again only when the hash opens, changes or closes a pop-up, while its children get each `hass` from it directly. A `MnmlCard` would watch every entity its pop-ups name.
- One shell costs three window listeners and one route callback per hash change, however many pop-ups there are. That keeps a second view affordable: duplicating one card doesn't multiply anything.
- It asks for one grid column, the smallest span, and its host has no height, so it takes one zero-height grid row. `width` is the dialog's width on a wide screen.

**A real `<dialog>`.** It opens with `showModal()`, which gives the top layer (no ancestor can clip it), `::backdrop`, Escape, the focus trap and modal semantics for free. `cancel` and a click on the backdrop turn into `closePopup()` rather than being handled directly, so the hash stays the single source of truth. The shell never opens or closes itself: it follows the hash.

**Routing waits for the page.** HA configures a card before it inserts it, so `setConfig()` routes only while the element `isConnected`. Otherwise, a dashboard loaded at a URL that already carries a pop-up hash would call `showModal()` on a dialog in no document, which throws. The attempt would already have claimed the hash, so `connectedCallback()` would see nothing to do and the pop-up would never open. Configured while detached, the card waits, and `connectedCallback()` opens it.

**How a pop-up opens.** The shell picks `open`'s choice for the screen: `phone` up to 600 px, `tablet` up to 1024 px, then `desktop`; left out, a sheet on a phone and a dialog elsewhere. The choice is a class on the dialog (`sheet`, `dialog`, `unfold`), so the styles follow the setting rather than a media query.

**Unfold.** A pop-up set to `unfold` opens out of the tile it belongs to, in that tile's place:

- **Where from.** A tap records what it came from: `navigate(hash, from)` keeps the tapped card (`openedFrom(event)` names the card whose shadow root holds the tapped row or chip), and every tile offers itself for its own `popup` each time it draws (`offerOrigin`). A tile that has left the page is no origin, and a pop-up without one opens as a dialog.
- **Its place.** The panel takes the tile's left edge and width, at least 320 px. It grows down from the tile's top, or, with less than 420 px below the tile and more room above, up from the tile's bottom. It scrolls inside when it is taller than the room it has.
- **Its look.** The panel is revealed from the tile's rectangle outward with a clip, in 300 ms, so its text never squashes, and folds back into the tile when it closes. The backdrop is lighter than a dialog's, and the panel has the cards' edge (`--mnml-card-edge-color`) and a shadow. With reduced motion it opens in place without the animation.
- **It stays with its tile.** While it is open, the panel re-measures its tile on every frame and moves when the tile does, so a resize or a late layout carries it along. A pop-up opened from inside it takes over its place and its tile, so Lights inside a room swaps the content without moving.
- **On a page load.** A dashboard loaded at a pop-up's hash has no tap: for that hash, the shell waits up to 600 ms for its tile to offer itself, and until the tile has kept still for 6 frames (at most 1.5 s), since the cards above it are still drawing and moving it. A nested pop-up's row is not on the dashboard after a reload, so it opens as a dialog.

**Pop-ups from other cards.** A template card gives the shell its pop-ups through `parts/popup-registry.ts`: `announce(owner, popups)` while it is connected, `withdraw(owner)` when it leaves. The shell looks a hash up among its own `popups` first, then the announced ones in the order they came, the first owner of a hash keeping it. A hash announced twice, or announced and also in the shell's own `popups`, is a console error, reported once until the announcements change. An announcement re-routes, so a pop-up whose hash is already in the URL opens as soon as its template card announces it.

**Children are built lazily.** A pop-up's cards are arbitrary Lovelace cards, built through HA's `loadCardHelpers().createCardElement()`. So its children are typed only as Lovelace cards (`LovelaceCardConfig`), and the one key of theirs it reads, `visibility`, with the shared `Condition`.

- They are built on open and dropped on close. A tile asks for a build ahead on `pointerdown` (`prebuild()`), so the dialog opens already filled. A link inside the tile (a pill, a row, a `nav` chip) stops that `pointerdown`, so only its own pop-up is built ahead.
- A build in flight is shared: a second request for the same hash, or the open itself, waits for it rather than building again.
- They receive `hass` on every state change.
- **`visibility` is the shell's.** `createCardElement()` returns the bare card, not the `hui-card` wrapper that evaluates `visibility` in a view. So the shell evaluates a child's state conditions itself (`state` or `state_not`, one state or a list), on build and on every `hass`, and sets `hidden` on the card; a hidden child takes no space. A missing entity reads as `unavailable`, as it does for HA. A condition of another kind is an error at `setConfig()` that names its path, rather than a card that never hides.

**Scrolling stays inside.**

- While a pop-up is open, the page behind it doesn't scroll.
- A drag inside content that can scroll, or inside a nested scroller of its own, is left alone.
- A drag on the header, on the backdrop, or inside content that cannot scroll is cancelled rather than passed to the page.

## Motion

Motion is short, and only where something appears or leaves (`src/ha/motion.ts`, `MOTION_STYLE`):

| What                  | Enters                                           | Leaves                                                 |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Backdrop              | fades in (`mnml-fade`, 140 ms)                   | fades out with the dialog (`dialog.leaving::backdrop`) |
| Pop-up, wide screen   | rises (`mnml-rise`, 160 ms)                      | a 6 px fade over `FADE_LEAVE`                          |
| Pop-up, narrow screen | slides up from the bottom (`mnml-sheet`, 220 ms) | slides back to `translateY(100%)` over `SHEET_LEAVE`   |
| Scenes menu           | rises (140 ms)                                   | none                                                   |

- **Leaving is animated.** A CSS animation cannot do this for an element about to be removed. So `shut()` runs the leaving keyframes through the Web Animations API (`leave()`) and closes the dialog when they finish.
- **The dialog draws no focus ring.** `showModal()` focuses the dialog itself, which fills the viewport, so its ring would frame the whole page; a Tab moves on to its first control, which draws its own.
- **One pop-up to another keeps the dialog.** Routing from an open pop-up to another replaces only the panel inside the open dialog, so its backdrop stays as it is rather than fading out under a new one fading in.
- **One breakpoint.** `SHEET` is a single constant, read by the `@media` block and by `narrow()`, so the layout and the animation cannot disagree.
- **Reduced motion.** `reduced()` skips all of it and closes at once. `MOTION_STYLE` turns every animation and transition off under `prefers-reduced-motion: reduce`.
- **Only there.** Only what the cards build and remove animates: pop-ups, menus, slider overlays and press feedback. **A value never animates:** no transition sits on a value, a fill or a state's colour, so a slider's fill follows the finger exactly during a drag, and arrives instantly from the state.

## The YAML writer

`src/contract/yaml.ts`, the writer of `build()`'s dashboard and the demo's package, single-quotes, wherever they appear, both as values and as mapping keys:

- the YAML 1.1 booleans (`on`, `off`, `yes`, `no`);
- sexagesimals (`3:1`).

That keeps them strings in HA's YAML 1.1 loader: a `words` key of `on` would otherwise load as `true` and never match. The writer also quotes whatever else needs it, a hex colour for one. A configuration written by hand, or by another generator, needs the same care: quote `'on'` and `'off'` where they are strings. A string that needs no quotes stays plain.

## What Home Assistant's frontend provides

What the cards take from HA's frontend, which only the live instance can confirm; the first suspects when something reported from it looks wrong.

- **Formatting.** `hass.formatEntityState()` and `hass.formatEntityAttributeValue()` give precision, units, translations and the brightness in percent. So a sensor with no display precision shows every decimal it reports; set one in the entity's settings. The car plan formats the tyre pressures itself, and reads the same setting (`display_precision` in `hass.entities`). A utility meter with no value shows "—".
- **The registries.** `hass.entities` and `hass.devices` provide the names, and the `serial_number` a `serial` entry prints. An entry whose device has none prints nothing.
- **Locale.** `hass.locale` becomes a new object when the profile's language changes.
- **Icons and time.** `ha-state-icon` follows the state. `ha-attribute-icon` knows the preset and swing modes it knows; a swing mode it has no icon for shows none. `ha-relative-time` renders timestamps.
- **Pop-up plumbing.**
  - `loadCardHelpers().createCardElement()` returns the bare card, not a `hui-card`. So the shell passes `hass` to a card inside a pop-up and evaluates its `visibility` itself, and so does the template card for the card it draws.
  - `location-changed` reaches the pop-up shell.
  - `history.state` holds HA's root marker.
  - `show_header: false` leaves a drag strip and no header.
  - The map card's height comes from `aspect_ratio` inside a pop-up.
- **Template families.** The template card fetches the shipped families, `mnml-cards-<family>.json`, from beside the bundle: their URLs resolve against the bundle's own (`import.meta.url`), so they come from wherever the bundle is served (the integration's `/mnml-files/`), and a family's `?v=` comes from the bundle.
- **Templates.** The template card subscribes to the integration's store with `mnml/templates/subscribe` ([Where templates live](templates.md#where-templates-live)). The MNML panel draws its preview with `loadCardHelpers()`, which Home Assistant defines only once its Lovelace module has loaded; on the panel's page that module is loaded through `partial-panel-resolver`'s `_getRoutes()`, which is not a promised API. A frontend without it leaves the preview saying it cannot draw, and the rest of the panel works. Discovery reads `hass.areas`, `hass.devices` and `hass.entities`, the last with `platform`, `translation_key` and `entity_category`.
- **Browser APIs.** The popover API, for the menus. And `lostpointercapture` firing at a capture target that was removed from the document: that is what settles a drag when the slider overlay closes under a held pointer, and it is the one thing between that and a hold that never releases.
- **Dark mode.** A theme's `modes`, the MNML theme's included, follow the operating system through each profile's dark mode setting (Auto), not through the theme.

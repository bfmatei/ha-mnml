# Writing the cards

Every key each card takes, for a dashboard written in YAML. `src/contract/cards.ts` declares the same keys as TypeScript types. For what the cards do with them, see [How the cards work](cards.md).

- **Errors.** A key a card does not know makes it an error card that names the key and its path (`unknown key: rows[1].lowes`). So does a missing required key, or a value outside its list (`slider must be one of brightness, ...`).
- **Values.** An entity id is `domain.object_id`, an icon `mdi:<name>`, a pop-up a hash (`'#kitchen'`, quoted, since `#` starts a YAML comment), a colour one of `red`, `orange`, `amber` and `blue` ([Design](design.md#colour)). A flag is `true`, or left out.
- **Layout keys.** Every card also takes Home Assistant's `grid_options`, `visibility`, `view_layout` and `layout_options`, and card-mod's `card_mod`, at its top.
- **Quoting.** Write `'on'` and `'off'` in quotes where they are strings, as `words` keys or rule states: unquoted, Home Assistant's YAML reads them as booleans.

## Shared parts

### Rules

A **state rule** matches a state, lower-cased with its hyphens removed, and a number as a number: `is` lists the states it holds in, `not` the states it does not. An **entity rule** is a state rule with an `entity`, so that it reads another entity than the one it sits on.

- `when`, a state rule, decides a colour: the control, pill or row takes its `color` while the rule holds. Without `when`, a control, pill or header lights while its entity is `on`, and a row whenever it is shown.
- `show`, an entity rule, decides whether a control or a row is drawn at all.

### A state line (`state`)

A list of entries, printed with `•` between them:

| Entry                         | Prints                                         |
| ----------------------------- | ---------------------------------------------- |
| `entity`                      | the entity's state, as Home Assistant words it |
| `entity`, `attribute: <name>` | an attribute's value                           |
| `entity`, `minutes: true`     | a counter of seconds, in minutes               |
| `entity`, `relative: true`    | a timestamp, as a relative time (3 hours ago)  |
| `entity`, `serial: true`      | the serial number of the entity's device       |
| `entity`, `name: true`        | the entity's name                              |
| `text: <words>`               | the words                                      |

In a card that has an entity of its own (an item, a header, a tile), an entry's `entity` may be left out. `icon: true` puts the entity's icon in front of a state, an attribute, minutes or a relative time. Every entry takes `when`, an entity rule, and is printed only while it holds.

### Controls (`controls`, `chips`)

A list of controls, each with a `type`:

| `type`      | Required                                                                    | Optional                                                     |
| ----------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `toggle`    | `entity`                                                                    | `icon`, `color`, `when`, `primary`                           |
| `slider`    | `entity`, `slider` (a kind, below), `name`, `icon`                          | `color`                                                      |
| `select`    | `entity` (a `select` or a `climate`)                                        | `attribute` (a mode list, below), `color`, `when`, `primary` |
| `service`   | `entity`, `service` (`domain.service`), `name`, `icon`                      | `primary`                                                    |
| `nav`       | `entity`, `popup`                                                           | `color`, `when`                                              |
| `indicator` | `entity`, `color`                                                           |                                                              |
| `status`    | `name`, `icon`, `silent`, `rules`                                           |                                                              |
| `tyres`     | `tyres`, `targets` (four sensors each), `low_share`, `warn_share`, `silent` |                                                              |
| `scenes`    | `scenes` (scene entities), `name`, `icon`                                   | `active_scene` (a select whose state names the active scene) |

- Every control takes `show`. `primary: true` marks the control as the card's main one: brighter than the others, and filled in a tile chip.
- A `status` control's `rules` are tried in order, and the first that any of its `entities` matches colours it. Each rule has `entities`, `color` and `is`, `not`, `below` (the entities under a number) or `within_days` (the entities whose state is a timestamp that many days off or less, or already past, which flags a key about to expire), and may add `label: device` and `words` for the tooltip. An unavailable entity is orange, unless a rule's `is` names `unavailable`, which gives it that rule's colour. A `silent` status control is drawn only while a rule holds or an entity is unavailable, and so is a `silent` tyres control, only while a tyre is dropping or low or a sensor is unavailable.
- Four sensors are listed front left, front right, rear left, rear right. A tyre is orange under `warn_share` of its target and red under `low_share`.
- The slider kinds are `brightness`, `color_temp` and `hue` for a light, `temperature` for a climate unit, `value` for a `number` or `input_number`, `volume` for a media player, `position` for a cover, `percentage` for a fan, and `humidity` for a humidifier.
- The mode lists are `hvac_modes`, `preset_modes`, `fan_modes`, `swing_modes` and `swing_horizontal_modes`.

### An item (`item`, `items`)

A row for one entity: `entity` (required); `name`, or `label: device` for its device's name, and `strip_word` to drop a word from it; `icon`; `color` and `when`; a `state` line; a `popup` the row opens; `controls`.

## The cards

Every card with keys but the pop-ups card is also edited in a form in Home Assistant's card editor, which writes these same keys: [Editing in the UI](editors.md).

### `mnml-heading-card`

A section heading. `title` and `icon` (required); a `state` line and `controls` at the right.

### `mnml-list-card`

Rows under a heading: `rows` (required), with `title` and `icon` for the heading.

| Key            | Does                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| `lowest_first` | orders the rows by value, lowest first                                                   |
| `fold`         | folds the list to its heading until a row is orange or red                               |
| `summary`      | `lowest` or `highest` puts that value in the heading; `{ sum: <column> }` a column's sum |
| `headers`      | makes the list a table: the name column's header, then one per value column              |

A row has `entity` (required), and:

| Key                     | Does                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `name`, `label: device` | names the row, or names it after its device                                                      |
| `strip`                 | removes a suffix from the name                                                                   |
| `words`                 | words the raw states: `{ 'on': Open, 'off': Closed }`                                            |
| `relative`              | prints a timestamp as a relative time                                                            |
| `zero_when_empty`       | reads a total with no value yet as 0 in its unit, uncoloured                                     |
| `flag`                  | prints no value: the row is the signal, shown by `show` and coloured by `color`                  |
| `bar`                   | draws a bar of the value, out of 100                                                             |
| `of`                    | prints the value as a share of another entity in the same unit; in a table, the row's last value |
| `low`, `critical`       | orange under `low`, red under `critical`, in the entity's unit                                   |
| `low_only`              | draws the row only while its value is under `low`                                                |
| `high`, `critical_high` | orange over `high`, red over `critical_high`                                                     |
| `reset`                 | a `button` entity, pressed by a reset button at the end of the row                               |
| `color`, `when`, `show` | the row's colour and whether it is shown                                                         |
| `values`                | in a table, the entities of the value columns                                                    |

### `mnml-agenda-card`

Upcoming calendar events by week. `sources` (required): each has `entity`, a calendar, and `kind`, `episodes` (Sonarr's "Series - S01E04 - Title") or `movies`. `title` and `icon` head it.

### `mnml-messages-card`

`entity` (required), a sensor whose `messages` attribute holds the messages, and `clear` (required), the script that clears one ([Data](data.md#the-messages-card)). `sources` names a message's `source`: each entry has `source` and either `entity`, whose device names it, or `name`.

### `mnml-clients-card`

`entity` (required), a sensor whose `data` attribute lists the clients, and `networks` (required): each has `name`, `icon` and `subnet` (`10.0.0.0/24`). `attribute` reads another attribute than `data`, and `fields` maps another source's field names (`name`, `ip_address`, `type`). `names` is a sensor of reverse lookups, and `fold` folds each network to its heading ([Data](data.md#the-clients-card)).

### `mnml-glances-card`

`items` (required), each drawn as a well, in one of two shapes:

- **An entity:** `entity` (required), `name` (the tooltip; no text is drawn for it), `icon` (the entity's own by default), `color` and `when` (the icon and the well take the colour while the entity is in the `when` state, `on` by default), `state` (state items; the entity's state by default), `show` (the glance is drawn only while the entity is in that state), `quiet` (while the entity is not in `when`, no value is drawn and the icon is dimmed), `bare` (no value is drawn, the icon alone), `alert` (the glance is red while the entity is in that state), `people` (person entities: the glance is red while it is on with somebody home, or off with everybody away; `when` says what on is), and `popup` or `toggle`: a tap opens the pop-up, or toggles the entity.
- **A count:** `entities` and `name` (both required; the name is the tooltip), `icon`, `color` (orange by default), `popup` (opened by a tap), and what counts: `is` (the entities in one of these states), `below` (the entities under a number) or `sum` (the total of the entities' numbers, counted while above 0), with `critical`, under which the glance turns red; with `sum`, `critical` is the level at which the first entity turns the glance red, the others leaving it orange. It is drawn only while the count is above 0, and an unavailable entity is not counted.

A tooltip names the item, and a count's lists what it counts with each value. The items fall into two groups: the calm statuses on the left, the entity items without `show`; and what needs you on the right, set apart by a hairline, the entity items with `show` and the counts. A critical count fades in once when it is drawn, unless the reader prefers reduced motion. The wells wrap onto a second row rather than scroll. The card is not drawn while none of its items is.

### `mnml-report-card`

`entity` (required), a sensor whose `details` attribute holds a text report, `title` and `icon` for the heading, and `colors`, a colour for each kind of headline (`{ warnings: orange }`; red otherwise). The card is not drawn while the report has no entries. [Data](data.md#the-report-card) has the format.

### `mnml-weather-card`

`entity` (required, a `weather` entity) and `title` for the heading. The conditions now come from the entity's attributes, each drawn only when the entity has it, and the forecast from Home Assistant's `weather/subscribe_forecast`: up to seven days when the entity supports a daily forecast, up to eight hours when it only supports an hourly one, and none when it has no forecast.

### `mnml-button-card`

`entity` and `service` (required): a button that calls the service on the entity.

### `mnml-select-card`

A dropdown, in one of two forms:

- over an entity: `entity` (required), a `select` or a `climate`, with `attribute`, a mode list, for a climate; `name` and `icon`;
- over scenes: `scenes` (required), `name` and `icon` (required), and `active_scene`, a select whose state names the active scene.

### `mnml-slider-card`

`entity` and `slider` (required), a slider kind; `name`, `icon` and `color`. `turn_on: true` turns a climate unit on before it sets its target.

### `mnml-entity-card`

An item (above), with `items`, more items that fold under it.

### `mnml-header-card`

A pop-up's header: a `name` and an `icon`, or an `entity` to take them from (`label: device` for its device's name); `color` and `when`; a `state` line and `controls`; `back: true` adds a back button beside the close button.

### `mnml-tile-card`

A tile that opens a pop-up: `popup` (required), and a `name` and an `icon`, or an `entity`, as the header takes them; a `state` line; `chips`, controls; and an `item` row.

### `mnml-media-card`

`entity` (required), a media player, and a `popup` its row opens.

### `mnml-car-plan-card`

The car from above. All required but `sunroof`, `open_states`, `half_states`, `title` and `icon`:

| Key                                 | Is                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `doors`                             | four binary sensors                                                                        |
| `hood`, `tailgate`                  | binary sensors                                                                             |
| `windows`                           | four sensors; `sunroof`, one                                                               |
| `open_states`, `half_states`        | the states that read as open (default `on`, `open`) and half open (default `intermediate`) |
| `tyres`, `tyre_targets`             | four sensors each, in one unit                                                             |
| `tyre_low_share`, `tyre_warn_share` | a tyre is red under the first share of its target and orange under the second              |

### `mnml-template-card`

A template, drawn in place: `template` (required), the template's name; `area`, an area whose entities fill the slots that have a discovery rule; and `slots`, the slots set by hand. With neither `area` nor `slots`, it discovers in the whole home. [Templates](templates.md) has the language and every shipped template's slots.

### `mnml-popups-card`

Every pop-up of a dashboard, in one card anywhere on it, edited in YAML:

| Key      | Is                                                                                                                                                                                                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`  | required: the dialog's width on a wide screen, in pixels (`560px`); on a phone it is a bottom sheet                                                                                                                                                                                                                                 |
| `open`   | how a pop-up opens on each kind of screen: `phone` (600 px wide and less), `tablet` (up to 1024 px) and `desktop`, each `sheet` (a bottom sheet), `dialog` (centred, `width` wide) or `unfold` (out of the tile it was opened from, in that tile's place and as wide as it). Left out, a phone gets `sheet` and the others `dialog` |
| `popups` | each has a `hash` (`'#kitchen'`), the URL hash that opens it, and its `cards`, any Lovelace cards. Template cards add theirs, so a dashboard of templates leaves it out                                                                                                                                                             |

A pop-up's first card is its header, which stays in place while the rest scrolls. A card in a pop-up takes `visibility`, and the pop-up judges it: a list of state conditions, each with `condition: state`, `entity`, and either `state` or `state_not`, one state or a list. Any other condition is an error that names where it is.

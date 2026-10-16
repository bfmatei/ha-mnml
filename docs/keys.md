# Writing the cards

Every key each card takes, for a dashboard written in YAML. `src/contract/cards.ts` declares the same keys as TypeScript types. For what the cards do with them, see [How the cards work](cards.md).

- **Errors.** A key a card does not know makes it an error card that names the key and its path (`unknown key: rows[1].lowes`). So does a required key that is missing or empty, at any depth (`rows[0].entity is required`), and a value of the wrong kind or outside its list (`slider must be one of brightness, ...`, `controls[1].popup must be a pop-up hash, such as '#kitchen'`), every problem named at once. [How the cards work](cards.md#rules) lists what each kind must be.
- **Values.** An entity id is `domain.object_id`, an icon `mdi:<name>`, a pop-up a hash (`'#kitchen'`, quoted, since `#` starts a YAML comment), a colour one of `red`, `orange`, `amber` and `blue` ([Design](design.md#colour)). A flag is `true`, or left out.
- **Layout keys.** Every card also takes Home Assistant's `grid_options`, `visibility`, `view_layout` and `layout_options`, and card-mod's `card_mod`, at its top.
- **Quoting.** Write `'on'` and `'off'` in quotes where they are strings, as `words` keys or rule states: unquoted, Home Assistant's YAML reads them as booleans.

## Shared parts

### Rules

A **state rule** matches a state, lower-cased with its hyphens removed, and a number as a number: `is` lists the states it holds in, `not` the states it does not. With `attribute`, it matches that attribute's value instead of the state (`{ attribute: alerts, not: ['0'] }`); an attribute the entity lacks, or one that is a list or a mapping, reads as `unknown`, and an entity that is unavailable or missing reads as before. An **entity rule** is a state rule with an `entity`, so that it reads another entity than the one it sits on. A `status` control's rules take no `attribute`.

- `when`, a state rule, decides a colour: the control, pill or row takes its `color` while the rule holds. Without `when`, a control, pill or header lights while its entity is `on`, and a row whenever it is shown.
- `show`, an entity rule, decides whether a control or a row is drawn at all.
- `confirm`, a state rule on a `toggle`, a `service` control or a toggling glance, makes it ask before it acts: while its entity matches the rule, the first press shows what it will do (`Unlock? Tap again`) and only a second press within 3 s acts. `confirm: {}`, a rule with neither list, matches every state, so it always asks; `confirm: { is: [locked] }` on a lock asks before unlocking and locks at once.

### A state line (`state`)

A list of entries, printed with `•` between them:

| Entry                         | Prints                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `entity`                      | the entity's state, as Home Assistant words it                                                                                |
| `entity`, `attribute: <name>` | an attribute's value; with `relative: true`, a timestamp attribute as a relative time (in 6 hours)                            |
| `entity`, `minutes: true`     | a counter of seconds, in minutes                                                                                              |
| `entity`, `relative: true`    | a timestamp, as a relative time (3 hours ago)                                                                                 |
| `entity`, `since: true`       | when the state last changed, as a relative time                                                                               |
| `entity`, `remaining: true`   | a timer's time left (`4:05`, `1:00:00`): counting down while it runs, held while it is paused, and its state while it is idle |
| `entity`, `serial: true`      | the serial number of the entity's device                                                                                      |
| `entity`, `name: true`        | the entity's name                                                                                                             |
| `text: <words>`               | the words                                                                                                                     |

In a card that has an entity of its own (an item, a header, a tile), an entry's `entity` may be left out. `icon: true` puts the entity's icon in front of a state, an attribute, minutes, a relative time, a since or a time left. Every entry takes `when`, an entity rule, and is printed only while it holds.

### Controls (`controls`, `chips`)

A list of controls, each with a `type`:

| `type`      | Required                                                          | Optional                                                                     |
| ----------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `toggle`    | `entity`                                                          | `icon`, `color`, `when`, `confirm`, `primary`                                |
| `slider`    | `entity`, `slider` (a kind, below), `name`, `icon`                | `color`                                                                      |
| `select`    | `entity` (a `select`, a `climate` or a `timer`)                   | `attribute` (a mode list, below), `name`, `icon`, `color`, `when`, `primary` |
| `service`   | `entity`, `service` (`domain.service`), `name`, `icon`            | `primary`, `confirm`                                                         |
| `nav`       | `entity`, `popup`                                                 | `color`, `when`, `controls` (a large square's options, below)                |
| `indicator` | `entity`, `color`                                                 |                                                                              |
| `status`    | `name`, `icon`, `rules`                                           | `silent`                                                                     |
| `tyres`     | `tyres`, `targets` (four sensors each), `low_share`, `warn_share` | `silent`                                                                     |
| `scenes`    | `scenes` (scene entities), `name`, `icon`                         | `active_scene` (a select whose state names the active scene)                 |
| `messages`  | `popup`, `name`, `icon`                                           | `color`                                                                      |
| `dismiss`   | `name`, `icon`                                                    |                                                                              |

- Every control takes `show`. `primary: true` marks the control as the card's main one: brighter than the others, and filled in a tile chip.
- A `status` control's `rules` are tried in order, and the first that any of its `entities` matches colours it. Each rule has `entities`, `color` and `is`, `not`, `below` (the entities under a number) or `within_days` (the entities whose state is a timestamp that many days off or less, or already past, which flags a key about to expire), and may add `label: device` and `words` for the tooltip. An unavailable entity is orange, unless a rule's `is` names `unavailable`, which gives it that rule's colour. A `silent` status control is drawn only while a rule holds or an entity is unavailable, and so is a `silent` tyres control, only while a tyre is dropping or low or a sensor is unavailable.
- Four sensors are listed front left, front right, rear left, rear right. A tyre is orange under `warn_share` of its target and red under `low_share`.
- The slider kinds are `brightness`, `color_temp` and `hue` for a light, `temperature` for a climate unit, `value` for a `number` or `input_number`, `volume` for a media player, `position` for a cover, `percentage` for a fan, and `humidity` for a humidifier.
- The mode lists are `hvac_modes`, `preset_modes`, `fan_modes`, `swing_modes` and `swing_horizontal_modes`, for a climate.
- A `select`'s `name` titles it in place of its entity's name, and its `icon` is drawn while the current option has none, as a fan mode has none.
- A `messages` control is drawn only while Home Assistant has notifications or, for an administrator, repairs, coloured, with their number in its tooltip, and opens `popup`. A `dismiss` control is drawn only while Home Assistant has notifications, and dismisses them all, asking first.
- A `select` on a timer offers the presets set for it in Home Assistant's timer settings, and starts the timer for the one picked; it is not drawn while the timer has none. A timer's other actions are `service` controls: `timer.start`, `timer.pause`, `timer.cancel` and `timer.finish`.

### An item (`item`, `items`)

A row for one entity: `entity` (required); `name`, or `label: device` for its device's name, and `strip_word` to drop a word from it; `icon`; `color` and `when`; a `state` line; a `popup` the row opens; `controls`.

## The cards

Every card with keys but the pop-ups card is also edited in a form in Home Assistant's card editor, which writes these same keys: [Editing in the UI](editors.md).

### `mnml-heading-card`

A section heading. `title` and `icon` (required); a `state` line and `controls` at the right.

### `mnml-list-card`

Rows under a heading: `rows` (required), with `title` and `icon` for the heading. Without `title`, `entity` names the heading with that entity's name from Home Assistant, such as a person's.

| Key             | Does                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `lowest_first`  | orders the rows by value, lowest first, a row without a number last; in a table, by the row's `entity` |
| `highest_first` | orders the rows the same way, highest first; not with `lowest_first`                                   |
| `fold`          | folds the list to its heading until a row is orange or red                                             |
| `summary`       | `lowest` or `highest` puts that value in the heading; `{ sum: <column> }` a column's sum               |
| `headers`       | makes the list a table: the name column's header, then one per value column                            |

A row has `entity` (required), and:

| Key                     | Does                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `label: device` | names the row, or names it after its device; rows that would read the same take their area first                                                                |
| `strip`                 | removes a suffix from the name                                                                                                                                  |
| `words`                 | words the raw states: `{ 'on': Open, 'off': Closed }`                                                                                                           |
| `relative`              | prints a timestamp as a relative time                                                                                                                           |
| `zero_when_empty`       | reads a total with no value yet as 0 in its unit, uncoloured                                                                                                    |
| `flag`                  | prints no value: the row is the signal, shown by `show` and coloured by `color`                                                                                 |
| `bar`                   | draws a bar of the value, out of 100                                                                                                                            |
| `of`                    | prints the value as a share of another entity in the same unit; in a table, the row's last value                                                                |
| `low`, `critical`       | orange under `low`, red under `critical`, in the entity's unit                                                                                                  |
| `low_only`              | draws the row only while its value is under `low`                                                                                                               |
| `high`, `critical_high` | orange over `high`, red over `critical_high`                                                                                                                    |
| `reset`                 | a `button` entity, pressed by a reset button at the end of the row                                                                                              |
| `color`, `when`, `show` | the row's colour and whether it is shown                                                                                                                        |
| `values`                | in a table, the entities of the value columns, `null` for a column the row has no entity for, which shows "—"; outside one, the numbers `summary: { sum }` adds |

### `mnml-agenda-card`

Upcoming calendar events by week. `sources` (required): each has `entity`, a calendar, and `kind`, `episodes` (Sonarr's "Series - S01E04 - Title") or `movies`. `title` and `icon` head it.

### `mnml-messages-card`

Messages, one card each, from one of three feeds, or their count:

- **A sensor:** `entity` (required), a sensor whose `messages` attribute holds the messages, and `clear` (required), the script that clears one ([Data](data.md#the-messages-card)). `sources` names a message's `source`: each entry has `source` and either `entity`, whose device names it, or `name`.
- **Home Assistant's notifications:** `notifications: true`, its persistent notifications, newest first. Clearing one dismisses it.
- **Home Assistant's repairs:** `repairs: true`, its open repairs, most severe first, drawn only for an administrator. A repair is fixed or ignored in Home Assistant's settings, so it has no clear button.
- **Their count:** `popup`, `name` and `icon` (required), and `color`: one row, the number of Home Assistant's notifications and, for an administrator, its repairs, or None, coloured only while there are any, which opens the pop-up.

`notifications`, `repairs` and `popup` take none of the sensor's keys, and not each other.

### `mnml-clients-card`

`entity` (required), a sensor whose `data` attribute lists the clients, and `networks` (required): each has `name`, `icon` and `subnet` (`10.0.0.0/24`). `attribute` reads another attribute than `data`, and `fields` maps another source's field names (`name`, `ip_address`, `type`). `names` is a sensor of reverse lookups, and `fold` folds each network to its heading ([Data](data.md#the-clients-card)).

### `mnml-glances-card`

`items` (required), each drawn as a well, in one of four shapes:

- **An entity:** `entity` (required), `name` (the tooltip; no text is drawn for it), `icon` (the entity's own by default), `color` and `when` (the icon and the well take the colour while the entity is in the `when` state, `on` by default), `state` (state items; the entity's state by default), `show` (the glance is drawn only while the entity is in that state), `quiet` (while the entity is not in `when`, no value is drawn and the icon is dimmed), `calm` (the glance is a status, not a problem: with `show` it is still drawn only while that holds, but it is not drawn as needing you), `bare` (no value is drawn, the icon alone), `alert` (the glance is red while the entity is in that state), `people` (person entities: the glance is red while it is on with somebody home, or off with everybody away; `when` says what on is), and `popup` or `toggle`: a tap opens the pop-up, or toggles the entity; with `toggle`, `confirm` (a rule, above) makes the tap ask first.
- **A count:** `entities` and `name` (both required; the name is the tooltip), `icon`, `color` (orange by default), `show` (an entity rule: the count is drawn only while it holds, reading the first of `entities` unless it names its own `entity`), `popup` (opened by a tap), and what counts: `is` (the entities in one of these states), `not` (the entities in none of these states), `below` (the entities under a number) or `sum` (the total of the entities' numbers, counted while above 0), with `critical`, under which the glance turns red; with `sum`, `critical` is the level at which the first entity turns the glance red, the others leaving it orange. `is` and `not` match the state as a rule's lists do, lower-cased and without hyphens, so `SELECTIVE-LOCKED` is `selectivelocked`. It is drawn only while the count is above 0. An entity that is missing or `unavailable` is never counted; any other state, `unknown` included, is matched as it is, so a `not` count counts an `unknown` entity unless its list names `unknown`, while `below` counts only an entity whose state is a number.
- **A total:** a count with `total: true` and none of `color`, `is`, `not`, `below`, `sum` and `critical`: the sum of the entities that read a number in the unit of the first that does, in that unit, uncoloured, the others left out. Its `icon` is the first entity's by default. It is drawn while one of them reads a number.
- **Home Assistant's messages:** `messages: true` and `name` (both required; the name is the tooltip), `icon`, `color` (orange by default) and `popup` (opened by a tap): the number of Home Assistant's notifications and, for an administrator, its repairs, drawn only while it is above 0, as needing you.

A tooltip names the item, and a count's or a total's lists what it counts with each value, each by its device's name, with its area first when two would read the same. The items fall into two groups: the calm statuses on the left, the entity items without `show` and the totals; and what needs you on the right, set apart by a hairline, the entity items with `show` the other counts and the messages. A critical count fades in once when it is drawn, unless the reader prefers reduced motion. The wells wrap onto a second row rather than scroll. The card is not drawn while none of its items is.

### `mnml-report-card`

`entity` (required), a sensor whose `details` attribute holds a text report, `title` and `icon` for the heading, and `colors`, a colour for each kind of headline (`{ warnings: orange }`; red otherwise). The card is not drawn while the report has no entries. [Data](data.md#the-report-card) has the format.

### `mnml-weather-card`

`entity` (required, a `weather` entity) and `title` for the heading. The conditions now come from the entity's attributes, each drawn only when the entity has it, and the forecast from Home Assistant's `weather/subscribe_forecast`: the daily forecast when the entity supports one, else the twice-daily one, else the hourly one, and none when it supports no forecast; up to seven days, eight half-days or eight hours, a day or a half-day under its day's name and an hour under its time.

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

A pop-up's header: a `name` and an `icon`, or an `entity` to take them from (`label: device` for its device's name); `color` and `when`; a `state` line and `controls`; `back: true` adds a back button beside the close button. `messages: true` ends the state line with the number of Home Assistant's notifications and, for an administrator, its repairs, or None, and colours the header only while there are any, in place of `when`.

### `mnml-tile-card`

A tile that opens a pop-up: `popup` (required), and a `name` and an `icon`, or an `entity`, as the header takes them; a `state` line; `chips`, controls; and an `item` row, an item (above) drawn minified: its icon and its state line on one line, the name being the icon's label, and every one of its `controls`, smaller. The row opens the item's `popup`, where the same item is drawn full size; a slider button opens its slider over the row.

`square: large` or `square: small` draws the tile as a square instead of a row. A large square is the pill; the issues in a strip that hangs from the corner, the coloured `indicator`, `status`, `tyres` and `messages` chips, worst first (red, orange, amber, blue), three at most, the third counting the rest; the name over the first two `state` items, each on its line; and a column of up to three `toggle` and `nav` chips as buttons, two when there is an `item`, whose entity is a button under them: a tap opens its options inside the square, growing to the start from the button: its toggle in the button's place, then a button for each of its brightness, white temperature and colour sliders and its scenes, which makes the square that slider or list; with none of those, a tap toggles it. A `nav` chip's `controls` (`toggle`, `slider`, `select` or `scenes` controls, no other) make its button open options the same way, a button for each `brightness`, `color_temp`, `hue` or `temperature` slider, `scenes` and `select`; a `toggle` of its entity among them is the toggle in the button's place, and without one a `select` of its entity is there, as an AC's mode, since it turns off by its mode. A `nav` chip whose `controls` offer none of those opens its `popup`, as one without `controls` does, and a tile that is not a large square ignores them. While that entity is on, the square glows amber from its corner, as strongly as the light is bright. A small square is the icon in a round well, the name, and a strip of the coloured `indicator`, `status`, `tyres`, `messages`, `toggle` and `nav` chips, worst first, two at most, the second counting the rest; it draws no `state` and no `item`. A square draws no `slider`, `select`, `service`, `scenes` or `dismiss` chip. `trend` draws a sensor's last 24 hours across a large square: `entity` (required), the sensor; `color`, the line's colour while `when` holds (matched as everywhere, `on` by default, against `when.entity` or the trend's own). Without a colour, or while `when` does not hold, the line is the secondary text colour at 60 % opacity ([Design](design.md#sizes)). A tile without `square` and a small square ignore it.

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

A template, drawn in place: `template` (required), the template's name; `device`, a device whose entities fill the slots that have a discovery rule; `area`, an area whose entities fill them; and `slots`, the slots set by hand. With neither `device`, `area` nor `slots`, it discovers in the whole home. On a `device`, discovery looks at that device and the devices linked to it through `via_device` (a vacuum's dock), and the device stands in for an area: `area.name` reads the device's name as Home Assistant shows it, `area.id` that name in lower case with `_` between its words (`roborock_s8`), and the other area values the device's area. With both, `area` places the device: the area values but the name and the id, and the rules that look in the area (`scope: area`), read that area instead of the device's, while every other rule stays on the device. A `device` the home does not have is an error the card shows. The editor writes `device` or `area`, never both. [Templates](templates.md) has the language and every shipped template's slots.

### `mnml-popups-card`

Every pop-up of a dashboard, in one card anywhere on it, edited in YAML:

| Key          | Is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`      | required: the dialog's width on a wide screen, in pixels (`560px`); on a phone it is a bottom sheet                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `open`       | how a pop-up opens on each kind of screen: `phone` (600 px wide and less), `tablet` (up to 1024 px) and `desktop`, each `sheet` (a bottom sheet), `dialog` (centred, `width` wide) or `unfold` (out of what it was opened from, a tile, a row, a chip or a glance, `width` wide whatever that element's width, growing from its edge nearer the window's). Left out, a phone gets `sheet` and the others `dialog`                                                                                                      |
| `idle_close` | seconds: an open pop-up closes after this long without input from the reader, a touch, a key, a scroll or a state change they caused. Left out, a pop-up stays open                                                                                                                                                                                                                                                                                                                                                    |
| `alerts`     | pop-ups that open themselves. Each has `entity` and `popup` (required), a state rule (`is`, `not` and `attribute`, above; `on` by default), and `screens` (`phone`, `tablet`, `desktop`) and `users` (Home Assistant user ids) to limit it. A change into a matching state opens the pop-up; when the state clears, the pop-up closes if the alert opened it and it is still open. A dashboard loaded while an alert already holds opens nothing, and an alert whose hash no pop-up has opens nothing and says so once |
| `popups`     | each has a `hash` (`'#kitchen'`), the URL hash that opens it, and its `cards`, any Lovelace cards. Template cards add theirs, so a dashboard of templates leaves it out                                                                                                                                                                                                                                                                                                                                                |

A pop-up's first card is its header, which stays in place while the rest scrolls. A card in a pop-up takes `visibility`, Home Assistant's conditions, and the pop-up judges it as a view does ([How the cards work](cards.md#the-pop-up-shell)): every condition Home Assistant's editor writes is accepted. A condition that is not a mapping, or a `state`, `screen` or `user` condition without `state` or `state_not`, `media_query` or `users`, is an error that names where it is.

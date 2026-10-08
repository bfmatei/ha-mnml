# Templates

A template is a tile, a pop-up or a part of either, written once and filled for each room, person, car or server. MNML ships one for every card and pop-up of its author's dashboard. They are defaults: use them as they are, fill them by hand, or replace one with your own.

```yaml
type: custom:mnml-template-card
template: room
area: living
```

That one card draws the living room's tile, from what Home Assistant knows about the area, and gives the popups card every pop-up the room opens. A dashboard needs one `custom:mnml-popups-card` somewhere, with only its `width`.

## Placing a template

`custom:mnml-template-card` takes:

| Key        | Is                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `template` | required: the template's name                                                                            |
| `area`     | an area's id: the slots that have a discovery rule are filled from it                                    |
| `slots`    | the slots set by hand. A slot set here replaces discovery for that slot alone; `null` or `[]` means none |

Home Assistant's layout keys (`grid_options`, `visibility`, `view_layout`, `layout_options`, `card_mod`) go beside them, as on any card.

An instance with neither `area` nor `slots` discovers in the whole home: only the rules with `scope: all` find anything. One with `slots` and no `area` discovers nothing, and draws exactly its slots.

A slot is resolved in this order: its value in `slots`; else, when the instance discovers, its discovery rule; else its default; else it stays unfilled, and the parts of the template that read it disappear. A required slot left unfilled, a slot the template does not declare, a slot of an unknown kind, an area Home Assistant does not know, or an unknown template is an error card that names the template and the place. Inside a nested template, the outer template and the place come first: `outer at card.item: inner: the slot entity is required`.

## Writing a template

A template has a `description`, its `slots`, a `card`, optionally the `popups` it brings, and an `example` of its slots. Here it is by its name, as the MNML panel exports it:

```yaml
garden:
  description: The garden's tile and its pop-up.
  slots:
    key: { kind: text, required: true }
    name: { kind: text, required: true, discover: area.name }
    temperature: { kind: entity, discover: { domain: sensor, device_class: temperature } }
  card:
    type: custom:mnml-tile-card
    name: '[[name]]'
    icon: mdi:flower
    popup: '#[[key]]'
    state:
      - entity: '[[temperature]]'
        icon: true
  popups:
    - hash: '#[[key]]'
      cards:
        - type: custom:mnml-header-card
          name: '[[name]]'
          icon: mdi:flower
  example:
    key: garden
    name: Garden
views:
  - ...
```

Templates of the home's own are kept by the integration and built in the MNML panel ([Where templates live](#where-templates-live), [The MNML panel](editors.md#the-mnml-panel)). One with the name of a shipped template replaces it, wherever it is used, inside other templates too; a new name adds one.

**Kinds of slot:** `text`, `texts` (a list of words), `number`, `icon`, `flag` (`true` or absent; `false` counts as absent), `entity`, `entities`, `object` and `objects`. Slot and field names are lower case letters, digits and `_`.

**Fields.** An `object` slot, or an `objects` slot's every element, declares its `fields:`, each a slot of its own with a `kind`, and `required` or a `default`. A field's default fills in when the object lacks it; a field of the wrong kind, a required field left unfilled, or a field the slot does not declare is an error that names the slot and the field, and so is a path such as `[[lights.grup]]` that names no field. A slot without `fields:` takes any object, unchecked.

**Labels.** A slot or a field may carry `label`, its name in the editor (`Air conditioning` for `ac`); `help`, a line under its field; and `group`, the editor's panel it sits in (`Sensors`, `Lights`). Slots without a group sit in Basics when they are simple, and in a panel of their own when they are an `object` or `objects`. Drawing ignores all three.

**In a template's tree:**

- `'[[path]]'` as a whole value inserts the slot with its type: a string, a number, a list, an object. Inside a longer string it is text: `'#[[key]]-lights'`. A path reads into objects and lists: `[[nozzle.temperature]]`, `[[latency.0]]`.
- An unfilled slot removes the key whose value is `'[[slot]]'`, or the list item. A string that interpolates an unfilled slot, or an empty one, is an error, since half a hash is never meant, and so is a `[[...]]` that holds anything but a slot path.
- `each: <list slot>` with `as: <name>` on a list item repeats it for every element, spliced into the list. Inside, `[[name]]` is the element, and the outer slots stay visible.
- `if: <slot>`, or `if: [a, b]` for any of several, keeps an item or a mapping only while the slot is filled: set, and not an empty list or object. `unless:` keeps it only while none is.
- `template: <name>` with `slots:` expands another template in place and gathers its pop-ups; keys beside it are added to what it draws, and win on a clash.
- A key ending in `?` is dropped when its list or map comes out empty. Without the `?`, an empty list stays `[]`.
- In a list, an item that comes out a list is spliced into it: `entities: ['[[doors]]', '[[hood]]']` is one flat list.
- `each`, `as`, `if`, `unless`, `template` and `slots` are reserved, and so is `id` on a list item, which names the part ([Changes to a shipped template](#where-templates-live)) and is left out of what the template draws. Quote `'on'`, `'off'` and strings of digits.

## Where templates live

When two places name the same template, the first of these wins:

1. **The home's own templates,** kept by the integration in `.storage/mnml.templates`.
2. **A shipped template with the home's changes** laid over it, kept there too.
3. **The shipped templates.**

The cards do not read `mnml_templates:` on dashboards; the MNML panel imports what a dashboard still holds there.

**The store.** The integration keeps the home's templates in `.storage/mnml.templates`, each either a whole template of the home's own (`kind: own`) or a list of changes to a shipped one (`kind: changes`), with the time and the user of its last save, and its previous 10 versions. A delete keeps those versions, with the deleted one first, so a template deleted or reset can be brought back. Over the websocket:

- `mnml/templates/subscribe`, for every logged-in user, sends every template, then all of them again after each save and each delete, so a change shows on every open dashboard at once;
- `mnml/templates/save` (`name`, `entry`), `mnml/templates/delete` (`name`) and `mnml/templates/history` (`name`) are for admins.

The integration checks only an entry's shape: a name that starts with a lower-case letter or a digit, then up to 63 more of those, `-` and `_`; a template whose `card` is a mapping, and whose `popups`, when it has them, are a list of mappings; changes of a known `op`, each with the keys its op takes (below), a `path` and a `base`, where a `remove` of the whole card and a `move` of a part after itself are refused; 256 KB at most; and 500 templates at most, so a save under a new name beyond them is refused. A home without the integration has an empty store. Removing the integration keeps the file, and adding it back finds the templates; deleting `.storage/mnml.templates` with Home Assistant stopped starts clean.

**Changes to a shipped template.** Every part of a list in a shipped card or pop-up has an `id:`, unique in its list and never reused, which no card sees. A shipped id names its part (`#lock`, `#queries`) and never starts with `my-`: that prefix is for the parts a home adds in the MNML panel, so no release gives a shipped part the id of one a home added. A change addresses a part by the path to it, mapping keys and `#<id>` for a list's part (`[card, chips?, '#lock']`), and is one of:

| `op`     | Does                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| `set`    | gives the mapping at `path` a `key` and its `value`                                              |
| `remove` | takes away the part, or the key, at `path`                                                       |
| `insert` | puts `value`, which carries its own `id`, into the list at `path`, `after` a part's id, or first |
| `move`   | moves the part `id` of the list at `path` `after` another, or first                              |

No path segment, and no key, is `__proto__`, `constructor` or `prototype`. Each change keeps `base`, the hash of what it touched as the shipped template had it: for `set`, the key's value; for `remove`, the part or the key; for `insert` and `move`, the order of the list's ids. A release that changes what a change touched leaves the change applying, marked changed; one that removes the part makes the change gone, skipped, while the rest of the template still draws; an insert whose id a release has given a part of its own is taken, skipped too. A store entry with a change of an unknown shape draws its template as shipped, and says so on the browser's console.

A part's id, once released, stays: `src/templates/ids.json` lists every released part, and a test fails when one goes without being retired there, when a retired one comes back, or when a new one is not listed yet (`pnpm run fix:ids`, part of `pnpm fix`, lists it).

**Reading the store.**

- The first template card on a page subscribes to the store. Every template card on the page waits for its answer before it draws, so a customised tile never shows the shipped version first.
- Every open dashboard, and the MNML panel, follows a save at once.
- After a reconnect the cards subscribe to the store again. A reconnect that comes while Home Assistant starts, before the integration is loaded, keeps the templates already read and tries again every 5 seconds, for 5 minutes.

**Who reads and who saves.** Every logged-in user reads the store; only an admin saves, deletes or reads the history, in the MNML panel.

**When something is wrong.** A subscription refused for any reason but an unknown command turns each template card into an error card that says why; an unknown command, a home without the integration, is an empty store. So is a store the integration could not read, which its log reports: its setup goes on, the cards draw the shipped templates, and a save is refused. A broken template of the home's own is an error card naming the template, like any other. A card that throws on a change is reported on the browser's console.

**The generator.** `build(home)` places the instances; the cards expand them, so the home's templates apply to a generated dashboard too. `drawn(home)` and `problems(home)` expand with the shipped templates only, and cannot see the home's.

## Discovery

A slot's `discover:` rule runs in the browser on Home Assistant's areas, devices, entities and states:

- `area.name`, `area.icon`, `area.id`, `area.temperature`, `area.humidity`: the area's own values, the last two the sensors chosen in its settings.
- A filter with any of `domain`, `device_class`, `platform` (the integration) and `translation_key`. An entity is in the area when its own area is the area, or when it has none and its device's is; hidden entities are skipped. An `entity` slot takes the first match by entity id, an entity without a category before a diagnostic or configuration one; an `entities` slot takes every match.
- A list of rules is tried in order, the first that finds something winning.
- `fields:` fills an `object` slot field by field.
- `per: device` fills an `objects` slot with one object per device that has a match (`where:`), in the order of the devices' names, each field found within that device; an entity without a device, such as a group or a template helper, is in no device's object. `per: area` gives one per area. `scope: all` searches the whole home rather than the area.
- Without an area, the area values and the rules over the area find nothing; only `scope: all` rules run.

The same registries always give the same values; the card discovers again when Home Assistant replaces its registries, not on a state change. A rule that finds nothing leaves its slot unfilled.

## How it runs

The template card expands its template in the browser, once the store has answered ([Where templates live](#where-templates-live)) and the families its expansion reaches have loaded: with explicit slots as soon as it is configured, if they already have and its families are loaded, otherwise as soon as they are; a card placed by area, or discovering in the whole home, also waits for `hass`. It creates the expanded card with Home Assistant's `loadCardHelpers()`, hands it every `hass`, and evaluates its `visibility` itself. Its size is the drawn card's own; before that card exists, the size a card of its type takes, from the template's own card when nothing is expanded yet, and, while its family has not arrived, from the card type and size the bundle's index keeps for each family template. It discovers again when Home Assistant replaces its registries, expands again when the store changes while it is on the page, and catches up on a change it missed when it comes back; it draws again only when the expansion changed. While it is on the page, it gives its pop-ups to the popups card, which opens them by hash like its own. A hash two cards give is a console error, reported once, and the first keeps it; a hash the popups card has itself stays its own.

**Families on need.** The bundle carries the shared fragments of `common.yaml`; every other shipped family (`room`, `lights`, `car` and the rest) is a JSON file beside it, `mnml-cards-<family>.json`. An expansion that reaches a shipped template not loaded yet notes it and carries on, so the card fetches every family it is missing at once, and expands again; a room takes about two rounds, served from the browser's cache after the first load. A room without a vacuum never fetches the vacuum's family. A family that cannot be fetched, such as a file left out of a hand install, turns the cards that need it into error cards naming the file, and is reported on the browser's console. A file that is missing (404, or 410) is not fetched again until the page is reloaded; any other failure, such as a dropped connection, is tried again 30 seconds later, on the next update, by every card that needs it, including one drawn in the meantime.

`src/templates/expand.ts` is the whole language as a pure function, `expand(templates, instance, discovered)`, and `expandDashboard()` expands every instance of a dashboard at once, so a tool or a test can see what a dashboard of templates draws without a browser.

## Versions

Templates are part of MNML's public interface. A new template, a new optional slot, or a change in what a template draws is a minor release; a renamed or removed template or slot, or a slot whose meaning changes, is a major one.

## Roles

A template is one of three, by how it is used, which MNML works out and nothing declares:

- **A tile** is placed on a dashboard: no other template uses it. The shipped ones are `room`, `person`, `car`, `proxmox-server`, `unifi-network`, `adguard`, `home-assistant`, `media-server` and `section-heading`.
- **A pop-up** is a card with a `hash` and no `type`, which a tile brings.
- **A part** is used inside another template, by `template:`.

The home's own templates count, so a template of the home that uses a shipped tile makes it a part. The library and the template card's gallery show the tiles first, and the pop-ups and parts on request.

## The shipped templates

Each template's slots and the rules that find them. A slot without a rule is set by hand. A field's row reads `slot.field`, and for an `objects` slot names the field of each element. A slot passed whole to a card's or a control's key takes that key's shape, in [keys.md](keys.md).

## Shared fragments

From `templates/common.yaml`.

### `section-heading`

A section's heading, the full width of the section.

| Slot       | Kind                              | Required or default | Found by |
| ---------- | --------------------------------- | ------------------- | -------- |
| `title`    | text                              | required            |          |
| `icon`     | icon                              | required            |          |
| `state`    | objects, as the card's `state`    |                     |          |
| `controls` | objects, as the card's `controls` |                     |          |

### `power`

A filled power toggle for an entity, lit while the entity is on.

| Slot     | Kind                            | Required or default | Found by |
| -------- | ------------------------------- | ------------------- | -------- |
| `entity` | entity                          | required            |          |
| `color`  | text                            | `'amber'`           |          |
| `when`   | object, as the control's `when` |                     |          |

### `nav-chip`

A coloured chip that opens a pop-up.

| Slot     | Kind                            | Required or default | Found by |
| -------- | ------------------------------- | ------------------- | -------- |
| `entity` | entity                          | required            |          |
| `popup`  | text                            | required            |          |
| `color`  | text                            | required            |          |
| `when`   | object, as the control's `when` |                     |          |

### `while-not-off`

The visibility that shows a card while its entity is not off.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity |                     |          |

### `batteries`

A folding list of batteries, lowest first, orange under 20 % and red under 5 %.

| Slot        | Kind     | Required or default | Found by |
| ----------- | -------- | ------------------- | -------- |
| `batteries` | entities |                     |          |
| `low`       | number   | `20`                |          |
| `critical`  | number   | `5`                 |          |

### `energy-table`

A folding table of meters, now, today and in total, the heading summing what they draw now.

| Slot           | Kind    | Required or default | Found by |
| -------------- | ------- | ------------------- | -------- |
| `meters`       | objects |                     |          |
| `meters.power` | entity  | required            |          |
| `meters.today` | entity  |                     |          |
| `meters.total` | entity  |                     |          |

### `pending-row`

A list row that flags an update while it is pending.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |

### `stopped-row`

A list row, red, shown while a service or guest is off.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |

### `link-row`

A list row for a link speed, orange while it is not the full speed.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |
| `speed`  | text   | `'10000'`           |          |

## Devices

From `templates/devices.yaml`.

### `select-card`

A dropdown over a select entity.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |

### `number-slider`

A slider over a number entity.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |

### `switch-card`

A switch as an item with its power toggle.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |

### `diffuser-card`

A diffuser with its amount, an amount slider and its power toggle.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |
| `amount` | entity |                     |          |

### `media-card`

A media player, opening a pop-up when it has one.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |
| `popup`  | text   |                     |          |

## Lights

From `templates/lights.yaml`.

### `light-controls`

A light's brightness, white temperature and, for a colour light, hue sliders, then its power toggle.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |
| `color`  | flag   |                     |          |

### `light-item`

A light as an item, with its brightness, the active scene while it is on, its scenes and its sliders.

| Slot           | Kind     | Required or default | Found by |
| -------------- | -------- | ------------------- | -------- |
| `entity`       | entity   | required            |          |
| `strip_word`   | text     |                     |          |
| `popup`        | text     |                     |          |
| `scenes`       | entities |                     |          |
| `active_scene` | entity   |                     |          |
| `color`        | flag     |                     |          |

### `light-card`

A light, or a light group with its members folded under it.

| Slot           | Kind     | Required or default | Found by |
| -------------- | -------- | ------------------- | -------- |
| `entity`       | entity   | required            |          |
| `members`      | entities |                     |          |
| `strip_word`   | text     |                     |          |
| `popup`        | text     |                     |          |
| `scenes`       | entities |                     |          |
| `active_scene` | entity   |                     |          |
| `color`        | flag     |                     |          |

### `lights-popup`

A room's lights pop-up, its sliders over the whole group, its scenes and every light.

| Slot              | Kind     | Required or default | Found by |
| ----------------- | -------- | ------------------- | -------- |
| `key`             | text     | required            |          |
| `name`            | text     | required            |          |
| `group`           | entity   | required            |          |
| `color`           | flag     |                     |          |
| `members`         | objects  |                     |          |
| `members.entity`  | entity   | required            |          |
| `members.members` | entities |                     |          |
| `scenes`          | entities |                     |          |
| `active_scene`    | entity   |                     |          |

## Climate

From `templates/climate.yaml`.

### `ac-controls`

An AC's target temperature slider and its mode menu, blue while it runs.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity |                     |          |

### `heating-controls`

A heating's target temperature slider, its preset menu when it has presets, and its power toggle, orange while it runs.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |
| `preset` | flag   |                     |          |

### `ac-item`

An AC as an item that opens its pop-up.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `key`    | text   | required            |          |
| `entity` | entity | required            |          |

### `heating-item`

A heating as an item that opens its pop-up.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `key`    | text   | required            |          |
| `entity` | entity | required            |          |
| `preset` | flag   |                     |          |

### `heating-popup`

A room's heating pop-up, its target, its preset, its valves and their batteries.

| Slot                  | Kind     | Required or default | Found by |
| --------------------- | -------- | ------------------- | -------- |
| `key`                 | text     | required            |          |
| `name`                | text     | required            |          |
| `entity`              | entity   | required            |          |
| `preset`              | flag     |                     |          |
| `thermostats`         | objects  |                     |          |
| `thermostats.valve`   | entity   | required            |          |
| `thermostats.battery` | entity   |                     |          |
| `batteries`           | entities |                     |          |

### `ac-popup`

A room's AC pop-up, its target, its fan, swing and other settings, and its energy.

| Slot               | Kind   | Required or default | Found by |
| ------------------ | ------ | ------------------- | -------- |
| `key`              | text   | required            |          |
| `name`             | text   | required            |          |
| `entity`           | entity | required            |          |
| `fan`              | flag   |                     |          |
| `swing`            | flag   |                     |          |
| `horizontal_swing` | flag   |                     |          |
| `power_saving`     | entity |                     |          |
| `dehumidifier`     | entity |                     |          |
| `energy`           | object |                     |          |
| `energy.power`     | entity | required            |          |
| `energy.today`     | entity |                     |          |
| `energy.total`     | entity |                     |          |

## Vacuum

From `templates/vacuum.yaml`.

### `vacuum-actions`

A vacuum's Dock, Locate, Start and Stop buttons, each shown when it applies.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity |                     |          |

### `vacuum-card`

A vacuum as an item, its error, status, room, battery and dock, opening its pop-up.

| Slot                               | Kind     | Required or default | Found by |
| ---------------------------------- | -------- | ------------------- | -------- |
| `key`                              | text     | required            |          |
| `vacuum`                           | object   | required            |          |
| `vacuum.entity`                    | entity   | required            |          |
| `vacuum.status`                    | entity   |                     |          |
| `vacuum.error`                     | entity   |                     |          |
| `vacuum.battery`                   | entity   |                     |          |
| `vacuum.current_room`              | entity   |                     |          |
| `vacuum.progress`                  | entity   |                     |          |
| `vacuum.area`                      | entity   |                     |          |
| `vacuum.time`                      | entity   |                     |          |
| `vacuum.last_clean`                | entity   |                     |          |
| `vacuum.mop_attached`              | entity   |                     |          |
| `vacuum.water_box_attached`        | entity   |                     |          |
| `vacuum.totals`                    | object   |                     |          |
| `vacuum.totals.count`              | entity   |                     |          |
| `vacuum.totals.area`               | entity   |                     |          |
| `vacuum.totals.time`               | entity   |                     |          |
| `vacuum.map`                       | entity   |                     |          |
| `vacuum.routines`                  | entities |                     |          |
| `vacuum.settings`                  | entities |                     |          |
| `vacuum.consumables`               | objects  |                     |          |
| `vacuum.consumables.entity`        | entity   |                     |          |
| `vacuum.consumables.reset`         | entity   |                     |          |
| `vacuum.warnings`                  | entities |                     |          |
| `vacuum.dock`                      | object   |                     |          |
| `vacuum.dock.error`                | entity   |                     |          |
| `vacuum.dock.dust_emptying`        | entity   |                     |          |
| `vacuum.dock.mop_drying`           | entity   |                     |          |
| `vacuum.dock.mop_drying_time_left` | entity   |                     |          |
| `vacuum.dock.mop_washing`          | entity   |                     |          |
| `vacuum.dock.consumables`          | objects  |                     |          |
| `vacuum.dock.consumables.entity`   | entity   |                     |          |
| `vacuum.dock.consumables.reset`    | entity   |                     |          |
| `vacuum.dock.warnings`             | entities |                     |          |

### `vacuum-popup`

A room's vacuum pop-up, its routines, map, details, settings, dock, maintenance and totals.

| Slot                               | Kind     | Required or default | Found by |
| ---------------------------------- | -------- | ------------------- | -------- |
| `key`                              | text     | required            |          |
| `name`                             | text     | required            |          |
| `vacuum`                           | object   | required            |          |
| `vacuum.entity`                    | entity   | required            |          |
| `vacuum.status`                    | entity   |                     |          |
| `vacuum.error`                     | entity   |                     |          |
| `vacuum.battery`                   | entity   |                     |          |
| `vacuum.current_room`              | entity   |                     |          |
| `vacuum.progress`                  | entity   | required            |          |
| `vacuum.area`                      | entity   | required            |          |
| `vacuum.time`                      | entity   | required            |          |
| `vacuum.last_clean`                | entity   | required            |          |
| `vacuum.mop_attached`              | entity   | required            |          |
| `vacuum.water_box_attached`        | entity   |                     |          |
| `vacuum.totals`                    | object   |                     |          |
| `vacuum.totals.count`              | entity   | required            |          |
| `vacuum.totals.area`               | entity   | required            |          |
| `vacuum.totals.time`               | entity   | required            |          |
| `vacuum.map`                       | entity   |                     |          |
| `vacuum.routines`                  | entities |                     |          |
| `vacuum.settings`                  | entities |                     |          |
| `vacuum.consumables`               | objects  |                     |          |
| `vacuum.consumables.entity`        | entity   | required            |          |
| `vacuum.consumables.reset`         | entity   |                     |          |
| `vacuum.warnings`                  | entities |                     |          |
| `vacuum.dock`                      | object   |                     |          |
| `vacuum.dock.error`                | entity   |                     |          |
| `vacuum.dock.dust_emptying`        | entity   | required            |          |
| `vacuum.dock.mop_drying`           | entity   | required            |          |
| `vacuum.dock.mop_drying_time_left` | entity   |                     |          |
| `vacuum.dock.mop_washing`          | entity   | required            |          |
| `vacuum.dock.consumables`          | objects  |                     |          |
| `vacuum.dock.consumables.entity`   | entity   | required            |          |
| `vacuum.dock.consumables.reset`    | entity   |                     |          |
| `vacuum.dock.warnings`             | entities |                     |          |

## 3D printer

From `templates/3d-printer.yaml`.

### `3d-printer-actions`

A 3D printer's Cancel, Pause, Resume and Continue buttons, each shown in the job state it applies to.

| Slot               | Kind   | Required or default | Found by |
| ------------------ | ------ | ------------------- | -------- |
| `entity`           | entity | required            |          |
| `actions`          | object |                     |          |
| `actions.pause`    | entity |                     |          |
| `actions.resume`   | entity |                     |          |
| `actions.continue` | entity |                     |          |
| `actions.cancel`   | entity |                     |          |

### `3d-printer-card`

A 3D printer as an item, its outlet or its state and job progress, opening its pop-up.

| Slot                            | Kind   | Required or default | Found by |
| ------------------------------- | ------ | ------------------- | -------- |
| `key`                           | text   | required            |          |
| `printer3d`                     | object | required            |          |
| `printer3d.entity`              | entity | required            |          |
| `printer3d.progress`            | entity |                     |          |
| `printer3d.filename`            | entity |                     |          |
| `printer3d.material`            | entity |                     |          |
| `printer3d.speed`               | entity |                     |          |
| `printer3d.start`               | entity |                     |          |
| `printer3d.finish`              | entity |                     |          |
| `printer3d.nozzle`              | object |                     |          |
| `printer3d.nozzle.temperature`  | entity |                     |          |
| `printer3d.nozzle.target`       | entity |                     |          |
| `printer3d.bed`                 | object |                     |          |
| `printer3d.bed.temperature`     | entity |                     |          |
| `printer3d.bed.target`          | entity |                     |          |
| `printer3d.camera`              | entity |                     |          |
| `printer3d.actions`             | object | required            |          |
| `printer3d.actions.pause`       | entity |                     |          |
| `printer3d.actions.resume`      | entity |                     |          |
| `printer3d.actions.continue`    | entity |                     |          |
| `printer3d.actions.cancel`      | entity |                     |          |
| `printer3d.outlet`              | object |                     |          |
| `printer3d.outlet.entity`       | entity | required            |          |
| `printer3d.outlet.energy`       | object |                     |          |
| `printer3d.outlet.energy.power` | entity |                     |          |
| `printer3d.outlet.energy.today` | entity |                     |          |
| `printer3d.outlet.energy.total` | entity |                     |          |

### `3d-printer-popup`

A room's 3D printer pop-up, its camera, print, temperatures and power.

| Slot                            | Kind   | Required or default | Found by |
| ------------------------------- | ------ | ------------------- | -------- |
| `key`                           | text   | required            |          |
| `name`                          | text   | required            |          |
| `printer3d`                     | object | required            |          |
| `printer3d.entity`              | entity | required            |          |
| `printer3d.progress`            | entity | required            |          |
| `printer3d.filename`            | entity | required            |          |
| `printer3d.material`            | entity | required            |          |
| `printer3d.speed`               | entity | required            |          |
| `printer3d.start`               | entity | required            |          |
| `printer3d.finish`              | entity | required            |          |
| `printer3d.nozzle`              | object | required            |          |
| `printer3d.nozzle.temperature`  | entity | required            |          |
| `printer3d.nozzle.target`       | entity |                     |          |
| `printer3d.bed`                 | object | required            |          |
| `printer3d.bed.temperature`     | entity | required            |          |
| `printer3d.bed.target`          | entity |                     |          |
| `printer3d.camera`              | entity |                     |          |
| `printer3d.actions`             | object | required            |          |
| `printer3d.actions.pause`       | entity |                     |          |
| `printer3d.actions.resume`      | entity |                     |          |
| `printer3d.actions.continue`    | entity |                     |          |
| `printer3d.actions.cancel`      | entity |                     |          |
| `printer3d.outlet`              | object |                     |          |
| `printer3d.outlet.entity`       | entity | required            |          |
| `printer3d.outlet.energy`       | object |                     |          |
| `printer3d.outlet.energy.power` | entity | required            |          |
| `printer3d.outlet.energy.today` | entity |                     |          |
| `printer3d.outlet.energy.total` | entity |                     |          |

## Speaker

From `templates/speaker.yaml`.

### `speaker-popup`

A speaker's pop-up, its sound, and its TV, subwoofer and surround settings when it has them.

| Slot                                 | Kind   | Required or default | Found by |
| ------------------------------------ | ------ | ------------------- | -------- |
| `key`                                | text   | required            |          |
| `name`                               | text   | required            |          |
| `speaker`                            | object | required            |          |
| `speaker.key`                        | text   | required            |          |
| `speaker.entity`                     | entity | required            |          |
| `speaker.bass`                       | entity | required            |          |
| `speaker.treble`                     | entity | required            |          |
| `speaker.balance`                    | entity |                     |          |
| `speaker.loudness`                   | entity | required            |          |
| `speaker.tv`                         | object |                     |          |
| `speaker.tv.input_format`            | entity |                     |          |
| `speaker.tv.night_sound`             | entity | required            |          |
| `speaker.tv.speech_enhancement`      | entity | required            |          |
| `speaker.tv.audio_delay`             | entity | required            |          |
| `speaker.subwoofer`                  | object |                     |          |
| `speaker.subwoofer.enabled`          | entity | required            |          |
| `speaker.subwoofer.gain`             | entity | required            |          |
| `speaker.surround`                   | object |                     |          |
| `speaker.surround.enabled`           | entity | required            |          |
| `speaker.surround.level`             | entity | required            |          |
| `speaker.surround.music_level`       | entity | required            |          |
| `speaker.surround.music_full_volume` | entity | required            |          |

## Rooms

From `templates/room.yaml`.

### `room`

A room's tile, its temperature and humidity, its window, door, lock and climate chips, its lights, and the problems dot; it brings the room's pop-ups.

| Slot                                  | Kind     | Required or default | Found by                                                                                                                                          |
| ------------------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`                                 | text     | required            | `area.id`                                                                                                                                         |
| `name`                                | text     | required            | `area.name`                                                                                                                                       |
| `icon`                                | icon     | `'mdi:texture-box'` | `area.icon`                                                                                                                                       |
| `temperature`                         | entity   |                     | `area.temperature`, then domain sensor, device_class temperature                                                                                  |
| `humidity`                            | entity   |                     | `area.humidity`, then domain sensor, device_class humidity                                                                                        |
| `window`                              | entity   |                     | domain binary_sensor, device_class window                                                                                                         |
| `door`                                | entity   |                     | domain binary_sensor, device_class door                                                                                                           |
| `lock`                                | entity   |                     | domain lock                                                                                                                                       |
| `lights`                              | object   |                     | `group` domain light, platform group, then domain light; `members` one per device with domain light: `entity` domain light; `scenes` domain scene |
| `lights.group`                        | entity   | required            |                                                                                                                                                   |
| `lights.color`                        | flag     |                     |                                                                                                                                                   |
| `lights.members`                      | objects  |                     |                                                                                                                                                   |
| `lights.members.entity`               | entity   | required            |                                                                                                                                                   |
| `lights.members.members`              | entities |                     |                                                                                                                                                   |
| `lights.scenes`                       | entities |                     |                                                                                                                                                   |
| `lights.active_scene`                 | entity   |                     |                                                                                                                                                   |
| `heating`                             | object   |                     | `entity` domain climate                                                                                                                           |
| `heating.entity`                      | entity   | required            |                                                                                                                                                   |
| `heating.preset`                      | flag     |                     |                                                                                                                                                   |
| `heating.thermostats`                 | objects  |                     |                                                                                                                                                   |
| `heating.thermostats.valve`           | entity   | required            |                                                                                                                                                   |
| `heating.thermostats.battery`         | entity   |                     |                                                                                                                                                   |
| `heating.batteries`                   | entities |                     |                                                                                                                                                   |
| `ac`                                  | object   |                     |                                                                                                                                                   |
| `ac.entity`                           | entity   | required            |                                                                                                                                                   |
| `ac.fan`                              | flag     |                     |                                                                                                                                                   |
| `ac.swing`                            | flag     |                     |                                                                                                                                                   |
| `ac.horizontal_swing`                 | flag     |                     |                                                                                                                                                   |
| `ac.power_saving`                     | entity   |                     |                                                                                                                                                   |
| `ac.dehumidifier`                     | entity   |                     |                                                                                                                                                   |
| `ac.energy`                           | object   |                     |                                                                                                                                                   |
| `ac.energy.power`                     | entity   | required            |                                                                                                                                                   |
| `ac.energy.today`                     | entity   |                     |                                                                                                                                                   |
| `ac.energy.total`                     | entity   |                     |                                                                                                                                                   |
| `vacuum`                              | object   |                     |                                                                                                                                                   |
| `vacuum.entity`                       | entity   | required            |                                                                                                                                                   |
| `vacuum.status`                       | entity   |                     |                                                                                                                                                   |
| `vacuum.error`                        | entity   |                     |                                                                                                                                                   |
| `vacuum.battery`                      | entity   |                     |                                                                                                                                                   |
| `vacuum.current_room`                 | entity   |                     |                                                                                                                                                   |
| `vacuum.progress`                     | entity   | required            |                                                                                                                                                   |
| `vacuum.area`                         | entity   | required            |                                                                                                                                                   |
| `vacuum.time`                         | entity   | required            |                                                                                                                                                   |
| `vacuum.last_clean`                   | entity   | required            |                                                                                                                                                   |
| `vacuum.mop_attached`                 | entity   | required            |                                                                                                                                                   |
| `vacuum.water_box_attached`           | entity   |                     |                                                                                                                                                   |
| `vacuum.totals`                       | object   |                     |                                                                                                                                                   |
| `vacuum.totals.count`                 | entity   | required            |                                                                                                                                                   |
| `vacuum.totals.area`                  | entity   | required            |                                                                                                                                                   |
| `vacuum.totals.time`                  | entity   | required            |                                                                                                                                                   |
| `vacuum.map`                          | entity   |                     |                                                                                                                                                   |
| `vacuum.routines`                     | entities |                     |                                                                                                                                                   |
| `vacuum.settings`                     | entities |                     |                                                                                                                                                   |
| `vacuum.consumables`                  | objects  |                     |                                                                                                                                                   |
| `vacuum.consumables.entity`           | entity   | required            |                                                                                                                                                   |
| `vacuum.consumables.reset`            | entity   |                     |                                                                                                                                                   |
| `vacuum.warnings`                     | entities |                     |                                                                                                                                                   |
| `vacuum.dock`                         | object   |                     |                                                                                                                                                   |
| `vacuum.dock.error`                   | entity   |                     |                                                                                                                                                   |
| `vacuum.dock.dust_emptying`           | entity   | required            |                                                                                                                                                   |
| `vacuum.dock.mop_drying`              | entity   | required            |                                                                                                                                                   |
| `vacuum.dock.mop_drying_time_left`    | entity   |                     |                                                                                                                                                   |
| `vacuum.dock.mop_washing`             | entity   | required            |                                                                                                                                                   |
| `vacuum.dock.consumables`             | objects  |                     |                                                                                                                                                   |
| `vacuum.dock.consumables.entity`      | entity   | required            |                                                                                                                                                   |
| `vacuum.dock.consumables.reset`       | entity   |                     |                                                                                                                                                   |
| `vacuum.dock.warnings`                | entities |                     |                                                                                                                                                   |
| `printer3d`                           | object   |                     |                                                                                                                                                   |
| `printer3d.entity`                    | entity   | required            |                                                                                                                                                   |
| `printer3d.progress`                  | entity   | required            |                                                                                                                                                   |
| `printer3d.filename`                  | entity   | required            |                                                                                                                                                   |
| `printer3d.material`                  | entity   | required            |                                                                                                                                                   |
| `printer3d.speed`                     | entity   | required            |                                                                                                                                                   |
| `printer3d.start`                     | entity   | required            |                                                                                                                                                   |
| `printer3d.finish`                    | entity   | required            |                                                                                                                                                   |
| `printer3d.nozzle`                    | object   | required            |                                                                                                                                                   |
| `printer3d.nozzle.temperature`        | entity   | required            |                                                                                                                                                   |
| `printer3d.nozzle.target`             | entity   |                     |                                                                                                                                                   |
| `printer3d.bed`                       | object   | required            |                                                                                                                                                   |
| `printer3d.bed.temperature`           | entity   | required            |                                                                                                                                                   |
| `printer3d.bed.target`                | entity   |                     |                                                                                                                                                   |
| `printer3d.camera`                    | entity   |                     |                                                                                                                                                   |
| `printer3d.actions`                   | object   | required            |                                                                                                                                                   |
| `printer3d.actions.pause`             | entity   |                     |                                                                                                                                                   |
| `printer3d.actions.resume`            | entity   |                     |                                                                                                                                                   |
| `printer3d.actions.continue`          | entity   |                     |                                                                                                                                                   |
| `printer3d.actions.cancel`            | entity   |                     |                                                                                                                                                   |
| `printer3d.outlet`                    | object   |                     |                                                                                                                                                   |
| `printer3d.outlet.entity`             | entity   | required            |                                                                                                                                                   |
| `printer3d.outlet.energy`             | object   |                     |                                                                                                                                                   |
| `printer3d.outlet.energy.power`       | entity   | required            |                                                                                                                                                   |
| `printer3d.outlet.energy.today`       | entity   |                     |                                                                                                                                                   |
| `printer3d.outlet.energy.total`       | entity   |                     |                                                                                                                                                   |
| `media`                               | objects  |                     | one per device with domain media_player: `entity` domain media_player                                                                             |
| `media.entity`                        | entity   | required            |                                                                                                                                                   |
| `media.key`                           | text     |                     |                                                                                                                                                   |
| `speakers`                            | objects  |                     |                                                                                                                                                   |
| `speakers.key`                        | text     | required            |                                                                                                                                                   |
| `speakers.entity`                     | entity   | required            |                                                                                                                                                   |
| `speakers.bass`                       | entity   | required            |                                                                                                                                                   |
| `speakers.treble`                     | entity   | required            |                                                                                                                                                   |
| `speakers.balance`                    | entity   |                     |                                                                                                                                                   |
| `speakers.loudness`                   | entity   | required            |                                                                                                                                                   |
| `speakers.tv`                         | object   |                     |                                                                                                                                                   |
| `speakers.tv.input_format`            | entity   |                     |                                                                                                                                                   |
| `speakers.tv.night_sound`             | entity   | required            |                                                                                                                                                   |
| `speakers.tv.speech_enhancement`      | entity   | required            |                                                                                                                                                   |
| `speakers.tv.audio_delay`             | entity   | required            |                                                                                                                                                   |
| `speakers.subwoofer`                  | object   |                     |                                                                                                                                                   |
| `speakers.subwoofer.enabled`          | entity   | required            |                                                                                                                                                   |
| `speakers.subwoofer.gain`             | entity   | required            |                                                                                                                                                   |
| `speakers.surround`                   | object   |                     |                                                                                                                                                   |
| `speakers.surround.enabled`           | entity   | required            |                                                                                                                                                   |
| `speakers.surround.level`             | entity   | required            |                                                                                                                                                   |
| `speakers.surround.music_level`       | entity   | required            |                                                                                                                                                   |
| `speakers.surround.music_full_volume` | entity   | required            |                                                                                                                                                   |
| `outlets`                             | objects  |                     | one per device with domain switch, device_class outlet: `entity` domain switch, device_class outlet                                               |
| `outlets.entity`                      | entity   | required            |                                                                                                                                                   |
| `outlets.energy`                      | object   |                     |                                                                                                                                                   |
| `outlets.energy.power`                | entity   |                     |                                                                                                                                                   |
| `outlets.energy.today`                | entity   |                     |                                                                                                                                                   |
| `outlets.energy.total`                | entity   |                     |                                                                                                                                                   |
| `diffuser`                            | object   |                     |                                                                                                                                                   |
| `diffuser.entity`                     | entity   | required            |                                                                                                                                                   |
| `diffuser.amount`                     | entity   | required            |                                                                                                                                                   |
| `batteries`                           | entities |                     | domain sensor, device_class battery                                                                                                               |
| `leaks`                               | entities |                     | domain binary_sensor, device_class moisture                                                                                                       |
| `meters`                              | objects  |                     |                                                                                                                                                   |
| `meters.power`                        | entity   | required            |                                                                                                                                                   |
| `meters.today`                        | entity   |                     |                                                                                                                                                   |
| `meters.total`                        | entity   |                     |                                                                                                                                                   |

Brings `room-popup`, `lights-popup`, `heating-popup` (with heating), `ac-popup` (with ac), `vacuum-popup` (with vacuum), `3d-printer-popup` (with printer3d), `speaker-popup` (one per speakers).

### `room-media-card`

A room's media player, opening its speaker pop-up when it is a speaker.

| Slot            | Kind   | Required or default | Found by |
| --------------- | ------ | ------------------- | -------- |
| `key`           | text   | required            |          |
| `member`        | object | required            |          |
| `member.entity` | entity | required            |          |
| `member.key`    | text   |                     |          |

### `room-popup`

A room's pop-up, its lights, climate, media and other devices, its batteries and its energy.

| Slot                               | Kind     | Required or default | Found by |
| ---------------------------------- | -------- | ------------------- | -------- |
| `key`                              | text     | required            |          |
| `name`                             | text     | required            |          |
| `icon`                             | icon     | `'mdi:texture-box'` |          |
| `temperature`                      | entity   |                     |          |
| `humidity`                         | entity   |                     |          |
| `window`                           | entity   |                     |          |
| `door`                             | entity   |                     |          |
| `lock`                             | entity   |                     |          |
| `lights`                           | object   |                     |          |
| `lights.group`                     | entity   | required            |          |
| `lights.members`                   | objects  |                     |          |
| `lights.members.entity`            | entity   |                     |          |
| `lights.members.members`           | entities |                     |          |
| `lights.scenes`                    | entities |                     |          |
| `lights.active_scene`              | entity   |                     |          |
| `lights.color`                     | flag     |                     |          |
| `heating`                          | object   |                     |          |
| `heating.entity`                   | entity   | required            |          |
| `heating.preset`                   | flag     |                     |          |
| `heating.thermostats`              | objects  |                     |          |
| `heating.thermostats.valve`        | entity   |                     |          |
| `heating.thermostats.battery`      | entity   |                     |          |
| `heating.batteries`                | entities |                     |          |
| `ac`                               | object   |                     |          |
| `ac.entity`                        | entity   | required            |          |
| `ac.fan`                           | flag     |                     |          |
| `ac.swing`                         | flag     |                     |          |
| `ac.horizontal_swing`              | flag     |                     |          |
| `ac.power_saving`                  | entity   |                     |          |
| `ac.dehumidifier`                  | entity   |                     |          |
| `ac.energy`                        | object   |                     |          |
| `ac.energy.power`                  | entity   |                     |          |
| `ac.energy.today`                  | entity   |                     |          |
| `ac.energy.total`                  | entity   |                     |          |
| `vacuum`                           | object   |                     |          |
| `vacuum.entity`                    | entity   | required            |          |
| `vacuum.status`                    | entity   |                     |          |
| `vacuum.error`                     | entity   |                     |          |
| `vacuum.battery`                   | entity   |                     |          |
| `vacuum.current_room`              | entity   |                     |          |
| `vacuum.progress`                  | entity   |                     |          |
| `vacuum.area`                      | entity   |                     |          |
| `vacuum.time`                      | entity   |                     |          |
| `vacuum.last_clean`                | entity   |                     |          |
| `vacuum.mop_attached`              | entity   |                     |          |
| `vacuum.water_box_attached`        | entity   |                     |          |
| `vacuum.totals`                    | object   |                     |          |
| `vacuum.totals.count`              | entity   |                     |          |
| `vacuum.totals.area`               | entity   |                     |          |
| `vacuum.totals.time`               | entity   |                     |          |
| `vacuum.map`                       | entity   |                     |          |
| `vacuum.routines`                  | entities |                     |          |
| `vacuum.settings`                  | entities |                     |          |
| `vacuum.consumables`               | objects  |                     |          |
| `vacuum.consumables.entity`        | entity   |                     |          |
| `vacuum.consumables.reset`         | entity   |                     |          |
| `vacuum.warnings`                  | entities |                     |          |
| `vacuum.dock`                      | object   |                     |          |
| `vacuum.dock.error`                | entity   |                     |          |
| `vacuum.dock.dust_emptying`        | entity   |                     |          |
| `vacuum.dock.mop_drying`           | entity   |                     |          |
| `vacuum.dock.mop_drying_time_left` | entity   |                     |          |
| `vacuum.dock.mop_washing`          | entity   |                     |          |
| `vacuum.dock.consumables`          | objects  |                     |          |
| `vacuum.dock.consumables.entity`   | entity   |                     |          |
| `vacuum.dock.consumables.reset`    | entity   |                     |          |
| `vacuum.dock.warnings`             | entities |                     |          |
| `printer3d`                        | object   |                     |          |
| `printer3d.entity`                 | entity   | required            |          |
| `printer3d.progress`               | entity   |                     |          |
| `printer3d.filename`               | entity   |                     |          |
| `printer3d.material`               | entity   |                     |          |
| `printer3d.speed`                  | entity   |                     |          |
| `printer3d.start`                  | entity   |                     |          |
| `printer3d.finish`                 | entity   |                     |          |
| `printer3d.nozzle`                 | object   |                     |          |
| `printer3d.nozzle.temperature`     | entity   |                     |          |
| `printer3d.nozzle.target`          | entity   |                     |          |
| `printer3d.bed`                    | object   |                     |          |
| `printer3d.bed.temperature`        | entity   |                     |          |
| `printer3d.bed.target`             | entity   |                     |          |
| `printer3d.camera`                 | entity   |                     |          |
| `printer3d.actions`                | object   | required            |          |
| `printer3d.actions.pause`          | entity   |                     |          |
| `printer3d.actions.resume`         | entity   |                     |          |
| `printer3d.actions.continue`       | entity   |                     |          |
| `printer3d.actions.cancel`         | entity   |                     |          |
| `printer3d.outlet`                 | object   |                     |          |
| `printer3d.outlet.entity`          | entity   | required            |          |
| `printer3d.outlet.energy`          | object   |                     |          |
| `printer3d.outlet.energy.power`    | entity   |                     |          |
| `printer3d.outlet.energy.today`    | entity   |                     |          |
| `printer3d.outlet.energy.total`    | entity   |                     |          |
| `media`                            | objects  |                     |          |
| `media.entity`                     | entity   | required            |          |
| `media.key`                        | text     |                     |          |
| `outlets`                          | objects  |                     |          |
| `outlets.entity`                   | entity   | required            |          |
| `outlets.energy`                   | object   |                     |          |
| `outlets.energy.power`             | entity   |                     |          |
| `outlets.energy.today`             | entity   |                     |          |
| `outlets.energy.total`             | entity   |                     |          |
| `diffuser`                         | object   |                     |          |
| `diffuser.entity`                  | entity   | required            |          |
| `diffuser.amount`                  | entity   | required            |          |
| `batteries`                        | entities |                     |          |
| `meters`                           | objects  |                     |          |
| `meters.power`                     | entity   | required            |          |
| `meters.today`                     | entity   |                     |          |
| `meters.total`                     | entity   |                     |          |

## People

From `templates/people.yaml`.

### `person`

A person's tile, whether they are driving or in a focus, and their devices' batteries; it brings the person's and each device's pop-up.

| Slot                     | Kind     | Required or default | Found by  |
| ------------------------ | -------- | ------------------- | --------- |
| `key`                    | text     | required            | `area.id` |
| `entity`                 | entity   | required            |           |
| `health`                 | object   |                     |           |
| `health.steps`           | entity   | required            |           |
| `health.distance`        | entity   | required            |           |
| `health.flights_climbed` | entity   | required            |           |
| `health.active_energy`   | entity   | required            |           |
| `health.resting_energy`  | entity   | required            |           |
| `devices`                | objects  |                     |           |
| `devices.key`            | text     | required            |           |
| `devices.name`           | text     |                     |           |
| `devices.icon`           | icon     |                     |           |
| `devices.tracker`        | entity   | required            |           |
| `devices.battery`        | entity   | required            |           |
| `devices.battery_state`  | entity   | required            |           |
| `devices.connection`     | entity   | required            |           |
| `devices.network`        | entity   | required            |           |
| `devices.storage`        | entity   | required            |           |
| `devices.focus`          | entity   | required            |           |
| `devices.focus_name`     | entity   |                     |           |
| `devices.activity`       | entity   | required            |           |
| `devices.permission`     | entity   | required            |           |
| `activities`             | entities |                     |           |
| `focuses`                | entities |                     |           |
| `batteries`              | entities |                     |           |

Brings `person-popup`, `device-popup` (one per devices).

### `device-card`

A person's device as an item, its place and battery, opening its pop-up.

| Slot                   | Kind   | Required or default | Found by |
| ---------------------- | ------ | ------------------- | -------- |
| `key`                  | text   | required            |          |
| `device`               | object | required            |          |
| `device.key`           | text   | required            |          |
| `device.name`          | text   |                     |          |
| `device.icon`          | icon   |                     |          |
| `device.tracker`       | entity | required            |          |
| `device.battery`       | entity |                     |          |
| `device.battery_state` | entity |                     |          |
| `device.connection`    | entity |                     |          |
| `device.network`       | entity |                     |          |
| `device.storage`       | entity |                     |          |
| `device.focus`         | entity |                     |          |
| `device.focus_name`    | entity |                     |          |
| `device.activity`      | entity |                     |          |
| `device.permission`    | entity |                     |          |

### `person-popup`

A person's pop-up, their devices, their location access and their health.

| Slot                     | Kind    | Required or default | Found by |
| ------------------------ | ------- | ------------------- | -------- |
| `key`                    | text    | required            |          |
| `entity`                 | entity  | required            |          |
| `health`                 | object  |                     |          |
| `health.steps`           | entity  | required            |          |
| `health.distance`        | entity  | required            |          |
| `health.flights_climbed` | entity  | required            |          |
| `health.active_energy`   | entity  | required            |          |
| `health.resting_energy`  | entity  | required            |          |
| `devices`                | objects |                     |          |
| `devices.key`            | text    | required            |          |
| `devices.name`           | text    |                     |          |
| `devices.icon`           | icon    |                     |          |
| `devices.tracker`        | entity  | required            |          |
| `devices.battery`        | entity  |                     |          |
| `devices.battery_state`  | entity  |                     |          |
| `devices.connection`     | entity  |                     |          |
| `devices.network`        | entity  |                     |          |
| `devices.storage`        | entity  |                     |          |
| `devices.focus`          | entity  |                     |          |
| `devices.focus_name`     | entity  |                     |          |
| `devices.activity`       | entity  |                     |          |
| `devices.permission`     | entity  | required            |          |

### `device-popup`

A person's device pop-up, its battery and its details.

| Slot                   | Kind   | Required or default | Found by |
| ---------------------- | ------ | ------------------- | -------- |
| `key`                  | text   | required            |          |
| `entity`               | entity |                     |          |
| `device`               | object | required            |          |
| `device.key`           | text   | required            |          |
| `device.name`          | text   |                     |          |
| `device.icon`          | icon   |                     |          |
| `device.tracker`       | entity |                     |          |
| `device.battery`       | entity | required            |          |
| `device.battery_state` | entity | required            |          |
| `device.connection`    | entity | required            |          |
| `device.network`       | entity | required            |          |
| `device.storage`       | entity | required            |          |
| `device.focus`         | entity | required            |          |
| `device.focus_name`    | entity |                     |          |
| `device.activity`      | entity | required            |          |
| `device.permission`    | entity | required            |          |

## Cars

From `templates/car.yaml`.

### `car`

A car's tile, its fuel, and its doors, windows, alarm and tyres chips; it brings the car's pop-up. The defaults are BMW CarData's words.

| Slot                         | Kind     | Required or default                                      | Found by |
| ---------------------------- | -------- | -------------------------------------------------------- | -------- |
| `key`                        | text     | required                                                 |          |
| `icon`                       | icon     | `'mdi:car'`                                              |          |
| `metadata`                   | entity   | required                                                 |          |
| `fuel`                       | entity   |                                                          |          |
| `remaining_fuel`             | entity   |                                                          |          |
| `range`                      | entity   |                                                          |          |
| `mileage`                    | entity   |                                                          |          |
| `service`                    | entity   |                                                          |          |
| `battery_voltage`            | entity   |                                                          |          |
| `coolant_temperature`        | entity   |                                                          |          |
| `lock`                       | entity   |                                                          |          |
| `alarm`                      | entity   |                                                          |          |
| `alarm_active`               | entity   |                                                          |          |
| `doors`                      | entities | required                                                 |          |
| `hood`                       | entity   | required                                                 |          |
| `tailgate`                   | entity   | required                                                 |          |
| `windows`                    | entities | required                                                 |          |
| `sunroof`                    | entity   |                                                          |          |
| `tyres`                      | entities | required                                                 |          |
| `tyre_targets`               | entities | required                                                 |          |
| `location`                   | entity   |                                                          |          |
| `lock_words`                 | object   | `{'secured':'Locked','selectivelocked':'Partly locked'}` |          |
| `lock_words.secured`         | text     |                                                          |          |
| `lock_words.selectivelocked` | text     |                                                          |          |
| `alarm_words`                | object   | `{'doorsonly':'Doors only','doorstiltcabin':'Armed'}`    |          |
| `alarm_words.doorsonly`      | text     |                                                          |          |
| `alarm_words.doorstiltcabin` | text     |                                                          |          |
| `unlocked`                   | texts    | `['unlocked','selectivelocked']`                         |          |
| `disarmed`                   | texts    | `['unarmed']`                                            |          |
| `open_states`                | texts    | `['open','intermediate']`                                |          |
| `tyre_low_share`             | number   | `0.9`                                                    |          |
| `tyre_warn_share`            | number   | `0.95`                                                   |          |

Brings `car-popup`.

### `car-plan`

A car seen from above, its openings and tyres.

| Slot              | Kind     | Required or default | Found by |
| ----------------- | -------- | ------------------- | -------- |
| `doors`           | entities | required            |          |
| `hood`            | entity   | required            |          |
| `tailgate`        | entity   | required            |          |
| `windows`         | entities | required            |          |
| `sunroof`         | entity   |                     |          |
| `tyres`           | entities | required            |          |
| `tyre_targets`    | entities | required            |          |
| `tyre_low_share`  | number   | `0.9`               |          |
| `tyre_warn_share` | number   | `0.95`              |          |

### `car-popup`

A car's pop-up, its security, its plan, its details and where it is.

| Slot                         | Kind     | Required or default                                      | Found by |
| ---------------------------- | -------- | -------------------------------------------------------- | -------- |
| `key`                        | text     | required                                                 |          |
| `icon`                       | icon     | `'mdi:car'`                                              |          |
| `metadata`                   | entity   | required                                                 |          |
| `fuel`                       | entity   |                                                          |          |
| `remaining_fuel`             | entity   |                                                          |          |
| `range`                      | entity   |                                                          |          |
| `mileage`                    | entity   |                                                          |          |
| `service`                    | entity   |                                                          |          |
| `battery_voltage`            | entity   |                                                          |          |
| `coolant_temperature`        | entity   |                                                          |          |
| `lock`                       | entity   |                                                          |          |
| `alarm`                      | entity   |                                                          |          |
| `alarm_active`               | entity   |                                                          |          |
| `doors`                      | entities | required                                                 |          |
| `hood`                       | entity   | required                                                 |          |
| `tailgate`                   | entity   | required                                                 |          |
| `windows`                    | entities | required                                                 |          |
| `sunroof`                    | entity   |                                                          |          |
| `tyres`                      | entities | required                                                 |          |
| `tyre_targets`               | entities | required                                                 |          |
| `location`                   | entity   |                                                          |          |
| `lock_words`                 | object   | `{'secured':'Locked','selectivelocked':'Partly locked'}` |          |
| `lock_words.secured`         | text     |                                                          |          |
| `lock_words.selectivelocked` | text     |                                                          |          |
| `alarm_words`                | object   | `{'doorsonly':'Doors only','doorstiltcabin':'Armed'}`    |          |
| `alarm_words.doorsonly`      | text     |                                                          |          |
| `alarm_words.doorstiltcabin` | text     |                                                          |          |
| `unlocked`                   | texts    | `['unlocked','selectivelocked']`                         |          |
| `disarmed`                   | texts    | `['unarmed']`                                            |          |
| `tyre_low_share`             | number   | `0.9`                                                    |          |
| `tyre_warn_share`            | number   | `0.95`                                                   |          |

## Server

From `templates/server.yaml`.

### `proxmox-server`

A Proxmox VE server's tile, its CPU and memory, and its guests, checks, backups and notifications chips; it brings the server's and the notifications' pop-ups. The checks, backups and notifications read sensors that the server's own jobs keep.

| Slot                           | Kind     | Required or default | Found by |
| ------------------------------ | -------- | ------------------- | -------- |
| `outlet`                       | object   |                     |          |
| `outlet.entity`                | entity   | required            |          |
| `outlet.energy`                | object   |                     |          |
| `outlet.energy.power`          | entity   | required            |          |
| `outlet.energy.today`          | entity   |                     |          |
| `outlet.energy.total`          | entity   |                     |          |
| `cpu`                          | entity   |                     |          |
| `memory`                       | entity   |                     |          |
| `last_boot`                    | entity   |                     |          |
| `uplink`                       | entity   |                     |          |
| `temperatures`                 | object   |                     |          |
| `temperatures.cpu`             | entity   | required            |          |
| `temperatures.root_disk`       | entity   | required            |          |
| `storage`                      | entities |                     |          |
| `disks`                        | object   |                     |          |
| `disks.pool`                   | entity   | required            |          |
| `disks.failing`                | entity   | required            |          |
| `disks.life_left`              | entity   | required            |          |
| `guests`                       | objects  |                     |          |
| `guests.host`                  | text     |                     |          |
| `guests.status`                | entity   | required            |          |
| `guests.cpu`                   | entity   |                     |          |
| `guests.memory`                | entity   |                     |          |
| `guests.disk`                  | object   |                     |          |
| `guests.disk.used`             | entity   |                     |          |
| `guests.disk.size`             | entity   |                     |          |
| `backups`                      | object   |                     |          |
| `backups.last`                 | entity   | required            |          |
| `backups.problem`              | entity   | required            |          |
| `backups.bucket`               | entity   |                     |          |
| `checks`                       | object   |                     |          |
| `checks.failed`                | entity   | required            |          |
| `checks.last_run`              | entity   | required            |          |
| `checks.overdue`               | entity   | required            |          |
| `notifications`                | object   |                     |          |
| `notifications.messages`       | entity   | required            |          |
| `notifications.clear`          | entity   | required            |          |
| `notifications.sources`        | objects  |                     |          |
| `notifications.sources.source` | text     |                     |          |
| `notifications.sources.name`   | text     |                     |          |
| `guest_statuses`               | entities |                     |          |
| `guest_disks`                  | objects  |                     |          |
| `guest_disks.used`             | entity   | required            |          |
| `guest_disks.size`             | entity   |                     |          |
| `message_sources`              | objects  |                     |          |
| `message_sources.source`       | text     |                     |          |
| `message_sources.name`         | text     |                     |          |
| `message_sources.entity`       | entity   |                     |          |
| `disk_high`                    | number   | `80`                |          |
| `disk_full`                    | number   | `90`                |          |
| `disk_life_low`                | number   | `20`                |          |
| `disk_life_critical`           | number   | `10`                |          |
| `cpu_hot`                      | number   | `85`                |          |
| `cpu_critical`                 | number   | `95`                |          |
| `root_disk_hot`                | number   | `70`                |          |
| `root_disk_critical`           | number   | `80`                |          |
| `bucket_high`                  | number   | `18`                |          |
| `bucket_full`                  | number   | `19`                |          |

Brings `proxmox-popup`, `notifications-popup` (with notifications).

### `proxmox-popup`

The server's pop-up, its notifications, stopped guests, checks, host, disks, storage, energy, guests and backups.

| Slot                           | Kind     | Required or default | Found by |
| ------------------------------ | -------- | ------------------- | -------- |
| `outlet`                       | object   |                     |          |
| `outlet.entity`                | entity   | required            |          |
| `outlet.energy`                | object   |                     |          |
| `outlet.energy.power`          | entity   | required            |          |
| `outlet.energy.today`          | entity   |                     |          |
| `outlet.energy.total`          | entity   |                     |          |
| `cpu`                          | entity   |                     |          |
| `memory`                       | entity   |                     |          |
| `last_boot`                    | entity   |                     |          |
| `uplink`                       | entity   |                     |          |
| `temperatures`                 | object   |                     |          |
| `temperatures.cpu`             | entity   | required            |          |
| `temperatures.root_disk`       | entity   | required            |          |
| `storage`                      | entities |                     |          |
| `disks`                        | object   |                     |          |
| `disks.pool`                   | entity   | required            |          |
| `disks.failing`                | entity   | required            |          |
| `disks.life_left`              | entity   | required            |          |
| `guests`                       | objects  |                     |          |
| `guests.host`                  | text     |                     |          |
| `guests.status`                | entity   | required            |          |
| `guests.cpu`                   | entity   |                     |          |
| `guests.memory`                | entity   |                     |          |
| `guests.disk`                  | object   |                     |          |
| `guests.disk.used`             | entity   |                     |          |
| `guests.disk.size`             | entity   |                     |          |
| `backups`                      | object   |                     |          |
| `backups.last`                 | entity   | required            |          |
| `backups.problem`              | entity   | required            |          |
| `backups.bucket`               | entity   |                     |          |
| `checks`                       | object   |                     |          |
| `checks.failed`                | entity   | required            |          |
| `checks.last_run`              | entity   | required            |          |
| `checks.overdue`               | entity   | required            |          |
| `notifications`                | object   |                     |          |
| `notifications.messages`       | entity   | required            |          |
| `notifications.clear`          | entity   |                     |          |
| `notifications.sources`        | objects  |                     |          |
| `notifications.sources.source` | text     |                     |          |
| `notifications.sources.name`   | text     |                     |          |
| `guest_statuses`               | entities |                     |          |
| `guest_disks`                  | objects  |                     |          |
| `guest_disks.used`             | entity   | required            |          |
| `guest_disks.size`             | entity   |                     |          |
| `message_sources`              | objects  |                     |          |
| `message_sources.source`       | text     |                     |          |
| `message_sources.name`         | text     |                     |          |
| `message_sources.entity`       | entity   |                     |          |
| `disk_high`                    | number   | `80`                |          |
| `disk_full`                    | number   | `90`                |          |
| `disk_life_low`                | number   | `20`                |          |
| `disk_life_critical`           | number   | `10`                |          |
| `cpu_hot`                      | number   | `85`                |          |
| `cpu_critical`                 | number   | `95`                |          |
| `root_disk_hot`                | number   | `70`                |          |
| `root_disk_critical`           | number   | `80`                |          |
| `bucket_high`                  | number   | `18`                |          |
| `bucket_full`                  | number   | `19`                |          |

### `notifications-popup`

The server's notifications pop-up, every message and a button that clears them all.

| Slot                           | Kind    | Required or default | Found by |
| ------------------------------ | ------- | ------------------- | -------- |
| `notifications`                | object  | required            |          |
| `notifications.messages`       | entity  | required            |          |
| `notifications.clear`          | entity  | required            |          |
| `notifications.sources`        | objects |                     |          |
| `notifications.sources.source` | text    |                     |          |
| `notifications.sources.name`   | text    |                     |          |
| `message_sources`              | objects |                     |          |
| `message_sources.source`       | text    |                     |          |
| `message_sources.name`         | text    |                     |          |
| `message_sources.entity`       | entity  |                     |          |

## Network

From `templates/network.yaml`.

### `unifi-network`

A UniFi network's tile, its latency, and its devices, VPN and firmware chips; it brings the network's pop-up and one per Wi-Fi network.

| Slot                      | Kind     | Required or default                        | Found by |
| ------------------------- | -------- | ------------------------------------------ | -------- |
| `latency`                 | entities |                                            |          |
| `wan`                     | entity   |                                            |          |
| `devices`                 | entities |                                            |          |
| `wifi`                    | objects  |                                            |          |
| `wifi.key`                | text     | required                                   |          |
| `wifi.enabled`            | entity   | required                                   |          |
| `wifi.qr`                 | entity   |                                            |          |
| `wifi.switchable`         | flag     |                                            |          |
| `vpn`                     | entities |                                            |          |
| `clients`                 | object   |                                            |          |
| `clients.entity`          | entity   | required                                   |          |
| `clients.names`           | entity   |                                            |          |
| `clients.networks`        | objects  | required                                   |          |
| `clients.networks.name`   | text     |                                            |          |
| `clients.networks.icon`   | icon     |                                            |          |
| `clients.networks.subnet` | text     | required                                   |          |
| `router`                  | object   |                                            |          |
| `router.cpu`              | entity   | required                                   |          |
| `router.temperature`      | entity   | required                                   |          |
| `firmware`                | entities |                                            |          |
| `device_up`               | texts    | `['connected','upgrading','provisioning']` |          |

Brings `network-popup`, `wifi-popup` (one per wifi).

### `wifi-item`

A Wi-Fi network as an item, its switch when it may be switched from the dashboard, opening its pop-up.

| Slot              | Kind   | Required or default | Found by |
| ----------------- | ------ | ------------------- | -------- |
| `wifi`            | object | required            |          |
| `wifi.key`        | text   | required            |          |
| `wifi.enabled`    | entity | required            |          |
| `wifi.qr`         | entity |                     |          |
| `wifi.switchable` | flag   |                     |          |

### `network-popup`

The network's pop-up, its internet, devices, router, VPN, Wi-Fi networks, clients and firmware.

| Slot                      | Kind     | Required or default                        | Found by |
| ------------------------- | -------- | ------------------------------------------ | -------- |
| `latency`                 | entities |                                            |          |
| `wan`                     | entity   |                                            |          |
| `devices`                 | entities |                                            |          |
| `wifi`                    | objects  |                                            |          |
| `wifi.key`                | text     | required                                   |          |
| `wifi.enabled`            | entity   | required                                   |          |
| `wifi.qr`                 | entity   |                                            |          |
| `wifi.switchable`         | flag     |                                            |          |
| `vpn`                     | entities |                                            |          |
| `clients`                 | object   |                                            |          |
| `clients.entity`          | entity   | required                                   |          |
| `clients.names`           | entity   |                                            |          |
| `clients.networks`        | objects  | required                                   |          |
| `clients.networks.name`   | text     |                                            |          |
| `clients.networks.icon`   | icon     |                                            |          |
| `clients.networks.subnet` | text     | required                                   |          |
| `router`                  | object   |                                            |          |
| `router.cpu`              | entity   | required                                   |          |
| `router.temperature`      | entity   | required                                   |          |
| `firmware`                | entities |                                            |          |
| `device_up`               | texts    | `['connected','upgrading','provisioning']` |          |

### `wifi-popup`

A Wi-Fi network's pop-up, its switch and the QR code to join it while it is on.

| Slot              | Kind   | Required or default | Found by |
| ----------------- | ------ | ------------------- | -------- |
| `wifi`            | object | required            |          |
| `wifi.key`        | text   | required            |          |
| `wifi.enabled`    | entity | required            |          |
| `wifi.qr`         | entity |                     |          |
| `wifi.switchable` | flag   |                     |          |

## AdGuard Home

From `templates/adguard.yaml`.

### `adguard`

An AdGuard Home tile, its block ratio and speed, its update chip and its protection toggle; it brings its pop-up.

| Slot         | Kind   | Required or default | Found by                                                                                     |
| ------------ | ------ | ------------------- | -------------------------------------------------------------------------------------------- |
| `protection` | entity | required            | domain switch, platform adguard, translation_key protection in the whole home                |
| `queries`    | entity |                     | domain sensor, platform adguard, translation_key dns_queries in the whole home               |
| `blocked`    | entity |                     | domain sensor, platform adguard, translation_key dns_queries_blocked in the whole home       |
| `ratio`      | entity |                     | domain sensor, platform adguard, translation_key dns_queries_blocked_ratio in the whole home |
| `speed`      | entity |                     | domain sensor, platform adguard, translation_key average_processing_speed in the whole home  |
| `rules`      | entity |                     | domain sensor, platform adguard, translation_key rules_count in the whole home               |
| `update`     | entity |                     | domain update, platform adguard in the whole home                                            |

Brings `adguard-popup`.

### `adguard-popup`

AdGuard Home's pop-up, its queries, blocklists and update.

| Slot         | Kind   | Required or default | Found by |
| ------------ | ------ | ------------------- | -------- |
| `protection` | entity | required            |          |
| `queries`    | entity |                     |          |
| `blocked`    | entity |                     |          |
| `ratio`      | entity |                     |          |
| `speed`      | entity |                     |          |
| `rules`      | entity |                     |          |
| `update`     | entity |                     |          |

## Home Assistant

From `templates/home-assistant.yaml`.

### `home-assistant`

Home Assistant's tile, its memory and free disk, and its services, updates and firmware chips; it brings its pop-up, with each room's firmware.

| Slot                     | Kind     | Required or default | Found by                                                                                                                                                             |
| ------------------------ | -------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cpu`                    | entity   |                     | domain sensor, platform systemmonitor, translation_key processor_use in the whole home                                                                               |
| `memory`                 | entity   |                     | domain sensor, platform systemmonitor, translation_key memory_use_percent in the whole home                                                                          |
| `disk_free`              | entity   |                     | domain sensor, platform hassio, translation_key disk_free in the whole home, then domain sensor, platform systemmonitor, translation_key disk_free in the whole home |
| `disk_used`              | entity   |                     | domain sensor, platform hassio, translation_key disk_used in the whole home, then domain sensor, platform systemmonitor, translation_key disk_use in the whole home  |
| `services`               | entities |                     |                                                                                                                                                                      |
| `updates`                | entities |                     | domain update, platform hassio in the whole home                                                                                                                     |
| `firmware`               | entities |                     |                                                                                                                                                                      |
| `backups`                | object   |                     |                                                                                                                                                                      |
| `backups.last`           | entity   | required            |                                                                                                                                                                      |
| `backups.attempted`      | entity   |                     |                                                                                                                                                                      |
| `all_firmware`           | entities |                     | domain update, device_class firmware in the whole home                                                                                                               |
| `room_firmware`          | objects  |                     | one per area in the whole home: `name` `area.name`; `firmware` domain update, device_class firmware                                                                  |
| `room_firmware.name`     | text     | required            |                                                                                                                                                                      |
| `room_firmware.firmware` | entities |                     |                                                                                                                                                                      |

Brings `system-popup`.

### `system-popup`

Home Assistant's pop-up, its resources, backups, services, updates, its own firmware and each room's.

| Slot                     | Kind     | Required or default | Found by                                                                                            |
| ------------------------ | -------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `cpu`                    | entity   |                     |                                                                                                     |
| `memory`                 | entity   |                     |                                                                                                     |
| `disk_free`              | entity   |                     |                                                                                                     |
| `disk_used`              | entity   |                     |                                                                                                     |
| `services`               | entities |                     |                                                                                                     |
| `updates`                | entities |                     |                                                                                                     |
| `firmware`               | entities |                     |                                                                                                     |
| `backups`                | object   |                     |                                                                                                     |
| `backups.last`           | entity   | required            |                                                                                                     |
| `backups.attempted`      | entity   |                     |                                                                                                     |
| `all_firmware`           | entities |                     | domain update, device_class firmware in the whole home                                              |
| `room_firmware`          | objects  |                     | one per area in the whole home: `name` `area.name`; `firmware` domain update, device_class firmware |
| `room_firmware.name`     | text     | required            |                                                                                                     |
| `room_firmware.firmware` | entities |                     |                                                                                                     |

## Media server

From `templates/media.yaml`.

### `media-server`

A media server's tile, what is being watched, and its requests, downloads, health and update chips; it brings its pop-up. The parts are Plex, Seerr, Radarr and Sonarr.

| Slot                  | Kind   | Required or default             | Found by |
| --------------------- | ------ | ------------------------------- | -------- |
| `streams`             | entity | required                        |          |
| `update`              | entity |                                 |          |
| `requests`            | object |                                 |          |
| `requests.pending`    | entity | required                        |          |
| `requests.processing` | entity | required                        |          |
| `movies`              | object |                                 |          |
| `movies.queue`        | entity | required                        |          |
| `movies.count`        | entity | required                        |          |
| `movies.health`       | entity |                                 |          |
| `movies.space`        | entity |                                 |          |
| `movies.calendar`     | entity |                                 |          |
| `shows`               | object |                                 |          |
| `shows.queue`         | entity | required                        |          |
| `shows.count`         | entity | required                        |          |
| `shows.wanted`        | entity |                                 |          |
| `shows.upcoming`      | entity |                                 |          |
| `shows.calendar`      | entity |                                 |          |
| `none`                | texts  | `['0','unknown','unavailable']` |          |

Brings `media-popup`.

### `media-popup`

The media server's pop-up, what is being watched, its requests, downloads, upcoming releases, library and update.

| Slot                  | Kind   | Required or default | Found by |
| --------------------- | ------ | ------------------- | -------- |
| `streams`             | entity | required            |          |
| `update`              | entity |                     |          |
| `requests`            | object |                     |          |
| `requests.pending`    | entity | required            |          |
| `requests.processing` | entity | required            |          |
| `movies`              | object |                     |          |
| `movies.queue`        | entity | required            |          |
| `movies.count`        | entity | required            |          |
| `movies.health`       | entity |                     |          |
| `movies.space`        | entity |                     |          |
| `movies.calendar`     | entity |                     |          |
| `shows`               | object |                     |          |
| `shows.queue`         | entity | required            |          |
| `shows.count`         | entity | required            |          |
| `shows.wanted`        | entity |                     |          |
| `shows.upcoming`      | entity |                     |          |
| `shows.calendar`      | entity |                     |          |

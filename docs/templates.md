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

A slot is resolved in this order: its value in `slots`; else, when the instance discovers, its discovery rule; else its default; else it stays unfilled, and the parts of the template that read it disappear. A required slot left unfilled, a slot the template neither declares nor retires ([Retired slots](#writing-a-template)), a slot of an unknown kind, an area Home Assistant does not know, or an unknown template is an error card that names the template and the place. Inside a nested template, the outer template and the place come first: `outer at card.item: inner: the slot entity is required`.

## Writing a template

A template has a `description`, its `slots`, optionally the slot paths it has `retired`, a `card`, optionally the `popups` it brings, and an `example` of its slots. Here it is by its name, as the MNML panel exports it:

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

**Fields.** An `object` slot, or an `objects` slot's every element, declares its `fields:`, each a slot of its own with a `kind`, and `required` or a `default`. A field's default fills in when the object lacks it; a field of the wrong kind, a required field left unfilled, or a field the slot neither declares nor retires is an error that names the slot and the field, and so is a path such as `[[lights.grup]]` that names no field. A slot without `fields:` takes any object, unchecked.

**Labels.** A slot or a field may carry `label`, its name in the editor (`Air conditioning` for `ac`); `help`, a line under its field; and `group`, the editor's panel it sits in (`Sensors`, `Lights`). Slots without a group sit in Basics when they are simple, and in a panel of their own when they are an `object` or `objects`. Drawing ignores all three.

**Retired slots.** `retired:` lists the slot paths a template takes without declaring them, dotted for an object's field: `retired: [meters, heating.batteries]`. A field's path holds for every element of an `objects` slot too. A value given for a retired path, by an instance or by an outer template, is taken and ignored: the template draws nothing from it, cannot read it, passes nothing of it on, and raises no error. It is how a slot removed while MNML is 0.x keeps the configurations that still give it working until the next major release, which removes the list. A retired path is no slot: discovery never fills it, the editors and the panel never show it, and `interface.json` does not record it. A `retired:` that is not a list of slot paths, or a path the template also declares, is an error naming the template. A dashboard the panel's builder makes or rebuilds leaves out every slot and field of a card that its template does not declare, a retired one included.

**Shapes.** A slot that several templates take, a meter, a vacuum, the daily checks, is declared once, as a shape in `templates/shapes.yaml` ([The shipped shapes](#shapes)), and a slot names it with `shape:`:

```yaml
slots:
  meters: { shape: meter, kind: objects, fields: { power: { required: true } } }
  energy: { shape: meter, label: Energy, group: Power }
```

A shape is a slot's spec under a name: its `kind`, its `fields`, `required`, a `default`, a `discover` rule, a `label`, `help` and a `group`. A slot that names it takes all of that, and its own keys win: `label`, `help`, `group`, `required`, `default` and `discover`. `kind: objects` makes it a list of an `object` shape, and `kind: object` one element of an `objects` shape; the shape's `discover` comes with it either way. An object shape's rule finds one object, so a `kind: objects` use of a shape that has one gives its own `per:` rule. `fields:` changes single fields of the shape, each with the same keys, and with `fields:` of its own for a field's fields; it names only fields the shape has, and keeps each field's kind, but for an `object` field taken as `objects` or an `objects` one as `object`, whether it gives a `kind:` or names a shape. A field may name a shape, and so may a shape: `vacuum_popup` is `vacuum` with what its pop-up shows required. Shapes are resolved when templates are read, the shipped ones and the home's own, so the engine, discovery and the editors see every slot written out. The MNML panel keeps a template of the home's own as written: its builder resolves the shapes wherever it draws, checks or lists the slots, shows a slot that names a shape by the shape's name, and saves the template with its `shape:` names ([Templates](editors.md#templates)). A template of the home's own may name a shipped shape. An unknown shape, a shape that uses itself, a field the shape does not have, or a kind it cannot take is an error that names the template and the slot, and the shapes it goes through to the one at fault; for a template of the home's own, its card says the shape could not be resolved, and the browser's console says why. A slot or a field written as anything but a mapping, such as `title:` with nothing after it, is left as it is for the slot checks, which name it: `the slot title has the kind none`.

**In a template's tree:**

- `'[[path]]'` as a whole value inserts the slot with its type: a string, a number, a list, an object. Inside a longer string it is text: `'#[[key]]-lights'`. A path reads into objects and lists: `[[nozzle.temperature]]`, `[[latency.0]]`.
- `*` in a path projects the rest of it over a list: `[[devices.*.update]]` is the list of every device's `update`, the devices without one skipped, and flattened when each is itself a list, as `[[rooms.*.firmware]]` is every room's firmware in one list. `?field` in place of the `*` keeps only the elements whose `field` is filled, and `!field` only those whose is not: `[[devices.?essential.connected]]` is the essential devices' connections. Only the elements of an `objects` list have fields to keep them by: over an `entities` or `texts` slot, or a list that holds anything but objects, `?field` and `!field` are an error. A projection works wherever a path does, in a value, in `if:` and `unless:`, and in `each:`; over an empty list it is an empty list, over an unfilled slot it is unfilled, over anything but a list it is an error, and so is one inside a longer string, since a list is not text:

  ```yaml
  chips:
    - if: devices.*.update
      type: status
      name: Update
      rules: [{ entities: ['[[devices.*.update]]'], color: amber, is: ['on'] }]
  ```

- An unfilled slot removes the key whose value is `'[[slot]]'`, or the list item. A string that interpolates an unfilled slot, or an empty one, is an error, since half a hash is never meant, and so is a `[[...]]` that holds anything but a slot path.
- `each: <list slot>` with `as: <name>` on a list item repeats it for every element, spliced into the list. Inside, `[[name]]` is the element, and the outer slots stay visible.
- `if: <slot>`, or `if: [a, b]` for any of several, keeps an item or a mapping only while the slot is filled: set, and not an empty list or object. `unless:` keeps it only while none is.
- `template: <name>` with `slots:` expands another template in place and gathers its pop-ups; keys beside it are added to what it draws, and win on a clash. A slot set to `null` and passed whole (`entity: '[[entity]]'`) reaches the inner template as `null`, so its slot is none there too, not its default; a slot left unset is left out, and the inner default applies.
- A key ending in `?` is dropped when its list or map comes out empty. Without the `?`, an empty list stays `[]`.
- In a list, an item that comes out a list is spliced into it: `entities: ['[[doors]]', '[[hood]]']` is one flat list.
- A word list that comes out empty names no state. So a rule writes `is: ['[[words]]']`, which comes out `is: []` and holds for no state, where `is: '[[words]]'` would drop the key and leave a rule that holds for every state; a rule on `not:` words takes `if: <words>`, and is left out while there are none.
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

**When something is wrong.** A subscription refused for any reason but an unknown command turns each template card into an error card that says why; an unknown command, a home without the integration, is an empty store. So is a store the integration could not read, which its log reports: its setup goes on, the cards draw the shipped templates, and a save is refused. A broken template of the home's own is an error card naming the template, like any other: one whose shapes cannot be resolved, for any reason, is kept as written and reported on the browser's console, so only the cards that draw it fail, and every other template of the store is served. A card that throws on a change is reported on the browser's console.

**The generator.** `build(home)` places the instances; the cards expand them, so the home's templates apply to a generated dashboard too. `drawn(home)` and `problems(home)` expand with the shipped templates only, and cannot see the home's.

## Discovery

A slot's `discover:` rule runs in the browser on Home Assistant's areas, devices, entities and states:

- `area.name`, `area.icon`, `area.id`, `area.temperature`, `area.humidity`: the area's own values, the last two the sensors chosen in its settings.
- A filter with any of these keys, all of which must hold:

  | Key               | Holds when                                                                                                                                                                                                                                                                                                               |
  | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `domain`          | the entity id starts with it (`light`)                                                                                                                                                                                                                                                                                   |
  | `device_class`    | the state's `device_class` is it                                                                                                                                                                                                                                                                                         |
  | `platform`        | the entity comes from that integration                                                                                                                                                                                                                                                                                   |
  | `translation_key` | the integration's own kind of entity (`protection`, `connected_to_control`)                                                                                                                                                                                                                                              |
  | `entity_category` | `none` (a primary entity), `diagnostic` or `config`                                                                                                                                                                                                                                                                      |
  | `unit`            | the state's `unit_of_measurement` is it (`W`)                                                                                                                                                                                                                                                                            |
  | `state_class`     | the state's `state_class` is it (`measurement`, `total_increasing`)                                                                                                                                                                                                                                                      |
  | `attribute`       | for every attribute it names, the state's value is the value given, or a list that holds it: `attribute: { hvac_modes: cool }` holds for a climate that can cool. The value is compared as the attribute's type: `min_temp: 5` and `min_temp: '5'` both hold for the number 5, and `fan_speed: 3` holds for the text `3` |
  | `name`            | every word is in the entity's friendly name, in any case and any order                                                                                                                                                                                                                                                   |
  | `manufacturer`    | the device's manufacturer contains it, in any case                                                                                                                                                                                                                                                                       |
  | `model`           | the device's model contains it, in any case                                                                                                                                                                                                                                                                              |
  | `entry_type`      | the device's entry type is it: `service`, an online service such as a weather forecast, or `none`                                                                                                                                                                                                                        |
  | `integration`     | the entity's device has an entity from that integration, so a utility meter attached to a Shelly plug is on a device of `shelly`; an entity with no device is of its own platform                                                                                                                                        |
  | `label`           | the entity, or its device, has that Home Assistant label (by its id)                                                                                                                                                                                                                                                     |
  | `exclude`         | the entity does not match the filter inside it                                                                                                                                                                                                                                                                           |

  An entity is in the area when its own area is the area, or when it has none and its device's is; hidden entities are skipped. An `entity` slot ranks its matches and takes the best: a primary entity before a diagnostic or configuration one, then one with a usable state before one whose state is `unknown` or `unavailable` before one with no state at all, then one without a name of its own (the main entity of its device) before one with, then the lowest entity id. When the best are alike on all of that, the slot has a _tie_: the trace lists them, and the card editor offers them as choices. An `entities` slot takes every match, in the order of their ids. A `text` slot found by a filter takes the entity id of the best match, a key two slots agree on, as a room's speaker and its player do.

- A list of rules is tried in order, the first that finds something winning.
- `fields:` fills an `object` slot field by field.
- `per: device` fills an `objects` slot with one object per device that has a match (`where:`), in the order of the devices' names, each field found within that device; an entity without a device, such as a group or a template helper, is in no device's object. `per: area` gives one per area. `scope: all` searches the whole home rather than the area, and puts each object it finds in its own area, its device's, so its `area.*` values read that area whatever area the template is placed in.
- `device:` on a `fields:` rule anchors it on a device ([Devices find themselves](#devices-find-themselves)).
- Without an area, the area values and the rules over the area find nothing; only `scope: all` rules run.

**The system tiles find their own entities.** `tailscale`, `unifi-network`, `proxmox-server`, `adguard`, `home-assistant` and `media-server` have `scope: all` rules on the integration's `platform` and `translation_key`: a tile placed with no `area` and no `slots` is filled from the home, its chips included, such as Tailscale's Relayed from every device's UDP sensor and Proxmox's Guests from every guest's status. What the integrations do not expose stays unfilled and is set in `slots`: which Tailscale devices are `essential`, which Tailscale's Offline and Update chips count, the UniFi `wifi` and `clients`, the Proxmox outlet, storage, disks and checks, and the Radarr free space, which has no translation key. Home Assistant's Firmware chip counts the firmware its pop-up lists, its own `firmware` and each room's, or `all_firmware` when that is set. The `glances` strip finds the guests' running states, the network devices' states and Radarr's health by the same rules, and every lock of the home, each with its own area's id as the key of its room; the essential Tailscale devices and the cars are set in `slots`.

**Labels steer discovery.** An entity that carries the Home Assistant label `mnml_<slot>` is that slot's value, ahead of any rule: label a window sensor `mnml_window` and it is the `window` of its room, whatever the rule would have picked; label several entities `mnml_batteries` and an `entities` slot takes them all. On a device, the label gives the slot those of the device's entities that fit the slot's own rule, its domain, device class and the rest: a lock labelled `mnml_lock` gives the room its `lock` entity, not the door sensor beside it, and a sensor labelled `mnml_batteries` its battery, not its temperature. On an `object` or `objects` slot, the label on a device, or on one of its entities, names that device: the slot is filled from it by the slot's own field rules, whatever device its anchor would have taken. A `mnml_vacuum` on a robot fills the room's `vacuum` from that robot and its dock; an `objects` slot takes one object per labelled device, an `object` slot the first by name, and a labelled device that fills nothing leaves the slot to its rules. The label is looked for in the area, or in the whole home when the template has no area. This is the way for someone who does not edit templates to say "this one" in Home Assistant itself.

**Explaining.** `explain(template, area, registries)` (`src/templates/explain.ts`) returns, for every slot with a rule, the value `discover()` gives and the steps behind it, from the same code, so the two cannot differ (`explain.test.ts` checks that for every template, area and home of the corpus). A step is one rule tried: the rule in words, the entities that matched, the ones taken, and up to five that nearly matched, each with its reason ("has no device class", "has device class battery, not window"). The words of a rule ("sensor with translation key status, in the category primary") are those the panel's slot editor writes it in, from one table in `src/templates/discover.ts`. A step of an anchored rule also lists the devices that fit, best first, and the ones taken. The trace of an `object` slot filled from a device also lists, as `devices`, the devices its own anchor or label found that fill the slot, each with its id, its name as Home Assistant shows it (the name given in Home Assistant first) and its area's name, and, as `device`, the one chosen; the devices of a step inside it, such as the vacuum's dock, are its field's, not the slot's. `fromDevice(spec, device, area, registries)` (`src/templates/discover.ts`) fills an `object` slot from a device given, by the slot's field rules, as its anchor fills it. A slot that ends up empty says why: nothing of that kind in the area, or where it found one in another area; an anchored one names the device that fits but lacks a field the slot requires. The panel's slot editor shows it under "Try it in", and the card editor of a template card offers the tied candidates of a slot's own rule under its fields ("Temperature: 2 fit equally. Pick one"), the one in use marked, and never a tie of a field inside an object; picking one writes it into the card's `slots`, where it stays whatever the registries do, and "Use what the area found" gives it back. For an object filled from a device it names the device and offers the others that fit ([The template card's editor](editors.md#the-template-cards-editor)).

The same registries always give the same values; the card discovers again when Home Assistant replaces its registries, not on a state change. A rule that finds nothing leaves its slot unfilled.

### Devices find themselves

`device:` on a `fields:` rule takes the devices that hold an entity matching the filter, or any filter of a list, and fills the fields among each device's entities and those of its `via_device` relatives: the device it is connected through, and the devices connected through it. So a robot vacuum's dock is found whichever of the two Home Assistant links to the other. A field is found on the device itself first, and on its relatives only when the device has none.

- The anchor is looked for in the area, or in the whole home with `scope: all`; its relatives are taken wherever they are. With `scope: all`, each object is in its own area, its device's, or the entity's own when it has no device, and its `area.*` values read that area.
- An anchored rule inside another, such as the vacuum's `dock`, owns the device it takes: the outer device takes none of that device's entities, so a dock's problem sensors are the dock's warnings and never the vacuum's too. And the inner anchor never takes from the device it is inside: a dock with no error sensor of its own has no error, not the vacuum's.
- An `object` slot takes one device: the one that fills the most fields, then the first by device name. It never mixes the fields of two devices. An `objects` slot takes one object per device, in the order of the devices' names. A device whose object lacks a required field gives none.
- An entity that matches the anchor and has no device, such as a template helper, is an object of its own, its fields found on it alone.
- Inside a device, a rule without `scope` looks at the device and its relatives, and `scope: area` at the device's area, for what belongs to it without a link, such as a radiator's valves. An anchored rule with `scope: area` takes the device and its relatives first and the area's devices after, for a dock that Home Assistant does not link to its vacuum; a device of the area that Home Assistant links to another device, such as another vacuum's dock, is not taken.
- `per: device` stays the plain way to make one object per device, each field found on that device alone.

```yaml
vacuum:
  shape: vacuum_popup
  discover:
    device: { domain: vacuum }
    fields:
      entity: { domain: vacuum }
      status: [{ domain: sensor, translation_key: status }, { domain: sensor, name: status }]
      battery: { domain: sensor, device_class: battery }
      dock:
        device: [{ domain: sensor, translation_key: dock_error }, { model: dock }]
        scope: area
        fields:
          error: [{ domain: sensor, translation_key: dock_error }, { domain: sensor, name: error }]
```

**The room's devices.** The room's rules for its richer slots read the integrations' translation keys first, and the English words of the entities' names after, for an integration that gives none. What each one recognises:

| Slot         | The device                                                                                                                                                         | Its fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heating`    | holds a climate whose `hvac_modes` do not hold `cool`; a climate whose modes are not known counts: Better Thermostat, a valve, a generic thermostat                | `entity` that climate; `thermostats` one per device of the area with a valve position (`valve_position`, or the words "valve position"), each with its battery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ac`         | holds a climate whose `hvac_modes` hold `cool`, so an air conditioner is never the heating                                                                         | `entity` that climate; `power_saving` and `dehumidifier` by `power_saving_mode` and `dehumidifier_level`, or by those words; `energy` its meter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `vacuum`     | holds a vacuum                                                                                                                                                     | Roborock's keys (`status`, `vacuum_error`, `current_room`, `clean_percent`, `cleaning_area`, `cleaning_time`, `last_clean_end`, `mop_attached`, `water_box_attached`, `total_cleaning_count`, `total_cleaning_area`, `total_cleaning_time`), or the same words; `map` its image; `routines` its primary buttons; `settings` its configuration selects but the selected map; `warnings` its problem sensors; `dock` the relative, or else the area's device that Home Assistant links to no other device, with a dock error sensor or a model that says dock, and its switches for dust emptying, mop drying and mop washing, its mop drying time and its problem sensors. Not `consumables` |
| `printer3d`  | is a PrusaLink printer (`platform: prusalink`)                                                                                                                     | PrusaLink's keys: the printer state, `progress`, `filename`, `material`, `print_speed`, `print_start`, `print_finish`, the nozzle's and the heatbed's temperature and target, `camera`, and the pause, resume, continue and cancel buttons. Not `outlet`, a plug of its own                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `speakers`   | holds a media player of device class `speaker`, or one from Sonos                                                                                                  | `key` and `entity` that player; Sonos's keys: `bass`, `treble`, `balance`, `loudness`, and for `tv`, `subwoofer` and `surround` `audio_input_format`, `night_mode`, `dialog_level`, `audio_delay`, `sub_enabled`, `sub_gain`, `surround_enabled`, `surround_level`, `music_surround_level`, `surround_mode`, or their words                                                                                                                                                                                                                                                                                                                                                                 |
| `media`      | one per device with a media player                                                                                                                                 | `entity` that player; `key` its entity id when it is a speaker, the `key` of its speaker, so its card opens the speaker's pop-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `outlets`    | one per device with a switch of device class `outlet`                                                                                                              | `entity` that switch; `energy` its meter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `appliances` | holds SmartThings' `washer_machine_state`, `dryer_machine_state` or `dishwasher_machine_state`, or Home Connect's `operation_state` named like a washer or a dryer | `entity` that state; `remaining` SmartThings' `completion_time` or Home Connect's `program_finish_time`; `power` a power sensor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

A meter, `ac.energy` or `outlets.energy`, is `power`, a sensor of device class `power`; `today`, a sensor of device class `energy` from a Utility Meter helper attached to the device; and `total`, one of device class `energy` that is not a utility meter.

## How it runs

The template card expands its template in the browser, once the store has answered ([Where templates live](#where-templates-live)) and the families its expansion reaches have loaded: with explicit slots as soon as it is configured, if they already have and its families are loaded, otherwise as soon as they are; a card placed by area, or discovering in the whole home, also waits for `hass`. It creates the expanded card with Home Assistant's `loadCardHelpers()`, hands it every `hass`, and evaluates its `visibility` itself. Its size is the drawn card's own; before that card exists, the size a card of its type takes, from the template's own card when nothing is expanded yet, and, while its family has not arrived, from the card type and size the bundle's index keeps for each family template. It discovers again when Home Assistant replaces its registries, expands again when the store changes while it is on the page, and catches up on a change it missed when it comes back; it draws again only when the expansion changed. While it is on the page, it gives its pop-ups to the popups card, which opens them by hash like its own. A hash two cards give is a console error, reported once, and the first keeps it; a hash the popups card has itself stays its own.

**Families on need.** The bundle carries the shared fragments of `common.yaml`, and the shapes of `shapes.yaml` for the home's own templates; every other shipped family (`room`, `lights`, `car` and the rest) is a JSON file beside it, `mnml-cards-<family>.json`, with its shapes resolved. An expansion that reaches a shipped template not loaded yet notes it and carries on, so the card fetches every family it is missing at once, and expands again; a room takes about two rounds, served from the browser's cache after the first load. A room without a vacuum never fetches the vacuum's family. A family that cannot be fetched, such as a file left out of a hand install, turns the cards that need it into error cards naming the file, and is reported on the browser's console. A file that is missing (404, or 410) is not fetched again until the page is reloaded; any other failure, such as a dropped connection, is tried again 30 seconds later, on the next update, by every card that needs it, including one drawn in the meantime.

`src/templates/expand.ts` is the whole language as a pure function, `expand(templates, instance, discovered, later, marking)`, the last three optional: the slots discovery found, the names of the shipped templates not loaded yet, and the parts to mark with their path for the panel. `expandDashboard(templates, config)` expands every instance of a dashboard at once, so a tool or a test can see what a dashboard of templates draws without a browser. It keeps an instance's layout keys on what it draws, the instance's `visibility` after the drawn card's own, and does not discover: an instance's `area` is ignored, and it draws from its `slots` alone.

## Versions

Templates, their slots and the slot shapes are part of MNML's public interface, which `interface.json` records ([AGENTS.md](../AGENTS.md)). A new template, a new optional slot, or a change in what a template draws is a minor release. While MNML is 0.x, a minor release may also rename or remove a template or a slot, or change a slot's meaning, and the release notes list each such change with how to move to the new one; from 1.0 that is a major release. A slot removed while MNML is 0.x is retired on its template ([Retired slots](#writing-a-template)), so a configuration that still gives it draws as before, until the next major release.

## Roles

A template is one of three, by how it is used, which MNML works out and nothing declares:

- **A tile** is placed on a dashboard: no other template uses it. The shipped ones are `room`, `person`, `car`, `proxmox-server`, `unifi-network`, `tailscale`, `adguard`, `home-assistant`, `media-server`, `glances` and `section-heading`.
- **A pop-up** is a card with a `hash` and no `type`, which a tile brings.
- **A part** is used inside another template, by `template:`.

The home's own templates count, so a template of the home that uses a shipped tile makes it a part. The library and the template card's gallery show the tiles first, and the pop-ups and parts on request.

## The shipped templates

Each template's slots and the rules that find them. A slot without a rule is set by hand. A field's row reads `slot.field`, and for an `objects` slot names the field of each element. A slot passed whole to a card's or a control's key takes that key's shape, in [keys.md](keys.md).

## Shapes

From `templates/shapes.yaml`. Every shape is an `object`; a slot takes a list of one with `kind: objects`. A field that names a shape is listed by that shape.

| Shape                 | Fields                                                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meter`               | `power`, `today`, `total`                                                                                                                                                                                                                            |
| `outlet`              | `entity` (required), `energy` (`meter`)                                                                                                                                                                                                              |
| `checks_actions`      | `run`, `stop`, `running`, all required                                                                                                                                                                                                               |
| `checks`              | `failed` (required), `warnings`, `last_run` (required), `overdue` (required), `actions` (`checks_actions`)                                                                                                                                           |
| `lights`              | `group` (required), `color`, `members` (`light_member`, a list), `scenes`, `active_scene`                                                                                                                                                            |
| `light_member`        | `entity`, `members`                                                                                                                                                                                                                                  |
| `heating`             | `entity` (required), `preset`, `thermostats` (`thermostat`, a list)                                                                                                                                                                                  |
| `thermostat`          | `valve`, `battery`                                                                                                                                                                                                                                   |
| `ac`                  | `entity` (required), `fan`, `swing`, `horizontal_swing`, `power_saving`, `dehumidifier`, `energy` (`meter`)                                                                                                                                          |
| `vacuum`              | `entity` (required), `status`, `error`, `battery`, `current_room`, `progress`, `area`, `time`, `last_clean`, `mop_attached`, `water_box_attached`, `totals`, `map`, `routines`, `settings`, `consumables` (`consumable`, a list), `warnings`, `dock` |
| `vacuum_popup`        | `vacuum`, with each consumable's `entity`, and each of the dock's consumables' `entity`, required                                                                                                                                                    |
| `consumable`          | `entity`, `reset`                                                                                                                                                                                                                                    |
| `printer3d`           | `entity` (required), `progress`, `filename`, `material`, `speed`, `start`, `finish`, `nozzle` and `bed` (`printer3d_heater`), `camera`, `actions` (`printer3d_actions`, required), `outlet` (`outlet`)                                               |
| `printer3d_popup`     | `printer3d`, with `progress`, `filename`, `material`, `speed`, `start`, `finish`, `nozzle` and `bed` and their `temperature`, and the outlet's `energy.power` required                                                                               |
| `printer3d_heater`    | `temperature`, `target`                                                                                                                                                                                                                              |
| `printer3d_actions`   | `pause`, `resume`, `continue`, `cancel`                                                                                                                                                                                                              |
| `camera`              | `entity` (required), `motion`, `person`, `doorbell`                                                                                                                                                                                                  |
| `cover`               | `entity` (required), `garage`                                                                                                                                                                                                                        |
| `fan`                 | `entity` (required), `quality`                                                                                                                                                                                                                       |
| `humidifier`          | `entity` (required)                                                                                                                                                                                                                                  |
| `appliance`           | `entity` (required), `remaining`, `power`                                                                                                                                                                                                            |
| `pet`                 | `feed` (required), `fed` (required), `food`, `litter`                                                                                                                                                                                                |
| `plant`               | `moisture` (required)                                                                                                                                                                                                                                |
| `player`              | `entity` (required), `key`                                                                                                                                                                                                                           |
| `speaker`             | `key` and `entity` (required), `bass`, `treble`, `balance`, `loudness`, `tv`, `subwoofer`, `surround`                                                                                                                                                |
| `diffuser`            | `entity`, `amount`, both required                                                                                                                                                                                                                    |
| `person_device`       | `key` (required), `name`, `icon`, `tracker`, `battery`, `battery_state`, `connection`, `network`, `storage`, `focus`, `focus_name`, `activity`, `permission`                                                                                         |
| `person_device_popup` | `person_device`, with `battery`, `battery_state`, `connection`, `network`, `storage`, `focus`, `activity` and `permission` required                                                                                                                  |
| `health`              | `steps`, `distance`, `flights_climbed`, `active_energy`, `resting_energy`, all required                                                                                                                                                              |
| `guest`               | `host`, `status` (required), `cpu`, `memory`, `disk`                                                                                                                                                                                                 |
| `server_temperatures` | `cpu`, `root_disk`, both required                                                                                                                                                                                                                    |
| `server_disks`        | `pool`, `failing`, `life_left`, all required                                                                                                                                                                                                         |
| `server_backups`      | `last` (required), `problem` (required), `bucket`                                                                                                                                                                                                    |
| `notifications`       | `messages` (required), `clear`, `sources`                                                                                                                                                                                                            |
| `message_source`      | `source`, `name`, `entity`                                                                                                                                                                                                                           |
| `system_backups`      | `last` (required), `attempted`, `problem`                                                                                                                                                                                                            |
| `room_firmware`       | `name` (required), `firmware`                                                                                                                                                                                                                        |
| `wifi`                | `key` (required), `enabled` (required), `qr`, `switchable`                                                                                                                                                                                           |
| `clients`             | `entity` (required), `names`, `networks` (required)                                                                                                                                                                                                  |
| `router`              | `cpu`, `temperature`, both required                                                                                                                                                                                                                  |
| `tailscale_device`    | `connected` (required), `essential`, `ip_address`, `last_seen`, `expires`, `update`, `udp`                                                                                                                                                           |
| `media_requests`      | `pending`, `processing`, both required                                                                                                                                                                                                               |
| `movies`              | `queue` (required), `count` (required), `health`, `space`, `calendar`                                                                                                                                                                                |
| `shows`               | `queue` (required), `count` (required), `wanted`, `upcoming`, `calendar`                                                                                                                                                                             |
| `lock_words`          | `secured`, `selectivelocked`; by default `Locked` and `Partly locked`                                                                                                                                                                                |
| `alarm_words`         | `doorsonly`, `doorstiltcabin`; by default `Doors only` and `Armed`                                                                                                                                                                                   |

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

### `checks-actions`

The daily checks' Run and Stop controls, Run shown while they are not running and Stop while they are.

| Slot              | Kind   | Required or default | Found by |
| ----------------- | ------ | ------------------- | -------- |
| `actions`         | object | required            |          |
| `actions.run`     | entity | required            |          |
| `actions.stop`    | entity | required            |          |
| `actions.running` | entity | required            |          |

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

A folding table of meters, now, today and in total, the heading summing what they used today.

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

### `cover-card`

A cover, such as a blind, a shade or a garage door, with its position slider when it has one, and its open, stop and close buttons.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |
| `garage` | flag   |                     |          |

### `fan-card`

A fan or air purifier with its air quality, its speed slider and its power toggle.

| Slot      | Kind   | Required or default | Found by |
| --------- | ------ | ------------------- | -------- |
| `entity`  | entity | required            |          |
| `quality` | entity |                     |          |

### `humidifier-card`

A humidifier or dehumidifier with its target humidity slider and its power toggle.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |

### `camera-card`

A camera's live picture.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `entity` | entity | required            |          |

### `camera-activity`

A folding list of what the cameras of a room detect: motion, a person, a ring at the door. Orange while detected.

| Slot               | Kind    | Required or default | Found by |
| ------------------ | ------- | ------------------- | -------- |
| `cameras`          | objects |                     |          |
| `cameras.entity`   | entity  | required            |          |
| `cameras.motion`   | entity  |                     |          |
| `cameras.person`   | entity  |                     |          |
| `cameras.doorbell` | entity  |                     |          |

### `appliance-card`

A washer, dryer or dishwasher with its cycle state, the time left and its power draw; blue while a cycle runs.

| Slot        | Kind   | Required or default | Found by |
| ----------- | ------ | ------------------- | -------- |
| `entity`    | entity | required            |          |
| `remaining` | entity |                     |          |
| `power`     | entity |                     |          |

### `pet-card`

A pet's feeder with when it last ate, the food and litter levels, and a feed button.

| Slot     | Kind   | Required or default | Found by |
| -------- | ------ | ------------------- | -------- |
| `feed`   | entity | required            |          |
| `fed`    | entity | required            |          |
| `food`   | entity |                     |          |
| `litter` | entity |                     |          |

### `plants`

A folding list of the plants' soil moisture, driest first, orange under 30 % and red under 15 %.

| Slot              | Kind    | Required or default | Found by |
| ----------------- | ------- | ------------------- | -------- |
| `plants`          | objects |                     |          |
| `plants.moisture` | entity  | required            |          |
| `low`             | number  | `30`                |          |
| `critical`        | number  | `15`                |          |

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

| Slot                  | Kind    | Required or default | Found by |
| --------------------- | ------- | ------------------- | -------- |
| `key`                 | text    | required            |          |
| `name`                | text    | required            |          |
| `entity`              | entity  | required            |          |
| `preset`              | flag    |                     |          |
| `thermostats`         | objects |                     |          |
| `thermostats.valve`   | entity  | required            |          |
| `thermostats.battery` | entity  |                     |          |
| `low`                 | number  | `20`                |          |
| `critical`            | number  | `5`                 |          |

Retired ([Retired slots](#writing-a-template)): `batteries`.

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
| `vacuum.consumables.entity`        | entity   | required            |          |
| `vacuum.consumables.reset`         | entity   |                     |          |
| `vacuum.warnings`                  | entities |                     |          |
| `vacuum.dock`                      | object   |                     |          |
| `vacuum.dock.error`                | entity   |                     |          |
| `vacuum.dock.dust_emptying`        | entity   |                     |          |
| `vacuum.dock.mop_drying`           | entity   |                     |          |
| `vacuum.dock.mop_drying_time_left` | entity   |                     |          |
| `vacuum.dock.mop_washing`          | entity   |                     |          |
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
| `speaker.bass`                       | entity |                     |          |
| `speaker.treble`                     | entity |                     |          |
| `speaker.balance`                    | entity |                     |          |
| `speaker.loudness`                   | entity |                     |          |
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

A room's tile, its temperature and humidity, its window, door, lock and climate chips, its lights, and its leak and low battery chips; it brings the room's pop-ups.

| Slot                                  | Kind     | Required or default | Found by                                                                                                                                                                                                     |
| ------------------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `key`                                 | text     | required            | `area.id`                                                                                                                                                                                                    |
| `name`                                | text     | required            | `area.name`                                                                                                                                                                                                  |
| `icon`                                | icon     | `'mdi:texture-box'` | `area.icon`                                                                                                                                                                                                  |
| `temperature`                         | entity   |                     | `area.temperature`, then domain sensor, device_class temperature                                                                                                                                             |
| `humidity`                            | entity   |                     | `area.humidity`, then domain sensor, device_class humidity                                                                                                                                                   |
| `window`                              | entity   |                     | domain binary_sensor, device_class window                                                                                                                                                                    |
| `door`                                | entity   |                     | domain binary_sensor, device_class door                                                                                                                                                                      |
| `lock`                                | entity   |                     | domain lock                                                                                                                                                                                                  |
| `lights`                              | object   |                     | `group` domain light, platform group, then domain light; `members` one per device with domain light: `entity` domain light; `scenes` domain scene                                                            |
| `lights.group`                        | entity   | required            |                                                                                                                                                                                                              |
| `lights.color`                        | flag     |                     |                                                                                                                                                                                                              |
| `lights.members`                      | objects  |                     |                                                                                                                                                                                                              |
| `lights.members.entity`               | entity   | required            |                                                                                                                                                                                                              |
| `lights.members.members`              | entities |                     |                                                                                                                                                                                                              |
| `lights.scenes`                       | entities |                     |                                                                                                                                                                                                              |
| `lights.active_scene`                 | entity   |                     |                                                                                                                                                                                                              |
| `heating`                             | object   |                     | the device with a climate whose `hvac_modes` do not hold `cool`: `entity` that climate; `thermostats` one per device of the area with a valve position ([Devices find themselves](#devices-find-themselves)) |
| `heating.entity`                      | entity   | required            |                                                                                                                                                                                                              |
| `heating.preset`                      | flag     |                     |                                                                                                                                                                                                              |
| `heating.thermostats`                 | objects  |                     |                                                                                                                                                                                                              |
| `heating.thermostats.valve`           | entity   | required            |                                                                                                                                                                                                              |
| `heating.thermostats.battery`         | entity   |                     |                                                                                                                                                                                                              |
| `ac`                                  | object   |                     | the device with a climate whose `hvac_modes` hold `cool`: `entity`, `power_saving`, `dehumidifier`, `energy`                                                                                                 |
| `ac.entity`                           | entity   | required            |                                                                                                                                                                                                              |
| `ac.fan`                              | flag     |                     |                                                                                                                                                                                                              |
| `ac.swing`                            | flag     |                     |                                                                                                                                                                                                              |
| `ac.horizontal_swing`                 | flag     |                     |                                                                                                                                                                                                              |
| `ac.power_saving`                     | entity   |                     |                                                                                                                                                                                                              |
| `ac.dehumidifier`                     | entity   |                     |                                                                                                                                                                                                              |
| `ac.energy`                           | object   |                     |                                                                                                                                                                                                              |
| `ac.energy.power`                     | entity   | required            |                                                                                                                                                                                                              |
| `ac.energy.today`                     | entity   |                     |                                                                                                                                                                                                              |
| `ac.energy.total`                     | entity   |                     |                                                                                                                                                                                                              |
| `vacuum`                              | object   |                     | the device with a vacuum, and its relatives: every field but `consumables`; `dock` the relative, or the area's device, with a dock error or a dock model                                                     |
| `vacuum.entity`                       | entity   | required            |                                                                                                                                                                                                              |
| `vacuum.status`                       | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.error`                        | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.battery`                      | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.current_room`                 | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.progress`                     | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.area`                         | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.time`                         | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.last_clean`                   | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.mop_attached`                 | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.water_box_attached`           | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.totals`                       | object   |                     |                                                                                                                                                                                                              |
| `vacuum.totals.count`                 | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.totals.area`                  | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.totals.time`                  | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.map`                          | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.routines`                     | entities |                     |                                                                                                                                                                                                              |
| `vacuum.settings`                     | entities |                     |                                                                                                                                                                                                              |
| `vacuum.consumables`                  | objects  |                     |                                                                                                                                                                                                              |
| `vacuum.consumables.entity`           | entity   | required            |                                                                                                                                                                                                              |
| `vacuum.consumables.reset`            | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.warnings`                     | entities |                     |                                                                                                                                                                                                              |
| `vacuum.dock`                         | object   |                     |                                                                                                                                                                                                              |
| `vacuum.dock.error`                   | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.dock.dust_emptying`           | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.dock.mop_drying`              | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.dock.mop_drying_time_left`    | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.dock.mop_washing`             | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.dock.consumables`             | objects  |                     |                                                                                                                                                                                                              |
| `vacuum.dock.consumables.entity`      | entity   | required            |                                                                                                                                                                                                              |
| `vacuum.dock.consumables.reset`       | entity   |                     |                                                                                                                                                                                                              |
| `vacuum.dock.warnings`                | entities |                     |                                                                                                                                                                                                              |
| `printer3d`                           | object   |                     | the device from `prusalink`: every field but `outlet`                                                                                                                                                        |
| `printer3d.entity`                    | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.progress`                  | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.filename`                  | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.material`                  | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.speed`                     | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.start`                     | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.finish`                    | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.nozzle`                    | object   | required            |                                                                                                                                                                                                              |
| `printer3d.nozzle.temperature`        | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.nozzle.target`             | entity   |                     |                                                                                                                                                                                                              |
| `printer3d.bed`                       | object   | required            |                                                                                                                                                                                                              |
| `printer3d.bed.temperature`           | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.bed.target`                | entity   |                     |                                                                                                                                                                                                              |
| `printer3d.camera`                    | entity   |                     |                                                                                                                                                                                                              |
| `printer3d.actions`                   | object   | required            |                                                                                                                                                                                                              |
| `printer3d.actions.pause`             | entity   |                     |                                                                                                                                                                                                              |
| `printer3d.actions.resume`            | entity   |                     |                                                                                                                                                                                                              |
| `printer3d.actions.continue`          | entity   |                     |                                                                                                                                                                                                              |
| `printer3d.actions.cancel`            | entity   |                     |                                                                                                                                                                                                              |
| `printer3d.outlet`                    | object   |                     |                                                                                                                                                                                                              |
| `printer3d.outlet.entity`             | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.outlet.energy`             | object   |                     |                                                                                                                                                                                                              |
| `printer3d.outlet.energy.power`       | entity   | required            |                                                                                                                                                                                                              |
| `printer3d.outlet.energy.today`       | entity   |                     |                                                                                                                                                                                                              |
| `printer3d.outlet.energy.total`       | entity   |                     |                                                                                                                                                                                                              |
| `cameras`                             | objects  |                     | one per device with domain camera: `entity` domain camera                                                                                                                                                    |
| `cameras.entity`                      | entity   | required            |                                                                                                                                                                                                              |
| `cameras.motion`                      | entity   |                     |                                                                                                                                                                                                              |
| `cameras.person`                      | entity   |                     |                                                                                                                                                                                                              |
| `cameras.doorbell`                    | entity   |                     |                                                                                                                                                                                                              |
| `covers`                              | objects  |                     | one per device with domain cover: `entity` domain cover                                                                                                                                                      |
| `covers.entity`                       | entity   | required            |                                                                                                                                                                                                              |
| `covers.garage`                       | flag     |                     |                                                                                                                                                                                                              |
| `fans`                                | objects  |                     | one per device with domain fan: `entity` domain fan                                                                                                                                                          |
| `fans.entity`                         | entity   | required            |                                                                                                                                                                                                              |
| `fans.quality`                        | entity   |                     |                                                                                                                                                                                                              |
| `humidifiers`                         | objects  |                     | one per device with domain humidifier: `entity` domain humidifier                                                                                                                                            |
| `humidifiers.entity`                  | entity   | required            |                                                                                                                                                                                                              |
| `appliances`                          | objects  |                     | each device with a washer, dryer or dishwasher state, from SmartThings or Home Connect: `entity`, `remaining`, `power`                                                                                       |
| `appliances.entity`                   | entity   | required            |                                                                                                                                                                                                              |
| `appliances.remaining`                | entity   |                     |                                                                                                                                                                                                              |
| `appliances.power`                    | entity   |                     |                                                                                                                                                                                                              |
| `pets`                                | objects  |                     |                                                                                                                                                                                                              |
| `pets.feed`                           | entity   | required            |                                                                                                                                                                                                              |
| `pets.fed`                            | entity   | required            |                                                                                                                                                                                                              |
| `pets.food`                           | entity   |                     |                                                                                                                                                                                                              |
| `pets.litter`                         | entity   |                     |                                                                                                                                                                                                              |
| `plants`                              | objects  |                     |                                                                                                                                                                                                              |
| `plants.moisture`                     | entity   | required            |                                                                                                                                                                                                              |
| `media`                               | objects  |                     | one per device with domain media_player: `entity` domain media_player; `key` its entity id when it is a speaker                                                                                              |
| `media.entity`                        | entity   | required            |                                                                                                                                                                                                              |
| `media.key`                           | text     |                     |                                                                                                                                                                                                              |
| `speakers`                            | objects  |                     | each device with a media player of device class speaker, or from Sonos: every field                                                                                                                          |
| `speakers.key`                        | text     | required            |                                                                                                                                                                                                              |
| `speakers.entity`                     | entity   | required            |                                                                                                                                                                                                              |
| `speakers.bass`                       | entity   |                     |                                                                                                                                                                                                              |
| `speakers.treble`                     | entity   |                     |                                                                                                                                                                                                              |
| `speakers.balance`                    | entity   |                     |                                                                                                                                                                                                              |
| `speakers.loudness`                   | entity   |                     |                                                                                                                                                                                                              |
| `speakers.tv`                         | object   |                     |                                                                                                                                                                                                              |
| `speakers.tv.input_format`            | entity   |                     |                                                                                                                                                                                                              |
| `speakers.tv.night_sound`             | entity   | required            |                                                                                                                                                                                                              |
| `speakers.tv.speech_enhancement`      | entity   | required            |                                                                                                                                                                                                              |
| `speakers.tv.audio_delay`             | entity   | required            |                                                                                                                                                                                                              |
| `speakers.subwoofer`                  | object   |                     |                                                                                                                                                                                                              |
| `speakers.subwoofer.enabled`          | entity   | required            |                                                                                                                                                                                                              |
| `speakers.subwoofer.gain`             | entity   | required            |                                                                                                                                                                                                              |
| `speakers.surround`                   | object   |                     |                                                                                                                                                                                                              |
| `speakers.surround.enabled`           | entity   | required            |                                                                                                                                                                                                              |
| `speakers.surround.level`             | entity   | required            |                                                                                                                                                                                                              |
| `speakers.surround.music_level`       | entity   | required            |                                                                                                                                                                                                              |
| `speakers.surround.music_full_volume` | entity   | required            |                                                                                                                                                                                                              |
| `outlets`                             | objects  |                     | one per device with domain switch, device_class outlet: `entity` domain switch, device_class outlet; `energy` its meter                                                                                      |
| `outlets.entity`                      | entity   | required            |                                                                                                                                                                                                              |
| `outlets.energy`                      | object   |                     |                                                                                                                                                                                                              |
| `outlets.energy.power`                | entity   |                     |                                                                                                                                                                                                              |
| `outlets.energy.today`                | entity   |                     |                                                                                                                                                                                                              |
| `outlets.energy.total`                | entity   |                     |                                                                                                                                                                                                              |
| `diffuser`                            | object   |                     |                                                                                                                                                                                                              |
| `diffuser.entity`                     | entity   | required            |                                                                                                                                                                                                              |
| `diffuser.amount`                     | entity   | required            |                                                                                                                                                                                                              |
| `batteries`                           | entities |                     | domain sensor, device_class battery                                                                                                                                                                          |
| `leaks`                               | entities |                     | domain binary_sensor, device_class moisture                                                                                                                                                                  |
| `low`                                 | number   | `20`                |                                                                                                                                                                                                              |
| `critical`                            | number   | `5`                 |                                                                                                                                                                                                              |

Retired ([Retired slots](#writing-a-template)): `meters` and `heating.batteries`.

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
| `lights.color`                     | flag     |                     |          |
| `lights.members`                   | objects  |                     |          |
| `lights.members.entity`            | entity   |                     |          |
| `lights.members.members`           | entities |                     |          |
| `lights.scenes`                    | entities |                     |          |
| `lights.active_scene`              | entity   |                     |          |
| `heating`                          | object   |                     |          |
| `heating.entity`                   | entity   | required            |          |
| `heating.preset`                   | flag     |                     |          |
| `heating.thermostats`              | objects  |                     |          |
| `heating.thermostats.valve`        | entity   |                     |          |
| `heating.thermostats.battery`      | entity   |                     |          |
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
| `cameras`                          | objects  |                     |          |
| `cameras.entity`                   | entity   | required            |          |
| `cameras.motion`                   | entity   |                     |          |
| `cameras.person`                   | entity   |                     |          |
| `cameras.doorbell`                 | entity   |                     |          |
| `covers`                           | objects  |                     |          |
| `covers.entity`                    | entity   | required            |          |
| `covers.garage`                    | flag     |                     |          |
| `fans`                             | objects  |                     |          |
| `fans.entity`                      | entity   | required            |          |
| `fans.quality`                     | entity   |                     |          |
| `humidifiers`                      | objects  |                     |          |
| `humidifiers.entity`               | entity   | required            |          |
| `appliances`                       | objects  |                     |          |
| `appliances.entity`                | entity   | required            |          |
| `appliances.remaining`             | entity   |                     |          |
| `appliances.power`                 | entity   |                     |          |
| `pets`                             | objects  |                     |          |
| `pets.feed`                        | entity   | required            |          |
| `pets.fed`                         | entity   | required            |          |
| `pets.food`                        | entity   |                     |          |
| `pets.litter`                      | entity   |                     |          |
| `plants`                           | objects  |                     |          |
| `plants.moisture`                  | entity   | required            |          |
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
| `low`                              | number   | `20`                |          |
| `critical`                         | number   | `5`                 |          |

Retired ([Retired slots](#writing-a-template)): `meters` and `heating.batteries`.

## People

From `templates/people.yaml`.

### `person`

A person's tile, whether they are driving or in a focus, and their devices' batteries; it brings the person's and each device's pop-up.

| Slot                     | Kind    | Required or default | Found by  |
| ------------------------ | ------- | ------------------- | --------- |
| `key`                    | text    | required            | `area.id` |
| `entity`                 | entity  | required            |           |
| `health`                 | object  |                     |           |
| `health.steps`           | entity  | required            |           |
| `health.distance`        | entity  | required            |           |
| `health.flights_climbed` | entity  | required            |           |
| `health.active_energy`   | entity  | required            |           |
| `health.resting_energy`  | entity  | required            |           |
| `devices`                | objects |                     |           |
| `devices.key`            | text    | required            |           |
| `devices.name`           | text    |                     |           |
| `devices.icon`           | icon    |                     |           |
| `devices.tracker`        | entity  | required            |           |
| `devices.battery`        | entity  | required            |           |
| `devices.battery_state`  | entity  | required            |           |
| `devices.connection`     | entity  | required            |           |
| `devices.network`        | entity  | required            |           |
| `devices.storage`        | entity  | required            |           |
| `devices.focus`          | entity  | required            |           |
| `devices.focus_name`     | entity  |                     |           |
| `devices.activity`       | entity  | required            |           |
| `devices.permission`     | entity  | required            |           |
| `low`                    | number  | `20`                |           |
| `critical`               | number  | `5`                 |           |

Retired ([Retired slots](#writing-a-template)): `activities`, `focuses` and `batteries`.

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
| `low`                  | number | `20`                |          |
| `critical`             | number | `5`                 |          |

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

Brings `car-popup`, whose plan draws a part fully open while it is `on` or `open`, and half open while it is in `open_states`.

### `car-plan`

A car seen from above, its openings and tyres.

| Slot              | Kind     | Required or default | Found by |
| ----------------- | -------- | ------------------- | -------- |
| `doors`           | entities | required            |          |
| `hood`            | entity   | required            |          |
| `tailgate`        | entity   | required            |          |
| `windows`         | entities | required            |          |
| `sunroof`         | entity   |                     |          |
| `open_states`     | texts    |                     |          |
| `half_states`     | texts    |                     |          |
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
| `open_states`                | texts    | `['open','intermediate']`                                |          |
| `tyre_low_share`             | number   | `0.9`                                                    |          |
| `tyre_warn_share`            | number   | `0.95`                                                   |          |

## Server

From `templates/server.yaml`.

### `proxmox-server`

A Proxmox VE server's tile, its CPU and memory, and its guests, checks, backups and notifications chips; it brings the server's and the notifications' pop-ups. The checks, backups and notifications read sensors that the server's own jobs keep.

| Slot                           | Kind     | Required or default | Found by                                                                                                |
| ------------------------------ | -------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `outlet`                       | object   |                     |                                                                                                         |
| `outlet.entity`                | entity   | required            |                                                                                                         |
| `outlet.energy`                | object   |                     |                                                                                                         |
| `outlet.energy.power`          | entity   | required            |                                                                                                         |
| `outlet.energy.today`          | entity   |                     |                                                                                                         |
| `outlet.energy.total`          | entity   |                     |                                                                                                         |
| `cpu`                          | entity   |                     | domain sensor, platform proxmoxve, translation_key node_cpu in the whole home                           |
| `memory`                       | entity   |                     | domain sensor, platform proxmoxve, translation_key node_memory_percentage in the whole home             |
| `last_boot`                    | entity   |                     | domain sensor, platform proxmoxve, translation_key node_uptime in the whole home                        |
| `uplink`                       | entity   |                     |                                                                                                         |
| `temperatures`                 | object   |                     |                                                                                                         |
| `temperatures.cpu`             | entity   | required            |                                                                                                         |
| `temperatures.root_disk`       | entity   | required            |                                                                                                         |
| `storage`                      | entities |                     |                                                                                                         |
| `disks`                        | object   |                     |                                                                                                         |
| `disks.pool`                   | entity   | required            |                                                                                                         |
| `disks.failing`                | entity   | required            |                                                                                                         |
| `disks.life_left`              | entity   | required            |                                                                                                         |
| `guests`                       | objects  |                     | one per device with domain binary_sensor, platform proxmoxve, translation_key status, in the whole home |
| `guests.host`                  | text     |                     |                                                                                                         |
| `guests.status`                | entity   | required            | domain binary_sensor, platform proxmoxve, translation_key status in the whole home                      |
| `guests.cpu`                   | entity   |                     | platform proxmoxve, translation_key vm_cpu, then container_cpu                                          |
| `guests.memory`                | entity   |                     | platform proxmoxve, translation_key vm_memory_percentage, then container_memory_percentage              |
| `guests.disk`                  | object   |                     |                                                                                                         |
| `guests.disk.used`             | entity   |                     |                                                                                                         |
| `guests.disk.size`             | entity   |                     |                                                                                                         |
| `backups`                      | object   |                     |                                                                                                         |
| `backups.last`                 | entity   | required            | domain sensor, platform proxmoxve, translation_key node_backup_last_backup in the whole home            |
| `backups.problem`              | entity   | required            | domain binary_sensor, platform proxmoxve, translation_key node_backup_status in the whole home          |
| `backups.bucket`               | entity   |                     |                                                                                                         |
| `checks`                       | object   |                     |                                                                                                         |
| `checks.failed`                | entity   | required            |                                                                                                         |
| `checks.warnings`              | entity   |                     |                                                                                                         |
| `checks.last_run`              | entity   | required            |                                                                                                         |
| `checks.overdue`               | entity   | required            |                                                                                                         |
| `checks.actions`               | object   |                     |                                                                                                         |
| `checks.actions.run`           | entity   | required            |                                                                                                         |
| `checks.actions.stop`          | entity   | required            |                                                                                                         |
| `checks.actions.running`       | entity   | required            |                                                                                                         |
| `notifications`                | object   |                     |                                                                                                         |
| `notifications.messages`       | entity   | required            |                                                                                                         |
| `notifications.clear`          | entity   | required            |                                                                                                         |
| `notifications.sources`        | objects  |                     |                                                                                                         |
| `notifications.sources.source` | text     |                     |                                                                                                         |
| `notifications.sources.name`   | text     |                     |                                                                                                         |
| `message_sources`              | objects  |                     |                                                                                                         |
| `message_sources.source`       | text     |                     |                                                                                                         |
| `message_sources.name`         | text     |                     |                                                                                                         |
| `message_sources.entity`       | entity   |                     |                                                                                                         |
| `disk_high`                    | number   | `80`                |                                                                                                         |
| `disk_full`                    | number   | `90`                |                                                                                                         |
| `disk_life_low`                | number   | `20`                |                                                                                                         |
| `disk_life_critical`           | number   | `10`                |                                                                                                         |
| `cpu_hot`                      | number   | `85`                |                                                                                                         |
| `cpu_critical`                 | number   | `95`                |                                                                                                         |
| `root_disk_hot`                | number   | `70`                |                                                                                                         |
| `root_disk_critical`           | number   | `80`                |                                                                                                         |
| `bucket_high`                  | number   | `18`                |                                                                                                         |
| `bucket_full`                  | number   | `19`                |                                                                                                         |

Retired ([Retired slots](#writing-a-template)): `guest_statuses`.

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
| `checks.warnings`              | entity   |                     |          |
| `checks.last_run`              | entity   | required            |          |
| `checks.overdue`               | entity   | required            |          |
| `checks.actions`               | object   |                     |          |
| `checks.actions.run`           | entity   | required            |          |
| `checks.actions.stop`          | entity   | required            |          |
| `checks.actions.running`       | entity   | required            |          |
| `notifications`                | object   |                     |          |
| `notifications.messages`       | entity   | required            |          |
| `notifications.clear`          | entity   |                     |          |
| `notifications.sources`        | objects  |                     |          |
| `notifications.sources.source` | text     |                     |          |
| `notifications.sources.name`   | text     |                     |          |
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

Retired ([Retired slots](#writing-a-template)): `guest_statuses`.

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

A UniFi network's tile, its latency, and its devices and firmware chips; it brings the network's pop-up and one per Wi-Fi network.

| Slot                      | Kind     | Required or default                        | Found by                                                                                |
| ------------------------- | -------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `latency`                 | entities |                                            | domain sensor, platform unifi, translation_key wan_latency in the whole home            |
| `wan`                     | entity   |                                            |                                                                                         |
| `devices`                 | entities |                                            | domain sensor, platform unifi, translation_key device_state in the whole home           |
| `wifi`                    | objects  |                                            |                                                                                         |
| `wifi.key`                | text     | required                                   |                                                                                         |
| `wifi.enabled`            | entity   | required                                   |                                                                                         |
| `wifi.qr`                 | entity   |                                            |                                                                                         |
| `wifi.switchable`         | flag     |                                            |                                                                                         |
| `clients`                 | object   |                                            |                                                                                         |
| `clients.entity`          | entity   | required                                   |                                                                                         |
| `clients.names`           | entity   |                                            |                                                                                         |
| `clients.networks`        | objects  | required                                   |                                                                                         |
| `clients.networks.name`   | text     |                                            |                                                                                         |
| `clients.networks.icon`   | icon     |                                            |                                                                                         |
| `clients.networks.subnet` | text     | required                                   |                                                                                         |
| `router`                  | object   |                                            |                                                                                         |
| `router.cpu`              | entity   | required                                   | domain sensor, platform unifi, translation_key device_cpu_utilization in the whole home |
| `router.temperature`      | entity   | required                                   | domain sensor, platform unifi, translation_key device_sub_temperature in the whole home |
| `firmware`                | entities |                                            | domain update, platform unifi in the whole home                                         |
| `device_up`               | texts    | `['connected','upgrading','provisioning']` |                                                                                         |

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

The network's pop-up, its internet, devices, router, Wi-Fi networks, clients and firmware.

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

## Tailscale

From `templates/tailscale.yaml`.

### `tailscale`

A tailnet's tile, and its offline, relayed and update chips; it brings the tailnet's pop-up.

| Slot                 | Kind    | Required or default | Found by                                                                                                              |
| -------------------- | ------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `devices`            | objects | required            | one per device with domain binary_sensor, platform tailscale, translation_key connected_to_control, in the whole home |
| `devices.connected`  | entity  | required            | domain binary_sensor, platform tailscale, translation_key connected_to_control in the whole home                      |
| `devices.essential`  | flag    |                     |                                                                                                                       |
| `devices.ip_address` | entity  |                     | domain sensor, platform tailscale, translation_key ip in the whole home                                               |
| `devices.last_seen`  | entity  |                     | domain sensor, platform tailscale, translation_key last_seen in the whole home                                        |
| `devices.expires`    | entity  |                     | domain sensor, platform tailscale, translation_key expires in the whole home                                          |
| `devices.update`     | entity  |                     | domain binary_sensor, platform tailscale, translation_key client in the whole home                                    |
| `devices.udp`        | entity  |                     | domain binary_sensor, platform tailscale, translation_key client_supports_udp in the whole home                       |
| `soon_days`          | number  | `14`                |                                                                                                                       |

Retired ([Retired slots](#writing-a-template)): `essential`, `personal`, `updates` and `direct`.

Brings `tailscale-popup`.

### `tailscale-popup`

The tailnet's pop-up, a card per device, the essential ones under Infrastructure and the others under Devices.

| Slot                 | Kind    | Required or default | Found by |
| -------------------- | ------- | ------------------- | -------- |
| `devices`            | objects | required            |          |
| `devices.connected`  | entity  | required            |          |
| `devices.essential`  | flag    |                     |          |
| `devices.ip_address` | entity  |                     |          |
| `devices.last_seen`  | entity  |                     |          |
| `devices.expires`    | entity  |                     |          |
| `devices.update`     | entity  |                     |          |
| `devices.udp`        | entity  |                     |          |
| `soon_days`          | number  | `14`                |          |

Retired ([Retired slots](#writing-a-template)): `essential` and `personal`.

### `tailscale-device`

A tailnet device's card, its name, Connected or when it was last seen, and icons for a pending update, a key about to expire and how it connects.

| Slot                | Kind   | Required or default | Found by |
| ------------------- | ------ | ------------------- | -------- |
| `device`            | object | required            |          |
| `device.connected`  | entity | required            |          |
| `device.essential`  | flag   |                     |          |
| `device.ip_address` | entity |                     |          |
| `device.last_seen`  | entity |                     |          |
| `device.expires`    | entity |                     |          |
| `device.update`     | entity |                     |          |
| `device.udp`        | entity |                     |          |
| `alert`             | text   |                     |          |
| `soon_days`         | number | `14`                |          |

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
| `backups.problem`        | entity   |                     |                                                                                                                                                                      |
| `all_firmware`           | entities |                     |                                                                                                                                                                      |
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
| `backups.problem`        | entity   |                     |                                                                                                     |
| `all_firmware`           | entities |                     | domain update, device_class firmware in the whole home                                              |
| `room_firmware`          | objects  |                     | one per area in the whole home: `name` `area.name`; `firmware` domain update, device_class firmware |
| `room_firmware.name`     | text     | required            |                                                                                                     |
| `room_firmware.firmware` | entities |                     |                                                                                                     |

## Media server

From `templates/media.yaml`.

### `media-server`

A media server's tile, what is being watched, and its requests, downloads, health and update chips; it brings its pop-up. The parts are Plex, Jellyfin, Seerr, Radarr and Sonarr; `streams` is the main server's count and `more_streams` the others', such as Jellyfin's `watching` sensor beside Plex's.

| Slot                  | Kind     | Required or default             | Found by                                                                                 |
| --------------------- | -------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `streams`             | entity   | required                        | domain sensor, platform jellyfin, translation_key watching in the whole home             |
| `more_streams`        | entities |                                 |                                                                                          |
| `update`              | entity   |                                 |                                                                                          |
| `requests`            | object   |                                 |                                                                                          |
| `requests.pending`    | entity   | required                        | domain sensor, platform overseerr, translation_key pending_requests in the whole home    |
| `requests.processing` | entity   | required                        | domain sensor, platform overseerr, translation_key processing_requests in the whole home |
| `movies`              | object   |                                 |                                                                                          |
| `movies.queue`        | entity   | required                        | domain sensor, platform radarr, translation_key queue in the whole home                  |
| `movies.count`        | entity   | required                        | domain sensor, platform radarr, translation_key movies in the whole home                 |
| `movies.health`       | entity   |                                 | domain binary_sensor, platform radarr, translation_key health in the whole home          |
| `movies.space`        | entity   |                                 |                                                                                          |
| `movies.calendar`     | entity   |                                 | domain calendar, platform radarr in the whole home                                       |
| `shows`               | object   |                                 |                                                                                          |
| `shows.queue`         | entity   | required                        | domain sensor, platform sonarr, translation_key queue in the whole home                  |
| `shows.count`         | entity   | required                        | domain sensor, platform sonarr, translation_key series in the whole home                 |
| `shows.wanted`        | entity   |                                 | domain sensor, platform sonarr, translation_key wanted in the whole home                 |
| `shows.upcoming`      | entity   |                                 | domain sensor, platform sonarr, translation_key upcoming in the whole home               |
| `shows.calendar`      | entity   |                                 | domain calendar, platform sonarr in the whole home                                       |
| `none`                | texts    | `['0','unknown','unavailable']` |                                                                                          |

Brings `media-popup`.

### `media-popup`

The media server's pop-up, what is being watched, its requests, downloads, upcoming releases, library and update.

| Slot                  | Kind     | Required or default             | Found by |
| --------------------- | -------- | ------------------------------- | -------- |
| `streams`             | entity   | required                        |          |
| `more_streams`        | entities |                                 |          |
| `update`              | entity   |                                 |          |
| `requests`            | object   |                                 |          |
| `requests.pending`    | entity   | required                        |          |
| `requests.processing` | entity   | required                        |          |
| `movies`              | object   |                                 |          |
| `movies.queue`        | entity   | required                        |          |
| `movies.count`        | entity   | required                        |          |
| `movies.health`       | entity   |                                 |          |
| `movies.space`        | entity   |                                 |          |
| `movies.calendar`     | entity   |                                 |          |
| `shows`               | object   |                                 |          |
| `shows.queue`         | entity   | required                        |          |
| `shows.count`         | entity   | required                        |          |
| `shows.wanted`        | entity   |                                 |          |
| `shows.upcoming`      | entity   |                                 |          |
| `shows.calendar`      | entity   |                                 |          |
| `none`                | texts    | `['0','unknown','unavailable']` |          |

## Glances

From `templates/glances.yaml` and `templates/energy.yaml`.

### `glances`

The strip of the home's overall statuses, one line across the section: the weather, the alarm, the vacation toggle, and whatever needs you: failed checks, stopped guests, devices down or offline, low batteries, a lock or a car left open, a leak, smoke. What does not need you is not drawn.

| Slot                     | Kind     | Required or default                        | Found by                                                                                |
| ------------------------ | -------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `weather`                | entity   |                                            | domain weather, anywhere in the home                                                    |
| `alarm`                  | entity   |                                            | domain alarm_control_panel, anywhere in the home                                        |
| `vacation`               | entity   |                                            |                                                                                         |
| `people`                 | entities |                                            | domain person, anywhere in the home                                                     |
| `energy`                 | object   |                                            |                                                                                         |
| `energy.usage`           | entity   | required                                   |                                                                                         |
| `energy.grid`            | entity   | required                                   |                                                                                         |
| `energy.solar`           | entity   |                                            |                                                                                         |
| `energy.battery`         | entity   |                                            |                                                                                         |
| `energy.ev`              | entity   |                                            |                                                                                         |
| `energy.grid_today`      | entity   |                                            |                                                                                         |
| `energy.solar_today`     | entity   |                                            |                                                                                         |
| `energy.export_today`    | entity   |                                            |                                                                                         |
| `checks`                 | object   |                                            |                                                                                         |
| `checks.failed`          | entity   | required                                   |                                                                                         |
| `checks.warnings`        | entity   |                                            |                                                                                         |
| `checks.last_run`        | entity   | required                                   |                                                                                         |
| `checks.overdue`         | entity   | required                                   |                                                                                         |
| `checks.actions`         | object   |                                            |                                                                                         |
| `checks.actions.run`     | entity   | required                                   |                                                                                         |
| `checks.actions.stop`    | entity   | required                                   |                                                                                         |
| `checks.actions.running` | entity   | required                                   |                                                                                         |
| `batteries`              | entities |                                            | domain sensor, device_class battery, anywhere in the home                               |
| `leaks`                  | entities |                                            | domain binary_sensor, device_class moisture, anywhere in the home                       |
| `smoke`                  | entities |                                            | domain binary_sensor, device_class smoke, anywhere in the home                          |
| `notifications`          | entity   |                                            |                                                                                         |
| `updates`                | entities |                                            | domain update, anywhere in the home                                                     |
| `services`               | entities |                                            |                                                                                         |
| `disks`                  | entity   |                                            |                                                                                         |
| `backup`                 | entity   |                                            |                                                                                         |
| `guests`                 | entities |                                            | domain binary_sensor, platform proxmoxve, translation_key status in the whole home      |
| `network_devices`        | entities |                                            | domain sensor, platform unifi, translation_key device_state in the whole home           |
| `device_up`              | texts    | `['connected','upgrading','provisioning']` |                                                                                         |
| `tailscale`              | entities |                                            |                                                                                         |
| `media_health`           | entity   |                                            | domain binary_sensor, platform radarr, translation_key health in the whole home         |
| `locks`                  | objects  |                                            | the devices with domain lock, in the whole home: `entity` domain lock; `room` `area.id` |
| `locks.entity`           | entity   | required                                   |                                                                                         |
| `locks.room`             | text     |                                            |                                                                                         |
| `cars`                   | objects  |                                            |                                                                                         |
| `cars.key`               | text     | required                                   |                                                                                         |
| `cars.lock`              | entity   |                                            |                                                                                         |
| `cars.alarm`             | entity   |                                            |                                                                                         |
| `cars.unlocked`          | texts    | `['unlocked','selectivelocked']`           |                                                                                         |
| `cars.disarmed`          | texts    | `['unarmed']`                              |                                                                                         |
| `low`                    | number   | `20`                                       |                                                                                         |
| `critical`               | number   | `5`                                        |                                                                                         |

Brings `weather-popup` (with weather), `checks-popup` (with checks), `batteries-popup` (with batteries) and `energy-popup` (with energy). The checks item counts the failed checks and the warnings together, red while a check failed and orange while there are only warnings.

The counts of what is down or open are red, and each opens the pop-up that deals with it: `guests`, the guests that are off, `#proxmox`; `network_devices`, the devices in none of the `device_up` states, `#network`; `tailscale`, the essential devices' connection sensors that are off, `#tailscale`; `media_health`, while on, `#media`. A lock is counted while it is unlocked, open or jammed, one item per lock, found anywhere in the home, a lock with no device included, opening `#<room>` when the lock has its `room`, its own area's id when it is in one, and nothing otherwise.

Every guest the Proxmox integration reports counts, one stopped on purpose too, since the integration does not say which guests start on boot. To count only the guests that must run, label them `mnml_guests` in Home Assistant, on the guest's device or on its status sensor: `guests` then holds those alone, here and on the Proxmox tile ([Labels steer discovery](#discovery)). Setting `guests` in `slots` does the same for this strip alone. A car is one item that counts its `lock` while it is one of `unlocked` and its `alarm` while it is one of `disarmed`, the car template's words and defaults, and opens `#car-<key>`.

### `weather-popup`

The weather now, its conditions and its forecast.

| Slot      | Kind   | Required or default | Found by |
| --------- | ------ | ------------------- | -------- |
| `weather` | entity | required            |          |

### `checks-popup`

The daily checks: what failed, the warnings, when they last ran, and the details.

| Slot                     | Kind   | Required or default | Found by |
| ------------------------ | ------ | ------------------- | -------- |
| `checks`                 | object | required            |          |
| `checks.failed`          | entity | required            |          |
| `checks.warnings`        | entity |                     |          |
| `checks.last_run`        | entity | required            |          |
| `checks.overdue`         | entity | required            |          |
| `checks.actions`         | object |                     |          |
| `checks.actions.run`     | entity | required            |          |
| `checks.actions.stop`    | entity | required            |          |
| `checks.actions.running` | entity | required            |          |

### `batteries-popup`

The batteries that are running low, lowest first, with their level as a bar.

| Slot        | Kind     | Required or default | Found by |
| ----------- | -------- | ------------------- | -------- |
| `batteries` | entities |                     |          |
| `low`       | number   | `20`                |          |
| `critical`  | number   | `5`                 |          |

### `energy-popup`

The energy pop-up: the power now and the energy today, from the grid, the sun, the battery and the EV charger.

| Slot           | Kind   | Required or default | Found by |
| -------------- | ------ | ------------------- | -------- |
| `usage`        | entity | required            |          |
| `grid`         | entity | required            |          |
| `solar`        | entity |                     |          |
| `battery`      | entity |                     |          |
| `ev`           | entity |                     |          |
| `grid_today`   | entity |                     |          |
| `solar_today`  | entity |                     |          |
| `export_today` | entity |                     |          |
| `popup`        | text   | `'#energy'`         |          |

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

A slot is resolved in this order: its value in `slots`; else, when the instance discovers, its discovery rule; else its default; else it stays unfilled, and the parts of the template that read it disappear. A required slot left unfilled, a slot the template neither declares nor retires ([Retired slots](#writing-a-template)), a slot of an unknown kind, an area Home Assistant does not know, or an unknown template is an error card that names the template and the place. Inside a nested template, the outer template and the place come first: `outer at card.item: inner: the slot entity is required`. The MNML panel says a slot's mistake in the words of the slot labels instead, a field after its slot and a nested template by its title: `Short name is needed`, `Fuel takes a number`, `Meters: Power is needed`, `Inner piece: Entity is needed`. So does the note a template card draws for a mistake it meets after `setConfig`, once its family has loaded or in discovery, after its template's title: `Section heading: Title is needed`.

## Writing a template

A template has a `description`, optionally a `title` and an `icon`, its `slots`, optionally the slot paths it has `retired`, a `card`, optionally the `popups` it brings, and an `example` of its slots. Here it is by its name, as the MNML panel exports it:

```yaml
garden:
  description: The garden's tile and its pop-up.
  title: Garden
  icon: mdi:flower
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

**Title and icon.** The name, `garden`, is the template's code name: what a card's `template:` and the YAML use. The `title`, plain words, and the `icon`, `mdi:` and the name of an icon, are what the panel and the card editor show it by, its code name only small beside them. A template without a title is shown by its name in words, `Garden`, and one without an icon by `mdi:puzzle-outline`. A title that is not a text, or an empty one, and an icon that is not `mdi:` and a name are an error naming the template. Every shipped template has both, right after its `description`, and each title is its own. Drawing ignores both.

Templates of the home's own are kept by the integration and built in the MNML panel ([Where templates live](#where-templates-live), [The MNML panel](editors.md#the-mnml-panel)). One with the name of a shipped template replaces it, wherever it is used, inside other templates too; a new name adds one.

**Kinds of slot:** `text`, `texts` (a list of words), `number`, `icon`, `flag` (`true` or absent; `false` counts as absent), `entity`, `entities`, `object` and `objects`. Slot and field names are lower case letters, digits and `_`.

**Fields.** An `object` slot, or an `objects` slot's every element, declares its `fields:`, each a slot of its own with a `kind`, and `required` or a `default`. A field's default fills in when the object lacks it; a field of the wrong kind, a required field left unfilled, or a field the slot neither declares nor retires is an error that names the slot and the field, and so is a path such as `[[lights.grup]]` that names no field. A slot without `fields:` takes any object, unchecked.

**Labels.** A slot or a field may carry `label`, its name in the editor (`Air conditioning` for `ac`); `help`, a line under its field; and `group`, the editor's panel it sits in (`Sensors`, `Lights`). A slot without a label is named by its name in words (`Active scene` for `active_scene`), and a field after its slot, `Lights: Group`. Slots without a group sit in Basics when they are simple, and in a panel of their own when they are an `object` or `objects`. The panel names a slot by its label wherever it shows one, and keeps the path for the YAML. Drawing ignores all three.

**Retired slots.** `retired:` lists the slot paths a template takes without declaring them, dotted for an object's field: `retired: [meters, heating.batteries]`. A field's path holds for every element of an `objects` slot too. A value given for a retired path, by an instance or by an outer template, is taken and ignored: the template draws nothing from it, cannot read it, passes nothing of it on, and raises no error. It is how a slot removed while MNML is 0.x keeps the configurations that still give it working until the next major release, which removes the list. A retired path is no slot: discovery never fills it, the editors and the panel never show it, and `interface.json` does not record it. A `retired:` that is not a list of slot paths, or a path the template also declares, is an error naming the template. A dashboard the panel's builder makes or rebuilds leaves out every slot and field of a card that its template does not declare, a retired one included.

**Shapes.** A slot that several templates take, a meter, a vacuum, the daily checks, is declared once, as a shape in `templates/shapes.yaml` ([The shipped shapes](catalog.md#shapes)), and a slot names it with `shape:`:

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
      name: '[[words.update]]'
      rules: [{ entities: ['[[devices.*.update]]'], color: amber, is: ['on'] }]
  ```

- `'[[words.<name>]]'` is a word in the language the card is drawn in: `title: '[[words.lights]]'` reads Lights in English and Lumini in Romanian. A word is text, so it also fits inside a longer string: `'[[room.name]] • [[words.firmware]]'`. The words are the `templates` group of the word tables in `src/words/` ([A card's own words](cards.md#names-formatting-and-icons)), named in lower case letters, digits and `_`, as a template writes them. The template card and the panel's previews take the table of Home Assistant's language, `hass.locale.language`, then of its base language, then English; an expansion without a Home Assistant, as `drawn(home)`, `problems(home)`, `expandDashboard()`, the builder's checks and the tests run it in Node, writes English. A word is one name, never a path, a list or a projection: `[[words]]` alone, `[[words.lights.name]]` and `[[words.*]]` are an error, and so is a word the tables lack, naming the template, the place and the word, `typo at card.chips[0].name: no word named lightz`. The words of a template are checked the first time it is expanded, every part of it, drawn or not, so a test that expands each shipped template finds a wrong one before any home draws it. A word takes no value: a sentence that needs one is written as a word beside the slot.
- What a shipped template shows is written as words: a heading's or a list's `title`, a table's `headers`, a chip's, a control's and a glance's `name`, a state item's `text`, and a rule's `words`. What is not a word stays as it is: icons, hashes, entity ids, numbers, state names, the words a card strips from a name (`strip_word`, `strip`), which match the home's own names, and what the panel shows of a template, its `title`, `description` and examples, and its slots' `label`, `help` and `group`, all in English.

- An unfilled slot removes the key whose value is `'[[slot]]'`, or the list item. A string that interpolates an unfilled slot, or an empty one, is an error, since half a hash is never meant, and so is a `[[...]]` that holds anything but a slot path.
- `each: <list slot>` with `as: <name>` on a list item repeats it for every element, spliced into the list. Inside, `[[name]]` is the element, and the outer slots stay visible.
- `if: <slot>`, or `if: [a, b]` for any of several, keeps an item or a mapping only while the slot is filled: set, and not an empty list or object. `unless:` keeps it only while none is.
- `template: <name>` with `slots:` expands another template in place and gathers its pop-ups; keys beside it are added to what it draws, and win on a clash. A slot set to `null` and passed whole (`entity: '[[entity]]'`) reaches the inner template as `null`, so its slot is none there too, not its default; a slot left unset is left out, and the inner default applies.
- A key ending in `?` is dropped when its list or map comes out empty. Without the `?`, an empty list stays `[]`.
- A key ending in `!` keeps every place of the list written beside it: an item whose slot is unfilled stays, as `null`, where it would otherwise drop out, so the items after it keep their places. A list row's `values` are columns, so the shipped templates write `values!: ['[[meter.power]]', '[[meter.today]]', '[[meter.total]]']`, and a meter without a `today` leaves its Today column empty instead of showing its total there. The key is written without the `!`, and its value must be a list written out.
- In a list, an item that comes out a list is spliced into it: `entities: ['[[doors]]', '[[hood]]']` is one flat list.
- A list of states that comes out empty names no state. So a rule writes `is: ['[[states]]']`, which comes out `is: []` and holds for no state, where `is: '[[states]]'` would drop the key and leave a rule that holds for every state; a rule on `not:` states takes `if: <states>`, and is left out while there are none.
- `each`, `as`, `if`, `unless`, `template` and `slots` are reserved, and so is `id` on a list item, which names the part ([Changes to a shipped template](#where-templates-live)) and is left out of what the template draws. `words` is the words of the card's language, so no slot and no `as:` is called `words`: either is an error naming the template, `the slot name words is reserved for the words of the card's language`. A field may be. Quote `'on'`, `'off'` and strings of digits.

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

A slot's `discover:` rule runs in the browser on Home Assistant's areas, devices, entities and states, and its energy settings:

- `area.name`, `area.icon`, `area.id`, `area.temperature`, `area.humidity`: the area's own values, the last two the sensors chosen in its settings.
- `energy.grid_power`, `energy.solar_power`, `energy.battery_power`, `energy.battery_charge`, `energy.devices`: from Home Assistant's energy settings, with or without an area. The first four are the power of the grid, solar or battery sources and a battery's charge: an `entity` slot takes the first, an `entities` slot all of them. `energy.devices` is each device with a power, an object of `power` and `total` (its energy) as far as the slot declares them, leaving out a device inside another listed one. A statistic that is not an entity is left out, and explain says when the settings name none.
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

On a device (`device:` on the card), discovery looks only at the device and its `via_device` relatives: `area.name` is the device's name, `area.id` its slug, and the other area values read the device's area, or the card's `area` when given.

The same registries always give the same values; the card discovers again when Home Assistant replaces its registries, not on a state change. A rule that finds nothing leaves its slot unfilled.

### Devices find themselves

`device:` on a `fields:` rule takes the devices that hold an entity matching the filter, or any filter of a list, and fills the fields among each device's entities and those of its `via_device` relatives: the device it is connected through, and the devices connected through it. So a robot vacuum's dock is found whichever of the two Home Assistant links to the other. A field is found on the device itself first, and on its relatives only when the device has none.

- The anchor is looked for in the area, or in the whole home with `scope: all`; its relatives are taken wherever they are. With `scope: all`, each object is in its own area, its device's, or the entity's own when it has no device, and its `area.*` values read that area.
- An anchored rule inside another, such as the vacuum's `dock`, owns the device it takes: the outer device takes none of that device's entities, so a dock's problem sensors are the dock's warnings and never the vacuum's too. And the inner anchor never takes from the device it is inside: a dock with no error sensor of its own has no error, not the vacuum's.
- An `object` slot takes one device: the one that fills the most fields, then the first by device name. It never mixes the fields of two devices. An `objects` slot takes one object per device, in the order of the devices' names. A device whose object lacks a required field gives none.
- An entity that matches the anchor and has no device, such as a template helper, is an object of its own, its fields found on it alone.
- Inside a device, a rule without `scope` looks at the device and its relatives, and `scope: area` at the device's area, for what belongs to it without a link, such as a radiator's valves. An anchored rule with `scope: area` takes the device and its relatives first and the area's devices after, for a dock that Home Assistant does not link to its vacuum; a device of the area that Home Assistant links to another device, such as another vacuum's dock, is not taken.
- `per: device` stays the plain way to make one object per device, each field found on that device alone.

The `vacuum` shape's rule, in `templates/shapes.yaml`, which every slot that takes the shape shares:

```yaml
vacuum:
  kind: object
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

The shipped templates that stand for a device ([Editors](editors.md)) are `vacuum-card` and `3d-printer-card`, by their shapes' rules; `ac-item`, by a climate whose `hvac_modes` hold `cool`, and `heating-item`, by one whose modes do not; and `light-card`, `media-card`, `cover-card`, `fan-card`, `humidifier-card` and `camera-card`, by an entity of their domain. The first four bring the pop-up they open, and take everything it reads: their `key` is `area.id` and their `name` is `area.name`, so in an area the pop-up has the room's hash and name, and on a device the device's slug and name (`#roborock_s8-vacuum`, Roborock S8). The room's pop-up draws the same four cards, passing them the room's key and name, so the room brings each of these pop-ups once, through its pop-up.

**The room's devices.** The room's rules for its richer slots read the integrations' translation keys first, and the English words of the entities' names after, for an integration that gives none. The `vacuum` and `printer3d` rules are their shapes' own, so the vacuum's and the 3D printer's templates find the same on a device or in an area as the room does. What each one recognises:

| Slot         | The device                                                                                                                                                         | Its fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heating`    | holds a climate whose `hvac_modes` do not hold `cool`; a climate whose modes are not known counts: Better Thermostat, a valve, a generic thermostat                | `entity` that climate; `preset_temperatures` its Better Thermostat numbers; `schedule` the schedule of the area whose name has the word "heating"; `thermostats` one per device of the area with a valve position (`valve_position`, or the words "valve position"), each with its battery                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ac`         | holds a climate whose `hvac_modes` hold `cool`, so an air conditioner is never the heating                                                                         | `entity` that climate; `power_saving` and `dehumidifier` by `power_saving_mode` and `dehumidifier_level`, or by those words; `energy` its meter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `vacuum`     | holds a vacuum                                                                                                                                                     | Roborock's keys (`status`, `vacuum_error`, `current_room`, `clean_percent`, `cleaning_area`, `cleaning_time`, `last_clean_end`, `mop_attached`, `water_box_attached`, `total_cleaning_count`, `total_cleaning_area`, `total_cleaning_time`), or the same words; `map` its image; `routines` its primary buttons; `settings` its configuration selects but the selected map; `warnings` its problem sensors; `dock` the relative, or else the area's device that Home Assistant links to no other device, with a dock error sensor or a model that says dock, and its switches for dust emptying, mop drying and mop washing, its mop drying time and its problem sensors. Not `consumables` |
| `printer3d`  | is a PrusaLink printer (`platform: prusalink`)                                                                                                                     | PrusaLink's keys: the printer state, `progress`, `filename`, `material`, `print_speed`, `print_start`, `print_finish`, the nozzle's and the heatbed's temperature and target, `camera`, and the pause, resume, continue and cancel buttons. Not `outlet`, a plug of its own                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `speakers`   | holds a media player of device class `speaker`, or one from Sonos                                                                                                  | `key` and `entity` that player; Sonos's keys: `bass`, `treble`, `balance`, `loudness`, and for `tv`, `subwoofer` and `surround` `audio_input_format`, `night_mode`, `dialog_level`, `audio_delay`, `sub_enabled`, `sub_gain`, `surround_enabled`, `surround_level`, `music_surround_level`, `surround_mode`, or their words                                                                                                                                                                                                                                                                                                                                                                 |
| `media`      | one per device with a media player                                                                                                                                 | `entity` that player; `key` its entity id when it is a speaker, the `key` of its speaker, so its card opens the speaker's pop-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `outlets`    | one per device with a switch of device class `outlet`                                                                                                              | `entity` that switch; `energy` its meter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `appliances` | holds SmartThings' `washer_machine_state`, `dryer_machine_state` or `dishwasher_machine_state`, or Home Connect's `operation_state` named like a washer or a dryer | `entity` that state; `remaining` SmartThings' `completion_time` or Home Connect's `program_finish_time`; `power` a power sensor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

A meter, `ac.energy` or `outlets.energy`, is `power`, a sensor of device class `power`; `today`, a sensor of device class `energy` from a Utility Meter helper attached to the device; and `total`, one of device class `energy` that is not a utility meter.

## How it runs

[How a template card draws](template-card.md) follows one card from its configuration to the drawn card: the store, the templates in force, the shipped families loaded on need, discovery, expansion, the pop-ups and the draw.

## Versions

Templates, their slots and the slot shapes are part of MNML's public interface, which `interface.json` records ([AGENTS.md](../AGENTS.md)). A new template, a new optional slot, or a change in what a template draws is a minor release. While MNML is 0.x, a minor release may also rename or remove a template or a slot, or change a slot's meaning, and the release notes list each such change with how to move to the new one; from 1.0 that is a major release. A slot removed while MNML is 0.x is retired on its template ([Retired slots](#writing-a-template)), so a configuration that still gives it draws as before, until the next major release.

## Roles

A template is one of three, by how it is used, which MNML works out and nothing declares:

- **A tile** is placed on a dashboard: no other template uses it. The shipped ones are `room`, `person`, `car`, `proxmox-server`, `unifi-network`, `tailscale`, `adguard`, `home-assistant`, `media-server`, `glances` and `section-heading`.
- **A pop-up** is a card with a `hash` and no `type`, which a tile or a part brings: the room brings its own pop-up, and the vacuum's card the vacuum's.
- **A part** is used inside another template, by `template:`.

The home's own templates count, so a template of the home that uses a shipped tile makes it a part. The library and the template card's gallery show the tiles first, and the pop-ups and parts on request.

## The shipped templates

[catalog.md](catalog.md) lists them: each one's title, icon and description, its slots, the rules that find them, and the pop-ups it brings, written from `templates/*.yaml` by `pnpm run fix:docs`.

## Notes on the shipped templates

What a shipped template does beyond its description in the catalog.

- **Squares.** The nine tile templates ([`room`](catalog.md#room), [`person`](catalog.md#person), [`car`](catalog.md#car), [`proxmox-server`](catalog.md#proxmox-server), [`unifi-network`](catalog.md#unifi-network), [`tailscale`](catalog.md#tailscale), [`adguard`](catalog.md#adguard), [`home-assistant`](catalog.md#home-assistant) and [`media-server`](catalog.md#media-server)) take a `square` slot (the `square` [shape](catalog.md#shapes)), which the plan's `squares` fills and which they write as the tile's `square`. The room's tile also has a `trend` of its temperature, amber while its heating's `hvac_action` is `heating`; a tile without `square` and a small square ignore it.
- **Parts shared by an item and its pop-up.** The vacuum's item and its pop-up's header share [`vacuum-state`](catalog.md#vacuum-state), and the person's tile and pop-up header with [`person-status`](catalog.md#person-status). The server pop-up's Checks card and the checks pop-up's header share [`checks-controls`](catalog.md#checks-controls).
- **An item that brings a pop-up takes everything the pop-up reads:** [`ac-item`](catalog.md#ac-item), [`heating-item`](catalog.md#heating-item), [`vacuum-card`](catalog.md#vacuum-card) and [`3d-printer-card`](catalog.md#3d-printer-card).
- **What asks first.** The 3D printer's Cancel; the room's garage door before it opens, while its lock acts at once; the strip's alarm before it disarms, and its vacation toggle before it turns on.
- [`schedule-card`](catalog.md#schedule-card): when the schedule next changes is its `next_event` attribute, as a relative time.
- [`timer-card`](catalog.md#timer-card): the state line counts the time left down (`remaining`). Start and Pause are both primary. The menu offers the presets Home Assistant keeps for the timer, each starting it for that long, and draws nothing when it has none.
- [`heating-popup`](catalog.md#heating-popup): its header is the heating's own, amber while it runs. The target slider is amber while the heating runs and uncoloured while it is off, when moving it turns the heating on.
- [`room-popup`](catalog.md#room-popup): its timers are among its other devices, each a [`timer-card`](catalog.md#timer-card). Its header has the tile's chips, the leak among them. A leak sensor that is wet is a red row under the header, reading Wet. Under Schedules come the heating's schedule, then the room's own.
- [`car`](catalog.md#car): the pop-up's plan draws a part fully open while it is `on` or `open`, and half open while it is in `open_states`.
- [`proxmox-server`](catalog.md#proxmox-server): the notifications chip is drawn and amber while the sensor's `alerts` attribute, its warnings and errors, is not 0. So are the notifications row of the server's pop-up and the header of theirs ([Data](data.md#the-messages-card)).
- [`system-popup`](catalog.md#system-popup): its first row is Home Assistant's messages, the number of its notifications and, for an administrator, its repairs, or None, amber while there are any. It opens `#system-messages`, as the server's notifications row opens theirs, and so do the tile's Messages chip, drawn and amber while there are any, and the strip's Messages item. No entity holds them, so the cards read them from Home Assistant themselves, with no slot to fill.
- [`system-messages-popup`](catalog.md#system-messages-popup): its header counts the messages, amber while there are any, with a Clear all that dismisses every notification after asking, while there is one. Under it are the notifications (a messages card with `notifications: true`, each cleared by dismissing it) and, for an administrator, the repairs (`repairs: true`, most severe first).
- [`media-server`](catalog.md#media-server): `streams` is the main server's count, and `more_streams` the others', such as Jellyfin's `watching` sensor beside Plex's.
- [`glances`](catalog.md#glances), the strip:
  - A running timer is amber and counts down, and opens its room's pop-up. It is a calm status (`calm: true`), not drawn as needing you.
  - The problem items are those of `glance-problems`, and Home Assistant's messages, with `messages`: their number, drawn and amber while there are any, opening `#system-messages`.
  - The checks item counts the failed checks and the warnings together, red while a check failed and orange while there are only warnings.
  - The notifications item reads its sensor's `alerts` attribute, the warnings and errors ([Data](data.md#the-messages-card)). It is drawn and amber while that is not 0, and shows it, so notices alone do not call for you.
  - The leaks are one item per room, counted while wet and opening that room's pop-up, whose header and red Wet row show which sensor and since when. `leaks` counts the leak sensors together, opening nothing, only when no room gives its own.
  - The counts of what is down or open are red, and each opens the pop-up that deals with it: `guests`, the guests that are off, `#proxmox`; `network_devices`, the devices in none of the `device_up` states, `#network`; `tailscale`, the essential devices' connection sensors that are off, `#tailscale`; `media_health`, while on, `#media`.
  - Every guest the Proxmox integration reports counts, one stopped on purpose too, since the integration does not say which guests start on boot. To count only the guests that must run, label them `mnml_guests` in Home Assistant, on the guest's device or on its status sensor: `guests` then holds those alone, here and on the Proxmox tile ([Labels steer discovery](#discovery)). Setting `guests` in `slots` does the same for this strip alone.
- [`batteries-popup`](catalog.md#batteries-popup): with `battery_groups`, the heading of a group is its `name`, or else its `entity`'s name from Home Assistant, such as a person's; the rooms come first, then each person.
- [`energy-popup`](catalog.md#energy-popup): its header is its name alone, the usage being the first row of the Now list. Its meters are one Meters table, a [`meter-table`](catalog.md#meter-table). Every slot but `usage` and the daily totals can come from Home Assistant's energy settings, so the pop-up draws from them alone. Without `energy`, the strip's Energy item is the meters' summed power, uncoloured.
- [`meter-table`](catalog.md#meter-table): a list row with `of` draws its last value column as the share. A meter without a `today` or a `total` leaves that column empty (`values!`). It draws a list, the table with or without the Share column, so it is placed inside another template, as the energy pop-up places it while it has meters.

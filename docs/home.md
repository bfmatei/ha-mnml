# The home dashboard

What `build(home)` draws for a `Home`, every tile and pop-up, and why. The templates that draw them are named in parentheses ([Templates](templates.md)); `src/home/slots.ts` fills their slots from the home, and `src/home/view.ts` places them. The demo home, `demo/home.ts`, draws every one of them. For the look, see [Design](design.md).

## Contents

- [At a glance](#at-a-glance)
- [Stack](#stack)
- [Layout](#layout)
- [Items: the common row](#items-the-common-row)
- [Lists](#lists)
- [Pop-up headers](#pop-up-headers)
- [Rooms](#rooms)
- [Lights](#lights)
- [Heating and AC](#heating-and-ac)
- [Vacuum](#vacuum)
- [3D printer](#3d-printer)
- [Media](#media)
- [Garage](#garage)
- [People](#people)
- [Infrastructure](#infrastructure)
- [The integrations' words and shapes](#the-integrations-words-and-shapes)
- [Names and icons](#names-and-icons)

## At a glance

What the generator writes: one `sections` view with four sections of tiles and an untitled section that holds every pop-up.

| Section        | Tiles                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rooms          | Per room: the icon with a problems dot, the temperature and humidity, chips for the window, door, lock, heating and AC, and a Lights row with its controls                                                                                                                                                                                                                                                                    |
| People         | Per person: presence, and Driving and Do not disturb chips. The heading carries the vacation toggle                                                                                                                                                                                                                                                                                                                           |
| Garage         | Per car: the fuel, and Doors, Windows, Alarm and Tyres chips                                                                                                                                                                                                                                                                                                                                                                  |
| Infrastructure | Server (Proxmox): its CPU and memory, and Guests, Checks, Backups and Notifications chips. Network: the internet latency, and Devices, VPN and Firmware chips. AdGuard: the blocked share and the processing time, an Update chip and the protection toggle. Home Assistant: its memory and free disk, and Services, Updates and Firmware chips. Media: the streams playing, and Requests, Downloads, Health and Update chips |

| Pop-up                   | Shows                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#<room>`                | Lights, Climate, Media, Other (vacuum, 3D printer, outlets, diffuser), Batteries, Energy: each only when present; Batteries and Energy folded, Batteries open while one is low      |
| `#<room>-3d-printer`     | The camera, the print, the temperatures, the power outlet and its energy                                                                                                            |
| `#<room>-lights`         | The group's sliders, the scenes, every light (sub-groups expandable)                                                                                                                |
| `#<room>-heating`        | The target and preset, the valves, the thermostats' batteries                                                                                                                       |
| `#<room>-ac`             | The target, fan, swing, horizontal swing, power saving, dehumidifier, energy                                                                                                        |
| `#<room>-vacuum`         | Routines, the map, details, settings, the dock, maintenance, totals                                                                                                                 |
| `#car-<key>`             | The VIN, security, a plan of the car from above with its openings and tyres, details, its location                                                                                  |
| `#<room>-<speaker>`      | The speaker's sound: volume, bass, treble, balance, loudness, then its TV, subwoofer and surround settings                                                                          |
| `#person-<key>`          | Devices, and location permissions that aren't "always"                                                                                                                              |
| `#person-<key>-<device>` | The battery, and the companion app's details                                                                                                                                        |
| `#system`                | Resources, services, updates, firmware (the system's, then one list per room)                                                                                                       |
| `#proxmox`               | Notifications, stopped guests, daily checks, the host, disks, storage, energy, the guests table, backups                                                                            |
| `#proxmox-notifications` | Every message Proxmox sent, newest first, one card each with its title, its source (Proxmox VE, PBS or the guest) and a clear button; a tap shows the text; Clear all in the header |
| `#adguard`               | Queries, the update; the protection toggle in the header                                                                                                                            |
| `#network`               | Internet, devices, the router, the VPN, the Wi-Fi networks, the clients per network, folded but for Other, firmware                                                                 |
| `#network-<key>`         | A Wi-Fi network's QR code, while the network is on                                                                                                                                  |
| `#media`                 | Watching, requests, downloads, the upcoming releases, the library, Plex's update                                                                                                    |

**How the pop-ups behave.** They open as adaptive dialogs, 560 px wide on a desktop and a sheet on a phone, or as the home's `popupOpen` says for each kind of screen (`{ tablet: 'unfold', desktop: 'unfold' }` unfolds them out of their tile, in its place); second-level pop-ups have a back button. Every item follows one pattern: name, icon and state on the left, and flat buttons on the right, with the filled on / off last.

**Colour.**

- Red: water, an unlocked lock or car, a car alarm, a low tyre, a critical battery, a full container disk, blocklists that failed to download, a degraded pool or a failing disk, a server running hot, a bucket at its free limit.
- Orange: an open window or door, a low battery, a tyre that is dropping, a filling container disk, a link below 10 Gbps, a worn disk, a warm server, a bucket nearing the 20 GB it may hold.
- Amber: on.

Every threshold has two stages, so a slow drift and a fault don't look alike. There are no graphs: history lives in HA's more-info dialogs.

## Stack

- **Almost everything is a custom card.** Everything the dashboard shows comes from `mnml-cards.js`, the pop-up shell included. The few native HA cards are the vacuum map, the 3D printer's camera and the Wi-Fi QR codes (`picture-entity`), the car's location (`map`) and the routine buttons (`grid`).
- **No other HACS card.** Everything is MNML's or native.
- **Template instances, every slot spelled.** The dashboard is MNML template cards, one per tile, each with every slot written from the home and no `area`, so nothing is discovered. Repetition is the templates' job (`room` per room); spelling is the generator's. No decluttering card.
- **Where new things go:**
  - a read-only value: a row of a list card, or an entry of a state line;
  - a control: a `Control` in a lane;
  - a new kind of thing: a new card, under `src/cards/` with its configuration in `src/contract/cards.ts`, and the template that draws it.
- **Nothing hides behind more-info.** No graphs, and no more-info dialog behind anything. History lives in HA's more-info dialogs, outside the dashboard.

## Layout

- **One view.** It is a `sections` view with `max_columns: 3`. Four titled sections come first, each `column_span: 3`: Rooms, People, Garage, Infrastructure, or in the order of the home's `order` (a list of `rooms`, `people`, `garage` and `infrastructure`, each once), which `problems()` checks. The titles are `mnml-heading-card`s with `grid_options.columns: full`, from the home's `sections`. Last comes an untitled section holding the pop-up shell.
- **Section headings.** A heading has its title and icon at the left, and a trailing group (`.trail`) at the right with a state line, controls, or both. Rooms shows the outdoor temperature there, and People the vacation toggle, each when the home names its entity (`outside`, `vacation`). A folding list's heading ends in a chevron after its summary, and the whole heading is the tap target; folded, the heading stands alone, with no surface under it.
- **Tile width.** Every tile writes `grid_options: { columns: 12 }` over MNML's default of half a section, so each takes 12 grid columns. The Garage and the Infrastructure keep the rhythm of the Rooms: at three columns, three infrastructure tiles fill a row and the other two take the next.
  - Each view column is twelve grid columns, so a section is 36 wide when three columns fit and 24 when two do.
  - Two tiles share a row only while twice the width fits, so 12 is a third of a row at three columns and half a row at two. No single value can be half at three columns and full at two.

| Window width (sidebar open) | Tiles per row                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| about 1360 px and up        | 3                                                                                               |
| below that                  | 2, so a 1280 px laptop gets 2                                                                   |
| about 500 px and down       | 1                                                                                               |
| 600 to 900 px               | 1, a 500 px tile centred by HA's column cap; a 900 px tablet gets 1 until the sidebar collapses |

The sidebar costs roughly 250 px.

## Items: the common row

An item (`mnml-entity-card`) is every card in a pop-up that stands for an entity or a device: name, icon, state line, controls.

**Where a tap goes.**

- **The row** opens the device's pop-up when it has one: lights, AC, heating, vacuum, a person's phone or tablet, a Wi-Fi network. A speaker's media card links the same way.
  - Otherwise nothing opens: outlets, the diffuser, the dock's switches, the lights inside the lights pop-up.
  - A linking row takes the `link` class, with the hover and press wash. It prebuilds on `pointerdown` and stops the tap, so a row inside a tile doesn't also open the tile's pop-up.
- **The pill** keeps `role="button"`, its label and the keyboard path. So what a pointer reaches anywhere along the row, a keyboard and a screen reader reach at one control, and no button is nested inside another.

**The pill's icon** is the entity's `ha-state-icon`, unless the item names an `icon`. The phone and tablet rows name one, because a `device_tracker` would draw a person rather than the thing it tracks.

**An item may carry a `name`**, which wins over the registry, for the one case the registry can't answer. A companion-app device whose entities are all unavailable has no friendly name, and would print its entity id.

**Controls, with `power` last and filled on anything that toggles:**

| On             | Controls                                                                                                                                                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A light        | The `scenes` button (`mdi:palette-swatch`), then the brightness, white temperature and, in `color` rooms, hue slider buttons (`light-item`, `light-controls`), then power. The sliders show while the light is not off (`show: { not: ['off'] }`); the scenes button always shows, since a scene is how an off room is turned on   |
| The heating    | The target-temperature slider button while it runs, a preset `select` over `preset_modes` while it runs, then power (`heating-item`, `heating-controls`)                                                                                                                                                                           |
| The AC         | The target slider button while it runs, then a filled `select` over `hvac_modes` in place of a power button. It is blue while not off, and its icon is the current mode's (`HVAC_ICONS`; `mdi:power` while off). The tap that would switch the unit on asks which mode; `hvac_modes` contains `off`, so the same menu turns it off |
| The diffuser   | The amount slider button, then power                                                                                                                                                                                                                                                                                               |
| The 3D printer | Its job buttons while a job runs, then the outlet's power button while none does (`3d-printer-actions`, `3d-printer-card`)                                                                                                                                                                                                         |
| The vacuum     | Dock while not docked or Locate while docked, then Start while not cleaning or Stop (`vacuum.stop`) while cleaning (`vacuum-actions`)                                                                                                                                                                                              |

A slider button opens its slider as an overlay over the card; on a tile's Lights row, over that row alone, so the tile's own header stays.

## Lists

Every read-only section is one `mnml-list-card`. The card's title is drawn above its surface, like any heading.

**Layout.**

- **Rows** are a grid, 32 px each: the state icon, the name, a 72 px bar column when any row has `bar`, and the value right-aligned in tabular figures.
- **A long value is cut, not the name.** A value takes at most half the row (`VALUE_SHARE`, of the list's width), and what doesn't fit ends in an ellipsis, so a file name never squeezes the names beside it. A bar and a long value don't share a list: on a phone the two leave the names no room.
- **With `headers`** the list is a table. A 24 px header row sits in the secondary colour; the first header spans the icon and name columns, and the rest are right-aligned over theirs. Each row gives one cell per entity of `values`, showing "—" where an entity has no value. `headers` therefore has one entry more than `values`. A row with `of` in a table shows its last value as a share of that entity, orange over `high` and red over `critical_high`.
- **Hiding.** A row is hidden while its entity has no value or its `show` rule fails, and it leaves no gap. A card whose rows are all hidden renders nothing, title included, and takes no space: the pop-up leaves no gap for it.
- **Lowest first** (`lowest_first`) orders the rows by their number, ascending, a row without one last; in the model's order otherwise. A table keeps its order.

**Folding.** A list with `fold` shows its heading alone, ending in a chevron, until it needs you:

- **It needs you while a row is orange or red:** a threshold crossed, an orange or red `color` rule holding, a warning shown, or a value unavailable. Amber, such as an outlet that is on, doesn't count. So the rule is the colouring the list already does, and adds no threshold.
- **A tap on the heading** folds or unfolds it, and holds until the page reloads, whatever the rows do; then each list starts from its rule again.
- **The summary** sits at the heading's right, folded or not. `summary: 'lowest'` or `'highest'` is that row's value as the row shows it, a share as a share: "Lowest 65%". `summary: { sum: n }` adds up a table's values column `n` under its header, "Today 0.1 kWh", and shows nothing when the column mixes units.
- **What folds:** Batteries, in the rooms and the heating pop-ups; Energy, in the rooms, the ACs, the 3D printer and the server; the server's Storage; the vacuum's Maintenance and Totals; and the Network pop-up's clients, network by network. Everything that shows only while it needs you (Stopped, Updates, Firmware) and the short readings (Host, Internet, Queries) don't fold.

**Row semantics.** A row carries the section's meaning through the fields of `ListRow` and nothing else:

| Row           | Written as                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A battery     | `{ entity, label: 'device', bar: true, low: BATTERY_LOW, critical: BATTERY_CRITICAL }`: orange under the first, red under the second                                                   |
| A share       | `{ entity, label: 'device', bar: true, of, high, critical_high }`: the entity's share of `of`, bar and value, in the same unit or a dash; orange over `high`, red over `critical_high` |
| A consumable  | `{ entity, strip: ' time left', reset }`. `reset` draws a 28 px restart button that presses the button entity: the one action a list row carries                                       |
| A warning     | `{ entity, flag: true, color: 'orange', show: { is: ['on'] } }`                                                                                                                        |
| A progress    | `{ entity, bar: true, show: { entity: vacuum, is: ['cleaning'] } }`                                                                                                                    |
| A daily total | `{ entity, zero_when_empty: true }`: no value yet today reads "0 floors", in the entity's own unit and precision, uncoloured; any threshold applies to the 0                           |
| A timestamp   | `{ entity, relative: true }`, shown as "6 hours ago"                                                                                                                                   |
| A link        | `link-row`: a port's link speed, orange while it isn't 10 Gbps (its `speed` default)                                                                                                   |
| A raw word    | `{ entity, words: '[[lock_words]]', color: red, when: { is: '[[unlocked]]' } }`                                                                                                        |

`batteries` and `energy-table` (`templates/common.yaml`) draw the two lists every room shares. Both fold: Batteries lowest first, summed up by its lowest; Energy by today's total.

## Pop-up headers

A pop-up template's card is its `hash` and its `cards`, a `mnml-header-card` first.

- **The header** shows the pop-up's name and icon, and the entity it is about: its `color` / `when` for the pill, and its `state` for the line.
- **Controls** are the same ones its item has.
- **Buttons.** A back button appears when `back` is set; a close button always does. Both are 40 px rounds.

**Titles.**

- A second-level pop-up is titled after what it is: Lights, Heating, AC, Vacuum, Phone, Tablet. A speaker's and a Wi-Fi network's take their entity's name, so the Sonos reads "Sonos" and a network its SSID.
- Its state line is the name of the pop-up it was opened from: a `text` item with the room's, or, for a device, a `name` item on the `person` entity. It carries no state. So the title names the pop-up, the line says where it is, and the entity's state stays in the body, which is about it.

**Sections.** Every section has a heading, either a `mnml-heading-card` in front of the cards or the title of a list or of the car plan. Both are drawn alike.

## Rooms

### The room tile

`room` writes a `mnml-tile-card` in two rows.

**First row.**

- **The pill.** The room icon, with the problems dot on its corner while there is a problem (`problems`):
  - red while a leak sensor is wet or a battery is under `BATTERY_CRITICAL`;
  - orange while a battery is under `BATTERY_LOW`, or while a leak sensor or a battery is unavailable: its device has dropped off the network. Every climate sensor runs on a battery the room lists, so an offline climate sensor shows here as well as in the orange "— • —".
    Red wins over orange, and hovering the pill lists the problems, an offline device once.
- **The name**, with the temperature and humidity under it (`room`: `state` with `icon: true`, so each value follows its sensor's icon, joined with `•`).
- **Chips** at the top right, icon-only on the pill colour, in this order (`room`, then `room`):
  1. the window and the door: `indicator`, orange while open;
  2. the lock: `toggle`, red while unlocked, open or jammed. Tapping it locks or unlocks, without confirmation;
  3. AC and Heating: `nav`, the unit's own icon, blue or orange while not off. They open `#<room>-ac` and `#<room>-heating`.

**Second row: the Lights item, across the whole tile.**

- It is `light-item`: the same `Item` the room pop-up's Lights section is built from, drawn by the same `itemRow()`.
- It is a 44 px strip in the pill colour. The group's icon sits in a 36 px pill in the card colour, amber while on. Then come the group's name with its brightness and, while it is on, the active scene ("80% • Relax"), the scenes button, the slider buttons and the power button, all filled in the card colour.
- **Brightness is a button**, like the other two values, not a strip to drag. So the tile and the pop-up offer the same controls in the same order, and one lights item in the model can't drift into two shapes.
- **Taps.** Tapping the strip opens `#<room>-lights` and stops there. Its controls stop their own taps. Tapping anything else on the tile opens `#<room>`.

**The tile shows vital state only:** temperature, humidity, window and door, lock, problems, climate, lights. Every other device lives in the room pop-up.

### The room pop-up, `#<room>`

**The header** (`room-popup`) has the room's name and icon and the same window, door and lock chips.

- The lock comes first, so that the chip that unlocks a door isn't next to the close button.
- The state line repeats the tile's vitals, so the temperature and humidity are in the same place in both. That line costs 19 px, which is what pushes the longest room pop-ups past the shell's height. A pop-up that clips by a hair is the first place to look when this changes.

**Sections**, in a fixed order, each only when non-empty:

| Section   | Contents                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lights    | The light group item, opening `#<room>-lights`, with the room's scenes in its lane                                                                                 |
| Climate   | The AC and the Heating items, each with a line of Off, or the target and the action                                                                                |
| Media     | `media-card` per player; a speaker's opens its pop-up                                                                                                              |
| Other     | `room-popup`: the vacuum, the 3D printer, outlets, the diffuser                                                                                                    |
| Batteries | `batteries`: one row per battery, labelled with its device, the level as a bar                                                                                     |
| Energy    | `energy-table`: headers Item / Now / Today / Total, one row per metered device (outlets, then the AC), labelled with the device. An outlet's power shows only here |

**What has no card here.**

- **Leak sensors.** They surface through the tile's problems dot while wet, and through the batteries.
- **The lock.** Its chip is in the header.
- **Anything generic.** There is no general info section; a new read-only value needs its own place.

A device that needs a pop-up of its own gets a second-level one, `#<room>-<device>`, whose header has `back: true`.

### Batteries

Every battery is spelled once, next to its device:

- the thermostats' in `heating.thermostats`;
- the vacuum's in `vacuum.battery`, a charge level in its state line rather than a battery to replace;
- the room's other batteries in `batteries`.

`roomSlots()`'s `batteries` (`src/home/slots.ts`) joins the room's and the thermostats' lists and sorts them by entity id. It is the one list the generator orders itself, since two lists of the home meet in it. The room pop-up's Batteries list and the tile's problems dot both read it. The list then shows them lowest first (`lowest_first`), so the entity ids only settle a tie.

## Lights

### The lights pop-up, `#<room>-lights`

**The header** has the room's name as its line, the group for its pill, and the power button.

**The sections:**

1. **All lights.** The group's slider cards (`lights-popup`): brightness, where 0 turns the light off; white temperature in kelvin; and, in `color` rooms, hue.
   - A card `visibility` hides all three, heading included, while the group is off: a brightness, a hue and a kelvin the light isn't showing aren't values.
   - With the group on but in the other colour mode, the attribute is absent while the card shows. That is the one state where the gradients desaturate and lose their marker.
2. **Scenes.** One `mnml-select-card` over the room's `scenes` (`lights-popup`), and the one section with no heading: a single card that already names itself.
   - A scene's own state is when it was last activated, not whether it is showing. So the active scene comes from the room's `activeScene`, the Hue select whose state is the active scene's name. The card's state line names it, and the menu checks the scene of that name. With no scene active, the select reads `unknown`, and the card has no state line and the menu marks nothing.
   - The Lights item takes the same name into its state line while the group is on (`light-item`), so the tile reads "80% • Relax".
   - The match is by the name the menu shows. A scene renamed in HA but not in the Hue app is never checked.
   - It comes before the lights because a room is set from its scenes, while a single bulb is rarely touched.
3. **Lights.** Every other light of the room, as items with the slider and power controls of the room's Lights item, without its scenes button, and with no pop-up.
   - Each is named without the word "Light" (`strip_word: Light`), and they are listed in order of that name: "Countertop", "Top", "TV".
   - A `{ group, members }` member becomes one card for the sub-group, with its bulbs as the card's `items`. It is collapsed by default; a chevron at the head of its lane expands the bulbs as rows indented by a pill's width, so a bulb's icon sits under its group's name.
   - The card keeps whether it is open on the element (`expanded`), so a state update draws it open.
   - So the living room lists two rows, Top and TV, rather than ten bulbs.

## Heating and AC

Both pop-ups are built from the same cards:

- **The target slider** (`heating-popup`): `slider: temperature`, `climate.set_temperature`, and the unit's `min_temp`, `max_temp` and `target_temp_step`.
  - On a unit with a power switch it carries `turn_on`. The card then calls `climate.turn_on` first when the unit is off, so one drag both starts it and sets the target.
  - That is why the heating's slider has no `visibility` and the AC's does: an AC is started by choosing a mode.
- **Mode cards** (`ac-popup`) are `mnml-select-card`s over a mode attribute.
  - A mode card shows the current option's icon: `HVAC_ICONS` for a mode, `ha-attribute-icon` for a preset, for a swing mode only when HA has an icon for it, and none for a fan or horizontal swing mode, whose words are the unit's own (`low-medium`, `far left`). Its label is in the line, and its whole body opens the menu.
  - A `select` entity's card shows its options through `hass.formatEntityState()`, with no icons.

| Pop-up            | Header                                                     | Sections                                                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#<room>-heating` | The room's name, the target button, the preset menu, power | **Settings**: the target slider, which stays whatever the unit reads, and a Preset card hidden while off. **Valves**: one row per thermostat, the valve position as a bar. **Batteries**: the thermostats'                         |
| `#<room>-ac`      | The room's name, the target button, the HVAC mode button   | **Temperature**: the target slider, hidden with its heading while off. **Settings**: the Fan, Swing and Horizontal swing cards, the power saving `select` (`select-card`), the dehumidifier `number` (`number-slider`). **Energy** |

- **The HVAC mode has no card of its own.** The header's mode button is where the unit is switched on, off or over.
- **Only what the unit has is written.** The AC's settings are written only for the fields the model has (`fan`, `swing`, `horizontalSwing`, `powerSaving`, `dehumidifier`, `energy`), and the Settings heading only when one of its cards is. The heating's Preset card and control need `preset`.
  - Each flag is set only for a list the unit reports among its capabilities.
  - A mode card whose attribute yields no options renders nothing, rather than an empty menu.
- **Not shown:** the AC's temperature source and error sensor.

## Vacuum

### The vacuum pop-up, `#<room>-vacuum`

**The header** has the room's name as its line, and Dock / Locate and Start / Stop next to it. The vacuum's line (`vacuum-card`: its error while it has one, the status, the current room while cleaning, the battery, then the dock's error while it is not `Ok` and the mop drying time left in minutes while drying) is the entity card's in the room pop-up, not the header's.

| Section     | Contents                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routines    | A `grid` of `mnml-button-card`s pressing the `button.` entities, two per row so that a routine's full name fits. A tap colours the pill for 600 ms                                                                                                                                     |
| Map         | `picture-entity` on the vacuum's `image` entity                                                                                                                                                                                                                                        |
| Details     | The progress as a bar, the area and the time while `cleaning`; the last clean as a relative time while not; mop attached, and water box attached where the model has it                                                                                                                |
| Settings    | The `settings` selects as `mnml-select-card`s: cleaning mode, mop mode, mop intensity                                                                                                                                                                                                  |
| Dock        | `vacuum-popup`: the dust emptying, mop drying and mop washing switches, one item each with a power button                                                                                                                                                                              |
| Maintenance | `vacuum-popup`: the consumables of the vacuum and of the dock together, labelled without " time left" and formatted by HA ("38h 5m"), then both sets of warnings as orange flags shown while on. It folds, and opens while a warning shows                                             |
| Totals      | `vacuum-popup`: the lifetime cleaning count, area and time, where the model has `totals`. HA names the area and the time "Cleaning area (total)" and "Cleaning time (total)", apart from the current clean's; the rows strip " (total)" (`TOTAL`), since the heading says it. It folds |

**The dock has no pop-up and no item of its own.** It isn't a thing you go to; it is part of the vacuum. So its switches are a section of the vacuum pop-up, and its consumables and warnings share the vacuum's list. The model's `dock` block still holds its entities, because which entity belongs where follows the HA device.

## 3D printer

### The 3D printer pop-up, `#<room>-3d-printer`

The 3D printer is an item of its room's Other section, like the vacuum. Its line is the 3D printer's state, then the progress while a job runs (printing, paused or needing attention). While the 3D printer's outlet is off, the line is the outlet's "Off" instead. A tap opens the pop-up.

**The job's buttons** each show only in the state where the 3D printer accepts it: Cancel while a job runs, Pause while printing, Resume while paused, and Continue while it asks for attention (`3d-printer-actions`). The header has them too. Its line is the room's name alone, as the vacuum's and the lights' are: the 3D printer's state and progress are in the item and in the Print rows.

**The item adds the outlet's power button,** filled and last, as on any item that toggles (`3d-printer-card`). It is hidden while a job runs, since cutting the power ends the print; Cancel is there instead.

**A switched-off 3D printer reads orange.** With its outlet off, PrusaLink can't reach the 3D printer and its entities are unavailable, so the item's pill takes the orange of an unavailable entity.

| Section      | Contents                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Camera       | `picture-entity` on the 3D printer's `camera`, streaming live (`camera_view: live`) while the pop-up is open                         |
| Print        | The loaded material, then, while a job runs, the progress, the file, the print speed, and the start and the finish as relative times |
| Temperatures | A table of the nozzle and the heatbed, now and target, named without " temperature"                                                  |
| Power        | The 3D printer's `outlet`, an item with a power button, then its meter in an Energy table                                            |

**Job rows wait for a job.** PrusaLink reports the job's entities, and its buttons, as unavailable while the 3D printer is idle. Shown then, they would be orange dashes for a 3D printer that is fine. So they are shown only while a job runs.

**The outlet belongs to the 3D printer, not the room.** The room pop-up lists neither the outlet nor its meter; only the 3D printer's pop-up does. Its firmware stays in the room's firmware list, with the room's other devices.

## Media

`mnml-media-card`:

- **The pill** shows the player's picture while it is active (playing, paused, buffering, on), and its icon otherwise.
- **The text** is the name, then the title and artist (or the app and series) as the line. While idle, the line is HA's state.
- **The lanes** follow `supported_features`: previous, play / pause (filled, `media_player.media_play_pause`), next, then the volume slider button and the power toggle, amber while not off.
- **Under 480 px** the previous and next buttons hide, so the name keeps its room.
- **A speaker's card links.** A player the model spells as a `Speaker`, rather than a bare id, has a pop-up of its own. Its row and its pill open it, while the transport, volume and power buttons keep their own taps.

### The speaker pop-up, `#<room>-<speaker>`

**The header** is the player, with the room's name as its line and a back button. The transport stays on the media card in the room pop-up: this pop-up is for how the speaker sounds.

| Section   | Contents                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sound     | The volume, as a slider card on the player; the bass, the treble and, where the model has it, the balance, as `number` sliders; loudness, an item with power |
| TV        | The input format on the heading's line ("Dolby Atmos"), where the model has it; night sound and speech enhancement, items with power; the audio delay        |
| Subwoofer | Whether the sub plays, and its gain, shown only while it does                                                                                                |
| Surround  | Whether the surrounds play, and while they do, their level for TV and for music, and whether music plays through them at full volume                         |

- **Only what the speaker has is written.** `tv`, `subwoofer` and `surround` are optional, for a speaker that isn't a soundbar or has no sub or surrounds bonded.
- **A level shows only while its part plays.** The sub's gain and the surrounds' levels are hidden while the sub or the surrounds are off (`while-not-off`), as a light's sliders are while it is off.
- **What Sonos reports besides** (crossfade, the status light, touch controls, autoplay, the microphone) stays disabled in Home Assistant.

## Garage

### The car tile

`car` shows the car's icon and its name, with the fuel under it (`state` with `icon: true`). The name is the metadata sensor's device's (`entity: car.metadata` with `label: 'device'`), so renaming the car in HA renames the tile. Four chips sit at the top right (`car`). Each always shows, coloured by the first of its rules that holds:

| Chip    | Icon                         | Colour                                                                                                                                                                 |
| ------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doors   | `mdi:car-door`               | Red while the lock sensor reads one of `unlocked`; orange while a door, the hood or the tailgate is `on`                                                               |
| Windows | `mdi:car-windshield-outline` | Orange while a window or the sunroof is `open` or `intermediate`                                                                                                       |
| Alarm   | `mdi:shield-car`             | Red while `alarmActive` is on; amber while the arming state is anything but `unarmed` (`disarmed`)                                                                     |
| Tyres   | `mdi:car-tire-alert`         | Orange while a tyre is under `tyre_warn_share` of its target, red under `tyre_low_share`; titled "Tyre pressure dropping" or "Tyre pressure low" (the `tyres` control) |

Hovering a chip lists the entities behind its colour, with their states. The lock and arming states read through the same dictionaries as the Security list (`words`), so the tooltip says "Doors only", not `doorsOnly`.

**The BMW states are raw words** with no translation: `SECURED` / `LOCKED` / `SELECTIVE-LOCKED` / `UNLOCKED`, `unarmed` / `doorsOnly` / `doorsTiltCabin`, `CLOSED` / `INTERMEDIATE` / `OPEN`.

- The `car` template holds, as slot defaults, the state lists that the tile's rules and the pop-up's rows share (`unlocked`, `disarmed`, `open_states`).
- It also holds the dictionaries the list card's `words` renders them with: `lock_words` ("Locked", "Partly locked") and `alarm_words` ("Doors only", "Armed").
- A word the dictionaries don't list comes out lower-cased, without hyphens and capitalised ("Unarmed").

### The car pop-up, `#car-<key>`

**The header** has no controls. Its entity is the metadata sensor: the header takes that sensor's device's name (`label: 'device'`), shows the car's icon, and has the VIN as its line (`{ serial: true }`, the serial number of the sensor's device). The pill turns orange while the sensor is unavailable.

| Section  | Contents                                                                                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security | The lock state, red while one of `unlocked`; the arming state, amber while not one of `disarmed`; the Alarm flag, red and shown while `alarmActive` is on                                                                                                                 |
| Status   | `car-plan`: the `mnml-car-plan-card`                                                                                                                                                                                                                                      |
| Details  | The fuel level, then the `remainingFuel` in litres where the car has it, the remaining `range` (one is read from the other), the mileage, "Service in" when the car has `service`, then the 12 V `batteryVoltage` and the `coolantTemperature` where the car reports them |
| Location | HA's `map` card on `location`, `aspect_ratio: 3:1`                                                                                                                                                                                                                        |

### The car plan

`src/cards/car-plan.ts` draws an SVG of the car seen from above, nose at the left and the car's left side at the bottom, in a 480 × 251 viewBox.

**The silhouette is a trace**, not a drawing. The outline, the windscreen, the rear screen, the cowl band, the four side-glass panes and the four lamp crescents are subpaths of a vector trace of a top-down photograph, kept in its 992 × 620 space.

- One group transform mirrors the trace's nose-right onto the project's nose-left, and fits its 966 × 490 silhouette to the box. So the geometry stays the trace's, and only the transform is the project's.
- The mirrors belong to the outline, as in the trace, and they set the drawing's height: the room the tyres protrude into.
- The outline is stroked, so that it reads against a card it is only a shade away from. It is also the clip for everything inside it.

**What the trace can't give is built in the same space**, aligned to what it can:

- **The hood** is everything forward of the cowl, and **the boot lid** everything aft of the rear screen. Each runs past the end of the car, so the clip gives it the body's own nose or tail rather than an edge of its own.
- **A door** is the shoulder band between two pillars, with its inboard edge on its own glass. So an open door and an open window stay regions you can tell apart.

**At rest, the car draws almost nothing.**

- A closed door, hood or boot draws nothing at all, neither outline nor fill. A region with nothing to report isn't on screen.
- The `seam` class is the outline redrawn above the fills at a fifth of the text colour. It isn't a seam of its own; it keeps an edge on the body, so an open part reads as a region inside it.
- **The roof** runs from the rear screen to the windscreen, just inside the side glass. Its ends are set clear of both, so that a straight edge never crosses a curved one.
- **The sunroof**, on a car that has one, sits inside the roof with a tighter radius and a stronger stroke, so the two don't read as one box.
  - Its margin is even across the car (35 and 32 units) but not along it (129 units toward the tail, 52 toward the nose). That puts its centre 38.5 units forward of the roof's.
- The windscreen and the cowl are nudged toward the nose by `SCREEN_SHIFT`, and the sunroof is inset from what was traced. Those are the two places the drawing departs from the trace.

**Lamps and tyres.**

- **The lamps** are filled against the card colour rather than tinted over the body. So they stay opaque, and read on top of an open hood or boot.
- The front pair has well over twice the contrast of the rear, so the nose is the end you can name at a glance.
- **The tyres** are footprints sized from a real tyre: the diameter along the car, the section width across it, on a wheelbase of three fifths of the length. They overlap the flank and protrude past it, which is the only way a wheel shows in a view this flat.
- Every stroke is `non-scaling-stroke`, so a width is pixels on the card, not units of the trace.

**What turns colour:**

| Part                                         | Colour                  |
| -------------------------------------------- | ----------------------- |
| A door, the hood, the tailgate `on`          | Orange                  |
| A window or the sunroof `open`               | Orange                  |
| A window `intermediate`                      | Half-transparent orange |
| A tyre under `tyre_warn_share` of its target | Orange                  |
| A tyre under `tyre_low_share` of its target  | Red                     |

**Pressures and caption.**

- The tyre pressures are HTML labels in rows above and below the drawing, positioned at the axle centres in percent of the width. So they keep their 12 px size on a phone ("2.1 / 2.4 bar": current, then target). Each number takes its sensor's display precision from HA.
- A caption under the drawing lists the problems ("Front left door open • Rear right window half open • One tyre low") or reads "All closed".
- Hovering a part gives its state (`<title>`).

## People

### The person tile

A tile per person of the home's `people` (`person`):

- **The pill:** the `person` entity's icon, with the problems dot while a device battery is low or unavailable.
- **The `person` entity's name**, with its state under it: Home, Away or a zone.
- **Two `status` chips**, inert, and each titled with the entities behind its colour:
  - Driving (`mdi:steering`), amber while any device's `activity` reads `automotive`;
  - Do not disturb (`mdi:moon-waning-crescent`), amber while any device's `focus` is on.

And nothing else. A tile is the glance, and a phone's readings are not what you look at a person's card for.

### The person pop-up, `#person-<key>`

- **The header** is the `person` entity: its name, icon and state, and nothing more precise.
- **Devices.** One item per device: the device's `icon` and `name`, with its tracker state and battery as the line. Two values, because the row is a way in rather than a readout.
  - A device item renders whether or not its entities read anything, where a table row would hide. So a tablet that has gone quiet still appears, named, with an empty line: the honest picture.
- **Location access.** A row per device, orange, shown only while its location permission is not `authorized always`. It is a warning rather than a column nobody reads: a tracker on "while in use" only updates with the app open, which silently breaks every presence automation.
- **Health,** for a person with `health`: steps, distance, flights climbed, active energy and resting energy, as the Health store reports them. They belong to the person rather than to the phone that reports them. Each is a daily total that the phone reports only once the day has a sample, so a row with no value reads 0 rather than an orange dash (`zero_when_empty`): a day without stairs is not a broken sensor.

**Where a person is, is left out on purpose.** The `person` entity's state says Home, Away or a zone. Neither the geocoded address nor a map is on the dashboard.

**Health comes from one source.** The Companion app reports steps and distance twice, from the phone's pedometer and from the Health store, and the tablet repeats the phone's store. So the model spells the Health store's five, from the phone, on each person, and HA has the pedometer's and the tablet's disabled. The heart rate, sleep, weight and the other Health readings are left out of the model.

### The device pop-up, `#person-<key>-<device>`

- **The header** shows the device's icon and name, the person's name as its line, and a back button to the person. Neither the tracker's state nor the battery is repeated there: the first row below is the battery, and where the person is belongs to the person pop-up.
- **Battery.** The level as a bar, orange under `BATTERY_LOW` and red under `BATTERY_CRITICAL`, then the charging state.
- **Details.** Free storage, connection type, network, activity, Focus (and its name where the device reports one), and the location permission, orange while it is not `authorized always`.

Everything else the companion app reports lives here rather than on the row above it: a phone has a dozen readings, and none of them is what you open a person's card to see.

## Infrastructure

Five tiles, one per system the house runs on, each with its own pop-up, in this order, each before what depends on it: the server, the network, AdGuard, Home Assistant and the media server. They take the default width, so three share a row at three columns and Home Assistant and the media server take the next one. The home's `system` holds all five; `proxmox`, `adguard`, `network` and `media` are optional, and their tile and pop-up exist only when the model has them.

**Each system reads its own entities.** Proxmox owns the server and every guest on it, AdGuard its filtering, the network its devices and the VPN, the media server Plex and Jellyfin, Seerr, Radarr and Sonarr, and Home Assistant its virtual machine, services, updates and firmware. The one entity two cards share is Home Assistant's own guest, whose CPU and memory are both the Home Assistant tile's and a row of the guests table, so it is one `Guest` constant.

### Server, `#proxmox`

The tile and its pop-up are named "Server" after the machine they show; Proxmox is what runs on it, and the hashes, the model field and the templates (`proxmox-server`) keep its name. The tile has the server's CPU and memory under it, and four chips, in the pop-up's order: Guests, red while a guest is not running; Checks, red while the server's last daily checks had a failure and orange while the last run is over 26 hours old, a timer that stopped included; Backups, red while the server's last backup reports a problem; and Notifications, amber while Proxmox has sent messages that are not cleared. Notifications is a `nav` chip: it opens `#proxmox-notifications` directly.

**The server outlet has no power button anywhere.** It feeds the machine the dashboard is served from, and a filled toggle there would be one tap from switching the house's brain off. So it lives in the pop-up, not on the tile.

| Section       | Contents                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notifications | `proxmox-popup`, with no heading, like the lights pop-up's Scenes: the number of messages, or "None", amber while there is one. It opens `#proxmox-notifications`, and comes first because a lit chip is why the pop-up was opened; Stopped and Daily checks follow, as what else needs you                                                                 |
| Stopped       | One red row per guest that is not running, named by its device (`stopped-row`)                                                                                                                                                                                                                                                                              |
| Daily checks  | The server's last daily checks: the failures, red while not 0, and the warnings, orange while not 0; the last run, as a relative time; and an orange flag while it is overdue. Under it, Check details, while there are any: each failed check in red and each warning in orange, with the details under it, from the failures sensor's `details` attribute |
| Host          | The outlet's state, amber while on, then the server's CPU, its memory as a bar, its last boot, as a relative time, its link to the router (`link-row`), and the CPU's and the root disk's temperatures, pushed by the host: orange over `cpu_hot` and `root_disk_hot`, red over `cpu_critical` and `root_disk_critical`                                     |
| Disks         | `proxmox-popup`: the ZFS pool's health, red while not `ONLINE`; the disks failing SMART, red while not 0; and the lowest life left among the disks that report one, as a bar, orange under `disk_life_low` and red under `disk_life_critical`                                                                                                               |
| Storage       | Each storage as a bar, named by its device. It folds, summed up by the fullest                                                                                                                                                                                                                                                                              |
| Energy        | The outlet's meter; its wattage and energy are here rather than in Host, so the reading is in one place. It sits with the host, whose outlet it meters                                                                                                                                                                                                      |
| Guests        | `proxmox-popup`: every guest, named by its device, with its CPU, its memory and, for a container, its disk used as a share of its size: orange over `disk_high`, red over `disk_full`. Proxmox reports no disk use for a VM, which shows a dash. The row's icon is the guest's running state                                                                |
| Backups       | The last backup, as a relative time, a red row while it reports a problem, and the off-site bucket's size: orange over `bucket_high` and red over `bucket_full`                                                                                                                                                                                             |

### Notifications, `#proxmox-notifications`

What the server would mail to root, from the host and from every guest. The header reads "Notifications · Server", with Clear all while there is a message, and a back button to `#proxmox`. Under it, one `mnml-messages-card` lists the messages, newest first, each as an item on a card of its own, spaced like the pop-up's cards:

- **The row**: an envelope in the pill, coloured by the message's severity (red for `error`, orange for `warning`, blue for `notice` and `info`, grey for any other), the title as the name, the source and the time on the state line, "PBS • 2 hours ago", and a clear button.
- **The text is collapsed.** Tapping the row shows it under the row, across the card's whole width so that a log table fits a phone; the title wraps rather than ending in an ellipsis, and the envelope opens. Tapping again hides it. The pill is the keyboard path, with `aria-expanded`. A message stays open while the list updates, until it is cleared.
- **A message without text** has nothing to expand: its row doesn't link and its pill is not a button.

**The text is the sender's summary,** a few lines, and for a failure the source's own text under it: a backup's failed guests' log lines, an update report, a disk's smartd warning. Those are plain-text tables and logs, so the text is monospace and keeps its line breaks. A line wider than the card wraps rather than scrolling sideways, because the end of a log line is usually the error.

**Each message names its source.** Proxmox VE and PBS run on the server, and a guest's mail reaches Home Assistant through it, so the host is always the server; each message carries a `source` instead. `proxmox.notifications.sources` names `pve` and `pbs`, "Proxmox VE" and "PBS", and every guest with a `host` adds itself, named by its device as in the Guests table (`proxmoxSlots()`'s `message_sources`, in `src/home/slots.ts`). A source the card doesn't know shows as sent, and a message without one shows its time alone. A guest renamed on the host needs its `host` to follow, or its messages show the bare host name.

**Home Assistant keeps the list; the dashboard only reads it.** `proxmox.notifications` names two entities:

| Field      | Entity                                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messages` | A trigger-based template sensor. Its state is the number of messages; its `messages` attribute lists them newest first, each `{ id, title, message, severity, source, time }`: `title`, `message`, `severity` (`info`, `notice`, `warning` or `error`), `source`, and `time` in ISO 8601 |
| `clear`    | A script, run through `script.turn_on`. With an `id` variable it removes that message; without one it removes them all                                                                                                                                                                   |

[Data](data.md#the-messages-card) gives the shape, and `recipes/messages.yaml` is a package that keeps such a list: an automation fires `mnml_message` with a title, a message, a severity and a source, and the script clears one message or all.

### Home Assistant, `#system`

The tile has Home Assistant's memory percentage and free disk under it. Home Assistant runs as a virtual machine, so the memory is the machine's, and the disk is the one Home Assistant fills.

| Chip     | Colour                                                                 |
| -------- | ---------------------------------------------------------------------- |
| Services | Red while the Matter server or the Thread border router is not running |
| Updates  | Amber while any core, add-on or integration `update` entity is on      |
| Firmware | Amber while any device `update` entity is on, the rooms' included      |

| Section   | Contents                                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resources | The virtual machine's CPU, its memory as a bar, and the disk used and free                                                                                                                                            |
| Backups   | The last successful automatic backup, and the last one attempted, both as relative times: they differ while the latest backup failed; and a red row while `problem` is on. The section is drawn when `backups` is set |
| Services  | One red row per `services` entry, named by its device and shown only while it is not running (`stopped-row`)                                                                                                          |
| Updates   | One flag row per `update` entity, shown while on (`pending-row`)                                                                                                                                                      |
| Firmware  | The same for the devices outside any room; then one list per room, such as "Bedroom firmware", from the room's `firmware`                                                                                             |

### AdGuard, `#adguard`

The tile takes its name from the protection switch's device, "AdGuard Home", and its icon from the switch, so the shield shows whether blocking is on. Under it are the share of queries blocked and the average processing time. Its chips are Update, amber while AdGuard has one, and the protection switch itself, amber while on.

**Protection is the only control.** It is for when a site breaks and blocking has to pause. It is a toggle chip on the tile and the power button of the pop-up's header, whose icon turns orange while protection is off.

| Section    | Contents                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------- |
| Queries    | The DNS queries, those blocked, the blocked share as a bar, and the average processing time |
| Blocklists | The rule count, red at 0: the lists failed to download, and nothing is blocked              |
| Update     | AdGuard's `update` entity, shown while on                                                   |

### Network, `#network`

The tile has the first internet latency under it, and three chips: Devices, red while a network device is anything but connected, upgrading or provisioning (`device_up`); VPN, red while a `vpn` machine is not connected to Tailscale's control server; and Firmware, amber while a network device has an update.

| Section  | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internet | Each `latency`: the gateway's average round trip to Cloudflare and to Google; then the WAN port's link speed (`link-row`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Devices  | The router, the switches and the AP, named by their devices, each red while it isn't up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Router   | The gateway's CPU as a bar, and its temperature                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| VPN      | One row per `vpn` machine, the Tailscale router and exit node, named by its device, red while it is not connected to Tailscale's control server                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Wi-Fi    | One item per `wifi` network, named by its device, which is the SSID as UniFi names it, with On or Off as its line, and a power button on a `switchable` one. A tap opens the network's QR code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Clients  | `mnml-clients-card`: one section per network with a client connected, in the model's order, headed by the network's icon and name and the count, which a screen reader hears as "3 clients". Rows sort by IP: the connection type's icon (Wi-Fi, Ethernet, else a question mark, each labelled for a screen reader), the name with the FQDN under it, the IP. A client in no listed subnet, or without an IPv4 address, goes to Other, last. A client UniFi has no name for takes its FQDN, then its IP. While the clients sensor has no value or no list, the card draws nothing; while it is unavailable, a Clients heading over the orange dash. "No clients" means UniFi listed none. Each network folds to its heading and count; Other stays open, since a client outside every known network needs you. A tap opens or folds one, until the page reloads |
| Firmware | One flag row per network device's `update` entity, shown while on                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Clients come from two sensors.** UniFi lists the clients connected now, with their names and IPs; AdGuard's reverse lookups give each IP its FQDN: its `rDNS` names count, and its `etc/hosts` names with a dot, since AdGuard knows its own host, `dns.home.arpa`, only from there. Undotted hosts entries such as `ip6-allnodes`, and ARP, DHCP and WHOIS names, don't. The card joins them by IP, so a row survives AdGuard being down, without its FQDN, and `names` is optional for a home without AdGuard. UniFi's networks carry no subnet, so `clients.networks` spells each network's name, icon and subnet, in the order the sections take; the first network whose subnet holds an IP takes it. A subnet that isn't an IPv4 range (octets 0-255, a prefix of 0-32) fails the card's configuration, and `problems()` checks every subnet of the home, so a typo can't quietly empty a network.

**Only the Guests network can be switched.** The Wi-Fi items take their name and their On or Off from UniFi's switch for the network. Only a network the model marks `switchable` gets a power button, on its item and its pop-up's header: Guests, which is on only while there are guests. The others have none, since turning off a network the dashboard is reached over would cut the dashboard off with it.

**The latency is a reading, not an alarm.** The sensor reports the gateway's average round trip to each target, and nothing in it says the line is down, so no chip watches it. Two targets tell a slow site from a slow line.

### Wi-Fi, `#network-<key>`

The QR code a phone scans to join one network: UniFi's `image` entity for it, as a `picture-entity` under "Scan to join". The header is the network's switch, named by its device, with "Network" as its line and a back button to `#network`. UniFi draws the code from the network's SSID and password, so a new password shows here without a change to the model.

**An off network has no code.** UniFi reports the image unavailable while its network is off, which a `picture-entity` draws as a spinner that never ends. So the heading and the code are hidden while the switch reads `off` (`while-not-off`), and the header's line reads "Network • Off".

### Media, `#media`

The media server: Plex, and Jellyfin beside it while one replaces the other, which stream, Seerr, where requests come in, and Radarr and Sonarr, which fetch them. The tile has the streams playing under it, one count for each server with its own icon, and up to four chips: Requests, amber while a request waits for approval; Downloads, amber while Radarr's or Sonarr's queue is not empty; Health, red while Radarr reports a problem; and Update, amber while Plex has one.

| Section   | Contents                                                                                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Watching  | Each server's streams, named by its device                                                                                                                                                                  |
| Requests  | Those pending, amber while not 0, and those processing                                                                                                                                                      |
| Downloads | Radarr's and Sonarr's queues, named by their devices, amber while not 0; Sonarr's wanted episodes; Radarr's health, shown while it reports a problem                                                        |
| Upcoming  | `mnml-agenda-card` over Sonarr's and Radarr's `calendar`s: the episodes and movies from today on, by week, only the weeks that have something: the first, then one more per Next, and Back to now to return |
| Library   | The movies and the shows, named by their devices; Sonarr's upcoming episodes; the free space on Radarr's movies folder                                                                                      |
| Update    | Plex's `update` entity, shown while on                                                                                                                                                                      |

**Upcoming reads the calendars, not a sensor.** Home Assistant gives a calendar's events for any range, so the card asks for 13 weeks at a time, as far ahead as Next needs and a year past the last week shown at most, when the pop-up opens and again when a calendar's state changes; nothing is stored in Home Assistant. Weeks start on Monday, and days are the browser's.

**Wanted is a reading.** Sonarr counts every missing episode of a monitored show, aired before the show was added included, so the count stays high and colours nothing; the queue is what shows a download under way.

### Across the five

Every section that reports trouble is invisible while there is none: Services, Stopped, the Updates and Firmware lists, AdGuard's and Plex's Update. That is what makes the chips enough at a glance. The sections that report a reading (Resources, Host, Storage, Guests, Backups, Queries, Internet, Devices, Wi-Fi, VPN, Clients, Router, Watching, Requests, Downloads, Library) are always there, and colour a row only while something is wrong.

**Named by device.** The Storage, Stopped, Guests, Services, Devices, VPN, Updates and Firmware rows, the media server's queues, health and library counts, and the chips' tooltips, are labelled with the device (`label: 'device'`). Every `update` entity is named "Update" or "Firmware", every Proxmox guest's running state "Status", every storage's "Storage used", and every network device's "State", so the device is the only name that tells them apart. Device names are room-relative, so a device's firmware is spelled in its room, as its battery is, and the pop-up lists it under that room's name.

## The integrations' words and shapes

What the cards rely on that each integration decides, which only the live instance can confirm; the first suspects when something reported from it looks wrong.

- **BMW CarData states.**
  - `SELECTIVE-LOCKED`, `doorsOnly`, `doorsTiltCabin` and `INTERMEDIATE` are the integration's words. A state it adds comes out capitalised as is, and on the alarm chip it counts as armed.
  - The car plan reads `on` / `open` as open and `INTERMEDIATE` as half open.
  - Whether the door, hood and tailgate sensors have a device class decides whether their titles say Open / Closed or On / Off.
  - The target tyre pressures are hidden entities (`hidden_by: user`) whose states the cards still read.
- **Climate capabilities.**
  - The ACs report `fan_modes`, `swing_modes` and `swing_horizontal_modes`, in words of their own that HA has no icons or translations for, and the Better Thermostat entities `preset_modes` (and HA has icons for the presets).
  - Better Thermostat supports `climate.turn_on` and `climate.turn_off`. The ACs are switched through `climate.set_hvac_mode` only, `off` included.
  - The heating's target slider calls `climate.turn_on` before `climate.set_temperature` when the unit is off.
- **The vacuum.**
  - Stop calls `vacuum.stop`; a vacuum that can only pause would need `vacuum.pause`.
  - The dock's sensors: `dock_error`, the water boxes, and `mop_drying_remaining_time` in seconds, shown in minutes. Also `mop_attached`, and the map's `image` entity.
  - The dock's toggles show whatever icons HA gives its switches.
- **The client list.** The shapes of UniFi's and AdGuard's answers, which the two sensors pass on as they are ([Data](data.md#the-clients-card)).
- **The lights.** A bulb that lacks the white or colour mode does nothing with that slider.
- **Names and icons.** The names and icons HA shows for every entity, and whether they fit their lanes. The room pop-up's light item carries five controls: scenes, brightness, white temperature, hue and power.

## Names and icons

**Anything with an entity takes its name and icon from Home Assistant.** A card, row or control with an `entity` shows:

- the entity's own name from the registry (`entityName()`);
- its state icon (`ha-state-icon`), which follows its state.

Rename or re-icon the entity in HA, and every place that shows it follows. A name that is too long is shortened in HA, not here. An icon-only control shows whatever icon HA has for its entity, so an entity without a meaningful icon gets one in HA (Settings → Entities).

**Three options adjust a row's name** without spelling it:

- **`label: 'device'`** names a row after its device (`name_by_user`, then `name`), where the entity's name would repeat the section: the battery rows, the valve rows, the Energy rows, the Storage, Stopped, Guests, Services and Devices rows, the Updates and Firmware rows, and a status chip's tooltip. The car's tile and header use it too, so the car is called by its device ("Sedan"), and so do the Wi-Fi items and headers, so a network is called by its SSID.
- **`strip`** removes a literal suffix that every entry of a section shares, such as " time left" in Maintenance.
- **`strip_word`** removes a word with its optional plural and leading space, wherever it falls. `strip_word: Light` turns "Top Lights" into "Top", "Top Light 1" into "Top 1" and "TV Left Light" into "TV Left". The card builds the pattern from the bare word, so the YAML carries no expression.

**A literal `name` is written only where the label isn't the entity's own:**

- the car's Alarm flag, whose entity gives it its visibility while the label names the problem;
- "Service in";
- the mode cards (Preset, Mode, Fan, Swing, Horizontal swing), which are attributes of one entity;
- the Location access rows, named after their device rather than after the permission sensor.

**Names and icons are written for what has no entity, or stands for an action:**

- **Tiles and headers:** the room's `name`, and the room's or car's `icon`, from the model; "Lights", "Heating", "AC" and "Vacuum" on second-level headers. The car's tile and header take their name from HA: the metadata sensor's device, with `label: 'device'`. The person's take both from the `person` entity.
- **Headings,** and the car plan's title.
- **Slider buttons and cards:** the `light-controls` template's (Brightness, White temperature, Color), the heating's and the AC's target, Amount on the diffuser, Volume on a player.
- **Service buttons:** Dock, Locate, Start, Stop, the media transport; the power button (`mdi:power`).
- **The car's `status` chips** (Doors, Windows, Alarm, Tyres), since each sums up several entities.
- **The Energy table's headers:** Item, Now, Today, Total.
- **A `Device`'s name and icon:** "Phone", "Tablet", on its item in the person pop-up and on its own header. A device whose companion-app entities are all unavailable has no name in the registry to be called by.

# The shipped templates

Each shipped template's title, icon and description, its slots, the rules that find them, and the pop-ups it brings, as `templates/*.yaml` has them. `pnpm run fix:docs` writes this page from those files, and a test fails while it is stale: change the YAML, never this page. [templates.md](templates.md) describes the language, and its [notes](templates.md#notes-on-the-shipped-templates) what a template does beyond its description.

A slot without a rule is set by hand. A field's row reads `slot.field`, and for an `objects` slot names the field of each element. A slot passed whole to a card's or a control's key takes that key's shape, in [keys.md](keys.md).

## Shapes

From `templates/shapes.yaml`. A shape is an `object`, listed by its fields, or a single value, listed by its kind. A slot takes a list of an object shape with `kind: objects`. A field that names a shape is listed by that shape. A shape written over another names it, then what it changes.

- `meter`: `power`, `today`, `total`
- `outlet`: `entity` (required), `energy` (`meter`)
- `checks_actions`: `run` (required), `stop` (required), `running` (required)
- `checks`: `failed` (required), `warnings`, `last_run` (required), `overdue` (required), `actions` (`checks_actions`)
- `lights`: `group` (required), `color`, `members` (`light_member`, a list), `scenes`, `active_scene`
- `light_member`: `entity`, `members`
- `heating`: `entity` (required), `preset`, `preset_temperatures`, `schedule`, `thermostats` (`thermostat`, a list)
- `thermostat`: `valve`, `battery`
- `ac`: `entity` (required), `fan`, `swing`, `horizontal_swing`, `power_saving`, `dehumidifier`, `energy` (`meter`)
- `vacuum`: `entity` (required), `status`, `error`, `battery`, `current_room`, `progress`, `area`, `time`, `last_clean`, `mop_attached`, `water_box_attached`, `totals`, `map`, `routines`, `settings`, `consumables` (`consumable`, a list), `warnings`, `dock`; found by:
  - device with vacuum:
    - `entity`: vacuum
    - `status`: sensor with translation key status, then sensor named like "status"
    - `error`: sensor with translation key vacuum_error, then sensor named like "error", but not named like "dock"
    - `battery`: sensor with device class battery
    - `current_room`: sensor with translation key current_room, then sensor named like "current room"
    - `progress`: sensor with translation key clean_percent, then sensor named like "cleaning progress"
    - `area`: sensor with translation key cleaning_area, then sensor named like "cleaning area", but not named like "total"
    - `time`: sensor with translation key cleaning_time, then sensor named like "cleaning time", but not named like "total"
    - `last_clean`: sensor with translation key last_clean_end, then sensor named like "last clean end"
    - `mop_attached`: binary_sensor with translation key mop_attached, then binary_sensor named like "mop attached"
    - `water_box_attached`: binary_sensor with translation key water_box_attached, then binary_sensor named like "water box attached"
    - `totals`: field by field:
      - `count`: sensor with translation key total_cleaning_count, then sensor named like "total cleaning count"
      - `area`: sensor with translation key total_cleaning_area, then sensor named like "total cleaning area"
      - `time`: sensor with translation key total_cleaning_time, then sensor named like "total cleaning time"
    - `map`: image
    - `routines`: button in the category primary
    - `settings`: select in the category config, but not with translation key selected_map
    - `warnings`: binary_sensor with device class problem
    - `dock`: device with sensor with translation key dock_error or any entity of model dock or sensor named like "dock error", in the area:
      - `error`: sensor with translation key dock_error, then sensor named like "error"
      - `dust_emptying`: switch with translation key dust_emptying, then switch named like "dust emptying"
      - `mop_drying`: switch with translation key mop_drying, then switch named like "mop drying"
      - `mop_drying_time_left`: sensor with translation key mop_drying_remaining_time, then sensor named like "mop drying"
      - `mop_washing`: switch with translation key mop_washing, then switch named like "mop washing"
      - `warnings`: binary_sensor with device class problem
- `vacuum_popup`: `vacuum`, with `consumables.entity` and `dock.consumables.entity` required
- `consumable`: `entity`, `reset`
- `printer3d`: `entity` (required), `progress`, `filename`, `material`, `speed`, `start`, `finish`, `nozzle` (`printer3d_heater`), `bed` (`printer3d_heater`), `camera`, `actions` (required; `printer3d_actions`), `outlet` (`outlet`); found by:
  - device with any entity from the integration prusalink:
    - `entity`: sensor with translation key printer_state, then sensor with device class enum
    - `progress`: sensor with translation key progress, then sensor named like "progress"
    - `filename`: sensor with translation key filename, then sensor named like "filename"
    - `material`: sensor with translation key material, then sensor named like "material"
    - `speed`: sensor with translation key print_speed, then sensor named like "print speed"
    - `start`: sensor with translation key print_start, then sensor named like "print start"
    - `finish`: sensor with translation key print_finish, then sensor named like "print finish"
    - `nozzle`: field by field:
      - `temperature`: sensor with translation key nozzle_temperature, then sensor named like "nozzle temperature", but not named like "target"
      - `target`: sensor with translation key nozzle_target_temperature, then sensor named like "nozzle target temperature"
    - `bed`: field by field:
      - `temperature`: sensor with translation key heatbed_temperature, then sensor named like "heatbed temperature", but not named like "target"
      - `target`: sensor with translation key heatbed_target_temperature, then sensor named like "heatbed target temperature"
    - `camera`: camera
    - `actions`: field by field:
      - `pause`: button with translation key pause_job, then button named like "pause"
      - `resume`: button with translation key resume_job, then button named like "resume"
      - `continue`: button with translation key continue_job, then button named like "continue"
      - `cancel`: button with translation key cancel_job, then button named like "cancel"
- `printer3d_popup`: `printer3d`, with `progress`, `filename`, `material`, `speed`, `start`, `finish`, `nozzle`, `nozzle.temperature`, `bed`, `bed.temperature` and `outlet.energy.power` required
- `printer3d_heater`: `temperature`, `target`
- `printer3d_actions`: `pause`, `resume`, `continue`, `cancel`
- `camera`: `entity` (required), `motion`, `person`, `doorbell`
- `cover`: `entity` (required), `garage`
- `fan`: `entity` (required), `quality`
- `humidifier`: `entity` (required)
- `appliance`: `entity` (required), `remaining`, `power`
- `pet`: `feed` (required), `fed` (required), `food`, `litter`
- `plant`: `moisture` (required)
- `player`: `entity` (required), `key`
- `speaker`: `key` (required), `entity` (required), `bass`, `treble`, `balance`, `loudness`, `tv`, `subwoofer`, `surround`
- `diffuser`: `entity` (required), `amount` (required)
- `person_device`: `key` (required), `name`, `icon`, `tracker`, `battery`, `battery_state`, `connection`, `network`, `storage`, `focus`, `focus_name`, `activity`, `permission`
- `person_device_popup`: `person_device`, with `battery`, `battery_state`, `connection`, `network`, `storage`, `focus`, `activity` and `permission` required
- `health`: `steps` (required), `distance` (required), `flights_climbed` (required), `active_energy` (required), `resting_energy` (required)
- `guest`: `host`, `status` (required), `cpu`, `memory`, `disk`
- `server_temperatures`: `cpu` (required), `root_disk` (required)
- `server_disks`: `pool` (required), `failing` (required), `life_left` (required)
- `server_backups`: `last` (required), `problem` (required), `bucket`
- `notifications`: `messages` (required), `clear`, `sources`
- `message_source`: `source`, `name`, `entity`
- `system_backups`: `last` (required), `attempted`, `problem`
- `room_firmware`: `name` (required), `firmware`
- `battery_group`: `name`, `entity`, `icon` (by default `'mdi:battery-low'`), `batteries` (required)
- `room_leaks`: `room` (required), `sensors` (required)
- `wifi`: `key` (required), `enabled` (required), `qr`, `switchable`
- `clients`: `entity` (required), `names`, `networks` (required)
- `router`: `cpu` (required), `temperature` (required)
- `tailscale_device`: `connected` (required), `essential`, `ip_address`, `last_seen`, `expires`, `update`, `udp`
- `media_requests`: `pending` (required), `processing` (required)
- `movies`: `queue` (required), `count` (required), `health`, `space`, `calendar`
- `shows`: `queue` (required), `count` (required), `wanted`, `upcoming`, `calendar`
- `lock_words`: `secured`, `selectivelocked`; by default `{ secured: 'Locked', selectivelocked: 'Partly locked' }`
- `alarm_words`: `doorsonly`, `doorstiltcabin`; by default `{ doorsonly: 'Doors only', doorstiltcabin: 'Armed' }`
- `square`: of kind `text`

## Common parts

From `templates/common.yaml`.

### `section-heading`

**Section heading**, `mdi:format-title`: A section's heading, the full width of the section.

| Slot       | Kind    | Required or default |
| ---------- | ------- | ------------------- |
| `title`    | text    | required            |
| `icon`     | icon    | required            |
| `state`    | objects |                     |
| `controls` | objects |                     |

### `power`

**Power button**, `mdi:power`: A filled power toggle for an entity, lit while the entity is on, and armed by a first press while its state matches confirm.

| Slot      | Kind   | Required or default |
| --------- | ------ | ------------------- |
| `entity`  | entity | required            |
| `confirm` | object |                     |
| `color`   | text   | `'amber'`           |
| `when`    | object |                     |

### `nav-chip`

**Pop-up chip**, `mdi:open-in-app`: A coloured chip that opens a pop-up.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |
| `popup`  | text   | required            |
| `color`  | text   | required            |
| `when`   | object |                     |

### `checks-actions`

**Checks run and stop**, `mdi:clipboard-play-outline`: The daily checks' Run and Stop controls, Run shown while they are not running and Stop while they are.

| Slot              | Kind   | Required or default |
| ----------------- | ------ | ------------------- |
| `actions`         | object | required            |
| `actions.run`     | entity | required            |
| `actions.stop`    | entity | required            |
| `actions.running` | entity | required            |

### `checks-controls`

**Checks controls**, `mdi:clipboard-check-outline`: The daily checks' Failed and Warnings icons, each drawn while it is not 0, then their Run and Stop controls.

| Slot                     | Kind   | Required or default |
| ------------------------ | ------ | ------------------- |
| `checks`                 | object | required            |
| `checks.failed`          | entity | required            |
| `checks.warnings`        | entity |                     |
| `checks.last_run`        | entity | required            |
| `checks.overdue`         | entity | required            |
| `checks.actions`         | object |                     |
| `checks.actions.run`     | entity | required            |
| `checks.actions.stop`    | entity | required            |
| `checks.actions.running` | entity | required            |

### `while-not-off`

**While not off**, `mdi:eye-outline`: The visibility that shows a card while its entity is not off.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity |                     |

### `batteries`

**Battery list**, `mdi:battery-low`: A folding list of batteries, lowest first, orange under 20 % and red under 5 %.

| Slot        | Kind     | Required or default |
| ----------- | -------- | ------------------- |
| `batteries` | entities |                     |
| `low`       | number   | `20`                |
| `critical`  | number   | `5`                 |

### `energy-table`

**Energy table**, `mdi:table`: A folding table of meters, now, today and in total, the heading summing what they used today.

| Slot           | Kind    | Required or default |
| -------------- | ------- | ------------------- |
| `meters`       | objects |                     |
| `meters.power` | entity  | required            |
| `meters.today` | entity  |                     |
| `meters.total` | entity  |                     |

### `pending-row`

**Pending update row**, `mdi:update`: A list row that flags an update while it is pending.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |

### `stopped-row`

**Stopped row**, `mdi:stop-circle-outline`: A list row, red, shown while a service or guest is off.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |

### `link-row`

**Link speed row**, `mdi:speedometer`: A list row for a link speed, orange while it is not the full speed.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |
| `speed`  | text   | `'10000'`           |

## 3D printer

From `templates/3d-printer.yaml`.

### `3d-printer-actions`

**3D printer actions**, `mdi:printer-3d-nozzle`: A 3D printer's Cancel, Pause, Resume and Continue buttons, each shown in the job state it applies to.

| Slot               | Kind   | Required or default |
| ------------------ | ------ | ------------------- |
| `entity`           | entity | required            |
| `actions`          | object |                     |
| `actions.pause`    | entity |                     |
| `actions.resume`   | entity |                     |
| `actions.continue` | entity |                     |
| `actions.cancel`   | entity |                     |

### `3d-printer-state`

**3D printer state**, `mdi:printer-3d-nozzle`: A 3D printer's state line: its outlet's Off while the outlet is off, else its state, then the job's progress while one runs.

| Slot                            | Kind   | Required or default |
| ------------------------------- | ------ | ------------------- |
| `printer3d`                     | object | required            |
| `printer3d.entity`              | entity | required            |
| `printer3d.progress`            | entity |                     |
| `printer3d.filename`            | entity |                     |
| `printer3d.material`            | entity |                     |
| `printer3d.speed`               | entity |                     |
| `printer3d.start`               | entity |                     |
| `printer3d.finish`              | entity |                     |
| `printer3d.nozzle`              | object |                     |
| `printer3d.nozzle.temperature`  | entity |                     |
| `printer3d.nozzle.target`       | entity |                     |
| `printer3d.bed`                 | object |                     |
| `printer3d.bed.temperature`     | entity |                     |
| `printer3d.bed.target`          | entity |                     |
| `printer3d.camera`              | entity |                     |
| `printer3d.actions`             | object | required            |
| `printer3d.actions.pause`       | entity |                     |
| `printer3d.actions.resume`      | entity |                     |
| `printer3d.actions.continue`    | entity |                     |
| `printer3d.actions.cancel`      | entity |                     |
| `printer3d.outlet`              | object |                     |
| `printer3d.outlet.entity`       | entity | required            |
| `printer3d.outlet.energy`       | object |                     |
| `printer3d.outlet.energy.power` | entity |                     |
| `printer3d.outlet.energy.today` | entity |                     |
| `printer3d.outlet.energy.total` | entity |                     |

Found by:

- `printer3d`: the rule of the shape `printer3d`, under [Shapes](#shapes)

### `3d-printer-controls`

**3D printer controls**, `mdi:printer-3d-nozzle`: A 3D printer's job buttons while a job runs, then its outlet's power button while none does.

| Slot                            | Kind   | Required or default |
| ------------------------------- | ------ | ------------------- |
| `printer3d`                     | object | required            |
| `printer3d.entity`              | entity | required            |
| `printer3d.progress`            | entity |                     |
| `printer3d.filename`            | entity |                     |
| `printer3d.material`            | entity |                     |
| `printer3d.speed`               | entity |                     |
| `printer3d.start`               | entity |                     |
| `printer3d.finish`              | entity |                     |
| `printer3d.nozzle`              | object |                     |
| `printer3d.nozzle.temperature`  | entity |                     |
| `printer3d.nozzle.target`       | entity |                     |
| `printer3d.bed`                 | object |                     |
| `printer3d.bed.temperature`     | entity |                     |
| `printer3d.bed.target`          | entity |                     |
| `printer3d.camera`              | entity |                     |
| `printer3d.actions`             | object | required            |
| `printer3d.actions.pause`       | entity |                     |
| `printer3d.actions.resume`      | entity |                     |
| `printer3d.actions.continue`    | entity |                     |
| `printer3d.actions.cancel`      | entity |                     |
| `printer3d.outlet`              | object |                     |
| `printer3d.outlet.entity`       | entity | required            |
| `printer3d.outlet.energy`       | object |                     |
| `printer3d.outlet.energy.power` | entity |                     |
| `printer3d.outlet.energy.today` | entity |                     |
| `printer3d.outlet.energy.total` | entity |                     |

Found by:

- `printer3d`: the rule of the shape `printer3d`, under [Shapes](#shapes)

### `3d-printer-card`

**3D printer**, `mdi:printer-3d`: A 3D printer as an item, its outlet or its state and job progress, opening its pop-up; it brings the pop-up.

| Slot                            | Kind   | Required or default |
| ------------------------------- | ------ | ------------------- |
| `key`                           | text   | required            |
| `name`                          | text   | required            |
| `printer3d`                     | object | required            |
| `printer3d.entity`              | entity | required            |
| `printer3d.progress`            | entity | required            |
| `printer3d.filename`            | entity | required            |
| `printer3d.material`            | entity | required            |
| `printer3d.speed`               | entity | required            |
| `printer3d.start`               | entity | required            |
| `printer3d.finish`              | entity | required            |
| `printer3d.nozzle`              | object | required            |
| `printer3d.nozzle.temperature`  | entity | required            |
| `printer3d.nozzle.target`       | entity |                     |
| `printer3d.bed`                 | object | required            |
| `printer3d.bed.temperature`     | entity | required            |
| `printer3d.bed.target`          | entity |                     |
| `printer3d.camera`              | entity |                     |
| `printer3d.actions`             | object | required            |
| `printer3d.actions.pause`       | entity |                     |
| `printer3d.actions.resume`      | entity |                     |
| `printer3d.actions.continue`    | entity |                     |
| `printer3d.actions.cancel`      | entity |                     |
| `printer3d.outlet`              | object |                     |
| `printer3d.outlet.entity`       | entity | required            |
| `printer3d.outlet.energy`       | object |                     |
| `printer3d.outlet.energy.power` | entity | required            |
| `printer3d.outlet.energy.today` | entity |                     |
| `printer3d.outlet.energy.total` | entity |                     |

Found by:

- `key`: the area's id
- `name`: the area's name
- `printer3d`: the rule of the shape `printer3d`, under [Shapes](#shapes)

Brings `3d-printer-popup`.

### `3d-printer-popup`

**3D printer pop-up**, `mdi:printer-3d`: A 3D printer's pop-up, which its card brings: its state and job buttons in its header, its camera, print, temperatures and power.

| Slot                            | Kind   | Required or default |
| ------------------------------- | ------ | ------------------- |
| `key`                           | text   | required            |
| `name`                          | text   | required            |
| `printer3d`                     | object | required            |
| `printer3d.entity`              | entity | required            |
| `printer3d.progress`            | entity | required            |
| `printer3d.filename`            | entity | required            |
| `printer3d.material`            | entity | required            |
| `printer3d.speed`               | entity | required            |
| `printer3d.start`               | entity | required            |
| `printer3d.finish`              | entity | required            |
| `printer3d.nozzle`              | object | required            |
| `printer3d.nozzle.temperature`  | entity | required            |
| `printer3d.nozzle.target`       | entity |                     |
| `printer3d.bed`                 | object | required            |
| `printer3d.bed.temperature`     | entity | required            |
| `printer3d.bed.target`          | entity |                     |
| `printer3d.camera`              | entity |                     |
| `printer3d.actions`             | object | required            |
| `printer3d.actions.pause`       | entity |                     |
| `printer3d.actions.resume`      | entity |                     |
| `printer3d.actions.continue`    | entity |                     |
| `printer3d.actions.cancel`      | entity |                     |
| `printer3d.outlet`              | object |                     |
| `printer3d.outlet.entity`       | entity | required            |
| `printer3d.outlet.energy`       | object |                     |
| `printer3d.outlet.energy.power` | entity | required            |
| `printer3d.outlet.energy.today` | entity |                     |
| `printer3d.outlet.energy.total` | entity |                     |

Found by:

- `printer3d`: the rule of the shape `printer3d`, under [Shapes](#shapes)

## AdGuard Home

From `templates/adguard.yaml`.

### `adguard`

**AdGuard Home**, `mdi:shield-check`: An AdGuard Home tile, its block ratio and speed, its update chip and its protection toggle, which asks before turning protection off; it brings its pop-up.

| Slot         | Kind   | Required or default |
| ------------ | ------ | ------------------- |
| `protection` | entity | required            |
| `queries`    | entity |                     |
| `blocked`    | entity |                     |
| `ratio`      | entity |                     |
| `speed`      | entity |                     |
| `rules`      | entity |                     |
| `update`     | entity |                     |
| `square`     | text   |                     |

Found by:

- `protection`: switch from the integration adguard, with translation key protection, anywhere in the home
- `queries`: sensor from the integration adguard, with translation key dns_queries, anywhere in the home
- `blocked`: sensor from the integration adguard, with translation key dns_queries_blocked, anywhere in the home
- `ratio`: sensor from the integration adguard, with translation key dns_queries_blocked_ratio, anywhere in the home
- `speed`: sensor from the integration adguard, with translation key average_processing_speed, anywhere in the home
- `rules`: sensor from the integration adguard, with translation key rules_count, anywhere in the home
- `update`: update from the integration adguard, anywhere in the home

Brings `adguard-popup`.

### `adguard-popup`

**AdGuard Home pop-up**, `mdi:shield-check`: AdGuard Home's pop-up, its queries, blocklists and update.

| Slot         | Kind   | Required or default |
| ------------ | ------ | ------------------- |
| `protection` | entity | required            |
| `queries`    | entity |                     |
| `blocked`    | entity |                     |
| `ratio`      | entity |                     |
| `speed`      | entity |                     |
| `rules`      | entity |                     |
| `update`     | entity |                     |

## Car

From `templates/car.yaml`.

### `car`

**Car**, `mdi:car`: A car's tile, its fuel, and its doors, windows, alarm and tyres chips; it brings the car's pop-up. The defaults are BMW CarData's words.

| Slot                         | Kind     | Required or default                                       |
| ---------------------------- | -------- | --------------------------------------------------------- |
| `key`                        | text     | required                                                  |
| `icon`                       | icon     | `'mdi:car'`                                               |
| `metadata`                   | entity   | required                                                  |
| `fuel`                       | entity   |                                                           |
| `remaining_fuel`             | entity   |                                                           |
| `range`                      | entity   |                                                           |
| `mileage`                    | entity   |                                                           |
| `service`                    | entity   |                                                           |
| `battery_voltage`            | entity   |                                                           |
| `coolant_temperature`        | entity   |                                                           |
| `lock`                       | entity   |                                                           |
| `alarm`                      | entity   |                                                           |
| `alarm_active`               | entity   |                                                           |
| `doors`                      | entities | required                                                  |
| `hood`                       | entity   | required                                                  |
| `tailgate`                   | entity   | required                                                  |
| `windows`                    | entities | required                                                  |
| `sunroof`                    | entity   |                                                           |
| `tyres`                      | entities | required                                                  |
| `tyre_targets`               | entities | required                                                  |
| `location`                   | entity   |                                                           |
| `lock_words`                 | object   | `{ secured: 'Locked', selectivelocked: 'Partly locked' }` |
| `lock_words.secured`         | text     |                                                           |
| `lock_words.selectivelocked` | text     |                                                           |
| `alarm_words`                | object   | `{ doorsonly: 'Doors only', doorstiltcabin: 'Armed' }`    |
| `alarm_words.doorsonly`      | text     |                                                           |
| `alarm_words.doorstiltcabin` | text     |                                                           |
| `unlocked`                   | texts    | `['unlocked', 'selectivelocked']`                         |
| `disarmed`                   | texts    | `['unarmed']`                                             |
| `open_states`                | texts    | `['open', 'intermediate']`                                |
| `tyre_low_share`             | number   | `0.9`                                                     |
| `tyre_warn_share`            | number   | `0.95`                                                    |
| `square`                     | text     |                                                           |

Brings `car-popup`.

### `car-plan`

**Car plan**, `mdi:car-info`: A car seen from above, its openings and tyres.

| Slot              | Kind     | Required or default |
| ----------------- | -------- | ------------------- |
| `doors`           | entities | required            |
| `hood`            | entity   | required            |
| `tailgate`        | entity   | required            |
| `windows`         | entities | required            |
| `sunroof`         | entity   |                     |
| `open_states`     | texts    |                     |
| `half_states`     | texts    |                     |
| `tyres`           | entities | required            |
| `tyre_targets`    | entities | required            |
| `tyre_low_share`  | number   | `0.9`               |
| `tyre_warn_share` | number   | `0.95`              |

### `car-popup`

**Car pop-up**, `mdi:car`: A car's pop-up: its fuel and range in its header, its security, its plan, its details and where it is.

| Slot                         | Kind     | Required or default                                       |
| ---------------------------- | -------- | --------------------------------------------------------- |
| `key`                        | text     | required                                                  |
| `icon`                       | icon     | `'mdi:car'`                                               |
| `metadata`                   | entity   | required                                                  |
| `fuel`                       | entity   |                                                           |
| `remaining_fuel`             | entity   |                                                           |
| `range`                      | entity   |                                                           |
| `mileage`                    | entity   |                                                           |
| `service`                    | entity   |                                                           |
| `battery_voltage`            | entity   |                                                           |
| `coolant_temperature`        | entity   |                                                           |
| `lock`                       | entity   |                                                           |
| `alarm`                      | entity   |                                                           |
| `alarm_active`               | entity   |                                                           |
| `doors`                      | entities | required                                                  |
| `hood`                       | entity   | required                                                  |
| `tailgate`                   | entity   | required                                                  |
| `windows`                    | entities | required                                                  |
| `sunroof`                    | entity   |                                                           |
| `tyres`                      | entities | required                                                  |
| `tyre_targets`               | entities | required                                                  |
| `location`                   | entity   |                                                           |
| `lock_words`                 | object   | `{ secured: 'Locked', selectivelocked: 'Partly locked' }` |
| `lock_words.secured`         | text     |                                                           |
| `lock_words.selectivelocked` | text     |                                                           |
| `alarm_words`                | object   | `{ doorsonly: 'Doors only', doorstiltcabin: 'Armed' }`    |
| `alarm_words.doorsonly`      | text     |                                                           |
| `alarm_words.doorstiltcabin` | text     |                                                           |
| `unlocked`                   | texts    | `['unlocked', 'selectivelocked']`                         |
| `disarmed`                   | texts    | `['unarmed']`                                             |
| `open_states`                | texts    | `['open', 'intermediate']`                                |
| `tyre_low_share`             | number   | `0.9`                                                     |
| `tyre_warn_share`            | number   | `0.95`                                                    |

## Climate

From `templates/climate.yaml`.

### `ac-controls`

**AC controls**, `mdi:air-conditioner`: An AC's target temperature slider, its mode menu, blue while it runs, and its fan menu when it has fan modes.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity |                     |
| `fan`    | flag   |                     |

### `heating-controls`

**Heating controls**, `mdi:radiator`: A heating's target temperature slider, its preset menu when it has presets, and its power toggle, amber while it runs.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |
| `preset` | flag   |                     |

### `ac-item`

**AC item**, `mdi:air-conditioner`: An AC as an item that opens its pop-up; it brings the pop-up.

| Slot               | Kind   | Required or default |
| ------------------ | ------ | ------------------- |
| `key`              | text   | required            |
| `name`             | text   | required            |
| `entity`           | entity | required            |
| `fan`              | flag   |                     |
| `swing`            | flag   |                     |
| `horizontal_swing` | flag   |                     |
| `power_saving`     | entity |                     |
| `dehumidifier`     | entity |                     |
| `energy`           | object |                     |
| `energy.power`     | entity | required            |
| `energy.today`     | entity |                     |
| `energy.total`     | entity |                     |

Found by:

- `key`: the area's id
- `name`: the area's name
- `entity`: climate with attribute hvac_modes cool
- `power_saving`: select with translation key power_saving_mode, then select named like "power saving"
- `dehumidifier`: number with translation key dehumidifier_level, then number named like "dehumidifier"
- `energy`: device with climate with attribute hvac_modes cool:
  - `power`: sensor with device class power
  - `today`: sensor with device class energy, from the integration utility_meter
  - `total`: sensor with device class energy, but not from the integration utility_meter

Brings `ac-popup`.

### `heating-item`

**Heating item**, `mdi:radiator`: A heating as an item that opens its pop-up, amber while it runs; it brings the pop-up.

| Slot                  | Kind     | Required or default |
| --------------------- | -------- | ------------------- |
| `key`                 | text     | required            |
| `name`                | text     | required            |
| `entity`              | entity   | required            |
| `preset`              | flag     |                     |
| `preset_temperatures` | entities |                     |
| `schedule`            | entity   |                     |
| `thermostats`         | objects  |                     |
| `thermostats.valve`   | entity   | required            |
| `thermostats.battery` | entity   |                     |
| `low`                 | number   | `20`                |
| `critical`            | number   | `5`                 |

Found by:

- `key`: the area's id
- `name`: the area's name
- `entity`: climate but not with attribute hvac_modes cool
- `preset_temperatures`: number from the integration better_thermostat
- `schedule`: schedule named like "heating", in the area
- `thermostats`, tried in turn:
  - one per device with sensor with translation key valve_position, in the area:
    - `valve`: sensor with translation key valve_position
    - `battery`: sensor with device class battery
  - one per device with sensor named like "valve position", in the area:
    - `valve`: sensor named like "valve position"
    - `battery`: sensor with device class battery

Brings `heating-popup`.

### `heating-popup`

**Heating pop-up**, `mdi:radiator`: A heating's pop-up, which its item brings: the preset and power in its header, the target, the preset temperatures, the schedule, the valves and their batteries.

| Slot                  | Kind     | Required or default |
| --------------------- | -------- | ------------------- |
| `key`                 | text     | required            |
| `name`                | text     | required            |
| `entity`              | entity   | required            |
| `preset`              | flag     |                     |
| `preset_temperatures` | entities |                     |
| `schedule`            | entity   |                     |
| `thermostats`         | objects  |                     |
| `thermostats.valve`   | entity   | required            |
| `thermostats.battery` | entity   |                     |
| `low`                 | number   | `20`                |
| `critical`            | number   | `5`                 |

Retired ([retired slots](templates.md#writing-a-template)): `batteries`.

### `ac-popup`

**AC pop-up**, `mdi:air-conditioner`: An AC's pop-up, which its item brings: its mode in its header, its target, its fan, swing and other settings, and its energy.

| Slot               | Kind   | Required or default |
| ------------------ | ------ | ------------------- |
| `key`              | text   | required            |
| `name`             | text   | required            |
| `entity`           | entity | required            |
| `fan`              | flag   |                     |
| `swing`            | flag   |                     |
| `horizontal_swing` | flag   |                     |
| `power_saving`     | entity |                     |
| `dehumidifier`     | entity |                     |
| `energy`           | object |                     |
| `energy.power`     | entity | required            |
| `energy.today`     | entity |                     |
| `energy.total`     | entity |                     |

## Devices

From `templates/devices.yaml`.

### `select-card`

**Dropdown**, `mdi:form-dropdown`: A dropdown over a select entity.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |

### `number-slider`

**Number slider**, `mdi:tune-vertical`: A slider over a number entity.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |

### `switch-card`

**Switch**, `mdi:toggle-switch-outline`: A switch as an item with its power toggle.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |

### `schedule-card`

**Schedule**, `mdi:calendar-clock`: A schedule as an item, on or off and when it next changes, amber while on.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |

### `timer-card`

**Timer**, `mdi:timer-outline`: A timer as an item, counting down while it runs, amber while it does: Start while it is not running, Pause while it is, Cancel and Finish while it is not idle, and its presets as a menu.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |

### `diffuser-card`

**Diffuser**, `mdi:spray`: A diffuser with its amount, an amount slider and its power toggle.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |
| `amount` | entity |                     |

### `media-card`

**Media player**, `mdi:play-circle-outline`: A media player, opening a pop-up when it has one.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |
| `popup`  | text   |                     |

Found by:

- `entity`: media_player

### `cover-card`

**Cover**, `mdi:blinds-horizontal`: A cover, such as a blind, a shade or a garage door, with its position slider when it has one, and its open, stop and close buttons.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |
| `garage` | flag   |                     |

Found by:

- `entity`: cover

### `fan-card`

**Fan**, `mdi:fan`: A fan or air purifier with its air quality, its speed slider and its power toggle.

| Slot      | Kind   | Required or default |
| --------- | ------ | ------------------- |
| `entity`  | entity | required            |
| `quality` | entity |                     |

Found by:

- `entity`: fan

### `humidifier-card`

**Humidifier**, `mdi:air-humidifier`: A humidifier or dehumidifier with its target humidity slider and its power toggle.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |

Found by:

- `entity`: humidifier

### `camera-card`

**Camera**, `mdi:cctv`: A camera's live picture.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |

Found by:

- `entity`: camera

### `camera-activity`

**Camera activity**, `mdi:motion-sensor`: A folding list of what the cameras of a room detect: motion, a person, a ring at the door. Orange while detected.

| Slot               | Kind    | Required or default |
| ------------------ | ------- | ------------------- |
| `cameras`          | objects |                     |
| `cameras.entity`   | entity  | required            |
| `cameras.motion`   | entity  |                     |
| `cameras.person`   | entity  |                     |
| `cameras.doorbell` | entity  |                     |

### `appliance-card`

**Appliance**, `mdi:washing-machine`: A washer, dryer or dishwasher with its cycle state, the time left and its power draw; blue while a cycle runs.

| Slot        | Kind   | Required or default |
| ----------- | ------ | ------------------- |
| `entity`    | entity | required            |
| `remaining` | entity |                     |
| `power`     | entity |                     |

### `pet-card`

**Pet feeder**, `mdi:paw`: A pet's feeder with when it last ate, the food and litter levels, and a feed button.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `feed`   | entity | required            |
| `fed`    | entity | required            |
| `food`   | entity |                     |
| `litter` | entity |                     |

### `plants`

**Plants**, `mdi:flower`: A folding list of the plants' soil moisture, driest first, orange under 30 % and red under 15 %.

| Slot              | Kind    | Required or default |
| ----------------- | ------- | ------------------- |
| `plants`          | objects |                     |
| `plants.moisture` | entity  | required            |
| `low`             | number  | `30`                |
| `critical`        | number  | `15`                |

## Energy

From `templates/energy.yaml`.

### `energy-popup`

**Energy pop-up**, `mdi:lightning-bolt`: The energy pop-up: the power now and the energy today, from the grid, the sun, the battery and the EV charger, and a table of the home's metered devices, highest power first: each one's power now, its energy today and in total, and with a usage sensor its share of the home's usage. Home Assistant's energy settings fill the grid, solar and battery power, the battery's charge and the devices.

| Slot            | Kind    | Required or default |
| --------------- | ------- | ------------------- |
| `usage`         | entity  |                     |
| `grid`          | entity  |                     |
| `solar`         | entity  |                     |
| `battery`       | entity  |                     |
| `battery_power` | entity  |                     |
| `ev`            | entity  |                     |
| `grid_today`    | entity  |                     |
| `solar_today`   | entity  |                     |
| `export_today`  | entity  |                     |
| `meters`        | objects |                     |
| `meters.power`  | entity  | required            |
| `meters.today`  | entity  |                     |
| `meters.total`  | entity  |                     |
| `popup`         | text    | `'#energy'`         |

Found by:

- `grid`: the grid's power in the energy settings
- `solar`: the solar power in the energy settings
- `battery`: the battery's charge in the energy settings
- `battery_power`: the battery's power in the energy settings
- `meters`: the devices of the energy settings

### `meter-table`

**Meter table**, `mdi:meter-electric`: A table of meters, highest power first, the heading summing their power now: each one's power now, its energy today and in total, and with a usage sensor a Share column, each one's power as a share of the usage.

| Slot           | Kind    | Required or default |
| -------------- | ------- | ------------------- |
| `meters`       | objects | required            |
| `meters.power` | entity  | required            |
| `meters.today` | entity  |                     |
| `meters.total` | entity  |                     |
| `usage`        | entity  |                     |

Found by:

- `meters`: the devices of the energy settings

## Glances

From `templates/glances.yaml`.

### `glances`

**Glances**, `mdi:view-dashboard-outline`: The strip of the home's overall statuses, one line across the section: the weather, the alarm, the vacation toggle, the power the home uses, each timer while it runs, and whatever needs you: failed checks, Home Assistant's messages, stopped guests, devices down or offline, low batteries, a leak, smoke. What does not need you is not drawn.

| Slot                       | Kind     | Required or default                          |
| -------------------------- | -------- | -------------------------------------------- |
| `weather`                  | entity   |                                              |
| `alarm`                    | entity   |                                              |
| `vacation`                 | entity   |                                              |
| `people`                   | entities |                                              |
| `energy`                   | object   |                                              |
| `energy.usage`             | entity   |                                              |
| `energy.grid`              | entity   |                                              |
| `energy.solar`             | entity   |                                              |
| `energy.battery`           | entity   |                                              |
| `energy.battery_power`     | entity   |                                              |
| `energy.ev`                | entity   |                                              |
| `energy.grid_today`        | entity   |                                              |
| `energy.solar_today`       | entity   |                                              |
| `energy.export_today`      | entity   |                                              |
| `meters`                   | objects  |                                              |
| `meters.power`             | entity   | required                                     |
| `meters.today`             | entity   |                                              |
| `meters.total`             | entity   |                                              |
| `timers`                   | objects  |                                              |
| `timers.entity`            | entity   | required                                     |
| `timers.room`              | text     |                                              |
| `checks`                   | object   |                                              |
| `checks.failed`            | entity   | required                                     |
| `checks.warnings`          | entity   |                                              |
| `checks.last_run`          | entity   | required                                     |
| `checks.overdue`           | entity   | required                                     |
| `checks.actions`           | object   |                                              |
| `checks.actions.run`       | entity   | required                                     |
| `checks.actions.stop`      | entity   | required                                     |
| `checks.actions.running`   | entity   | required                                     |
| `batteries`                | entities |                                              |
| `battery_groups`           | objects  |                                              |
| `battery_groups.name`      | text     |                                              |
| `battery_groups.entity`    | entity   |                                              |
| `battery_groups.icon`      | icon     | `'mdi:battery-low'`                          |
| `battery_groups.batteries` | entities | required                                     |
| `leaks`                    | entities |                                              |
| `room_leaks`               | objects  |                                              |
| `room_leaks.room`          | text     | required                                     |
| `room_leaks.sensors`       | entities | required                                     |
| `smoke`                    | entities |                                              |
| `notifications`            | entity   |                                              |
| `messages`                 | flag     |                                              |
| `updates`                  | entities |                                              |
| `services`                 | entities |                                              |
| `disks`                    | entity   |                                              |
| `backup`                   | entity   |                                              |
| `guests`                   | entities |                                              |
| `network_devices`          | entities |                                              |
| `device_up`                | texts    | `['connected', 'upgrading', 'provisioning']` |
| `tailscale`                | entities |                                              |
| `media_health`             | entity   |                                              |
| `low`                      | number   | `20`                                         |
| `critical`                 | number   | `5`                                          |

Found by:

- `weather`: weather, anywhere in the home
- `alarm`: alarm_control_panel, anywhere in the home
- `people`: person, anywhere in the home
- `energy`: field by field:
  - `grid`: the grid's power in the energy settings
  - `solar`: the solar power in the energy settings
  - `battery`: the battery's charge in the energy settings
  - `battery_power`: the battery's power in the energy settings
- `meters`: the devices of the energy settings
- `timers`: device with timer, anywhere in the home:
  - `entity`: timer
  - `room`: the area's id
- `batteries`: sensor with device class battery, anywhere in the home
- `leaks`: binary_sensor with device class moisture, anywhere in the home
- `room_leaks`: one per area, anywhere in the home:
  - `room`: the area's id
  - `sensors`: binary_sensor with device class moisture
- `smoke`: binary_sensor with device class smoke, anywhere in the home
- `updates`: update, anywhere in the home
- `guests`: binary_sensor from the integration proxmoxve, with translation key status, anywhere in the home
- `network_devices`: sensor from the integration unifi, with translation key device_state, anywhere in the home
- `media_health`: binary_sensor from the integration radarr, with translation key health, anywhere in the home

Brings `energy-popup` (with `energy` or `meters`), `weather-popup` (with `weather`), `checks-popup` (with `checks`) and `batteries-popup` (with `batteries`).

### `glance-problems`

**What needs you**, `mdi:alert-circle-outline`: The items of the strip that need you, each drawn only while it does: failed checks, notifications, Home Assistant's messages, failing disks, a backup problem, stopped guests, devices down or offline, the media server's health, low batteries, services down, updates, a leak, smoke.

| Slot                     | Kind     | Required or default                          |
| ------------------------ | -------- | -------------------------------------------- |
| `checks`                 | object   |                                              |
| `checks.failed`          | entity   | required                                     |
| `checks.warnings`        | entity   |                                              |
| `checks.last_run`        | entity   | required                                     |
| `checks.overdue`         | entity   | required                                     |
| `checks.actions`         | object   |                                              |
| `checks.actions.run`     | entity   | required                                     |
| `checks.actions.stop`    | entity   | required                                     |
| `checks.actions.running` | entity   | required                                     |
| `notifications`          | entity   |                                              |
| `messages`               | flag     |                                              |
| `disks`                  | entity   |                                              |
| `backup`                 | entity   |                                              |
| `guests`                 | entities |                                              |
| `network_devices`        | entities |                                              |
| `device_up`              | texts    | `['connected', 'upgrading', 'provisioning']` |
| `tailscale`              | entities |                                              |
| `media_health`           | entity   |                                              |
| `batteries`              | entities |                                              |
| `low`                    | number   | `20`                                         |
| `critical`               | number   | `5`                                          |
| `services`               | entities |                                              |
| `updates`                | entities |                                              |
| `leaks`                  | entities |                                              |
| `room_leaks`             | objects  |                                              |
| `room_leaks.room`        | text     | required                                     |
| `room_leaks.sensors`     | entities | required                                     |
| `smoke`                  | entities |                                              |

### `weather-popup`

**Weather pop-up**, `mdi:weather-partly-cloudy`: The weather now, its conditions and its forecast.

| Slot      | Kind   | Required or default |
| --------- | ------ | ------------------- |
| `weather` | entity | required            |

### `checks-popup`

**Checks pop-up**, `mdi:clipboard-check-outline`: The daily checks: what failed, the warnings, when they last ran, and the details.

| Slot                     | Kind   | Required or default |
| ------------------------ | ------ | ------------------- |
| `checks`                 | object | required            |
| `checks.failed`          | entity | required            |
| `checks.warnings`        | entity |                     |
| `checks.last_run`        | entity | required            |
| `checks.overdue`         | entity | required            |
| `checks.actions`         | object |                     |
| `checks.actions.run`     | entity | required            |
| `checks.actions.stop`    | entity | required            |
| `checks.actions.running` | entity | required            |

### `batteries-popup`

**Batteries pop-up**, `mdi:battery-low`: The batteries that are running low, lowest first, with their level as a bar, under a heading per group when the home gives groups.

| Slot               | Kind     | Required or default |
| ------------------ | -------- | ------------------- |
| `batteries`        | entities |                     |
| `groups`           | objects  |                     |
| `groups.name`      | text     |                     |
| `groups.entity`    | entity   |                     |
| `groups.icon`      | icon     | `'mdi:battery-low'` |
| `groups.batteries` | entities | required            |
| `low`              | number   | `20`                |
| `critical`         | number   | `5`                 |

## Home Assistant

From `templates/home-assistant.yaml`.

### `home-assistant`

**Home Assistant**, `mdi:home-assistant`: Home Assistant's tile, its memory and free disk, and its services, updates, firmware and messages chips; it brings its pop-up, with each room's firmware, and its messages' pop-up.

| Slot                     | Kind     | Required or default |
| ------------------------ | -------- | ------------------- |
| `cpu`                    | entity   |                     |
| `memory`                 | entity   |                     |
| `disk_free`              | entity   |                     |
| `disk_used`              | entity   |                     |
| `services`               | entities |                     |
| `updates`                | entities |                     |
| `firmware`               | entities |                     |
| `backups`                | object   |                     |
| `backups.last`           | entity   | required            |
| `backups.attempted`      | entity   |                     |
| `backups.problem`        | entity   |                     |
| `all_firmware`           | entities |                     |
| `room_firmware`          | objects  |                     |
| `room_firmware.name`     | text     | required            |
| `room_firmware.firmware` | entities |                     |
| `square`                 | text     |                     |

Found by:

- `cpu`: sensor from the integration systemmonitor, with translation key processor_use, anywhere in the home
- `memory`: sensor from the integration systemmonitor, with translation key memory_use_percent, anywhere in the home
- `disk_free`: sensor from the integration hassio, with translation key disk_free, anywhere in the home, then sensor from the integration systemmonitor, with translation key disk_free, anywhere in the home
- `disk_used`: sensor from the integration hassio, with translation key disk_used, anywhere in the home, then sensor from the integration systemmonitor, with translation key disk_use, anywhere in the home
- `updates`: update from the integration hassio, anywhere in the home
- `all_firmware`: update with device class firmware, anywhere in the home
- `room_firmware`: one per area, anywhere in the home:
  - `name`: the area's name
  - `firmware`: update with device class firmware

Brings `system-messages-popup` and `system-popup`.

### `system-popup`

**Home Assistant pop-up**, `mdi:home-assistant`: Home Assistant's pop-up: how many messages it has, opening their pop-up, then its resources, backups, services, updates, its own firmware and each room's.

| Slot                     | Kind     | Required or default |
| ------------------------ | -------- | ------------------- |
| `cpu`                    | entity   |                     |
| `memory`                 | entity   |                     |
| `disk_free`              | entity   |                     |
| `disk_used`              | entity   |                     |
| `services`               | entities |                     |
| `updates`                | entities |                     |
| `firmware`               | entities |                     |
| `backups`                | object   |                     |
| `backups.last`           | entity   | required            |
| `backups.attempted`      | entity   |                     |
| `backups.problem`        | entity   |                     |
| `all_firmware`           | entities |                     |
| `room_firmware`          | objects  |                     |
| `room_firmware.name`     | text     | required            |
| `room_firmware.firmware` | entities |                     |

Found by:

- `all_firmware`: update with device class firmware, anywhere in the home
- `room_firmware`: one per area, anywhere in the home:
  - `name`: the area's name
  - `firmware`: update with device class firmware

### `system-messages-popup`

**Home Assistant messages pop-up**, `mdi:bell-outline`: Home Assistant's messages pop-up: how many there are in its header, with a button that dismisses every notification, which asks first, then the notifications and, for an administrator, the repairs.

It takes no slots.

## Lights

From `templates/lights.yaml`.

### `light-controls`

**Light controls**, `mdi:tune-variant`: A light's brightness, white temperature and, for a colour light, hue sliders, then its power toggle.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity | required            |
| `color`  | flag   |                     |

### `light-state`

**Light state**, `mdi:lightbulb-outline`: A light's state line: Off while it is off, its brightness, and the active scene while it is on.

| Slot           | Kind   | Required or default |
| -------------- | ------ | ------------------- |
| `entity`       | entity | required            |
| `active_scene` | entity |                     |

### `light-item`

**Light item**, `mdi:lightbulb`: A light as an item, with its brightness, the active scene while it is on, its scenes and its sliders.

| Slot           | Kind     | Required or default |
| -------------- | -------- | ------------------- |
| `entity`       | entity   | required            |
| `strip_word`   | text     |                     |
| `popup`        | text     |                     |
| `scenes`       | entities |                     |
| `active_scene` | entity   |                     |
| `color`        | flag     |                     |

### `light-card`

**Light**, `mdi:lightbulb-group`: A light, or a light group with its members folded under it.

| Slot           | Kind     | Required or default |
| -------------- | -------- | ------------------- |
| `entity`       | entity   | required            |
| `members`      | entities |                     |
| `strip_word`   | text     |                     |
| `popup`        | text     |                     |
| `scenes`       | entities |                     |
| `active_scene` | entity   |                     |
| `color`        | flag     |                     |

Found by:

- `entity`: light from the integration group, then light

### `lights-popup`

**Lights pop-up**, `mdi:lightbulb-group`: A room's lights pop-up, its scenes and power in the header, its sliders over the whole group and every light.

| Slot              | Kind     | Required or default |
| ----------------- | -------- | ------------------- |
| `key`             | text     | required            |
| `name`            | text     | required            |
| `group`           | entity   | required            |
| `color`           | flag     |                     |
| `members`         | objects  |                     |
| `members.entity`  | entity   | required            |
| `members.members` | entities |                     |
| `scenes`          | entities |                     |
| `active_scene`    | entity   |                     |

## Media server

From `templates/media.yaml`.

### `media-server`

**Media server**, `mdi:filmstrip-box-multiple`: A media server's tile, what is being watched, and its requests, downloads, health and update chips; it brings its pop-up. The parts are Plex, Jellyfin, Seerr, Radarr and Sonarr.

| Slot                  | Kind     | Required or default               |
| --------------------- | -------- | --------------------------------- |
| `streams`             | entity   | required                          |
| `more_streams`        | entities |                                   |
| `update`              | entity   |                                   |
| `requests`            | object   |                                   |
| `requests.pending`    | entity   | required                          |
| `requests.processing` | entity   | required                          |
| `movies`              | object   |                                   |
| `movies.queue`        | entity   | required                          |
| `movies.count`        | entity   | required                          |
| `movies.health`       | entity   |                                   |
| `movies.space`        | entity   |                                   |
| `movies.calendar`     | entity   |                                   |
| `shows`               | object   |                                   |
| `shows.queue`         | entity   | required                          |
| `shows.count`         | entity   | required                          |
| `shows.wanted`        | entity   |                                   |
| `shows.upcoming`      | entity   |                                   |
| `shows.calendar`      | entity   |                                   |
| `none`                | texts    | `['0', 'unknown', 'unavailable']` |
| `square`              | text     |                                   |

Found by:

- `streams`: sensor from the integration jellyfin, with translation key watching, anywhere in the home
- `requests`: field by field:
  - `pending`: sensor from the integration overseerr, with translation key pending_requests, anywhere in the home
  - `processing`: sensor from the integration overseerr, with translation key processing_requests, anywhere in the home
- `movies`: field by field:
  - `queue`: sensor from the integration radarr, with translation key queue, anywhere in the home
  - `count`: sensor from the integration radarr, with translation key movies, anywhere in the home
  - `health`: binary_sensor from the integration radarr, with translation key health, anywhere in the home
  - `calendar`: calendar from the integration radarr, anywhere in the home
- `shows`: field by field:
  - `queue`: sensor from the integration sonarr, with translation key queue, anywhere in the home
  - `count`: sensor from the integration sonarr, with translation key series, anywhere in the home
  - `wanted`: sensor from the integration sonarr, with translation key wanted, anywhere in the home
  - `upcoming`: sensor from the integration sonarr, with translation key upcoming, anywhere in the home
  - `calendar`: calendar from the integration sonarr, anywhere in the home

Brings `media-popup`.

### `media-popup`

**Media server pop-up**, `mdi:filmstrip-box-multiple`: The media server's pop-up, what is being watched, its requests, downloads, upcoming releases, library and update.

| Slot                  | Kind     | Required or default               |
| --------------------- | -------- | --------------------------------- |
| `streams`             | entity   | required                          |
| `more_streams`        | entities |                                   |
| `update`              | entity   |                                   |
| `requests`            | object   |                                   |
| `requests.pending`    | entity   | required                          |
| `requests.processing` | entity   | required                          |
| `movies`              | object   |                                   |
| `movies.queue`        | entity   | required                          |
| `movies.count`        | entity   | required                          |
| `movies.health`       | entity   |                                   |
| `movies.space`        | entity   |                                   |
| `movies.calendar`     | entity   |                                   |
| `shows`               | object   |                                   |
| `shows.queue`         | entity   | required                          |
| `shows.count`         | entity   | required                          |
| `shows.wanted`        | entity   |                                   |
| `shows.upcoming`      | entity   |                                   |
| `shows.calendar`      | entity   |                                   |
| `none`                | texts    | `['0', 'unknown', 'unavailable']` |

## Network

From `templates/network.yaml`.

### `unifi-network`

**UniFi network**, `mdi:router-network`: A UniFi network's tile, its latency, and its devices and firmware chips; it brings the network's pop-up and one per Wi-Fi network.

| Slot                      | Kind     | Required or default                          |
| ------------------------- | -------- | -------------------------------------------- |
| `latency`                 | entities |                                              |
| `wan`                     | entity   |                                              |
| `devices`                 | entities |                                              |
| `wifi`                    | objects  |                                              |
| `wifi.key`                | text     | required                                     |
| `wifi.enabled`            | entity   | required                                     |
| `wifi.qr`                 | entity   |                                              |
| `wifi.switchable`         | flag     |                                              |
| `clients`                 | object   |                                              |
| `clients.entity`          | entity   | required                                     |
| `clients.names`           | entity   |                                              |
| `clients.networks`        | objects  | required                                     |
| `clients.networks.name`   | text     |                                              |
| `clients.networks.icon`   | icon     |                                              |
| `clients.networks.subnet` | text     | required                                     |
| `router`                  | object   |                                              |
| `router.cpu`              | entity   | required                                     |
| `router.temperature`      | entity   | required                                     |
| `firmware`                | entities |                                              |
| `device_up`               | texts    | `['connected', 'upgrading', 'provisioning']` |
| `square`                  | text     |                                              |

Found by:

- `latency`: sensor from the integration unifi, with translation key wan_latency, anywhere in the home
- `devices`: sensor from the integration unifi, with translation key device_state, anywhere in the home
- `router`: field by field:
  - `cpu`: sensor from the integration unifi, with translation key device_cpu_utilization, anywhere in the home
  - `temperature`: sensor from the integration unifi, with translation key device_sub_temperature, anywhere in the home
- `firmware`: update from the integration unifi, anywhere in the home

Brings `network-popup` and `wifi-popup` (one per `wifi`).

### `wifi-item`

**Wi-Fi network**, `mdi:wifi`: A Wi-Fi network as an item, its switch when it may be switched from the dashboard, opening its pop-up.

| Slot              | Kind   | Required or default |
| ----------------- | ------ | ------------------- |
| `wifi`            | object | required            |
| `wifi.key`        | text   | required            |
| `wifi.enabled`    | entity | required            |
| `wifi.qr`         | entity |                     |
| `wifi.switchable` | flag   |                     |

### `network-popup`

**Network pop-up**, `mdi:router-network`: The network's pop-up, its internet, devices, router, Wi-Fi networks, clients and firmware.

| Slot                      | Kind     | Required or default                          |
| ------------------------- | -------- | -------------------------------------------- |
| `latency`                 | entities |                                              |
| `wan`                     | entity   |                                              |
| `devices`                 | entities |                                              |
| `wifi`                    | objects  |                                              |
| `wifi.key`                | text     | required                                     |
| `wifi.enabled`            | entity   | required                                     |
| `wifi.qr`                 | entity   |                                              |
| `wifi.switchable`         | flag     |                                              |
| `clients`                 | object   |                                              |
| `clients.entity`          | entity   | required                                     |
| `clients.names`           | entity   |                                              |
| `clients.networks`        | objects  | required                                     |
| `clients.networks.name`   | text     |                                              |
| `clients.networks.icon`   | icon     |                                              |
| `clients.networks.subnet` | text     | required                                     |
| `router`                  | object   |                                              |
| `router.cpu`              | entity   | required                                     |
| `router.temperature`      | entity   | required                                     |
| `firmware`                | entities |                                              |
| `device_up`               | texts    | `['connected', 'upgrading', 'provisioning']` |

### `wifi-popup`

**Wi-Fi pop-up**, `mdi:wifi`: A Wi-Fi network's pop-up, its switch and the QR code to join it while it is on.

| Slot              | Kind   | Required or default |
| ----------------- | ------ | ------------------- |
| `wifi`            | object | required            |
| `wifi.key`        | text   | required            |
| `wifi.enabled`    | entity | required            |
| `wifi.qr`         | entity |                     |
| `wifi.switchable` | flag   |                     |

## People

From `templates/people.yaml`.

### `person`

**Person**, `mdi:account`: A person's tile, whether they are driving or in a focus, and their devices' batteries; it brings the person's and each device's pop-up.

| Slot                     | Kind    | Required or default |
| ------------------------ | ------- | ------------------- |
| `key`                    | text    | required            |
| `entity`                 | entity  | required            |
| `health`                 | object  |                     |
| `health.steps`           | entity  | required            |
| `health.distance`        | entity  | required            |
| `health.flights_climbed` | entity  | required            |
| `health.active_energy`   | entity  | required            |
| `health.resting_energy`  | entity  | required            |
| `devices`                | objects |                     |
| `devices.key`            | text    | required            |
| `devices.name`           | text    |                     |
| `devices.icon`           | icon    |                     |
| `devices.tracker`        | entity  | required            |
| `devices.battery`        | entity  | required            |
| `devices.battery_state`  | entity  | required            |
| `devices.connection`     | entity  | required            |
| `devices.network`        | entity  | required            |
| `devices.storage`        | entity  | required            |
| `devices.focus`          | entity  | required            |
| `devices.focus_name`     | entity  |                     |
| `devices.activity`       | entity  | required            |
| `devices.permission`     | entity  | required            |
| `low`                    | number  | `20`                |
| `critical`               | number  | `5`                 |
| `square`                 | text    |                     |

Found by:

- `key`: the area's id

Retired ([retired slots](templates.md#writing-a-template)): `activities`, `focuses` and `batteries`.

Brings `person-popup` and `device-popup` (one per `devices`).

### `person-status`

**Person status**, `mdi:account-outline`: A person's Driving and Do not disturb icons, and their devices' Batteries icon, each drawn only while it holds.

| Slot                    | Kind    | Required or default |
| ----------------------- | ------- | ------------------- |
| `devices`               | objects |                     |
| `devices.key`           | text    | required            |
| `devices.name`          | text    |                     |
| `devices.icon`          | icon    |                     |
| `devices.tracker`       | entity  |                     |
| `devices.battery`       | entity  |                     |
| `devices.battery_state` | entity  |                     |
| `devices.connection`    | entity  |                     |
| `devices.network`       | entity  |                     |
| `devices.storage`       | entity  |                     |
| `devices.focus`         | entity  |                     |
| `devices.focus_name`    | entity  |                     |
| `devices.activity`      | entity  |                     |
| `devices.permission`    | entity  |                     |
| `low`                   | number  | `20`                |
| `critical`              | number  | `5`                 |

### `device-card`

**Personal device**, `mdi:cellphone`: A person's device as an item, its place and battery, opening its pop-up.

| Slot                   | Kind   | Required or default |
| ---------------------- | ------ | ------------------- |
| `key`                  | text   | required            |
| `device`               | object | required            |
| `device.key`           | text   | required            |
| `device.name`          | text   |                     |
| `device.icon`          | icon   |                     |
| `device.tracker`       | entity | required            |
| `device.battery`       | entity |                     |
| `device.battery_state` | entity |                     |
| `device.connection`    | entity |                     |
| `device.network`       | entity |                     |
| `device.storage`       | entity |                     |
| `device.focus`         | entity |                     |
| `device.focus_name`    | entity |                     |
| `device.activity`      | entity |                     |
| `device.permission`    | entity |                     |

### `person-popup`

**Person pop-up**, `mdi:account`: A person's pop-up: the tile's driving, focus and battery icons in its header, their devices, their location access and their health.

| Slot                     | Kind    | Required or default |
| ------------------------ | ------- | ------------------- |
| `key`                    | text    | required            |
| `entity`                 | entity  | required            |
| `health`                 | object  |                     |
| `health.steps`           | entity  | required            |
| `health.distance`        | entity  | required            |
| `health.flights_climbed` | entity  | required            |
| `health.active_energy`   | entity  | required            |
| `health.resting_energy`  | entity  | required            |
| `devices`                | objects |                     |
| `devices.key`            | text    | required            |
| `devices.name`           | text    |                     |
| `devices.icon`           | icon    |                     |
| `devices.tracker`        | entity  | required            |
| `devices.battery`        | entity  |                     |
| `devices.battery_state`  | entity  |                     |
| `devices.connection`     | entity  |                     |
| `devices.network`        | entity  |                     |
| `devices.storage`        | entity  |                     |
| `devices.focus`          | entity  |                     |
| `devices.focus_name`     | entity  |                     |
| `devices.activity`       | entity  |                     |
| `devices.permission`     | entity  | required            |
| `low`                    | number  | `20`                |
| `critical`               | number  | `5`                 |

### `device-popup`

**Personal device pop-up**, `mdi:cellphone`: A person's device pop-up: its place and battery in its header, its battery and its details.

| Slot                   | Kind   | Required or default |
| ---------------------- | ------ | ------------------- |
| `key`                  | text   | required            |
| `entity`               | entity |                     |
| `device`               | object | required            |
| `device.key`           | text   | required            |
| `device.name`          | text   |                     |
| `device.icon`          | icon   |                     |
| `device.tracker`       | entity |                     |
| `device.battery`       | entity | required            |
| `device.battery_state` | entity | required            |
| `device.connection`    | entity | required            |
| `device.network`       | entity | required            |
| `device.storage`       | entity | required            |
| `device.focus`         | entity | required            |
| `device.focus_name`    | entity |                     |
| `device.activity`      | entity | required            |
| `device.permission`    | entity | required            |
| `low`                  | number | `20`                |
| `critical`             | number | `5`                 |

## Room

From `templates/room.yaml`.

### `room`

**Room**, `mdi:sofa`: A room's tile, its temperature and humidity, its window, door, lock and climate chips, its lights, and its chips for a leak and a low battery; it brings the room's pop-ups.

| Slot                                  | Kind     | Required or default |
| ------------------------------------- | -------- | ------------------- |
| `key`                                 | text     | required            |
| `name`                                | text     | required            |
| `icon`                                | icon     | `'mdi:texture-box'` |
| `temperature`                         | entity   |                     |
| `humidity`                            | entity   |                     |
| `window`                              | entity   |                     |
| `door`                                | entity   |                     |
| `lock`                                | entity   |                     |
| `lights`                              | object   |                     |
| `lights.group`                        | entity   | required            |
| `lights.color`                        | flag     |                     |
| `lights.members`                      | objects  |                     |
| `lights.members.entity`               | entity   | required            |
| `lights.members.members`              | entities |                     |
| `lights.scenes`                       | entities |                     |
| `lights.active_scene`                 | entity   |                     |
| `heating`                             | object   |                     |
| `heating.entity`                      | entity   | required            |
| `heating.preset`                      | flag     |                     |
| `heating.preset_temperatures`         | entities |                     |
| `heating.schedule`                    | entity   |                     |
| `heating.thermostats`                 | objects  |                     |
| `heating.thermostats.valve`           | entity   | required            |
| `heating.thermostats.battery`         | entity   |                     |
| `ac`                                  | object   |                     |
| `ac.entity`                           | entity   | required            |
| `ac.fan`                              | flag     |                     |
| `ac.swing`                            | flag     |                     |
| `ac.horizontal_swing`                 | flag     |                     |
| `ac.power_saving`                     | entity   |                     |
| `ac.dehumidifier`                     | entity   |                     |
| `ac.energy`                           | object   |                     |
| `ac.energy.power`                     | entity   | required            |
| `ac.energy.today`                     | entity   |                     |
| `ac.energy.total`                     | entity   |                     |
| `vacuum`                              | object   |                     |
| `vacuum.entity`                       | entity   | required            |
| `vacuum.status`                       | entity   |                     |
| `vacuum.error`                        | entity   |                     |
| `vacuum.battery`                      | entity   |                     |
| `vacuum.current_room`                 | entity   |                     |
| `vacuum.progress`                     | entity   |                     |
| `vacuum.area`                         | entity   |                     |
| `vacuum.time`                         | entity   |                     |
| `vacuum.last_clean`                   | entity   |                     |
| `vacuum.mop_attached`                 | entity   |                     |
| `vacuum.water_box_attached`           | entity   |                     |
| `vacuum.totals`                       | object   |                     |
| `vacuum.totals.count`                 | entity   |                     |
| `vacuum.totals.area`                  | entity   |                     |
| `vacuum.totals.time`                  | entity   |                     |
| `vacuum.map`                          | entity   |                     |
| `vacuum.routines`                     | entities |                     |
| `vacuum.settings`                     | entities |                     |
| `vacuum.consumables`                  | objects  |                     |
| `vacuum.consumables.entity`           | entity   | required            |
| `vacuum.consumables.reset`            | entity   |                     |
| `vacuum.warnings`                     | entities |                     |
| `vacuum.dock`                         | object   |                     |
| `vacuum.dock.error`                   | entity   |                     |
| `vacuum.dock.dust_emptying`           | entity   |                     |
| `vacuum.dock.mop_drying`              | entity   |                     |
| `vacuum.dock.mop_drying_time_left`    | entity   |                     |
| `vacuum.dock.mop_washing`             | entity   |                     |
| `vacuum.dock.consumables`             | objects  |                     |
| `vacuum.dock.consumables.entity`      | entity   | required            |
| `vacuum.dock.consumables.reset`       | entity   |                     |
| `vacuum.dock.warnings`                | entities |                     |
| `printer3d`                           | object   |                     |
| `printer3d.entity`                    | entity   | required            |
| `printer3d.progress`                  | entity   | required            |
| `printer3d.filename`                  | entity   | required            |
| `printer3d.material`                  | entity   | required            |
| `printer3d.speed`                     | entity   | required            |
| `printer3d.start`                     | entity   | required            |
| `printer3d.finish`                    | entity   | required            |
| `printer3d.nozzle`                    | object   | required            |
| `printer3d.nozzle.temperature`        | entity   | required            |
| `printer3d.nozzle.target`             | entity   |                     |
| `printer3d.bed`                       | object   | required            |
| `printer3d.bed.temperature`           | entity   | required            |
| `printer3d.bed.target`                | entity   |                     |
| `printer3d.camera`                    | entity   |                     |
| `printer3d.actions`                   | object   | required            |
| `printer3d.actions.pause`             | entity   |                     |
| `printer3d.actions.resume`            | entity   |                     |
| `printer3d.actions.continue`          | entity   |                     |
| `printer3d.actions.cancel`            | entity   |                     |
| `printer3d.outlet`                    | object   |                     |
| `printer3d.outlet.entity`             | entity   | required            |
| `printer3d.outlet.energy`             | object   |                     |
| `printer3d.outlet.energy.power`       | entity   | required            |
| `printer3d.outlet.energy.today`       | entity   |                     |
| `printer3d.outlet.energy.total`       | entity   |                     |
| `cameras`                             | objects  |                     |
| `cameras.entity`                      | entity   | required            |
| `cameras.motion`                      | entity   |                     |
| `cameras.person`                      | entity   |                     |
| `cameras.doorbell`                    | entity   |                     |
| `covers`                              | objects  |                     |
| `covers.entity`                       | entity   | required            |
| `covers.garage`                       | flag     |                     |
| `fans`                                | objects  |                     |
| `fans.entity`                         | entity   | required            |
| `fans.quality`                        | entity   |                     |
| `humidifiers`                         | objects  |                     |
| `humidifiers.entity`                  | entity   | required            |
| `appliances`                          | objects  |                     |
| `appliances.entity`                   | entity   | required            |
| `appliances.remaining`                | entity   |                     |
| `appliances.power`                    | entity   |                     |
| `pets`                                | objects  |                     |
| `pets.feed`                           | entity   | required            |
| `pets.fed`                            | entity   | required            |
| `pets.food`                           | entity   |                     |
| `pets.litter`                         | entity   |                     |
| `plants`                              | objects  |                     |
| `plants.moisture`                     | entity   | required            |
| `media`                               | objects  |                     |
| `media.entity`                        | entity   | required            |
| `media.key`                           | text     |                     |
| `speakers`                            | objects  |                     |
| `speakers.key`                        | text     | required            |
| `speakers.entity`                     | entity   | required            |
| `speakers.bass`                       | entity   |                     |
| `speakers.treble`                     | entity   |                     |
| `speakers.balance`                    | entity   |                     |
| `speakers.loudness`                   | entity   |                     |
| `speakers.tv`                         | object   |                     |
| `speakers.tv.input_format`            | entity   |                     |
| `speakers.tv.night_sound`             | entity   | required            |
| `speakers.tv.speech_enhancement`      | entity   | required            |
| `speakers.tv.audio_delay`             | entity   | required            |
| `speakers.subwoofer`                  | object   |                     |
| `speakers.subwoofer.enabled`          | entity   | required            |
| `speakers.subwoofer.gain`             | entity   | required            |
| `speakers.surround`                   | object   |                     |
| `speakers.surround.enabled`           | entity   | required            |
| `speakers.surround.level`             | entity   | required            |
| `speakers.surround.music_level`       | entity   | required            |
| `speakers.surround.music_full_volume` | entity   | required            |
| `outlets`                             | objects  |                     |
| `outlets.entity`                      | entity   | required            |
| `outlets.energy`                      | object   |                     |
| `outlets.energy.power`                | entity   |                     |
| `outlets.energy.today`                | entity   |                     |
| `outlets.energy.total`                | entity   |                     |
| `diffuser`                            | object   |                     |
| `diffuser.entity`                     | entity   | required            |
| `diffuser.amount`                     | entity   | required            |
| `timers`                              | entities |                     |
| `schedules`                           | entities |                     |
| `batteries`                           | entities |                     |
| `leaks`                               | entities |                     |
| `low`                                 | number   | `20`                |
| `critical`                            | number   | `5`                 |
| `square`                              | text     |                     |

Found by:

- `key`: the area's id
- `name`: the area's name
- `icon`: the area's icon
- `temperature`: the area temperature sensor, then sensor with device class temperature
- `humidity`: the area humidity sensor, then sensor with device class humidity
- `window`: binary_sensor with device class window
- `door`: binary_sensor with device class door
- `lock`: lock
- `lights`: field by field:
  - `group`: light from the integration group, then light
  - `members`: one per device with light:
    - `entity`: light
  - `scenes`: scene
- `heating`: device with climate but not with attribute hvac_modes cool:
  - `entity`: climate but not with attribute hvac_modes cool
  - `preset_temperatures`: number from the integration better_thermostat
  - `schedule`: schedule named like "heating", in the area
  - `thermostats`, tried in turn:
    - one per device with sensor with translation key valve_position, in the area:
      - `valve`: sensor with translation key valve_position
      - `battery`: sensor with device class battery
    - one per device with sensor named like "valve position", in the area:
      - `valve`: sensor named like "valve position"
      - `battery`: sensor with device class battery
- `ac`: device with climate with attribute hvac_modes cool:
  - `entity`: climate with attribute hvac_modes cool
  - `power_saving`: select with translation key power_saving_mode, then select named like "power saving"
  - `dehumidifier`: number with translation key dehumidifier_level, then number named like "dehumidifier"
  - `energy`: field by field:
    - `power`: sensor with device class power
    - `today`: sensor with device class energy, from the integration utility_meter
    - `total`: sensor with device class energy, but not from the integration utility_meter
- `vacuum`: the rule of the shape `vacuum`, under [Shapes](#shapes)
- `printer3d`: the rule of the shape `printer3d`, under [Shapes](#shapes)
- `cameras`: one per device with camera:
  - `entity`: camera
- `covers`: one per device with cover:
  - `entity`: cover
- `fans`: one per device with fan:
  - `entity`: fan
- `humidifiers`: one per device with humidifier:
  - `entity`: humidifier
- `appliances`: device with sensor from the integration smartthings, with translation key washer_machine_state or sensor from the integration smartthings, with translation key dryer_machine_state or sensor from the integration smartthings, with translation key dishwasher_machine_state or sensor from the integration home_connect, with translation key operation_state, named like "washer" or sensor from the integration home_connect, with translation key operation_state, named like "dryer":
  - `entity`: sensor with translation key washer_machine_state, then sensor with translation key dryer_machine_state, then sensor with translation key dishwasher_machine_state, then sensor with translation key operation_state
  - `remaining`: sensor with translation key completion_time, then sensor with translation key program_finish_time
  - `power`: sensor with device class power
- `media`: one per device with media_player:
  - `entity`: media_player
  - `key`: media_player with device class speaker, then media_player from the integration sonos
- `speakers`: device with media_player with device class speaker or media_player from the integration sonos:
  - `key`: media_player with device class speaker, then media_player from the integration sonos
  - `entity`: media_player with device class speaker, then media_player from the integration sonos
  - `bass`: number with translation key bass, then number named like "bass"
  - `treble`: number with translation key treble, then number named like "treble"
  - `balance`: number with translation key balance, then number named like "balance"
  - `loudness`: switch with translation key loudness, then switch named like "loudness"
  - `tv`: field by field:
    - `input_format`: sensor with translation key audio_input_format, then sensor named like "audio input format"
    - `night_sound`: switch with translation key night_mode, then switch named like "night sound"
    - `speech_enhancement`: switch with translation key dialog_level, then switch named like "speech enhancement"
    - `audio_delay`: number with translation key audio_delay, then number named like "audio delay"
  - `subwoofer`: field by field:
    - `enabled`: switch with translation key sub_enabled, then switch named like "subwoofer enabled"
    - `gain`: number with translation key sub_gain, then number named like "sub gain"
  - `surround`: field by field:
    - `enabled`: switch with translation key surround_enabled, then switch named like "surround enabled"
    - `level`: number with translation key surround_level, then number named like "surround level", but not named like "music"
    - `music_level`: number with translation key music_surround_level, then number named like "music surround level"
    - `music_full_volume`: switch with translation key surround_mode, then switch named like "surround music full volume"
- `outlets`: one per device with switch with device class outlet:
  - `entity`: switch with device class outlet
  - `energy`: field by field:
    - `power`: sensor with device class power
    - `today`: sensor with device class energy, from the integration utility_meter
    - `total`: sensor with device class energy, but not from the integration utility_meter
- `timers`: timer
- `schedules`: schedule but not named like "heating"
- `batteries`: sensor with device class battery
- `leaks`: binary_sensor with device class moisture

Retired ([retired slots](templates.md#writing-a-template)): `meters` and `heating.batteries`.

Brings `room-popup`, `lights-popup` (with `lights.group`) and `speaker-popup` (one per `speakers`).

Through the cards of `room-popup`, it brings `ac-popup` (with `ac`), `heating-popup` (with `heating`), `vacuum-popup` (with `vacuum`) and `3d-printer-popup` (with `printer3d`).

### `room-media-card`

**Room media player**, `mdi:speaker`: A room's media player, opening its speaker pop-up when it is a speaker.

| Slot            | Kind   | Required or default |
| --------------- | ------ | ------------------- |
| `key`           | text   | required            |
| `member`        | object | required            |
| `member.entity` | entity | required            |
| `member.key`    | text   |                     |

### `room-popup`

**Room pop-up**, `mdi:sofa`: A room's pop-up, a leak while there is one and since when, its lights, climate, media and other devices, its schedules, its batteries and its energy.

| Slot                               | Kind     | Required or default |
| ---------------------------------- | -------- | ------------------- |
| `key`                              | text     | required            |
| `name`                             | text     | required            |
| `icon`                             | icon     | `'mdi:texture-box'` |
| `temperature`                      | entity   |                     |
| `humidity`                         | entity   |                     |
| `window`                           | entity   |                     |
| `door`                             | entity   |                     |
| `lock`                             | entity   |                     |
| `lights`                           | object   |                     |
| `lights.group`                     | entity   | required            |
| `lights.color`                     | flag     |                     |
| `lights.members`                   | objects  |                     |
| `lights.members.entity`            | entity   |                     |
| `lights.members.members`           | entities |                     |
| `lights.scenes`                    | entities |                     |
| `lights.active_scene`              | entity   |                     |
| `heating`                          | object   |                     |
| `heating.entity`                   | entity   | required            |
| `heating.preset`                   | flag     |                     |
| `heating.preset_temperatures`      | entities |                     |
| `heating.schedule`                 | entity   |                     |
| `heating.thermostats`              | objects  |                     |
| `heating.thermostats.valve`        | entity   | required            |
| `heating.thermostats.battery`      | entity   |                     |
| `ac`                               | object   |                     |
| `ac.entity`                        | entity   | required            |
| `ac.fan`                           | flag     |                     |
| `ac.swing`                         | flag     |                     |
| `ac.horizontal_swing`              | flag     |                     |
| `ac.power_saving`                  | entity   |                     |
| `ac.dehumidifier`                  | entity   |                     |
| `ac.energy`                        | object   |                     |
| `ac.energy.power`                  | entity   | required            |
| `ac.energy.today`                  | entity   |                     |
| `ac.energy.total`                  | entity   |                     |
| `vacuum`                           | object   |                     |
| `vacuum.entity`                    | entity   | required            |
| `vacuum.status`                    | entity   |                     |
| `vacuum.error`                     | entity   |                     |
| `vacuum.battery`                   | entity   |                     |
| `vacuum.current_room`              | entity   |                     |
| `vacuum.progress`                  | entity   |                     |
| `vacuum.area`                      | entity   |                     |
| `vacuum.time`                      | entity   |                     |
| `vacuum.last_clean`                | entity   |                     |
| `vacuum.mop_attached`              | entity   |                     |
| `vacuum.water_box_attached`        | entity   |                     |
| `vacuum.totals`                    | object   |                     |
| `vacuum.totals.count`              | entity   |                     |
| `vacuum.totals.area`               | entity   |                     |
| `vacuum.totals.time`               | entity   |                     |
| `vacuum.map`                       | entity   |                     |
| `vacuum.routines`                  | entities |                     |
| `vacuum.settings`                  | entities |                     |
| `vacuum.consumables`               | objects  |                     |
| `vacuum.consumables.entity`        | entity   | required            |
| `vacuum.consumables.reset`         | entity   |                     |
| `vacuum.warnings`                  | entities |                     |
| `vacuum.dock`                      | object   |                     |
| `vacuum.dock.error`                | entity   |                     |
| `vacuum.dock.dust_emptying`        | entity   |                     |
| `vacuum.dock.mop_drying`           | entity   |                     |
| `vacuum.dock.mop_drying_time_left` | entity   |                     |
| `vacuum.dock.mop_washing`          | entity   |                     |
| `vacuum.dock.consumables`          | objects  |                     |
| `vacuum.dock.consumables.entity`   | entity   | required            |
| `vacuum.dock.consumables.reset`    | entity   |                     |
| `vacuum.dock.warnings`             | entities |                     |
| `printer3d`                        | object   |                     |
| `printer3d.entity`                 | entity   | required            |
| `printer3d.progress`               | entity   | required            |
| `printer3d.filename`               | entity   | required            |
| `printer3d.material`               | entity   | required            |
| `printer3d.speed`                  | entity   | required            |
| `printer3d.start`                  | entity   | required            |
| `printer3d.finish`                 | entity   | required            |
| `printer3d.nozzle`                 | object   | required            |
| `printer3d.nozzle.temperature`     | entity   | required            |
| `printer3d.nozzle.target`          | entity   |                     |
| `printer3d.bed`                    | object   | required            |
| `printer3d.bed.temperature`        | entity   | required            |
| `printer3d.bed.target`             | entity   |                     |
| `printer3d.camera`                 | entity   |                     |
| `printer3d.actions`                | object   | required            |
| `printer3d.actions.pause`          | entity   |                     |
| `printer3d.actions.resume`         | entity   |                     |
| `printer3d.actions.continue`       | entity   |                     |
| `printer3d.actions.cancel`         | entity   |                     |
| `printer3d.outlet`                 | object   |                     |
| `printer3d.outlet.entity`          | entity   | required            |
| `printer3d.outlet.energy`          | object   |                     |
| `printer3d.outlet.energy.power`    | entity   | required            |
| `printer3d.outlet.energy.today`    | entity   |                     |
| `printer3d.outlet.energy.total`    | entity   |                     |
| `cameras`                          | objects  |                     |
| `cameras.entity`                   | entity   | required            |
| `cameras.motion`                   | entity   |                     |
| `cameras.person`                   | entity   |                     |
| `cameras.doorbell`                 | entity   |                     |
| `covers`                           | objects  |                     |
| `covers.entity`                    | entity   | required            |
| `covers.garage`                    | flag     |                     |
| `fans`                             | objects  |                     |
| `fans.entity`                      | entity   | required            |
| `fans.quality`                     | entity   |                     |
| `humidifiers`                      | objects  |                     |
| `humidifiers.entity`               | entity   | required            |
| `appliances`                       | objects  |                     |
| `appliances.entity`                | entity   | required            |
| `appliances.remaining`             | entity   |                     |
| `appliances.power`                 | entity   |                     |
| `pets`                             | objects  |                     |
| `pets.feed`                        | entity   | required            |
| `pets.fed`                         | entity   | required            |
| `pets.food`                        | entity   |                     |
| `pets.litter`                      | entity   |                     |
| `plants`                           | objects  |                     |
| `plants.moisture`                  | entity   | required            |
| `media`                            | objects  |                     |
| `media.entity`                     | entity   | required            |
| `media.key`                        | text     |                     |
| `outlets`                          | objects  |                     |
| `outlets.entity`                   | entity   | required            |
| `outlets.energy`                   | object   |                     |
| `outlets.energy.power`             | entity   |                     |
| `outlets.energy.today`             | entity   |                     |
| `outlets.energy.total`             | entity   |                     |
| `diffuser`                         | object   |                     |
| `diffuser.entity`                  | entity   | required            |
| `diffuser.amount`                  | entity   | required            |
| `timers`                           | entities |                     |
| `schedules`                        | entities |                     |
| `batteries`                        | entities |                     |
| `leaks`                            | entities |                     |
| `low`                              | number   | `20`                |
| `critical`                         | number   | `5`                 |

Found by:

- `vacuum`: the rule of the shape `vacuum`, under [Shapes](#shapes)
- `printer3d`: the rule of the shape `printer3d`, under [Shapes](#shapes)

Retired ([retired slots](templates.md#writing-a-template)): `meters` and `heating.batteries`.

Through its cards, it brings `ac-popup` (with `ac`), `heating-popup` (with `heating`), `vacuum-popup` (with `vacuum`) and `3d-printer-popup` (with `printer3d`).

## Proxmox VE server

From `templates/server.yaml`.

### `proxmox-server`

**Proxmox VE server**, `mdi:server`: A Proxmox VE server's tile, its CPU and memory, and its guests, checks, backups and notifications chips; it brings the server's and the notifications' pop-ups. The checks, backups and notifications read sensors that the server's own jobs keep.

| Slot                           | Kind     | Required or default |
| ------------------------------ | -------- | ------------------- |
| `outlet`                       | object   |                     |
| `outlet.entity`                | entity   | required            |
| `outlet.energy`                | object   |                     |
| `outlet.energy.power`          | entity   | required            |
| `outlet.energy.today`          | entity   |                     |
| `outlet.energy.total`          | entity   |                     |
| `cpu`                          | entity   |                     |
| `memory`                       | entity   |                     |
| `last_boot`                    | entity   |                     |
| `uplink`                       | entity   |                     |
| `temperatures`                 | object   |                     |
| `temperatures.cpu`             | entity   | required            |
| `temperatures.root_disk`       | entity   | required            |
| `storage`                      | entities |                     |
| `disks`                        | object   |                     |
| `disks.pool`                   | entity   | required            |
| `disks.failing`                | entity   | required            |
| `disks.life_left`              | entity   | required            |
| `guests`                       | objects  |                     |
| `guests.host`                  | text     |                     |
| `guests.status`                | entity   | required            |
| `guests.cpu`                   | entity   |                     |
| `guests.memory`                | entity   |                     |
| `guests.disk`                  | object   |                     |
| `guests.disk.used`             | entity   |                     |
| `guests.disk.size`             | entity   |                     |
| `backups`                      | object   |                     |
| `backups.last`                 | entity   | required            |
| `backups.problem`              | entity   | required            |
| `backups.bucket`               | entity   |                     |
| `checks`                       | object   |                     |
| `checks.failed`                | entity   | required            |
| `checks.warnings`              | entity   |                     |
| `checks.last_run`              | entity   | required            |
| `checks.overdue`               | entity   | required            |
| `checks.actions`               | object   |                     |
| `checks.actions.run`           | entity   | required            |
| `checks.actions.stop`          | entity   | required            |
| `checks.actions.running`       | entity   | required            |
| `notifications`                | object   |                     |
| `notifications.messages`       | entity   | required            |
| `notifications.clear`          | entity   | required            |
| `notifications.sources`        | objects  |                     |
| `notifications.sources.source` | text     |                     |
| `notifications.sources.name`   | text     |                     |
| `message_sources`              | objects  |                     |
| `message_sources.source`       | text     |                     |
| `message_sources.name`         | text     |                     |
| `message_sources.entity`       | entity   |                     |
| `disk_high`                    | number   | `80`                |
| `disk_full`                    | number   | `90`                |
| `disk_life_low`                | number   | `20`                |
| `disk_life_critical`           | number   | `10`                |
| `cpu_hot`                      | number   | `85`                |
| `cpu_critical`                 | number   | `95`                |
| `root_disk_hot`                | number   | `70`                |
| `root_disk_critical`           | number   | `80`                |
| `bucket_high`                  | number   | `18`                |
| `bucket_full`                  | number   | `19`                |
| `square`                       | text     |                     |

Found by:

- `cpu`: sensor from the integration proxmoxve, with translation key node_cpu, anywhere in the home
- `memory`: sensor from the integration proxmoxve, with translation key node_memory_percentage, anywhere in the home
- `last_boot`: sensor from the integration proxmoxve, with translation key node_uptime, anywhere in the home
- `guests`: one per device with binary_sensor from the integration proxmoxve, with translation key status, anywhere in the home:
  - `status`: binary_sensor from the integration proxmoxve, with translation key status
  - `cpu`: sensor from the integration proxmoxve, with translation key vm_cpu, then sensor from the integration proxmoxve, with translation key container_cpu
  - `memory`: sensor from the integration proxmoxve, with translation key vm_memory_percentage, then sensor from the integration proxmoxve, with translation key container_memory_percentage
- `backups`: field by field:
  - `last`: sensor from the integration proxmoxve, with translation key node_backup_last_backup, anywhere in the home
  - `problem`: binary_sensor from the integration proxmoxve, with translation key node_backup_status, anywhere in the home

Retired ([retired slots](templates.md#writing-a-template)): `guest_statuses`.

Brings `proxmox-popup` and `notifications-popup` (with `notifications`).

### `proxmox-popup`

**Proxmox VE pop-up**, `mdi:server`: The server's pop-up, its notifications, stopped guests, checks, host, disks, storage, energy, guests and backups.

| Slot                           | Kind     | Required or default |
| ------------------------------ | -------- | ------------------- |
| `outlet`                       | object   |                     |
| `outlet.entity`                | entity   | required            |
| `outlet.energy`                | object   |                     |
| `outlet.energy.power`          | entity   | required            |
| `outlet.energy.today`          | entity   |                     |
| `outlet.energy.total`          | entity   |                     |
| `cpu`                          | entity   |                     |
| `memory`                       | entity   |                     |
| `last_boot`                    | entity   |                     |
| `uplink`                       | entity   |                     |
| `temperatures`                 | object   |                     |
| `temperatures.cpu`             | entity   | required            |
| `temperatures.root_disk`       | entity   | required            |
| `storage`                      | entities |                     |
| `disks`                        | object   |                     |
| `disks.pool`                   | entity   | required            |
| `disks.failing`                | entity   | required            |
| `disks.life_left`              | entity   | required            |
| `guests`                       | objects  |                     |
| `guests.host`                  | text     |                     |
| `guests.status`                | entity   | required            |
| `guests.cpu`                   | entity   |                     |
| `guests.memory`                | entity   |                     |
| `guests.disk`                  | object   |                     |
| `guests.disk.used`             | entity   |                     |
| `guests.disk.size`             | entity   |                     |
| `backups`                      | object   |                     |
| `backups.last`                 | entity   | required            |
| `backups.problem`              | entity   | required            |
| `backups.bucket`               | entity   |                     |
| `checks`                       | object   |                     |
| `checks.failed`                | entity   | required            |
| `checks.warnings`              | entity   |                     |
| `checks.last_run`              | entity   | required            |
| `checks.overdue`               | entity   | required            |
| `checks.actions`               | object   |                     |
| `checks.actions.run`           | entity   | required            |
| `checks.actions.stop`          | entity   | required            |
| `checks.actions.running`       | entity   | required            |
| `notifications`                | object   |                     |
| `notifications.messages`       | entity   | required            |
| `notifications.clear`          | entity   |                     |
| `notifications.sources`        | objects  |                     |
| `notifications.sources.source` | text     |                     |
| `notifications.sources.name`   | text     |                     |
| `message_sources`              | objects  |                     |
| `message_sources.source`       | text     |                     |
| `message_sources.name`         | text     |                     |
| `message_sources.entity`       | entity   |                     |
| `disk_high`                    | number   | `80`                |
| `disk_full`                    | number   | `90`                |
| `disk_life_low`                | number   | `20`                |
| `disk_life_critical`           | number   | `10`                |
| `cpu_hot`                      | number   | `85`                |
| `cpu_critical`                 | number   | `95`                |
| `root_disk_hot`                | number   | `70`                |
| `root_disk_critical`           | number   | `80`                |
| `bucket_high`                  | number   | `18`                |
| `bucket_full`                  | number   | `19`                |

Retired ([retired slots](templates.md#writing-a-template)): `guest_statuses`.

### `notifications-popup`

**Notifications pop-up**, `mdi:bell-outline`: The server's notifications pop-up: how many are kept in its header, every message and a button that clears them all, which asks first.

| Slot                           | Kind    | Required or default |
| ------------------------------ | ------- | ------------------- |
| `notifications`                | object  | required            |
| `notifications.messages`       | entity  | required            |
| `notifications.clear`          | entity  | required            |
| `notifications.sources`        | objects |                     |
| `notifications.sources.source` | text    |                     |
| `notifications.sources.name`   | text    |                     |
| `message_sources`              | objects |                     |
| `message_sources.source`       | text    |                     |
| `message_sources.name`         | text    |                     |
| `message_sources.entity`       | entity  |                     |

## Speaker

From `templates/speaker.yaml`.

### `speaker-popup`

**Speaker pop-up**, `mdi:speaker`: A speaker's pop-up: what it plays in its header, its sound, and its TV, subwoofer and surround settings when it has them.

| Slot                                 | Kind   | Required or default |
| ------------------------------------ | ------ | ------------------- |
| `key`                                | text   | required            |
| `name`                               | text   | required            |
| `speaker`                            | object | required            |
| `speaker.key`                        | text   | required            |
| `speaker.entity`                     | entity | required            |
| `speaker.bass`                       | entity |                     |
| `speaker.treble`                     | entity |                     |
| `speaker.balance`                    | entity |                     |
| `speaker.loudness`                   | entity |                     |
| `speaker.tv`                         | object |                     |
| `speaker.tv.input_format`            | entity |                     |
| `speaker.tv.night_sound`             | entity | required            |
| `speaker.tv.speech_enhancement`      | entity | required            |
| `speaker.tv.audio_delay`             | entity | required            |
| `speaker.subwoofer`                  | object |                     |
| `speaker.subwoofer.enabled`          | entity | required            |
| `speaker.subwoofer.gain`             | entity | required            |
| `speaker.surround`                   | object |                     |
| `speaker.surround.enabled`           | entity | required            |
| `speaker.surround.level`             | entity | required            |
| `speaker.surround.music_level`       | entity | required            |
| `speaker.surround.music_full_volume` | entity | required            |

## Tailscale

From `templates/tailscale.yaml`.

### `tailscale`

**Tailscale**, `mdi:vpn`: A tailnet's tile, and its offline, relayed and update chips; it brings the tailnet's pop-up.

| Slot                 | Kind    | Required or default |
| -------------------- | ------- | ------------------- |
| `devices`            | objects | required            |
| `devices.connected`  | entity  | required            |
| `devices.essential`  | flag    |                     |
| `devices.ip_address` | entity  |                     |
| `devices.last_seen`  | entity  |                     |
| `devices.expires`    | entity  |                     |
| `devices.update`     | entity  |                     |
| `devices.udp`        | entity  |                     |
| `soon_days`          | number  | `14`                |
| `square`             | text    |                     |

Found by:

- `devices`: one per device with binary_sensor from the integration tailscale, with translation key connected_to_control, anywhere in the home:
  - `connected`: binary_sensor from the integration tailscale, with translation key connected_to_control
  - `ip_address`: sensor from the integration tailscale, with translation key ip
  - `last_seen`: sensor from the integration tailscale, with translation key last_seen
  - `expires`: sensor from the integration tailscale, with translation key expires
  - `update`: binary_sensor from the integration tailscale, with translation key client
  - `udp`: binary_sensor from the integration tailscale, with translation key client_supports_udp

Retired ([retired slots](templates.md#writing-a-template)): `essential`, `personal`, `updates` and `direct`.

Brings `tailscale-popup`.

### `tailscale-popup`

**Tailscale pop-up**, `mdi:vpn`: The tailnet's pop-up, a card per device, the essential ones under Infrastructure and the others under Devices.

| Slot                 | Kind    | Required or default |
| -------------------- | ------- | ------------------- |
| `devices`            | objects | required            |
| `devices.connected`  | entity  | required            |
| `devices.essential`  | flag    |                     |
| `devices.ip_address` | entity  |                     |
| `devices.last_seen`  | entity  |                     |
| `devices.expires`    | entity  |                     |
| `devices.update`     | entity  |                     |
| `devices.udp`        | entity  |                     |
| `soon_days`          | number  | `14`                |

Retired ([retired slots](templates.md#writing-a-template)): `essential` and `personal`.

### `tailscale-device`

**Tailscale device**, `mdi:devices`: A tailnet device's card, its name, Connected or when it was last seen, and icons for a pending update, a key about to expire and how it connects.

| Slot                | Kind   | Required or default |
| ------------------- | ------ | ------------------- |
| `device`            | object | required            |
| `device.connected`  | entity | required            |
| `device.essential`  | flag   |                     |
| `device.ip_address` | entity |                     |
| `device.last_seen`  | entity |                     |
| `device.expires`    | entity |                     |
| `device.update`     | entity |                     |
| `device.udp`        | entity |                     |
| `alert`             | text   |                     |
| `soon_days`         | number | `14`                |

## Vacuum

From `templates/vacuum.yaml`.

### `vacuum-actions`

**Vacuum actions**, `mdi:robot-vacuum`: A vacuum's Dock, Locate, Start and Stop buttons, each shown when it applies.

| Slot     | Kind   | Required or default |
| -------- | ------ | ------------------- |
| `entity` | entity |                     |

### `vacuum-state`

**Vacuum state**, `mdi:robot-vacuum`: A vacuum's state line: its error while it has one, its status, the room while it cleans, its battery, the dock's error while it has one, and the mop drying time while it dries.

| Slot                               | Kind     | Required or default |
| ---------------------------------- | -------- | ------------------- |
| `vacuum`                           | object   | required            |
| `vacuum.entity`                    | entity   | required            |
| `vacuum.status`                    | entity   |                     |
| `vacuum.error`                     | entity   |                     |
| `vacuum.battery`                   | entity   |                     |
| `vacuum.current_room`              | entity   |                     |
| `vacuum.progress`                  | entity   |                     |
| `vacuum.area`                      | entity   |                     |
| `vacuum.time`                      | entity   |                     |
| `vacuum.last_clean`                | entity   |                     |
| `vacuum.mop_attached`              | entity   |                     |
| `vacuum.water_box_attached`        | entity   |                     |
| `vacuum.totals`                    | object   |                     |
| `vacuum.totals.count`              | entity   |                     |
| `vacuum.totals.area`               | entity   |                     |
| `vacuum.totals.time`               | entity   |                     |
| `vacuum.map`                       | entity   |                     |
| `vacuum.routines`                  | entities |                     |
| `vacuum.settings`                  | entities |                     |
| `vacuum.consumables`               | objects  |                     |
| `vacuum.consumables.entity`        | entity   |                     |
| `vacuum.consumables.reset`         | entity   |                     |
| `vacuum.warnings`                  | entities |                     |
| `vacuum.dock`                      | object   |                     |
| `vacuum.dock.error`                | entity   |                     |
| `vacuum.dock.dust_emptying`        | entity   |                     |
| `vacuum.dock.mop_drying`           | entity   |                     |
| `vacuum.dock.mop_drying_time_left` | entity   |                     |
| `vacuum.dock.mop_washing`          | entity   |                     |
| `vacuum.dock.consumables`          | objects  |                     |
| `vacuum.dock.consumables.entity`   | entity   |                     |
| `vacuum.dock.consumables.reset`    | entity   |                     |
| `vacuum.dock.warnings`             | entities |                     |

Found by:

- `vacuum`: the rule of the shape `vacuum`, under [Shapes](#shapes)

### `vacuum-card`

**Vacuum**, `mdi:robot-vacuum`: A vacuum as an item, its error, status, room, battery and dock, opening its pop-up; it brings the pop-up.

| Slot                               | Kind     | Required or default |
| ---------------------------------- | -------- | ------------------- |
| `key`                              | text     | required            |
| `name`                             | text     | required            |
| `vacuum`                           | object   | required            |
| `vacuum.entity`                    | entity   | required            |
| `vacuum.status`                    | entity   |                     |
| `vacuum.error`                     | entity   |                     |
| `vacuum.battery`                   | entity   |                     |
| `vacuum.current_room`              | entity   |                     |
| `vacuum.progress`                  | entity   |                     |
| `vacuum.area`                      | entity   |                     |
| `vacuum.time`                      | entity   |                     |
| `vacuum.last_clean`                | entity   |                     |
| `vacuum.mop_attached`              | entity   |                     |
| `vacuum.water_box_attached`        | entity   |                     |
| `vacuum.totals`                    | object   |                     |
| `vacuum.totals.count`              | entity   |                     |
| `vacuum.totals.area`               | entity   |                     |
| `vacuum.totals.time`               | entity   |                     |
| `vacuum.map`                       | entity   |                     |
| `vacuum.routines`                  | entities |                     |
| `vacuum.settings`                  | entities |                     |
| `vacuum.consumables`               | objects  |                     |
| `vacuum.consumables.entity`        | entity   | required            |
| `vacuum.consumables.reset`         | entity   |                     |
| `vacuum.warnings`                  | entities |                     |
| `vacuum.dock`                      | object   |                     |
| `vacuum.dock.error`                | entity   |                     |
| `vacuum.dock.dust_emptying`        | entity   |                     |
| `vacuum.dock.mop_drying`           | entity   |                     |
| `vacuum.dock.mop_drying_time_left` | entity   |                     |
| `vacuum.dock.mop_washing`          | entity   |                     |
| `vacuum.dock.consumables`          | objects  |                     |
| `vacuum.dock.consumables.entity`   | entity   | required            |
| `vacuum.dock.consumables.reset`    | entity   |                     |
| `vacuum.dock.warnings`             | entities |                     |

Found by:

- `key`: the area's id
- `name`: the area's name
- `vacuum`: the rule of the shape `vacuum`, under [Shapes](#shapes)

Brings `vacuum-popup`.

### `vacuum-popup`

**Vacuum pop-up**, `mdi:robot-vacuum`: A vacuum's pop-up, which its card brings: its state line and controls in its header, its routines, map, details, settings, dock, maintenance and totals.

| Slot                               | Kind     | Required or default |
| ---------------------------------- | -------- | ------------------- |
| `key`                              | text     | required            |
| `name`                             | text     | required            |
| `vacuum`                           | object   | required            |
| `vacuum.entity`                    | entity   | required            |
| `vacuum.status`                    | entity   |                     |
| `vacuum.error`                     | entity   |                     |
| `vacuum.battery`                   | entity   |                     |
| `vacuum.current_room`              | entity   |                     |
| `vacuum.progress`                  | entity   |                     |
| `vacuum.area`                      | entity   |                     |
| `vacuum.time`                      | entity   |                     |
| `vacuum.last_clean`                | entity   |                     |
| `vacuum.mop_attached`              | entity   |                     |
| `vacuum.water_box_attached`        | entity   |                     |
| `vacuum.totals`                    | object   |                     |
| `vacuum.totals.count`              | entity   |                     |
| `vacuum.totals.area`               | entity   |                     |
| `vacuum.totals.time`               | entity   |                     |
| `vacuum.map`                       | entity   |                     |
| `vacuum.routines`                  | entities |                     |
| `vacuum.settings`                  | entities |                     |
| `vacuum.consumables`               | objects  |                     |
| `vacuum.consumables.entity`        | entity   | required            |
| `vacuum.consumables.reset`         | entity   |                     |
| `vacuum.warnings`                  | entities |                     |
| `vacuum.dock`                      | object   |                     |
| `vacuum.dock.error`                | entity   |                     |
| `vacuum.dock.dust_emptying`        | entity   |                     |
| `vacuum.dock.mop_drying`           | entity   |                     |
| `vacuum.dock.mop_drying_time_left` | entity   |                     |
| `vacuum.dock.mop_washing`          | entity   |                     |
| `vacuum.dock.consumables`          | objects  |                     |
| `vacuum.dock.consumables.entity`   | entity   | required            |
| `vacuum.dock.consumables.reset`    | entity   |                     |
| `vacuum.dock.warnings`             | entities |                     |

Found by:

- `vacuum`: the rule of the shape `vacuum`, under [Shapes](#shapes)

# Data the cards read

Three cards read data that a sensor holds in its attributes, rather than an entity's state. This page gives each shape, and one way to produce it.

## The messages card

`entity` is a sensor whose state is the number of messages and whose `messages` attribute lists them, newest first:

| Field      | Type   | Meaning                                                                     |
| ---------- | ------ | --------------------------------------------------------------------------- |
| `id`       | string | Unique; the clear script removes the message by it                          |
| `title`    | string | The row's name                                                              |
| `message`  | string | The text, shown under the row when it is opened; may be empty               |
| `severity` | string | `error` red, `warning` orange, `notice` and `info` blue, anything else grey |
| `source`   | string | Optional; named through the card's `sources`                                |
| `time`     | string | ISO 8601                                                                    |

`clear` is a script that removes the message whose `id` it is given as a variable, or every message without one.

`recipes/messages.yaml` is a package that does both: copy it into `packages/` (with `homeassistant: packages: !include_dir_named packages` in `configuration.yaml`), and fire `mnml_message` with `title`, `message`, `severity` and `source` from any automation to add a message.

## The clients card

`entity` is a sensor whose `data` attribute (or the one `attribute` names) lists the clients. By default a record has UniFi Network API's field names; `fields` maps another source's:

| Field (default name) | `fields` key | Meaning                                                            |
| -------------------- | ------------ | ------------------------------------------------------------------ |
| `name`               | `name`       | The client's name                                                  |
| `ipAddress`          | `ip_address` | Its IPv4 address; grouped by `networks`' subnets                   |
| `type`               | `type`       | `WIRED`, `WIRELESS` or `VPN`; another value shows the generic icon |

`names` is an optional sensor whose `auto_clients` attribute is AdGuard Home's `/control/clients` list: each `{ ip, name, source }` whose `source` is `rDNS` or `etc/hosts` gives a client its full name.

One way to fill `entity`: a `command_line` sensor that asks the UniFi Network integration API with an API key, and keeps the answer's `data` as an attribute. `<router>` is the console's address, `<site>` the site's id from the same API's `/sites`, and the key is read from `secrets.yaml` so that it never sits in the configuration:

```yaml
command_line:
  - sensor:
      name: Network clients
      command: >-
        curl -s -m 25 -H "Accept: application/json"
        -H "X-API-KEY: $(sed -n 's/^unifi_api_key: *//p' /config/secrets.yaml | tr -d "\"' ")"
        "https://<router>/proxy/network/integration/v1/sites/<site>/clients?limit=200"
      value_template: '{{ value_json.totalCount }}'
      json_attributes:
        - data
      command_timeout: 30
      scan_interval: 60
```

## The car plan

Doors, hood and tailgate are binary sensors; windows and the sunroof are sensors; each part reads as open while its state is one of `open_states` (default `on`, `open`) and half open while it is one of `half_states` (default `intermediate`), compared lower-cased without hyphens. Tyre pressures and their targets are sensors in one unit; a tyre is orange under `tyre_warn_share` of its target and red under `tyre_low_share`.

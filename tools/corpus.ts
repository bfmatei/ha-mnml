import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readEnv } from './env.ts';
import { connect } from './socket.ts';

interface AreaRow {
  area_id: string;
  name: string;
  icon: string | null;
  temperature_entity_id: string | null;
  humidity_entity_id: string | null;
}

interface DeviceRow {
  id: string;
  area_id: string | null;
  name: string | null;
  name_by_user: string | null;
}

interface EntityRow {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
  platform: string;
  translation_key: string | null;
  entity_category: string | null;
  hidden_by: string | null;
  disabled_by: string | null;
  labels: string[];
}

interface StateRow {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

const KEPT = new Set(['device_class', 'friendly_name', 'unit_of_measurement', 'state_class']);

const session = await connect(readEnv());
const areas = await session.call<AreaRow[]>({ type: 'config/area_registry/list' });
const devices = await session.call<DeviceRow[]>({ type: 'config/device_registry/list' });
const entities = await session.call<EntityRow[]>({ type: 'config/entity_registry/list' });
const states = await session.call<StateRow[]>({ type: 'get_states' });
session.close();

const snapshot = {
  areas: Object.fromEntries(
    areas.map((area) => [
      area.area_id,
      {
        area_id: area.area_id,
        name: area.name,
        icon: area.icon,
        temperature_entity_id: area.temperature_entity_id,
        humidity_entity_id: area.humidity_entity_id,
      },
    ]),
  ),
  devices: Object.fromEntries(
    devices.map((device) => [
      device.id,
      {
        id: device.id,
        area_id: device.area_id,
        name: device.name,
        name_by_user: device.name_by_user,
      },
    ]),
  ),
  entities: Object.fromEntries(
    entities
      .filter((entity) => entity.disabled_by === null)
      .map((entity) => [
        entity.entity_id,
        {
          entity_id: entity.entity_id,
          device_id: entity.device_id,
          area_id: entity.area_id,
          platform: entity.platform,
          translation_key: entity.translation_key,
          entity_category: entity.entity_category,
          hidden: entity.hidden_by !== null,
          labels: entity.labels,
        },
      ]),
  ),
  states: Object.fromEntries(
    states.map((state) => [
      state.entity_id,
      {
        state: state.state,
        attributes: Object.fromEntries(
          Object.entries(state.attributes).filter(([key]) => KEPT.has(key)),
        ),
      },
    ]),
  ),
};

const sorted = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sorted)
    : typeof value === 'object' && value !== null
      ? Object.fromEntries(
          Object.entries(value)
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([key, inner]) => [key, sorted(inner)]),
        )
      : value;

const file = resolve(import.meta.dirname, '../src/templates/corpus/demo.json');
writeFileSync(file, `${JSON.stringify(sorted(snapshot), undefined, 2)}\n`, 'utf8');
console.log(
  `${file}: ${areas.length} areas, ${devices.length} devices, ${Object.keys(snapshot.entities).length} entities`,
);

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
  manufacturer: string | null;
  model: string | null;
  entry_type: string | null;
  via_device_id: string | null;
  labels: string[];
}

interface EntityRow {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
  platform: string;
  translation_key: string | null;
  entity_category: string | null;
  name: string | null;
  hidden_by: string | null;
  disabled_by: string | null;
  labels: string[];
}

interface StateRow {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface Rows {
  areas: readonly AreaRow[];
  devices: readonly DeviceRow[];
  entities: readonly EntityRow[];
  states: readonly StateRow[];
}

const KEPT = new Set([
  'device_class',
  'friendly_name',
  'unit_of_measurement',
  'state_class',
  'hvac_modes',
  'device_trackers',
  'source_type',
]);

export function snapshotOf(rows: Rows): Record<keyof Rows, Record<string, unknown>> {
  return {
    areas: Object.fromEntries(
      rows.areas.map((area) => [
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
      rows.devices.map((device) => [
        device.id,
        {
          id: device.id,
          area_id: device.area_id,
          name: device.name,
          name_by_user: device.name_by_user,
          manufacturer: device.manufacturer,
          model: device.model,
          entry_type: device.entry_type,
          via_device_id: device.via_device_id,
          labels: device.labels,
        },
      ]),
    ),
    entities: Object.fromEntries(
      rows.entities
        .filter((entity) => entity.disabled_by === null)
        .map((entity) => [
          entity.entity_id,
          {
            entity_id: entity.entity_id,
            device_id: entity.device_id,
            area_id: entity.area_id,
            platform: entity.platform,
            translation_key: entity.translation_key,
            name: entity.name,
            entity_category: entity.entity_category,
            hidden: entity.hidden_by !== null,
            labels: entity.labels,
          },
        ]),
    ),
    states: Object.fromEntries(
      rows.states.map((state) => [
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
}

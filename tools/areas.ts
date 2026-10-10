import { readEnv } from './env.ts';
import { connect } from './socket.ts';

interface Area {
  name: string;
  icon: string;
  entities: string[];
}

const AREAS: Record<string, Area> = {
  living: {
    name: 'Living',
    icon: 'mdi:sofa',
    entities: [
      'light.ceiling_lights',
      'light.living_room_rgbww_lights',
      'sensor.outside_temperature',
      'sensor.outside_humidity',
      'sensor.outside_temperature_battery',
      'lock.front_door',
      'media_player.living_room',
      'climate.hvac',
    ],
  },
  kitchen: {
    name: 'Kitchen',
    icon: 'mdi:fridge',
    entities: [
      'light.kitchen_lights',
      'lock.kitchen_door',
      'media_player.kitchen',
      'switch.ac',
      'binary_sensor.basement_floor_wet',
      'climate.heatpump',
    ],
  },
};

const { call, close } = await connect(readEnv());
const existing = new Set(
  (await call<{ area_id: string }[]>({ type: 'config/area_registry/list' })).map(
    (area) => area.area_id,
  ),
);
const entries = await call<{ entity_id: string; device_id: string | null }[]>({
  type: 'config/entity_registry/list',
});
const registered = new Set(entries.map((entry) => entry.entity_id));
const deviceOf = new Map(entries.map((entry) => [entry.entity_id, entry.device_id]));
for (const [id, area] of Object.entries(AREAS)) {
  if (!existing.has(id)) {
    await call({ type: 'config/area_registry/create', name: area.name, icon: area.icon });
  }
  const placed = area.entities.filter((entity) => registered.has(entity));
  for (const entity of placed) {
    const device = deviceOf.get(entity);
    try {
      await call({ type: 'config/entity_registry/update', entity_id: entity, area_id: id });
    } catch (error) {
      if (device === null || device === undefined) {
        throw error;
      }
      await call({ type: 'config/device_registry/update', device_id: device, area_id: id });
    }
  }
  const skipped = area.entities.filter((entity) => !registered.has(entity));
  console.log(
    `${id}: ${placed.length} entities${skipped.length > 0 ? `, not in the registry: ${skipped.join(', ')}` : ''}`,
  );
}
close();

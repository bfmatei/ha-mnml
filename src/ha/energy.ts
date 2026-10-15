import { field } from './field.ts';
import type { HassConnection } from './hass.ts';
import type { EnergyDevice, EnergyPrefs, EnergySource } from './registries.ts';

const text = (from: unknown, key: string): string | undefined => {
  const value = field(from, key);
  return typeof value === 'string' ? value : undefined;
};

const listed = (from: unknown, key: string): unknown[] => {
  const value = field(from, key);
  return Array.isArray(value) ? value : [];
};

function sourceOf(from: unknown): EnergySource[] {
  const type = text(from, 'type');
  const rate = text(from, 'stat_rate');
  const soc = text(from, 'stat_soc');
  return type === undefined
    ? []
    : [
        {
          type,
          ...(rate === undefined ? {} : { stat_rate: rate }),
          ...(soc === undefined ? {} : { stat_soc: soc }),
        },
      ];
}

function deviceOf(from: unknown): EnergyDevice[] {
  const consumption = text(from, 'stat_consumption');
  const rate = text(from, 'stat_rate');
  const within = text(from, 'included_in_stat');
  return consumption === undefined
    ? []
    : [
        {
          stat_consumption: consumption,
          ...(rate === undefined ? {} : { stat_rate: rate }),
          ...(within === undefined ? {} : { included_in_stat: within }),
        },
      ];
}

type Asker = Pick<HassConnection, 'sendMessagePromise'>;

const asked = new WeakMap<Asker, Promise<EnergyPrefs | undefined>>();
const answered = new WeakMap<Asker, EnergyPrefs>();

async function read(connection: Asker): Promise<EnergyPrefs | undefined> {
  const prefs = await connection
    .sendMessagePromise<unknown>({ type: 'energy/get_prefs' })
    .catch(() => undefined);
  return typeof prefs === 'object' && prefs !== null
    ? {
        energy_sources: listed(prefs, 'energy_sources').flatMap(sourceOf),
        device_consumption: listed(prefs, 'device_consumption').flatMap(deviceOf),
      }
    : undefined;
}

export function energyPrefs(connection: Asker): Promise<EnergyPrefs | undefined> {
  const known = asked.get(connection);
  if (known !== undefined) {
    return known;
  }
  const answer = read(connection).then((prefs) => {
    if (prefs !== undefined) {
      answered.set(connection, prefs);
    }
    return prefs;
  });
  asked.set(connection, answer);
  return answer;
}

export function knownEnergy(connection: Asker | undefined): EnergyPrefs | undefined {
  return connection === undefined ? undefined : answered.get(connection);
}

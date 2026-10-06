import type { Templates } from '../contract/templates.ts';
import { field } from '../ha/field.ts';
import { COMMON, OWNER, loadFamily } from '../templates/families.ts';

type Load = (family: string) => Promise<Templates>;

interface Shipped {
  templates(): Templates;
  later(): ReadonlySet<string>;
  need(names: readonly string[]): Promise<void>;
  failure(names: readonly string[]): string | undefined;
}

const RETRY_AFTER = 30_000;
const MISSING = new Set([404, 410]);

interface Failure {
  reason: string;
  missing: boolean;
  at: number;
}

export function createShipped(
  load: Load,
  owner: Readonly<Record<string, string>>,
  common: Templates,
  now: () => number = () => Date.now(),
): Shipped {
  const loaded = new Map<string, Templates>();
  const pending = new Map<string, Promise<void>>();
  const failed = new Map<string, Failure>();
  let merged: Templates = common;
  const familiesOf = (names: readonly string[]): string[] => [
    ...new Set(names.flatMap((name) => owner[name] ?? [])),
  ];
  const fetchFamily = (family: string): Promise<void> => {
    const known = pending.get(family);
    if (known !== undefined) {
      return known;
    }
    const started = load(family).then(
      (templates) => {
        loaded.set(family, templates);
        merged = { ...merged, ...templates };
      },
      (error: unknown) => {
        const status = field(error, 'status');
        const reason = error instanceof Error ? error.message : String(error);
        failed.set(family, {
          reason,
          missing: typeof status === 'number' && MISSING.has(status),
          at: now(),
        });
        console.error(`mnml: the shipped templates could not be loaded: ${reason}`);
      },
    );
    pending.set(family, started);
    return started;
  };
  const stillFailed = (family: string): Failure | undefined => {
    const failure = failed.get(family);
    if (failure === undefined || failure.missing || now() - failure.at < RETRY_AFTER) {
      return failure;
    }
    failed.delete(family);
    pending.delete(family);
    return undefined;
  };
  return {
    templates: () => merged,
    later: () => new Set(Object.keys(owner).filter((name) => !loaded.has(owner[name] ?? ''))),
    need: async (names) => {
      await Promise.all(
        familiesOf(names)
          .filter((family) => !loaded.has(family))
          .map(fetchFamily),
      );
    },
    failure: (names) => {
      for (const family of familiesOf(names)) {
        const failure = stillFailed(family);
        if (failure !== undefined) {
          return `mnml: the shipped templates could not be loaded: ${failure.reason}`;
        }
      }
      return undefined;
    },
  };
}

export const SHIPPED_TEMPLATES = createShipped(loadFamily, OWNER, COMMON);

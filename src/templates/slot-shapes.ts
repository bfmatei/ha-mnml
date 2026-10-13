import { isMapping } from '../contract/templates.ts';
import type {
  Kind,
  Shapes,
  SlotSpec,
  Template,
  WrittenSlot,
  WrittenTemplate,
} from '../contract/templates.ts';

import { TemplateError } from './expand.ts';

interface Use {
  name: string;
  at: string;
}

interface Resolving {
  who: string;
  shapes: Shapes;
  stack: readonly Use[];
}

const OBJECTS: ReadonlySet<Kind> = new Set(['object', 'objects']);

function mapped(value: unknown): boolean {
  return isMapping(value);
}

function plain(spec: WrittenSlot): spec is SlotSpec {
  return (
    !mapped(spec) ||
    (spec.shape === undefined &&
      spec.kind !== undefined &&
      (!mapped(spec.fields) || Object.values(spec.fields ?? {}).every(plain)))
  );
}

function plainTemplate(template: WrittenTemplate): template is Template {
  return !mapped(template.slots) || Object.values(template.slots ?? {}).every(plain);
}

function built(
  kind: Kind,
  own: WrittenSlot,
  base: SlotSpec | undefined,
  fields: Record<string, SlotSpec> | undefined,
): SlotSpec {
  const required = own.required ?? base?.required;
  const value = own.default === undefined ? base?.default : own.default;
  const discover = own.discover ?? base?.discover;
  const label = own.label ?? base?.label;
  const help = own.help ?? base?.help;
  const group = own.group ?? base?.group;
  return {
    kind,
    ...(required === true ? { required } : {}),
    ...(value === undefined ? {} : { default: value }),
    ...(discover === undefined ? {} : { discover }),
    ...(label === undefined ? {} : { label }),
    ...(help === undefined ? {} : { help }),
    ...(group === undefined ? {} : { group }),
    ...(fields === undefined ? {} : { fields }),
  };
}

function fail(who: string, problem: string): never {
  throw new TemplateError(`${who}: ${problem}`);
}

function checked(written: WrittenSlot, at: string, who: string): void {
  if (written.required !== undefined && written.required !== true) {
    fail(who, `the slot ${at} takes required: true, or no required`);
  }
  if (written.fields !== undefined && !mapped(written.fields)) {
    fail(who, `the fields of ${at} must be a mapping`);
  }
}

function through(resolving: Resolving, use: Use): string {
  const [first, ...rest] = [...resolving.stack, use];
  return `the slot ${first.at} uses the shape ${first.name}${rest.map((each) => `, which takes the shape ${each.name}`).join('')}`;
}

function takes(kind: Kind, base: Kind): boolean {
  return kind === base || (OBJECTS.has(kind) && OBJECTS.has(base));
}

function untaken(use: Use, inside: string, base: Kind, as: string, resolving: Resolving): never {
  const what = inside === '' ? 'shape' : 'field';
  return fail(
    resolving.who,
    `${through(resolving, use)}, ${inside === '' ? '' : `whose field ${inside.slice(1)} is `}of kind ${base}, as ${as}: only an object ${what} is taken as objects, or an objects one as object`,
  );
}

function overlay(
  base: SlotSpec,
  own: WrittenSlot,
  use: Use,
  inside: string,
  resolving: Resolving,
): SlotSpec {
  checked(own, `${use.at}${inside}`, resolving.who);
  const kind = own.kind ?? base.kind;
  if (!takes(kind, base.kind)) {
    untaken(use, inside, base.kind, kind, resolving);
  }
  const changes = own.fields ?? {};
  for (const field of Object.keys(changes)) {
    if (base.fields === undefined || !Object.hasOwn(base.fields, field)) {
      fail(
        resolving.who,
        `${through(resolving, use)}, which has no field named ${inside === '' ? '' : `${inside.slice(1)}.`}${field}`,
      );
    }
  }
  const fields =
    base.fields === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(base.fields).map(([field, inner]): [string, SlotSpec] => {
            const change = Object.hasOwn(changes, field) ? changes[field] : undefined;
            const at = `${inside}.${field}`;
            if (change === undefined) {
              return [field, inner];
            }
            if (!mapped(change) && plain(change)) {
              return [field, change];
            }
            if (change.shape === undefined) {
              return [field, overlay(inner, change, use, at, resolving)];
            }
            const shaped = settle(change, `${use.at}${at}`, resolving);
            if (!takes(shaped.kind, inner.kind)) {
              untaken(
                use,
                at,
                inner.kind,
                `the shape ${change.shape}, of kind ${shaped.kind}`,
                resolving,
              );
            }
            return [field, shaped];
          }),
        );
  return built(kind, own, base, fields);
}

function settle(written: WrittenSlot, at: string, resolving: Resolving): SlotSpec {
  if (plain(written)) {
    return written;
  }
  const name = written.shape;
  if (name !== undefined) {
    return overlay(shapeOf(name, at, resolving), written, { name, at }, '', resolving);
  }
  checked(written, at, resolving.who);
  if (written.kind === undefined) {
    return fail(resolving.who, `the slot ${at} has no kind and no shape`);
  }
  const fields =
    written.fields === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(written.fields).map(([field, inner]): [string, SlotSpec] => [
            field,
            settle(inner, `${at}.${field}`, resolving),
          ]),
        );
  return built(written.kind, written, undefined, fields);
}

function shapeOf(name: string, at: string, resolving: Resolving): SlotSpec {
  const { who, shapes, stack } = resolving;
  const [first] = stack;
  const loop = stack.findIndex((use) => use.name === name);
  if (first !== undefined && loop !== -1) {
    const looped = stack.slice(loop + 1).map((use) => use.name);
    fail(
      who,
      `the slot ${first.at} uses the shape ${first.name}${loop === 0 ? '' : `, which takes the shape ${name}`}, which uses itself${looped.length === 0 ? '' : ` through ${looped.join(', ')}`}`,
    );
  }
  const written = Object.hasOwn(shapes, name) ? shapes[name] : undefined;
  if (written === undefined) {
    return fail(
      who,
      first === undefined
        ? `the slot ${at} uses the shape ${name}, which is not known`
        : `the slot ${first.at} uses the shape ${first.name}, which takes the shape ${name}, which is not known`,
    );
  }
  return settle(written, at, { ...resolving, stack: [...stack, { name, at }] });
}

export function withShapes(name: string, template: WrittenTemplate, shapes: Shapes): Template {
  if (plainTemplate(template)) {
    return template;
  }
  const resolving: Resolving = { who: name, shapes, stack: [] };
  const slots = Object.fromEntries(
    Object.entries(template.slots ?? {}).map(([slot, spec]): [string, SlotSpec] => [
      slot,
      plain(spec) ? spec : structuredClone(settle(spec, slot, resolving)),
    ]),
  );
  return { ...template, slots };
}

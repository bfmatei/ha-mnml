import { isPlan } from '../contract/builder.ts';
import type { Plan } from '../contract/builder.ts';
import { isMapping } from '../contract/templates.ts';
import { field } from '../ha/field.ts';

export type Call = (message: { type: string } & Record<string, unknown>) => Promise<unknown>;

interface Previous {
  plan: Plan;
  config: Record<string, unknown>;
}

export interface Built {
  url_path: string;
  plan: Plan;
  previous: Previous | undefined;
  updated: string | undefined;
}

export interface Board {
  id: string;
  url_path: string;
  title: string;
  icon: string | undefined;
}

const LONGEST = 64;

export function addressFor(title: string, taken: ReadonlySet<string>): string {
  const slug =
    title
      .normalize('NFKD')
      .replaceAll(/\p{M}/gu, '')
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '') || 'mnml';
  const base = `dashboard-${slug}`.slice(0, LONGEST).replace(/-+$/, '');
  let address = base;
  for (let count = 2; taken.has(address); count += 1) {
    const suffix = `-${count}`;
    address = `${base.slice(0, LONGEST - suffix.length)}${suffix}`;
  }
  return address;
}

function previousOf(value: unknown): Previous | undefined {
  const plan = field(value, 'plan');
  const config = field(value, 'config');
  return isPlan(plan) && isMapping(config) ? { plan, config } : undefined;
}

export function builtOf(result: unknown): Built[] {
  const dashboards = field(result, 'dashboards');
  if (!isMapping(dashboards)) {
    return [];
  }
  return Object.entries(dashboards).flatMap(([url_path, entry]) => {
    const plan = field(entry, 'plan');
    const updated = field(entry, 'updated');
    return isPlan(plan)
      ? [
          {
            url_path,
            plan,
            previous: previousOf(field(entry, 'previous')),
            updated: typeof updated === 'string' ? updated : undefined,
          },
        ]
      : [];
  });
}

export function boardsOf(listed: unknown): Board[] {
  return (Array.isArray(listed) ? listed : []).flatMap((item) => {
    const id = field(item, 'id');
    const url_path = field(item, 'url_path');
    const title = field(item, 'title');
    const icon = field(item, 'icon');
    return typeof id === 'string' && typeof url_path === 'string'
      ? [
          {
            id,
            url_path,
            title: typeof title === 'string' ? title : url_path,
            icon: typeof icon === 'string' ? icon : undefined,
          },
        ]
      : [];
  });
}

async function created(
  call: Call,
  url_path: string,
  plan: Plan,
  config: object,
  undo: () => Promise<unknown>,
): Promise<void> {
  await call({ type: 'mnml/dashboards/save', url_path, plan });
  try {
    await call({
      type: 'lovelace/dashboards/create',
      url_path,
      title: plan.title,
      icon: plan.icon,
      show_in_sidebar: true,
      require_admin: false,
    });
  } catch (error) {
    await undo().catch(() => undefined);
    throw error;
  }
  await call({ type: 'lovelace/config/save', url_path, config });
}

export function makeDashboard(
  call: Call,
  url_path: string,
  plan: Plan,
  config: object,
): Promise<void> {
  return created(call, url_path, plan, config, () =>
    call({ type: 'mnml/dashboards/delete', url_path }),
  );
}

async function cardsOf(call: Call, url_path: string): Promise<unknown> {
  try {
    return await call({ type: 'lovelace/config', url_path });
  } catch (error) {
    if (field(error, 'code') === 'config_not_found') {
      return undefined;
    }
    throw error;
  }
}

async function retitle(call: Call, board: Board, plan: Plan): Promise<void> {
  if (board.title !== plan.title || board.icon !== plan.icon) {
    await call({
      type: 'lovelace/dashboards/update',
      dashboard_id: board.id,
      title: plan.title,
      icon: plan.icon,
    });
  }
}

export async function rebuildDashboard(
  call: Call,
  built: Built,
  board: Board | undefined,
  plan: Plan,
  config: object,
): Promise<void> {
  const url_path = built.url_path;
  if (board === undefined) {
    await created(call, url_path, plan, config, () =>
      call({ type: 'mnml/dashboards/save', url_path, plan: built.plan }),
    );
    return;
  }
  const before = await cardsOf(call, url_path);
  await call({
    type: 'mnml/dashboards/save',
    url_path,
    plan,
    ...(isMapping(before) ? { previous: { plan: built.plan, config: before } } : {}),
  });
  await call({ type: 'lovelace/config/save', url_path, config });
  await retitle(call, board, plan);
}

export async function undoDashboard(call: Call, built: Built, board: Board): Promise<void> {
  const previous = built.previous;
  if (previous === undefined) {
    throw new Error(`${built.plan.title} has no earlier version to go back to`);
  }
  const url_path = built.url_path;
  await call({ type: 'lovelace/config/save', url_path, config: previous.config });
  await retitle(call, board, previous.plan);
  await call({ type: 'mnml/dashboards/save', url_path, plan: previous.plan });
}

export async function forgetDashboard(
  call: Call,
  built: Built,
  board: Board | undefined,
  remove: boolean,
): Promise<void> {
  if (remove && board !== undefined) {
    await call({ type: 'lovelace/dashboards/delete', dashboard_id: board.id });
  }
  await call({ type: 'mnml/dashboards/delete', url_path: built.url_path });
}

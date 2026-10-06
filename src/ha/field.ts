export function field(from: unknown, key: string): unknown {
  return typeof from === 'object' && from !== null ? Reflect.get(from, key) : undefined;
}

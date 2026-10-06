import type { Subnet } from './entities.ts';

interface Range {
  start: number;
  size: number;
}

export function ipv4(text: string): number | undefined {
  const parts = text.split('.');
  if (parts.length !== 4) {
    return undefined;
  }
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) {
      return undefined;
    }
    value = value * 256 + Number(part);
  }
  return value;
}

export function subnetRange(subnet: Subnet): Range | undefined {
  const [base = '', bits = '', ...rest] = subnet.split('/');
  const address = ipv4(base);
  if (address === undefined || rest.length > 0 || !/^\d{1,2}$/.test(bits) || Number(bits) > 32) {
    return undefined;
  }
  const size = 2 ** (32 - Number(bits));
  return { start: Math.floor(address / size) * size, size };
}

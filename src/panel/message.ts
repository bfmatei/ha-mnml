import { field } from '../ha/field.ts';

export function messageOf(error: unknown): string {
  const said = field(error, 'message');
  return typeof said === 'string' ? said : String(error);
}

/**
 * Database utility functions for D1
 */

export function parseJSONField<T>(field: string | null | undefined, defaultValue: T): T {
  if (!field) return defaultValue;
  try {
    return JSON.parse(field) as T;
  } catch {
    return defaultValue;
  }
}

export function stringifyJSONField(field: unknown): string {
  return JSON.stringify(field);
}

export function booleanToInteger(value: boolean | number | undefined): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  return 0;
}

export function integerToBoolean(value: number | string | undefined): boolean {
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return false;
}
/**
 * PG display names.
 *
 * Every PG on the platform is shown with its PGWalo number in front of the
 * original name, e.g. `PGwalo1- Mohan Boys PG`. The number is durable: it is
 * assigned once (properties.pg_number) and never moves, so a link, an invoice
 * or a printed agreement always refers to the same PG.
 *
 * Formatting is idempotent — stripping an existing prefix before re-applying it
 * means a name can be formatted any number of times (client, server, re-publish)
 * without ever shipping `PGwalo1- PGwalo1- ...`.
 */

/** Matches "PGwalo1- ", "PGWalo 12 – ", "pgwalo#3: " … */
const PG_PREFIX = /^\s*pg\s*walo\s*#?\s*\d+\s*[-–—:.]\s*/i;

/** The user-supplied part of a PG name, with any PGWalo prefix removed. */
export function pgBaseName(name: string): string {
  return String(name ?? '').replace(PG_PREFIX, '').trim();
}

/**
 * `Mohan Boys PG` + 1 → `PGwalo1- Mohan Boys PG`.
 * Without a number the original name is returned untouched (legacy rows).
 */
export function pgDisplayName(name: string, pgNumber?: number | null): string {
  const base = pgBaseName(name) || 'PG';
  const n = Number(pgNumber);
  if (!Number.isFinite(n) || n <= 0) return base;
  return `PGwalo${Math.trunc(n)}- ${base}`;
}

/** True when the name already carries a PGWalo number. */
export function hasPgPrefix(name: string): boolean {
  return PG_PREFIX.test(String(name ?? ''));
}

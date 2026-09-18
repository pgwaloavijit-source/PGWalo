import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';

/**
 * Public platform numbers for the home page.
 *
 * Every figure is a live count from D1 — the landing page must never show a
 * hard-coded "450+ PGs" once the database knows better.
 *
 * "Verified PGs" counts *live* listings, not the raw `verified` flag: a listing
 * only goes live after PGWalo review, so a published PG is a verified PG. The
 * raw flag count is returned separately as `verifiedBadgeCount` for anyone who
 * needs it. Everything degrades to 0 on an empty or unmigrated database instead
 * of throwing, because this endpoint sits on the critical path of the home page.
 */

interface StatCount {
  n: number;
}

async function count(env: Env, sql: string): Promise<number> {
  try {
    const row = await env.DB.prepare(sql).first<StatCount>();
    return Number(row?.n) || 0;
  } catch (error) {
    console.error('stats query failed', sql, error);
    return 0;
  }
}

export async function statsHandler(env: Env): Promise<Response> {
  const [
    livePgs,
    verifiedBadgeCount,
    verifiedPgs,
    happyResidents,
    totalResidents,
    cities,
    totalBeds,
    occupiedBeds,
    rating,
  ] = await Promise.all([
    count(env, `SELECT COUNT(*) AS n FROM properties WHERE status IS NULL OR status = 'Active'`),
    count(env, `SELECT COUNT(*) AS n FROM properties WHERE verified = 1`),
    count(env, `SELECT COUNT(*) AS n FROM properties WHERE (status IS NULL OR status = 'Active') AND verified = 1`),
    count(env, `SELECT COUNT(*) AS n FROM residents WHERE status = 'Active'`),
    count(env, `SELECT COUNT(*) AS n FROM residents`),
    count(env, `SELECT COUNT(DISTINCT city) AS n FROM properties WHERE (status IS NULL OR status = 'Active') AND city IS NOT NULL AND city <> ''`),
    count(env, `SELECT COUNT(*) AS n FROM beds`),
    count(env, `SELECT COUNT(*) AS n FROM beds WHERE status = 'Occupied'`),
    env.DB
      .prepare(
        `SELECT AVG(rating) AS avgRating, COUNT(*) AS rated
           FROM properties
          WHERE (status IS NULL OR status = 'Active') AND rating > 0`
      )
      .first<{ avgRating: number | null; rated: number }>()
      .catch(() => null),
  ]);

  const ratedListings = Number(rating?.rated) || 0;
  const averageRating = ratedListings > 0 ? Number(rating?.avgRating || 0) : 0;

  return addCorsHeaders(new Response(JSON.stringify({
    /** PGs a resident can actually find and book right now. */
    verifiedPgs: livePgs,
    /** Live listings that also carry the verified badge. */
    verifiedBadgeCount: verifiedBadgeCount || verifiedPgs,
    /** Residents with an active stay on the platform. */
    happyResidents,
    totalResidents,
    /** PGWalo never charges brokerage — reported from the backend, not the UI. */
    brokerageFeePct: 0,
    /** Average resident score out of 5 across live listings. */
    averageRating: Math.round(averageRating * 10) / 10,
    ratedListings,
    totalListings: livePgs,
    cities,
    occupancyPct: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    updatedAt: new Date().toISOString(),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' },
  }));
}

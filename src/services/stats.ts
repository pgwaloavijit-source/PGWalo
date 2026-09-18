import { apiUrl } from './apiBase';

/**
 * Live platform numbers for the home page.
 *
 * The landing page used to hard-code "450+ Verified PGs / 12,000+ Happy
 * Residents". These counts come straight from D1 so the page can never claim
 * more than the platform has.
 */
export interface PlatformStats {
  verifiedPgs: number;
  verifiedBadgeCount: number;
  happyResidents: number;
  totalResidents: number;
  brokerageFeePct: number;
  averageRating: number;
  ratedListings: number;
  totalListings: number;
  cities: number;
  occupancyPct: number;
  updatedAt?: string;
}

export async function fetchPlatformStats(): Promise<PlatformStats | null> {
  try {
    const response = await fetch(apiUrl('/api/stats'), { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<PlatformStats>;
    if (!data || typeof data.verifiedPgs !== 'number') return null;
    return {
      verifiedPgs: Number(data.verifiedPgs) || 0,
      verifiedBadgeCount: Number(data.verifiedBadgeCount) || 0,
      happyResidents: Number(data.happyResidents) || 0,
      totalResidents: Number(data.totalResidents) || 0,
      brokerageFeePct: Number(data.brokerageFeePct) || 0,
      averageRating: Number(data.averageRating) || 0,
      ratedListings: Number(data.ratedListings) || 0,
      totalListings: Number(data.totalListings) || Number(data.verifiedPgs) || 0,
      cities: Number(data.cities) || 0,
      occupancyPct: Number(data.occupancyPct) || 0,
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}

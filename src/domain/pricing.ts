/**
 * Owner publishing plans.
 *
 * One catalogue, used by the pricing page, the payment handler, the invoice and
 * the property badge, so the price a resident-facing page shows can never drift
 * from the price the gateway charges.
 *
 * Prices are one-time listing fees in INR (GST inclusive, as displayed).
 */

export type ListingPlanId = 'lite' | 'air' | 'ocean';

export interface ListingPlan {
  id: ListingPlanId;
  name: string;
  /** One-time listing fee in INR. */
  price: number;
  /** Short pitch shown on the card. */
  tagline: string;
  /** Badge text shown on the published property. */
  badge: string;
  /** Tailwind classes for the badge. */
  badgeClass: string;
  /** Tailwind gradient for the pricing card header. */
  accent: string;
  /** How long the listing stays featured before a renewal is due. */
  durationDays: number;
  /** Ranked higher in search / listed in the featured strip. */
  featured: boolean;
  highlights: string[];
}

export const LISTING_PLANS: ListingPlan[] = [
  {
    id: 'lite',
    name: 'Lite',
    price: 499,
    tagline: 'Get published and start receiving enquiries.',
    badge: 'Lite',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    accent: 'from-slate-600 to-slate-800',
    durationDays: 30,
    featured: false,
    highlights: [
      'Live listing with photos and full room details',
      'Unlimited visit requests',
      'Owner dashboard, rent tracking and agreements',
      'PGWalo number + verified badge',
    ],
  },
  {
    id: 'air',
    name: 'Air',
    price: 999,
    tagline: 'Our most popular plan for growing PGs.',
    badge: 'Air',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    accent: 'from-sky-500 to-blue-700',
    durationDays: 90,
    featured: true,
    highlights: [
      'Everything in Lite',
      'Priority placement in search near you',
      'Featured on the home page for 90 days',
      'Lead analytics and locality benchmarks',
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    price: 1999,
    tagline: 'Maximum reach for multi-floor PGs and co-living.',
    badge: 'Ocean',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    accent: 'from-indigo-600 to-violet-800',
    durationDays: 180,
    featured: true,
    highlights: [
      'Everything in Air',
      'Top of the featured strip in your city',
      'Featured tag for 180 days',
      'Dedicated onboarding and listing review',
    ],
  },
];

export const listingPlan = (id?: string | null): ListingPlan | undefined =>
  LISTING_PLANS.find((plan) => plan.id === id);

export const isListingPlanId = (id?: string | null): id is ListingPlanId =>
  Boolean(listingPlan(id));

/** ₹1,999 — Indian digit grouping, no decimals. */
export const formatInr = (amount: number): string =>
  `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;

/** `₹1,999.00` — for invoices and gateway payloads. */
export const formatInrExact = (amount: number): string =>
  `INR ${(Math.round((Number(amount) || 0) * 100) / 100).toFixed(2)}`;

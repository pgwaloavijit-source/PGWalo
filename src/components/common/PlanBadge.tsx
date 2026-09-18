import React from 'react';
import { Crown } from 'lucide-react';
import { listingPlan } from '../../domain/pricing';
import { Property } from '../../types';

/**
 * The plan a listing was published under (Lite / Air / Ocean).
 *
 * It is the visible half of the publishing payment: an owner pays, and the
 * property is badged with what they bought. Rendered from the shared plan
 * catalogue so the badge can never disagree with the pricing page.
 */
export const PlanBadge: React.FC<{
  plan?: Property['planTier'];
  className?: string;
  compact?: boolean;
}> = ({ plan, className = '', compact = false }) => {
  const tier = listingPlan(plan);
  if (!tier) return null;

  return (
    <span
      title={`${tier.name} publishing plan`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-2xs ${tier.badgeClass} ${className}`}
    >
      <Crown className="w-3 h-3" />
      {compact ? tier.name : `${tier.name} plan`}
    </span>
  );
};

export default PlanBadge;

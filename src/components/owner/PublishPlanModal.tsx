import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Check, CreditCard, Crown, Loader2, ShieldCheck, AlertCircle, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { LISTING_PLANS, ListingPlan, ListingPlanId, formatInr } from '../../domain/pricing';
import { UserAccount } from '../../types';
import {
  createListingOrder, failListingPayment, fetchListingOrder, fetchListingPlans,
  ListingOrder, loadRazorpayCheckout, simulateListingPayment, verifyListingPayment,
} from '../../services/payments';

/**
 * Pick a plan, pay, get published.
 *
 * Reached from "Pay & publish" on a property card, from the listing wizard, and
 * from the emailed payment link (via `initialOrderId`), so the same screen is
 * both the upsell and the recovery path after a failed attempt.
 */

type Phase = 'plans' | 'paying' | 'processing' | 'success' | 'failed';

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export interface PayTarget {
  propertyId: string;
  propertyName: string;
}

export const PublishPlanModal: React.FC<{
  target: PayTarget;
  currentUser: UserAccount | null;
  /** Resume an emailed payment link instead of choosing a plan. */
  initialOrderId?: string;
  onClose: () => void;
  onPublished: (order: ListingOrder) => void;
}> = ({ target, currentUser, initialOrderId, onClose, onPublished }) => {
  const [phase, setPhase] = useState<Phase>(initialOrderId ? 'paying' : 'plans');
  const [plans, setPlans] = useState<ListingPlan[]>(LISTING_PLANS);
  const [simulated, setSimulated] = useState(false);
  const [selected, setSelected] = useState<ListingPlanId | null>(null);
  const [order, setOrder] = useState<ListingOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchListingPlans()
      .then((res) => {
        if (cancelled || !res) return;
        if (res.plans?.length) setPlans(res.plans);
        setSimulated(Boolean(res.transport?.simulated));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const planOf = (id?: string | null) => plans.find((p) => p.id === id) || LISTING_PLANS.find((p) => p.id === id);

  /** Open Razorpay checkout for a real order. */
  const openGateway = useCallback(async (pending: ListingOrder) => {
    setPhase('paying');
    setError(null);
    const ready = await loadRazorpayCheckout();
    if (!ready || !window.Razorpay || !target.keyId) {
      setError('Could not load the secure payment window. Check your connection and try again.');
      setPhase('failed');
      return;
    }
    const checkout = new window.Razorpay({
      key: pending.keyId,
      order_id: pending.providerOrderId || undefined,
      amount: pending.amountPaise || pending.amount * 100,
      currency: pending.currency || 'INR',
      name: 'PGWalo',
      description: `${planOf(pending.planId)?.name || 'Listing'} plan — ${target.propertyName || 'your PG'}`,
      prefill: {
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        contact: currentUser?.phone || '',
      },
      notes: { propertyId: target.propertyId, planId: pending.planId, orderId: pending.id },
      theme: { color: '#1769FF' },
      handler: (response: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }) => {
        void (async () => {
          setPhase('processing');
          const verified = await verifyListingPayment(pending.id, {
            razorpay_payment_id: response?.razorpay_payment_id,
            razorpay_order_id: response?.razorpay_order_id,
            razorpay_signature: response?.razorpay_signature,
          });
          if (!verified.ok) {
            const failed = await failListingPayment(pending.id, verified.error || 'Payment verification failed');
            setOrder(failed.data?.order || pending);
            setError(verified.error || 'Payment could not be verified.');
            setPhase('failed');
            return;
          }
          const paid = verified.data?.order || pending;
          setOrder(paid);
          setPhase('success');
          onPublished(paid);
        })();
      },
      modal: {
        ondismiss: () => {
          void (async () => {
            const failed = await failListingPayment(pending.id, 'Checkout closed before the payment completed');
            setOrder(failed.data?.order || pending);
            setError('The payment window was closed before it completed. Your listing is saved — try again any time.');
            setPhase('failed');
          })();
        },
      },
    });
    checkout.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.email, currentUser?.name, currentUser?.phone, onPublished, plans, target.propertyId, target.propertyName]);

  // Resume an emailed payment link (or a re-opened checkout).
  useEffect(() => {
    if (!initialOrderId) return;
    let cancelled = false;
    void (async () => {
      const res = await fetchListingOrder(initialOrderId);
      if (cancelled) return;
      if (!res.ok || !res.data?.order) {
        setError(res.error || 'That payment link is no longer valid.');
        setPhase('failed');
        return;
      }
      const found = res.data.order;
      setOrder(found);
      if (found.status === 'paid') {
        setPhase('success');
        return;
      }
      setSelected(found.planId);
      setPhase('plans');
    })();
    return () => {
      cancelled = true;
    };
  }, [initialOrderId]);

  const startPayment = async (planId: ListingPlanId) => {
    setSelected(planId);
    setBusy(true);
    setError(null);
    try {
      const res = await createListingOrder(target.propertyId, planId);
      if (!res.ok || !res.data?.order) {
        setError(res.error || 'Could not start the payment. Please try again.');
        setPhase('failed');
        return;
      }
      const created = res.data.order;
      setOrder(created);
      if (created.simulated) {
        setPhase('paying');
        return;
      }
      await openGateway(created);
    } finally {
      setBusy(false);
    }
  };

  const simulate = async (outcome: 'success' | 'failure') => {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const res = await simulateListingPayment(order.id, outcome);
      if (!res.ok || !res.data?.order) {
        setError(res.error || 'Could not complete the test payment.');
        setPhase('failed');
        return;
      }
      const result = res.data.order;
      setOrder(result);
      if (outcome === 'success') {
        setPhase('success');
        onPublished(result);
      } else {
        setPhase('failed');
        setError('Test payment marked as failed. The owner would receive this link by email.');
      }
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setOrder(null);
    setError(null);
    setPhase('plans');
  };

  const chosenPlan = planOf(selected || order?.planId);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-3xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92dvh] overflow-y-auto">
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-900">Pay &amp; publish</h2>
            <p className="text-[11px] text-slate-500 truncate">
              {order?.propertyName || target.propertyName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {phase === 'plans' && (
            <>
              <p className="text-xs text-slate-600 leading-relaxed">
                Choose the reach you need. Publishing is a one-time fee — PGWalo charges no commission
                or brokerage on rent, ever.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {plans.map((plan) => {
                  const isSelected = selected === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void startPayment(plan.id)}
                      className={`relative text-left rounded-3xl border-2 p-4 transition disabled:opacity-60 ${
                        isSelected ? 'border-blue-600 shadow-lg' : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {plan.featured && (
                        <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-amber-400 text-[10px] font-black text-amber-950">
                          Most popular
                        </span>
                      )}
                      <div className={`h-1.5 w-14 rounded-full bg-gradient-to-r ${plan.accent} mb-3`} />
                      <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-blue-600" /> {plan.name}
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatInr(plan.price)}</p>
                      <p className="text-[11px] text-slate-500">one-time · {plan.durationDays} days</p>
                      <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">{plan.tagline}</p>
                      <ul className="mt-3 space-y-1.5">
                        {plan.highlights.map((item) => (
                          <li key={item} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <span className="mt-3 w-full inline-flex items-center justify-center rounded-xl bg-blue-600 text-white text-xs font-bold py-2.5">
                        {busy && isSelected ? 'Starting…' : `Choose ${plan.name}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Secure payment. The tax invoice is emailed to you instantly and the plan badge is added to your listing.
              </p>
            </>
          )}

          {phase === 'paying' && order?.simulated && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Test mode — no real gateway is connected
                </p>
                <p>
                  {chosenPlan?.name} plan for {formatInr(order.amount)}. The moment Razorpay keys are
                  installed (<code>RAZORPAY_KEY_ID</code> / <code>RAZORPAY_KEY_SECRET</code>) this screen
                  becomes the live checkout and this test panel disappears.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void simulate('success')}
                  className="py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-60"
                >
                  Simulate successful payment
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void simulate('failure')}
                  className="py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm disabled:opacity-60"
                >
                  Simulate a failed payment
                </button>
              </div>
              {order.paymentLink && (
                <p className="text-[11px] text-slate-500">
                  Payment link (also emailed on failure):{' '}
                  <a className="text-blue-600 font-semibold break-all" href={order.paymentLink}>
                    {order.paymentLink}
                  </a>
                </p>
              )}
            </div>
          )}

          {phase === 'paying' && order && !order.simulated && (
            <div className="py-10 text-center text-slate-500 text-sm space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
              Waiting for the secure payment window…
            </div>
          )}

          {phase === 'processing' && (
            <div className="py-10 text-center text-slate-500 text-sm space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
              Confirming your payment…
            </div>
          )}

          {phase === 'success' && (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-black text-slate-900">Payment successful — your PG is live</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                {chosenPlan ? `${chosenPlan.name} plan · ${formatInr(order?.amount || chosenPlan.price)}. ` : ''}
                Your listing is published with its plan badge and the tax invoice
                {order?.invoiceNumber ? ` (${order.invoiceNumber})` : ''} is on its way to your email.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
              >
                Back to my PGs
              </button>
            </div>
          )}

          {phase === 'failed' && (
            <div className="py-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
                <p className="font-bold text-slate-900">Payment not completed</p>
                <p>
                  Nothing has been charged. Your listing is saved and still waiting for a plan —
                  we have emailed you the same secure payment link for the amount you selected
                  {chosenPlan ? ` (${chosenPlan.name} · ${formatInr(order?.amount || chosenPlan.price)})` : ''}.
                </p>
                {order?.paymentLink && (
                  <p>
                    Payment link:{' '}
                    <a className="text-blue-600 font-semibold break-all" href={order.paymentLink}>
                      {order.paymentLink}
                    </a>
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={retry}
                  className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                >
                  Pay &amp; publish
                </button>
                {order?.paymentLink && (
                  <a
                    href={order.paymentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold text-center inline-flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" /> Open the emailed link
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublishPlanModal;

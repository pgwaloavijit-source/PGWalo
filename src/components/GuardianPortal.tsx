import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, FileText, IndianRupee, Mail, ShieldCheck, XCircle } from 'lucide-react';
import { fetchGuardianView } from '../services/marketApi';
import type { GuardianViewPayload } from '../domain/p1';

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const STATUS_TONE: Record<string, string> = {
  Paid: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Partial: 'text-amber-700 bg-amber-50 border-amber-200',
  Pending: 'text-slate-600 bg-slate-50 border-slate-200',
  Overdue: 'text-red-700 bg-red-50 border-red-200',
};

/**
 * Guardian portal (spec §29) — what a parent sees at /guardian?token=…
 * Deliberately narrow facts, honest states, no invasive tracking. A wrong or
 * revoked token renders a dead end, never a list of anything.
 */
export const GuardianPortal: React.FC<{ token: string; onExit?: () => void }> = ({ token, onExit }) => {
  const [view, setView] = useState<(GuardianViewPayload & { guardian: { name: string; relation: string | null } }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchGuardianView(token)
      .then((v) => { if (alive) setView(v); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load this view'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
        <p className="text-sm font-bold text-slate-400">Loading the guardian view…</p>
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto">
            <XCircle className="w-7 h-7 text-rose-400" />
          </div>
          <h1 className="text-lg font-black">This link is not valid</h1>
          <p className="text-sm text-slate-400 leading-relaxed">{error || 'Ask the PG owner for a fresh access link.'}</p>
        </div>
      </div>
    );
  }

  const data = view;
  const rentTone = STATUS_TONE[data.rent.paymentStatus] || STATUS_TONE.Pending;

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black">P</div>
            <div>
              <p className="text-sm font-black">PGWalo Guardian View</p>
              <p className="text-[11px] text-slate-400">Read-only · shared by the property owner</p>
            </div>
          </div>
          {onExit && (
            <button onClick={onExit} className="text-xs font-bold text-slate-400 hover:text-white">Exit</button>
          )}
        </header>

        <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Resident</p>
          <h1 className="text-xl font-black">{data.resident.name}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {data.resident.propertyName} · Room {data.resident.roomNumber}, Bed {data.resident.bedNumber}
          </p>
          <p className="text-[11px] mt-2 flex items-center gap-1.5 font-bold">
            {data.currentlyCheckedIn
              ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-emerald-400">Currently staying</span></>
              : <><Clock className="w-3.5 h-3.5 text-amber-400" /> <span className="text-amber-400">Not currently checked in</span></>}
          </p>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <Mail className="w-3 h-3" /> Prepared for {data.guardian.name}{data.guardian.relation ? ` (${data.guardian.relation})` : ''}
          </p>
        </section>

        <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rent</p>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${rentTone}`}>{data.rent.paymentStatus}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 font-semibold">Monthly rent</span>
            <span className="font-black">{fmtINR(data.rent.monthlyRent)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 font-semibold">Outstanding</span>
            <span className={`font-black ${data.rent.outstanding > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmtINR(data.rent.outstanding)}</span>
          </div>
          {data.rent.lastPayment && (
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3 text-xs space-y-1">
              <p className="font-black text-slate-200 flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5 text-emerald-400" /> Last payment received</p>
              <p className="text-slate-400">
                {fmtINR(data.rent.lastPayment.amount)} on {data.rent.lastPayment.date.slice(0, 10)}
                {data.rent.lastPayment.method ? ` · ${data.rent.lastPayment.method}` : ''}
                {data.rent.lastPayment.receiptNumber ? ` · Receipt ${data.rent.lastPayment.receiptNumber}` : ''}
              </p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Agreement</p>
            <p className="text-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              {data.agreementState ? data.agreementState : 'Not shared yet'}
            </p>
            <p className="text-[11px] text-slate-500">State as recorded by the property — signed agreements show “fully executed”.</p>
          </section>
          <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Security deposit</p>
            <p className="text-sm font-bold">{fmtINR(data.deposit.expected)} <span className="text-slate-500 font-semibold">expected</span></p>
            <p className="text-[11px] text-slate-500">Held by the property · state: {data.deposit.state}</p>
          </section>
        </div>

        <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Recent property notices</p>
          {data.propertyNotices.length === 0 ? (
            <p className="text-xs text-slate-500">No notices shared.</p>
          ) : (
            <ul className="space-y-2">
              {data.propertyNotices.map((n, i) => (
                <li key={i} className="rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2">
                  <p className="text-xs font-bold text-slate-200">{n.title}</p>
                  <p className="text-[10px] text-slate-500">{n.date.slice(0, 10)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[10px] text-slate-600 flex items-center gap-1.5 justify-center pb-4">
          <ShieldCheck className="w-3 h-3" /> This view shows only what the owner shared. It never tracks location or movement.
        </p>
      </div>
    </div>
  );
};

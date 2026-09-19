import React, { useMemo, useState } from 'react';
import {
  AlertOctagon, ArrowRightLeft, Banknote, BellRing, CheckCircle2, Plus, TrendingDown,
} from 'lucide-react';
import { useOwnerScope } from '../../utils/ownership';
import { overdueByResident } from '../../domain/inventory';
import { evaluateReminders, buildReminderMessage, DEFAULT_REMINDER_SETTINGS } from '../../domain/reminders';
import { EXPENSE_CATEGORIES } from '../../domain/market';
import type { ExpenseEntry, PaymentIntent } from '../../domain/market';
import { fetchPaymentIntents, reconcilePaymentIntent, createExpense, fetchExpenses, fetchAllReminders, logReminder } from '../../services/marketApi';

type SubView = 'collections' | 'expenses' | 'reconciliation';

export const MoneyTab: React.FC = () => {
  const { invoices, residents } = useOwnerScope();
  const [view, setView] = useState<SubView>('collections');
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [loadedIntents, setLoadedIntents] = useState(false);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [utr, setUtr] = useState('');
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [expensesLoaded, setExpensesLoaded] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  React.useEffect(() => {
    if (view === 'reconciliation' && !loadedIntents) {
      setLoadedIntents(true);
      fetchPaymentIntents().then((r) => setIntents(r.intents)).catch(() => setIntents([]));
    }
    if (view === 'expenses' && !expensesLoaded) {
      setExpensesLoaded(true);
      fetchExpenses().then((r) => setExpenses(r.expenses)).catch(() => setExpenses([]));
    }
  }, [view, loadedIntents, expensesLoaded]);

  const overdue = useMemo(() => {
    const map = overdueByResident(invoices);
    const byId = new Map(residents.map((r) => [r.id, r]));
    return map
      .map((o) => ({ ...o, resident: byId.get(o.residentId) }))
      .filter((o) => o.resident)
      .sort((a, b) => b.overdueAmount - a.overdueAmount);
  }, [invoices, residents]);

  const totalOverdue = overdue.reduce((s, o) => s + o.overdueAmount, 0);

  const expenseTotals = useMemo(() => {
    const byCategory = new Map<string, number>();
    let total = 0;
    for (const e of expenses) {
      total += e.amount;
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    }
    return { byCategory: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]), total };
  }, [expenses]);

  const collected = useMemo(
    () => invoices.reduce((s, i) => s + (i.verifiedPaidAmount || 0), 0),
    [invoices]
  );

  const handleReconcile = async (intentId: string, status: 'paid' | 'failed') => {
    setReconciling(intentId);
    try {
      await reconcilePaymentIntent(intentId, { status, utr: utr || undefined });
      setIntents((prev) => prev.map((i) => (i.id === intentId ? { ...i, status, utr: utr || i.utr } : i)));
      setUtr('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Reconciliation failed');
    } finally {
      setReconciling(null);
    }
  };

  // ---- Collection cycle (spec §17): T-5/T-2/due/+2/+5 with suppression ----
  const [reminderLogs, setReminderLogs] = useState<{ residentId: string; invoiceId?: string | null; rule: string; sentAt: string }[]>([]);
  const [sendingRule, setSendingRule] = useState<string | null>(null);

  React.useEffect(() => {
    if (view === 'collections' && reminderLogs.length === 0) {
      fetchAllReminders().then((r) => setReminderLogs(r.recent)).catch(() => setReminderLogs([]));
    }
  }, [view, reminderLogs.length]);

  const reminderCandidates = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return evaluateReminders(
      invoices,
      reminderLogs.map((l) => ({ residentId: l.residentId, invoiceId: (l.invoiceId as string) || null, rule: l.rule, channel: 'whatsapp', sentAt: l.sentAt })),
      today,
      DEFAULT_REMINDER_SETTINGS,
    );
  }, [invoices, reminderLogs]);

  const sendReminders = async () => {
    if (!reminderCandidates.length || sendingRule) return;
    setSendingRule('batch');
    try {
      for (const c of reminderCandidates) {
        const msg = buildReminderMessage(
          residents.find((r) => r.id === c.residentId)?.name || 'there',
          c,
        );
        // wa.me deep link fallback: no BSP credentials are fabricated.
        const phone = (residents.find((r) => r.id === c.residentId)?.phone || '').replace(/\D/g, '').slice(-10);
        window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
        await logReminder({ residentId: c.residentId, invoiceId: c.invoiceId, rule: c.rule.id, channel: 'whatsapp' });
      }
      const refreshed = await fetchAllReminders();
      setReminderLogs(refreshed.recent);
    } finally {
      setSendingRule(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {([
          ['collections', 'Collections', AlertOctagon],
          ['expenses', 'Expenses & P&L', TrendingDown],
          ['reconciliation', 'Reconciliation', ArrowRightLeft],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
              view === key ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {view === 'collections' && (
        <div className="space-y-4">
          {/* Collection cycle engine (spec §17) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                  <BellRing className="w-4 h-4 text-amber-600" /> Collection cycle
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  T-5 · T-2 · due · +2 · +5 escalation. One reminder per rule per invoice; sending opens WhatsApp with the right message.
                </p>
              </div>
              <button
                onClick={sendReminders}
                disabled={!reminderCandidates.length || sendingRule !== null}
                className="text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition"
              >
                {sendingRule ? 'Sending…' : reminderCandidates.length ? `Send ${reminderCandidates.length} reminder${reminderCandidates.length > 1 ? 's' : ''}` : 'Nothing due today'}
              </button>
            </div>
            {reminderCandidates.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {reminderCandidates.slice(0, 6).map((c) => (
                  <li key={`${c.residentId}-${c.invoiceId}-${c.rule.id}`} className="text-xs text-slate-600 flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${c.rule.escalation ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.rule.label}
                    </span>
                    {residents.find((r) => r.id === c.residentId)?.name || c.residentId} — ₹{c.amountDue.toLocaleString('en-IN')} due {c.dueDate}
                  </li>
                ))}
                {reminderCandidates.length > 6 && (
                  <li className="text-xs text-slate-400">+{reminderCandidates.length - 6} more…</li>
                )}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Total overdue" value={`₹${totalOverdue.toLocaleString('en-IN')}`} tone="bad" />
            <Kpi label="Residents owing" value={String(overdue.length)} tone="warn" />
            <Kpi label="Collected (verified)" value={`₹${collected.toLocaleString('en-IN')}`} tone="good" />
            <Kpi label="Invoices tracked" value={String(invoices.length)} tone="neutral" />
          </div>
          {overdue.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nobody owes you money" body="Every invoice is settled. Check reconciliation for pending gateway payments." />
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-2.5">Resident</th>
                    <th className="px-3 py-2.5">Room</th>
                    <th className="px-3 py-2.5">Overdue</th>
                    <th className="px-3 py-2.5">Oldest due date</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdue.map((o) => (
                    <tr key={o.residentId} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-bold text-slate-800">{o.resident!.name}</td>
                      <td className="px-3 py-3 text-slate-600">{o.resident!.roomNumber}</td>
                      <td className="px-3 py-3 font-black text-red-600">₹{o.overdueAmount.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-slate-500">{o.oldestDueDate}</td>
                      <td className="px-3 py-3">
                        <a
                          href={`https://wa.me/91${(o.resident!.phone || '').replace(/\D/g, '').slice(-10)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200"
                        >
                          WhatsApp reminder
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'expenses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Total expenses" value={`₹${expenseTotals.total.toLocaleString('en-IN')}`} tone="bad" />
            <Kpi label="Collected (verified)" value={`₹${collected.toLocaleString('en-IN')}`} tone="good" />
            <Kpi
              label="Operating surplus (proxy)"
              value={`₹${(collected - expenseTotals.total).toLocaleString('en-IN')}`}
              tone={collected - expenseTotals.total >= 0 ? 'good' : 'bad'}
            />
            <Kpi label="Categories used" value={String(expenseTotals.byCategory.length)} tone="neutral" />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[11px] text-slate-500">Accounting approximation for owner visibility — not statutory accounting.</p>
            <button
              onClick={() => setShowExpenseForm((s) => !s)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add expense
            </button>
          </div>
          {showExpenseForm && (
            <ExpenseForm onSaved={(e) => { setExpenses((prev) => [e, ...prev]); setShowExpenseForm(false); }} />
          )}
          {expenses.length === 0 ? (
            <EmptyState icon={Banknote} title="No expenses recorded yet" body="Track lease, electricity, staff salary, food and more to see your true operating surplus." />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-400">By category</div>
                <ul className="divide-y divide-slate-100">
                  {expenseTotals.byCategory.map(([cat, amt]) => (
                    <li key={cat} className="px-5 py-2.5 flex justify-between text-sm">
                      <span className="text-slate-700 font-semibold">{cat}</span>
                      <span className="font-black text-slate-900">₹{amt.toLocaleString('en-IN')}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-400">Recent entries</div>
                <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {expenses.slice(0, 20).map((e) => (
                    <li key={e.id} className="px-5 py-2.5 flex justify-between text-sm">
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-800 truncate">{e.category}</span>
                        <span className="block text-[11px] text-slate-400">{e.date}{e.vendor ? ` · ${e.vendor}` : ''}</span>
                      </span>
                      <span className="font-black text-slate-900">₹{e.amount.toLocaleString('en-IN')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'reconciliation' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-900">
            Gateway payments are confirmed only by webhook verification — a redirect back to the app never marks money as received.
            Manual UPI/NEFT/cash can be recorded here with a UTR/reference.
          </div>
          {intents.length === 0 ? (
            <EmptyState icon={ArrowRightLeft} title="No payment intents yet" body="Token, rent and deposit payment links you create will appear here for tracking and reconciliation." />
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-2.5">Payer</th>
                    <th className="px-3 py-2.5">Purpose</th>
                    <th className="px-3 py-2.5">Amount</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">UTR / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {intents.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-bold text-slate-800">{i.payerName}</td>
                      <td className="px-3 py-3 text-slate-600 capitalize">{i.purpose}</td>
                      <td className="px-3 py-3 font-black text-slate-900">₹{i.amount.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3">
                        <StatusChip status={i.status} />
                      </td>
                      <td className="px-3 py-3">
                        {i.status === 'paid' ? (
                          <span className="text-xs text-slate-500">{i.utr || i.providerPaymentId || 'gateway-verified'}</span>
                        ) : ['created', 'link_sent'].includes(i.status) ? (
                          reconciling === i.id ? (
                            <div className="flex gap-1.5 items-center">
                              <input
                                value={utr}
                                onChange={(e) => setUtr(e.target.value)}
                                placeholder="UTR / ref no."
                                className="w-28 px-2 py-1 rounded-lg border border-slate-300 text-xs"
                              />
                              <button onClick={() => handleReconcile(i.id, 'paid')} className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">Mark paid</button>
                              <button onClick={() => handleReconcile(i.id, 'failed')} className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold">Failed</button>
                            </div>
                          ) : (
                            <button onClick={() => { setReconciling(i.id); setUtr(''); }} className="text-xs font-bold text-blue-600 hover:underline">
                              Reconcile
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; tone: 'good' | 'bad' | 'warn' | 'neutral' }> = ({ label, value, tone }) => {
  const tones = {
    good: 'text-emerald-600',
    bad: 'text-red-600',
    warn: 'text-amber-600',
    neutral: 'text-slate-900',
  };
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-black mt-1 ${tones[tone]}`}>{value}</div>
    </div>
  );
};

const EmptyState: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; body: string }> = ({ icon: Icon, title, body }) => (
  <div className="bg-white rounded-3xl border border-slate-200 px-6 py-10 text-center">
    <Icon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
    <p className="text-sm font-bold text-slate-700">{title}</p>
    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{body}</p>
  </div>
);

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    created: 'bg-blue-50 text-blue-700 border-blue-200',
    link_sent: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    expired: 'bg-slate-100 text-slate-500 border-slate-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
    refunded: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${map[status] || map.expired}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const ExpenseForm: React.FC<{ onSaved: (e: ExpenseEntry) => void }> = ({ onSaved }) => {
  const { properties } = useOwnerScope();
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createExpense({ category, amount: amt, date, vendor: vendor || undefined, propertyId: propertyId || undefined });
      onSaved({
        id: `exp-local-${Date.now()}`, category, amount: amt, date,
        vendor: vendor || undefined, propertyId: propertyId || undefined, createdAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase text-slate-400">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-slate-400">Amount (₹)</span>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm" placeholder="4500" />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-slate-400">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm" />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-slate-400">Vendor</span>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm" placeholder="Optional" />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-slate-400">Property</span>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm">
            <option value="">All properties</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
        {saving ? 'Saving…' : 'Save expense'}
      </button>
    </div>
  );
};

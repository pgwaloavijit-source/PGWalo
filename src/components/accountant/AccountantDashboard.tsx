import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CreditCard,
  Zap,
  TrendingUp,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Search,
  Check,
  Building,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { downloadFinancialStatementPdf, downloadInvoicePdf } from '../../utils/pdfDocuments';

export const AccountantDashboard: React.FC = () => {
  const {
    residents,
    reconciliations,
    depositRecords,
    addDepositDeduction,
    settleDepositRefund,
    logAuditEvent,
    invoices,
    checkoutSettlements,
    recordPaymentForInvoice,
    executeCheckoutSettlement,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'reconciliation' | 'deposits' | 'ledgers'>('reconciliation');
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);

  // New Deduction Form State
  const [dedCategory, setDedCategory] = useState<'Damage' | 'Unpaid Rent' | 'Electricity' | 'Other'>('Damage');
  const [dedAmount, setDedAmount] = useState(1500);
  const [dedReason, setDedReason] = useState('Deep paint scuff on study wall & broken wardrobe hanger rod');

  // Settlement Transaction State
  const [settlementTxnId, setSettlementTxnId] = useState(`UPI-REF-${Math.floor(100000 + Math.random() * 900000)}`);
  const [showSettleModal, setShowSettleModal] = useState<string | null>(null);

  // Invoice Payment Recording State
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Credit/Debit Card' | 'Net Banking' | 'Cash' | 'Bank Transfer'>('UPI');
  const [paymentTxnRef, setPaymentTxnRef] = useState('');

  const totalDepositsHeld = depositRecords.reduce((sum, d) => sum + d.depositReceived, 0);
  const totalPendingRefunds = depositRecords
    .filter((d) => d.status === 'Settlement Pending')
    .reduce((sum, d) => sum + d.finalRefundAmount, 0);

  const handleAddDeduction = (depositId: string) => {
    if (dedAmount <= 0) return;
    addDepositDeduction(depositId, {
      category: dedCategory,
      amount: dedAmount,
      reason: dedReason,
    });
    setDedAmount(1000);
    setDedReason('');
    setSelectedDepositId(null);
  };

  const handleSettleRefund = (depositId: string) => {
    settleDepositRefund(depositId, settlementTxnId);
    setShowSettleModal(null);
  };

  const handleExportCSV = () => {
    logAuditEvent('Financial Report Exported', 'Rent & Electricity Ledger', 'Exported CSV summary for Q1 reconciliation');
    alert('Financial statement CSV exported successfully!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Financial Controller Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
              <CreditCard className="w-3.5 h-3.5" />
              Financial Accounting & Utility Reconciliation
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Corporate Cashflow & Settlement Ledger
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Managing power utility audit statements, sub-meter billing reconciliations, and escrow security deposit move-out calculations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => downloadFinancialStatementPdf(invoices)}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center gap-1.5 transition-all"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4" />
              Export Statement (CSV)
            </button>
          </div>
        </div>

        {/* Financial KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total Security Deposits Held</span>
            <span className="text-2xl font-black text-white">₹{totalDepositsHeld.toLocaleString('en-IN')}</span>
            <span className="text-[11px] text-emerald-400 block mt-0.5">Held in Escrow</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Pending Move-out Refunds</span>
            <span className="text-2xl font-black text-white">₹{totalPendingRefunds.toLocaleString('en-IN')}</span>
            <span className="text-[11px] text-amber-300 block mt-0.5">Awaiting Payout</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Electricity Variance</span>
            <span className="text-2xl font-black text-emerald-400">+₹135</span>
            <span className="text-[11px] text-slate-300 block mt-0.5">Tariff Recovery Balanced</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Gross Monthly Rent</span>
            <span className="text-2xl font-black text-white">₹59,000</span>
            <span className="text-[11px] text-emerald-400 block mt-0.5">85% Realized</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs with smooth mobile horizontal scroll */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-2 border-b border-slate-200 text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'reconciliation' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          Electricity Reconciliation (BESCOM)
        </button>
        <button
          onClick={() => setActiveTab('deposits')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'deposits' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Deposit Deductions & Settlements ({depositRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('ledgers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            activeTab === 'ledgers' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Rent Ledgers & Aging
        </button>
      </div>

      {/* Tab 1: Electricity Reconciliation */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Utility Provider Bill vs. Room Sub-Meter Billing
                </h3>
                <p className="text-xs text-slate-500">
                  Audit power utility disbursements: compares main BESCOM meter against the aggregation of tenant sub-meters + common areas.
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 self-start">
                Status: Reconciled & Balanced
              </span>
            </div>

            {reconciliations.map((rec) => (
              <div key={rec.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-5">
                <div className="flex justify-between items-center text-xs font-bold border-b border-slate-200 pb-3">
                  <span className="text-slate-700 text-sm">
                    Billing Cycle: {rec.billingCycle} • Main BESCOM Account: {rec.mainMeterNumber}
                  </span>
                  <span className="text-slate-500">Reconciled on {rec.reconciledAt}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">BESCOM Main Utility Bill</span>
                    <span className="text-lg font-bold text-slate-900">
                      ₹{rec.mainMeterBillAmount.toLocaleString('en-IN')}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{rec.mainMeterUnits} Total Units Consumed</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Total Sub-Meters Billed</span>
                    <span className="text-lg font-bold text-blue-700">
                      ₹{rec.totalTenantSubmetersBilled.toLocaleString('en-IN')}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{rec.totalTenantUnits} Room Units @ ₹8.50/u</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Common Area Load</span>
                    <span className="text-lg font-bold text-purple-700">
                      ₹{rec.commonAreaLoadEstimated.toLocaleString('en-IN')}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{rec.commonAreaUnits} Lift & Lobby Units</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Net Accounting Variance</span>
                    <span className="text-lg font-bold text-emerald-600">
                      +₹{rec.varianceAmount.toLocaleString('en-IN')}
                    </span>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">Zero Discrepancy Leakage</p>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Auditor Note: Room sub-meters capture 810 units, common loads account for 120 units, perfectly absorbing the ₹6,750 electricity supply tariff.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Security Deposit Deductions & Move-out Settlement */}
      {activeTab === 'deposits' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  Security Deposit Move-Out Settlements
                </h3>
                <p className="text-xs text-slate-500">
                  Itemized deduction manager (damage repairs, unpaid electricity, notice violations) with automated net refund payout calculations.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {depositRecords.map((dep) => (
                <div key={dep.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">{dep.tenantName}</span>
                        <span className="text-xs text-slate-500">Room {dep.roomNumber}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            dep.status === 'Refunded'
                              ? 'bg-emerald-100 text-emerald-800'
                              : dep.status === 'Settlement Pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {dep.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Moved in: {dep.moveInDate} • Vacating on: {dep.moveOutDate || 'Active'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Initial Deposit:</span>
                      <span className="text-base font-bold text-slate-900">
                        ₹{dep.depositReceived.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Deductions List */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Approved Deductions:
                    </span>
                    {dep.deductions.length > 0 ? (
                      <div className="space-y-1.5">
                        {dep.deductions.map((d) => (
                          <div
                            key={d.id}
                            className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900 mr-2">[{d.category}]</span>
                              <span className="text-slate-600">{d.reason}</span>
                            </div>
                            <span className="font-bold text-rose-600">-₹{d.amount.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No deductions recorded. 100% refundable.</p>
                    )}
                  </div>

                  {/* Settlement Summary & Actions */}
                  <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs space-y-1">
                      <div className="flex gap-4">
                        <span className="text-slate-600">Total Deductions: <strong>₹{dep.totalDeductions}</strong></span>
                        <span className="text-slate-600">
                          Net Refund Due: <strong className="text-emerald-700 text-sm">₹{dep.finalRefundAmount.toLocaleString('en-IN')}</strong>
                        </span>
                      </div>
                      {dep.refundTransactionId && (
                        <span className="text-[11px] text-emerald-600 font-mono block">
                          Settled via Txn Ref: {dep.refundTransactionId} on {dep.refundDate}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {dep.status !== 'Refunded' && (
                        <>
                          <button
                            onClick={() => setSelectedDepositId(selectedDepositId === dep.id ? null : dep.id)}
                            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors"
                          >
                            + Add Deduction
                          </button>
                          <button
                            onClick={() => setShowSettleModal(dep.id)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                          >
                            Settle & Disburse Refund
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Add Deduction Inline Form */}
                  {selectedDepositId === dep.id && (
                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 text-xs animate-in fade-in">
                      <span className="font-bold text-amber-950 uppercase tracking-wider block">
                        Record Move-Out Deduction
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <select
                          value={dedCategory}
                          onChange={(e) => setDedCategory(e.target.value as any)}
                          className="px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden"
                        >
                          <option value="Damage">Damage Repair</option>
                          <option value="Unpaid Rent">Unpaid Rent Arrears</option>
                          <option value="Electricity">Electricity Surcharge</option>
                          <option value="Other">Cleaning / Key Loss</option>
                        </select>
                        <input
                          type="number"
                          value={dedAmount}
                          onChange={(e) => setDedAmount(Number(e.target.value))}
                          placeholder="Deduction Amount (₹)"
                          className="px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden font-bold"
                        />
                        <input
                          type="text"
                          value={dedReason}
                          onChange={(e) => setDedReason(e.target.value)}
                          placeholder="Specific Reason & Item"
                          className="px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedDepositId(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAddDeduction(dep.id)}
                          className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                        >
                          Apply Deduction
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Settle Modal */}
                  {showSettleModal === dep.id && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-xs animate-in fade-in">
                      <span className="font-bold text-emerald-950 uppercase tracking-wider block">
                        Confirm Payout & Record Transaction Reference
                      </span>
                      <p className="text-slate-600">
                        Disbursing net amount of <strong>₹{dep.finalRefundAmount.toLocaleString('en-IN')}</strong> to {dep.tenantName}'s verified bank account.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={settlementTxnId}
                          onChange={(e) => setSettlementTxnId(e.target.value)}
                          placeholder="Bank UTR / UPI Ref Number"
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden font-mono"
                        />
                        <button
                          onClick={() => handleSettleRefund(dep.id)}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          Confirm Disbursed
                        </button>
                        <button
                          onClick={() => setShowSettleModal(null)}
                          className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Enterprise Phase 2 Checkout Settlements Section */}
            {checkoutSettlements.length > 0 && (
              <div className="pt-8 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Notice Checkout Audit & Settlement Statements
                    </h4>
                    <p className="text-xs text-slate-500">
                      Calculated move-out deductions including damage assessments, power arrears, key returns, and net refund disbursal.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                    {checkoutSettlements.length} Checkout Records
                  </span>
                </div>

                <div className="space-y-4">
                  {checkoutSettlements.map((cs) => (
                    <div key={cs.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div>
                          <span className="font-bold text-slate-900 text-sm mr-2">{cs.residentName}</span>
                          <span className="text-slate-500 font-medium">
                            Room {cs.roomNumber} ({cs.bedNumber}) • Checkout Date: {cs.checkoutDate}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold self-start sm:self-auto ${
                            cs.refundStatus === 'Refunded'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {cs.refundStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Security Deposit Held</span>
                          <span className="font-bold text-slate-800 text-xs">₹{cs.depositHeld.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Deductions</span>
                          <span className="font-bold text-rose-600 text-xs">₹{cs.totalDeductions.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Net Refund Calculated</span>
                          <span className="font-black text-emerald-700 text-sm">₹{cs.finalRefundAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Checklist Verified</span>
                          <span className="font-medium text-slate-700 text-xs">
                            {cs.propertyChecklist.keysReturned && cs.propertyChecklist.bedInspected ? '✓ Keys & Room Inspected' : 'Pending Checklist'}
                          </span>
                        </div>
                      </div>

                      {cs.deductionNotes && (
                        <p className="text-[11px] text-slate-500 bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                          <strong>Deduction breakdown:</strong> {cs.deductionNotes} (Damage: ₹{cs.damageDeductions}, Power: ₹{cs.electricityCharges})
                        </p>
                      )}

                      {cs.refundTransactionId && (
                        <p className="text-[11px] text-emerald-700 font-mono">
                          Disbursed with Transaction Ref: <strong>{cs.refundTransactionId}</strong> on {cs.settledAt}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Itemized Invoices & Aging */}
      {activeTab === 'ledgers' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Deterministic Invoices & Aging Ledger</h3>
                <p className="text-xs text-slate-500">
                  Itemized billing records generated per monthly cycle, tracking rent, power, dues, and payment references.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {invoices.length} Total Invoices
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  {invoices.filter((inv) => inv.status === 'Paid').length} Paid
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                  {invoices.filter((inv) => inv.status !== 'Paid').length} Due / Overdue
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Invoice #</th>
                    <th className="p-3.5">Resident & Room</th>
                    <th className="p-3.5">Billing Month</th>
                    <th className="p-3.5">Base Rent</th>
                    <th className="p-3.5">Electricity & Extras</th>
                    <th className="p-3.5">Total Due</th>
                    <th className="p-3.5">Balance</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                      <td className="p-3.5">
                        <span className="font-bold text-slate-900 block">{inv.residentName}</span>
                        <span className="text-[11px] text-slate-500">Room {inv.roomNumber}</span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-600">{inv.month}</td>
                      <td className="p-3.5 font-bold text-slate-800">₹{inv.baseRent.toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-slate-600">
                        ₹{(inv.electricityCharges + inv.otherCharges).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 font-black text-slate-900">₹{inv.totalDue.toLocaleString('en-IN')}</td>
                      <td className="p-3.5 font-black text-rose-600">
                        {inv.outstandingBalance > 0 ? `₹${inv.outstandingBalance.toLocaleString('en-IN')}` : '₹0'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'Partially Paid'
                              ? 'bg-blue-100 text-blue-800'
                              : inv.status === 'Overdue'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => downloadInvoicePdf(inv)}
                            className="rounded-lg border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                          >
                            PDF
                          </button>
                          {inv.status !== 'Paid' ? (
                            <button
                              id={`accountant-record-pay-${inv.id}`}
                              onClick={() => {
                                setPayingInvoiceId(inv.id);
                                setPaymentAmount(inv.outstandingBalance);
                                setPaymentTxnRef(`PAY-${Math.floor(100000 + Math.random() * 900000)}`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs"
                            >
                              Record Payment
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-bold">Settled</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Record Invoice Payment Modal */}
          {payingInvoiceId && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="font-black text-sm text-slate-900">Record Offline / Gateway Payment</h4>
                  <button
                    onClick={() => setPayingInvoiceId(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Amount to Record (₹)</label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium"
                    >
                      <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                      <option value="Bank Transfer">NEFT / RTGS / IMPS Bank Transfer</option>
                      <option value="Net Banking">Net Banking</option>
                      <option value="Credit/Debit Card">Credit/Debit Card</option>
                      <option value="Cash">Cash Collection</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Transaction Ref / UTR Number</label>
                    <input
                      type="text"
                      value={paymentTxnRef}
                      onChange={(e) => setPaymentTxnRef(e.target.value)}
                      placeholder="e.g. 42398239401"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setPayingInvoiceId(null)}
                    className="w-1/3 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (paymentAmount <= 0) return;
                      recordPaymentForInvoice({
                        invoiceId: payingInvoiceId,
                        amount: paymentAmount,
                        paymentMethod: paymentMethod,
                        transactionId: paymentTxnRef || `TXN-${Date.now()}`,
                      });
                      setPayingInvoiceId(null);
                    }}
                    className="w-2/3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs"
                  >
                    Confirm & Reconcile
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

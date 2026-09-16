import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TrendingUp,
  CreditCard,
  DollarSign,
  PieChart,
  Download,
  Building2,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export const ProfitabilityTab: React.FC = () => {
  const { residents, beds, properties, logAuditEvent } = useApp();

  // Financial Estimates
  const totalBeds = beds.length || 10;
  const grossRentCollected = residents.reduce(
    (sum, r) => (r.rentStatus === 'Paid' ? sum + r.monthlyRent : sum),
    0
  );
  const pendingRent = residents.reduce(
    (sum, r) => (r.rentStatus !== 'Paid' ? sum + r.monthlyRent : sum),
    0
  );
  const electricityRevenues = 4 * 1350; // sub-meters

  const grossMonthlyIncome = grossRentCollected + electricityRevenues;

  // Operating Expenses (OPEX)
  const opexElectricity = 6750;
  const opexKitchen = 12000;
  const opexStaff = 18000;
  const opexWifiAndMaint = 4500;
  const opexPropertyTax = 2200;

  const totalOperatingExpenses =
    opexElectricity + opexKitchen + opexStaff + opexWifiAndMaint + opexPropertyTax;

  const netOperatingIncome = grossMonthlyIncome - totalOperatingExpenses;
  const operatingExpenseRatio = Math.round((totalOperatingExpenses / (grossMonthlyIncome || 1)) * 100);
  const revPAB = Math.round(grossMonthlyIncome / totalBeds); // Revenue Per Available Bed

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase block">Gross Monthly Income</span>
          <span className="text-2xl font-black text-slate-900 block mt-1">
            ₹{grossMonthlyIncome.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +12% YoY growth
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase block">Total Operating Expenses (OPEX)</span>
          <span className="text-2xl font-black text-rose-600 block mt-1">
            ₹{totalOperatingExpenses.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-1">
            OER: {operatingExpenseRatio}% of gross
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase block">Net Operating Income (NOI)</span>
          <span className="text-2xl font-black text-emerald-700 block mt-1">
            ₹{netOperatingIncome.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-emerald-600 font-bold mt-1">Monthly net yield</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-blue-600 uppercase block">RevPAB (Rev / Avail Bed)</span>
          <span className="text-2xl font-black text-blue-700 block mt-1">
            ₹{revPAB.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-1">
            Across {totalBeds} configured beds
          </span>
        </div>
      </div>

      {/* Breakdown Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Sources */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center justify-between">
            <span>Gross Revenue Inflow</span>
            <span className="text-xs font-semibold text-emerald-600">Collected</span>
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Room Rentals (Collected)</span>
                <span className="text-[11px] text-slate-400">Tenants who have settled this month</span>
              </div>
              <span className="font-bold text-slate-900">₹{grossRentCollected.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Sub-Meter Utility Recovery</span>
                <span className="text-[11px] text-slate-400">Electricity bills paid by tenants</span>
              </div>
              <span className="font-bold text-slate-900">₹{electricityRevenues.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
              <div>
                <span className="font-bold text-amber-900 block">Pending Inflow (Dues & Arrears)</span>
                <span className="text-[11px] text-amber-700">Awaiting payment collection</span>
              </div>
              <span className="font-bold text-amber-800">₹{pendingRent.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center justify-between">
            <span>Operating Expense (OPEX) Matrix</span>
            <span className="text-xs font-semibold text-rose-600">Disbursed</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-600">Housekeeping & Security Wages</span>
              <span className="font-bold text-slate-900">₹{opexStaff.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-600">Mess Grocery & Cook Provisions</span>
              <span className="font-bold text-slate-900">₹{opexKitchen.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-600">BESCOM Main Electricity Bill</span>
              <span className="font-bold text-slate-900">₹{opexElectricity.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-600">High-Speed Fiber & Repairs</span>
              <span className="font-bold text-slate-900">₹{opexWifiAndMaint.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Municipal Waste & Property Tax Reserves</span>
              <span className="font-bold text-slate-900">₹{opexPropertyTax.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import type {
  ChartOfAccount,
  GeneralLedgerEntry,
  ProfitAndLossReport,
  BalanceSheetReport,
  CashFlowStatementReport,
} from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import {
  Building2,
  ReceiptText,
  Scale,
  TrendingUp,
  Search,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  FileText,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface AccountingModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  chartOfAccounts: ChartOfAccount[];
  ledgerEntries: GeneralLedgerEntry[];
  pnlReport: ProfitAndLossReport | null;
  balanceSheet: BalanceSheetReport | null;
  cashFlow: CashFlowStatementReport | null;
  onRefreshData: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const AccountingModule: React.FC<AccountingModuleProps> = ({
  theme,
  selectedStore,
  onStoreChange,
  chartOfAccounts,
  ledgerEntries,
  pnlReport,
  balanceSheet,
  cashFlow,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // Sub-tabs
  const [subTab, setSubTab] = useState<'pnl' | 'balance_sheet' | 'cash_flow' | 'gl' | 'coa'>('pnl');
  const [glSearch, setGlSearch] = useState<string>('');
  const [glRefFilter, setGlRefFilter] = useState<string>('ALL');
  const [coaCategoryFilter, setCoaCategoryFilter] = useState<string>('ALL');

  // Filtered GL entries
  const filteredLedger = ledgerEntries.filter((entry) => {
    if (selectedStore !== 'CONSOLIDATED' && entry.storeId && entry.storeId !== selectedStore) return false;
    if (glRefFilter !== 'ALL' && entry.referenceType !== glRefFilter) return false;
    if (glSearch) {
      const q = glSearch.toLowerCase();
      return (
        entry.id.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.accountName.toLowerCase().includes(q) ||
        entry.accountCode.includes(q)
      );
    }
    return true;
  });

  // Filtered COA
  const filteredCOA = chartOfAccounts.filter((acc) => {
    if (selectedStore !== 'CONSOLIDATED' && acc.storeId && acc.storeId !== selectedStore && acc.storeId !== 'GLOBAL') {
      return false;
    }
    if (coaCategoryFilter !== 'ALL' && acc.category !== coaCategoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Store Segregation Control */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          isLight
            ? 'bg-white border-stone-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide">
                Double-Entry Accounting
              </span>
              <span className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                Indonesian Retail Multi-Store COA Standards
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-stone-900' : 'text-white'}`}>
              Financial Statements &amp; Store-Tagged General Ledger
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
              Segregated Chart of Accounts (COA) per physical store hub with automated real-time postings for
              QRIS checkouts, PO/GR supplier liabilities, and waste shrinkage expenses.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Store Hub Filter */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${isLight ? 'text-stone-600' : 'text-stone-300'}`}>
                Entity:
              </span>
              <select
                value={selectedStore}
                onChange={(e) => {
                  onStoreChange(e.target.value);
                  onShowToast('Accounting Scope Changed', `Reporting scope set to ${e.target.value}`);
                }}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border focus:outline-none focus:border-[#0F4C3A] transition-all ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900 hover:bg-stone-100'
                    : 'bg-stone-800 border-stone-700 text-white'
                }`}
              >
                <option value="CONSOLIDATED">Consolidated Company-Wide (All Outlets)</option>
                <option value="store-jkt-senopati">Senopati Flagship Hub (Jakarta)</option>
                <option value="store-jkt-pik">PIK 2 The Avenue Hub (Jakarta)</option>
                <option value="store-jkt-menteng">Menteng Heritage Hub (Jakarta)</option>
                <option value="store-bdg-dago">Dago Green Market Hub (Bandung)</option>
                <option value="store-sby-gubeng">Gubeng Central Hub (Surabaya)</option>
                <option value="store-bali-canggu">Batu Bolong Organic Hub (Bali)</option>
              </select>
            </div>

            <button
              onClick={onRefreshData}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none mt-6 pt-4 border-t border-stone-200 dark:border-stone-800">
          {[
            { id: 'pnl', label: 'Profit & Loss (P&L)', icon: TrendingUp },
            { id: 'balance_sheet', label: 'Balance Sheet', icon: Scale },
            { id: 'cash_flow', label: 'Cash Flow Statement', icon: DollarSign },
            { id: 'gl', label: 'General Ledger Drill-Down', icon: ReceiptText },
            { id: 'coa', label: 'Chart of Accounts (COA)', icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                    : 'text-stone-400 hover:text-white hover:bg-stone-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB 1: PROFIT & LOSS STATEMENT */}
      {subTab === 'pnl' && pnlReport && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-stone-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-stone-200 bg-stone-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-lg font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
                  Income Statement (Profit &amp; Loss)
                </h3>
                <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'} mt-0.5`}>
                  Reporting Scope: <strong className="text-[#0F4C3A] dark:text-emerald-400">{pnlReport.storeName || 'Consolidated'}</strong> • Period: {pnlReport.period}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-stone-200' : 'bg-stone-800 border-stone-700'}`}>
                  <span className={`text-[11px] ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>Gross Margin:</span>
                  <span className="ml-1.5 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400 text-xs">
                    {pnlReport.grossMarginPercent}%
                  </span>
                </div>
                <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-stone-200' : 'bg-stone-800 border-stone-700'}`}>
                  <span className={`text-[11px] ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>Net Margin:</span>
                  <span className="ml-1.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    {pnlReport.netMarginPercent}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6 font-mono text-xs">
            {/* 1. Operating Sales Revenue */}
            <div className="space-y-2">
              <div className={`flex justify-between font-bold uppercase text-[11px] pb-1.5 border-b ${
                isLight ? 'border-stone-200 text-stone-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>1. Operating Sales Revenue</span>
                <span>Amount (IDR)</span>
              </div>
              <div className={`flex justify-between pl-4 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                <span>Gross Customer QRIS Checkout Revenue</span>
                <span className={`font-semibold ${isLight ? 'text-stone-900' : 'text-stone-100'}`}>
                  {formatIDR(pnlReport.grossSalesRevenue)}
                </span>
              </div>
              <div className="flex justify-between pl-4 text-amber-600 dark:text-amber-400">
                <span>Less: Customer Loyalty Points &amp; Vouchers</span>
                <span>-{formatIDR(pnlReport.discountsGiven)}</span>
              </div>
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t ${
                isLight ? 'border-stone-200 text-stone-900' : 'border-stone-800 text-white'
              }`}>
                <span>Net Sales Revenue</span>
                <span className="text-[#0F4C3A] dark:text-emerald-400">{formatIDR(pnlReport.netSalesRevenue)}</span>
              </div>
            </div>

            {/* 2. Cost of Goods Sold */}
            <div className="space-y-2 pt-2">
              <div className={`flex justify-between font-bold uppercase text-[11px] pb-1.5 border-b ${
                isLight ? 'border-stone-200 text-stone-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>2. Cost of Goods Sold (COGS - Weighted Average Valuation)</span>
                <span>Amount (IDR)</span>
              </div>
              <div className={`flex justify-between pl-4 ${isLight ? 'text-rose-600' : 'text-red-400'}`}>
                <span>Direct Organic Farm Acquisition &amp; Butchery Costs</span>
                <span>-{formatIDR(pnlReport.costOfGoodsSold)}</span>
              </div>
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t text-sm ${
                isLight ? 'border-stone-200 text-[#0F4C3A]' : 'border-stone-800 text-emerald-400'
              }`}>
                <span>Gross Profit ({pnlReport.grossMarginPercent}% gross margin)</span>
                <span>{formatIDR(pnlReport.grossProfit)}</span>
              </div>
            </div>

            {/* 3. Operating & Cold-Chain Expenses (OPEX) */}
            <div className="space-y-2 pt-2">
              <div className={`flex justify-between font-bold uppercase text-[11px] pb-1.5 border-b ${
                isLight ? 'border-stone-200 text-stone-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>3. Operating &amp; Cold-Chain Expenses (OPEX)</span>
                <span>Amount (IDR)</span>
              </div>
              {pnlReport.operatingExpenses.map((exp, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                  <span>{exp.category}</span>
                  <span className={isLight ? 'text-rose-600' : 'text-red-400'}>
                    -{formatIDR(exp.amount)}
                  </span>
                </div>
              ))}
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t ${
                isLight ? 'border-stone-200 text-stone-900' : 'border-stone-800 text-stone-200'
              }`}>
                <span>Total Operating Expenses</span>
                <span className={isLight ? 'text-rose-600' : 'text-red-400'}>
                  -{formatIDR(pnlReport.totalOperatingExpenses)}
                </span>
              </div>
            </div>

            {/* Bottom Line Net Operating Profit */}
            <div
              className={`p-4 rounded-xl border flex justify-between items-center font-sans ${
                isLight
                  ? 'bg-emerald-50/70 border-emerald-200 text-stone-900'
                  : 'bg-emerald-950/20 border-emerald-800/40 text-white'
              }`}
            >
              <div>
                <span className="font-bold text-base">Net Operating Profit</span>
                <p className={`text-xs ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                  Net Profit Margin: {pnlReport.netMarginPercent}% after inventory shrinkage &amp; cold-chain OPEX
                </p>
              </div>
              <span className="font-mono font-bold text-lg text-[#0F4C3A] dark:text-emerald-400">
                {formatIDR(pnlReport.netProfit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BALANCE SHEET */}
      {subTab === 'balance_sheet' && balanceSheet && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-stone-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-stone-200 bg-stone-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-lg font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
                  Automated Balance Sheet (Statement of Financial Position)
                </h3>
                <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'} mt-0.5`}>
                  Period: {balanceSheet.period} • Enterprise Multi-Store Consolidated Matrix
                </p>
              </div>

              <div>
                {balanceSheet.isBalanced ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Balanced: Assets = Liabilities + Equity
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                    Discrepancy Detected
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            {/* ASSETS */}
            <div className={`p-5 rounded-xl border space-y-4 ${
              isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-stone-800/40 border-stone-700'
            }`}>
              <div className="flex justify-between items-center border-b pb-2 border-stone-200 dark:border-stone-700">
                <h4 className="font-bold uppercase tracking-wider text-xs text-[#0F4C3A] dark:text-emerald-400">
                  Total Assets
                </h4>
                <span className="font-bold text-sm text-[#0F4C3A] dark:text-emerald-400">
                  {formatIDR(balanceSheet.assets.totalAssets)}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className={`font-bold ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>Current Assets</span>
                {balanceSheet.assets.currentAssets.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-stone-200 dark:border-stone-700/60">
                <span className={`font-bold ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>Non-Current Fixed Assets</span>
                {balanceSheet.assets.nonCurrentAssets.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className={`p-5 rounded-xl border space-y-4 ${
              isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-stone-800/40 border-stone-700'
            }`}>
              <div className="flex justify-between items-center border-b pb-2 border-stone-200 dark:border-stone-700">
                <h4 className="font-bold uppercase tracking-wider text-xs text-blue-600 dark:text-blue-400">
                  Liabilities &amp; Equity
                </h4>
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                  {formatIDR(balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className={`font-bold ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>Current Liabilities</span>
                {balanceSheet.liabilities.currentLiabilities.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-stone-200 dark:border-stone-700/60">
                <span className={`font-bold ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>Shareholders' Equity</span>
                {balanceSheet.equity.equityItems.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CASH FLOW STATEMENT */}
      {subTab === 'cash_flow' && cashFlow && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-stone-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-stone-200 bg-stone-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <h3 className={`text-lg font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
              Cash Flow Statement
            </h3>
            <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'} mt-0.5`}>
              Operating, Investing, and Financing Cash Movements • {cashFlow.period}
            </p>
          </div>

          <div className="p-6 space-y-5 font-mono text-xs">
            <div className="space-y-1.5">
              <div className={`flex justify-between font-bold uppercase pb-1.5 border-b ${
                isLight ? 'border-stone-200 text-stone-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>Cash Flows from Operating Activities</span>
                <span className="text-[#0F4C3A] dark:text-emerald-400">{formatIDR(cashFlow.netOperatingCash)}</span>
              </div>
              {cashFlow.operatingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                  <span>{act.category}</span>
                  <span className={act.amount < 0 ? (isLight ? 'text-rose-600' : 'text-red-400') : (isLight ? 'text-emerald-600' : 'text-emerald-400')}>
                    {act.amount < 0 ? `-${formatIDR(Math.abs(act.amount))}` : formatIDR(act.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <div className={`flex justify-between font-bold uppercase pb-1.5 border-b ${
                isLight ? 'border-stone-200 text-stone-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>Cash Flows from Investing Activities</span>
                <span className="text-blue-600 dark:text-blue-400">{formatIDR(cashFlow.netInvestingCash)}</span>
              </div>
              {cashFlow.investingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                  <span>{act.category}</span>
                  <span className={act.amount < 0 ? (isLight ? 'text-rose-600' : 'text-red-400') : (isLight ? 'text-emerald-600' : 'text-emerald-400')}>
                    {act.amount < 0 ? `-${formatIDR(Math.abs(act.amount))}` : formatIDR(act.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div
              className={`p-4 rounded-xl border flex justify-between items-center font-sans ${
                isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-900'
                  : 'bg-stone-850 border-stone-700 text-white'
              }`}
            >
              <span className="font-bold text-sm">Ending Liquid Cash Balance</span>
              <span className="font-mono font-bold text-base text-[#0F4C3A] dark:text-emerald-400">
                {formatIDR(cashFlow.endingCash)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: GENERAL LEDGER (GL) DRILL-DOWN */}
      {subTab === 'gl' && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-stone-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-5 border-b ${isLight ? 'border-stone-200 bg-stone-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-stone-900' : 'text-white'} flex items-center gap-2`}>
                  <ReceiptText className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  General Ledger (GL) Immutable Journal Vouchers
                </h3>
                <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'} mt-0.5`}>
                  Double-entry accounting records with audit-grade immutability and store outlet tags
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={glSearch}
                    onChange={(e) => setGlSearch(e.target.value)}
                    placeholder="Search voucher or description..."
                    className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] w-56 ${
                      isLight
                        ? 'bg-white border-stone-300 text-stone-900'
                        : 'bg-stone-800 border-stone-700 text-white'
                    }`}
                  />
                </div>

                <select
                  value={glRefFilter}
                  onChange={(e) => setGlRefFilter(e.target.value)}
                  className={`px-2.5 py-1.5 text-xs rounded-xl border font-semibold ${
                    isLight
                      ? 'bg-white border-stone-300 text-stone-800'
                      : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                >
                  <option value="ALL">All Ref Types</option>
                  <option value="QRIS_SALE">QRIS Sales</option>
                  <option value="PO_RECEIPT">PO Goods Receipt</option>
                  <option value="INVENTORY_ADJUST">Stock Adjustments</option>
                  <option value="WASTE_SHRINKAGE">Waste Shrinkage</option>
                  <option value="COGS_RECOGNITION">COGS Recognition</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                  isLight ? 'border-stone-200 bg-stone-50 text-stone-500' : 'border-stone-800 bg-stone-800/50 text-stone-400'
                }`}>
                  <th className="py-3 px-4">Entry ID</th>
                  <th className="py-3 px-4">Date / Outlet</th>
                  <th className="py-3 px-4">Account Code &amp; Name</th>
                  <th className="py-3 px-4 text-right">Debit</th>
                  <th className="py-3 px-4 text-right">Credit</th>
                  <th className="py-3 px-4">Ref Type</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-stone-200' : 'divide-stone-800'}`}>
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`py-8 text-center text-xs font-sans ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                      No general ledger entries matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        isLight ? 'hover:bg-stone-50/80' : 'hover:bg-stone-800/40'
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-[#0F4C3A] dark:text-emerald-400">
                        {entry.id}
                      </td>
                      <td className={`py-3 px-4 text-[11px] font-sans ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>
                        <div>{entry.timestamp.split('T')[0]}</div>
                        <span className={`text-[10px] ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                          {entry.storeName || 'Senopati'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`font-mono font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
                          {entry.accountCode}
                        </span>
                        <div className={`text-[11px] ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                          {entry.accountName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {entry.debit > 0 ? formatIDR(entry.debit) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {entry.credit > 0 ? formatIDR(entry.credit) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                          isLight
                            ? 'bg-stone-100 text-stone-700 border-stone-200'
                            : 'bg-stone-800 text-stone-300 border-stone-700'
                        }`}>
                          {entry.referenceType}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-[11px] font-sans max-w-xs truncate ${isLight ? 'text-stone-600' : 'text-stone-300'}`}>
                        {entry.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: CHART OF ACCOUNTS (COA) STRUCTURE */}
      {subTab === 'coa' && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-stone-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-5 border-b ${isLight ? 'border-stone-200 bg-stone-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-stone-900' : 'text-white'} flex items-center gap-2`}>
                  <Building2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  Chart of Accounts (COA) Structure
                </h3>
                <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'} mt-0.5`}>
                  Multi-Store segregated account hierarchy compliant with standard Indonesian retail bookkeeping
                </p>
              </div>

              <div className="flex items-center gap-1">
                {(['ALL', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCoaCategoryFilter(cat)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                      coaCategoryFilter === cat
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-stone-600 hover:bg-stone-200/60'
                        : 'text-stone-400 hover:bg-stone-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                  isLight ? 'border-stone-200 bg-stone-50 text-stone-500' : 'border-stone-800 bg-stone-800/50 text-stone-400'
                }`}>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4 font-sans">Account Title</th>
                  <th className="py-3 px-4 font-sans">Category</th>
                  <th className="py-3 px-4">Normal Balance</th>
                  <th className="py-3 px-4 font-sans">Reporting Hub</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-stone-200' : 'divide-stone-800'}`}>
                {filteredCOA.map((acc) => (
                  <tr
                    key={`${acc.storeId}-${acc.accountCode}`}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-stone-50/80' : 'hover:bg-stone-800/40'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {acc.accountCode}
                    </td>
                    <td className={`py-3.5 px-4 font-sans font-semibold ${isLight ? 'text-stone-900' : 'text-white'}`}>
                      {acc.accountName}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          acc.category === 'Asset'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                            : acc.category === 'Liability'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                            : acc.category === 'Revenue'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                        }`}
                      >
                        {acc.category}
                      </span>
                    </td>
                    <td className={`py-3.5 px-4 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                      {acc.normalBalance}
                    </td>
                    <td className={`py-3.5 px-4 font-sans ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                      {acc.storeId}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
                      {formatIDR(acc.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

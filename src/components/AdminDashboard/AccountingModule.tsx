import React, { useState } from 'react';
import type {
  ChartOfAccount,
  GeneralLedgerEntry,
  ProfitAndLossReport,
  BalanceSheetReport,
  CashFlowStatementReport,
  SupportedCurrency,
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
  AlertTriangle,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  FileText,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  X,
  Globe2,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

const FX_RATES: Record<SupportedCurrency, { symbol: string; rate: number; label: string }> = {
  IDR: { symbol: 'Rp', rate: 1, label: 'IDR (Base)' },
  USD: { symbol: '$', rate: 16000, label: 'USD ($)' },
  EUR: { symbol: '€', rate: 17200, label: 'EUR (€)' },
  AUD: { symbol: 'A$', rate: 10400, label: 'AUD (A$)' },
};

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
  activeSubTab?: 'pnl' | 'balance_sheet' | 'cash_flow' | 'gl' | 'coa';
  onSubTabChange?: (subTab: 'pnl' | 'balance_sheet' | 'cash_flow' | 'gl' | 'coa') => void;
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
  activeSubTab,
  onSubTabChange,
}) => {
  const isLight = theme === 'light';

  // Multi-Currency Selection (Module 4)
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>('IDR');

  const formatCurrency = (amountIDR: number) => {
    if (selectedCurrency === 'IDR') return formatIDR(amountIDR);
    const info = FX_RATES[selectedCurrency];
    const converted = amountIDR / info.rate;
    return `${info.symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Sub-tabs (controlled or internal)
  const [internalSubTab, setInternalSubTab] = useState<'pnl' | 'balance_sheet' | 'cash_flow' | 'gl' | 'coa'>('pnl');
  const subTab = activeSubTab !== undefined ? activeSubTab : internalSubTab;
  const setSubTab = (val: 'pnl' | 'balance_sheet' | 'cash_flow' | 'gl' | 'coa') => {
    setInternalSubTab(val);
    if (onSubTabChange) onSubTabChange(val);
  };
  const [glSearch, setGlSearch] = useState<string>('');
  const [glRefFilter, setGlRefFilter] = useState<string>('ALL');
  const [coaCategoryFilter, setCoaCategoryFilter] = useState<string>('ALL');

  // Immutability & Reversing Journal Entry State
  const [reversingEntry, setReversingEntry] = useState<GeneralLedgerEntry | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('Auditor correction / price variance offset');
  const [isSubmittingReversal, setIsSubmittingReversal] = useState<boolean>(false);

  const handlePostReversal = async () => {
    if (!reversingEntry) return;
    setIsSubmittingReversal(true);
    try {
      const res = await apiClient.reverseGeneralLedgerEntry(reversingEntry.id, reversalReason);
      onShowToast(
        'Reversing Counter-Entry Posted',
        `Reversing voucher #${res.reversingVoucher.id} posted. Original #${res.originalVoucher.id} marked as reversed.`
      );
      setReversingEntry(null);
      onRefreshData();
    } catch (err: any) {
      onShowToast('Reversal Failed', String(err.message || err));
    } finally {
      setIsSubmittingReversal(false);
    }
  };

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
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide">
                Double-Entry Accounting
              </span>
              <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                Indonesian Retail Multi-Store COA Standards
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Financial Statements &amp; Store-Tagged General Ledger
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
              Segregated Chart of Accounts (COA) per physical store hub with automated real-time postings for
              QRIS checkouts, PO/GR supplier liabilities, and waste shrinkage expenses.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Store Hub Filter */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${isLight ? 'text-gray-600' : 'text-stone-300'}`}>
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
                    ? 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
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
                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none mt-6 pt-4 border-t border-gray-200 dark:border-stone-800">
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
                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Income Statement (Profit &amp; Loss)
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
                  Reporting Scope: <strong className="text-[#0F4C3A] dark:text-emerald-400">{pnlReport.storeName || 'Consolidated'}</strong> • Period: {pnlReport.period}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Multi-Currency Selector (Module 4) */}
                <div className={`flex items-center gap-1 p-1 rounded-xl border ${isLight ? 'bg-white border-gray-200' : 'bg-stone-800 border-stone-700'}`}>
                  <Globe2 className="w-3.5 h-3.5 text-emerald-600 ml-1.5" />
                  {(['IDR', 'USD', 'EUR', 'AUD'] as SupportedCurrency[]).map((curr) => (
                    <button
                      key={curr}
                      onClick={() => {
                        setSelectedCurrency(curr);
                        onShowToast('Reporting Currency Converted', `P&L statement recomputed in ${curr}`);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        selectedCurrency === curr
                          ? 'bg-[#0F4C3A] text-white shadow-xs'
                          : isLight
                          ? 'text-gray-600 hover:text-gray-900'
                          : 'text-stone-300 hover:text-white'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>

                <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-stone-800 border-stone-700'}`}>
                  <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>Gross Margin:</span>
                  <span className="ml-1.5 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400 text-xs">
                    {pnlReport.grossMarginPercent}%
                  </span>
                </div>
                <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-stone-800 border-stone-700'}`}>
                  <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>Net Margin:</span>
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
                isLight ? 'border-gray-200 text-gray-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>1. Operating Sales Revenue</span>
                <span>Amount ({selectedCurrency})</span>
              </div>
              <div className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                <span>Gross Customer QRIS Checkout Revenue</span>
                <span className={`font-semibold ${isLight ? 'text-gray-900' : 'text-stone-100'}`}>
                  {formatCurrency(pnlReport.grossSalesRevenue)}
                </span>
              </div>
              <div className="flex justify-between pl-4 text-amber-600 dark:text-amber-400">
                <span>Less: Customer Loyalty Points &amp; Vouchers</span>
                <span>-{formatCurrency(pnlReport.discountsGiven)}</span>
              </div>
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t ${
                isLight ? 'border-gray-200 text-gray-900' : 'border-stone-800 text-white'
              }`}>
                <span>Net Sales Revenue</span>
                <span className="text-[#0F4C3A] dark:text-emerald-400">{formatCurrency(pnlReport.netSalesRevenue)}</span>
              </div>
            </div>

            {/* 2. Cost of Goods Sold */}
            <div className="space-y-2 pt-2">
              <div className={`flex justify-between font-bold uppercase text-[11px] pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>2. Cost of Goods Sold (COGS - Weighted Average Valuation)</span>
                <span>Amount ({selectedCurrency})</span>
              </div>
              <div className={`flex justify-between pl-4 ${isLight ? 'text-rose-600' : 'text-red-400'}`}>
                <span>Direct Organic Farm Acquisition &amp; Butchery Costs</span>
                <span>-{formatCurrency(pnlReport.costOfGoodsSold)}</span>
              </div>
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t text-sm ${
                isLight ? 'border-gray-200 text-[#0F4C3A]' : 'border-stone-800 text-emerald-400'
              }`}>
                <span>Gross Profit ({pnlReport.grossMarginPercent}% gross margin)</span>
                <span>{formatCurrency(pnlReport.grossProfit)}</span>
              </div>
            </div>

            {/* 3. Operating & Cold-Chain Expenses (OPEX) */}
            <div className="space-y-2 pt-2">
              <div className={`flex justify-between font-bold uppercase text-[11px] pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>3. Operating &amp; Cold-Chain Expenses (OPEX)</span>
                <span>Amount ({selectedCurrency})</span>
              </div>
              {pnlReport.operatingExpenses.map((exp, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                  <span>{exp.category}</span>
                  <span className={isLight ? 'text-rose-600' : 'text-red-400'}>
                    -{formatCurrency(exp.amount)}
                  </span>
                </div>
              ))}
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t ${
                isLight ? 'border-gray-200 text-gray-900' : 'border-stone-800 text-stone-200'
              }`}>
                <span>Total Operating Expenses</span>
                <span className={isLight ? 'text-rose-600' : 'text-red-400'}>
                  -{formatCurrency(pnlReport.totalOperatingExpenses)}
                </span>
              </div>
            </div>

            {/* Bottom Line Net Operating Profit */}
            <div
              className={`p-4 rounded-xl border flex justify-between items-center font-sans ${
                isLight
                  ? 'bg-emerald-50/70 border-emerald-200 text-gray-900'
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
                {formatCurrency(pnlReport.netProfit)}
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
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Automated Balance Sheet (Statement of Financial Position)
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
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
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-stone-800/40 border-stone-700'
            }`}>
              <div className="flex justify-between items-center border-b pb-2 border-gray-200 dark:border-stone-700">
                <h4 className="font-bold uppercase tracking-wider text-xs text-[#0F4C3A] dark:text-emerald-400">
                  Total Assets
                </h4>
                <span className="font-bold text-sm text-[#0F4C3A] dark:text-emerald-400">
                  {formatIDR(balanceSheet.assets.totalAssets)}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-stone-200'}`}>Current Assets</span>
                {balanceSheet.assets.currentAssets.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-stone-700/60">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-stone-200'}`}>Non-Current Fixed Assets</span>
                {balanceSheet.assets.nonCurrentAssets.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className={`p-5 rounded-xl border space-y-4 ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-stone-800/40 border-stone-700'
            }`}>
              <div className="flex justify-between items-center border-b pb-2 border-gray-200 dark:border-stone-700">
                <h4 className="font-bold uppercase tracking-wider text-xs text-blue-600 dark:text-blue-400">
                  Liabilities &amp; Equity
                </h4>
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                  {formatIDR(balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-stone-200'}`}>Current Liabilities</span>
                {balanceSheet.liabilities.currentLiabilities.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-stone-700/60">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-stone-200'}`}>Shareholders' Equity</span>
                {balanceSheet.equity.equityItems.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
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
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Cash Flow Statement
            </h3>
            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
              Operating, Investing, and Financing Cash Movements • {cashFlow.period}
            </p>
          </div>

          <div className="p-6 space-y-5 font-mono text-xs">
            <div className="space-y-1.5">
              <div className={`flex justify-between font-bold uppercase pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>Cash Flows from Operating Activities</span>
                <span className="text-[#0F4C3A] dark:text-emerald-400">{formatIDR(cashFlow.netOperatingCash)}</span>
              </div>
              {cashFlow.operatingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                  <span>{act.category}</span>
                  <span className={act.amount < 0 ? (isLight ? 'text-rose-600' : 'text-red-400') : (isLight ? 'text-emerald-600' : 'text-emerald-400')}>
                    {act.amount < 0 ? `-${formatIDR(Math.abs(act.amount))}` : formatIDR(act.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <div className={`flex justify-between font-bold uppercase pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-stone-700 text-stone-200'
              }`}>
                <span>Cash Flows from Investing Activities</span>
                <span className="text-blue-600 dark:text-blue-400">{formatIDR(cashFlow.netInvestingCash)}</span>
              </div>
              {cashFlow.investingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
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
                  ? 'bg-white border-gray-200 shadow-xs text-gray-900'
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
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                    <ReceiptText className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                    General Ledger (GL) Immutable Journal Vouchers
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                    GAAP/IFRS Immutability Enforced
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
                  Double-entry accounting records with audit-grade immutability. Hard deletes are strictly disabled; corrections are made via counter-entries.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={glSearch}
                    onChange={(e) => setGlSearch(e.target.value)}
                    placeholder="Search voucher or description..."
                    className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] w-56 ${
                      isLight
                        ? 'bg-white border-gray-300 text-gray-900'
                        : 'bg-stone-800 border-stone-700 text-white'
                    }`}
                  />
                </div>

                <select
                  value={glRefFilter}
                  onChange={(e) => setGlRefFilter(e.target.value)}
                  className={`px-2.5 py-1.5 text-xs rounded-xl border font-semibold ${
                    isLight
                      ? 'bg-white border-gray-200 text-gray-800 focus:border-[#0F4C3A]'
                      : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                >
                  <option value="ALL">All Ref Types</option>
                  <option value="QRIS_SALE">QRIS Sales</option>
                  <option value="PURCHASE_ORDER">PO Accrual</option>
                  <option value="PARTIAL_GR">Goods Receipt</option>
                  <option value="INVENTORY_ADJUSTMENT">Stock Adjustments</option>
                  <option value="WASTE_SHRINKAGE">Waste Shrinkage</option>
                  <option value="REVERSING_ENTRY">Reversing Counter-Entries</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-stone-800 bg-stone-800/50 text-stone-400'
                }`}>
                  <th className="py-3 px-4">Entry ID</th>
                  <th className="py-3 px-4">Date / Outlet</th>
                  <th className="py-3 px-4">Account Code &amp; Name</th>
                  <th className="py-3 px-4 text-right">Debit</th>
                  <th className="py-3 px-4 text-right">Credit</th>
                  <th className="py-3 px-4">Ref Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Audit Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-stone-800'}`}>
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`py-8 text-center text-xs font-sans ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                      No general ledger entries matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        entry.isReversal
                          ? isLight
                            ? 'bg-purple-50/50 hover:bg-purple-50/80'
                            : 'bg-purple-950/20 hover:bg-purple-950/30'
                          : entry.isReversed
                          ? isLight
                            ? 'bg-gray-100/50 opacity-75'
                            : 'bg-stone-900/50 opacity-75'
                          : isLight
                          ? 'hover:bg-gray-50/80'
                          : 'hover:bg-stone-800/40'
                      }`}
                    >
                      <td className="py-3 px-4 font-bold">
                        <span className={entry.isReversal ? 'text-purple-600 dark:text-purple-400' : 'text-[#0F4C3A] dark:text-emerald-400'}>
                          {entry.id}
                        </span>
                        {entry.isReversal && (
                          <div className="text-[9px] font-sans text-purple-600 dark:text-purple-400 font-semibold">
                            Reverses #{entry.reversesVoucherId}
                          </div>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-[11px] font-sans ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                        <div>{entry.timestamp.split('T')[0]}</div>
                        <span className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                          {entry.storeName || 'Senopati'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`font-mono font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                          {entry.accountCode}
                        </span>
                        <div className={`text-[11px] ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
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
                          entry.referenceType === 'REVERSING_ENTRY'
                            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                            : isLight
                            ? 'bg-gray-100 text-gray-700 border-gray-200'
                            : 'bg-stone-800 text-stone-300 border-stone-700'
                        }`}>
                          {entry.referenceType}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-[11px] font-sans max-w-xs truncate ${isLight ? 'text-gray-600' : 'text-stone-300'}`}>
                        {entry.description}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        {entry.isReversed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Reversed
                          </span>
                        ) : entry.isReversal ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                            Counter-Voucher
                          </span>
                        ) : (
                          <button
                            onClick={() => setReversingEntry(entry)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                              isLight
                                ? 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700 shadow-2xs'
                                : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-300'
                            }`}
                            title="Generate an audit-certified reversing counter-entry to correct this voucher"
                          >
                            Reverse Entry
                          </button>
                        )}
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
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-stone-800 bg-stone-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                  <Building2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  Chart of Accounts (COA) Structure
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'} mt-0.5`}>
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
                        ? 'text-gray-600 hover:bg-gray-100'
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
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-stone-800 bg-stone-800/50 text-stone-400'
                }`}>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4 font-sans">Account Title</th>
                  <th className="py-3 px-4 font-sans">Category</th>
                  <th className="py-3 px-4">Normal Balance</th>
                  <th className="py-3 px-4 font-sans">Reporting Hub</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-stone-800'}`}>
                {filteredCOA.map((acc) => (
                  <tr
                    key={`${acc.storeId}-${acc.accountCode}`}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-gray-50/80' : 'hover:bg-stone-800/40'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {acc.accountCode}
                    </td>
                    <td className={`py-3.5 px-4 font-sans font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
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
                    <td className={`py-3.5 px-4 ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                      {acc.normalBalance}
                    </td>
                    <td className={`py-3.5 px-4 font-sans ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                      {acc.storeId}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                      {formatIDR(acc.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: POST REVERSING JOURNAL ENTRY */}
      {reversingEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-stone-900 border-stone-700 text-white'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-stone-800'}`}>
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Post Reversing Journal Voucher
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  Immutable GAAP Counter-Entry for #{reversingEntry.id}
                </p>
              </div>
              <button
                onClick={() => setReversingEntry(null)}
                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-stone-800 transition-colors ${
                  isLight ? 'text-gray-500' : 'text-stone-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`p-3 rounded-xl border text-xs space-y-1 ${
              isLight ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
            }`}>
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Immutable Audit Trail Protection
              </div>
              <p className="text-[11px] leading-relaxed">
                Under financial regulations, original voucher <strong>#{reversingEntry.id}</strong> will remain permanently logged. This counter-entry flips its debit and credit amounts to reconcile the ledger.
              </p>
            </div>

            <div className={`p-3 rounded-xl border text-xs space-y-1.5 font-mono ${
              isLight ? 'bg-white border-gray-200 text-gray-800 shadow-2xs' : 'bg-stone-800 border-stone-700 text-stone-200'
            }`}>
              <div className="flex justify-between">
                <span className="font-sans text-gray-500">Account:</span>
                <span className="font-bold">{reversingEntry.accountCode} - {reversingEntry.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-gray-500">Original Debit / Credit:</span>
                <span>Debit {formatIDR(reversingEntry.debit)} • Credit {formatIDR(reversingEntry.credit)}</span>
              </div>
              <div className="flex justify-between text-purple-600 dark:text-purple-400 font-bold border-t pt-1 border-gray-200 dark:border-stone-700">
                <span className="font-sans">Counter-Entry Will Post:</span>
                <span>Debit {formatIDR(reversingEntry.credit)} • Credit {formatIDR(reversingEntry.debit)}</span>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-stone-300'}`}>
                Reason for Reversal / Counter-Entry (Required)
              </label>
              <input
                type="text"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Supplier invoice mismatch / Audit variance reconciliation"
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-stone-800 border-stone-700 text-white'
                }`}
              />
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-gray-200' : 'border-stone-800'}`}>
              <button
                onClick={() => setReversingEntry(null)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                }`}
              >
                Abort
              </button>
              <button
                onClick={handlePostReversal}
                disabled={isSubmittingReversal || !reversalReason.trim()}
                className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmittingReversal ? 'Posting Counter-Entry...' : 'Post Reversing Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

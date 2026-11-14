import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type {
  ChartOfAccount,
  GeneralLedgerEntry,
  ProfitAndLossReport,
  BalanceSheetReport,
  CashFlowStatementReport,
  SupportedCurrency,
  VendorBill,
  PurchaseOrder,
  GoodsReceiptRecord,
  B2BCustomer,
  GiroPaymentRecord,
  EnterpriseSettingsConfig,
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
  FileCheck,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  X,
  Globe2,
  CreditCard,
  Ban,
  Clock,
  ShieldAlert,
  UserCheck,
  RotateCcw,
  FileCode2,
  Printer,
  PieChart,
  BarChart3,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { VendorBillModule } from './VendorBillModule';
import { ComplianceAccountingPanels } from './ComplianceAccountingPanels';
import { AnalyticMarginModule } from './AnalyticMarginModule';
import { usePrint } from '../../context/PrintContext';
import type { AccountingSubTab } from './AdminSidebar';

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
  vendorBills?: VendorBill[];
  purchaseOrders?: PurchaseOrder[];
  goodsReceipts?: GoodsReceiptRecord[];
  enterpriseSettings?: EnterpriseSettingsConfig | null;
  onRefreshData: () => void;
  onShowToast: (title: string, message: string) => void;
  activeSubTab?: AccountingSubTab;
  onSubTabChange?: (subTab: AccountingSubTab) => void;
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
  vendorBills = [],
  purchaseOrders = [],
  goodsReceipts = [],
  enterpriseSettings,
  onRefreshData,
  onShowToast,
  activeSubTab,
  onSubTabChange,
}) => {
  const isLight = theme === 'light';
  const { triggerPrint } = usePrint();

  // Multi-Currency Selection (Module 4)
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>('IDR');

  const formatCurrency = (amountIDR: number) => {
    if (selectedCurrency === 'IDR') return formatIDR(amountIDR);
    const info = FX_RATES[selectedCurrency];
    const converted = amountIDR / info.rate;
    return `${info.symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Sub-tabs (controlled or internal) + additive Indonesian Compliance Views
  const [internalSubTab, setInternalSubTab] = useState<AccountingSubTab>('pnl');
  const [complianceSubView, setComplianceSubView] = useState<'rma_rtv' | 'coretax_djp' | null>(null);
  const subTab = activeSubTab !== undefined ? activeSubTab : internalSubTab;

  useEffect(() => {
    if (activeSubTab !== undefined) {
      setComplianceSubView(null);
    }
  }, [activeSubTab]);

  const setSubTab = (val: AccountingSubTab) => {
    setComplianceSubView(null);
    setInternalSubTab(val);
    if (onSubTabChange) onSubTabChange(val);
  };
  const [glSearch, setGlSearch] = useState<string>('');
  const [glRefFilter, setGlRefFilter] = useState<string>('ALL');
  const [coaCategoryFilter, setCoaCategoryFilter] = useState<string>('ALL');

  // B2B Accounts Receivable & Bilyet Giro State
  const [b2bCustomers, setB2bCustomers] = useState<B2BCustomer[]>([]);
  const [giroRecords, setGiroRecords] = useState<GiroPaymentRecord[]>([]);
  const [isProcessingGiro, setIsProcessingGiro] = useState<boolean>(false);
  const [bouncedReasonPrompt, setBouncedReasonPrompt] = useState<string>('Saldo giro tidak mencukupi (SKNBI Tolakan)');

  const loadB2bAccountingData = async () => {
    try {
      const [custs, giros] = await Promise.all([
        apiClient.getB2BCustomers(),
        apiClient.getGiroRecords(),
      ]);
      setB2bCustomers(custs);
      setGiroRecords(giros);
    } catch (err) {
      console.error('Failed to load B2B accounting data:', err);
    }
  };

  useEffect(() => {
    loadB2bAccountingData();
  }, []);

  const handleClearGiro = async (giroId: string) => {
    setIsProcessingGiro(true);
    try {
      const res = await apiClient.clearGiro(giroId);
      onShowToast('Bilyet Giro Cleared', res.message);
      await loadB2bAccountingData();
      onRefreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Giro Action Error', msg);
    } finally {
      setIsProcessingGiro(false);
    }
  };

  const handleBounceGiro = async (giroId: string) => {
    setIsProcessingGiro(true);
    try {
      const res = await apiClient.bounceGiro(giroId, bouncedReasonPrompt);
      onShowToast(
        'Giro Marked as BOUNCED',
        `Giro marked as dishonored. AR debt re-opened, Rp 150.000 penalty assessed, and customer ${res.customer.companyName} credit FROZEN.`
      );
      await loadB2bAccountingData();
      onRefreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Giro Action Error', msg);
    } finally {
      setIsProcessingGiro(false);
    }
  };

  const handleToggleCustomerLock = async (customer: B2BCustomer) => {
    const nextStatus = customer.status === 'CREDIT_LOCKED' ? 'ACTIVE' : 'CREDIT_LOCKED';
    const lockReason =
      nextStatus === 'CREDIT_LOCKED'
        ? 'Manual credit freeze imposed by Financial Controller.'
        : undefined;
    try {
      const updated = await apiClient.updateB2BCustomer(customer.id, {
        status: nextStatus,
        lockReason,
      });
      onShowToast(
        `Customer Credit ${nextStatus === 'ACTIVE' ? 'Restored' : 'Locked'}`,
        `${updated.companyName} credit status set to ${nextStatus}`
      );
      await loadB2bAccountingData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Failed to update credit', msg);
    }
  };

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Reversal Failed', msg);
    } finally {
      setIsSubmittingReversal(false);
    }
  };

  // Filtered GL entries
  const filteredLedger = useMemo(() => {
    return ledgerEntries.filter((entry) => {
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
  }, [ledgerEntries, selectedStore, glRefFilter, glSearch]);

  // Filtered COA
  const filteredCOA = useMemo(() => {
    return chartOfAccounts.filter((acc) => {
      if (selectedStore !== 'CONSOLIDATED' && acc.storeId && acc.storeId !== selectedStore && acc.storeId !== 'GLOBAL') {
        return false;
      }
      if (coaCategoryFilter !== 'ALL' && acc.category !== coaCategoryFilter) return false;
      return true;
    });
  }, [chartOfAccounts, selectedStore, coaCategoryFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Store Segregation Control */}
      <div
        className={`p-4 sm:p-6 rounded-2xl border transition-all ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-zinc-900/90 border-zinc-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide">
                Double-Entry Accounting
              </span>
              <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
                Indonesian Retail Multi-Store COA Standards
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Financial Statements &amp; Store-Tagged General Ledger
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
              Segregated Chart of Accounts (COA) per physical store hub with automated real-time postings for
              QRIS checkouts, PO/GR supplier liabilities, and waste shrinkage expenses.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Store Hub Filter */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
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
                    : 'bg-zinc-800 border-zinc-700 text-white'
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

            {!complianceSubView && (
              <button
                type="button"
                onClick={() =>
                  triggerPrint({
                    type: 'accounting_statement',
                    format: 'a4',
                    subTab,
                    selectedStore,
                    selectedCurrency,
                    fxRate: FX_RATES[selectedCurrency].rate,
                    fxSymbol: FX_RATES[selectedCurrency].symbol,
                    pnlReport,
                    balanceSheet,
                    cashFlow,
                    filteredLedger,
                    filteredCOA,
                    b2bCustomers,
                    giroRecords,
                    vendorBills,
                  })
                }
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                }`}
                title="Print Financial Statement (A4)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Statement</span>
              </button>
            )}

            <button
              onClick={onRefreshData}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                isLight
                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none mt-6 pt-4 border-t border-gray-200 dark:border-zinc-800">
          {[
            { id: 'pnl', label: 'Profit & Loss (P&L)', icon: TrendingUp },
            { id: 'balance_sheet', label: 'Balance Sheet', icon: Scale },
            { id: 'cash_flow', label: 'Cash Flow Statement', icon: DollarSign },
            { id: 'gl', label: 'General Ledger Drill-Down', icon: ReceiptText },
            { id: 'coa', label: 'Chart of Accounts (COA)', icon: Building2 },
            { id: 'vendor_bills', label: 'Vendor Bills & AP', icon: FileCheck },
            { id: 'b2b_ar', label: 'B2B AR & Giro Clearing', icon: CreditCard },
            { id: 'analytic_budgets', label: 'Analytic Budgets', icon: PieChart },
            { id: 'margin_analysis', label: 'Margin Analysis', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = !complianceSubView && subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  active
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setComplianceSubView('rma_rtv')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              complianceSubView === 'rma_rtv'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Returns &amp; Nota Retur
          </button>
          <button
            type="button"
            onClick={() => setComplianceSubView('coretax_djp')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              complianceSubView === 'coretax_djp'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            e-Faktur &amp; Coretax DJP
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PROFIT & LOSS STATEMENT */}
      {!complianceSubView && subTab === 'pnl' && pnlReport && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Income Statement (Profit &amp; Loss)
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
                  Reporting Scope: <strong className="text-[#0F4C3A] dark:text-emerald-400">{pnlReport.storeName || 'Consolidated'}</strong> • Period: {pnlReport.period}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Multi-Currency Selector (Module 4) */}
                <div className={`flex items-center gap-1 p-1 rounded-xl border ${isLight ? 'bg-white border-gray-200' : 'bg-zinc-800 border-zinc-700'}`}>
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
                          : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>

                <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-zinc-800 border-zinc-700'}`}>
                  <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>Gross Margin:</span>
                  <span className="ml-1.5 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400 text-xs">
                    {pnlReport.grossMarginPercent}%
                  </span>
                </div>
                <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-zinc-800 border-zinc-700'}`}>
                  <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>Net Margin:</span>
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
                isLight ? 'border-gray-200 text-gray-800' : 'border-zinc-700 text-zinc-200'
              }`}>
                <span>1. Operating Sales Revenue</span>
                <span>Amount ({selectedCurrency})</span>
              </div>
              <div className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                <span>Gross Customer QRIS Checkout Revenue</span>
                <span className={`font-semibold ${isLight ? 'text-gray-900' : 'text-zinc-100'}`}>
                  {formatCurrency(pnlReport.grossSalesRevenue)}
                </span>
              </div>
              <div className="flex justify-between pl-4 text-amber-600 dark:text-amber-400">
                <span>Less: Customer Loyalty Points &amp; Vouchers</span>
                <span>-{formatCurrency(pnlReport.discountsGiven)}</span>
              </div>
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t ${
                isLight ? 'border-gray-200 text-gray-900' : 'border-zinc-800 text-white'
              }`}>
                <span>Net Sales Revenue</span>
                <span className="text-[#0F4C3A] dark:text-emerald-400">{formatCurrency(pnlReport.netSalesRevenue)}</span>
              </div>
            </div>

            {/* 2. Cost of Goods Sold */}
            <div className="space-y-2 pt-2">
              <div className={`flex justify-between font-bold uppercase text-[11px] pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-zinc-700 text-zinc-200'
              }`}>
                <span>2. Cost of Goods Sold (COGS - Weighted Average Valuation)</span>
                <span>Amount ({selectedCurrency})</span>
              </div>
              <div className={`flex justify-between pl-4 ${isLight ? 'text-rose-600' : 'text-red-400'}`}>
                <span>Direct Organic Farm Acquisition &amp; Butchery Costs</span>
                <span>-{formatCurrency(pnlReport.costOfGoodsSold)}</span>
              </div>
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t text-sm ${
                isLight ? 'border-gray-200 text-[#0F4C3A]' : 'border-zinc-800 text-emerald-400'
              }`}>
                <span>Gross Profit ({pnlReport.grossMarginPercent}% gross margin)</span>
                <span>{formatCurrency(pnlReport.grossProfit)}</span>
              </div>
            </div>

            {/* 3. Operating & Cold-Chain Expenses (OPEX) */}
            <div className="space-y-2 pt-2">
              <div className={`flex justify-between font-bold uppercase text-[11px] pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-zinc-700 text-zinc-200'
              }`}>
                <span>3. Operating &amp; Cold-Chain Expenses (OPEX)</span>
                <span>Amount ({selectedCurrency})</span>
              </div>
              {pnlReport.operatingExpenses.map((exp, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                  <span>{exp.category}</span>
                  <span className={isLight ? 'text-rose-600' : 'text-red-400'}>
                    -{formatCurrency(exp.amount)}
                  </span>
                </div>
              ))}
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t ${
                isLight ? 'border-gray-200 text-gray-900' : 'border-zinc-800 text-zinc-200'
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
      {!complianceSubView && subTab === 'balance_sheet' && balanceSheet && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Automated Balance Sheet (Statement of Financial Position)
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
                  Period: {balanceSheet.period} • Enterprise Multi-Store Consolidated Matrix
                </p>
              </div>

              <div>
                {balanceSheet.isBalanced ? (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Balanced: Assets = Liabilities + Equity
                  </span>
                ) : (
                  <span className="inline-flex items-center whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                    Discrepancy Detected
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            {/* ASSETS */}
            <div className={`p-5 rounded-xl border space-y-4 ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-zinc-800/40 border-zinc-700'
            }`}>
              <div className="flex justify-between items-center border-b pb-2 border-gray-200 dark:border-zinc-700">
                <h4 className="font-bold uppercase tracking-wider text-xs text-[#0F4C3A] dark:text-emerald-400">
                  Total Assets
                </h4>
                <span className="font-bold text-sm text-[#0F4C3A] dark:text-emerald-400">
                  {formatIDR(balanceSheet.assets.totalAssets)}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-zinc-200'}`}>Current Assets</span>
                {balanceSheet.assets.currentAssets.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-zinc-700/60">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-zinc-200'}`}>Non-Current Fixed Assets</span>
                {balanceSheet.assets.nonCurrentAssets.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className={`p-5 rounded-xl border space-y-4 ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-zinc-800/40 border-zinc-700'
            }`}>
              <div className="flex justify-between items-center border-b pb-2 border-gray-200 dark:border-zinc-700">
                <h4 className="font-bold uppercase tracking-wider text-xs text-blue-600 dark:text-blue-400">
                  Liabilities &amp; Equity
                </h4>
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                  {formatIDR(balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-zinc-200'}`}>Current Liabilities</span>
                {balanceSheet.liabilities.currentLiabilities.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-zinc-700/60">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-zinc-200'}`}>Shareholders' Equity</span>
                {balanceSheet.equity.equityItems.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
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
      {!complianceSubView && subTab === 'cash_flow' && cashFlow && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Cash Flow Statement
            </h3>
            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
              Operating, Investing, and Financing Cash Movements • {cashFlow.period}
            </p>
          </div>

          <div className="p-6 space-y-5 font-mono text-xs">
            <div className="space-y-1.5">
              <div className={`flex justify-between font-bold uppercase pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-zinc-700 text-zinc-200'
              }`}>
                <span>Cash Flows from Operating Activities</span>
                <span className="text-[#0F4C3A] dark:text-emerald-400">{formatIDR(cashFlow.netOperatingCash)}</span>
              </div>
              {cashFlow.operatingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                  <span>{act.category}</span>
                  <span className={act.amount < 0 ? (isLight ? 'text-rose-600' : 'text-red-400') : (isLight ? 'text-emerald-600' : 'text-emerald-400')}>
                    {act.amount < 0 ? `-${formatIDR(Math.abs(act.amount))}` : formatIDR(act.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <div className={`flex justify-between font-bold uppercase pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-zinc-700 text-zinc-200'
              }`}>
                <span>Cash Flows from Investing Activities</span>
                <span className="text-blue-600 dark:text-blue-400">{formatIDR(cashFlow.netInvestingCash)}</span>
              </div>
              {cashFlow.investingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
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
                  : 'bg-zinc-900 border-zinc-700 text-white'
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
      {!complianceSubView && subTab === 'gl' && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                    <ReceiptText className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                    General Ledger (GL) Immutable Journal Vouchers
                  </h3>
                  <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                    GAAP/IFRS Immutability Enforced
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
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
                        : 'bg-zinc-800 border-zinc-700 text-white'
                    }`}
                  />
                </div>

                <select
                  value={glRefFilter}
                  onChange={(e) => setGlRefFilter(e.target.value)}
                  className={`px-2.5 py-1.5 text-xs rounded-xl border font-semibold ${
                    isLight
                      ? 'bg-white border-gray-200 text-gray-800 focus:border-[#0F4C3A]'
                      : 'bg-zinc-800 border-zinc-700 text-white'
                  }`}
                >
                  <option value="ALL">All Ref Types</option>
                  <option value="QRIS_SALE">QRIS Sales</option>
                  <option value="PURCHASE_ORDER">PO Accrual</option>
                  <option value="PARTIAL_GR">Goods Receipt</option>
                  <option value="VENDOR_BILL">Vendor Bills (AP)</option>
                  <option value="VENDOR_PAYMENT">Vendor Payments (Disbursement)</option>
                  <option value="LANDED_COST">Landed Cost Absorption</option>
                  <option value="B2B_WHOLESALE_ORDER">B2B Wholesale Orders</option>
                  <option value="GIRO_CLEARING">Bilyet Giro Clearing</option>
                  <option value="GIRO_BOUNCED">Dishonored Giro / Penalty</option>
                  <option value="PURCHASE_AP">Purchase AP</option>
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
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
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
              <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-zinc-800'}`}>
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`py-8 text-center text-xs font-sans ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
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
                            : 'bg-zinc-900/50 opacity-75'
                          : isLight
                          ? 'hover:bg-gray-50/80'
                          : 'hover:bg-zinc-800/40'
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
                      <td className={`py-3 px-4 text-[11px] font-sans ${isLight ? 'text-gray-700' : 'text-zinc-300'}`}>
                        <div>{entry.timestamp.split('T')[0]}</div>
                        <span className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
                          {entry.storeName || 'Senopati'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`font-mono font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                          {entry.accountCode}
                        </span>
                        <div className={`text-[11px] ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                          {entry.accountName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {entry.debit > 0 ? formatIDR(entry.debit) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {entry.credit > 0 ? formatIDR(entry.credit) : '-'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center whitespace-nowrap text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                          entry.referenceType === 'REVERSING_ENTRY'
                            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                            : isLight
                            ? 'bg-gray-100 text-gray-700 border-gray-200'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}>
                          {entry.referenceType}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-[11px] font-sans max-w-xs truncate ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                        {entry.description}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        {entry.isReversed ? (
                          <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Reversed
                          </span>
                        ) : entry.isReversal ? (
                          <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                            Counter-Voucher
                          </span>
                        ) : (
                          <button
                            onClick={() => setReversingEntry(entry)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                              isLight
                                ? 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700 shadow-2xs'
                                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300'
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
      {!complianceSubView && subTab === 'coa' && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'} flex items-center gap-2`}>
                  <Building2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  Chart of Accounts (COA) Structure
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'} mt-0.5`}>
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
                        : 'text-zinc-400 hover:bg-zinc-800'
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
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
                }`}>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4 font-sans">Account Title</th>
                  <th className="py-3 px-4 font-sans">Category</th>
                  <th className="py-3 px-4">Normal Balance</th>
                  <th className="py-3 px-4 font-sans">Reporting Hub</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-zinc-800'}`}>
                {filteredCOA.map((acc) => (
                  <tr
                    key={`${acc.storeId}-${acc.accountCode}`}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-gray-50/80' : 'hover:bg-zinc-800/40'
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
                    <td className={`py-3.5 px-4 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                      {acc.normalBalance}
                    </td>
                    <td className={`py-3.5 px-4 font-sans ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
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

      {/* SUB-TAB 6: VENDOR BILLS & ACCOUNTS PAYABLE (3-WAY MATCHING) */}
      {!complianceSubView && subTab === 'vendor_bills' && (
        <VendorBillModule
          theme={theme}
          selectedStore={selectedStore}
          vendorBills={vendorBills}
          purchaseOrders={purchaseOrders}
          goodsReceipts={goodsReceipts}
          onRefreshData={onRefreshData}
          onShowToast={onShowToast}
        />
      )}

      {/* SUB-TAB 7: B2B WHOLESALE RECEIVABLES (AR) & BILYET GIRO CLEARING */}
      {!complianceSubView && subTab === 'b2b_ar' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-zinc-900 border-zinc-800'}`}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
                <span>Total Wholesale AR (COA #1200)</span>
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-gray-900 dark:text-zinc-100">
                {formatIDR(b2bCustomers.reduce((sum, c) => sum + (c.outstandingAR || 0), 0))}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">Trade credit receivables from B2B buyers</span>
            </div>

            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-zinc-900 border-zinc-800'}`}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
                <span>Warkat Giro Belum Cair (#1210)</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Building2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {formatIDR(
                  giroRecords
                    .filter((g) => g.status === 'PENDING_CLEARING')
                    .reduce((sum, g) => sum + g.amountIDR, 0)
                )}
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block">
                {giroRecords.filter((g) => g.status === 'PENDING_CLEARING').length} Warkat awaiting bank clearing
              </span>
            </div>

            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-zinc-900 border-zinc-800'}`}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
                <span>Overdue AR (&gt;7 Days Alert)</span>
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {formatIDR(
                  b2bCustomers
                    .filter((c) => c.overdueDaysMax > 0)
                    .reduce((sum, c) => sum + (c.outstandingAR || 0), 0)
                )}
              </div>
              <span className="text-[10px] text-rose-500 mt-1 block">
                {b2bCustomers.filter((c) => c.status === 'CREDIT_LOCKED').length} Customers with frozen credit
              </span>
            </div>

            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-zinc-900 border-zinc-800'}`}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
                <span>Denda Tolakan Kliring (#4090)</span>
                <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <ShieldAlert className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-purple-700 dark:text-purple-400">
                {formatIDR(450000)}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">
                Rp 150.000 / bounced check penalty fee
              </span>
            </div>
          </div>

          {/* Table 1: Accounts Receivable Aging & Customer Limits */}
          <div className={`p-5 sm:p-6 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-zinc-900 border-zinc-800'} space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Wholesale Accounts Receivable Aging Matrix &amp; Plafond</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  B2B customer credit limit monitoring, AR aging buckets, and auto-freeze enforcement
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                {b2bCustomers.length} Wholesale Accounts
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-zinc-800/60 uppercase text-[10px] font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-3.5">Customer &amp; Tier</th>
                    <th className="py-3 px-3.5">Credit Plafond</th>
                    <th className="py-3 px-3.5">Total AR Due</th>
                    <th className="py-3 px-3.5">Current (0-30d)</th>
                    <th className="py-3 px-3.5">31 - 60 Days</th>
                    <th className="py-3 px-3.5">&gt; 60 Days (Critical)</th>
                    <th className="py-3 px-3.5">Facility Status</th>
                    <th className="py-3 px-3.5 text-right">Controller Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 font-medium">
                  {b2bCustomers.map((cust) => {
                    const isLocked = cust.status === 'CREDIT_LOCKED';
                    return (
                      <tr key={cust.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-3.5">
                          <div className="font-bold text-gray-900 dark:text-zinc-100">{cust.companyName}</div>
                          <div className="text-[11px] text-gray-500 dark:text-zinc-400">{cust.name} ({cust.tierLabel})</div>
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-gray-700 dark:text-zinc-300">
                          {formatIDR(cust.creditLimit)}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono font-bold text-gray-900 dark:text-zinc-100">
                          {formatIDR(cust.outstandingAR)}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-emerald-600 dark:text-emerald-400">
                          {formatIDR(Math.max(0, cust.outstandingAR * 0.7))}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-amber-600 dark:text-amber-400">
                          {formatIDR(Math.max(0, cust.outstandingAR * 0.2))}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-rose-600 dark:text-rose-400">
                          {cust.overdueDaysMax > 0 ? formatIDR(cust.outstandingAR * 0.1) : 'Rp 0'}
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/25">
                              <ShieldAlert className="w-3 h-3" />
                              <span>CREDIT LOCKED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>GOOD STANDING</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleCustomerLock(cust)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                              isLocked
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25 dark:hover:bg-emerald-500/20'
                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25 dark:hover:bg-rose-500/20'
                            }`}
                          >
                            {isLocked ? 'Restore Facility' : 'Freeze Credit'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Bilyet Giro (PDC) Clearing & Bounce Management */}
          <div className={`p-5 sm:p-6 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-zinc-900 border-zinc-800'} space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Bilyet Giro (PDC) Clearing &amp; Dishonor / Bounce Management</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Warkat giro masuk, eksekusi kliring bank (COA #1020), atau proses tolak kliring dengan denda administratif
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                {giroRecords.length} Giro Registers
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-zinc-800/60 uppercase text-[10px] font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-3.5">Giro No &amp; Bank</th>
                    <th className="py-3 px-3.5">Customer / Drawer</th>
                    <th className="py-3 px-3.5">Order Ref</th>
                    <th className="py-3 px-3.5">Clearing Due Date</th>
                    <th className="py-3 px-3.5">Nominal (IDR)</th>
                    <th className="py-3 px-3.5">Clearing Status</th>
                    <th className="py-3 px-3.5 text-right">Controller Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 font-medium">
                  {giroRecords.map((giro) => (
                    <tr key={giro.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-3.5">
                        <div className="font-bold font-mono text-emerald-800 dark:text-emerald-400">{giro.giroNumber}</div>
                        <div className="text-[11px] text-gray-500 dark:text-zinc-400">{giro.issuingBank}</div>
                      </td>
                      <td className="py-3.5 px-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                        {giro.customerName}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-[11px] text-gray-500">
                        {giro.orderId}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="font-mono">{new Date(giro.clearingDueDate).toLocaleDateString()}</div>
                        <span className="text-[10px] text-gray-400">Jatuh Tempo Kliring</span>
                      </td>
                      <td className="py-3.5 px-3.5 font-mono font-bold text-gray-900 dark:text-zinc-100">
                        {formatIDR(giro.amountIDR)}
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        {giro.status === 'CLEARED' && (
                          <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25">
                            CLEARED (CAIR)
                          </span>
                        )}
                        {giro.status === 'BOUNCED' && (
                          <div>
                            <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/25">
                              BOUNCED (TOLAKAN)
                            </span>
                            <span className="text-[9px] text-rose-600 dark:text-rose-400 block mt-0.5">{giro.bounceReason}</span>
                          </div>
                        )}
                        {giro.status === 'PENDING_CLEARING' && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25">
                            <Clock className="w-3 h-3" />
                            <span>PENDING CLEARING</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3.5 text-right">
                        {giro.status === 'PENDING_CLEARING' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isProcessingGiro}
                              onClick={() => handleClearGiro(giro.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                              title="Clear Giro and deposit into Bank BCA #1020"
                            >
                              Mark Cleared
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingGiro}
                              onClick={() => handleBounceGiro(giro.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                              title="Dishonor Giro, assess penalty, and freeze customer credit"
                            >
                              Tolak Kliring
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-mono">Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 8 & 9: ANALYTIC BUDGETS & REAL-TIME MARGIN ANALYSIS */}
      {!complianceSubView && (subTab === 'analytic_budgets' || subTab === 'margin_analysis') && (
        <AnalyticMarginModule
          theme={theme}
          mode={subTab}
          enterpriseSettings={enterpriseSettings}
          onRefreshData={onRefreshData}
          onShowToast={onShowToast}
        />
      )}

      {/* ADDITIVE COMPLIANCE PANELS: RETURNS / NOTA RETUR & CORETAX DJP */}
      {complianceSubView && (
        <ComplianceAccountingPanels
          theme={theme}
          mode={complianceSubView}
          selectedStore={selectedStore}
          onRefreshData={onRefreshData}
          onShowToast={onShowToast}
        />
      )}

      {/* MODAL: POST REVERSING JOURNAL ENTRY */}
      {reversingEntry && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className={`border rounded-2xl w-full max-w-[95vw] sm:max-w-md p-4 sm:p-6 space-y-4 shadow-2xl my-auto ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-700 text-white'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-zinc-800'}`}>
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Post Reversing Journal Voucher
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
                  Immutable GAAP Counter-Entry for #{reversingEntry.id}
                </p>
              </div>
              <button
                onClick={() => setReversingEntry(null)}
                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${
                  isLight ? 'text-gray-500' : 'text-zinc-300'
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
              isLight ? 'bg-white border-gray-200 text-gray-800 shadow-2xs' : 'bg-zinc-800 border-zinc-700 text-zinc-200'
            }`}>
              <div className="flex justify-between">
                <span className="font-sans text-gray-500">Account:</span>
                <span className="font-bold">{reversingEntry.accountCode} - {reversingEntry.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-gray-500">Original Debit / Credit:</span>
                <span>Debit {formatIDR(reversingEntry.debit)} • Credit {formatIDR(reversingEntry.credit)}</span>
              </div>
              <div className="flex justify-between text-purple-600 dark:text-purple-400 font-bold border-t pt-1 border-gray-200 dark:border-zinc-700">
                <span className="font-sans">Counter-Entry Will Post:</span>
                <span>Debit {formatIDR(reversingEntry.credit)} • Credit {formatIDR(reversingEntry.debit)}</span>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-zinc-300'}`}>
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
                    : 'bg-zinc-800 border-zinc-700 text-white'
                }`}
              />
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-gray-200' : 'border-zinc-800'}`}>
              <button
                onClick={() => setReversingEntry(null)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
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
        </div>,
        document.body
      )}
    </div>
  );
};

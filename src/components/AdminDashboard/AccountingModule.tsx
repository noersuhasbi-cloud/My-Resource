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
  StaffShiftSession,
  SettlementReconcileResponse,
  ExecutiveFinancialHealthSummary,
  BankMutationCsvReconcileResponse,
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
  Handshake,
  Upload,
  FileSpreadsheet,
  Activity,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { VendorBillModule } from './VendorBillModule';
import { ComplianceAccountingPanels } from './ComplianceAccountingPanels';
import { AnalyticMarginModule } from './AnalyticMarginModule';
import { ConsignmentSettlementPanel } from './ConsignmentSettlementPanel';
import { usePrint } from '../../context/PrintContext';
import type { AccountingSubTab } from './AdminSidebar';
import { isBranchScopedRole, normalizeEnterpriseRole } from '../../utils/rbac';

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
  activeStaffSession?: StaffShiftSession | null;
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
  activeStaffSession,
}) => {
  const isLight = theme === 'light';
  const { triggerPrint } = usePrint();
  const canonicalRole = normalizeEnterpriseRole(activeStaffSession?.userRole);
  const canManageAccountingAndGiro = ['admin', 'coo', 'super_admin'].includes(canonicalRole);
  const isBranchLocked = isBranchScopedRole(canonicalRole);

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
  const [complianceSubView, setComplianceSubView] = useState<'rma_rtv' | 'coretax_djp' | 'settlement_giro' | 'executive_health' | null>(null);
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

  // QRIS/EDC Settlement & Standalone Post-Dated Bilyet Giro State
  const [settlementData, setSettlementData] = useState<SettlementReconcileResponse | null>(null);
  const [isLoadingSettlement, setIsLoadingSettlement] = useState<boolean>(false);
  const [settlementChannel, setSettlementChannel] = useState<'QRIS' | 'EDC'>('QRIS');
  const [selectedTenderIds, setSelectedTenderIds] = useState<string[]>([]);
  const [settlementGrossOverride, setSettlementGrossOverride] = useState<number>(100000);
  const [settlementMdrPercent, setSettlementMdrPercent] = useState<number>(0.7);
  const [settlementDestCode, setSettlementDestCode] = useState<'1020' | '1010'>('1020');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [isPostingSettlement, setIsPostingSettlement] = useState<boolean>(false);

  const [giroDirection, setGiroDirection] = useState<'INCOMING' | 'OUTGOING'>('INCOMING');
  const [giroCounterparty, setGiroCounterparty] = useState<string>('');
  const [giroNumber, setGiroNumber] = useState<string>('');
  const [giroBank, setGiroBank] = useState<string>('Bank BCA');
  const [giroAmount, setGiroAmount] = useState<number>(15000000);
  const [giroDueDate, setGiroDueDate] = useState<string>(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [giroRef, setGiroRef] = useState<string>('');
  const [isCreatingGiro, setIsCreatingGiro] = useState<boolean>(false);

  // Executive Financial Health Summary & Bank Mutation CSV Reconcile State
  const [execSummary, setExecSummary] = useState<ExecutiveFinancialHealthSummary | null>(null);
  const [isLoadingExecSummary, setIsLoadingExecSummary] = useState<boolean>(false);
  const [bankCsvText, setBankCsvText] = useState<string>('');
  const [bankAccountCode, setBankAccountCode] = useState<'1020' | '1015' | '1010'>('1020');
  const [bankMatchResult, setBankMatchResult] = useState<BankMutationCsvReconcileResponse | null>(null);
  const [isMatchingBankCsv, setIsMatchingBankCsv] = useState<boolean>(false);

  const loadSettlementData = async () => {
    setIsLoadingSettlement(true);
    try {
      const res = await apiClient.getSettlementReconcile();
      setSettlementData(res);
    } catch {
      // ignore if restricted
    } finally {
      setIsLoadingSettlement(false);
    }
  };

  const canAccessAR =
    !activeStaffSession ||
    activeStaffSession.roleCode === 'SUPER_ADMIN' ||
    !activeStaffSession.modulePermissions ||
    (activeStaffSession.modulePermissions.accounting?.view === true &&
      activeStaffSession.modulePermissions.accounting?.canAccessAR === true);

  const loadB2bAccountingData = async () => {
    if (!canAccessAR) {
      setB2bCustomers([]);
      setGiroRecords([]);
      return;
    }
    try {
      const [custs, giros] = await Promise.all([
        apiClient.getB2BCustomers().catch(() => [] as B2BCustomer[]),
        apiClient.getGiroRecords().catch(() => [] as GiroPaymentRecord[]),
      ]);
      setB2bCustomers(Array.isArray(custs) ? custs : []);
      setGiroRecords(Array.isArray(giros) ? giros : []);
    } catch {
      setB2bCustomers([]);
      setGiroRecords([]);
    }
  };

  useEffect(() => {
    void loadB2bAccountingData();
  }, [canAccessAR]);

  const loadExecSummary = React.useCallback(async () => {
    setIsLoadingExecSummary(true);
    try {
      const res = await apiClient.getExecutiveAccountingSummary(selectedStore);
      setExecSummary(res);
    } catch {
      // silent fallback
    } finally {
      setIsLoadingExecSummary(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    if (complianceSubView === 'settlement_giro') {
      loadSettlementData();
      loadB2bAccountingData();
    } else if (complianceSubView === 'executive_health') {
      void loadExecSummary();
    }
  }, [complianceSubView, loadExecSummary]);

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
        res.customer?.companyName
          ? `Giro marked as dishonored. AR debt re-opened, Rp 150.000 penalty assessed, and customer ${res.customer.companyName} credit FROZEN.`
          : `Bilyet Giro #${res.giro?.giroNumber || giroId} marked as dishonored (Tolak Kliring). GL reversal entries posted cleanly.`
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

  // Immutability & Reversing Journal Entry State (Mandatory Audit Note Enforced)
  const [reversingEntry, setReversingEntry] = useState<GeneralLedgerEntry | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [isSubmittingReversal, setIsSubmittingReversal] = useState<boolean>(false);

  const handlePostReversal = async () => {
    if (!reversingEntry) return;
    if (reversalReason.trim().length < 5) {
      onShowToast(
        'Mandatory Audit Note Required',
        'Enter an explicit audit correction justification (minimum 5 characters).'
      );
      return;
    }
    setIsSubmittingReversal(true);
    try {
      const res = await apiClient.reverseGeneralLedgerEntry(reversingEntry.id, reversalReason.trim());
      onShowToast(
        'Reversing Counter-Entry Posted',
        `Reversing voucher #${res.reversingVoucher.id} posted. Original #${res.originalVoucher.id} marked as reversed.`
      );
      setReversingEntry(null);
      setReversalReason('');
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
        className={`p-4 sm:p-6 rounded-2xl border transition-all gm-hero-banner ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-[#12141C] border-slate-800/80'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide">
                Double-Entry Accounting
              </span>
              <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Indonesian Retail Multi-Store COA Standards
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
              Financial Statements &amp; Store-Tagged General Ledger
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isLight ? 'text-gray-600' : 'text-slate-400'}`}>
              Segregated Chart of Accounts (COA) per physical store hub with automated real-time postings for
              QRIS checkouts, PO/GR supplier liabilities, and waste shrinkage expenses.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Store Hub Filter */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                Entity:
              </span>
              <select
                value={selectedStore}
                disabled={isBranchLocked}
                onChange={(e) => {
                  onStoreChange(e.target.value);
                  onShowToast('Accounting Scope Changed', `Reporting scope set to ${e.target.value}`);
                }}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border focus:outline-none focus:border-[#0F4C3A] transition-all disabled:opacity-65 disabled:cursor-not-allowed ${
                  isLight
                    ? 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                    : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                }`}
              >
                {!isBranchLocked && (
                  <option value="CONSOLIDATED">Consolidated Company-Wide (All Outlets)</option>
                )}
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
                    : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
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
                  : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none mt-6 pt-4 border-t border-gray-200 dark:border-slate-800/80">
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
            { id: 'consignment', label: 'Consignment (Titip Jual)', icon: Handshake },
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
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
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
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
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
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Coretax e-Faktur &amp; PPh
          </button>
          <button
            type="button"
            onClick={() => setComplianceSubView('settlement_giro')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              complianceSubView === 'settlement_giro'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            QRIS/EDC Settlement &amp; Giro
          </button>
          <button
            type="button"
            onClick={() => setComplianceSubView('executive_health')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              complianceSubView === 'executive_health'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Financial Health Overview
          </button>
        </div>
      </div>

      <div key={complianceSubView || subTab} className="gm-tab-enter">
      {/* SUB-TAB 1: PROFIT & LOSS STATEMENT */}
      {!complianceSubView && subTab === 'pnl' && pnlReport && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  Income Statement (Profit &amp; Loss)
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                  Reporting Scope: <strong className="text-[#0F4C3A] dark:text-emerald-400">{pnlReport.storeName || 'Consolidated'}</strong> • Period: {pnlReport.period}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Multi-Currency Selector (Module 4) */}
                <div className={`flex items-center gap-1 p-1 rounded-xl border ${isLight ? 'bg-white border-gray-200' : 'bg-[#090A0F] border-slate-800/80'}`}>
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
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>

                <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-[#090A0F] border-slate-800/80'}`}>
                  <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Gross Margin:</span>
                  <span className="ml-1.5 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400 text-xs">
                    {pnlReport.grossMarginPercent}%
                  </span>
                </div>
                <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-[#090A0F] border-slate-800/80'}`}>
                  <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Net Margin:</span>
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
                isLight ? 'border-gray-200 text-gray-800' : 'border-slate-800/80 text-slate-200'
              }`}>
                <span>1. Operating Sales Revenue</span>
                <span>Amount ({selectedCurrency})</span>
              </div>
              <div className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                <span>Gross Customer QRIS Checkout Revenue</span>
                <span className={`font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  {formatCurrency(pnlReport.grossSalesRevenue)}
                </span>
              </div>
              <div className="flex justify-between pl-4 text-amber-600 dark:text-amber-400">
                <span>Less: Customer Loyalty Points &amp; Vouchers</span>
                <span>-{formatCurrency(pnlReport.discountsGiven)}</span>
              </div>
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t ${
                isLight ? 'border-gray-200 text-gray-900' : 'border-slate-800/80 text-slate-100'
              }`}>
                <span>Net Sales Revenue</span>
                <span className="text-[#0F4C3A] dark:text-emerald-400">{formatCurrency(pnlReport.netSalesRevenue)}</span>
              </div>
            </div>

            {/* 2. Cost of Goods Sold */}
            <div className="space-y-2 pt-2">
              <div className={`flex justify-between font-bold uppercase text-[11px] pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-slate-800/80 text-slate-200'
              }`}>
                <span>2. Cost of Goods Sold (COGS - Weighted Average Valuation)</span>
                <span>Amount ({selectedCurrency})</span>
              </div>
              <div className={`flex justify-between pl-4 ${isLight ? 'text-rose-600' : 'text-red-400'}`}>
                <span>Direct Organic Farm Acquisition &amp; Butchery Costs</span>
                <span>-{formatCurrency(pnlReport.costOfGoodsSold)}</span>
              </div>
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t text-sm ${
                isLight ? 'border-gray-200 text-[#0F4C3A]' : 'border-slate-800/80 text-emerald-400'
              }`}>
                <span>Gross Profit ({pnlReport.grossMarginPercent}% gross margin)</span>
                <span>{formatCurrency(pnlReport.grossProfit)}</span>
              </div>
            </div>

            {/* 3. Operating & Cold-Chain Expenses (OPEX) */}
            <div className="space-y-2 pt-2">
              <div className={`flex justify-between font-bold uppercase text-[11px] pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-slate-800/80 text-slate-200'
              }`}>
                <span>3. Operating &amp; Cold-Chain Expenses (OPEX)</span>
                <span>Amount ({selectedCurrency})</span>
              </div>
              {pnlReport.operatingExpenses.map((exp, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                  <span>{exp.category}</span>
                  <span className={isLight ? 'text-rose-600' : 'text-red-400'}>
                    -{formatCurrency(exp.amount)}
                  </span>
                </div>
              ))}
              <div className={`flex justify-between font-bold pl-4 pt-1.5 border-t ${
                isLight ? 'border-gray-200 text-gray-900' : 'border-slate-800/80 text-slate-200'
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
                  : 'bg-emerald-950/30 border-emerald-800/50 text-slate-100'
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
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  Automated Balance Sheet (Statement of Financial Position)
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
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
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-[#090A0F] border-slate-800/80'
            }`}>
              <div className="flex justify-between items-center border-b pb-2 border-gray-200 dark:border-slate-800/80">
                <h4 className="font-bold uppercase tracking-wider text-xs text-[#0F4C3A] dark:text-emerald-400">
                  Total Assets
                </h4>
                <span className="font-bold text-sm text-[#0F4C3A] dark:text-emerald-400">
                  {formatIDR(balanceSheet.assets.totalAssets)}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>Current Assets</span>
                {balanceSheet.assets.currentAssets.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-slate-800/80">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>Non-Current Fixed Assets</span>
                {balanceSheet.assets.nonCurrentAssets.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className={`p-5 rounded-xl border space-y-4 ${
              isLight ? 'bg-white border-gray-200/80 shadow-xs' : 'bg-[#090A0F] border-slate-800/80'
            }`}>
              <div className="flex justify-between items-center border-b pb-2 border-gray-200 dark:border-slate-800/80">
                <h4 className="font-bold uppercase tracking-wider text-xs text-blue-600 dark:text-blue-400">
                  Liabilities &amp; Equity
                </h4>
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                  {formatIDR(balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>Current Liabilities</span>
                {balanceSheet.liabilities.currentLiabilities.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                    <span>{item.category}</span>
                    <span>{formatIDR(item.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-slate-800/80">
                <span className={`font-bold ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>Shareholders' Equity</span>
                {balanceSheet.equity.equityItems.map((item, idx) => (
                  <div key={idx} className={`flex justify-between pl-3 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
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
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <h3 className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
              Cash Flow Statement
            </h3>
            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
              Operating, Investing, and Financing Cash Movements • {cashFlow.period}
            </p>
          </div>

          <div className="p-6 space-y-5 font-mono text-xs">
            <div className="space-y-1.5">
              <div className={`flex justify-between font-bold uppercase pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-slate-800/80 text-slate-200'
              }`}>
                <span>Cash Flows from Operating Activities</span>
                <span className="text-[#0F4C3A] dark:text-emerald-400">{formatIDR(cashFlow.netOperatingCash)}</span>
              </div>
              {cashFlow.operatingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                  <span>{act.category}</span>
                  <span className={act.amount < 0 ? (isLight ? 'text-rose-600' : 'text-red-400') : (isLight ? 'text-emerald-600' : 'text-emerald-400')}>
                    {act.amount < 0 ? `-${formatIDR(Math.abs(act.amount))}` : formatIDR(act.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <div className={`flex justify-between font-bold uppercase pb-1.5 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-slate-800/80 text-slate-200'
              }`}>
                <span>Cash Flows from Investing Activities</span>
                <span className="text-blue-600 dark:text-blue-400">{formatIDR(cashFlow.netInvestingCash)}</span>
              </div>
              {cashFlow.investingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
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
                  : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
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
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                    <ReceiptText className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                    General Ledger (GL) Immutable Journal Vouchers
                  </h3>
                  <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                    GAAP/IFRS Immutability Enforced
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                  Double-entry accounting records with audit-grade immutability. Hard deletes are strictly disabled; corrections are made via counter-entries.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={glSearch}
                    onChange={(e) => setGlSearch(e.target.value)}
                    placeholder="Search voucher or description..."
                    className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] w-56 ${
                      isLight
                        ? 'bg-white border-gray-300 text-gray-900'
                        : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
                    }`}
                  />
                </div>

                <select
                  value={glRefFilter}
                  onChange={(e) => setGlRefFilter(e.target.value)}
                  className={`px-2.5 py-1.5 text-xs rounded-xl border font-semibold ${
                    isLight
                      ? 'bg-white border-gray-200 text-gray-800 focus:border-[#0F4C3A]'
                      : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
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
                  <option value="POS_SAFE_DROP">POS Safe Drops (Brankas)</option>
                  <option value="CONSIGNMENT_SALE">Consignment Sales (2015)</option>
                  <option value="CONSIGNMENT_SETTLEMENT">Consignment Settlement</option>
                  <option value="REPACK_BUNDLE">Repack / Bundle Packaging</option>
                  <option value="CROSS_DOCK">Cross-Dock Allocation</option>
                  <option value="REVERSING_ENTRY">Reversing Counter-Entries</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
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
              <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-slate-800/80'}`}>
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`py-8 text-center text-xs font-sans ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
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
                            : 'bg-slate-900/50 opacity-75'
                          : isLight
                          ? 'hover:bg-gray-50/80'
                          : 'hover:bg-slate-900/60'
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
                      <td className={`py-3 px-4 text-[11px] font-sans ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                        <div>{entry.timestamp.split('T')[0]}</div>
                        <span className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                          {entry.storeName || 'Senopati'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`font-mono font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                          {entry.accountCode}
                        </span>
                        <div className={`text-[11px] ${isLight ? 'text-gray-600' : 'text-slate-400'}`}>
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
                            : 'bg-slate-900/90 text-slate-300 border-slate-800/80'
                        }`}>
                          {entry.referenceType}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-[11px] font-sans max-w-xs truncate ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
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
                        ) : canManageAccountingAndGiro ? (
                          <button
                            onClick={() => {
                              setReversalReason('');
                              setReversingEntry(entry);
                            }}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                              isLight
                                ? 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700 shadow-2xs'
                                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800/80 text-slate-200'
                            }`}
                            title="Generate an audit-certified reversing counter-entry to correct this voucher"
                          >
                            Reverse Entry
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">Posted</span>
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
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                  <Building2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  Chart of Accounts (COA) Structure
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
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
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
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
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
                }`}>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4 font-sans">Account Title</th>
                  <th className="py-3 px-4 font-sans">Category</th>
                  <th className="py-3 px-4">Normal Balance</th>
                  <th className="py-3 px-4 font-sans">Reporting Hub</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-slate-800/80'}`}>
                {filteredCOA.map((acc) => (
                  <tr
                    key={`${acc.storeId}-${acc.accountCode}`}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-gray-50/80' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {acc.accountCode}
                    </td>
                    <td className={`py-3.5 px-4 font-sans font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
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
                    <td className={`py-3.5 px-4 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                      {acc.normalBalance}
                    </td>
                    <td className={`py-3.5 px-4 font-sans ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                      {acc.storeId}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
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
          activeStaffSession={activeStaffSession}
        />
      )}

      {/* SUB-TAB 7: B2B WHOLESALE RECEIVABLES (AR) & BILYET GIRO CLEARING */}
      {!complianceSubView && subTab === 'b2b_ar' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>Total Wholesale AR (COA #1200)</span>
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-gray-900 dark:text-slate-100">
                {formatIDR(b2bCustomers.reduce((sum, c) => sum + (c.outstandingAR || 0), 0))}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-slate-400 mt-1 block">Trade credit receivables from B2B buyers</span>
            </div>

            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
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

            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
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

            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>Denda Tolakan Kliring (#4090)</span>
                <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <ShieldAlert className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-purple-700 dark:text-purple-400">
                {formatIDR(450000)}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-slate-400 mt-1 block">
                Rp 150.000 / bounced check penalty fee
              </span>
            </div>
          </div>

          {/* Table 1: Accounts Receivable Aging & Customer Limits */}
          <div className={`p-5 sm:p-6 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'} space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800/80">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Wholesale Accounts Receivable Aging Matrix &amp; Plafond</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  B2B customer credit limit monitoring, AR aging buckets, and auto-freeze enforcement
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-900/90 text-gray-700 dark:text-slate-300 border border-transparent dark:border-slate-800/80">
                {b2bCustomers.length} Wholesale Accounts
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-[#090A0F] uppercase text-[10px] font-bold text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800/80">
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
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 font-medium">
                  {b2bCustomers.map((cust) => {
                    const isLocked = cust.status === 'CREDIT_LOCKED';
                    return (
                      <tr key={cust.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-900/60 transition-colors">
                        <td className="py-3.5 px-3.5">
                          <div className="font-bold text-gray-900 dark:text-slate-100">{cust.companyName}</div>
                          <div className="text-[11px] text-gray-500 dark:text-slate-400">{cust.name} ({cust.tierLabel})</div>
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-gray-700 dark:text-slate-300">
                          {formatIDR(cust.creditLimit)}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono font-bold text-gray-900 dark:text-slate-100">
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
                          {canManageAccountingAndGiro ? (
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
                          ) : (
                            <span className="text-[11px] text-gray-400 font-mono">Controller Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Bilyet Giro (PDC) Clearing & Bounce Management */}
          <div className={`p-5 sm:p-6 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'} space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800/80">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Bilyet Giro (PDC) Clearing &amp; Dishonor / Bounce Management</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Warkat giro masuk, eksekusi kliring bank (COA #1020), atau proses tolak kliring dengan denda administratif
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-900/90 text-gray-700 dark:text-slate-300 border border-transparent dark:border-slate-800/80">
                {giroRecords.length} Giro Registers
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-[#090A0F] uppercase text-[10px] font-bold text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800/80">
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
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 font-medium">
                  {giroRecords.map((giro) => (
                    <tr key={giro.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="py-3.5 px-3.5">
                        <div className="font-bold font-mono text-emerald-800 dark:text-emerald-400">{giro.giroNumber}</div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">{giro.issuingBank}</div>
                      </td>
                      <td className="py-3.5 px-3.5 font-semibold text-gray-900 dark:text-slate-100">
                        {giro.customerName}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-[11px] text-gray-500 dark:text-slate-400">
                        {giro.orderId}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="font-mono">{new Date(giro.clearingDueDate).toLocaleDateString()}</div>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400">Jatuh Tempo Kliring</span>
                      </td>
                      <td className="py-3.5 px-3.5 font-mono font-bold text-gray-900 dark:text-slate-100">
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
                          canManageAccountingAndGiro ? (
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
                            <span className="text-[11px] text-gray-400 font-mono">Treasury Only</span>
                          )
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

          {/* Card 3: Bank Mutation CSV Import & Auto-Matching (BCA / Mandiri) */}
          <div className={`p-5 sm:p-6 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'} space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800/80">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  <span>Bank Mutation CSV Import &amp; B2B Auto-Matching (BCA / Mandiri)</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Upload or paste CSV bank statements to auto-match incoming CR transfers against unpaid B2B wholesale invoices (DR #1020 / CR #1200).
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  isLight ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                }`}>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setBankCsvText(String(reader.result || ''));
                        setBankMatchResult(null);
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const orders = await apiClient.getB2BOrders().catch(() => []);
                    const openOrder = orders.find((o) => o.paymentStatus !== 'SETTLED');
                    const sampleOrderId = openOrder?.id || 'B2B-2026-0038';
                    const sampleCompany = (openOrder?.companyName || 'Toko Berkah Mandiri').toUpperCase();
                    const sampleAmount = Math.round(openOrder?.totalAmountIDR || 1953600);
                    setBankCsvText(
                      `Tanggal,Keterangan,Cabang,Jumlah,Saldo\n` +
                      `2026-11-15,TRSF E-BANKING CR ${sampleOrderId} ${sampleCompany},0095,${sampleAmount},145000000\n` +
                      `2026-11-15,BIAYA ADM BULANAN BANK,0095,25000 DB,144975000`
                    );
                    setBankMatchResult(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    isLight ? 'bg-emerald-50 border-emerald-200 text-[#0F4C3A] hover:bg-emerald-100' : 'bg-emerald-950/80 border-emerald-800/50 text-emerald-300 hover:bg-emerald-950'
                  }`}
                >
                  Load Sample CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2 space-y-2">
                <textarea
                  rows={4}
                  value={bankCsvText}
                  onChange={(e) => {
                    setBankCsvText(e.target.value);
                    setBankMatchResult(null);
                  }}
                  placeholder={`Paste BCA or Mandiri CSV rows here, e.g.:\nTanggal,Keterangan,Jumlah,Tipe\n2026-11-15,TRANSFER MASUK B2B-1001 PT KULINER,8500000,CR`}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-xl border focus:outline-none focus:border-[#0F4C3A] ${
                    isLight ? 'bg-slate-50 border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
                  }`}
                />
              </div>
              <div className="flex flex-col justify-between gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-gray-600 dark:text-slate-300">
                    Bank Settlement Account
                  </label>
                  <select
                    value={bankAccountCode}
                    onChange={(e) => setBankAccountCode(e.target.value as '1020' | '1015' | '1010')}
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  >
                    <option value="1020">Bank BCA / Mandiri Operasional (#1020)</option>
                    <option value="1015">Store Bank Vault (#1015)</option>
                    <option value="1010">Cash / Operational Register (#1010)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isMatchingBankCsv || !bankCsvText.trim()}
                    onClick={async () => {
                      setIsMatchingBankCsv(true);
                      try {
                        const res = await apiClient.reconcileBankMutationCsv({
                          csvText: bankCsvText,
                          bankAccountCode,
                          previewOnly: true,
                        });
                        setBankMatchResult(res);
                        onShowToast('CSV Parsed', res.message);
                      } catch (err: unknown) {
                        onShowToast('CSV Match Error', err instanceof Error ? err.message : String(err));
                      } finally {
                        setIsMatchingBankCsv(false);
                      }
                    }}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 cursor-pointer ${
                      isLight ? 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50' : 'bg-slate-900/90 border-slate-800/80 text-slate-100 hover:bg-slate-800'
                    }`}
                  >
                    Preview Matches
                  </button>
                  {canManageAccountingAndGiro && (
                    <button
                      type="button"
                      disabled={isMatchingBankCsv || !bankCsvText.trim()}
                      onClick={async () => {
                        setIsMatchingBankCsv(true);
                        try {
                          const res = await apiClient.reconcileBankMutationCsv({
                            csvText: bankCsvText,
                            bankAccountCode,
                            previewOnly: false,
                          });
                          setBankMatchResult(res);
                          onShowToast('Bank Reconciliation Committed', res.message);
                          await loadB2bAccountingData();
                          onRefreshData();
                        } catch (err: unknown) {
                          onShowToast('Reconciliation Failed', err instanceof Error ? err.message : String(err));
                        } finally {
                          setIsMatchingBankCsv(false);
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isMatchingBankCsv ? 'Matching...' : 'Auto-Settle Matches'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {bankMatchResult && (
              <div className="space-y-2 pt-2">
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                    Matched: {bankMatchResult.matchedCount} ({formatIDR(bankMatchResult.totalMatchedIDR)})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
                    Unmatched CR: {bankMatchResult.unmatchedCount}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-900/90 text-gray-600 dark:text-slate-300 border border-transparent dark:border-slate-800/80">
                    Skipped Debits: {bankMatchResult.matches.filter((m) => m.status === 'IGNORED_DEBIT').length}
                  </span>
                </div>
                {bankMatchResult.matches.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800/80">
                    <table className="w-full text-left text-xs">
                      <thead className={isLight ? 'bg-gray-50 text-gray-600' : 'bg-[#090A0F] text-slate-400'}>
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Mutation Description</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Matched Order / Buyer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                        {bankMatchResult.matches.map((m, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-mono">{m.mutationDate}</td>
                            <td className="py-2 px-3 max-w-xs truncate">{m.description}</td>
                            <td className="py-2 px-3 font-mono font-bold text-right">{formatIDR(m.amountIDR)}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  m.status === 'MATCHED_AND_SETTLED'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : m.status === 'MATCHED_PREVIEW'
                                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                    : m.status === 'UNMATCHED'
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    : 'bg-gray-100 dark:bg-slate-900/90 text-gray-500 dark:text-slate-400'
                                }`}
                              >
                                {m.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-[11px]">
                              {m.matchedOrderId ? `${m.matchedOrderId} • ${m.matchedCustomerName || ''}` : m.reason || '-'}
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

      {/* SUB-TAB 10: CONSIGNMENT (TITIP JUAL) SETTLEMENT ENGINE */}
      {!complianceSubView && subTab === 'consignment' && (
        <ConsignmentSettlementPanel
          theme={theme}
          selectedStore={selectedStore}
          activeStaffSession={activeStaffSession}
          onSettled={onRefreshData}
          onShowToast={onShowToast}
        />
      )}

      {/* ADDITIVE COMPLIANCE PANELS: RETURNS / NOTA RETUR & CORETAX DJP */}
      {complianceSubView && complianceSubView !== 'settlement_giro' && complianceSubView !== 'executive_health' && (
        <ComplianceAccountingPanels
          theme={theme}
          mode={complianceSubView}
          selectedStore={selectedStore}
          activeStaffSession={activeStaffSession}
          onRefreshData={onRefreshData}
          onShowToast={onShowToast}
        />
      )}

      {/* ADDITIVE VIEW: 1-CLICK EXECUTIVE FINANCIAL HEALTH DASHBOARD */}
      {complianceSubView === 'executive_health' && (
        <div className="space-y-5">
          <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isLight ? 'bg-white border-gray-200/90 shadow-xs' : 'bg-[#12141C] border-slate-800/80'
          }`}>
            <div>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                <Activity className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                Executive Summary — Real-Time Financial Health Dashboard
              </h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                1-click liquidity overview across Cash &amp; Bank balances, Aging Wholesale Receivables, and Upcoming Supplier Payables.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadExecSummary()}
              disabled={isLoadingExecSummary}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                isLight ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isLoadingExecSummary ? 'Refreshing...' : 'Refresh Financial Health'}
            </button>
          </div>

          {execSummary ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 1. Cash & Bank Balance Card */}
              <div className={`p-5 rounded-2xl border space-y-3 ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F4C3A] dark:text-emerald-400">
                    1. Cash &amp; Bank Balance
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className={`text-2xl font-bold font-mono ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  {formatIDR(execSummary.cashAndBank.totalLiquidCashIDR)}
                </div>
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800/80 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="font-sans text-gray-500 dark:text-slate-400">Cash &amp; Store Vault (#1010/#1015):</span>
                    <span>
                      {formatIDR(
                        execSummary.cashAndBank.vaultAndRegistersIDR +
                          execSummary.cashAndBank.posDrawerIDR +
                          execSummary.cashAndBank.storeBankVaultIDR
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-gray-500 dark:text-slate-400">Bank BCA / Operational (#1020):</span>
                    <span>{formatIDR(execSummary.cashAndBank.bankBcaClearingIDR)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-gray-500 dark:text-slate-400">QRIS / In-Transit Clearing (#1030):</span>
                    <span>{formatIDR(execSummary.cashAndBank.qrisReceivablePendingIDR)}</span>
                  </div>
                </div>
              </div>

              {/* 2. Total Aging Receivables Card */}
              <div className={`p-5 rounded-2xl border space-y-3 ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    2. Total Aging Receivables (AR)
                  </span>
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <div className={`text-2xl font-bold font-mono ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  {formatIDR(execSummary.receivablesAging.totalOutstandingArIDR)}
                </div>
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800/80 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="font-sans text-gray-500 dark:text-slate-400">Current (0 - 30 Days):</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{formatIDR(execSummary.receivablesAging.current0To30IDR)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-gray-500 dark:text-slate-400">31 - 60 Days:</span>
                    <span className="text-amber-600 dark:text-amber-400">{formatIDR(execSummary.receivablesAging.days31To60IDR)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-gray-500 dark:text-slate-400">&gt; 60 Days ({execSummary.receivablesAging.lockedCustomersCount} locked / {execSummary.receivablesAging.unpaidB2bOrdersCount} unpaid):</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{formatIDR(execSummary.receivablesAging.over60DaysIDR)}</span>
                  </div>
                </div>
              </div>

              {/* 3. Upcoming Supplier Payables Card */}
              <div className={`p-5 rounded-2xl border space-y-3 ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    3. Upcoming Supplier Payables (AP)
                  </span>
                  <FileCheck className="w-4 h-4 text-amber-600" />
                </div>
                <div className={`text-2xl font-bold font-mono ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  {formatIDR(execSummary.upcomingPayables.totalOpenApIDR)}
                </div>
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800/80 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="font-sans text-gray-500 dark:text-slate-400">Overdue Unpaid Bills:</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{formatIDR(execSummary.upcomingPayables.overduePayablesIDR)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-gray-500 dark:text-slate-400">Due within 7 Days:</span>
                    <span className="text-amber-600 dark:text-amber-400">{formatIDR(execSummary.upcomingPayables.dueWithin7DaysIDR)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-gray-500 dark:text-slate-400">Due 8 - 30 Days ({execSummary.upcomingPayables.openVendorBillsCount} bills):</span>
                    <span>{formatIDR(execSummary.upcomingPayables.dueWithin30DaysIDR)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`p-8 rounded-2xl border text-center text-xs text-gray-500 dark:text-slate-400 ${isLight ? 'bg-white border-gray-200' : 'bg-[#12141C] border-slate-800/80'}`}>
              {isLoadingExecSummary ? 'Computing executive financial summary...' : 'Click Refresh Financial Health to load real-time balances.'}
            </div>
          )}
        </div>
      )}

      {/* ADDITIVE PRECISION PANEL: QRIS/EDC BATCH SETTLEMENT & POST-DATED BILYET GIRO CLEARING */}
      {complianceSubView === 'settlement_giro' && (
        <div className="space-y-6">
          {/* Card 1: QRIS / EDC Batch Settlement & MDR Auto-Reconciliation */}
          <div
            className={`p-5 rounded-2xl border space-y-4 ${
              isLight ? 'bg-white border-gray-200/90 shadow-xs' : 'bg-[#12141C] border-slate-800/80'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-slate-800/80 pb-3">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  QRIS / EDC Batch Settlement &amp; MDR Fee Auto-Reconciliation
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Settle clearing balances cleanly: DR #{settlementDestCode} (Net Settled) + DR #6040 (MDR Fee Expense) / CR #{settlementChannel === 'QRIS' ? '1030' : '1020'} (Gross).
                </p>
              </div>
              <button
                type="button"
                onClick={loadSettlementData}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  isLight ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {isLoadingSettlement ? 'Refreshing...' : 'Refresh Queue'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090A0F] border-slate-800/80'}`}>
                <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400">QRIS Unsettled Balance (#1030)</div>
                <div className="text-lg font-bold font-mono text-[#0F4C3A] dark:text-emerald-400 mt-1">
                  {formatIDR(settlementData?.qrisReceivableCoaBalanceIDR ?? 0)}
                </div>
              </div>
              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090A0F] border-slate-800/80'}`}>
                <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400">EDC Bank Clearing (#1020)</div>
                <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                  {formatIDR(settlementData?.edcClearingPendingIDR ?? 0)}
                </div>
              </div>
              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090A0F] border-slate-800/80'}`}>
                <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400">Pending Tender Receipts</div>
                <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                  {(settlementData?.unsettledQrisItems?.length ?? 0) + (settlementData?.unsettledEdcItems?.length ?? 0)} receipts
                </div>
              </div>
            </div>

            {canManageAccountingAndGiro && (() => {
              const matchingTenders =
                settlementChannel === 'QRIS'
                  ? settlementData?.unsettledQrisItems || []
                  : settlementData?.unsettledEdcItems || [];
              const selectedTenders = matchingTenders.filter((t) => selectedTenderIds.includes(t.id));
              const activeGross =
                selectedTenders.length > 0
                  ? selectedTenders.reduce((sum, t) => sum + t.amountIDR, 0)
                  : settlementGrossOverride;
              const estMdr = Math.round((activeGross * settlementMdrPercent) / 100);
              const estNet = Math.max(0, activeGross - estMdr);

              return (
                <div className="space-y-3">
                  {matchingTenders.length > 0 && (
                    <div className="overflow-x-auto max-h-48 border rounded-xl border-gray-200 dark:border-slate-800/80">
                      <table className="w-full text-left text-xs">
                        <thead className={isLight ? 'bg-gray-50 text-gray-600' : 'bg-[#090A0F] text-slate-400'}>
                          <tr>
                            <th className="py-2 px-3 w-8">Pick</th>
                            <th className="py-2 px-3">Receipt #</th>
                            <th className="py-2 px-3">Channel</th>
                            <th className="py-2 px-3">Amount (IDR)</th>
                            <th className="py-2 px-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                          {matchingTenders.map((t) => (
                            <tr key={t.id}>
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  checked={selectedTenderIds.includes(t.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedTenderIds((prev) => [...prev, t.id]);
                                    } else {
                                      setSelectedTenderIds((prev) => prev.filter((id) => id !== t.id));
                                    }
                                  }}
                                />
                              </td>
                              <td className="py-2 px-3 font-mono font-semibold">{t.id}</td>
                              <td className="py-2 px-3">{t.channel}</td>
                              <td className="py-2 px-3 font-mono">{formatIDR(t.amountIDR)}</td>
                              <td className="py-2 px-3 text-[11px]">{new Date(t.timestamp).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Tender Channel</label>
                      <select
                        value={settlementChannel}
                        onChange={(e) => {
                          const ch = e.target.value as 'QRIS' | 'EDC';
                          setSettlementChannel(ch);
                          setSelectedTenderIds([]);
                          setSettlementMdrPercent(ch === 'QRIS' ? 0.7 : 1.0);
                        }}
                        className={`w-full px-2.5 py-2 rounded-lg text-xs border ${
                          isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                        }`}
                      >
                        <option value="QRIS">QRIS (Default 0.7% MDR)</option>
                        <option value="EDC">EDC / Kartu Debit-Kredit (1.0%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">
                        {selectedTenders.length > 0 ? 'Selected Gross (IDR)' : 'Batch Gross Amount (IDR)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        disabled={selectedTenders.length > 0}
                        value={activeGross}
                        onChange={(e) => setSettlementGrossOverride(Math.max(1, Number(e.target.value) || 0))}
                        className={`w-full px-2.5 py-2 rounded-lg text-xs font-mono border disabled:opacity-70 ${
                          isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">MDR Fee %</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={settlementMdrPercent}
                        onChange={(e) => setSettlementMdrPercent(Math.max(0, Number(e.target.value) || 0))}
                        className={`w-full px-2.5 py-2 rounded-lg text-xs font-mono border ${
                          isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Destination Bank/Cash</label>
                      <select
                        value={settlementDestCode}
                        onChange={(e) => setSettlementDestCode(e.target.value as '1020' | '1010')}
                        className={`w-full px-2.5 py-2 rounded-lg text-xs border ${
                          isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                        }`}
                      >
                        <option value="1020">1020 Bank BCA</option>
                        <option value="1010">1010 Kas Operasional</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={isPostingSettlement || activeGross <= 0}
                      onClick={async () => {
                        setIsPostingSettlement(true);
                        try {
                          const res = await apiClient.postSettlementReconcile({
                            channel: settlementChannel,
                            grossAmountIDR: activeGross,
                            receiptIds: selectedTenders.length > 0 ? selectedTenders.map((t) => t.id) : undefined,
                            mdrPercent: settlementMdrPercent,
                            destinationAccountCode: settlementDestCode,
                            sourceAccountCode: settlementChannel === 'QRIS' ? '1030' : '1020',
                            storeId: selectedStore !== 'CONSOLIDATED' ? selectedStore : undefined,
                            notes: settlementNotes.trim() || undefined,
                          });
                          onShowToast('Settlement Reconciled', res.message);
                          setSelectedTenderIds([]);
                          setSettlementNotes('');
                          await loadSettlementData();
                          onRefreshData();
                        } catch (err: unknown) {
                          onShowToast('Settlement Failed', err instanceof Error ? err.message : String(err));
                        } finally {
                          setIsPostingSettlement(false);
                        }
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white cursor-pointer disabled:opacity-50"
                    >
                      {isPostingSettlement
                        ? 'Reconciling...'
                        : `Reconcile (${formatIDR(estNet)} net · MDR ${formatIDR(estMdr)})`}
                    </button>
                  </div>
                </div>
              );
            })()}

            {(settlementData?.batches?.length ?? 0) > 0 && (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs">
                  <thead className={isLight ? 'bg-gray-50 text-gray-600' : 'bg-[#090A0F] text-slate-400'}>
                    <tr>
                      <th className="py-2.5 px-3">Batch ID</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3">Gross</th>
                      <th className="py-2.5 px-3">MDR Fee (#6040)</th>
                      <th className="py-2.5 px-3">Net Settled</th>
                      <th className="py-2.5 px-3">GL Refs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                    {settlementData!.batches.map((b) => (
                      <tr key={b.id}>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{b.id}</td>
                        <td className="py-2.5 px-3">{b.channel} ({b.mdrPercent}%)</td>
                        <td className="py-2.5 px-3 font-mono">{formatIDR(b.grossAmountIDR)}</td>
                        <td className="py-2.5 px-3 font-mono text-rose-600 dark:text-rose-400">-{formatIDR(b.mdrFeeIDR)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatIDR(b.netSettledIDR)}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{b.glEntryIds.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Card 2: Post-Dated Bilyet Giro Clearing Ledger (COA #1030 & #2030) */}
          <div
            className={`p-5 rounded-2xl border space-y-4 ${
              isLight ? 'bg-white border-gray-200/90 shadow-xs' : 'bg-[#12141C] border-slate-800/80'
            }`}
          >
            <div className="border-b border-gray-200 dark:border-slate-800/80 pb-3">
              <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                Post-Dated Bilyet Giro Clearing Ledger (COA #1030 Incoming &amp; #2030 Outgoing)
              </h3>
              <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Register incoming customer Bilyet Giro (DR #1030 / CR #1200) or outgoing vendor post-dated Giro (DR #2010 / CR #2030) and execute SKNBI Clear / Bounce actions.
              </p>
            </div>

            {canManageAccountingAndGiro && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!giroCounterparty.trim() || !giroNumber.trim() || giroAmount <= 0) {
                    onShowToast('Missing Giro Details', 'Enter counterparty, Giro number, and positive amount.');
                    return;
                  }
                  setIsCreatingGiro(true);
                  try {
                    const res = await apiClient.createStandaloneGiro({
                      direction: giroDirection,
                      counterpartyName: giroCounterparty.trim(),
                      giroNumber: giroNumber.trim(),
                      issuingBank: giroBank,
                      amountIDR: giroAmount,
                      clearingDueDate: giroDueDate,
                      orderOrBillRef: giroRef.trim() || undefined,
                    });
                    onShowToast('Bilyet Giro Registered', res.message);
                    setGiroCounterparty('');
                    setGiroNumber('');
                    setGiroRef('');
                    await loadB2bAccountingData();
                    onRefreshData();
                  } catch (err: unknown) {
                    onShowToast('Giro Registration Failed', err instanceof Error ? err.message : String(err));
                  } finally {
                    setIsCreatingGiro(false);
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end p-4 rounded-xl border border-gray-200 dark:border-slate-800/80 bg-gray-50/70 dark:bg-[#090A0F]"
              >
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Giro Direction</label>
                  <select
                    value={giroDirection}
                    onChange={(e) => setGiroDirection(e.target.value as 'INCOMING' | 'OUTGOING')}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  >
                    <option value="INCOMING">Incoming Customer Giro (#1030)</option>
                    <option value="OUTGOING">Outgoing Vendor Giro (#2030)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Counterparty Name</label>
                  <input
                    type="text"
                    value={giroCounterparty}
                    onChange={(e) => setGiroCounterparty(e.target.value)}
                    placeholder="e.g. PT Sinar Jaya"
                    className={`w-full px-2.5 py-2 rounded-lg text-xs border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Bilyet Giro Number</label>
                  <input
                    type="text"
                    value={giroNumber}
                    onChange={(e) => setGiroNumber(e.target.value)}
                    placeholder="BG-BCA-889012"
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-mono border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Amount (IDR)</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={giroAmount}
                    onChange={(e) => setGiroAmount(Math.max(1, Number(e.target.value) || 0))}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-mono border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Due Date (Jatuh Tempo)</label>
                  <input
                    type="date"
                    value={giroDueDate}
                    onChange={(e) => setGiroDueDate(e.target.value)}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-mono border ${
                      isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingGiro}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white cursor-pointer disabled:opacity-50"
                >
                  {isCreatingGiro ? 'Registering...' : 'Register Giro'}
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={isLight ? 'bg-gray-50 text-gray-600' : 'bg-[#090A0F] text-slate-400'}>
                  <tr>
                    <th className="py-3 px-3.5">Giro # / Bank</th>
                    <th className="py-3 px-3.5">Direction &amp; COA</th>
                    <th className="py-3 px-3.5">Counterparty</th>
                    <th className="py-3 px-3.5">Due Date</th>
                    <th className="py-3 px-3.5">Nominal</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5 text-right">SKNBI Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                  {giroRecords.map((giro) => (
                    <tr key={giro.id}>
                      <td className="py-3 px-3.5">
                        <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{giro.giroNumber}</div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">{giro.issuingBank}</div>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-[11px]">
                        {giro.direction === 'OUTGOING' ? 'OUTGOING (#2030)' : `INCOMING (#${giro.settlementCoaCode || '1210'})`}
                      </td>
                      <td className="py-3 px-3.5 font-semibold">{giro.customerName}</td>
                      <td className="py-3 px-3.5 font-mono">{new Date(giro.clearingDueDate).toLocaleDateString()}</td>
                      <td className="py-3 px-3.5 font-mono font-bold">{formatIDR(giro.amountIDR)}</td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            giro.status === 'CLEARED'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : giro.status === 'BOUNCED'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {giro.status}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        {giro.status === 'PENDING_CLEARING' && canManageAccountingAndGiro ? (
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              disabled={isProcessingGiro}
                              onClick={() => handleClearGiro(giro.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Mark Cleared
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingGiro}
                              onClick={() => handleBounceGiro(giro.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Tolak Kliring
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 dark:text-slate-500 font-mono">{giro.status === 'PENDING_CLEARING' ? 'Treasury Only' : 'Completed'}</span>
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
      </div>

      {/* MODAL: POST REVERSING JOURNAL ENTRY */}
      {reversingEntry && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade">
          <div
            className={`border rounded-2xl w-full max-w-[95vw] sm:max-w-md p-4 sm:p-6 space-y-4 shadow-2xl my-auto gm-modal-pop ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  Post Reversing Journal Voucher
                </h3>
                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Immutable GAAP Counter-Entry for #{reversingEntry.id}
                </p>
              </div>
              <button
                onClick={() => setReversingEntry(null)}
                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors ${
                  isLight ? 'text-gray-500' : 'text-slate-300'
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
              isLight ? 'bg-white border-gray-200 text-gray-800 shadow-2xs' : 'bg-[#090A0F] border-slate-800/80 text-slate-200'
            }`}>
              <div className="flex justify-between">
                <span className="font-sans text-gray-500 dark:text-slate-400">Account:</span>
                <span className="font-bold">{reversingEntry.accountCode} - {reversingEntry.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-gray-500 dark:text-slate-400">Original Debit / Credit:</span>
                <span>Debit {formatIDR(reversingEntry.debit)} • Credit {formatIDR(reversingEntry.credit)}</span>
              </div>
              <div className="flex justify-between text-purple-600 dark:text-purple-400 font-bold border-t pt-1 border-gray-200 dark:border-slate-800/80">
                <span className="font-sans">Counter-Entry Will Post:</span>
                <span>Debit {formatIDR(reversingEntry.credit)} • Credit {formatIDR(reversingEntry.debit)}</span>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                Mandatory Audit Trail Correction Note (Min. 5 characters)
              </label>
              <input
                type="text"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Enter specific audit reason, e.g. Supplier invoice mismatch / Qty correction"
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-900'
                    : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
                }`}
              />
              <p className={`text-[10px] mt-1 ${reversalReason.trim().length >= 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {reversalReason.trim().length >= 5
                  ? 'Audit note verified — entry will be permanently recorded in Immutable Audit Trail.'
                  : `Required: ${Math.max(0, 5 - reversalReason.trim().length)} more character(s) needed to unlock GL reversal.`}
              </p>
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-gray-200' : 'border-slate-800/80'}`}>
              <button
                onClick={() => setReversingEntry(null)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                }`}
              >
                Abort
              </button>
              <button
                onClick={handlePostReversal}
                disabled={isSubmittingReversal || reversalReason.trim().length < 5}
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

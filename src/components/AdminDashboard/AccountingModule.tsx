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
  VendorBillBridgeTarget,
} from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import { isOwnerRoleCode } from '../../utils/rbac';
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
  vendorBillBridgeTarget?: VendorBillBridgeTarget | null;
  onClearVendorBillBridge?: () => void;
  onNavigateToProcurementDoc?: (subTab: 'pr' | 'po' | 'gr', docId: string) => void;
  enableB2BFeatures?: boolean;
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
  vendorBillBridgeTarget,
  onClearVendorBillBridge,
  onNavigateToProcurementDoc,
  enableB2BFeatures = false,
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

  // Expandable Tree States (First 3 groups/sections expanded by default + Expand/Collapse All)
  const [expandedPnlSections, setExpandedPnlSections] = useState<Set<string>>(
    () => new Set(['revenue', 'cogs', 'opex'])
  );
  const [expandedBsSections, setExpandedBsSections] = useState<Set<string>>(
    () => new Set(['current_assets', 'fixed_assets', 'current_liabilities'])
  );
  const [expandedGlCodes, setExpandedGlCodes] = useState<Set<string> | null>(null);
  const [expandedTbCodes, setExpandedTbCodes] = useState<Set<string> | null>(null);

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
    isOwnerRoleCode(activeStaffSession.roleCode) ||
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

  const deriveJournalPartner = (entry: GeneralLedgerEntry): string => {
    const desc = entry.description || '';
    const supMatch = desc.match(/(?:Supplier|Vendor|Distributor|PT|CV|UD)\s+[A-Za-z0-9.&'\-\s]{2,28}/i);
    if (supMatch) return supMatch[0].trim().replace(/[.,;)]+$/, '');
    if (entry.referenceType === 'POS_SALE' || entry.referenceType === 'QRIS_SALE') {
      return entry.storeName ? `Walk-in · ${entry.storeName}` : 'Walk-in Customer';
    }
    if (entry.referenceType === 'B2B_WHOLESALE_ORDER' || entry.referenceType === 'GIRO_CLEARING' || entry.referenceType === 'GIRO_BOUNCED') {
      return 'B2B Wholesale Partner';
    }
    if (entry.referenceType === 'VENDOR_BILL' || entry.referenceType === 'VENDOR_PAYMENT' || entry.referenceType === 'PARTIAL_GR' || entry.referenceType === 'PURCHASE_ORDER') {
      return 'Trade Supplier / Vendor';
    }
    return entry.storeName || 'Internal Posting';
  };

  const renderLedgerAmount = (amountIDR: number, options?: { mutedZero?: boolean; highlightNegative?: boolean; signedNegative?: boolean }) => {
    const isZero = Math.abs(amountIDR) < 0.005;
    const isNeg = amountIDR < -0.005;
    if (isZero) {
      return (
        <span className={options?.mutedZero !== false ? 'gm-currency-zero text-slate-400 dark:text-slate-500 font-normal' : ''}>
          {formatCurrency(0)}
        </span>
      );
    }
    const absFormatted = formatCurrency(Math.abs(amountIDR));
    const displayText = isNeg ? `-${absFormatted}` : absFormatted;
    if (isNeg && options?.highlightNegative !== false) {
      return <span className="gm-currency-negative font-medium">{displayText}</span>;
    }
    return <span>{displayText}</span>;
  };

  // Hierarchical GL Account Tree Groups (sorted by accountCode, chronological running balance)
  const glAccountGroups = useMemo(() => {
    const coaMap = new Map<string, ChartOfAccount>();
    chartOfAccounts.forEach((acc) => {
      if (selectedStore !== 'CONSOLIDATED' && acc.storeId && acc.storeId !== selectedStore && acc.storeId !== 'GLOBAL') {
        return;
      }
      if (!coaMap.has(acc.accountCode)) {
        coaMap.set(acc.accountCode, acc);
      }
    });

    const grouped = new Map<
      string,
      {
        accountCode: string;
        accountName: string;
        category: string;
        entries: Array<GeneralLedgerEntry & { partner: string; runningBalance: number }>;
        totalDebit: number;
        totalCredit: number;
        netBalance: number;
      }
    >();

    const chronological = [...filteredLedger].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    chronological.forEach((entry) => {
      const code = entry.accountCode || '0000';
      const coaMeta = coaMap.get(code);
      const existing = grouped.get(code) || {
        accountCode: code,
        accountName: coaMeta?.accountName || entry.accountName || `Account ${code}`,
        category: coaMeta?.category || entry.category || 'Account',
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        netBalance: 0,
      };
      const dr = Number(entry.debit) || 0;
      const cr = Number(entry.credit) || 0;
      existing.totalDebit += dr;
      existing.totalCredit += cr;
      existing.netBalance = existing.totalDebit - existing.totalCredit;
      existing.entries.push({
        ...entry,
        partner: deriveJournalPartner(entry),
        runningBalance: existing.netBalance,
      });
      grouped.set(code, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }, [filteredLedger, chartOfAccounts, selectedStore]);

  // Hierarchical Trial Balance Groups (all filtered COA accounts + any GL-only codes)
  const trialBalanceGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        accountCode: string;
        accountName: string;
        category: string;
        normalBalance: string;
        totalDebit: number;
        totalCredit: number;
        netBalance: number;
        entries: Array<GeneralLedgerEntry & { partner: string; runningBalance: number }>;
      }
    >();

    filteredCOA.forEach((acc) => {
      if (!map.has(acc.accountCode)) {
        map.set(acc.accountCode, {
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          category: acc.category,
          normalBalance: acc.normalBalance,
          totalDebit: 0,
          totalCredit: 0,
          netBalance: 0,
          entries: [],
        });
      }
    });

    glAccountGroups.forEach((grp) => {
      const existing = map.get(grp.accountCode);
      if (existing) {
        existing.totalDebit = grp.totalDebit;
        existing.totalCredit = grp.totalCredit;
        existing.netBalance = grp.netBalance;
        existing.entries = grp.entries;
      } else {
        map.set(grp.accountCode, {
          accountCode: grp.accountCode,
          accountName: grp.accountName,
          category: grp.category,
          normalBalance: 'Debit',
          totalDebit: grp.totalDebit,
          totalCredit: grp.totalCredit,
          netBalance: grp.netBalance,
          entries: grp.entries,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }, [filteredCOA, glAccountGroups]);

  // Effective expanded sets: default to first 3 accounts until user toggles
  const resolvedExpandedGlCodes = useMemo(() => {
    if (expandedGlCodes !== null) return expandedGlCodes;
    return new Set(glAccountGroups.slice(0, 3).map((g) => g.accountCode));
  }, [expandedGlCodes, glAccountGroups]);

  const resolvedExpandedTbCodes = useMemo(() => {
    if (expandedTbCodes !== null) return expandedTbCodes;
    const withActivity = trialBalanceGroups.filter((g) => g.entries.length > 0);
    const seedList = withActivity.length > 0 ? withActivity : trialBalanceGroups;
    return new Set(seedList.slice(0, 3).map((g) => g.accountCode));
  }, [expandedTbCodes, trialBalanceGroups]);

  const toggleExpandedSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string> | null>>,
    current: Set<string>,
    code: string
  ) => {
    const next = new Set(current);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setter(next);
  };

  const toggleSectionSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    code: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Store Segregation Control */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-all gm-hero-banner ${
          isLight
            ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
            : 'bg-[#12141C] border-slate-800/80'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-[12px] font-semibold text-[#0F4C3A] dark:text-emerald-400">
                Double-Entry Accounting
              </span>
              <span className="text-slate-400 text-xs">·</span>
              <span className={`text-[12px] ${isLight ? 'text-gray-600' : 'text-slate-400'}`}>
                Indonesian Retail Multi-Store COA Standards
              </span>
            </div>
            <h2 className={`text-[19px] sm:text-[20px] font-semibold tracking-[-0.01em] ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
              Financial Statements &amp; Store-Tagged General Ledger
            </h2>
            <p className={`text-[13px] leading-relaxed mt-1 max-w-2xl ${isLight ? 'text-gray-600' : 'text-slate-400'}`}>
              Segregated Chart of Accounts (COA) per physical store hub with automated real-time postings for
              QRIS checkouts, PO/GR supplier liabilities, and waste shrinkage expenses.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Store Hub Filter */}
            <div className="flex items-center gap-2">
              <span className={`text-[13px] font-semibold ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                Entity
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
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none mt-6 pt-4 border-t border-gray-200 dark:border-slate-800/80">
          {[
            { id: 'pnl', label: 'Profit & Loss (P&L)', icon: TrendingUp },
            { id: 'balance_sheet', label: 'Balance Sheet', icon: Scale },
            { id: 'trial_balance', label: 'Trial Balance', icon: FileSpreadsheet },
            { id: 'cash_flow', label: 'Cash Flow Statement', icon: DollarSign },
            { id: 'gl', label: 'General Ledger', icon: ReceiptText },
            { id: 'coa', label: 'Chart of Accounts', icon: Building2 },
            { id: 'vendor_bills', label: 'Vendor Bills & AP', icon: FileCheck },
            ...(enableB2BFeatures
              ? [{ id: 'b2b_ar', label: 'B2B AR & Giro Clearing', icon: CreditCard }]
              : []),
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
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13.5px] whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  active
                    ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
                    : isLight
                    ? 'font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    : 'font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setComplianceSubView('rma_rtv')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13.5px] whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              complianceSubView === 'rma_rtv'
                ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
                : isLight
                ? 'font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Returns &amp; Nota Retur
          </button>
          <button
            type="button"
            onClick={() => setComplianceSubView('coretax_djp')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13.5px] whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              complianceSubView === 'coretax_djp'
                ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
                : isLight
                ? 'font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            Coretax e-Faktur &amp; PPh
          </button>
          <button
            type="button"
            onClick={() => setComplianceSubView('settlement_giro')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13.5px] whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              complianceSubView === 'settlement_giro'
                ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
                : isLight
                ? 'font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            QRIS/EDC Settlement &amp; Giro
          </button>
          <button
            type="button"
            onClick={() => setComplianceSubView('executive_health')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13.5px] whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              complianceSubView === 'executive_health'
                ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
                : isLight
                ? 'font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
            }`}
          >
            <Activity className="w-4 h-4" />
            Financial Health Overview
          </button>
        </div>
      </div>

      <div key={complianceSubView || subTab} className="gm-tab-enter">
      {/* SUB-TAB 1: PROFIT & LOSS STATEMENT (HIERARCHICAL TREE) */}
      {!complianceSubView && subTab === 'pnl' && pnlReport && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className={`text-[18px] font-semibold tracking-[-0.01em] ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  Profit and Loss
                </h3>
                <p className={`text-[13px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                  {pnlReport.storeName || 'Consolidated Company-Wide'} · Period {pnlReport.period}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-medium ${isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-[#090A0F] border-slate-800/80 text-slate-300'}`}>
                  <Globe2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{selectedCurrency} · Indonesia GAAP</span>
                </div>
                <div className={`px-3 py-1.5 rounded-xl border text-[12px] font-sans tabular-nums ${isLight ? 'bg-white border-gray-200' : 'bg-[#090A0F] border-slate-800/80'}`}>
                  <span className={isLight ? 'text-gray-500' : 'text-slate-400'}>Gross Margin </span>
                  <span className="font-semibold text-[#0F4C3A] dark:text-emerald-400">{pnlReport.grossMarginPercent}%</span>
                </div>
                <div className={`px-3 py-1.5 rounded-xl border text-[12px] font-sans tabular-nums ${isLight ? 'bg-white border-gray-200' : 'bg-[#090A0F] border-slate-800/80'}`}>
                  <span className={isLight ? 'text-gray-500' : 'text-slate-400'}>Net Margin </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{pnlReport.netMarginPercent}%</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedPnlSections((prev) =>
                      prev.size === 3 ? new Set() : new Set(['revenue', 'cogs', 'opex'])
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                      : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800/80 text-slate-200'
                  }`}
                >
                  {expandedPnlSections.size === 3 ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] font-sans tabular-nums border-collapse">
              <thead>
                <tr className={`border-b text-[12px] font-semibold ${
                  isLight ? 'border-gray-200 text-gray-600' : 'border-slate-800/80 text-slate-400'
                }`}>
                  <th className="py-3 px-6">Account / Statement Line</th>
                  <th className="py-3 px-4 gm-col-tint-partner">Scope / Basis</th>
                  <th className="py-3 px-6 text-right gm-col-tint-balance">Balance ({selectedCurrency})</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200/80' : 'divide-slate-800/70'}`}>
                {/* Section 1: Operating Sales Revenue */}
                {(() => {
                  const isOpen = expandedPnlSections.has('revenue');
                  return (
                    <>
                      <tr
                        onClick={() => toggleSectionSet(setExpandedPnlSections, 'revenue')}
                        className={`cursor-pointer transition-colors ${isLight ? 'hover:bg-gray-50/70' : 'hover:bg-slate-900/50'}`}
                      >
                        <td className="py-3 px-6">
                          <span className="inline-flex items-center gap-2">
                            <span className="text-gray-400 text-xs w-3 inline-block">{isOpen ? '▾' : '▸'}</span>
                            <span className={isOpen ? 'font-semibold text-gray-900 dark:text-slate-100' : 'font-normal text-gray-800 dark:text-slate-200'}>
                              1. Operating Sales Revenue
                            </span>
                            {isOpen && (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                isLight ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-slate-800/80 text-slate-300 border-slate-700'
                              }`}>
                                Revenue Items
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">POS &amp; Wholesale</td>
                        <td className="py-3 px-6 text-right gm-col-tint-balance font-semibold text-gray-900 dark:text-slate-100">
                          {renderLedgerAmount(pnlReport.netSalesRevenue)}
                        </td>
                      </tr>
                      {isOpen && (
                        <>
                          <tr className={isLight ? 'bg-gray-50/30' : 'bg-slate-900/20'}>
                            <td className="py-2.5 pl-12 pr-6 text-gray-600 dark:text-slate-300">Gross Customer POS &amp; QRIS Revenue</td>
                            <td className="py-2.5 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">COA 4010</td>
                            <td className="py-2.5 px-6 text-right gm-col-tint-balance text-gray-800 dark:text-slate-200">
                              {renderLedgerAmount(pnlReport.grossSalesRevenue)}
                            </td>
                          </tr>
                          <tr className={isLight ? 'bg-gray-50/30' : 'bg-slate-900/20'}>
                            <td className="py-2.5 pl-12 pr-6 text-gray-600 dark:text-slate-300">Less: Loyalty Points, Vouchers &amp; Promo Markdowns</td>
                            <td className="py-2.5 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">Sales Contra</td>
                            <td className="py-2.5 px-6 text-right gm-col-tint-balance">
                              {renderLedgerAmount(-Math.abs(pnlReport.discountsGiven))}
                            </td>
                          </tr>
                          <tr className={`border-t border-b-[3px] border-double ${
                            isLight ? 'border-gray-300 text-gray-900' : 'border-slate-700 text-slate-100'
                          }`}>
                            <td className="py-2.5 pl-10 pr-6 font-semibold">Total 1. Operating Sales Revenue (Net Sales)</td>
                            <td className="py-2.5 px-4 gm-col-tint-partner" />
                            <td className="py-2.5 px-6 text-right gm-col-tint-balance font-semibold text-[#0F4C3A] dark:text-emerald-400">
                              {renderLedgerAmount(pnlReport.netSalesRevenue)}
                            </td>
                          </tr>
                        </>
                      )}
                    </>
                  );
                })()}

                {/* Section 2: Cost of Goods Sold */}
                {(() => {
                  const isOpen = expandedPnlSections.has('cogs');
                  return (
                    <>
                      <tr
                        onClick={() => toggleSectionSet(setExpandedPnlSections, 'cogs')}
                        className={`cursor-pointer transition-colors ${isLight ? 'hover:bg-gray-50/70' : 'hover:bg-slate-900/50'}`}
                      >
                        <td className="py-3 px-6">
                          <span className="inline-flex items-center gap-2">
                            <span className="text-gray-400 text-xs w-3 inline-block">{isOpen ? '▾' : '▸'}</span>
                            <span className={isOpen ? 'font-semibold text-gray-900 dark:text-slate-100' : 'font-normal text-gray-800 dark:text-slate-200'}>
                              2. Cost of Goods Sold (COGS)
                            </span>
                            {isOpen && (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                isLight ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-slate-800/80 text-slate-300 border-slate-700'
                              }`}>
                                WAC / FEFO
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">Weighted Average</td>
                        <td className="py-3 px-6 text-right gm-col-tint-balance font-semibold">
                          {renderLedgerAmount(-Math.abs(pnlReport.costOfGoodsSold))}
                        </td>
                      </tr>
                      {isOpen && (
                        <>
                          <tr className={isLight ? 'bg-gray-50/30' : 'bg-slate-900/20'}>
                            <td className="py-2.5 pl-12 pr-6 text-gray-600 dark:text-slate-300">Direct Farm Acquisition, Cold Chain &amp; Inventory HPP</td>
                            <td className="py-2.5 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">COA 5010</td>
                            <td className="py-2.5 px-6 text-right gm-col-tint-balance">
                              {renderLedgerAmount(-Math.abs(pnlReport.costOfGoodsSold))}
                            </td>
                          </tr>
                          <tr className={`border-t border-b-[3px] border-double ${
                            isLight ? 'border-gray-300 text-gray-900' : 'border-slate-700 text-slate-100'
                          }`}>
                            <td className="py-2.5 pl-10 pr-6 font-semibold">Gross Profit ({pnlReport.grossMarginPercent}% margin)</td>
                            <td className="py-2.5 px-4 gm-col-tint-partner" />
                            <td className="py-2.5 px-6 text-right gm-col-tint-balance font-semibold text-[#0F4C3A] dark:text-emerald-400">
                              {renderLedgerAmount(pnlReport.grossProfit)}
                            </td>
                          </tr>
                        </>
                      )}
                    </>
                  );
                })()}

                {/* Section 3: Operating Expenses */}
                {(() => {
                  const isOpen = expandedPnlSections.has('opex');
                  return (
                    <>
                      <tr
                        onClick={() => toggleSectionSet(setExpandedPnlSections, 'opex')}
                        className={`cursor-pointer transition-colors ${isLight ? 'hover:bg-gray-50/70' : 'hover:bg-slate-900/50'}`}
                      >
                        <td className="py-3 px-6">
                          <span className="inline-flex items-center gap-2">
                            <span className="text-gray-400 text-xs w-3 inline-block">{isOpen ? '▾' : '▸'}</span>
                            <span className={isOpen ? 'font-semibold text-gray-900 dark:text-slate-100' : 'font-normal text-gray-800 dark:text-slate-200'}>
                              3. Operating &amp; Cold-Chain Expenses (OPEX)
                            </span>
                            {isOpen && (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                isLight ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-slate-800/80 text-slate-300 border-slate-700'
                              }`}>
                                Expense Items
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">{pnlReport.operatingExpenses.length} categories</td>
                        <td className="py-3 px-6 text-right gm-col-tint-balance font-semibold">
                          {renderLedgerAmount(-Math.abs(pnlReport.totalOperatingExpenses))}
                        </td>
                      </tr>
                      {isOpen && (
                        <>
                          {pnlReport.operatingExpenses.map((exp, idx) => (
                            <tr key={idx} className={isLight ? 'bg-gray-50/30' : 'bg-slate-900/20'}>
                              <td className="py-2.5 pl-12 pr-6 text-gray-600 dark:text-slate-300">{exp.category}</td>
                              <td className="py-2.5 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">OPEX</td>
                              <td className="py-2.5 px-6 text-right gm-col-tint-balance">
                                {renderLedgerAmount(exp.amount === 0 ? 0 : -Math.abs(exp.amount))}
                              </td>
                            </tr>
                          ))}
                          <tr className={`border-t border-b-[3px] border-double ${
                            isLight ? 'border-gray-300 text-gray-900' : 'border-slate-700 text-slate-100'
                          }`}>
                            <td className="py-2.5 pl-10 pr-6 font-semibold">Total 3. Operating &amp; Cold-Chain Expenses</td>
                            <td className="py-2.5 px-4 gm-col-tint-partner" />
                            <td className="py-2.5 px-6 text-right gm-col-tint-balance font-semibold">
                              {renderLedgerAmount(-Math.abs(pnlReport.totalOperatingExpenses))}
                            </td>
                          </tr>
                        </>
                      )}
                    </>
                  );
                })()}
              </tbody>
              <tfoot>
                <tr className={`border-t-2 ${
                  isLight
                    ? 'bg-emerald-50/60 border-gray-300 text-gray-900'
                    : 'bg-emerald-950/25 border-slate-700 text-slate-100'
                }`}>
                  <td className="py-4 px-6 font-bold text-[15px]">
                    Net Operating Profit
                    <span className="ml-2 text-[12px] font-normal text-gray-500 dark:text-slate-400">
                      ({pnlReport.netMarginPercent}% net margin)
                    </span>
                  </td>
                  <td className="py-4 px-4 gm-col-tint-partner text-[12px] text-gray-500 dark:text-slate-400">Bottom Line</td>
                  <td className="py-4 px-6 text-right gm-col-tint-balance font-bold text-[16px] text-[#0F4C3A] dark:text-emerald-400">
                    {renderLedgerAmount(pnlReport.netProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BALANCE SHEET (HIERARCHICAL TREE) */}
      {!complianceSubView && subTab === 'balance_sheet' && balanceSheet && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className={`text-[18px] font-semibold tracking-[-0.01em] ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  Balance Sheet
                </h3>
                <p className={`text-[13px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                  Period {balanceSheet.period} · Statement of Financial Position
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {balanceSheet.isBalanced ? (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-[12px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Balanced: Assets = Liabilities + Equity
                  </span>
                ) : (
                  <span className="inline-flex items-center whitespace-nowrap px-3 py-1 rounded-full text-[12px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                    Discrepancy Detected
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedBsSections((prev) =>
                      prev.size === 4 ? new Set() : new Set(['current_assets', 'fixed_assets', 'current_liabilities', 'equity'])
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                      : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800/80 text-slate-200'
                  }`}
                >
                  {expandedBsSections.size === 4 ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] font-sans tabular-nums border-collapse">
              <thead>
                <tr className={`border-b text-[12px] font-semibold ${
                  isLight ? 'border-gray-200 text-gray-600' : 'border-slate-800/80 text-slate-400'
                }`}>
                  <th className="py-3 px-6">Account Classification</th>
                  <th className="py-3 px-4 gm-col-tint-partner">Section</th>
                  <th className="py-3 px-6 text-right gm-col-tint-balance">Balance (IDR)</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200/80' : 'divide-slate-800/70'}`}>
                {[
                  {
                    key: 'current_assets',
                    title: 'Current Assets',
                    sectionLabel: 'Assets',
                    items: balanceSheet.assets.currentAssets,
                    total: balanceSheet.assets.currentAssets.reduce((s, i) => s + i.amount, 0),
                  },
                  {
                    key: 'fixed_assets',
                    title: 'Non-Current Fixed Assets',
                    sectionLabel: 'Assets',
                    items: balanceSheet.assets.nonCurrentAssets,
                    total: balanceSheet.assets.nonCurrentAssets.reduce((s, i) => s + i.amount, 0),
                  },
                  {
                    key: 'current_liabilities',
                    title: 'Current Liabilities',
                    sectionLabel: 'Liabilities',
                    items: balanceSheet.liabilities.currentLiabilities,
                    total: balanceSheet.liabilities.currentLiabilities.reduce((s, i) => s + i.amount, 0),
                  },
                  {
                    key: 'equity',
                    title: "Shareholders' Equity",
                    sectionLabel: 'Equity',
                    items: balanceSheet.equity.equityItems,
                    total: balanceSheet.equity.equityItems.reduce((s, i) => s + i.amount, 0),
                  },
                ].map((grp) => {
                  const isOpen = expandedBsSections.has(grp.key);
                  return (
                    <React.Fragment key={grp.key}>
                      <tr
                        onClick={() => toggleSectionSet(setExpandedBsSections, grp.key)}
                        className={`cursor-pointer transition-colors ${isLight ? 'hover:bg-gray-50/70' : 'hover:bg-slate-900/50'}`}
                      >
                        <td className="py-3 px-6">
                          <span className="inline-flex items-center gap-2">
                            <span className="text-gray-400 text-xs w-3 inline-block">{isOpen ? '▾' : '▸'}</span>
                            <span className={isOpen ? 'font-semibold text-gray-900 dark:text-slate-100' : 'font-normal text-gray-800 dark:text-slate-200'}>
                              {grp.title}
                            </span>
                            {isOpen && (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                isLight ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-slate-800/80 text-slate-300 border-slate-700'
                              }`}>
                                {grp.items.length} Accounts
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">{grp.sectionLabel}</td>
                        <td className="py-3 px-6 text-right gm-col-tint-balance font-semibold text-gray-900 dark:text-slate-100">
                          {renderLedgerAmount(grp.total)}
                        </td>
                      </tr>
                      {isOpen && (
                        <>
                          {grp.items.map((item, idx) => (
                            <tr key={idx} className={isLight ? 'bg-gray-50/30' : 'bg-slate-900/20'}>
                              <td className="py-2.5 pl-12 pr-6 text-gray-600 dark:text-slate-300">{item.category}</td>
                              <td className="py-2.5 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">{grp.sectionLabel}</td>
                              <td className="py-2.5 px-6 text-right gm-col-tint-balance">
                                {renderLedgerAmount(item.amount)}
                              </td>
                            </tr>
                          ))}
                          <tr className={`border-t border-b-[3px] border-double ${
                            isLight ? 'border-gray-300 text-gray-900' : 'border-slate-700 text-slate-100'
                          }`}>
                            <td className="py-2.5 pl-10 pr-6 font-semibold">Total {grp.title}</td>
                            <td className="py-2.5 px-4 gm-col-tint-partner" />
                            <td className="py-2.5 px-6 text-right gm-col-tint-balance font-semibold">
                              {renderLedgerAmount(grp.total)}
                            </td>
                          </tr>
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={`border-t-2 ${isLight ? 'bg-emerald-50/50 border-gray-300' : 'bg-emerald-950/20 border-slate-700'}`}>
                  <td className="py-3.5 px-6 font-bold text-[#0F4C3A] dark:text-emerald-400">Total Assets</td>
                  <td className="py-3.5 px-4 gm-col-tint-partner text-[12px] text-gray-500 dark:text-slate-400">Assets</td>
                  <td className="py-3.5 px-6 text-right gm-col-tint-balance font-bold text-[15px] text-[#0F4C3A] dark:text-emerald-400">
                    {renderLedgerAmount(balanceSheet.assets.totalAssets)}
                  </td>
                </tr>
                <tr className={`border-t ${isLight ? 'bg-blue-50/40 border-gray-200' : 'bg-blue-950/20 border-slate-800'}`}>
                  <td className="py-3.5 px-6 font-bold text-blue-700 dark:text-blue-400">Total Liabilities &amp; Equity</td>
                  <td className="py-3.5 px-4 gm-col-tint-partner text-[12px] text-gray-500 dark:text-slate-400">Liabilities + Equity</td>
                  <td className="py-3.5 px-6 text-right gm-col-tint-balance font-bold text-[15px] text-blue-700 dark:text-blue-400">
                    {renderLedgerAmount(balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2B: DEDICATED TRIAL BALANCE (HIERARCHICAL ACCOUNT TREE) */}
      {!complianceSubView && subTab === 'trial_balance' && (() => {
        const tbTotalDebit = trialBalanceGroups.reduce((s, g) => s + g.totalDebit, 0);
        const tbTotalCredit = trialBalanceGroups.reduce((s, g) => s + g.totalCredit, 0);
        const tbVariance = tbTotalDebit - tbTotalCredit;
        const allTbExpanded = trialBalanceGroups.length > 0 && resolvedExpandedTbCodes.size >= trialBalanceGroups.length;
        return (
          <div
            className={`rounded-2xl border transition-all overflow-hidden ${
              isLight
                ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
                : 'bg-[#12141C] border-slate-800/80'
            }`}
          >
            <div className={`p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className={`text-[18px] font-semibold tracking-[-0.01em] ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                    Trial Balance
                  </h3>
                  <p className={`text-[13px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                    Account-level Debit, Credit &amp; Net Balance hierarchy · DR === CR Variance: {formatCurrency(Math.abs(tbVariance))}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold border ${
                    tbVariance === 0
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {tbVariance === 0 ? 'Balanced (DR = CR)' : `Variance: ${formatCurrency(tbVariance)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTbCodes(
                        allTbExpanded ? new Set() : new Set(trialBalanceGroups.map((g) => g.accountCode))
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                        : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800/80 text-slate-200'
                    }`}
                  >
                    {allTbExpanded ? 'Collapse All' : 'Expand All'}
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] font-sans tabular-nums border-collapse">
                <thead>
                  <tr className={`border-b text-[12px] font-semibold ${
                    isLight ? 'border-gray-200 text-gray-600' : 'border-slate-800/80 text-slate-400'
                  }`}>
                    <th className="py-3 px-5">Account / Line Description</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 gm-col-tint-partner">Partner</th>
                    <th className="py-3 px-3 text-center">Currency</th>
                    <th className="py-3 px-4 text-right">Debit</th>
                    <th className="py-3 px-4 text-right">Credit</th>
                    <th className="py-3 px-5 text-right gm-col-tint-balance">Balance</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-gray-200/80' : 'divide-slate-800/70'}`}>
                  {trialBalanceGroups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[13px] text-gray-500 dark:text-slate-400">
                        No accounts available for the selected store hub.
                      </td>
                    </tr>
                  ) : (
                    trialBalanceGroups.map((group) => {
                      const isExpanded = resolvedExpandedTbCodes.has(group.accountCode);
                      return (
                        <React.Fragment key={group.accountCode}>
                          <tr
                            onClick={() => toggleExpandedSet(setExpandedTbCodes, resolvedExpandedTbCodes, group.accountCode)}
                            className={`cursor-pointer transition-colors ${isLight ? 'hover:bg-gray-50/70' : 'hover:bg-slate-900/50'}`}
                          >
                            <td className="py-3 px-5">
                              <span className="inline-flex items-center gap-2">
                                <span className="text-gray-400 text-xs w-3 inline-block">{isExpanded ? '▾' : '▸'}</span>
                                <span className={isExpanded ? 'font-semibold text-gray-900 dark:text-slate-100' : 'font-normal text-gray-800 dark:text-slate-200'}>
                                  {group.accountCode} {group.accountName}
                                </span>
                                {isExpanded && (
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                    isLight ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-slate-800/80 text-slate-300 border-slate-700'
                                  }`}>
                                    Journal Items
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{group.category}</td>
                            <td className="py-3 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">
                              {group.entries.length > 0 ? `${group.entries.length} postings` : 'No postings'}
                            </td>
                            <td className="py-3 px-3 text-center text-gray-500 dark:text-slate-400">{selectedCurrency}</td>
                            <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-slate-100">
                              {renderLedgerAmount(group.totalDebit)}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-slate-100">
                              {renderLedgerAmount(group.totalCredit)}
                            </td>
                            <td className="py-3 px-5 text-right gm-col-tint-balance font-semibold text-gray-900 dark:text-slate-100">
                              {renderLedgerAmount(group.netBalance)}
                            </td>
                          </tr>

                          {isExpanded && (
                            <>
                              {group.entries.length === 0 ? (
                                <tr className={isLight ? 'bg-gray-50/30' : 'bg-slate-900/20'}>
                                  <td colSpan={7} className="py-2.5 pl-10 pr-5 text-gray-400 dark:text-slate-500 text-[12.5px]">
                                    No individual journal movements recorded in this period.
                                  </td>
                                </tr>
                              ) : (
                                group.entries.map((entry) => (
                                  <tr key={`tb-${group.accountCode}-${entry.id}`} className={isLight ? 'bg-gray-50/30 hover:bg-gray-50/80' : 'bg-slate-900/20 hover:bg-slate-900/50'}>
                                    <td className="py-2.5 pl-8 pr-5 text-gray-700 dark:text-slate-300">
                                      <div className="font-medium text-gray-800 dark:text-slate-200">{entry.id}</div>
                                      <div className="text-[12px] text-gray-500 dark:text-slate-400 truncate max-w-md">{entry.description}</div>
                                    </td>
                                    <td className="py-2.5 px-4 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                                      {entry.timestamp.split('T')[0]}
                                    </td>
                                    <td className="py-2.5 px-4 gm-col-tint-partner text-gray-700 dark:text-slate-300">
                                      {entry.partner}
                                    </td>
                                    <td className="py-2.5 px-3 text-center text-gray-500 dark:text-slate-400">{selectedCurrency}</td>
                                    <td className="py-2.5 px-4 text-right">
                                      {renderLedgerAmount(entry.debit)}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                      {renderLedgerAmount(entry.credit)}
                                    </td>
                                    <td className="py-2.5 px-5 text-right gm-col-tint-balance font-medium">
                                      {renderLedgerAmount(entry.runningBalance)}
                                    </td>
                                  </tr>
                                ))
                              )}
                              <tr className={`border-t border-b-[3px] border-double ${
                                isLight ? 'border-gray-300 text-gray-900' : 'border-slate-700 text-slate-100'
                              }`}>
                                <td colSpan={4} className="py-2.5 pl-8 pr-5 font-semibold">
                                  Total {group.accountCode} {group.accountName}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold">{renderLedgerAmount(group.totalDebit)}</td>
                                <td className="py-2.5 px-4 text-right font-semibold">{renderLedgerAmount(group.totalCredit)}</td>
                                <td className="py-2.5 px-5 text-right gm-col-tint-balance font-bold">{renderLedgerAmount(group.netBalance)}</td>
                              </tr>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 border-b-[3px] border-double ${
                    isLight ? 'bg-gray-50/90 border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-700 text-slate-100'
                  }`}>
                    <td colSpan={4} className="py-3.5 px-5 font-bold text-[14px]">
                      Total Trial Balance
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[14px]">{renderLedgerAmount(tbTotalDebit)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-[14px]">{renderLedgerAmount(tbTotalCredit)}</td>
                    <td className="py-3.5 px-5 text-right gm-col-tint-balance font-bold text-[14px]">{renderLedgerAmount(tbVariance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

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
            <h3 className={`text-[18px] font-semibold tracking-[-0.01em] ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
              Cash Flow Statement
            </h3>
            <p className={`text-[13px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
              Operating, Investing, and Financing Cash Movements · {cashFlow.period}
            </p>
          </div>

          <div className="p-6 space-y-6 font-sans tabular-nums text-[13px]">
            <div className="space-y-2.5">
              <div className={`flex justify-between font-semibold pb-2 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-slate-800/80 text-slate-200'
              }`}>
                <span>Cash Flows from Operating Activities</span>
                <span className="text-[#0F4C3A] dark:text-emerald-400">{renderLedgerAmount(cashFlow.netOperatingCash)}</span>
              </div>
              {cashFlow.operatingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 py-1 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                  <span>{act.category}</span>
                  <span className={act.amount < 0 ? 'gm-currency-negative font-medium' : act.amount === 0 ? 'gm-currency-zero' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                    {act.amount < 0 ? `-${formatCurrency(Math.abs(act.amount))}` : formatCurrency(act.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 pt-2">
              <div className={`flex justify-between font-semibold pb-2 border-b ${
                isLight ? 'border-gray-200 text-gray-800' : 'border-slate-800/80 text-slate-200'
              }`}>
                <span>Cash Flows from Investing Activities</span>
                <span className="text-blue-600 dark:text-blue-400">{renderLedgerAmount(cashFlow.netInvestingCash)}</span>
              </div>
              {cashFlow.investingActivities.map((act, idx) => (
                <div key={idx} className={`flex justify-between pl-4 py-1 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                  <span>{act.category}</span>
                  <span className={act.amount < 0 ? 'gm-currency-negative font-medium' : act.amount === 0 ? 'gm-currency-zero' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                    {act.amount < 0 ? `-${formatCurrency(Math.abs(act.amount))}` : formatCurrency(act.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div
              className={`p-4 rounded-xl border flex justify-between items-center ${
                isLight
                  ? 'bg-white border-gray-200 shadow-xs text-gray-900'
                  : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
              }`}
            >
              <span className="font-semibold text-[14px]">Ending Liquid Cash Balance</span>
              <span className="font-bold text-[16px] text-[#0F4C3A] dark:text-emerald-400">
                {renderLedgerAmount(cashFlow.endingCash)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: GENERAL LEDGER (HIERARCHICAL TREE-STYLE LEDGER) */}
      {!complianceSubView && subTab === 'gl' && (() => {
        const allGlExpanded = glAccountGroups.length > 0 && resolvedExpandedGlCodes.size >= glAccountGroups.length;
        const grandDr = glAccountGroups.reduce((s, g) => s + g.totalDebit, 0);
        const grandCr = glAccountGroups.reduce((s, g) => s + g.totalCredit, 0);
        return (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className={`p-5 sm:p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className={`text-[18px] font-semibold tracking-[-0.01em] ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                    <ReceiptText className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                    General Ledger
                  </h3>
                  <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                    GAAP/IFRS Immutability Enforced
                  </span>
                </div>
                <p className={`text-[13px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                  Expandable account tree with audit-grade immutability. Corrections are posted exclusively via counter-entries.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={glSearch}
                    onChange={(e) => setGlSearch(e.target.value)}
                    placeholder="Search voucher or description..."
                    className={`pl-8 pr-3 py-1.5 text-[13px] rounded-xl border focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A] w-56 ${
                      isLight
                        ? 'bg-white border-gray-300 text-gray-900'
                        : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
                    }`}
                  />
                </div>

                <select
                  value={glRefFilter}
                  onChange={(e) => setGlRefFilter(e.target.value)}
                  className={`px-3 py-1.5 text-[13px] rounded-xl border font-medium ${
                    isLight
                      ? 'bg-white border-gray-200 text-gray-800 focus:border-[#0F4C3A]'
                      : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                  }`}
                >
                  <option value="ALL">All Ref Types</option>
                  <option value="POS_SALE">POS Sales</option>
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

                <button
                  type="button"
                  onClick={() =>
                    setExpandedGlCodes(
                      allGlExpanded ? new Set() : new Set(glAccountGroups.map((g) => g.accountCode))
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                      : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800/80 text-slate-200'
                  }`}
                >
                  {allGlExpanded ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] font-sans tabular-nums border-collapse">
              <thead>
                <tr className={`border-b text-[12px] font-semibold ${
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-600' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
                }`}>
                  <th className="py-3 px-5">Line Description / Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 gm-col-tint-partner">Partner</th>
                  <th className="py-3 px-3 text-center">Currency</th>
                  <th className="py-3 px-4 text-right">Debit</th>
                  <th className="py-3 px-4 text-right">Credit</th>
                  <th className="py-3 px-5 text-right gm-col-tint-balance">Balance</th>
                  <th className="py-3 px-4 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200/80' : 'divide-slate-800/70'}`}>
                {glAccountGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`py-10 text-center text-[13px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                      No general ledger entries matching current filters.
                    </td>
                  </tr>
                ) : (
                  glAccountGroups.map((group) => {
                    const isExpanded = resolvedExpandedGlCodes.has(group.accountCode);
                    return (
                      <React.Fragment key={group.accountCode}>
                        {/* Expandable Account Tree Header Row */}
                        <tr
                          onClick={() => toggleExpandedSet(setExpandedGlCodes, resolvedExpandedGlCodes, group.accountCode)}
                          className={`cursor-pointer transition-colors ${isLight ? 'hover:bg-gray-50/70' : 'hover:bg-slate-900/50'}`}
                        >
                          <td className="py-3 px-5">
                            <span className="inline-flex items-center gap-2">
                              <span className="text-gray-400 text-xs w-3 inline-block">{isExpanded ? '▾' : '▸'}</span>
                              <span className={isExpanded ? 'font-semibold text-gray-900 dark:text-slate-100' : 'font-normal text-gray-800 dark:text-slate-200'}>
                                {group.accountCode} {group.accountName}
                              </span>
                              {isExpanded && (
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                  isLight ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-slate-800/80 text-slate-300 border-slate-700'
                                }`}>
                                  Journal Items
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{group.category}</td>
                          <td className="py-3 px-4 gm-col-tint-partner text-gray-500 dark:text-slate-400">
                            {group.entries.length} {group.entries.length === 1 ? 'item' : 'items'}
                          </td>
                          <td className="py-3 px-3 text-center text-gray-500 dark:text-slate-400">{selectedCurrency}</td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-slate-100">
                            {renderLedgerAmount(group.totalDebit)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-slate-100">
                            {renderLedgerAmount(group.totalCredit)}
                          </td>
                          <td className="py-3 px-5 text-right gm-col-tint-balance font-semibold text-gray-900 dark:text-slate-100">
                            {renderLedgerAmount(group.netBalance)}
                          </td>
                          <td className="py-3 px-4 text-right text-[12px] text-gray-400">
                            {isExpanded ? 'Hide' : 'View'}
                          </td>
                        </tr>

                        {/* Indented Child Journal Items */}
                        {isExpanded && (
                          <>
                            {group.entries.map((entry) => (
                              <tr
                                key={entry.id}
                                className={`transition-colors ${
                                  entry.isReversal
                                    ? isLight
                                      ? 'bg-purple-50/40 hover:bg-purple-50/70'
                                      : 'bg-purple-950/20 hover:bg-purple-950/30'
                                    : entry.isReversed
                                    ? isLight
                                      ? 'bg-gray-100/50 opacity-75'
                                      : 'bg-slate-900/50 opacity-75'
                                    : isLight
                                    ? 'bg-gray-50/30 hover:bg-gray-50/80'
                                    : 'bg-slate-900/20 hover:bg-slate-900/50'
                                }`}
                              >
                                <td className="py-2.5 pl-8 pr-5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-medium ${entry.isReversal ? 'text-purple-600 dark:text-purple-400' : 'text-[#0F4C3A] dark:text-emerald-400'}`}>
                                      {entry.id}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                      entry.referenceType === 'REVERSING_ENTRY'
                                        ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                        : isLight
                                        ? 'bg-gray-100 text-gray-600 border-gray-200'
                                        : 'bg-slate-900/90 text-slate-300 border-slate-800/80'
                                    }`}>
                                      {entry.referenceType}
                                    </span>
                                    {entry.isReversal && (
                                      <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                                        Reverses #{entry.reversesVoucherId}
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-[12.5px] mt-0.5 max-w-md truncate ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                                    {entry.description}
                                  </div>
                                </td>
                                <td className={`py-2.5 px-4 whitespace-nowrap ${isLight ? 'text-gray-600' : 'text-slate-400'}`}>
                                  {entry.timestamp.split('T')[0]}
                                </td>
                                <td className={`py-2.5 px-4 gm-col-tint-partner ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                                  {entry.partner}
                                </td>
                                <td className="py-2.5 px-3 text-center text-gray-500 dark:text-slate-400">
                                  {selectedCurrency}
                                </td>
                                <td className="py-2.5 px-4 text-right font-medium text-gray-900 dark:text-slate-100">
                                  {renderLedgerAmount(entry.debit)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-medium text-gray-900 dark:text-slate-100">
                                  {renderLedgerAmount(entry.credit)}
                                </td>
                                <td className="py-2.5 px-5 text-right gm-col-tint-balance font-medium text-gray-900 dark:text-slate-100">
                                  {renderLedgerAmount(entry.runningBalance)}
                                </td>
                                <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                  {entry.isReversed ? (
                                    <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                      Reversed
                                    </span>
                                  ) : entry.isReversal ? (
                                    <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                                      Counter-Voucher
                                    </span>
                                  ) : canManageAccountingAndGiro ? (
                                    <button
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        setReversalReason('');
                                        setReversingEntry(entry);
                                      }}
                                      className={`px-2.5 py-1 text-[12px] font-medium rounded-lg border transition-all cursor-pointer ${
                                        isLight
                                          ? 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700 shadow-2xs'
                                          : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800/80 text-slate-200'
                                      }`}
                                      title="Generate an audit-certified reversing counter-entry to correct this voucher"
                                    >
                                      Reverse Entry
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-gray-400 dark:text-slate-500">Posted</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {/* Account Group Summary Row */}
                            <tr className={`border-t border-b-[3px] border-double ${
                              isLight ? 'border-gray-300 text-gray-900' : 'border-slate-700 text-slate-100'
                            }`}>
                              <td colSpan={4} className="py-2.5 pl-8 pr-5 font-semibold">
                                Total {group.accountCode} {group.accountName}
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold">{renderLedgerAmount(group.totalDebit)}</td>
                              <td className="py-2.5 px-4 text-right font-semibold">{renderLedgerAmount(group.totalCredit)}</td>
                              <td className="py-2.5 px-5 text-right gm-col-tint-balance font-bold">{renderLedgerAmount(group.netBalance)}</td>
                              <td className="py-2.5 px-4" />
                            </tr>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {glAccountGroups.length > 0 && (
                <tfoot>
                  <tr className={`border-t-2 border-b-[3px] border-double ${
                    isLight ? 'bg-gray-50/90 border-gray-300 text-gray-900' : 'bg-[#090A0F] border-slate-700 text-slate-100'
                  }`}>
                    <td colSpan={4} className="py-3.5 px-5 font-bold text-[14px]">
                      Total General Ledger ({glAccountGroups.length} accounts · {filteredLedger.length} vouchers)
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[14px]">{renderLedgerAmount(grandDr)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-[14px]">{renderLedgerAmount(grandCr)}</td>
                    <td className="py-3.5 px-5 text-right gm-col-tint-balance font-bold text-[14px]">{renderLedgerAmount(grandDr - grandCr)}</td>
                    <td className="py-3.5 px-4" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        );
      })()}

      {/* SUB-TAB 5: CHART OF ACCOUNTS (COA) STRUCTURE */}
      {!complianceSubView && subTab === 'coa' && (
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
              : 'bg-[#12141C] border-slate-800/80'
          }`}
        >
          <div className={`p-5 sm:p-6 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className={`text-[18px] font-semibold tracking-[-0.01em] ${isLight ? 'text-gray-900' : 'text-slate-100'} flex items-center gap-2`}>
                  <Building2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                  Chart of Accounts (COA) Structure
                </h3>
                <p className={`text-[13px] ${isLight ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>
                  Multi-Store segregated account hierarchy compliant with standard Indonesian retail bookkeeping
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(['ALL', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCoaCategoryFilter(cat)}
                    className={`px-3 py-1.5 text-[12.5px] font-medium rounded-lg transition-all cursor-pointer ${
                      coaCategoryFilter === cat
                        ? 'bg-[#0F4C3A] text-white font-semibold shadow-xs'
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
            <table className="w-full text-left text-[13px] font-sans tabular-nums">
              <thead>
                <tr className={`border-b text-[12px] font-semibold ${
                  isLight ? 'border-gray-200 bg-gray-50/70 text-gray-600' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
                }`}>
                  <th className="py-3 px-5">Code</th>
                  <th className="py-3 px-4">Account Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Normal Balance</th>
                  <th className="py-3 px-4 gm-col-tint-partner">Reporting Hub</th>
                  <th className="py-3 px-5 text-right gm-col-tint-balance">Current Balance</th>
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
                    <td className="py-3 px-5 font-semibold text-[#0F4C3A] dark:text-emerald-400">
                      {acc.accountCode}
                    </td>
                    <td className={`py-3 px-4 font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                      {acc.accountName}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
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
                    <td className={`py-3 px-4 ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                      {acc.normalBalance}
                    </td>
                    <td className={`py-3 px-4 gm-col-tint-partner ${isLight ? 'text-gray-600' : 'text-slate-300'}`}>
                      {acc.storeId}
                    </td>
                    <td className={`py-3 px-5 text-right gm-col-tint-balance font-semibold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                      {renderLedgerAmount(acc.balance)}
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
          bridgeTarget={vendorBillBridgeTarget}
          onClearBridgeTarget={onClearVendorBillBridge}
          onNavigateToProcurementDoc={onNavigateToProcurementDoc}
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
          <div className={`p-5 sm:p-6 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'} space-y-4 font-sans`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800/80">
              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Wholesale Accounts Receivable Aging Matrix &amp; Plafond</span>
                </h3>
                <p className="text-[13px] text-gray-500 dark:text-slate-400">
                  B2B customer credit limit monitoring, AR aging buckets, and auto-freeze enforcement
                </p>
              </div>
              <span className="text-[12px] tabular-nums font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-900/90 text-gray-700 dark:text-slate-300 border border-transparent dark:border-slate-800/80">
                {b2bCustomers.length} Wholesale Accounts
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800/80">
              <table className="w-full text-left text-[13px] tabular-nums">
                <thead className="bg-gray-50 dark:bg-[#090A0F] text-[12px] font-semibold text-gray-600 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800/80">
                  <tr>
                    <th className="py-3 px-4">Customer &amp; Tier</th>
                    <th className="py-3 px-4 text-right">Credit Plafond</th>
                    <th className="py-3 px-4 text-right gm-col-tint-balance">Total AR Due</th>
                    <th className="py-3 px-4 text-right">Current (0–30d)</th>
                    <th className="py-3 px-4 text-right">31–60 Days</th>
                    <th className="py-3 px-4 text-right">&gt; 60 Days</th>
                    <th className="py-3 px-4">Facility Status</th>
                    <th className="py-3 px-4 text-right">Controller Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 font-normal">
                  {b2bCustomers.map((cust) => {
                    const isLocked = cust.status === 'CREDIT_LOCKED';
                    return (
                      <tr key={cust.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-900/60 transition-colors">
                        <td className="py-3.5 px-3.5">
                          <div className="font-bold text-gray-900 dark:text-slate-100">{cust.companyName}</div>
                          <div className="text-[11px] text-gray-500 dark:text-slate-400">{cust.name} ({cust.tierLabel})</div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-700 dark:text-slate-300">
                          {renderLedgerAmount(cust.creditLimit)}
                        </td>
                        <td className="py-3.5 px-4 text-right gm-col-tint-balance font-semibold text-gray-900 dark:text-slate-100">
                          {renderLedgerAmount(cust.outstandingAR)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-700 dark:text-emerald-400">
                          {renderLedgerAmount(Math.round(Math.max(0, cust.outstandingAR * 0.7)))}
                        </td>
                        <td className="py-3.5 px-4 text-right text-amber-700 dark:text-amber-400">
                          {renderLedgerAmount(Math.round(Math.max(0, cust.outstandingAR * 0.2)))}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-600 dark:text-rose-400">
                          {renderLedgerAmount(cust.overdueDaysMax > 0 ? Math.round(cust.outstandingAR * 0.1) : 0)}
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
          <div className={`p-5 sm:p-6 rounded-2xl border ${isLight ? 'bg-white border-gray-200 shadow-xs' : 'bg-[#12141C] border-slate-800/80'} space-y-4 font-sans`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800/80">
              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Bilyet Giro (PDC) Clearing &amp; Dishonor / Bounce Management</span>
                </h3>
                <p className="text-[13px] text-gray-500 dark:text-slate-400">
                  Warkat giro masuk, eksekusi kliring bank (COA #1020), atau proses tolak kliring dengan denda administratif
                </p>
              </div>
              <span className="text-[12px] tabular-nums font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-900/90 text-gray-700 dark:text-slate-300 border border-transparent dark:border-slate-800/80">
                {giroRecords.length} Giro Registers
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800/80">
              <table className="w-full text-left text-[13px] tabular-nums">
                <thead className="bg-gray-50 dark:bg-[#090A0F] text-[12px] font-semibold text-gray-600 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800/80">
                  <tr>
                    <th className="py-3 px-4">Giro No &amp; Bank</th>
                    <th className="py-3 px-4">Customer / Drawer</th>
                    <th className="py-3 px-4">Order Ref</th>
                    <th className="py-3 px-4">Clearing Due Date</th>
                    <th className="py-3 px-4 text-right gm-col-tint-balance">Nominal (IDR)</th>
                    <th className="py-3 px-4">Clearing Status</th>
                    <th className="py-3 px-4 text-right">Controller Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 font-normal">
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
                      <td className="py-3.5 px-4 text-right gm-col-tint-balance font-semibold text-gray-900 dark:text-slate-100">
                        {renderLedgerAmount(giro.amountIDR)}
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
          enableB2BFeatures={enableB2BFeatures}
          onRefreshData={onRefreshData}
          onShowToast={onShowToast}
        />
      )}

      {/* ADDITIVE VIEW: 1-CLICK EXECUTIVE FINANCIAL HEALTH DASHBOARD */}
      {complianceSubView === 'executive_health' && (
        <div className="space-y-5">
          <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isLight ? 'bg-white border-gray-200/90 shadow-xs' : 'bg-[#12141C] border-slate-800/80'
          }`}>
            <div>
              <h3 className={`text-[18px] font-semibold tracking-[-0.01em] flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                <Activity className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                Executive Summary — Real-Time Financial Health
              </h3>
              <p className={`text-[13px] mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
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
                <h3 className={`text-[16px] font-semibold tracking-[-0.01em] ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                  QRIS / EDC Batch Settlement &amp; MDR Fee Auto-Reconciliation
                </h3>
                <p className={`text-[13px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
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

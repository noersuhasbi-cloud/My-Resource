import React, { useState, useEffect } from 'react';
import type {
  StoreOperationalStatus,
  StoreOutletSchedule,
  WarehouseZone,
  StoreInventoryStock,
  InventoryItem,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiptRecord,
  ChartOfAccount,
  GeneralLedgerEntry,
  ProfitAndLossReport,
  BalanceSheetReport,
  CashFlowStatementReport,
  OmzetAnalyticsReport,
  TransactionAuditRecord,
  StaffShiftSession,
  ClimateAdaptiveThresholdConfig,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  LayoutDashboard,
  Store,
  Boxes,
  Truck,
  ReceiptText,
  FileCode2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  DollarSign,
  ShieldAlert,
  ArrowUpRight,
  SlidersHorizontal,
  ChevronRight,
  Package,
  Layers,
  Sparkles,
  Thermometer,
  FileCheck2,
  Calendar,
  Building2,
  Scale,
  ArrowDownRight,
  QrCode,
  Info,
  Check,
  X,
  Edit3,
  Sun,
  Moon,
  Trash2,
  Scan,
  Database,
  BookOpen,
  PanelLeftClose,
  PanelLeft,
  Menu,
  ChevronDown,
  Settings,
  Users,
  Globe2,
  Droplets,
  Wind,
} from 'lucide-react';

import { FefoModule } from './FefoModule';
import { WasteModule } from './WasteModule';
import { PickerModule } from './PickerModule';
import { ErdSpecsModule } from './ErdSpecsModule';
import { ProcurementModule } from './ProcurementModule';
import { AccountingModule } from './AccountingModule';
import { RbacModule } from './RbacModule';
import { SecurityAuditModule } from './SecurityAuditModule';
import { AdminSidebar, AdminDashboardTab, AccountingSubTab } from './AdminSidebar';

interface AdminDashboardProps {
  onCloseToStorefront: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onCloseToStorefront,
  onShowToast,
}) => {
  // Theme Toggle: Clean Light Mode (Default) & Dark Mode
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('grocemart_admin_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light'; // Default clean light mode
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem('grocemart_admin_theme', next);
    } catch {}
  };

  const isLight = theme === 'light';

  // Global Store Outlet Filter Selector
  const [selectedGlobalStore, setSelectedGlobalStore] = useState<string>('CONSOLIDATED');

  // Sidebar Layout State (Responsive Desktop Collapse & Mobile Drawer)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('grocemart_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isFinanceMenuOpen, setIsFinanceMenuOpen] = useState<boolean>(true);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState<boolean>(true);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('grocemart_admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [activeTab, setActiveTab] = useState<AdminDashboardTab>('overview');

  // RBAC Staff Session State (Module 3)
  const [activeStaffSession, setActiveStaffSession] = useState<StaffShiftSession | null>(null);
  const [availableStaffProfiles, setAvailableStaffProfiles] = useState<StaffShiftSession[]>([]);

  // Climate-Adaptive Cold Chain State (Module 4)
  const [climateConfigs, setClimateConfigs] = useState<ClimateAdaptiveThresholdConfig[]>([]);

  // Active sub-item for Accounting deep-linking
  const [accountingDeepSubTab, setAccountingDeepSubTab] = useState<'pnl' | 'balance_sheet' | 'cash_flow' | 'gl' | 'coa'>('pnl');

  // Loading & refresh
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Executive Omzet Analytics
  const [omzetData, setOmzetData] = useState<OmzetAnalyticsReport | null>(null);

  // Store Operations & Outlets
  const [storeStatus, setStoreStatus] = useState<StoreOperationalStatus | null>(null);
  const [storeOutlets, setStoreOutlets] = useState<StoreOutletSchedule[]>([]);
  const [bannerInput, setBannerInput] = useState<string>('');
  const [reopenInput, setReopenInput] = useState<string>('');
  const [editingOutlet, setEditingOutlet] = useState<StoreOutletSchedule | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // State Machine Guard Y.4: Store Closure Override Warning Modal
  const [closureWarningModal, setClosureWarningModal] = useState<{
    outlet: StoreOutletSchedule;
    warningMessage: string;
    activeOrdersCount: number;
  } | null>(null);

  // Multi-Warehouse & Inventory
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouseZones, setWarehouseZones] = useState<WarehouseZone[]>([]);
  const [inventoryTiers, setInventoryTiers] = useState<StoreInventoryStock[]>([]);
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('ALL');
  const [selectedStorageZoneFilter, setSelectedStorageZoneFilter] = useState<string>('ALL');
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [editingTier, setEditingTier] = useState<StoreInventoryStock | null>(null);
  const [inventoryMetrics, setInventoryMetrics] = useState({
    totalStockCount: 0,
    totalValuationWAC: 0,
    lowStockCount: 0,
    totalSkus: 0,
  });

  // Stock Adjustment Modal
  const [adjustingSku, setAdjustingSku] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Stocktake physical audit');

  // Procurement & Goods Receipts
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceiptRecord[]>([]);
  const [isCreatingPR, setIsCreatingPR] = useState<boolean>(false);
  const [selectedPrSku, setSelectedPrSku] = useState<string>('');
  const [prQuantity, setPrQuantity] = useState<number>(50);
  const [prStoreId, setPrStoreId] = useState<string>('store-jkt-senopati');

  // Partial Goods Receipt Modal
  const [activeReceivingPO, setActiveReceivingPO] = useState<PurchaseOrder | null>(null);
  const [deliveryNoteInput, setDeliveryNoteInput] = useState<string>('');
  const [receivedByInput, setReceivedByInput] = useState<string>('Receiving Officer');
  const [receiverNotesInput, setReceiverNotesInput] = useState<string>('');
  const [receivingItemsState, setReceivingItemsState] = useState<{
    [sku: string]: {
      quantityReceived: number;
      batchNumber: string;
      expiryDate: string;
      qualityCondition: string;
      tempCheckCelsius: number;
    };
  }>({});
  const [isSubmittingGR, setIsSubmittingGR] = useState<boolean>(false);

  // Financial Accounting & Multi-Store COA
  const [selectedFinanceStore, setSelectedFinanceStore] = useState<string>('CONSOLIDATED');
  const [financeSubTab, setFinanceSubTab] = useState<'pnl' | 'balance_sheet' | 'cash_flow' | 'gl' | 'coa'>('pnl');
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<GeneralLedgerEntry[]>([]);
  const [pnlReport, setPnlReport] = useState<ProfitAndLossReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowStatementReport | null>(null);
  const [auditRecords, setAuditRecords] = useState<TransactionAuditRecord[]>([]);
  const [glSearch, setGlSearch] = useState<string>('');

  // Load all backend data
  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      const [
        omzetRes,
        statusRes,
        outletsRes,
        invRes,
        matrixRes,
        prRes,
        poRes,
        grRes,
        coaRes,
        glRes,
        pnlRes,
        bsRes,
        cfRes,
        auditRes,
        rbacRes,
        climateRes,
      ] = await Promise.all([
        apiClient.getOmzetAnalytics().catch(() => null),
        apiClient.getStoreStatus(),
        apiClient.getStoreOutlets().catch(() => []),
        apiClient.getInventory(),
        apiClient.getInventoryMatrix().catch(() => ({ warehouseZones: [], storeInventoryTiers: [], outlets: [] })),
        apiClient.getPurchaseRequests(),
        apiClient.getPurchaseOrders(),
        apiClient.getGoodsReceipts().catch(() => []),
        apiClient.getChartOfAccounts().catch(() => []),
        apiClient.getGeneralLedger(selectedFinanceStore),
        apiClient.getPnLReport(selectedFinanceStore),
        apiClient.getBalanceSheet(selectedFinanceStore).catch(() => null),
        apiClient.getCashFlow(selectedFinanceStore).catch(() => null),
        apiClient.getAuditTrail(),
        apiClient.getRbacSession().catch(() => null),
        apiClient.getClimateThresholds().catch(() => []),
      ]);

      if (rbacRes) {
        setActiveStaffSession(rbacRes.currentSession);
        setAvailableStaffProfiles(rbacRes.availableProfiles || []);
      }
      setClimateConfigs(climateRes || []);

      setOmzetData(omzetRes);
      setStoreStatus(statusRes);
      setBannerInput(statusRes.noticeBanner || '');
      setReopenInput(statusRes.reopenEstimated || '07:00 - 22:00 Daily');
      setStoreOutlets(outletsRes);

      setInventory(invRes.items);
      setInventoryMetrics(invRes.metrics);
      setWarehouseZones(matrixRes.warehouseZones || []);
      setInventoryTiers(matrixRes.storeInventoryTiers || []);

      setPurchaseRequests(prRes);
      setPurchaseOrders(poRes);
      setGoodsReceipts(grRes);

      setChartOfAccounts(coaRes);
      setLedgerEntries(glRes);
      setPnlReport(pnlRes);
      setBalanceSheet(bsRes);
      setCashFlow(cfRes);
      setAuditRecords(auditRes);
    } catch (err) {
      console.error('Failed to load dashboard data from backend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Reload financials when store filter changes
  useEffect(() => {
    const loadStoreFinancials = async () => {
      try {
        const [glRes, pnlRes, bsRes, cfRes] = await Promise.all([
          apiClient.getGeneralLedger(selectedFinanceStore),
          apiClient.getPnLReport(selectedFinanceStore),
          apiClient.getBalanceSheet(selectedFinanceStore).catch(() => null),
          apiClient.getCashFlow(selectedFinanceStore).catch(() => null),
        ]);
        setLedgerEntries(glRes);
        setPnlReport(pnlRes);
        setBalanceSheet(bsRes);
        setCashFlow(cfRes);
      } catch (e) {
        console.error('Failed to load store-specific financial data:', e);
      }
    };
    loadStoreFinancials();
  }, [selectedFinanceStore]);

  // Handlers for Store Operations
  const handleToggleStoreOpen = async () => {
    if (!storeStatus) return;
    setIsUpdatingStatus(true);
    try {
      const newOpen = !storeStatus.isOpen;
      const res = await apiClient.updateStoreStatus({
        isOpen: newOpen,
        isHolidayMode: !newOpen,
        noticeBanner: !newOpen ? (bannerInput || 'Notice: All GroceMart outlets are temporarily closed for scheduled cold-chain inventory audit. Catalog browsing remains available.') : '',
      });
      if (res.storeStatus) {
        setStoreStatus(res.storeStatus);
      }
      onShowToast(
        newOpen ? 'Store Network Opened' : 'Network Closure Mode Activated',
        newOpen ? 'Customer checkouts are live and accepting QRIS payments.' : 'Customer checkouts locked across all outlets.'
      );
    } catch (err) {
      onShowToast('Update Failed', String(err));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveBanner = async () => {
    if (!storeStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await apiClient.updateStoreStatus({
        noticeBanner: bannerInput,
        reopenEstimated: reopenInput,
      });
      if (res.storeStatus) {
        setStoreStatus(res.storeStatus);
      }
      onShowToast('Notice Banner Updated', 'Custom announcement published to storefront header.');
    } catch (err) {
      onShowToast('Update Failed', String(err));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleToggleOutletEmergency = async (outlet: StoreOutletSchedule, forceOverride = false) => {
    try {
      const updatedEmergency = forceOverride ? true : !outlet.isEmergencyClosed;
      const res = await apiClient.updateStoreOutlet(outlet.storeId, {
        isEmergencyClosed: updatedEmergency,
        closureReason: updatedEmergency ? 'Emergency refrigeration maintenance' : '',
        forceOverride,
      });

      if (res.requiresConfirmation || res.warning === 'ACTIVE_DELIVERIES_IN_PROGRESS') {
        setClosureWarningModal({
          outlet,
          warningMessage: res.message || `${res.activeOrdersCount || 'Active'} orders currently in transit.`,
          activeOrdersCount: res.activeOrdersCount || 1,
        });
        return;
      }

      if (res.outlet) {
        const updatedOutlet = res.outlet;
        setStoreOutlets((prev) => prev.map((o) => (o.storeId === outlet.storeId ? updatedOutlet : o)));
      }
      onShowToast(
        updatedEmergency ? `${outlet.storeName} Closed` : `${outlet.storeName} Reopened`,
        updatedEmergency ? 'Checkout restricted for this specific outlet; catalog view retained.' : 'Operating schedule restored.'
      );
    } catch (err: any) {
      onShowToast('Outlet Update Failed', String(err?.message || err));
    }
  };

  const handleSaveOutletHours = async () => {
    if (!editingOutlet) return;
    try {
      const res = await apiClient.updateStoreOutlet(editingOutlet.storeId, {
        openTime: editingOutlet.openTime,
        closeTime: editingOutlet.closeTime,
        daysOpen: editingOutlet.daysOpen,
        isHolidayMode: editingOutlet.isHolidayMode,
        holidayNotice: editingOutlet.holidayNotice,
        closureReason: editingOutlet.closureReason,
      });
      if (res.outlet) {
        const updatedOutlet = res.outlet;
        setStoreOutlets((prev) => prev.map((o) => (o.storeId === editingOutlet.storeId ? updatedOutlet : o)));
        onShowToast('Operating Hours Updated', `${res.outlet.storeName} schedule synchronized.`);
      }
      setEditingOutlet(null);
    } catch (err) {
      onShowToast('Update Failed', String(err));
    }
  };

  // Stock Adjustment
  const handlePerformStockAdjust = async () => {
    if (!adjustingSku || adjustQty === 0) return;
    try {
      const res = await apiClient.adjustStock(adjustingSku, adjustQty, adjustReason, selectedOutletFilter !== 'ALL' ? selectedOutletFilter : 'store-jkt-senopati');
      onShowToast('Inventory Adjusted', `Variance adjusted by ${adjustQty > 0 ? '+' : ''}${adjustQty} units. Journal entry logged.`);
      setAdjustingSku(null);
      setAdjustQty(0);
      refreshAllData();
    } catch (err) {
      onShowToast('Adjustment Error', String(err));
    }
  };

  // Procurement Handlers
  const handleCreatePR = async () => {
    if (!selectedPrSku) return;
    try {
      const res = await apiClient.createPurchaseRequest({
        sku: selectedPrSku,
        suggestedQuantity: prQuantity,
        reason: 'manual_request',
        priority: 'high',
        requestedBy: 'Store Operations Admin',
        storeId: prStoreId,
      });
      setPurchaseRequests((prev) => [res.purchaseRequest, ...prev]);
      setIsCreatingPR(false);
      onShowToast('Purchase Request Created', `${res.purchaseRequest.id} created for ${res.purchaseRequest.productName}.`);
    } catch (err) {
      onShowToast('PR Failed', String(err));
    }
  };

  const handleApprovePR = async (prId: string) => {
    try {
      const res = await apiClient.approvePurchaseRequest(prId);
      setPurchaseRequests((prev) => prev.map((p) => (p.id === prId ? res.purchaseRequest : p)));
      setPurchaseOrders((prev) => [res.purchaseOrder, ...prev]);
      onShowToast('PR Approved & PO Generated', `Converted to Purchase Order ${res.purchaseOrder.id}.`);
    } catch (err) {
      onShowToast('Approval Failed', String(err));
    }
  };

  // Partial Goods Receipt Setup
  const openReceivingModal = (po: PurchaseOrder) => {
    setActiveReceivingPO(po);
    setDeliveryNoteInput(`SJ-VND-${Date.now().toString().slice(-5)}`);
    setReceivedByInput('Siti Rahmawati (Receiving Clerk)');
    setReceiverNotesInput('');

    // Prepopulate items with remaining backorder as suggested quantity
    const initialMap: typeof receivingItemsState = {};
    po.items.forEach((item) => {
      initialMap[item.sku] = {
        quantityReceived: item.remainingBackorder > 0 ? item.remainingBackorder : item.orderedQuantity,
        batchNumber: `BAT-${Date.now().toString().slice(-6)}`,
        expiryDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
        qualityCondition: 'Cold-Chain Verified',
        tempCheckCelsius: 3.8,
      };
    });
    setReceivingItemsState(initialMap);
  };

  const handleSubmitPartialGR = async () => {
    if (!activeReceivingPO) return;
    setIsSubmittingGR(true);
    try {
      const itemsPayload = Object.entries(receivingItemsState).map(([sku, data]) => ({
        sku,
        quantityReceived: data.quantityReceived,
        batchNumber: data.batchNumber,
        expiryDate: data.expiryDate,
        qualityCondition: data.qualityCondition,
        tempCheckCelsius: data.tempCheckCelsius,
      }));

      const res = await apiClient.receivePartialGoods({
        poId: activeReceivingPO.id,
        deliveryNoteNumber: deliveryNoteInput,
        receivedBy: receivedByInput,
        receiverNotes: receiverNotesInput,
        warehouseZoneId: activeReceivingPO.warehouseZoneId || 'WH-JKT-SEN-COLD',
        items: itemsPayload,
      });

      onShowToast(
        res.isPartial ? 'Partial Goods Receipt Recorded' : 'PO 100% Fulfilled',
        `GR #${res.goodsReceipt.id} processed. ${res.remainingBackorder} units backorder remaining. GL #${res.journalEntryIds[0]} auto-posted.`
      );

      setActiveReceivingPO(null);
      refreshAllData();
    } catch (err) {
      onShowToast('Goods Receipt Failed', String(err));
    } finally {
      setIsSubmittingGR(false);
    }
  };

  // Filtered inventory matrix
  const filteredTiers = inventoryTiers.filter((tier) => {
    if (selectedOutletFilter !== 'ALL' && tier.storeId !== selectedOutletFilter) return false;
    if (selectedStorageZoneFilter !== 'ALL' && tier.storageType !== selectedStorageZoneFilter) return false;
    if (inventorySearch) {
      const q = inventorySearch.toLowerCase();
      return (
        tier.productName.toLowerCase().includes(q) ||
        tier.sku.toLowerCase().includes(q) ||
        tier.storeName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const cardClass = isLight
    ? 'bg-white border border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)] text-gray-900 rounded-2xl'
    : 'bg-stone-900/90 border border-stone-800 text-stone-100 rounded-2xl';
  const subCardClass = isLight
    ? 'bg-white border border-gray-200 text-gray-900 rounded-xl shadow-xs'
    : 'bg-stone-800/80 border border-stone-700 text-stone-100 rounded-xl';
  const textTitle = isLight ? 'text-gray-900' : 'text-white';
  const textMuted = isLight ? 'text-gray-500' : 'text-stone-400';
  const tableHeaderClass = isLight
    ? 'border-b border-gray-200 bg-gray-50/70 text-gray-500 font-semibold uppercase text-[10px]'
    : 'border-b border-stone-800 bg-stone-800/50 text-stone-400 font-semibold uppercase text-[10px]';
  const inputClass = isLight
    ? 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
    : 'bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500';
  const modalClass = isLight
    ? 'bg-white border border-gray-200 text-gray-900 shadow-2xl rounded-2xl'
    : 'bg-stone-900 border border-stone-700 text-white shadow-2xl rounded-2xl';

  const currentModuleTitle = (() => {
    switch (activeTab) {
      case 'overview':
        return 'Executive Omzet & Key Metrics';
      case 'operations':
        return 'Store & Multi-Outlet Operations';
      case 'inventory':
        return 'Inventory & Multi-Warehouse Matrix';
      case 'fefo':
        return 'FEFO & Batch Expiry Traceability';
      case 'waste':
        return 'Waste & Shrinkage Adjustments';
      case 'picker':
        return 'Fulfillment & Catch-Weight Terminal';
      case 'procurement':
        return 'Procurement & Supply Chain (PR/PO/GR)';
      case 'accounting':
        return 'Financial Accounting & Multi-Store COA';
      case 'openapi':
        return 'QRIS Bank Indonesia Open API Specs';
      case 'erd':
        return 'System Architecture & ERD Specifications';
      case 'rbac':
        return 'Roles & Shifts Access Control (RBAC)';
      case 'audit':
        return 'Security & Administrative Audit Logs';
      default:
        return 'Enterprise Management';
    }
  })();

  return (
    <div className={`min-h-screen ${isLight ? 'bg-[#F9FAFB] text-gray-900' : 'bg-stone-950 text-stone-100'} flex font-sans transition-colors duration-200 overflow-x-hidden`}>
      {/* 1. Left Vertical Sidebar Component */}
      <AdminSidebar
        theme={theme}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        accountingSubTab={accountingDeepSubTab}
        onSelectAccountingSubTab={(sub) => setAccountingDeepSubTab(sub)}
        isFinanceMenuOpen={isFinanceMenuOpen}
        onToggleFinanceMenu={() => setIsFinanceMenuOpen((prev) => !prev)}
        isSettingsMenuOpen={isSettingsMenuOpen}
        onToggleSettingsMenu={() => setIsSettingsMenuOpen((prev) => !prev)}
        emergencyClosedCount={storeOutlets.filter((o) => o.isEmergencyClosed).length}
        lowStockCount={inventoryMetrics.lowStockCount}
        partialPoCount={purchaseOrders.filter((p) => p.status === 'Partially Received').length}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onCloseToStorefront={onCloseToStorefront}
      />

      {/* 2. Main Content Wrapper with Dynamic Left Margin corresponding to Sidebar */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Utility Header Bar */}
        <header
          className={`${
            isLight ? 'bg-white/95 border-gray-200/90 text-gray-900 shadow-2xs' : 'bg-stone-900/95 border-stone-800 text-white'
          } backdrop-blur-md border-b sticky top-0 z-30 px-4 sm:px-6 py-2.5 transition-colors duration-200`}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Left: Mobile Hamburger Toggle + Current Module Breadcrumb */}
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Trigger */}
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className={`lg:hidden p-2 rounded-xl border text-xs transition-colors flex items-center justify-center ${
                  isLight
                    ? 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                    : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-200'
                }`}
                aria-label="Open navigation sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-gray-400' : 'text-stone-500'}`}>
                    GroceMart ERP
                  </span>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                  <h1 className={`text-sm sm:text-base font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    {currentModuleTitle}
                  </h1>
                </div>
                <div className="flex items-center gap-2 mt-0.5 hidden sm:flex">
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400 border border-[#0F4C3A]/20">
                    Supply Chain v2.4
                  </span>
                  <span className="text-[11px] text-gray-400">•</span>
                  <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                    Multi-Warehouse Cold Chain, FEFO &amp; Consolidate COA
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Active Staff Session + Consolidated Store Selector + Dark/Light Toggle + Sync Button */}
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              {/* Active Operator RBAC Badge & Identity Switcher */}
              {activeStaffSession && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold ${
                    isLight ? 'bg-emerald-500/10 border-emerald-500/25 text-[#0F4C3A]' : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                  <span className="hidden xl:inline text-[11px] text-gray-500 dark:text-stone-400 font-normal">Operator:</span>
                  <span className="font-bold truncate max-w-[120px]">{activeStaffSession.userName}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0F4C3A]/15 text-[#0F4C3A] dark:text-emerald-300 uppercase font-mono">
                    {activeStaffSession.userRole.replace(/_/g, ' ')}
                  </span>
                  <select
                    value={activeStaffSession.userId}
                    onChange={async (e) => {
                      try {
                        const res = await apiClient.switchRbacSession(e.target.value);
                        setActiveStaffSession(res.session);
                        onShowToast(
                          'Staff Identity Switched',
                          `Switched to ${res.session.userName} (${res.session.userRole.replace(/_/g, ' ')})`
                        );
                      } catch (err) {
                        onShowToast('Switch Failed', String(err));
                      }
                    }}
                    className={`text-[11px] font-semibold bg-transparent border-0 cursor-pointer focus:ring-0 p-0 ml-1 ${
                      isLight ? 'text-gray-700' : 'text-stone-200'
                    }`}
                    title="Switch Active Operator Identity"
                  >
                    {availableStaffProfiles.map((p) => (
                      <option
                        key={p.userId}
                        value={p.userId}
                        className={isLight ? 'bg-white text-gray-900' : 'bg-stone-900 text-white'}
                      >
                        {p.userName} ({p.userRole.replace(/_/g, ' ')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Global Outlet Selector Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-medium hidden md:inline ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                  Outlet Scope:
                </span>
                <select
                  value={selectedGlobalStore}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedGlobalStore(val);
                    setSelectedOutletFilter(val);
                    setSelectedFinanceStore(val);
                    onShowToast(
                      'Store Filter Applied',
                      val === 'CONSOLIDATED' ? 'Showing Consolidated Network Data' : `Filtered to ${val}`
                    );
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isLight
                      ? 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50 focus:border-[#0F4C3A]'
                      : 'bg-stone-800 border-stone-700 text-stone-100 hover:bg-stone-700'
                  }`}
                >
                  <option value="CONSOLIDATED">All Outlets (Consolidated Network)</option>
                  <option value="store-jkt-senopati">Senopati Flagship (Jakarta)</option>
                  <option value="store-jkt-pik">PIK 2 The Avenue (Jakarta)</option>
                  <option value="store-jkt-menteng">Menteng Heritage (Jakarta)</option>
                  <option value="store-bdg-dago">Dago Green Market (Bandung)</option>
                  <option value="store-sby-gubeng">Gubeng Central Hub (Surabaya)</option>
                  <option value="store-bali-canggu">Batu Bolong Organic (Bali)</option>
                </select>
              </div>

              {/* Dark / Light Mode Instant Toggle Switch */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-xl border text-xs font-medium transition-all flex items-center justify-center ${
                  isLight
                    ? 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700 shadow-2xs'
                    : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-amber-400'
                }`}
                title={isLight ? 'Switch to Dark Mode' : 'Switch to Clean Light Mode'}
                aria-label="Toggle theme"
              >
                {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>

              {/* Refresh Sync Button */}
              <button
                onClick={refreshAllData}
                disabled={isLoading}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all disabled:opacity-50 ${
                  isLight
                    ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-2xs'
                    : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-300'
                }`}
                title="Refresh Backend Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync Data</span>
              </button>
            </div>
          </div>
        </header>

        {/* 3. Main Content Area */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* ========================================================================= */}
          {/* TAB 1: EXECUTIVE OMZET & OVERVIEW */}
          {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`${cardClass} p-5`}>
                <div className={`flex items-center justify-between ${textMuted} text-xs font-medium`}>
                  <span>Gross Omzet (October MTD)</span>
                  <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                </div>
                <div className={`mt-3 text-2xl font-bold ${textTitle} tracking-tight`}>
                  {formatIDR(omzetData?.totalRevenueMTD || 388500000)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +{omzetData?.momGrowthPercent || 18.2}% MoM
                  </span>
                  <span className={textMuted}>•</span>
                  <span className={textMuted}>+{omzetData?.wowGrowthPercent || 12.4}% WoW</span>
                </div>
              </div>

              <div className={`${cardClass} p-5`}>
                <div className={`flex items-center justify-between ${textMuted} text-xs font-medium`}>
                  <span>Total Settled Orders</span>
                  <span className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Package className="w-4 h-4" />
                  </span>
                </div>
                <div className={`mt-3 text-2xl font-bold ${textTitle} tracking-tight`}>
                  {(omzetData?.totalOrders || 1311).toLocaleString('id-ID')}
                </div>
                <div className={`mt-2 flex items-center gap-2 text-xs ${textMuted}`}>
                  <span>Avg Basket:</span>
                  <span className={`font-semibold ${textTitle}`}>
                    {formatIDR(omzetData?.averageBasketValue || 296338)}
                  </span>
                </div>
              </div>

              <div className={`${cardClass} p-5`}>
                <div className={`flex items-center justify-between ${textMuted} text-xs font-medium`}>
                  <span>QRIS Conversion Rate</span>
                  <span className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                    <QrCode className="w-4 h-4" />
                  </span>
                </div>
                <div className={`mt-3 text-2xl font-bold ${textTitle} tracking-tight`}>
                  {omzetData?.qrisMetrics.conversionRatePercent || 96.8}%
                </div>
                <div className={`mt-2 flex items-center gap-2 text-xs ${textMuted}`}>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                    {omzetData?.qrisMetrics.settledCount || 1336} / {omzetData?.qrisMetrics.totalAttempts || 1380} paid
                  </span>
                  <span>•</span>
                  <span>Avg {omzetData?.qrisMetrics.averageSettlementSeconds || 6.2}s</span>
                </div>
              </div>

              <div className={`${cardClass} p-5`}>
                <div className={`flex items-center justify-between ${textMuted} text-xs font-medium`}>
                  <span>Inventory Health</span>
                  <span className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                </div>
                <div className={`mt-3 text-2xl font-bold ${textTitle} tracking-tight`}>
                  {formatIDR(inventoryMetrics.totalValuationWAC || 48200000)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className={`font-semibold ${inventoryMetrics.lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                    {inventoryMetrics.lowStockCount} items low stock
                  </span>
                  <span className={textMuted}>•</span>
                  <span className={textMuted}>{inventoryMetrics.totalStockCount} units in bins</span>
                </div>
              </div>
            </div>

            {/* Omzet by Store Outlet & Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Store Outlet Breakdown */}
              <div className={`lg:col-span-2 ${cardClass} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className={`text-base font-bold ${textTitle}`}>Omzet per Outlet Store</h2>
                    <p className={`text-xs ${textMuted}`}>Granular performance across Indonesian physical hubs</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-300 rounded-lg border border-emerald-500/20">
                    6 Active Outlets
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={tableHeaderClass}>
                        <th className="py-2.5 px-3">Store Location</th>
                        <th className="py-2.5 px-3">City</th>
                        <th className="py-2.5 px-3">Orders</th>
                        <th className="py-2.5 px-3">Revenue (IDR)</th>
                        <th className="py-2.5 px-3">Contribution</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLight ? 'divide-stone-200' : 'divide-stone-800'}`}>
                      {(omzetData?.storeBreakdown || []).map((store) => (
                        <tr key={store.storeId} className={`transition-colors ${isLight ? 'hover:bg-stone-50/80' : 'hover:bg-stone-800/40'}`}>
                          <td className={`py-3 px-3 font-semibold ${textTitle}`}>
                            {store.storeName}
                          </td>
                          <td className={`py-3 px-3 ${isLight ? 'text-stone-600' : 'text-stone-300'}`}>{store.city}</td>
                          <td className={`py-3 px-3 ${isLight ? 'text-stone-600' : 'text-stone-300'}`}>{store.orderCount}</td>
                          <td className="py-3 px-3 font-mono font-semibold text-[#0F4C3A] dark:text-emerald-400">
                            {formatIDR(store.omzet)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-16 ${isLight ? 'bg-stone-200' : 'bg-stone-700'} h-1.5 rounded-full overflow-hidden`}>
                                <div
                                  className="bg-[#0F4C3A] dark:bg-emerald-500 h-full rounded-full"
                                  style={{ width: `${store.sharePercent}%` }}
                                />
                              </div>
                              <span className={`text-[11px] ${textMuted} font-mono`}>
                                {store.sharePercent}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Open
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category Share */}
              <div className={`${cardClass} p-5 space-y-4`}>
                <div>
                  <h2 className={`text-base font-bold ${textTitle}`}>Category Distribution</h2>
                  <p className={`text-xs ${textMuted}`}>Share of revenue by grocery department</p>
                </div>

                <div className="space-y-3">
                  {(omzetData?.categoryBreakdown || []).map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={`${textTitle} font-medium`}>{cat.label}</span>
                        <span className="text-[#0F4C3A] dark:text-emerald-400 font-mono font-semibold">{cat.sharePercent}%</span>
                      </div>
                      <div className={`w-full ${isLight ? 'bg-stone-200' : 'bg-stone-700'} h-2 rounded-full overflow-hidden`}>
                        <div
                          className="bg-[#0F4C3A] dark:bg-emerald-500 h-full rounded-full"
                          style={{ width: `${cat.sharePercent}%` }}
                        />
                      </div>
                      <div className={`flex justify-between text-[11px] ${textMuted}`}>
                        <span>{cat.unitsSold.toLocaleString('id-ID')} units sold</span>
                        <span>{formatIDR(cat.omzet)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`pt-2 border-t ${isLight ? 'border-stone-200' : 'border-stone-700/60'}`}>
                  <div className={`p-3 ${isLight ? 'bg-emerald-50/80 border border-emerald-200 text-stone-800' : 'bg-stone-800/80 border border-stone-700 text-stone-300'} rounded-xl text-xs flex items-start gap-2.5`}>
                    <Sparkles className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className={`font-semibold ${textTitle}`}>Cold-Chain Priority</p>
                      <p className={`${textMuted} text-[11px] mt-0.5`}>
                        Fresh Produce &amp; Chilled Dairy represent 61.4% of retail volume, requiring active temperature verification at Goods Receipt.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Revenue SKUs */}
            <div className={`${cardClass} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-base font-bold ${textTitle}`}>Top-Selling SKUs by Revenue</h2>
                  <p className={`text-xs ${textMuted}`}>Fastest-moving items generating maximum gross margin</p>
                </div>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="text-xs text-[#0F4C3A] dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                >
                  View Inventory Matrix
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {(omzetData?.topSkus || []).map((sku) => (
                  <div key={sku.sku} className={`${subCardClass} p-3.5 space-y-1.5`}>
                    <span className={`text-[10px] font-mono ${textMuted}`}>{sku.sku}</span>
                    <h3 className={`text-xs font-bold ${textTitle} line-clamp-1`}>{sku.productName}</h3>
                    <p className={`text-[11px] ${textMuted}`}>{sku.unitsSold} units sold</p>
                    <p className="text-xs font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{formatIDR(sku.revenue)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: STORE OPERATIONS & OPERATING HOURS */}
        {/* ========================================================================= */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            {/* Network Master Switch & Announcement Banner */}
            <div className={`${cardClass} p-6`}>
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
                <div>
                  <h2 className={`text-base font-bold ${textTitle} flex items-center gap-2`}>
                    <Store className="w-5 h-5 text-[#0F4C3A] dark:text-emerald-400" />
                    Company-Wide Storefront Network Status
                  </h2>
                  <p className={`text-xs ${textMuted} mt-0.5`}>
                    Control all 34 outlets simultaneously or override specific store hubs.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>
                      {storeStatus?.isOpen ? 'Network Online' : 'Network Closed'}
                    </span>
                    <button
                      onClick={handleToggleStoreOpen}
                      disabled={isUpdatingStatus}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        storeStatus?.isOpen ? 'bg-[#0F4C3A] dark:bg-emerald-600' : 'bg-red-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          storeStatus?.isOpen ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Banner Editor */}
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>
                      Customer Notice Banner (Displayed on Storefront Header)
                    </label>
                    <input
                      type="text"
                      value={bannerInput}
                      onChange={(e) => setBannerInput(e.target.value)}
                      placeholder="e.g. Fresh harvest arrives daily from Lembang! Open 07:00 - 22:00 WIB."
                      className={`w-full px-3.5 py-2 text-xs rounded-xl ${inputClass}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>
                      Estimated Operating Window
                    </label>
                    <input
                      type="text"
                      value={reopenInput}
                      onChange={(e) => setReopenInput(e.target.value)}
                      placeholder="Open 07:00 - 22:00 Daily"
                      className={`w-full px-3.5 py-2 text-xs rounded-xl ${inputClass}`}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveBanner}
                    disabled={isUpdatingStatus}
                    className="px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    Save &amp; Broadcast Banner
                  </button>
                </div>
              </div>
            </div>

            {/* Granular Outlets Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-base font-bold ${textTitle}`}>Store Outlets Schedule &amp; Closure Control</h2>
                  <p className={`text-xs ${textMuted}`}>Configure operating hours, local timezone, and emergency closure per location</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storeOutlets.map((outlet) => {
                  const isClosed = outlet.isEmergencyClosed || !storeStatus?.isOpen;
                  return (
                    <div
                      key={outlet.storeId}
                      className={`border rounded-2xl p-5 transition-all space-y-4 ${
                        isClosed
                          ? isLight
                            ? 'border-rose-200 bg-rose-50/40 text-stone-900'
                            : 'border-red-900/50 bg-red-950/10 text-white'
                          : cardClass
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${textTitle} text-sm`}>{outlet.storeName}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isLight ? 'bg-stone-100 text-stone-700 border border-stone-200' : 'bg-stone-800 text-stone-300'
                            }`}>
                              {outlet.timezone}
                            </span>
                          </div>
                          <p className={`text-xs ${textMuted} mt-0.5`}>{outlet.district}, {outlet.city}</p>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isClosed
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {isClosed ? 'CLOSED' : 'OPEN'}
                        </span>
                      </div>

                      <div className={`p-3 ${subCardClass} space-y-1.5 text-xs`}>
                        <div className="flex justify-between">
                          <span className={textMuted}>Operating Hours:</span>
                          <span className={`font-semibold ${textTitle}`}>{outlet.openTime} - {outlet.closeTime} {outlet.timezone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textMuted}>Days Active:</span>
                          <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>{outlet.daysOpen}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textMuted}>Contact:</span>
                          <span className={`font-mono ${isLight ? 'text-stone-700' : 'text-stone-400'}`}>{outlet.contactPhone}</span>
                        </div>
                      </div>

                      {outlet.isEmergencyClosed && outlet.closureReason && (
                        <div className="p-2.5 bg-rose-50 dark:bg-red-950/40 border border-rose-200 dark:border-red-800/40 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                          <span>Emergency Note: {outlet.closureReason}</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className={`flex items-center justify-between pt-2 border-t ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
                        <button
                          onClick={() => handleToggleOutletEmergency(outlet)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                            outlet.isEmergencyClosed
                              ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/20'
                              : 'bg-rose-600/10 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-600/20'
                          }`}
                        >
                          {outlet.isEmergencyClosed ? 'Restore Open' : 'Emergency Close'}
                        </button>

                        <button
                          onClick={() => setEditingOutlet(outlet)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border ${
                            isLight
                              ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                              : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Schedule
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Edit Outlet Modal */}
            {editingOutlet && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                <div className={`${modalClass} max-w-lg w-full p-6 space-y-4`}>
                  <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
                    <h3 className={`text-base font-bold ${textTitle}`}>Edit Schedule: {editingOutlet.storeName}</h3>
                    <button
                      onClick={() => setEditingOutlet(null)}
                      className={`p-1.5 rounded-lg transition-colors ${isLight ? 'hover:bg-stone-100 text-stone-500' : 'hover:bg-stone-800 text-stone-400'}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Open Time</label>
                      <input
                        type="time"
                        value={editingOutlet.openTime}
                        onChange={(e) => setEditingOutlet({ ...editingOutlet, openTime: e.target.value })}
                        className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Close Time</label>
                      <input
                        type="time"
                        value={editingOutlet.closeTime}
                        onChange={(e) => setEditingOutlet({ ...editingOutlet, closeTime: e.target.value })}
                        className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Days Open</label>
                    <input
                      type="text"
                      value={editingOutlet.daysOpen}
                      onChange={(e) => setEditingOutlet({ ...editingOutlet, daysOpen: e.target.value })}
                      className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Emergency Closure Reason (Optional)</label>
                    <input
                      type="text"
                      value={editingOutlet.closureReason || ''}
                      onChange={(e) => setEditingOutlet({ ...editingOutlet, closureReason: e.target.value })}
                      placeholder="e.g. Sub-zero walk-in chiller routine servicing"
                      className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                    />
                  </div>

                  <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
                    <button
                      onClick={() => setEditingOutlet(null)}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        isLight
                          ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                          : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveOutletHours}
                      className="px-4 py-2 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-sm transition-all"
                    >
                      Save Operating Hours
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MULTI-WAREHOUSE & STORE STOCK CONTROL */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* MODULE 4: Climate-Adaptive Cold-Chain Monitoring & Dynamic IoT Thresholds */}
            <div className={`${cardClass} p-5 border transition-all`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-stone-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0F4C3A] text-white uppercase tracking-wider">
                      Module 4 • Global Scalability
                    </span>
                    <span className={`text-xs ${textMuted}`}>
                      Climate-Adaptive IoT Cold-Chain Engine
                    </span>
                  </div>
                  <h3 className={`text-base font-bold ${textTitle}`}>
                    Climate-Adaptive Chiller &amp; Sub-Zero Storage Thresholds
                  </h3>
                  <p className={`text-xs ${textMuted} mt-0.5`}>
                    Dynamically adjusts IoT alert baselines based on local outdoor heatwaves (e.g. Australia extreme heat vs European temperate) to trigger early cooling alerts before spoilage occurs.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    <Thermometer className="w-3.5 h-3.5" />
                    IoT Telemetry Active
                  </span>
                </div>
              </div>

              {/* Climate Zones Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
                {climateConfigs.map((cfg) => {
                  const isBreached = cfg.isTempAlertActive;
                  const isCritical = cfg.alertSeverity === 'CRITICAL_BREACH';

                  return (
                    <div
                      key={cfg.warehouseZoneId}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                        isCritical
                          ? 'border-rose-500 bg-rose-500/5 shadow-xs'
                          : isBreached
                          ? 'border-amber-500 bg-amber-500/5'
                          : isLight
                          ? 'border-gray-200 bg-gray-50/70'
                          : 'border-stone-800 bg-stone-800/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-bold text-xs truncate text-gray-900 dark:text-white">
                            {cfg.zoneName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              isCritical
                                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 animate-pulse'
                                : isBreached
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {cfg.alertSeverity.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="text-[11px] text-gray-500 dark:text-stone-400 mb-3 flex items-center gap-1.5">
                          <Globe2 className="w-3 h-3 text-sky-500" />
                          <span>{cfg.regionalClimateProfile}</span>
                        </div>

                        {/* Ambient Weather vs Actual Zone Temp */}
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-white border-gray-200' : 'bg-stone-800 border-stone-700'}`}>
                            <span className="text-[10px] text-gray-400 block">External Weather:</span>
                            <div className="font-bold mt-0.5 flex items-center gap-1">
                              <Sun className="w-3 h-3 text-amber-500" />
                              {cfg.ambientExternalTempCelsius}°C ({cfg.externalHumidityPercent}%)
                            </div>
                          </div>

                          <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-white border-gray-200' : 'bg-stone-800 border-stone-700'}`}>
                            <span className="text-[10px] text-gray-400 block">Current IoT Sensor:</span>
                            <div className={`font-mono font-bold mt-0.5 ${isBreached ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {cfg.currentActualTempCelsius}°C
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-[11px] text-gray-500 dark:text-stone-400">
                          <div className="flex justify-between">
                            <span>Standard Safe Range:</span>
                            <span className="font-mono font-semibold text-gray-700 dark:text-stone-300">
                              {cfg.standardTempMinCelsius}°C to {cfg.standardTempMaxCelsius}°C
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Adaptive Offset (Heatwave):</span>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {cfg.adaptiveOffsetCelsius > 0 ? `+${cfg.adaptiveOffsetCelsius}` : cfg.adaptiveOffsetCelsius}°C
                            </span>
                          </div>
                          <div className="flex justify-between font-bold text-gray-800 dark:text-stone-200 pt-1 border-t border-gray-200 dark:border-stone-700">
                            <span>Active IoT Breach Trigger:</span>
                            <span className="font-mono text-rose-600 dark:text-rose-400">
                              &gt; {cfg.activeAlertThresholdCelsius}°C
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Threshold Offset Tweak */}
                      <div className="mt-3.5 pt-2.5 border-t border-gray-200 dark:border-stone-700 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-gray-400">
                          Adjust Adaptive Margin:
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={async () => {
                              const newOffset = Number((cfg.adaptiveOffsetCelsius - 0.5).toFixed(1));
                              try {
                                const res = await apiClient.updateClimateThreshold(cfg.warehouseZoneId, {
                                  adaptiveOffsetCelsius: newOffset,
                                });
                                setClimateConfigs((prev) =>
                                  prev.map((c) => (c.warehouseZoneId === cfg.warehouseZoneId ? res.config : c))
                                );
                                onShowToast('Threshold Updated', `Adaptive offset reduced to ${newOffset}°C`);
                              } catch (e) {
                                onShowToast('Error', String(e));
                              }
                            }}
                            className="px-2 py-0.5 rounded border text-xs font-bold hover:bg-gray-100 dark:hover:bg-stone-700"
                            title="Tighter threshold (-0.5°C)"
                          >
                            -0.5°
                          </button>
                          <button
                            onClick={async () => {
                              const newOffset = Number((cfg.adaptiveOffsetCelsius + 0.5).toFixed(1));
                              try {
                                const res = await apiClient.updateClimateThreshold(cfg.warehouseZoneId, {
                                  adaptiveOffsetCelsius: newOffset,
                                });
                                setClimateConfigs((prev) =>
                                  prev.map((c) => (c.warehouseZoneId === cfg.warehouseZoneId ? res.config : c))
                                );
                                onShowToast('Threshold Updated', `Adaptive offset increased to ${newOffset}°C`);
                              } catch (e) {
                                onShowToast('Error', String(e));
                              }
                            }}
                            className="px-2 py-0.5 rounded border text-xs font-bold hover:bg-gray-100 dark:hover:bg-stone-700"
                            title="Looser threshold (+0.5°C)"
                          >
                            +0.5°
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Warehouse Storage Zones Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`${cardClass} p-4 flex items-center gap-3`}>
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-xs font-bold ${textTitle}`}>Ambient Dry Storage</h3>
                  <p className={`text-[11px] ${textMuted}`}>Target: 24°C • Rice, pantry, grains</p>
                  <p className="text-xs font-mono font-semibold text-[#0F4C3A] dark:text-emerald-400 mt-1">68% Capacity</p>
                </div>
              </div>

              <div className={`${cardClass} p-4 flex items-center gap-3`}>
                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-xs font-bold ${textTitle}`}>Chilled Cold Storage</h3>
                  <p className={`text-[11px] ${textMuted}`}>Target: 4°C • Produce, dairy, eggs</p>
                  <p className="text-xs font-mono font-semibold text-[#0F4C3A] dark:text-emerald-400 mt-1">82% Capacity</p>
                </div>
              </div>

              <div className={`${cardClass} p-4 flex items-center gap-3`}>
                <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-xs font-bold ${textTitle}`}>Sub-Zero Deep Freezer</h3>
                  <p className={`text-[11px] ${textMuted}`}>Target: -18°C • Meats &amp; seafood</p>
                  <p className="text-xs font-mono font-semibold text-[#0F4C3A] dark:text-emerald-400 mt-1">54% Capacity</p>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className={`${cardClass} p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedOutletFilter}
                  onChange={(e) => setSelectedOutletFilter(e.target.value)}
                  className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
                >
                  <option value="ALL">All Store Outlets</option>
                  <option value="store-jkt-senopati">Senopati Flagship (Jakarta)</option>
                  <option value="store-jkt-pik">PIK 2 The Avenue (Jakarta)</option>
                  <option value="store-bdg-dago">Dago Green Market (Bandung)</option>
                </select>

                <select
                  value={selectedStorageZoneFilter}
                  onChange={(e) => setSelectedStorageZoneFilter(e.target.value)}
                  className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
                >
                  <option value="ALL">All Storage Zones</option>
                  <option value="cold_chilled">Cold Chilled (4°C)</option>
                  <option value="freezer">Freezer (-18°C)</option>
                  <option value="ambient">Ambient Dry</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Search SKU or item..."
                    className={`pl-8 pr-3 py-1.5 text-xs rounded-xl w-48 ${inputClass}`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs ${textMuted}`}>
                  Showing <strong className={textTitle}>{filteredTiers.length}</strong> location items
                </span>
              </div>
            </div>

            {/* Multi-Tier Stock Matrix Table */}
            <div className={`${cardClass} overflow-hidden shadow-xs`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={tableHeaderClass}>
                      <th className="py-3 px-3.5">SKU &amp; Item Details</th>
                      <th className="py-3 px-3.5">Store / Warehouse Hub</th>
                      <th className="py-3 px-3 text-center">Physical</th>
                      <th className="py-3 px-3 text-center">Available</th>
                      <th className="py-3 px-3 text-center">Reserved</th>
                      <th className="py-3 px-3 text-center">Incoming</th>
                      <th className="py-3 px-3.5">Threshold / Buffer</th>
                      <th className="py-3 px-3.5">Handling Instructions</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLight ? 'divide-stone-200' : 'divide-stone-800'}`}>
                    {filteredTiers.map((tier) => {
                      const isLowStock = tier.availableStock <= tier.minimumThreshold;
                      return (
                        <tr key={tier.id} className={`transition-colors ${isLight ? 'hover:bg-stone-50/80' : 'hover:bg-stone-800/40'}`}>
                          <td className="py-3 px-3.5">
                            <span className="font-mono text-[10px] text-[#0F4C3A] dark:text-emerald-400 font-bold">{tier.sku}</span>
                            <div className={`font-bold ${textTitle} text-xs`}>{tier.productName}</div>
                            <span className={`text-[11px] ${textMuted}`}>{tier.unit}</span>
                          </td>

                          <td className="py-3 px-3.5">
                            <div className={`font-semibold ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>{tier.storeName}</div>
                            <div className={`text-[11px] ${textMuted} font-mono flex items-center gap-1 mt-0.5`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {tier.warehouseZoneId}
                            </div>
                          </td>

                          <td className={`py-3 px-3 text-center font-mono font-bold ${textTitle}`}>
                            {tier.physicalStock}
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded-full ${
                                isLowStock
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30'
                                  : 'text-emerald-600 dark:text-emerald-400 font-bold'
                              }`}
                            >
                              {tier.availableStock}
                            </span>
                          </td>

                          <td className={`py-3 px-3 text-center font-mono ${textMuted}`}>
                            {tier.reservedStock}
                          </td>

                          <td className="py-3 px-3 text-center font-mono text-blue-600 dark:text-blue-400 font-semibold">
                            +{tier.incomingStock}
                          </td>

                          <td className={`py-3 px-3.5 font-mono ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>
                            <div>Min: {tier.minimumThreshold}</div>
                            <div className={`text-[10px] ${textMuted}`}>Buffer: {tier.safetyStockBuffer} | Max: {tier.maxCapacity}</div>
                          </td>

                          <td className={`py-3 px-3.5 text-[11px] max-w-xs ${isLight ? 'text-stone-600' : 'text-stone-300'}`}>
                            <p className="line-clamp-2">
                              {tier.handlingInstructions || 'Standard cold-chain storage.'}
                            </p>
                          </td>

                          <td className="py-3 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setAdjustingSku(tier.sku);
                                setAdjustQty(0);
                              }}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all border ${
                                isLight
                                  ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                                  : 'bg-stone-700 border-stone-600 text-stone-200 hover:bg-stone-600'
                              }`}
                            >
                              Audit Count
                            </button>
                            <button
                              onClick={() => setEditingTier(tier)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-300 border border-[#0F4C3A]/20 hover:bg-[#0F4C3A]/20 rounded-lg transition-all"
                            >
                              Edit Notes
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Edit Stock Tier Modal */}
            {editingTier && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                <div className={`${modalClass} max-w-lg w-full p-6 space-y-4`}>
                  <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
                    <div>
                      <h3 className={`text-base font-bold ${textTitle}`}>Item Metadata &amp; Handling Notes</h3>
                      <p className={`text-xs ${textMuted}`}>{editingTier.sku} - {editingTier.productName}</p>
                    </div>
                    <button
                      onClick={() => setEditingTier(null)}
                      className={`p-1.5 rounded-lg transition-colors ${isLight ? 'hover:bg-stone-100 text-stone-500' : 'hover:bg-stone-800 text-stone-400'}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Safety Stock Buffer</label>
                      <input
                        type="number"
                        value={editingTier.safetyStockBuffer}
                        onChange={(e) => setEditingTier({ ...editingTier, safetyStockBuffer: Number(e.target.value) })}
                        className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Maximum Bin Capacity</label>
                      <input
                        type="number"
                        value={editingTier.maxCapacity}
                        onChange={(e) => setEditingTier({ ...editingTier, maxCapacity: Number(e.target.value) })}
                        className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Handling Instructions (Staff Directives)</label>
                    <textarea
                      rows={3}
                      value={editingTier.handlingInstructions || ''}
                      onChange={(e) => setEditingTier({ ...editingTier, handlingInstructions: e.target.value })}
                      placeholder="e.g. Keep refrigerated at 4°C with gentle misting. Do not stack beyond 3 tiers."
                      className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Internal Admin Notes</label>
                    <input
                      type="text"
                      value={editingTier.internalNotes || ''}
                      onChange={(e) => setEditingTier({ ...editingTier, internalNotes: e.target.value })}
                      placeholder="e.g. Ciwidey morning harvest direct pick-up."
                      className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                    />
                  </div>

                  <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
                    <button
                      onClick={() => setEditingTier(null)}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        isLight
                          ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                          : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        await apiClient.updateStockTier(editingTier.id, {
                          safetyStockBuffer: editingTier.safetyStockBuffer,
                          maxCapacity: editingTier.maxCapacity,
                          handlingInstructions: editingTier.handlingInstructions,
                          internalNotes: editingTier.internalNotes,
                        });
                        onShowToast('Metadata Saved', `Updated instructions for ${editingTier.productName}.`);
                        setEditingTier(null);
                        refreshAllData();
                      }}
                      className="px-4 py-2 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-sm transition-all"
                    >
                      Save Attributes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Adjustment Modal */}
            {adjustingSku && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                <div className={`${modalClass} max-w-md w-full p-6 space-y-4`}>
                  <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
                    <h3 className={`text-base font-bold ${textTitle}`}>Physical Stocktake Adjustment</h3>
                    <button
                      onClick={() => setAdjustingSku(null)}
                      className={`p-1.5 rounded-lg transition-colors ${isLight ? 'hover:bg-stone-100 text-stone-500' : 'hover:bg-stone-800 text-stone-400'}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className={`text-xs ${textMuted}`}>
                    SKU: <strong className="text-[#0F4C3A] dark:text-emerald-400 font-mono">{adjustingSku}</strong>. Adjusting quantity will automatically calculate variance value and post a double-entry General Ledger entry.
                  </p>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Adjustment Delta (+ or - units)</label>
                    <input
                      type="number"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(Number(e.target.value))}
                      placeholder="+5 or -3"
                      className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass} font-mono`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>Adjustment Reason</label>
                    <select
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl ${inputClass}`}
                    >
                      <option value="Physical stocktake audit count">Physical stocktake audit count</option>
                      <option value="Spoilage / Damaged produce write-off">Spoilage / Damaged produce write-off</option>
                      <option value="Cold-chain temperature excursion">Cold-chain temperature excursion</option>
                      <option value="Supplier bonus sample added">Supplier bonus sample added</option>
                    </select>
                  </div>

                  <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
                    <button
                      onClick={() => setAdjustingSku(null)}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        isLight
                          ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                          : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePerformStockAdjust}
                      className="px-4 py-2 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-sm transition-all"
                    >
                      Post Adjustment to GL
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ADVANCED PROCUREMENT & PARTIAL GOODS RECEIPT (GR) */}
        {/* ========================================================================= */}
        {activeTab === 'procurement' && (
          <ProcurementModule
            theme={theme}
            selectedStore={selectedGlobalStore}
            inventory={inventory}
            purchaseRequests={purchaseRequests}
            purchaseOrders={purchaseOrders}
            goodsReceipts={goodsReceipts}
            onRefreshData={refreshAllData}
            onShowToast={onShowToast}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MULTI-STORE CHART OF ACCOUNTS & FINANCIAL ACCOUNTING */}
        {/* ========================================================================= */}
        {activeTab === 'accounting' && (
          <AccountingModule
            theme={theme}
            selectedStore={selectedFinanceStore}
            onStoreChange={(s) => {
              setSelectedFinanceStore(s);
              setSelectedGlobalStore(s);
            }}
            chartOfAccounts={chartOfAccounts}
            ledgerEntries={ledgerEntries}
            pnlReport={pnlReport}
            balanceSheet={balanceSheet}
            cashFlow={cashFlow}
            onRefreshData={refreshAllData}
            onShowToast={onShowToast}
            activeSubTab={accountingDeepSubTab}
            onSubTabChange={(sub) => setAccountingDeepSubTab(sub)}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 6: QRIS OPEN API & SPECS */}
        {/* ========================================================================= */}
        {activeTab === 'openapi' && (
          <div className="space-y-6">
            <div className={`${cardClass} p-6 space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-base font-bold ${textTitle} flex items-center gap-2`}>
                    <QrCode className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Indonesian National QR Standard (QRIS) Open API
                  </h2>
                  <p className={`text-xs ${textMuted}`}>
                    Compliant with Bank Indonesia &amp; ASPI Dynamic QRIS Specifications (NMID: ID1020039281744)
                  </p>
                </div>
                <a
                  href="/api/qris/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all border ${
                    isLight
                      ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      : 'bg-stone-700 border-stone-600 text-white hover:bg-stone-600'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Raw openapi.json
                </a>
              </div>

              {/* Spec Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className={`p-4 rounded-xl border space-y-1 ${subCardClass}`}>
                  <span className={`text-[11px] ${textMuted}`}>Endpoint 1: Generate QRIS</span>
                  <p className="font-mono text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">POST /api/qris/generate</p>
                  <p className={`text-[11px] ${textMuted}`}>Generates EMVCo string payload with CRC16 checksum &amp; 15-minute expiry.</p>
                </div>

                <div className={`p-4 rounded-xl border space-y-1 ${subCardClass}`}>
                  <span className={`text-[11px] ${textMuted}`}>Endpoint 2: Real-Time Polling</span>
                  <p className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">GET /api/qris/status/:orderId</p>
                  <p className={`text-[11px] ${textMuted}`}>Zero-lag payment status polling for instant checkout transitions.</p>
                </div>

                <div className={`p-4 rounded-xl border space-y-1 ${subCardClass}`}>
                  <span className={`text-[11px] ${textMuted}`}>Endpoint 3: Settlement Webhook</span>
                  <p className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">POST /api/qris/simulate-pay</p>
                  <p className={`text-[11px] ${textMuted}`}>Simulates ASPI clearing, deducts warehouse inventory, posts GL entries.</p>
                </div>
              </div>
            </div>

            {/* Audit Trail Log */}
            <div className={`${cardClass} p-5 space-y-4`}>
              <div>
                <h3 className={`text-sm font-bold ${textTitle}`}>QRIS Transaction Settlement Audit Trail</h3>
                <p className={`text-xs ${textMuted}`}>Real-time ledger links between customer QR payments and stock deductions</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className={tableHeaderClass}>
                      <th className="py-2.5 px-3">Audit ID</th>
                      <th className="py-2.5 px-3">QRIS Ref</th>
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLight ? 'divide-stone-200' : 'divide-stone-800'}`}>
                    {auditRecords.map((aud) => (
                      <tr key={aud.id} className={`transition-colors ${isLight ? 'hover:bg-stone-50/80' : 'hover:bg-stone-800/40'}`}>
                        <td className="py-3 px-3 font-bold text-[#0F4C3A] dark:text-emerald-400">{aud.id}</td>
                        <td className={`py-3 px-3 ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>{aud.qrisReference}</td>
                        <td className="py-3 px-3 text-blue-600 dark:text-blue-400 font-bold">{aud.orderId}</td>
                        <td className={`py-3 px-3 ${isLight ? 'text-stone-700' : 'text-stone-300'} font-sans`}>{aud.customerName}</td>
                        <td className="py-3 px-3 text-[#0F4C3A] dark:text-emerald-400 font-bold">{formatIDR(aud.amount)}</td>
                        <td className={`py-3 px-3 ${textMuted}`}>{aud.settlementChannel}</td>
                        <td className="py-3 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            {aud.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: FEFO & BATCH EXPIRY */}
        {/* ========================================================================= */}
        {activeTab === 'fefo' && (
          <FefoModule
            theme={theme}
            selectedStore={selectedGlobalStore}
            inventory={inventory}
            onShowToast={onShowToast}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: SCRAP & WASTE MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === 'waste' && (
          <WasteModule
            theme={theme}
            selectedStore={selectedGlobalStore}
            inventory={inventory}
            onShowToast={onShowToast}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: IN-STORE PICKER TERMINAL & CATCH WEIGHT */}
        {/* ========================================================================= */}
        {activeTab === 'picker' && (
          <PickerModule
            theme={theme}
            selectedStore={selectedGlobalStore}
            inventory={inventory}
            onShowToast={onShowToast}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: SYSTEM ARCHITECTURE & ERD SPECIFICATION */}
        {/* ========================================================================= */}
        {activeTab === 'erd' && (
          <ErdSpecsModule theme={theme} />
        )}

        {/* ========================================================================= */}
        {/* TAB: ROLES & SHIFTS ACCESS CONTROL (RBAC) */}
        {/* ========================================================================= */}
        {activeTab === 'rbac' && (
          <RbacModule
            theme={theme}
            onShowToast={onShowToast}
            onSessionUpdated={(s) => setActiveStaffSession(s)}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: SECURITY & ADMINISTRATIVE AUDIT LOGS */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <SecurityAuditModule
            theme={theme}
            selectedStore={selectedGlobalStore}
            onShowToast={onShowToast}
          />
        )}

        {/* State Machine Guard Y.4: Active Delivery In-Flight Store Closure Warning Modal */}
        {closureWarningModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className={`${modalClass} max-w-md w-full p-6 space-y-4 shadow-2xl`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${textTitle}`}>
                    Active Orders In-Flight Warning
                  </h3>
                  <p className={`text-xs ${textMuted}`}>
                    Store Closure Schedule Guard (Y.4)
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 leading-relaxed">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>{closureWarningModal.activeOrdersCount} Active In-Transit Orders Detected</span>
                </div>
                <p>
                  {closureWarningModal.warningMessage}
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Emergency closing <span className="font-bold">{closureWarningModal.outlet.storeName}</span> while orders are currently &quot;Out for Delivery&quot; or &quot;Awaiting Pickup&quot; may disrupt customer tracking or driver dispatch.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-200 dark:border-stone-800">
                <button
                  onClick={() => setClosureWarningModal(null)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all ${
                    isLight
                      ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                      : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-200'
                  }`}
                >
                  Abort / Keep Open
                </button>
                <button
                  onClick={() => {
                    const targetOutlet = closureWarningModal.outlet;
                    setClosureWarningModal(null);
                    handleToggleOutletEmergency(targetOutlet, true);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Confirm &amp; Force Closure
                </button>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>
    </div>
  );
};

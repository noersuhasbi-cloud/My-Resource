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
} from 'lucide-react';

interface AdminDashboardProps {
  onCloseToStorefront: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onCloseToStorefront,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'operations' | 'inventory' | 'procurement' | 'accounting' | 'openapi'>('overview');

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
      ]);

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
      setStoreStatus(res.storeStatus);
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
      setStoreStatus(res.storeStatus);
      onShowToast('Notice Banner Updated', 'Custom announcement published to storefront header.');
    } catch (err) {
      onShowToast('Update Failed', String(err));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleToggleOutletEmergency = async (outlet: StoreOutletSchedule) => {
    try {
      const updatedEmergency = !outlet.isEmergencyClosed;
      const res = await apiClient.updateStoreOutlet(outlet.storeId, {
        isEmergencyClosed: updatedEmergency,
        closureReason: updatedEmergency ? 'Emergency refrigeration maintenance' : '',
      });
      setStoreOutlets((prev) => prev.map((o) => (o.storeId === outlet.storeId ? res.outlet : o)));
      onShowToast(
        updatedEmergency ? `${outlet.storeName} Closed` : `${outlet.storeName} Reopened`,
        updatedEmergency ? 'Checkout restricted for this specific outlet; catalog view retained.' : 'Operating schedule restored.'
      );
    } catch (err) {
      onShowToast('Outlet Update Failed', String(err));
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
      setStoreOutlets((prev) => prev.map((o) => (o.storeId === editingOutlet.storeId ? res.outlet : o)));
      setEditingOutlet(null);
      onShowToast('Operating Hours Updated', `${res.outlet.storeName} schedule synchronized.`);
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

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-stone-950/80 backdrop-blur-md border-b border-stone-800 sticky top-0 z-30 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-900/30 text-white font-bold text-lg">
              GM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">GroceMart Mini ERP</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Enterprise v2.4
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Multi-Outlet
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Indonesian Multi-Store Retail Operations, Cold-Chain Inventory, Partial GR & Double-Entry Financials
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={refreshAllData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all border border-stone-700 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </button>

            <button
              onClick={onCloseToStorefront}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm hover:shadow-emerald-600/30"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Back to Storefront</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <div className="bg-stone-950/60 border-b border-stone-800 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Executive Omzet
          </button>

          <button
            onClick={() => setActiveTab('operations')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'operations'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <Store className="w-4 h-4" />
            Store Hours & Outlets
            {storeOutlets.some((o) => o.isEmergencyClosed) && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <Boxes className="w-4 h-4" />
            Multi-Warehouse Stock
            {inventoryMetrics.lowStockCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {inventoryMetrics.lowStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('procurement')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'procurement'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <Truck className="w-4 h-4" />
            Procurement & Partial GR
            {purchaseOrders.some((p) => p.status === 'Partially Received') && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Partial
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('accounting')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'accounting'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <ReceiptText className="w-4 h-4" />
            Store COA & Financials
          </button>

          <button
            onClick={() => setActiveTab('openapi')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'openapi'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            QRIS Open API & Specs
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* ========================================================================= */}
        {/* TAB 1: EXECUTIVE OMZET & OVERVIEW */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-stone-800/60 border border-stone-700/60 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
                  <span>Gross Omzet (October MTD)</span>
                  <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold text-white tracking-tight">
                  {formatIDR(omzetData?.totalRevenueMTD || 388500000)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center text-emerald-400 font-semibold">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +{omzetData?.momGrowthPercent || 18.2}% MoM
                  </span>
                  <span className="text-stone-500">•</span>
                  <span className="text-stone-400">+{omzetData?.wowGrowthPercent || 12.4}% WoW</span>
                </div>
              </div>

              <div className="bg-stone-800/60 border border-stone-700/60 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
                  <span>Total Settled Orders</span>
                  <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                    <Package className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold text-white tracking-tight">
                  {(omzetData?.totalOrders || 1311).toLocaleString('id-ID')}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-stone-400">
                  <span>Avg Basket:</span>
                  <span className="text-stone-200 font-medium">
                    {formatIDR(omzetData?.averageBasketValue || 296338)}
                  </span>
                </div>
              </div>

              <div className="bg-stone-800/60 border border-stone-700/60 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
                  <span>QRIS Conversion Rate</span>
                  <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                    <QrCode className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold text-white tracking-tight">
                  {omzetData?.qrisMetrics.conversionRatePercent || 96.8}%
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-stone-400">
                  <span className="text-purple-400 font-medium">
                    {omzetData?.qrisMetrics.settledCount || 1336} / {omzetData?.qrisMetrics.totalAttempts || 1380} paid
                  </span>
                  <span className="text-stone-500">•</span>
                  <span>Avg {omzetData?.qrisMetrics.averageSettlementSeconds || 6.2}s</span>
                </div>
              </div>

              <div className="bg-stone-800/60 border border-stone-700/60 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
                  <span>Inventory Health</span>
                  <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold text-white tracking-tight">
                  {formatIDR(inventoryMetrics.totalValuationWAC || 48200000)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className={`font-semibold ${inventoryMetrics.lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {inventoryMetrics.lowStockCount} items low stock
                  </span>
                  <span className="text-stone-500">•</span>
                  <span className="text-stone-400">{inventoryMetrics.totalStockCount} units in bins</span>
                </div>
              </div>
            </div>

            {/* Omzet by Store Outlet & Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Store Outlet Breakdown */}
              <div className="lg:col-span-2 bg-stone-800/40 border border-stone-700/60 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Omzet per Outlet Store</h2>
                    <p className="text-xs text-stone-400">Granular performance across Indonesian physical hubs</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-300 rounded-lg border border-emerald-500/20">
                    6 Active Outlets
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-700 text-stone-400 font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Store Location</th>
                        <th className="py-2.5 px-3">City</th>
                        <th className="py-2.5 px-3">Orders</th>
                        <th className="py-2.5 px-3">Revenue (IDR)</th>
                        <th className="py-2.5 px-3">Contribution</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-700/50">
                      {(omzetData?.storeBreakdown || []).map((store) => (
                        <tr key={store.storeId} className="hover:bg-stone-700/20 transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">
                            {store.storeName}
                          </td>
                          <td className="py-3 px-3 text-stone-300">{store.city}</td>
                          <td className="py-3 px-3 text-stone-300">{store.orderCount}</td>
                          <td className="py-3 px-3 font-mono font-semibold text-emerald-400">
                            {formatIDR(store.omzet)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-stone-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full"
                                  style={{ width: `${store.sharePercent}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-stone-400 font-mono">
                                {store.sharePercent}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
              <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white">Category Distribution</h2>
                  <p className="text-xs text-stone-400">Share of revenue by grocery department</p>
                </div>

                <div className="space-y-3">
                  {(omzetData?.categoryBreakdown || []).map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-stone-300 font-medium">{cat.label}</span>
                        <span className="text-emerald-400 font-mono font-semibold">{cat.sharePercent}%</span>
                      </div>
                      <div className="w-full bg-stone-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${cat.sharePercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-stone-500">
                        <span>{cat.unitsSold.toLocaleString('id-ID')} units sold</span>
                        <span>{formatIDR(cat.omzet)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-stone-700/60">
                  <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700 text-xs text-stone-300 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Cold-Chain Highlight</p>
                      <p className="text-stone-400 text-[11px] mt-0.5">
                        Fresh Produce & Chilled Dairy represent 61.4% of retail volume, requiring active temperature verification at Goods Receipt.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Revenue SKUs */}
            <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Top-Selling SKUs by Revenue</h2>
                  <p className="text-xs text-stone-400">Fastest-moving items generating maximum gross margin</p>
                </div>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                >
                  View Inventory Matrix
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {(omzetData?.topSkus || []).map((sku) => (
                  <div key={sku.sku} className="bg-stone-800/80 border border-stone-700 p-3.5 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-mono text-stone-400">{sku.sku}</span>
                    <h3 className="text-xs font-bold text-white line-clamp-1">{sku.productName}</h3>
                    <p className="text-[11px] text-stone-400">{sku.unitsSold} units sold</p>
                    <p className="text-xs font-mono font-bold text-emerald-400">{formatIDR(sku.revenue)}</p>
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
            <div className="bg-stone-800/50 border border-stone-700/60 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-stone-700/60">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Store className="w-5 h-5 text-emerald-400" />
                    Company-Wide Storefront Network Status
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Control all 34 outlets simultaneously or override specific store hubs.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-stone-300">
                      {storeStatus?.isOpen ? 'Network Online' : 'Network Closed'}
                    </span>
                    <button
                      onClick={handleToggleStoreOpen}
                      disabled={isUpdatingStatus}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        storeStatus?.isOpen ? 'bg-emerald-600' : 'bg-red-600'
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
                    <label className="block text-xs font-semibold text-stone-300 mb-1">
                      Customer Notice Banner (Displayed on Storefront Header)
                    </label>
                    <input
                      type="text"
                      value={bannerInput}
                      onChange={(e) => setBannerInput(e.target.value)}
                      placeholder="e.g. Fresh harvest arrives daily from Lembang! Open 07:00 - 22:00 WIB."
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-stone-900 border border-stone-700 text-stone-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">
                      Estimated Operating Window
                    </label>
                    <input
                      type="text"
                      value={reopenInput}
                      onChange={(e) => setReopenInput(e.target.value)}
                      placeholder="Open 07:00 - 22:00 Daily"
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-stone-900 border border-stone-700 text-stone-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveBanner}
                    disabled={isUpdatingStatus}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    Save & Broadcast Banner
                  </button>
                </div>
              </div>
            </div>

            {/* Granular Outlets Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Store Outlets Schedule & Closure Control</h2>
                  <p className="text-xs text-stone-400">Configure operating hours, local timezone, and emergency closure per location</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storeOutlets.map((outlet) => {
                  const isClosed = outlet.isEmergencyClosed || !storeStatus?.isOpen;
                  return (
                    <div
                      key={outlet.storeId}
                      className={`bg-stone-800/60 border rounded-2xl p-5 transition-all space-y-4 ${
                        isClosed ? 'border-red-900/50 bg-red-950/10' : 'border-stone-700/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{outlet.storeName}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-700 text-stone-300">
                              {outlet.timezone}
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5">{outlet.district}, {outlet.city}</p>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isClosed
                              ? 'bg-red-500/20 text-red-300 border-red-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {isClosed ? 'CLOSED' : 'OPEN'}
                        </span>
                      </div>

                      <div className="p-3 bg-stone-900/80 rounded-xl space-y-1.5 text-xs">
                        <div className="flex justify-between text-stone-300">
                          <span className="text-stone-400">Operating Hours:</span>
                          <span className="font-semibold">{outlet.openTime} - {outlet.closeTime} {outlet.timezone}</span>
                        </div>
                        <div className="flex justify-between text-stone-300">
                          <span className="text-stone-400">Days Active:</span>
                          <span>{outlet.daysOpen}</span>
                        </div>
                        <div className="flex justify-between text-stone-300">
                          <span className="text-stone-400">Contact:</span>
                          <span className="font-mono text-stone-400">{outlet.contactPhone}</span>
                        </div>
                      </div>

                      {outlet.isEmergencyClosed && outlet.closureReason && (
                        <div className="p-2.5 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>Emergency Note: {outlet.closureReason}</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-stone-700/60">
                        <button
                          onClick={() => handleToggleOutletEmergency(outlet)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                            outlet.isEmergencyClosed
                              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                              : 'bg-red-600/20 text-red-300 border-red-500/40 hover:bg-red-600/30'
                          }`}
                        >
                          {outlet.isEmergencyClosed ? 'Restore Open' : 'Emergency Close'}
                        </button>

                        <button
                          onClick={() => setEditingOutlet(outlet)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 transition-all flex items-center gap-1.5"
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
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">Edit Schedule: {editingOutlet.storeName}</h3>
                    <button onClick={() => setEditingOutlet(null)} className="text-stone-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">Open Time</label>
                      <input
                        type="time"
                        value={editingOutlet.openTime}
                        onChange={(e) => setEditingOutlet({ ...editingOutlet, openTime: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">Close Time</label>
                      <input
                        type="time"
                        value={editingOutlet.closeTime}
                        onChange={(e) => setEditingOutlet({ ...editingOutlet, closeTime: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Days Open</label>
                    <input
                      type="text"
                      value={editingOutlet.daysOpen}
                      onChange={(e) => setEditingOutlet({ ...editingOutlet, daysOpen: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Emergency Closure Reason (Optional)</label>
                    <input
                      type="text"
                      value={editingOutlet.closureReason || ''}
                      onChange={(e) => setEditingOutlet({ ...editingOutlet, closureReason: e.target.value })}
                      placeholder="e.g. Sub-zero walk-in chiller routine servicing"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                    <button
                      onClick={() => setEditingOutlet(null)}
                      className="px-4 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveOutletHours}
                      className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm"
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
            {/* Warehouse Storage Zones Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-stone-800/50 border border-stone-700/60 rounded-2xl p-4 flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Ambient Dry Storage</h3>
                  <p className="text-[11px] text-stone-400">Target: 24°C • Rice, pantry, grains</p>
                  <p className="text-xs font-mono font-semibold text-emerald-400 mt-1">68% Capacity</p>
                </div>
              </div>

              <div className="bg-stone-800/50 border border-stone-700/60 rounded-2xl p-4 flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Chilled Cold Storage</h3>
                  <p className="text-[11px] text-stone-400">Target: 4°C • Produce, dairy, eggs</p>
                  <p className="text-xs font-mono font-semibold text-emerald-400 mt-1">82% Capacity</p>
                </div>
              </div>

              <div className="bg-stone-800/50 border border-stone-700/60 rounded-2xl p-4 flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Sub-Zero Deep Freezer</h3>
                  <p className="text-[11px] text-stone-400">Target: -18°C • Meats & seafood</p>
                  <p className="text-xs font-mono font-semibold text-emerald-400 mt-1">54% Capacity</p>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedOutletFilter}
                  onChange={(e) => setSelectedOutletFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-stone-900 border border-stone-700 text-stone-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Store Outlets</option>
                  <option value="store-jkt-senopati">Senopati Flagship (Jakarta)</option>
                  <option value="store-jkt-pik">PIK 2 The Avenue (Jakarta)</option>
                  <option value="store-bdg-dago">Dago Green Market (Bandung)</option>
                </select>

                <select
                  value={selectedStorageZoneFilter}
                  onChange={(e) => setSelectedStorageZoneFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-stone-900 border border-stone-700 text-stone-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Storage Zones</option>
                  <option value="cold_chilled">Cold Chilled (4°C)</option>
                  <option value="freezer">Freezer (-18°C)</option>
                  <option value="ambient">Ambient Dry</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Search SKU or item..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-stone-900 border border-stone-700 text-stone-200 focus:outline-none focus:border-emerald-500 w-48"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">
                  Showing <strong className="text-white">{filteredTiers.length}</strong> location items
                </span>
              </div>
            </div>

            {/* Multi-Tier Stock Matrix Table */}
            <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-stone-900/60 border-b border-stone-700 text-stone-400 font-semibold uppercase text-[10px]">
                      <th className="py-3 px-3.5">SKU & Item Details</th>
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
                  <tbody className="divide-y divide-stone-700/50">
                    {filteredTiers.map((tier) => {
                      const isLowStock = tier.availableStock <= tier.minimumThreshold;
                      return (
                        <tr key={tier.id} className="hover:bg-stone-700/20 transition-colors">
                          <td className="py-3 px-3.5">
                            <span className="font-mono text-[10px] text-emerald-400">{tier.sku}</span>
                            <div className="font-bold text-white text-xs">{tier.productName}</div>
                            <span className="text-[11px] text-stone-400">{tier.unit}</span>
                          </td>

                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-stone-200">{tier.storeName}</div>
                            <div className="text-[11px] text-stone-400 font-mono flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              {tier.warehouseZoneId}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-white">
                            {tier.physicalStock}
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded-full ${
                                isLowStock
                                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {tier.availableStock}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center font-mono text-stone-400">
                            {tier.reservedStock}
                          </td>

                          <td className="py-3 px-3 text-center font-mono text-blue-400 font-semibold">
                            +{tier.incomingStock}
                          </td>

                          <td className="py-3 px-3.5 font-mono text-stone-300">
                            <div>Min: {tier.minimumThreshold}</div>
                            <div className="text-[10px] text-stone-500">Buffer: {tier.safetyStockBuffer} | Max: {tier.maxCapacity}</div>
                          </td>

                          <td className="py-3 px-3.5 text-[11px] text-stone-300 max-w-xs">
                            <p className="line-clamp-2 text-stone-400">
                              {tier.handlingInstructions || 'Standard cold-chain storage.'}
                            </p>
                          </td>

                          <td className="py-3 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setAdjustingSku(tier.sku);
                                setAdjustQty(0);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg transition-all"
                            >
                              Audit Count
                            </button>
                            <button
                              onClick={() => setEditingTier(tier)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 rounded-lg transition-all"
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
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Item Metadata & Handling Notes</h3>
                      <p className="text-xs text-stone-400">{editingTier.sku} - {editingTier.productName}</p>
                    </div>
                    <button onClick={() => setEditingTier(null)} className="text-stone-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">Safety Stock Buffer</label>
                      <input
                        type="number"
                        value={editingTier.safetyStockBuffer}
                        onChange={(e) => setEditingTier({ ...editingTier, safetyStockBuffer: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">Maximum Bin Capacity</label>
                      <input
                        type="number"
                        value={editingTier.maxCapacity}
                        onChange={(e) => setEditingTier({ ...editingTier, maxCapacity: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Handling Instructions (Staff Directives)</label>
                    <textarea
                      rows={3}
                      value={editingTier.handlingInstructions || ''}
                      onChange={(e) => setEditingTier({ ...editingTier, handlingInstructions: e.target.value })}
                      placeholder="e.g. Keep refrigerated at 4°C with gentle misting. Do not stack beyond 3 tiers."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Internal Admin Notes</label>
                    <input
                      type="text"
                      value={editingTier.internalNotes || ''}
                      onChange={(e) => setEditingTier({ ...editingTier, internalNotes: e.target.value })}
                      placeholder="e.g. Ciwidey morning harvest direct pick-up."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                    <button
                      onClick={() => setEditingTier(null)}
                      className="px-4 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl"
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
                      className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm"
                    >
                      Save Attributes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Adjustment Modal */}
            {adjustingSku && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">Physical Stocktake Adjustment</h3>
                    <button onClick={() => setAdjustingSku(null)} className="text-stone-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-stone-400">
                    SKU: <strong className="text-emerald-400 font-mono">{adjustingSku}</strong>. Adjusting quantity will automatically calculate variance value and post a double-entry General Ledger entry.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Adjustment Delta (+ or - units)</label>
                    <input
                      type="number"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(Number(e.target.value))}
                      placeholder="+5 or -3"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Adjustment Reason</label>
                    <select
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    >
                      <option value="Physical stocktake audit count">Physical stocktake audit count</option>
                      <option value="Spoilage / Damaged produce write-off">Spoilage / Damaged produce write-off</option>
                      <option value="Cold-chain temperature excursion">Cold-chain temperature excursion</option>
                      <option value="Supplier bonus sample added">Supplier bonus sample added</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                    <button
                      onClick={() => setAdjustingSku(null)}
                      className="px-4 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePerformStockAdjust}
                      className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm"
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
          <div className="space-y-6">
            {/* Purchase Requests Section */}
            <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Purchase Requests (PR)</h2>
                  <p className="text-xs text-stone-400">Automated low-stock threshold triggers and manual store restock requests</p>
                </div>

                <button
                  onClick={() => setIsCreatingPR(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Restock PR
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-700 text-stone-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">PR Number</th>
                      <th className="py-2.5 px-3">Store Outlet</th>
                      <th className="py-2.5 px-3">Requested Item</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Est. Cost (IDR)</th>
                      <th className="py-2.5 px-3">Trigger Reason</th>
                      <th className="py-2.5 px-3 text-right">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-700/50">
                    {purchaseRequests.map((pr) => (
                      <tr key={pr.id} className="hover:bg-stone-700/20 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-emerald-400">{pr.id}</td>
                        <td className="py-3 px-3 text-stone-300">{pr.storeName || 'Senopati Flagship'}</td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {pr.productName}
                          <div className="font-mono text-[10px] text-stone-400">{pr.sku}</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-stone-200">{pr.suggestedQuantity}</td>
                        <td className="py-3 px-3 font-mono text-emerald-400">{formatIDR(pr.totalEstimatedCost)}</td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] text-stone-400 capitalize">
                            {pr.reason.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {pr.status === 'pending' ? (
                            <button
                              onClick={() => handleApprovePR(pr.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-all"
                            >
                              Approve → PO
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              PO #{pr.poId}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purchase Orders with Partial Shipment Support */}
            <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-emerald-400" />
                    Purchase Orders (PO) & Partial Shipment Tracking
                  </h2>
                  <p className="text-xs text-stone-400">
                    Formal orders sent to suppliers with backorder tracking for split/partial deliveries
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-700 text-stone-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">PO Number</th>
                      <th className="py-2.5 px-3">Supplier & Destination</th>
                      <th className="py-2.5 px-3">Items & Quantities</th>
                      <th className="py-2.5 px-3">Fulfillment Progress</th>
                      <th className="py-2.5 px-3">Total Value</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Receive Goods</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-700/50">
                    {purchaseOrders.map((po) => {
                      const totalOrdered = po.items.reduce((s, i) => s + i.orderedQuantity, 0);
                      const totalReceived = po.items.reduce((s, i) => s + (i.receivedQuantity || 0), 0);
                      const totalBackorder = po.items.reduce((s, i) => s + (i.remainingBackorder || 0), 0);
                      const percent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

                      return (
                        <tr key={po.id} className="hover:bg-stone-700/20 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-emerald-400">{po.id}</span>
                            <div className="text-[10px] text-stone-400">Expected: {po.expectedDeliveryDate}</div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{po.supplierName}</div>
                            <div className="text-[11px] text-stone-400">{po.storeName}</div>
                          </td>

                          <td className="py-3 px-3 max-w-xs">
                            {po.items.map((item, idx) => (
                              <div key={idx} className="text-[11px]">
                                <span className="font-medium text-stone-200">{item.productName}</span>
                                <span className="text-stone-400 font-mono ml-1">
                                  ({item.receivedQuantity}/{item.orderedQuantity} rcvd)
                                </span>
                              </div>
                            ))}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-stone-700 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    po.status === 'Completed' ? 'bg-emerald-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-semibold text-stone-300">{percent}%</span>
                            </div>
                            {totalBackorder > 0 && (
                              <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                                {totalBackorder} units backordered
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono font-semibold text-emerald-400">
                            {formatIDR(po.totalCost)}
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                po.status === 'Completed'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : po.status === 'Partially Received'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                  : 'bg-stone-700 text-stone-300 border-stone-600'
                              }`}
                            >
                              {po.status}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            {po.status !== 'Completed' ? (
                              <button
                                onClick={() => openReceivingModal(po)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-all shadow-sm"
                              >
                                Receive GR
                              </button>
                            ) : (
                              <span className="text-[11px] text-stone-500 font-medium">All Received</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Goods Receipts (GR) History */}
            <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-white">Goods Receipts (GR) Log</h2>
                <p className="text-xs text-stone-400">Surat Jalan delivery notes, cold-chain temp checks, and linked GL journal vouchers</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-700 text-stone-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">GR Number</th>
                      <th className="py-2.5 px-3">Surat Jalan / Delivery Note</th>
                      <th className="py-2.5 px-3">PO Reference</th>
                      <th className="py-2.5 px-3">Vendor / Store</th>
                      <th className="py-2.5 px-3">Shipment Type</th>
                      <th className="py-2.5 px-3">Receiver / Temp</th>
                      <th className="py-2.5 px-3 text-right">Linked GL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-700/50">
                    {goodsReceipts.map((gr) => (
                      <tr key={gr.id} className="hover:bg-stone-700/20 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-emerald-400">{gr.id}</td>
                        <td className="py-3 px-3 font-mono text-stone-200">{gr.deliveryNoteNumber}</td>
                        <td className="py-3 px-3 font-mono text-blue-400">{gr.poId}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{gr.vendorName}</div>
                          <div className="text-[10px] text-stone-400">{gr.storeName}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              gr.isPartial
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {gr.isPartial ? 'Partial Delivery' : 'Full Delivery'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-stone-300">{gr.receivedBy}</div>
                          <div className="text-[10px] text-blue-300 flex items-center gap-1">
                            <Thermometer className="w-3 h-3" />
                            {gr.items[0]?.tempCheckCelsius ? `${gr.items[0].tempCheckCelsius}°C Verified` : 'Temp OK'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[11px] text-stone-400">
                          {gr.glEntryId || 'GLE-Posted'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Interactive Partial Goods Receipt Modal */}
            {activeReceivingPO && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Truck className="w-5 h-5 text-emerald-400" />
                        Receive Goods: PO #{activeReceivingPO.id}
                      </h3>
                      <p className="text-xs text-stone-400">
                        Vendor: <strong className="text-white">{activeReceivingPO.supplierName}</strong> • Destination: <strong className="text-white">{activeReceivingPO.storeName}</strong>
                      </p>
                    </div>
                    <button onClick={() => setActiveReceivingPO(null)} className="text-stone-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Surat Jalan / Delivery Note #
                      </label>
                      <input
                        type="text"
                        value={deliveryNoteInput}
                        onChange={(e) => setDeliveryNoteInput(e.target.value)}
                        placeholder="e.g. SJ-BLC-2026-9921"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-300 mb-1">
                        Receiving Officer Name
                      </label>
                      <input
                        type="text"
                        value={receivedByInput}
                        onChange={(e) => setReceivedByInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                      />
                    </div>
                  </div>

                  {/* Items to receive with partial quantity inputs */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-stone-200 uppercase tracking-wider">
                      Specify Received Items (Partial Fulfillment Supported)
                    </h4>

                    {activeReceivingPO.items.map((item) => {
                      const itemState = receivingItemsState[item.sku] || {
                        quantityReceived: item.remainingBackorder,
                        batchNumber: 'BAT-NEW',
                        expiryDate: '',
                        qualityCondition: 'Cold-Chain Verified',
                        tempCheckCelsius: 4.0,
                      };

                      const currentBackorder = Math.max(0, item.remainingBackorder - itemState.quantityReceived);

                      return (
                        <div key={item.sku} className="bg-stone-800/80 border border-stone-700 p-4 rounded-xl space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <div>
                              <h5 className="font-bold text-white text-xs">{item.productName}</h5>
                              <span className="font-mono text-[10px] text-stone-400">{item.sku}</span>
                            </div>
                            <div className="text-xs font-mono text-stone-300">
                              Ordered: <strong className="text-white">{item.orderedQuantity}</strong> | Remaining: <strong className="text-amber-400">{item.remainingBackorder}</strong>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-[10px] text-stone-400 mb-1">Quantity Received Now</label>
                              <input
                                type="number"
                                min={0}
                                max={item.remainingBackorder}
                                value={itemState.quantityReceived}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setReceivingItemsState((prev) => ({
                                    ...prev,
                                    [item.sku]: { ...itemState, quantityReceived: val },
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-stone-900 border border-stone-600 text-emerald-400"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-stone-400 mb-1">Batch / Lot #</label>
                              <input
                                type="text"
                                value={itemState.batchNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceivingItemsState((prev) => ({
                                    ...prev,
                                    [item.sku]: { ...itemState, batchNumber: val },
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-stone-900 border border-stone-600 text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-stone-400 mb-1">Cold Temp (°C)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={itemState.tempCheckCelsius}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setReceivingItemsState((prev) => ({
                                    ...prev,
                                    [item.sku]: { ...itemState, tempCheckCelsius: val },
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-stone-900 border border-stone-600 text-blue-300"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-stone-400 mb-1">Quality Status</label>
                              <select
                                value={itemState.qualityCondition}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceivingItemsState((prev) => ({
                                    ...prev,
                                    [item.sku]: { ...itemState, qualityCondition: val },
                                  }));
                                }}
                                className="w-full px-2 py-1.5 text-xs rounded-lg bg-stone-900 border border-stone-600 text-white"
                              >
                                <option value="Cold-Chain Verified">Cold-Chain Verified</option>
                                <option value="Passed - Grade A">Passed - Grade A</option>
                                <option value="Minor Discrepancy">Minor Discrepancy</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <span className="text-stone-400">
                              Resulting Backorder Remaining on PO:
                            </span>
                            <span className={`font-mono font-semibold ${currentBackorder > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {currentBackorder > 0 ? `${currentBackorder} units (Partially Received)` : '0 units (Fully Fulfilled)'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Receiving Remarks / Storage Notes</label>
                    <input
                      type="text"
                      value={receiverNotesInput}
                      onChange={(e) => setReceiverNotesInput(e.target.value)}
                      placeholder="e.g. Produce transferred to walk-in cold room WH-JKT-SEN-COLD; quality seal intact."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    />
                  </div>

                  <div className="p-3 bg-stone-950/80 rounded-xl border border-stone-800 text-xs text-stone-400 space-y-1">
                    <p className="font-semibold text-stone-300 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-emerald-400" />
                      Automated Double-Entry Accounting Posting:
                    </p>
                    <p>• <strong>Debit 1040 Merchandise Inventory Asset</strong>: +Value of received items into store warehouse</p>
                    <p>• <strong>Credit 2010 Trade Accounts Payable</strong>: +Liability recognized for vendor settlement</p>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                    <button
                      onClick={() => setActiveReceivingPO(null)}
                      className="px-4 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitPartialGR}
                      disabled={isSubmittingGR}
                      className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm disabled:opacity-50"
                    >
                      {isSubmittingGR ? 'Posting GR & Inventory...' : 'Confirm Goods Receipt & Update Stock'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create PR Modal */}
            {isCreatingPR && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">New Purchase Request (PR)</h3>
                    <button onClick={() => setIsCreatingPR(false)} className="text-stone-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Target Store Hub</label>
                    <select
                      value={prStoreId}
                      onChange={(e) => setPrStoreId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    >
                      <option value="store-jkt-senopati">GroceMart Senopati Flagship (Jakarta)</option>
                      <option value="store-jkt-pik">GroceMart PIK 2 The Avenue (Jakarta)</option>
                      <option value="store-bdg-dago">GroceMart Dago Green Market (Bandung)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Select Product / SKU</label>
                    <select
                      value={selectedPrSku}
                      onChange={(e) => setSelectedPrSku(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    >
                      <option value="">-- Choose Item to Restock --</option>
                      {inventory.map((item) => (
                        <option key={item.sku} value={item.sku}>
                          {item.productName} ({item.sku}) - Current Stock: {item.currentStock}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Requested Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={prQuantity}
                      onChange={(e) => setPrQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-stone-800 border border-stone-700 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                    <button
                      onClick={() => setIsCreatingPR(false)}
                      className="px-4 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreatePR}
                      disabled={!selectedPrSku}
                      className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm disabled:opacity-50"
                    >
                      Submit Purchase Request
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MULTI-STORE CHART OF ACCOUNTS & FINANCIAL ACCOUNTING */}
        {/* ========================================================================= */}
        {activeTab === 'accounting' && (
          <div className="space-y-6">
            {/* Store Filter Selector & Sub Tabs */}
            <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <span className="text-xs text-stone-400">Reporting Scope:</span>
                  <select
                    value={selectedFinanceStore}
                    onChange={(e) => setSelectedFinanceStore(e.target.value)}
                    className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-900 border border-stone-700 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CONSOLIDATED">Consolidated Company-Wide (All Outlets)</option>
                    <option value="store-jkt-senopati">Senopati Flagship Hub (Jakarta)</option>
                    <option value="store-jkt-pik">PIK 2 The Avenue Hub (Jakarta)</option>
                    <option value="store-bdg-dago">Dago Green Market Hub (Bandung)</option>
                  </select>
                </div>
              </div>

              {/* Sub-Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setFinanceSubTab('pnl')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    financeSubTab === 'pnl' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  P&L Statement
                </button>
                <button
                  onClick={() => setFinanceSubTab('balance_sheet')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    financeSubTab === 'balance_sheet' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Balance Sheet
                </button>
                <button
                  onClick={() => setFinanceSubTab('cash_flow')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    financeSubTab === 'cash_flow' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Cash Flow
                </button>
                <button
                  onClick={() => setFinanceSubTab('gl')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    financeSubTab === 'gl' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  General Ledger
                </button>
                <button
                  onClick={() => setFinanceSubTab('coa')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    financeSubTab === 'coa' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Chart of Accounts
                </button>
              </div>
            </div>

            {/* Sub-Tab 1: Profit & Loss Statement */}
            {financeSubTab === 'pnl' && pnlReport && (
              <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-stone-700/60 pb-4 gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-white">Profit & Loss (P&L) Statement</h2>
                    <p className="text-xs text-stone-400">
                      Scope: <strong className="text-emerald-400">{pnlReport.storeName || 'Consolidated'}</strong> • Period: {pnlReport.period}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-stone-400">Net Profit Margin:</span>
                    <span className="ml-2 font-mono font-bold text-emerald-400 text-sm">
                      {pnlReport.netMarginPercent}%
                    </span>
                  </div>
                </div>

                <div className="space-y-4 text-xs font-mono">
                  {/* Revenue */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-stone-300 font-bold uppercase text-[11px] pb-1 border-b border-stone-700/60">
                      <span>1. Operating Sales Revenue</span>
                      <span>Amount (IDR)</span>
                    </div>
                    <div className="flex justify-between text-stone-400 pl-4">
                      <span>Gross Customer QRIS Checkout Revenue</span>
                      <span>{formatIDR(pnlReport.grossSalesRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-amber-400 pl-4">
                      <span>Less: Promotional Vouchers & Discounts</span>
                      <span>-{formatIDR(pnlReport.discountsGiven)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold pl-4 pt-1 border-t border-stone-800">
                      <span>Net Sales Revenue</span>
                      <span>{formatIDR(pnlReport.netSalesRevenue)}</span>
                    </div>
                  </div>

                  {/* COGS */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-stone-300 font-bold uppercase text-[11px] pb-1 border-b border-stone-700/60">
                      <span>2. Cost of Goods Sold (COGS - Weighted Average / FIFO)</span>
                      <span>Amount (IDR)</span>
                    </div>
                    <div className="flex justify-between text-red-400 pl-4">
                      <span>Direct Farm Acquisition & Butchery Cost</span>
                      <span>-{formatIDR(pnlReport.costOfGoodsSold)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-bold pl-4 pt-1 border-t border-stone-800 text-sm">
                      <span>Gross Profit ({pnlReport.grossMarginPercent}% margin)</span>
                      <span>{formatIDR(pnlReport.grossProfit)}</span>
                    </div>
                  </div>

                  {/* Operating Expenses */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-stone-300 font-bold uppercase text-[11px] pb-1 border-b border-stone-700/60">
                      <span>3. Operating & Cold-Chain Expenses (OPEX)</span>
                      <span>Amount (IDR)</span>
                    </div>
                    {pnlReport.operatingExpenses.map((exp, idx) => (
                      <div key={idx} className="flex justify-between text-stone-400 pl-4">
                        <span>{exp.category}</span>
                        <span>-{formatIDR(exp.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-stone-300 font-bold pl-4 pt-1 border-t border-stone-800">
                      <span>Total Operating Expenses</span>
                      <span>-{formatIDR(pnlReport.totalOperatingExpenses)}</span>
                    </div>
                  </div>

                  {/* Bottom Line Net Profit */}
                  <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex justify-between items-center text-base font-sans">
                    <div>
                      <span className="font-bold text-white">Net Operating Profit</span>
                      <p className="text-xs text-emerald-300">Net Profit Margin: {pnlReport.netMarginPercent}%</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 text-lg">
                      {formatIDR(pnlReport.netProfit)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Balance Sheet */}
            {financeSubTab === 'balance_sheet' && balanceSheet && (
              <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-stone-700/60 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Automated Balance Sheet</h2>
                    <p className="text-xs text-stone-400">Statement of Financial Position • {balanceSheet.period}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {balanceSheet.isBalanced ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Balanced: Assets = Liabilities + Equity
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                        Discrepancy Detected
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                  {/* Assets */}
                  <div className="space-y-4 bg-stone-900/60 p-5 rounded-xl border border-stone-800">
                    <h3 className="font-bold text-emerald-400 uppercase tracking-wider text-xs border-b border-stone-700 pb-2">
                      Total Assets: {formatIDR(balanceSheet.assets.totalAssets)}
                    </h3>

                    <div className="space-y-1.5">
                      <span className="text-stone-300 font-bold">Current Assets</span>
                      {balanceSheet.assets.currentAssets.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-stone-400 pl-3">
                          <span>{item.category}</span>
                          <span>{formatIDR(item.amount)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <span className="text-stone-300 font-bold">Non-Current Assets (Equipment)</span>
                      {balanceSheet.assets.nonCurrentAssets.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-stone-400 pl-3">
                          <span>{item.category}</span>
                          <span>{formatIDR(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Liabilities & Equity */}
                  <div className="space-y-4 bg-stone-900/60 p-5 rounded-xl border border-stone-800">
                    <h3 className="font-bold text-blue-400 uppercase tracking-wider text-xs border-b border-stone-700 pb-2">
                      Liabilities & Equity: {formatIDR(balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)}
                    </h3>

                    <div className="space-y-1.5">
                      <span className="text-stone-300 font-bold">Current Liabilities</span>
                      {balanceSheet.liabilities.currentLiabilities.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-stone-400 pl-3">
                          <span>{item.category}</span>
                          <span>{formatIDR(item.amount)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <span className="text-stone-300 font-bold">Shareholders' Equity</span>
                      {balanceSheet.equity.equityItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-stone-400 pl-3">
                          <span>{item.category}</span>
                          <span>{formatIDR(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Cash Flow Statement */}
            {financeSubTab === 'cash_flow' && cashFlow && (
              <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Cash Flow Statement</h2>
                  <p className="text-xs text-stone-400">Operating, Investing, and Financing Cash Movements • {cashFlow.period}</p>
                </div>

                <div className="space-y-4 text-xs font-mono">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-stone-300 font-bold uppercase pb-1 border-b border-stone-700">
                      <span>Cash Flows from Operating Activities</span>
                      <span>{formatIDR(cashFlow.netOperatingCash)}</span>
                    </div>
                    {cashFlow.operatingActivities.map((act, idx) => (
                      <div key={idx} className="flex justify-between text-stone-400 pl-4">
                        <span>{act.category}</span>
                        <span className={act.amount < 0 ? 'text-red-400' : 'text-emerald-400'}>
                          {act.amount < 0 ? `-${formatIDR(Math.abs(act.amount))}` : formatIDR(act.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-stone-300 font-bold uppercase pb-1 border-b border-stone-700">
                      <span>Cash Flows from Investing Activities</span>
                      <span>{formatIDR(cashFlow.netInvestingCash)}</span>
                    </div>
                    {cashFlow.investingActivities.map((act, idx) => (
                      <div key={idx} className="flex justify-between text-stone-400 pl-4">
                        <span>{act.category}</span>
                        <span className={act.amount < 0 ? 'text-red-400' : 'text-emerald-400'}>
                          {act.amount < 0 ? `-${formatIDR(Math.abs(act.amount))}` : formatIDR(act.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 flex justify-between items-center text-sm font-sans">
                    <span className="font-bold text-white">Ending Cash Balance</span>
                    <span className="font-mono font-bold text-emerald-400 text-base">
                      {formatIDR(cashFlow.endingCash)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 4: General Ledger Drill-Down */}
            {financeSubTab === 'gl' && (
              <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white">General Ledger (GL) Journal Entries</h2>
                    <p className="text-xs text-stone-400">Complete double-entry audit trail tagged per outlet</p>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={glSearch}
                      onChange={(e) => setGlSearch(e.target.value)}
                      placeholder="Search voucher or description..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-stone-900 border border-stone-700 text-stone-200 focus:outline-none focus:border-emerald-500 w-64"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-stone-700 text-stone-400 font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Entry ID</th>
                        <th className="py-2.5 px-3">Date / Outlet</th>
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-3 text-right">Debit</th>
                        <th className="py-2.5 px-3 text-right">Credit</th>
                        <th className="py-2.5 px-3">Ref Type</th>
                        <th className="py-2.5 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-700/50">
                      {ledgerEntries
                        .filter((entry) => {
                          if (!glSearch) return true;
                          const q = glSearch.toLowerCase();
                          return (
                            entry.id.toLowerCase().includes(q) ||
                            entry.description.toLowerCase().includes(q) ||
                            entry.accountName.toLowerCase().includes(q) ||
                            entry.accountCode.includes(q)
                          );
                        })
                        .map((entry) => (
                          <tr key={entry.id} className="hover:bg-stone-700/20 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-emerald-400">{entry.id}</td>
                            <td className="py-2.5 px-3 text-[11px] text-stone-300">
                              <div>{entry.timestamp.split('T')[0]}</div>
                              <span className="text-[10px] text-stone-500">{entry.storeName || 'Senopati'}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-white">{entry.accountCode}</span>
                              <div className="text-[11px] text-stone-400">{entry.accountName}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                              {entry.debit > 0 ? formatIDR(entry.debit) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-amber-400">
                              {entry.credit > 0 ? formatIDR(entry.credit) : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-700 text-stone-300">
                                {entry.referenceType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-stone-300 max-w-xs truncate">
                              {entry.description}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 5: Chart of Accounts */}
            {financeSubTab === 'coa' && (
              <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white">Chart of Accounts (COA) Structure</h2>
                  <p className="text-xs text-stone-400">Standardized Indonesian retail accounting codes segregated by store outlet</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-stone-700 text-stone-400 font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Account Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Normal Balance</th>
                        <th className="py-2.5 px-3">Reporting Entity</th>
                        <th className="py-2.5 px-3 text-right">Current Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-700/50">
                      {chartOfAccounts.map((acc) => (
                        <tr key={acc.accountCode} className="hover:bg-stone-700/20 transition-colors">
                          <td className="py-3 px-3 font-bold text-emerald-400">{acc.accountCode}</td>
                          <td className="py-3 px-3 font-bold text-white">{acc.accountName}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                acc.category === 'Asset'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : acc.category === 'Liability'
                                  ? 'bg-red-500/20 text-red-300'
                                  : acc.category === 'Revenue'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {acc.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-stone-400">{acc.normalBalance}</td>
                          <td className="py-3 px-3 text-stone-300">{acc.storeId}</td>
                          <td className="py-3 px-3 text-right font-bold text-white">
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
        )}

        {/* ========================================================================= */}
        {/* TAB 6: QRIS OPEN API & SPECS */}
        {/* ========================================================================= */}
        {activeTab === 'openapi' && (
          <div className="space-y-6">
            <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-purple-400" />
                    Indonesian National QR Standard (QRIS) Open API
                  </h2>
                  <p className="text-xs text-stone-400">
                    Compliant with Bank Indonesia & ASPI Dynamic QRIS Specifications (NMID: ID1020039281744)
                  </p>
                </div>
                <a
                  href="/api/qris/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold bg-stone-700 hover:bg-stone-600 text-white rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Raw openapi.json
                </a>
              </div>

              {/* Spec Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 space-y-1">
                  <span className="text-[11px] text-stone-400">Endpoint 1: Generate QRIS</span>
                  <p className="font-mono text-xs font-bold text-emerald-400">POST /api/qris/generate</p>
                  <p className="text-[11px] text-stone-400">Generates EMVCo string payload with CRC16 checksum & 15-minute expiry.</p>
                </div>

                <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 space-y-1">
                  <span className="text-[11px] text-stone-400">Endpoint 2: Real-Time Polling</span>
                  <p className="font-mono text-xs font-bold text-blue-400">GET /api/qris/status/:orderId</p>
                  <p className="text-[11px] text-stone-400">Zero-lag payment status polling for instant checkout transitions.</p>
                </div>

                <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 space-y-1">
                  <span className="text-[11px] text-stone-400">Endpoint 3: Settlement Webhook</span>
                  <p className="font-mono text-xs font-bold text-purple-400">POST /api/qris/simulate-pay</p>
                  <p className="text-[11px] text-stone-400">Simulates ASPI clearing, deducts warehouse inventory, posts GL entries.</p>
                </div>
              </div>
            </div>

            {/* Audit Trail Log */}
            <div className="bg-stone-800/40 border border-stone-700/60 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">QRIS Transaction Settlement Audit Trail</h3>
                <p className="text-xs text-stone-400">Real-time ledger links between customer QR payments and stock deductions</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-stone-700 text-stone-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Audit ID</th>
                      <th className="py-2.5 px-3">QRIS Ref</th>
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-700/50">
                    {auditRecords.map((aud) => (
                      <tr key={aud.id} className="hover:bg-stone-700/20 transition-colors">
                        <td className="py-3 px-3 font-bold text-emerald-400">{aud.id}</td>
                        <td className="py-3 px-3 text-stone-200">{aud.qrisReference}</td>
                        <td className="py-3 px-3 text-blue-400 font-bold">{aud.orderId}</td>
                        <td className="py-3 px-3 text-stone-300 font-sans">{aud.customerName}</td>
                        <td className="py-3 px-3 text-emerald-400 font-bold">{formatIDR(aud.amount)}</td>
                        <td className="py-3 px-3 text-stone-400">{aud.settlementChannel}</td>
                        <td className="py-3 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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
      </main>
    </div>
  );
};

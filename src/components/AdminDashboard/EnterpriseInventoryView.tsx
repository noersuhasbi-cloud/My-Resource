import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  B2BWholesaleOrder,
  InventoryBatch,
  InventoryItem,
  PickerOrder,
  PurchaseOrder,
  QCInspectionRecord,
  RemovalStrategyConfig,
  RemovalStrategyType,
  StockTransferRecord,
  StoreInventoryStock,
  WarehouseBinLocation,
  WasteRecord,
  WholesaleProduct,
  StoreOutletSchedule,
  StaffShiftSession,
  WarehouseRackConfig,
  ReturnableContainerRecord,
  ReturnableDirection,
  ItemClassification,
  CrossDocumentNavTarget,
  VendorBillBridgeTarget,
} from '../../types/index.ts';
import type { AdminDashboardTab } from './AdminSidebar';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { getBpjphExpiryInfo } from '../../utils/indonesianCompliance';
import {
  canSessionViewValuation,
  normalizeEnterpriseRole,
  isSessionBranchScoped,
  getSessionAssignedBranchId,
} from '../../utils/rbac';
import {
  formatMultiUomStock,
  getEnterpriseSkuProfile,
  resolveEffectiveRemovalStrategy,
  resolveLotAndFefoForTier,
} from '../../utils/inventorySkuHelper';
import {
  ArrowRightLeft,
  Barcode,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Kanban,
  Layers,
  List,
  Package,
  PackageCheck,
  Search,
  Settings2,
  ShieldAlert,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Tag,
  Trash2,
  Truck,
  Warehouse,
  X,
  Scissors,
  Zap,
  GitBranch,
  PackageMinus,
} from 'lucide-react';
import { BarcodeShelfLabelModal } from './BarcodeShelfLabelModal';
import { WarehouseRackSetupPanel } from './WarehouseRackSetupPanel';
import { RackBlindOpnamePanel } from './RackBlindOpnamePanel';
import { RepackBundlePanel } from './RepackBundlePanel';
import { FefoHeatmapRackVisualizer } from './FefoHeatmapRackVisualizer';
import { FlashSaleClearanceModal } from './FlashSaleClearanceModal';
import { ItemTraceabilityModal } from './ItemTraceabilityModal';

interface EnterpriseInventoryViewProps {
  theme: 'light' | 'dark';
  activeStaffSession?: StaffShiftSession | null;
  enableB2BFeatures?: boolean;
  selectedOutletFilter: string;
  onOutletFilterChange: (val: string) => void;
  selectedStorageZoneFilter: string;
  onStorageZoneFilterChange: (val: string) => void;
  inventorySearch: string;
  onInventorySearchChange: (val: string) => void;
  filteredTiers: StoreInventoryStock[];
  allTiers: StoreInventoryStock[];
  inventory: InventoryItem[];
  batches: InventoryBatch[];
  warehouseBins: WarehouseBinLocation[];
  purchaseOrders: PurchaseOrder[];
  qcInspections: QCInspectionRecord[];
  storeOutlets?: StoreOutletSchedule[];
  stockTransfers: StockTransferRecord[];
  pickerOrders: PickerOrder[];
  b2bOrders: B2BWholesaleOrder[];
  wholesaleProducts: WholesaleProduct[];
  wasteRecords: WasteRecord[];
  removalStrategies: RemovalStrategyConfig | null;
  onSaveRemovalStrategies: (next: Partial<RemovalStrategyConfig>) => Promise<void>;
  onNavigateTab: (tab: AdminDashboardTab) => void;
  onNavigateToDocument?: (nav: CrossDocumentNavTarget) => void;
  onNavigateToProcurementDoc?: (subTab: 'pr' | 'po' | 'gr', docId: string) => void;
  onNavigateToVendorBill?: (bridge: Omit<VendorBillBridgeTarget, 'triggerNonce'>) => void;
  onAuditSku: (sku: string) => void;
  onEditTier: (tier: StoreInventoryStock) => void;
  onRefreshData?: () => Promise<void> | void;
  onShowToast: (title: string, message: string) => void;
  renderStocktakeImport?: () => React.ReactNode;
}

type InventoryViewMode = 'kanban' | 'list' | 'racks' | 'fefo_heatmap' | 'stocktake_opname' | 'repack_bundle' | 'returnables';
type ChannelFilter = 'ALL' | 'B2C' | 'B2B' | 'BOTH';
type HubScope = 'ALL' | 'CDC' | 'DARK_STORE' | 'RETAIL_FRONTS';

interface MediaInspectorTarget {
  sku: string;
  productName: string;
  category: string;
  unit: string;
  unitCost: number;
  sellingPrice: number;
  physicalStock: number;
  availableStock: number;
  reservedStock: number;
  incomingStock: number;
  storeName: string;
  binLocation: string;
  strategy: RemovalStrategyType;
}

const HUB_DEFINITIONS: {
  id: Exclude<HubScope, 'ALL'>;
  title: string;
  subtitle: string;
  storeIds: string[];
  code: string;
}[] = [
  {
    id: 'CDC',
    title: 'Central Distribution Center',
    subtitle: 'Senopati CDC · Master Cold-Chain & B2B Bulk Staging',
    storeIds: ['store-jkt-senopati'],
    code: 'WH-CDC-01',
  },
  {
    id: 'DARK_STORE',
    title: 'Dark Store Fulfillment Hub',
    subtitle: 'PIK 2 The Avenue · Same-Day Express & Click-and-Collect',
    storeIds: ['store-jkt-pik'],
    code: 'WH-DRK-02',
  },
  {
    id: 'RETAIL_FRONTS',
    title: 'Retail Fronts & Regional Stores',
    subtitle: 'Bandung Dago, Menteng, Surabaya & Bali Branches',
    storeIds: ['store-bdg-dago', 'store-jkt-menteng', 'store-sby-gubeng', 'store-bali-canggu'],
    code: 'WH-RTL-03',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Fresh Produce (Cold Chilled)',
  bakery: 'Artisan Bakery',
  dairy_eggs: 'Dairy & Farm Fresh Eggs',
  meat_seafood: 'Butchery & Seafood (Freezer)',
  pantry_coffee: 'Pantry & Roasted Coffee',
  pantry_staples: 'B2B Sembako & Rice',
  cooking_oil: 'B2B Cooking Oil',
  instant_noodles: 'B2B Instant Noodles',
  beverages: 'B2B Beverages & Coffee',
  household_hygiene: 'B2B Household & Hygiene',
};

export const EnterpriseInventoryView: React.FC<EnterpriseInventoryViewProps> = ({
  theme,
  activeStaffSession,
  selectedOutletFilter,
  onOutletFilterChange,
  selectedStorageZoneFilter,
  onStorageZoneFilterChange,
  inventorySearch,
  onInventorySearchChange,
  filteredTiers,
  allTiers,
  inventory,
  batches,
  warehouseBins,
  purchaseOrders,
  qcInspections,
  storeOutlets = [],
  stockTransfers,
  pickerOrders,
  b2bOrders,
  wholesaleProducts,
  wasteRecords,
  removalStrategies,
  onSaveRemovalStrategies,
  onNavigateTab,
  onNavigateToDocument,
  onAuditSku,
  onEditTier,
  onRefreshData,
  onShowToast,
  renderStocktakeImport,
}) => {
  const isLight = theme === 'light';
  const canViewValuation = canSessionViewValuation(activeStaffSession);
  const canonicalRole = activeStaffSession ? normalizeEnterpriseRole(activeStaffSession.userRole) : 'super_admin';
  const isBranchScoped = isSessionBranchScoped(activeStaffSession);
  const lockedBranchId = getSessionAssignedBranchId(activeStaffSession) || 'store-jkt-senopati';
  const canManageWarehouseTopology =
    canonicalRole === 'warehouse' ||
    canonicalRole === 'store_manager' ||
    canonicalRole === 'coo' ||
    canonicalRole === 'super_admin';
  const [viewMode, setViewMode] = useState<InventoryViewMode>('kanban');
  const [hubFilter, setHubFilter] = useState<HubScope>('ALL');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<'ALL' | RemovalStrategyType>('ALL');
  const [classificationFilter, setClassificationFilter] = useState<'ALL' | ItemClassification>('ALL');
  const [includeB2BCatalogRows, setIncludeB2BCatalogRows] = useState<boolean>(true);
  const [showStrategyModal, setShowStrategyModal] = useState<boolean>(false);
  const [showBarcodeLabelModal, setShowBarcodeLabelModal] = useState<boolean>(false);
  const [opnameWorkspaceMode, setOpnameWorkspaceMode] = useState<'standard_import' | 'rack_blind'>('standard_import');
  const [savingStrategy, setSavingStrategy] = useState<boolean>(false);
  const [mediaInspector, setMediaInspector] = useState<MediaInspectorTarget | null>(null);
  const [traceabilityTarget, setTraceabilityTarget] = useState<{ sku: string; productName: string } | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [warehouseRacks, setWarehouseRacks] = useState<WarehouseRackConfig[]>([]);
  const [flashSaleTargetBatch, setFlashSaleTargetBatch] = useState<InventoryBatch | null>(null);
  const [returnableRecords, setReturnableRecords] = useState<ReturnableContainerRecord[]>([]);
  const [returnableSummary, setReturnableSummary] = useState<{
    totalIssuedUnits: number;
    totalReturnedUnits: number;
    totalOutstandingUnits: number;
    customerDepositLiabilityIDR: number;
    supplierDepositAssetIDR: number;
  } | null>(null);
  const [isLoadingReturnables, setIsLoadingReturnables] = useState<boolean>(false);
  const [isSubmittingReturnable, setIsSubmittingReturnable] = useState<boolean>(false);
  const [retDirection, setRetDirection] = useState<ReturnableDirection>('OUT_TO_CUSTOMER');
  const [retContainerType, setRetContainerType] = useState<string>('KRAT_PLASTIK_BUAH');
  const [retCounterparty, setRetCounterparty] = useState<string>('');
  const [retQtyIssued, setRetQtyIssued] = useState<number>(10);
  const [retDepositPerUnit, setRetDepositPerUnit] = useState<number>(50000);
  const [retRefDoc, setRetRefDoc] = useState<string>('');
  const [retSettlementAccount, setRetSettlementAccount] = useState<'1010' | '1020' | '1200'>('1010');
  const [retPartialReturnMap, setRetPartialReturnMap] = useState<Record<string, number>>({});

  const loadReturnables = React.useCallback(async () => {
    setIsLoadingReturnables(true);
    try {
      const res = await apiClient.getReturnableContainers({ storeId: selectedOutletFilter });
      setReturnableRecords(res.records || []);
      setReturnableSummary(res.summary || null);
    } catch {
      // keep silent on initial load if forbidden for restricted viewer
    } finally {
      setIsLoadingReturnables(false);
    }
  }, [selectedOutletFilter]);

  React.useEffect(() => {
    if (viewMode === 'returnables') {
      loadReturnables();
    }
  }, [viewMode, loadReturnables]);

  React.useEffect(() => {
    if (viewMode !== 'repack_bundle') return;
    apiClient
      .getWarehouseRacks(selectedOutletFilter)
      .then((res) => setWarehouseRacks(res.racks || []))
      .catch(() => {});
  }, [viewMode, selectedOutletFilter]);

  const cardClass =
    'bg-white dark:bg-[#12141C] border border-slate-200 dark:border-slate-800/80 shadow-sm text-slate-900 dark:text-slate-100 rounded-2xl transition-colors duration-200';
  const subCardClass =
    'bg-slate-50 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800/80 text-slate-900 dark:text-slate-100 rounded-xl transition-colors duration-200';
  const textTitle = 'text-slate-900 dark:text-slate-100';
  const textMuted = 'text-slate-500 dark:text-slate-400';
  const tableHeaderClass =
    'border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#090A0F] text-slate-600 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider';
  const inputClass =
    'bg-white dark:bg-[#090A0F] border border-slate-300 dark:border-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#164E29] dark:focus:border-emerald-400 focus:ring-1 focus:ring-[#164E29] dark:focus:ring-emerald-400';
  const modalClass =
    'bg-white dark:bg-[#12141C] border border-slate-200 dark:border-slate-800/80 text-slate-900 dark:text-slate-100 shadow-2xl rounded-2xl';

  // Aggregate summary metrics across retail tiers + B2B catalog (COA #1040 excludes Fixed Assets & Consumables)
  const summaryMetrics = useMemo(() => {
    const retailValuation = allTiers
      .filter((t) => !t.itemClassification || t.itemClassification === 'MERCHANDISE')
      .reduce((sum, t) => sum + (t.physicalStock || 0) * (t.unitCost || 0), 0);
    const b2bValuation = wholesaleProducts.reduce(
      (sum, p) => sum + (p.currentStockBaseUnits || 0) * Math.round((p.baseUnitPrice || 0) * 0.72),
      0
    );
    const totalPhysicalBaseUnits =
      allTiers.reduce((s, t) => s + (t.physicalStock || 0), 0) +
      wholesaleProducts.reduce((s, p) => s + (p.currentStockBaseUnits || 0), 0);
    const totalReserved = allTiers.reduce((s, t) => s + (t.reservedStock || 0), 0);
    const nearExpiryLots = batches.filter(
      (b) => b.currentStock > 0 && (b.status === 'near_expiry' || b.status === 'critical' || (b.daysUntilExpiry ?? 99) <= 7)
    ).length;
    const quarantinedLots = batches.filter(
      (b) => b.status === 'quarantined' || b.status === 'recalled' || b.status === 'expired'
    ).length;

    return {
      totalValuationIDR: retailValuation + b2bValuation,
      totalPhysicalBaseUnits,
      totalReserved,
      nearExpiryLots,
      quarantinedLots,
    };
  }, [allTiers, wholesaleProducts, batches]);

  // Build B2B Wholesale virtual Stock Quant rows for unified B2B + B2C list view
  const wholesaleQuantRows = useMemo(() => {
    if (!includeB2BCatalogRows) return [];
    if (selectedOutletFilter !== 'ALL' && selectedOutletFilter !== 'CONSOLIDATED' && selectedOutletFilter !== 'store-jkt-senopati') {
      return [];
    }
    return wholesaleProducts
      .filter((prod) => {
        if (selectedStorageZoneFilter !== 'ALL') {
          const isCold = prod.sku.includes('TELUR') || prod.sku.includes('SUSU');
          if (selectedStorageZoneFilter === 'cold_chilled' && !isCold) return false;
          if (selectedStorageZoneFilter === 'ambient' && isCold) return false;
          if (selectedStorageZoneFilter === 'freezer') return false;
        }
        if (inventorySearch) {
          const q = inventorySearch.toLowerCase();
          return (
            prod.name.toLowerCase().includes(q) ||
            prod.sku.toLowerCase().includes(q) ||
            prod.categoryLabel.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .map((prod) => {
        const estimatedUnitCost = Math.round(prod.baseUnitPrice * 0.72);
        const reservedB2B = b2bOrders
          .filter((o) => o.status === 'PENDING_FINANCE' || o.status === 'CONFIRMED' || o.status === 'PICKING')
          .reduce(
            (sum, o) =>
              sum +
              o.items
                .filter((it) => it.product?.sku === prod.sku)
                .reduce((s2, it) => s2 + (it.baseUnitsCalculated || 0), 0),
            0
          );
        const physical = prod.currentStockBaseUnits;
        const available = Math.max(0, physical - reservedB2B);
        return {
          id: `B2B-QUANT-${prod.id}`,
          sku: prod.sku,
          productName: prod.name,
          category: prod.category,
          storeId: 'store-jkt-senopati',
          storeName: 'Central Distribution Center (B2B Hub)',
          warehouseZoneId: prod.sku.includes('SUSU') || prod.sku.includes('TELUR') ? 'WH-JKT-SEN-COLD' : 'WH-JKT-SEN-AMB',
          physicalStock: physical,
          availableStock: available,
          reservedStock: reservedB2B,
          incomingStock: 0,
          unitCost: estimatedUnitCost,
          sellingPrice: prod.baseUnitPrice,
          unit: prod.baseUnit,
          image: prod.b2bImageUrl || prod.image,
          isWholesaleRow: true as const,
          sourceTier: undefined as StoreInventoryStock | undefined,
        };
      });
  }, [includeB2BCatalogRows, wholesaleProducts, b2bOrders, selectedOutletFilter, selectedStorageZoneFilter, inventorySearch]);

  // Unified filtered rows with Channel + Removal Strategy filters
  const enrichedListRows = useMemo(() => {
    const retailRows = filteredTiers.map((tier) => ({
      ...tier,
      isWholesaleRow: false as const,
      sourceTier: tier,
      image: undefined as string | undefined,
    }));
    const combined = [...retailRows, ...wholesaleQuantRows];

    return combined
      .map((row) => {
        const profile = getEnterpriseSkuProfile(row.sku, row.category, row.unit, row.image);
        const strategy = resolveEffectiveRemovalStrategy(row.sku, row.category, removalStrategies);
        const lotInfo = resolveLotAndFefoForTier(
          row.sku,
          row.storeId,
          row.warehouseZoneId,
          batches,
          warehouseBins,
          strategy,
          profile.defaultBinLocation
        );
        const safePhysical = Math.max(0, Number(row.physicalStock) || 0);
        const safeReserved = Math.max(0, Number(row.reservedStock) || 0);
        const safeAvailable = Math.max(0, Number((safePhysical - safeReserved).toFixed(2)));
        const uomBreakdown = formatMultiUomStock(safePhysical, profile.uomConversion);
        const availableUom = formatMultiUomStock(safeAvailable, profile.uomConversion);
        const totalValuation = safePhysical * (row.unitCost || 0);
        const invMeta = inventory.find((it) => it.sku === row.sku);
        const itemClassification: ItemClassification =
          (!row.isWholesaleRow && row.itemClassification) ||
          invMeta?.itemClassification ||
          'MERCHANDISE';
        return {
          row,
          safePhysical,
          safeReserved,
          safeAvailable,
          profile,
          strategy,
          lotInfo,
          uomBreakdown,
          availableUom,
          totalValuation,
          itemClassification,
        };
      })
      .filter((entry) => {
        if (channelFilter !== 'ALL') {
          if (channelFilter === 'B2C' && entry.profile.salesChannel === 'B2B') return false;
          if (channelFilter === 'B2B' && entry.profile.salesChannel === 'B2C') return false;
          if (channelFilter === 'BOTH' && entry.profile.salesChannel !== 'BOTH') return false;
        }
        if (strategyFilter !== 'ALL' && entry.strategy !== strategyFilter) return false;
        if (classificationFilter !== 'ALL' && entry.itemClassification !== classificationFilter) return false;
        return true;
      });
  }, [filteredTiers, wholesaleQuantRows, removalStrategies, batches, warehouseBins, inventory, channelFilter, strategyFilter, classificationFilter]);

  // Store Consumable Issuance (#1050 -> #5040) Modal State
  const canIssueConsumables =
    !activeStaffSession?.roleCode ||
    ['WAREHOUSE_HEAD', 'WAREHOUSE_STAFF', 'STORE_MANAGER', 'HEAD_ACCOUNTING', 'CLIENT_OWNER', 'PLATFORM_OWNER', 'SUPER_ADMIN'].includes(
      activeStaffSession.roleCode
    );
  const [consumableIssueTarget, setConsumableIssueTarget] = useState<{
    sku: string;
    productName: string;
    storeId: string;
    storeName: string;
    unit: string;
    availableStock: number;
    unitCost: number;
  } | null>(null);
  const [issueQty, setIssueQty] = useState<number>(1);
  const [issueDepartment, setIssueDepartment] = useState<string>('Store Operations');
  const [issuePurpose, setIssuePurpose] = useState<string>('POS Terminal / Daily Store Operations Usage');
  const [isSubmittingConsumable, setIsSubmittingConsumable] = useState<boolean>(false);

  const handleConfirmConsumableIssuance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumableIssueTarget) return;
    const qty = Number(issueQty || 0);
    if (!Number.isFinite(qty) || qty <= 0 || qty > consumableIssueTarget.availableStock) {
      onShowToast(
        'Invalid Quantity',
        `Issued quantity must be > 0 and <= available ATP (${consumableIssueTarget.availableStock} ${consumableIssueTarget.unit}).`
      );
      return;
    }
    setIsSubmittingConsumable(true);
    try {
      const res = await apiClient.issueConsumableUsage({
        sku: consumableIssueTarget.sku,
        storeId: consumableIssueTarget.storeId,
        quantity: qty,
        department: issueDepartment.trim() || 'Store Operations',
        purpose: issuePurpose.trim() || 'Internal Store Usage',
      });
      onShowToast('Consumable Issued', res.message);
      setConsumableIssueTarget(null);
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      onShowToast('Consumable Issuance Failed', err.message || 'Failed to issue consumable usage');
    } finally {
      setIsSubmittingConsumable(false);
    }
  };

  // Compute live operational counts per Warehouse Hub for GroceMatrix™ Kanban Cards
  const hubKanbanCards = useMemo(() => {
    const visibleHubs =
      hubFilter === 'ALL' ? HUB_DEFINITIONS : HUB_DEFINITIONS.filter((h) => h.id === hubFilter);

    return visibleHubs.map((hub) => {
      const storeSet = new Set(hub.storeIds);
      const hubTiers = allTiers.filter((t) => storeSet.has(t.storeId));
      const hubPOs = purchaseOrders.filter((p) => storeSet.has(p.storeId));
      const hubBatches = batches.filter((b) => storeSet.has(b.storeId));
      const hubQc = qcInspections.filter((q) => storeSet.has(q.storeId));
      const hubWaste = wasteRecords.filter((w) => storeSet.has(w.storeId));
      const hubPickers = pickerOrders.filter((p) => storeSet.has(p.storeId));
      const hubTransfersOut = stockTransfers.filter((tr) => storeSet.has(tr.sourceStoreId) || storeSet.has(tr.destinationStoreId));

      // 1. Receipts (Inbound PO & QC)
      const poToProcess = hubPOs.filter(
        (p) =>
          p.status === 'Sent' ||
          p.status === 'Partially Received' ||
          p.status === 'pending_approval' ||
          p.status === 'PENDING_APPROVAL' ||
          p.status === 'APPROVED'
      ).length;
      const poWaitingQc = hubQc.filter((q) => q.disposition === 'QUARANTINED').length;
      const poBackorderUnits = hubPOs
        .filter((p) => p.status === 'Partially Received')
        .reduce(
          (sum, po) => sum + po.items.reduce((s2, it) => s2 + (it.remainingBackorder || 0), 0),
          0
        );

      // 2. Internal Transfers
      const lowStockNeedTransfer = hubTiers.filter((t) => t.availableStock <= t.minimumThreshold).length;
      const activeTransferCount = hubTransfersOut.filter((tr) => tr.status === 'in_transit').length;
      const completedTransfers = hubTransfersOut.length;

      // 3. B2C Retail Deliveries
      const b2cToPick = hubPickers.filter(
        (o) => o.pickerStatus === 'assigned' || o.pickerStatus === 'in_progress'
      ).length;
      const b2cReadyPack = hubPickers.filter((o) => o.pickerStatus === 'ready_for_packing').length;
      const b2cTotal = hubPickers.length || (hub.id === 'CDC' ? 2 : 1);

      // 4. B2B Wholesale Bulk Dispatch (managed primarily from CDC, shown across network context)
      const b2bToDispatch =
        hub.id === 'CDC'
          ? b2bOrders.filter((o) => o.status === 'CONFIRMED' || o.status === 'PICKING').length
          : 0;
      const b2bWaitingFinance =
        hub.id === 'CDC'
          ? b2bOrders.filter((o) => o.status === 'PENDING_FINANCE' || o.status === 'DRAFT').length
          : 0;
      const b2bDispatched =
        hub.id === 'CDC'
          ? b2bOrders.filter((o) => o.status === 'DISPATCHED' || o.status === 'DELIVERED').length
          : 0;

      // 5. POS Shelf Replenishment
      const posNeedsRestock = hubTiers.filter((t) => t.availableStock <= t.minimumThreshold).length;
      const posCriticalBuffer = hubTiers.filter((t) => t.availableStock <= t.safetyStockBuffer).length;
      const posIncomingRestock = hubTiers.filter((t) => t.incomingStock > 0).length;

      // 6. Scrap, Quarantine & Recall
      const quarantinedCount = hubBatches.filter(
        (b) => b.status === 'quarantined' || b.status === 'recalled' || b.status === 'expired'
      ).length;
      const nearExpiryCount = hubBatches.filter(
        (b) => b.currentStock > 0 && (b.status === 'near_expiry' || b.status === 'critical')
      ).length;

      const operations = [
        {
          id: 'receipts',
          title: 'Receipts (Inbound PO & QC)',
          subtitle: 'Vendor deliveries, Partial GR & Dock Inspection',
          icon: PackageCheck,
          accentColor: 'text-[#0F4C3A] dark:text-emerald-400',
          iconBg: 'bg-emerald-500/10 text-[#0F4C3A] dark:text-emerald-400',
          barColor: 'bg-[#0F4C3A] dark:bg-emerald-500',
          toProcessCount: poToProcess,
          primaryLabel: poToProcess > 0 ? `Process ${poToProcess} To Do` : 'Review Receipts',
          targetTab: 'procurement' as AdminDashboardTab,
          secondaryAction: { label: 'QC Queue', tab: 'qc' as AdminDashboardTab },
          metrics: [
            { label: 'To Receive', value: poToProcess, tone: poToProcess > 0 ? 'emerald' : 'slate' },
            { label: 'Backorder Pcs', value: poBackorderUnits, tone: poBackorderUnits > 0 ? 'amber' : 'slate' },
            { label: 'QC Hold', value: poWaitingQc, tone: poWaitingQc > 0 ? 'rose' : 'slate' },
          ],
          progressPercent: Math.min(100, poToProcess > 0 ? 45 + poToProcess * 15 : 100),
        },
        {
          id: 'transfers',
          title: 'Internal Transfers',
          subtitle: 'Inter-warehouse cold-chain balancing & bin moves',
          icon: ArrowRightLeft,
          accentColor: 'text-sky-700 dark:text-sky-400',
          iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
          barColor: 'bg-sky-600 dark:bg-sky-500',
          toProcessCount: lowStockNeedTransfer,
          primaryLabel: lowStockNeedTransfer > 0 ? `Balance ${lowStockNeedTransfer} Low SKUs` : 'New Transfer',
          targetTab: 'transfers' as AdminDashboardTab,
          secondaryAction: { label: 'Surat Jalan', tab: 'logistics' as AdminDashboardTab },
          metrics: [
            { label: 'Low Stock Req', value: lowStockNeedTransfer, tone: lowStockNeedTransfer > 0 ? 'amber' : 'slate' },
            { label: 'In Transit', value: activeTransferCount, tone: activeTransferCount > 0 ? 'sky' : 'slate' },
            { label: 'Logged Moves', value: completedTransfers, tone: 'slate' },
          ],
          progressPercent: Math.min(100, Math.max(20, 100 - lowStockNeedTransfer * 18)),
        },
        {
          id: 'b2c_deliveries',
          title: 'B2C Retail Deliveries',
          subtitle: 'Same-Day Express & Click-and-Collect Picker Queue',
          icon: ShoppingBag,
          accentColor: 'text-indigo-700 dark:text-indigo-400',
          iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
          barColor: 'bg-indigo-600 dark:bg-indigo-500',
          toProcessCount: b2cToPick,
          primaryLabel: b2cToPick > 0 ? `Pick ${b2cToPick} Orders` : 'Open Picker Hub',
          targetTab: 'picker' as AdminDashboardTab,
          secondaryAction: { label: 'FEFO Lots', tab: 'fefo' as AdminDashboardTab },
          metrics: [
            { label: 'To Pick', value: b2cToPick, tone: b2cToPick > 0 ? 'amber' : 'slate' },
            { label: 'Packed Ready', value: b2cReadyPack, tone: 'emerald' },
            { label: 'Queue Total', value: b2cTotal, tone: 'slate' },
          ],
          progressPercent: b2cTotal > 0 ? Math.round(((b2cTotal - b2cToPick) / b2cTotal) * 100) : 100,
        },
        {
          id: 'b2b_dispatch',
          title: 'B2B Wholesale Bulk Dispatch',
          subtitle: 'Pallet, Dus & Renceng Outbound (Warung / Agen / HoReCa)',
          icon: Truck,
          accentColor: 'text-amber-700 dark:text-amber-400',
          iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          barColor: 'bg-amber-600 dark:bg-amber-500',
          toProcessCount: b2bToDispatch,
          primaryLabel:
            b2bToDispatch > 0
              ? `Dispatch ${b2bToDispatch} Bulk`
              : b2bWaitingFinance > 0
              ? `Review ${b2bWaitingFinance} Credit`
              : 'Fleet & DO Docs',
          targetTab: (b2bWaitingFinance > 0 && b2bToDispatch === 0 ? 'approvals' : 'logistics') as AdminDashboardTab,
          secondaryAction: { label: 'Credit Queue', tab: 'approvals' as AdminDashboardTab },
          metrics: [
            { label: 'To Dispatch', value: b2bToDispatch, tone: b2bToDispatch > 0 ? 'emerald' : 'slate' },
            { label: 'Finance Hold', value: b2bWaitingFinance, tone: b2bWaitingFinance > 0 ? 'amber' : 'slate' },
            { label: 'Dispatched', value: b2bDispatched, tone: 'slate' },
          ],
          progressPercent:
            b2bOrders.length > 0 && hub.id === 'CDC'
              ? Math.round((b2bDispatched / b2bOrders.length) * 100)
              : 100,
        },
        {
          id: 'pos_replenishment',
          title: 'POS Shelf Replenishment',
          subtitle: 'Backroom-to-storefront restock triggers & safety buffers',
          icon: Store,
          accentColor: 'text-teal-700 dark:text-teal-400',
          iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
          barColor: 'bg-teal-600 dark:bg-teal-500',
          toProcessCount: posNeedsRestock,
          primaryLabel: posNeedsRestock > 0 ? `Restock ${posNeedsRestock} SKUs` : 'Open POS Terminal',
          targetTab: (posNeedsRestock > 0 ? 'procurement' : 'pos') as AdminDashboardTab,
          secondaryAction: { label: 'POS Counter', tab: 'pos' as AdminDashboardTab },
          metrics: [
            { label: 'Below Min', value: posNeedsRestock, tone: posNeedsRestock > 0 ? 'amber' : 'slate' },
            { label: 'Critical Buffer', value: posCriticalBuffer, tone: posCriticalBuffer > 0 ? 'rose' : 'slate' },
            { label: 'Incoming PO', value: posIncomingRestock, tone: 'emerald' },
          ],
          progressPercent:
            hubTiers.length > 0
              ? Math.max(15, Math.round(((hubTiers.length - posNeedsRestock) / hubTiers.length) * 100))
              : 100,
        },
        {
          id: 'scrap_quarantine',
          title: 'Scrap, Quarantine & Recall',
          subtitle: 'Isolated expired lots, QC holds & COA #6030 write-offs',
          icon: Trash2,
          accentColor: 'text-rose-700 dark:text-rose-400',
          iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
          barColor: 'bg-rose-600 dark:bg-rose-500',
          toProcessCount: quarantinedCount + nearExpiryCount,
          primaryLabel:
            quarantinedCount + nearExpiryCount > 0
              ? `Inspect ${quarantinedCount + nearExpiryCount} Lots`
              : 'Waste Ledger',
          targetTab: (nearExpiryCount > 0 ? 'fefo' : 'waste') as AdminDashboardTab,
          secondaryAction: { label: 'Write-Off', tab: 'waste' as AdminDashboardTab },
          metrics: [
            { label: 'Quarantined', value: quarantinedCount, tone: quarantinedCount > 0 ? 'rose' : 'slate' },
            { label: 'Near Expiry', value: nearExpiryCount, tone: nearExpiryCount > 0 ? 'amber' : 'slate' },
            { label: 'Scrapped Logs', value: hubWaste.length, tone: 'slate' },
          ],
          progressPercent: Math.max(10, Math.min(100, 100 - (quarantinedCount + nearExpiryCount) * 15)),
        },
      ];

      const safeStockSkus = hubTiers.filter((t) => {
        const atp = Math.max(0, t.physicalStock - t.reservedStock);
        return atp > t.minimumThreshold;
      }).length;
      const approachingSafetySkus = hubTiers.filter((t) => {
        const atp = Math.max(0, t.physicalStock - t.reservedStock);
        return atp > 0 && atp <= t.minimumThreshold;
      }).length;
      const criticalOutSkus = hubTiers.filter((t) => {
        const atp = Math.max(0, t.physicalStock - t.reservedStock);
        return atp <= 0;
      }).length;

      return {
        hub,
        skuCount: hubTiers.length + (hub.id === 'CDC' ? wholesaleProducts.length : 0),
        totalUnits:
          hubTiers.reduce((s, t) => s + t.physicalStock, 0) +
          (hub.id === 'CDC'
            ? wholesaleProducts.reduce((s, p) => s + p.currentStockBaseUnits, 0)
            : 0),
        healthSummary: {
          safe: safeStockSkus,
          approaching: approachingSafetySkus,
          critical: criticalOutSkus,
        },
        operations,
      };
    });
  }, [
    hubFilter,
    allTiers,
    purchaseOrders,
    batches,
    qcInspections,
    wasteRecords,
    pickerOrders,
    stockTransfers,
    b2bOrders,
    wholesaleProducts,
  ]);

  const handleToggleRowStrategy = async (sku: string, current: RemovalStrategyType) => {
    const nextStrategy: RemovalStrategyType = current === 'FEFO' ? 'FIFO' : 'FEFO';
    setSavingStrategy(true);
    try {
      await onSaveRemovalStrategies({
        skuOverrides: {
          ...(removalStrategies?.skuOverrides || {}),
          [sku]: nextStrategy,
        },
      });
      onShowToast(
        'Removal Strategy Updated',
        `${sku} switched to ${nextStrategy} (${nextStrategy === 'FEFO' ? 'First Expired, First Out' : 'First In, First Out'}).`
      );
    } catch (err) {
      onShowToast('Strategy Update Failed', String(err));
    } finally {
      setSavingStrategy(false);
    }
  };

  const handleCategoryStrategyChange = async (cat: string, value: RemovalStrategyType) => {
    setSavingStrategy(true);
    try {
      await onSaveRemovalStrategies({
        categoryStrategies: {
          ...(removalStrategies?.categoryStrategies || {}),
          [cat]: value,
        },
      });
      onShowToast('Category Policy Updated', `${CATEGORY_LABELS[cat] || cat} set to ${value}.`);
    } catch (err) {
      onShowToast('Update Failed', String(err));
    } finally {
      setSavingStrategy(false);
    }
  };

  const renderThumbnail = (
    src: string,
    alt: string,
    sku: string,
    sizeClass = 'w-10 h-10 rounded-lg'
  ) => {
    const key = `${sku}-${src}`;
    if (failedImages[key] || !src) {
      return (
        <div
          className={`${sizeClass} flex items-center justify-center shrink-0 border ${
            isLight
              ? 'bg-emerald-50 border-emerald-200 text-[#0F4C3A]'
              : 'bg-emerald-950/50 border-emerald-800/50 text-emerald-400'
          }`}
        >
          <Package className="w-4 h-4" />
        </div>
      );
    }
    return (
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailedImages((prev) => ({ ...prev, [key]: true }))}
        className={`${sizeClass} object-cover shrink-0 border ${
          isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-800/80 bg-[#090A0F]'
        }`}
      />
    );
  };

  const mostUrgentClearanceBatch = useMemo(() => {
    const candidates = batches
      .filter(
        (b) =>
          b.currentStock > 0 &&
          b.daysUntilExpiry > 0 &&
          b.daysUntilExpiry <= 7 &&
          b.status !== 'expired' &&
          b.status !== 'recalled' &&
          b.status !== 'quarantined' &&
          (selectedOutletFilter === 'ALL' ||
            selectedOutletFilter === 'CONSOLIDATED' ||
            b.storeId === selectedOutletFilter)
      )
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    return candidates[0] || null;
  }, [batches, selectedOutletFilter]);

  const tabButtonBase =
    'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer';
  const tabButtonActive =
    'bg-[#164E29] text-white font-semibold shadow-sm dark:bg-emerald-950/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50';
  const tabButtonInactive =
    'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/90 hover:text-[#164E29] dark:hover:text-emerald-400';

  return (
    <div className="space-y-5 text-slate-900 dark:text-slate-100">
      {/* GroceMatrix™ Inventory Operations Command Header + View Switcher (3-Row Stacked Hierarchy) */}
      <div className={`${cardClass} p-4 sm:p-5 space-y-4`}>
        {/* ROW 1: Full-width Deep Forest Green Header Banner (Clean single-line desktop title, zero collision) */}
        <div className="w-full rounded-xl bg-[#164E29] dark:bg-emerald-950/80 border border-[#164E29] dark:border-emerald-800/50 text-white dark:text-slate-100 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-medium text-emerald-100 dark:text-emerald-300">
              <span className="font-semibold text-white dark:text-emerald-400">
                GroceMatrix™ Inventory Engine
              </span>
              <span aria-hidden="true" className="opacity-60">·</span>
              <span>Multi-Warehouse Operations</span>
              <span aria-hidden="true" className="opacity-60">·</span>
              <span>B2B/B2C Catalog Split</span>
              <span aria-hidden="true" className="opacity-60">·</span>
              <span>FEFO/FIFO Engine</span>
            </div>
            <h2 className="text-[19px] sm:text-[20px] font-semibold tracking-[-0.01em] leading-snug text-white dark:text-slate-100 lg:whitespace-nowrap lg:truncate">
              Warehouse Operations, Stock Quants &amp; Lot Traceability
            </h2>
          </div>
        </div>

        {/* ROW 2: Dedicated White/Dark Card Container for Navigation Tabs (Single Crisp 7-Tab Row) */}
        <div
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#12141C] shadow-xs p-2"
          role="tablist"
          aria-label="Inventory view switcher"
        >
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 overflow-x-auto">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'kanban'}
              onClick={() => setViewMode('kanban')}
              className={`${tabButtonBase} ${
                viewMode === 'kanban' ? tabButtonActive : tabButtonInactive
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban Operations
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`${tabButtonBase} ${
                viewMode === 'list' ? tabButtonActive : tabButtonInactive
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Stock &amp; Lot List
            </button>
            {canManageWarehouseTopology && (
              <>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'racks'}
                  onClick={() => setViewMode('racks')}
                  className={`${tabButtonBase} ${
                    viewMode === 'racks' ? tabButtonActive : tabButtonInactive
                  }`}
                >
                  <Warehouse className="w-3.5 h-3.5" />
                  Warehouse Rack Setup
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'fefo_heatmap'}
                  onClick={() => setViewMode('fefo_heatmap')}
                  className={`${tabButtonBase} ${
                    viewMode === 'fefo_heatmap' ? tabButtonActive : tabButtonInactive
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  FEFO Rack Heatmap
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'stocktake_opname'}
                  onClick={() => setViewMode('stocktake_opname')}
                  className={`${tabButtonBase} ${
                    viewMode === 'stocktake_opname' ? tabButtonActive : tabButtonInactive
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Stocktake &amp; Opname
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'repack_bundle'}
                  onClick={() => setViewMode('repack_bundle')}
                  className={`${tabButtonBase} ${
                    viewMode === 'repack_bundle' ? tabButtonActive : tabButtonInactive
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Repacking
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'returnables'}
                  onClick={() => setViewMode('returnables')}
                  className={`${tabButtonBase} ${
                    viewMode === 'returnables' ? tabButtonActive : tabButtonInactive
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  Krat &amp; Galon
                </button>
              </>
            )}
          </div>
        </div>

        {/* ROW 3: Secondary Action Buttons & High-Intent Flash Sale Trigger */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowStrategyModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/90 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <Settings2 className="w-3.5 h-3.5 text-[#164E29] dark:text-emerald-400" />
              FEFO / FIFO Rules
            </button>

            <button
              type="button"
              onClick={() => setShowBarcodeLabelModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#164E29] hover:bg-[#0F4C3A] dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50 text-white transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <Barcode className="w-3.5 h-3.5" />
              Barcode &amp; Shelf Labels
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (mostUrgentClearanceBatch) {
                setFlashSaleTargetBatch(mostUrgentClearanceBatch);
              } else {
                setViewMode('fefo_heatmap');
                onShowToast(
                  'FEFO Clearance Monitor',
                  'Menampilkan peta rak FEFO — pilih batch mendekati kedaluwarsa untuk aktivasi Obrar Kilat 50%.'
                );
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-900/20 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer"
            title={
              mostUrgentClearanceBatch
                ? `Aktivasi Obrar Kilat 50% untuk ${mostUrgentClearanceBatch.productName} (${mostUrgentClearanceBatch.lotNumber})`
                : 'Buka FEFO Rack Heatmap untuk Clearance Flash Sale'
            }
          >
            <Zap className="w-3.5 h-3.5" />
            <span>
              {mostUrgentClearanceBatch
                ? `⚡ Obrar Kilat 50% (${mostUrgentClearanceBatch.daysUntilExpiry}h lagi)`
                : '⚡ Flash Sale Clearance 50%'}
            </span>
          </button>
        </div>

        {/* Valuation & Traceability KPI Strip (Max 4 metrics, crisp tabular numerals) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className={`${subCardClass} p-3.5`}>
            <span className={`text-[11px] font-medium ${textMuted} block`}>
              {canViewValuation ? 'Asset Valuation (COA #1040)' : 'Active Tracked Quants'}
            </span>
            <span className={`text-sm sm:text-base font-bold font-mono tabular-nums ${textTitle} mt-0.5 block`}>
              {canViewValuation
                ? formatIDR(summaryMetrics.totalValuationIDR)
                : `${enrichedListRows.length} Stock Quants`}
            </span>
          </div>

          <div className={`${subCardClass} p-3.5`}>
            <span className={`text-[11px] font-medium ${textMuted} block`}>
              On-Hand Quants (B2C + B2B)
            </span>
            <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-[#164E29] dark:text-emerald-400 mt-0.5 block">
              {summaryMetrics.totalPhysicalBaseUnits.toLocaleString('id-ID')} Base Units
            </span>
          </div>

          <div className={`${subCardClass} p-3.5`}>
            <span className={`text-[11px] font-medium ${textMuted} block`}>
              Reserved / Locked Picks
            </span>
            <span className={`text-sm sm:text-base font-bold font-mono tabular-nums ${textTitle} mt-0.5 block`}>
              {summaryMetrics.totalReserved.toLocaleString('id-ID')} Units
            </span>
          </div>

          <div className={`${subCardClass} p-3.5`}>
            <span className={`text-[11px] font-medium ${textMuted} block`}>
              Near-Expiry &amp; Quarantined Lots
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {summaryMetrics.nearExpiryLots} Near
              </span>
              <span className={textMuted}>·</span>
              <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {summaryMetrics.quarantinedLots} Locked
              </span>
            </div>
          </div>
        </div>
      </div>

      <div key={viewMode} className="gm-tab-enter">
      {/* ===================================================================== */}
      {/* VIEW 1: GROCEMATRIX™ KANBAN OPERATIONS DASHBOARD */}
      {/* ===================================================================== */}
      {viewMode === 'kanban' && (
        <div className="space-y-5">
          {/* Warehouse Hub Filter Pills */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: 'All Warehouse Hubs' },
                { id: 'CDC', label: 'Central Distribution Center' },
                { id: 'DARK_STORE', label: 'Dark Store (PIK 2)' },
                { id: 'RETAIL_FRONTS', label: 'Retail Fronts' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHubFilter(tab.id as HubScope)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer ${
                    hubFilter === tab.id
                      ? 'bg-[#164E29] border-[#164E29] text-white dark:bg-emerald-950/80 dark:border-emerald-800/50 dark:text-emerald-300'
                      : 'bg-white dark:bg-[#12141C] border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/90'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="text-xs font-semibold text-[#164E29] dark:text-emerald-400 hover:underline inline-flex items-center gap-1 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Inspect Granular Stock Quants &amp; Lots →
            </button>
          </div>

          {/* Hub Sections */}
          {hubKanbanCards.map(({ hub, skuCount, totalUnits, healthSummary, operations }) => (
            <div key={hub.id} className="space-y-3">
              {/* Hub Group Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-400">
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-bold ${textTitle}`}>{hub.title}</h3>
                      <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-[#090A0F] dark:border dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                        {hub.code}
                      </span>
                    </div>
                    <p className={`text-[11px] ${textMuted}`}>{hub.subtitle}</p>
                  </div>
                </div>
                <div className={`flex items-center flex-wrap gap-2 text-xs font-mono tabular-nums ${textMuted}`}>
                  <span>
                    <strong className={textTitle}>{skuCount}</strong> Active SKUs ·{' '}
                    <strong className={textTitle}>{totalUnits.toLocaleString('id-ID')}</strong> Units On Hand
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {healthSummary.safe} Safe
                  </span>
                  {healthSummary.approaching > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {healthSummary.approaching} Low
                    </span>
                  )}
                  {healthSummary.critical > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      {healthSummary.critical} Out
                    </span>
                  )}
                </div>
              </div>

              {/* 6 GroceMatrix™ Operation Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {operations.map((op) => {
                  const Icon = op.icon;
                  return (
                    <div
                      key={`${hub.id}-${op.id}`}
                      className={`${cardClass} p-4 flex flex-col justify-between transition-all hover:border-emerald-500/40`}
                    >
                      <div>
                        {/* Card Top Row */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`p-2 rounded-xl shrink-0 ${op.iconBg}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className={`text-xs font-bold ${textTitle} truncate`}>
                                {op.title}
                              </h4>
                              <p className={`text-[11px] ${textMuted} line-clamp-1 mt-0.5`}>
                                {op.subtitle}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Live Status Counts */}
                        <div className="grid grid-cols-3 gap-2 my-3">
                          {op.metrics.map((m) => (
                            <div
                              key={m.label}
                              className={`p-2 rounded-xl border text-center ${
                                isLight
                                  ? 'bg-slate-50/70 border-slate-200/80'
                                  : 'bg-[#090A0F] border-slate-800/80'
                              }`}
                            >
                              <div
                                className={`text-sm font-bold font-mono tabular-nums ${
                                  m.tone === 'emerald'
                                    ? 'text-[#0F4C3A] dark:text-emerald-400'
                                    : m.tone === 'amber'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : m.tone === 'rose'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : m.tone === 'sky'
                                    ? 'text-sky-600 dark:text-sky-400'
                                    : textTitle
                                }`}
                              >
                                {m.value}
                              </div>
                              <div className={`text-[10px] ${textMuted} truncate mt-0.5`}>
                                {m.label}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Operation Progress Bar */}
                        <div className="space-y-1 mb-3.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={textMuted}>Hub Throughput Readiness</span>
                            <span className={`font-mono font-semibold ${textTitle}`}>
                              {op.progressPercent}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#090A0F] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${op.barColor}`}
                              style={{ width: `${op.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Primary + Secondary Action Footer */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => onNavigateTab(op.targetTab)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#164E29] hover:bg-[#0F4C3A] dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50 text-white transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {op.primaryLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateTab(op.secondaryAction.tab)}
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#090A0F] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/90 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {op.secondaryAction.label}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: GRANULAR STOCK QUANTS, LOT/BATCH & MULTI-UOM LIST VIEW */}
      {/* ===================================================================== */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className={`${cardClass} p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3`}>
            <div className="flex flex-wrap items-center gap-2">
              <select
                disabled={isBranchScoped}
                value={isBranchScoped ? lockedBranchId : selectedOutletFilter}
                onChange={(e) => {
                  if (isBranchScoped) return;
                  onOutletFilterChange(e.target.value);
                }}
                className={`px-3 py-1.5 text-xs rounded-xl ${inputClass} ${
                  isBranchScoped ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {!isBranchScoped && <option value="ALL">All Store Outlets</option>}
                {storeOutlets && storeOutlets.length > 0 ? (
                  storeOutlets
                    .filter((st) => !isBranchScoped || st.storeId === lockedBranchId)
                    .map((st) => (
                      <option key={st.storeId} value={st.storeId}>
                        {st.storeName} ({st.city})
                      </option>
                    ))
                ) : (
                  <>
                    <option value="store-jkt-senopati">Senopati Flagship / CDC (Jakarta)</option>
                    <option value="store-jkt-pik">PIK 2 Dark Store (Jakarta)</option>
                    <option value="store-bdg-dago">Dago Green Market (Bandung)</option>
                  </>
                )}
              </select>

              <select
                value={selectedStorageZoneFilter}
                onChange={(e) => onStorageZoneFilterChange(e.target.value)}
                className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
              >
                <option value="ALL">All Storage Zones</option>
                <option value="cold_chilled">Cold Chilled (4°C)</option>
                <option value="freezer">Freezer (-18°C)</option>
                <option value="ambient">Ambient Dry</option>
              </select>

              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
                className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
              >
                <option value="ALL">All Channels (B2C + B2B)</option>
                <option value="B2C">B2C Retail Eligible</option>
                <option value="B2B">B2B Wholesale Eligible</option>
                <option value="BOTH">Dual Channel (Both)</option>
              </select>

              <select
                value={strategyFilter}
                onChange={(e) => setStrategyFilter(e.target.value as 'ALL' | RemovalStrategyType)}
                className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
              >
                <option value="ALL">All Strategies (FEFO &amp; FIFO)</option>
                <option value="FEFO">FEFO (Perishables)</option>
                <option value="FIFO">FIFO (Dry / Bulk)</option>
              </select>

              <select
                value={classificationFilter}
                onChange={(e) => setClassificationFilter(e.target.value as 'ALL' | ItemClassification)}
                className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
              >
                <option value="ALL">All Classifications</option>
                <option value="MERCHANDISE">Merchandise (#1040)</option>
                <option value="FIXED_ASSET">Fixed Asset (#1510)</option>
                <option value="CONSUMABLE">Consumable (#1050)</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => onInventorySearchChange(e.target.value)}
                  placeholder="Search SKU or item..."
                  className={`pl-8 pr-3 py-1.5 text-xs rounded-xl w-48 ${inputClass}`}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeB2BCatalogRows}
                  onChange={(e) => setIncludeB2BCatalogRows(e.target.checked)}
                  className="rounded border-slate-300 text-[#0F4C3A] focus:ring-[#0F4C3A]"
                />
                <span className={textMuted}>Include B2B Bulk Catalog SKUs</span>
              </label>
              <span className={`text-xs ${textMuted}`}>
                Showing <strong className={textTitle}>{enrichedListRows.length}</strong> stock quants
              </span>
            </div>
          </div>

          {/* GroceMatrix™ Stock Quants & Lot Ledger Table */}
          <div className={`${cardClass} overflow-hidden shadow-xs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={tableHeaderClass}>
                    <th className="py-3 px-3.5">SKU &amp; Product (B2B/B2C Split)</th>
                    <th className="py-3 px-3.5">Warehouse &amp; Bin Location</th>
                    <th className="py-3 px-3.5">Lot / Batch &amp; Expiry</th>
                    <th className="py-3 px-3 text-center">Removal Strategy</th>
                    <th className="py-3 px-3.5">Multi-UoM Stock (On Hand / Res / ATP)</th>
                    {canViewValuation && (
                      <th className="py-3 px-3.5 text-right">Unit Cost &amp; Valuation</th>
                    )}
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-slate-800/80'}`}>
                  {enrichedListRows.map(({ row, safeReserved, safeAvailable, profile, strategy, lotInfo, uomBreakdown, availableUom, totalValuation, itemClassification }) => {
                    const safetyThreshold = !row.isWholesaleRow && 'minimumThreshold' in row ? row.minimumThreshold : 10;
                    const isLowStock = safeAvailable > 0 && safeAvailable <= safetyThreshold;
                    const isOutOfStock = safeAvailable <= 0;
                    const healthStatus = isOutOfStock
                      ? {
                          label: 'Out of Stock / Critical',
                          dotClass: 'bg-rose-500',
                          badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30',
                        }
                      : isLowStock
                      ? {
                          label: 'Approaching Safety',
                          dotClass: 'bg-amber-500',
                          badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
                        }
                      : {
                          label: 'Safe Stock',
                          dotClass: 'bg-emerald-500',
                          badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
                        };
                    const displayThumb =
                      profile.salesChannel === 'B2B' ? profile.b2bImageUrl : profile.b2cImageUrl;

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-900/70'
                        }`}
                      >
                        {/* 1. SKU, Image Preview & Channel Indicator */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-start gap-2.5 min-w-[220px]">
                            {renderThumbnail(displayThumb, row.productName, row.sku)}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[10px] text-[#0F4C3A] dark:text-emerald-400 font-bold">
                                  {row.sku}
                                </span>
                                {itemClassification === 'FIXED_ASSET' && (
                                  <span
                                    title="Non-sellable Store Equipment routed to COA #1510 (Blocked from POS)"
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30"
                                  >
                                    FIXED ASSET · #1510
                                  </span>
                                )}
                                {itemClassification === 'CONSUMABLE' && (
                                  <span
                                    title="Internal Store Supply routed to COA #1050 (Blocked from POS)"
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                  >
                                    CONSUMABLE · #1050
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    profile.salesChannel === 'B2B'
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                      : profile.salesChannel === 'B2C'
                                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                      : 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300'
                                  }`}
                                >
                                  {profile.salesChannel === 'BOTH'
                                    ? 'B2C + B2B'
                                    : profile.salesChannel === 'B2B'
                                    ? 'B2B Wholesale'
                                    : 'B2C Retail'}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${healthStatus.badgeClass}`}
                                  title={`ATP ${safeAvailable} vs safety threshold ${safetyThreshold}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${healthStatus.dotClass}`} />
                                  {healthStatus.label}
                                </span>
                              </div>
                              <div className={`font-bold ${textTitle} text-xs line-clamp-1 mt-0.5`}>
                                {row.productName}
                              </div>
                              <div className={`text-[10px] ${textMuted} line-clamp-1`}>
                                {profile.salesChannel === 'B2B'
                                  ? profile.wholesalePackagingSpec
                                  : profile.retailPackagingSpec}
                              </div>
                              {(() => {
                                const invMeta = inventory.find((it) => it.sku === row.sku);
                                const halalStatus = invMeta?.halalStatus;
                                const bpomReg = invMeta?.bpomRegNumber;
                                const bpjphCert = invMeta?.bpjphCertNumber;
                                const bpjphInfo = getBpjphExpiryInfo(invMeta?.bpjphExpiryDate);
                                if (!halalStatus && !bpomReg && !bpjphCert) return null;
                                return (
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    {halalStatus === 'HALAL_CERTIFIED' && (
                                      <span
                                        title={bpjphCert ? `BPJPH: ${bpjphCert}` : 'Halal Certified'}
                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                      >
                                        HALAL BPJPH
                                      </span>
                                    )}
                                    {halalStatus === 'NON_HALAL' && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">
                                        NON-HALAL SEGREGASI
                                      </span>
                                    )}
                                    {halalStatus === 'FRESH_UNPROCESSED' && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300">
                                        SEGAR
                                      </span>
                                    )}
                                    {bpomReg && (
                                      <span
                                        title={bpomReg}
                                        className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-100 text-slate-600 dark:bg-[#090A0F] dark:border dark:border-slate-800/80 dark:text-slate-300 truncate max-w-[130px]"
                                      >
                                        {bpomReg}
                                      </span>
                                    )}
                                    {(bpjphInfo.isExpiringSoon || bpjphInfo.isExpired) && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                                        {bpjphInfo.isExpired
                                          ? 'BPJPH EXPIRED'
                                          : `BPJPH ${bpjphInfo.daysUntilExpiry}h`}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </td>

                        {/* 2. Warehouse & Bin Location */}
                        <td className="py-3 px-3.5 min-w-[170px]">
                          <div className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'} text-xs`}>
                            {row.storeName}
                          </div>
                          <div className={`text-[11px] font-mono ${textMuted} mt-0.5`}>
                            {lotInfo.binLocation}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {row.warehouseZoneId}
                          </div>
                        </td>

                        {/* 3. Lot / Batch & Expiry with FEFO Status */}
                        <td className="py-3 px-3.5 min-w-[200px]">
                          <div className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                            {lotInfo.lotNumber}
                          </div>
                          <div className={`text-[10px] font-mono ${textMuted} mt-0.5`}>
                            Exp: {lotInfo.expiryDate}
                            {lotInfo.activeBatchCount > 1 ? ` (+${lotInfo.activeBatchCount - 1} lots)` : ''}
                            {lotInfo.expiredBatchCount > 0 && !lotInfo.isQuarantined ? ` · ${lotInfo.expiredBatchCount} exp` : ''}
                          </div>
                          <span
                            className={`inline-flex items-center whitespace-nowrap leading-none mt-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                              lotInfo.tone === 'rose'
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                : lotInfo.tone === 'amber'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : lotInfo.tone === 'emerald'
                                ? 'bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300'
                                : 'bg-slate-200/70 dark:bg-[#090A0F] text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {lotInfo.statusLabel}
                          </span>
                        </td>

                        {/* 4. Removal Strategy (FEFO / FIFO Toggle) */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={savingStrategy || !canManageWarehouseTopology}
                            onClick={() => handleToggleRowStrategy(row.sku, strategy)}
                            title={
                              canManageWarehouseTopology
                                ? 'Click to toggle FEFO / FIFO picking priority'
                                : 'Read-Only for your role'
                            }
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono border transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed ${
                              canManageWarehouseTopology ? 'cursor-pointer' : ''
                            } ${
                              strategy === 'FEFO'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-[#164E29] dark:text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20'
                            }`}
                          >
                            {strategy}
                          </button>
                        </td>

                        {/* 5. Multi-UoM Stock Breakdown (On Hand | Reserved | Available ATP) */}
                        <td className="py-3 px-3.5 min-w-[230px]">
                          <div className="space-y-1 font-mono tabular-nums">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className={textMuted}>On Hand:</span>
                              <span className={`font-bold ${textTitle}`}>
                                {uomBreakdown.wholesaleSummary}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px]">
                              <span className={textMuted}>Base Units:</span>
                              <span className={textTitle}>{uomBreakdown.baseSummary}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] pt-0.5 border-t border-slate-100 dark:border-slate-800/80">
                              <span className={textMuted}>
                                Res: <strong>{safeReserved}</strong> · Inc:{' '}
                                <strong className="text-sky-600 dark:text-sky-400">+{row.incomingStock}</strong>
                              </span>
                              <span
                                className={`font-bold whitespace-nowrap ${
                                  isOutOfStock || lotInfo.isQuarantined
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : isLowStock
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-[#0F4C3A] dark:text-emerald-400'
                                }`}
                              >
                                ATP: {safeAvailable} · {availableUom.wholesaleSummary}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 6. Moving Avg Unit Cost & Asset Valuation */}
                        {canViewValuation && (
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums min-w-[140px]">
                            <div className={`text-[11px] font-bold ${textTitle}`}>
                              {formatIDR(totalValuation)}
                            </div>
                            <div className={`text-[10px] ${textMuted} mt-0.5`}>
                              Avg: {formatIDR(row.unitCost)} / {profile.uomConversion.baseUnitLabel}
                            </div>
                          </td>
                        )}

                        {/* 7. Actions */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setMediaInspector({
                                  sku: row.sku,
                                  productName: row.productName,
                                  category: row.category,
                                  unit: row.unit,
                                  unitCost: row.unitCost,
                                  sellingPrice: row.sellingPrice,
                                  physicalStock: row.physicalStock,
                                  availableStock: row.availableStock,
                                  reservedStock: row.reservedStock,
                                  incomingStock: row.incomingStock,
                                  storeName: row.storeName,
                                  binLocation: lotInfo.binLocation,
                                  strategy,
                                })
                              }
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/90 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] inline-flex items-center gap-1 cursor-pointer"
                              title="Inspect B2B vs B2C Media, Packaging & Multi-UoM"
                            >
                              <Eye className="w-3 h-3" />
                              B2B/B2C
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setTraceabilityTarget({
                                  sku: row.sku,
                                  productName: row.productName,
                                })
                              }
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-emerald-200/90 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/50 text-[#0F4C3A] dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/70 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] inline-flex items-center gap-1 cursor-pointer"
                              title="View full inbound supply-chain lineage (PR → PO → GR → Lots → Vendor Bill)"
                            >
                              <GitBranch className="w-3 h-3" />
                              Traceability
                            </button>

                            {canManageWarehouseTopology && !row.isWholesaleRow && row.sourceTier && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onAuditSku(row.sku)}
                                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                                >
                                  Audit Count
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEditTier(row.sourceTier!)}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-[#164E29]/10 text-[#164E29] dark:bg-emerald-950/80 dark:text-emerald-300 border border-[#164E29]/20 dark:border-emerald-800/50 hover:bg-[#164E29]/20 dark:hover:bg-emerald-900/80 rounded-lg transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                                >
                                  Edit Notes
                                </button>
                              </>
                            )}

                            {canIssueConsumables &&
                              itemClassification === 'CONSUMABLE' &&
                              !row.isWholesaleRow &&
                              safeAvailable > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConsumableIssueTarget({
                                      sku: row.sku,
                                      productName: row.productName,
                                      storeId: row.storeId,
                                      storeName: row.storeName,
                                      unit: row.unit,
                                      availableStock: safeAvailable,
                                      unitCost: row.unitCost,
                                    });
                                    setIssueQty(Math.min(1, safeAvailable));
                                    setIssueDepartment('Store Operations');
                                    setIssuePurpose('POS Terminal / Daily Store Operations Usage');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer whitespace-nowrap"
                                  title="Issue internal consumable usage (DR #5040 Store Supplies Expense / CR #1050)"
                                >
                                  <PackageMinus className="w-3 h-3" />
                                  <span>Issue Internal Usage</span>
                                </button>
                              )}

                            {(() => {
                              const urgentBatch = batches.find(
                                (b) =>
                                  b.sku === row.sku &&
                                  (b.storeId === row.storeId || row.storeId === 'CONSOLIDATED') &&
                                  b.currentStock > 0 &&
                                  b.daysUntilExpiry > 0 &&
                                  b.daysUntilExpiry <= 7 &&
                                  b.status !== 'expired' &&
                                  b.status !== 'recalled' &&
                                  b.status !== 'quarantined' &&
                                  (lotInfo.lotNumber ? b.lotNumber === lotInfo.lotNumber : true)
                              );
                              if (!urgentBatch) return null;
                              const isPromoActive =
                                urgentBatch.markdownStatus === 'Marked Down' ||
                                (urgentBatch.markdownDiscountPercent || 0) >= 50;
                              return (
                                <button
                                  type="button"
                                  onClick={() => setFlashSaleTargetBatch(urgentBatch)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer whitespace-nowrap ${
                                    isPromoActive
                                      ? 'bg-emerald-100 text-[#164E29] border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/50 shadow-xs'
                                      : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-900/20'
                                  }`}
                                  title={
                                    urgentBatch.dynamicDiscountSku
                                      ? `Marked Down POS SKU: ${urgentBatch.dynamicDiscountSku}`
                                      : `1-Click Auto Markdown 50% untuk batch ${urgentBatch.lotNumber}`
                                  }
                                >
                                  <Zap className="w-3 h-3" />
                                  <span>
                                    {urgentBatch.markdownStatus === 'Marked Down'
                                      ? `Marked Down (-${urgentBatch.markdownDiscountPercent || 50}%)`
                                      : isPromoActive
                                      ? 'Obrar 50% Aktif'
                                      : '⚡ Auto Markdown 50%'}
                                  </span>
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {enrichedListRows.length === 0 && (
                    <tr>
                      <td colSpan={canViewValuation ? 7 : 6} className="py-10 text-center text-xs">
                        <span className={textMuted}>
                          No inventory quants match the active warehouse, channel, or strategy filters.
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 3: PER-OUTLET WAREHOUSE RACK / BIN & FEFO/FIFO TOPOLOGY */}
      {/* ===================================================================== */}
      {viewMode === 'racks' && canManageWarehouseTopology && (
        <WarehouseRackSetupPanel
          theme={theme}
          activeStaffSession={activeStaffSession}
          storeOutlets={storeOutlets}
          selectedOutletFilter={selectedOutletFilter}
          inventory={inventory}
          batches={batches}
          onRefreshAll={async () => {
            if (onRefreshData) await onRefreshData();
          }}
          onShowToast={onShowToast}
        />
      )}

      {viewMode === 'fefo_heatmap' && canManageWarehouseTopology && (
        <FefoHeatmapRackVisualizer
          theme={theme}
          selectedStore={selectedOutletFilter}
          batches={batches}
          racks={warehouseRacks}
          inventory={inventory}
          activeStaffSession={activeStaffSession}
          onRefreshData={async () => {
            if (onRefreshData) await onRefreshData();
            apiClient
              .getWarehouseRacks(selectedOutletFilter)
              .then((res) => setWarehouseRacks(res.racks || []))
              .catch(() => {});
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* ===================================================================== */}
      {/* VIEW 4: UNIFIED STOCKTAKE, BLIND OPNAME & BULK CSV IMPORT */}
      {/* ===================================================================== */}
      {viewMode === 'stocktake_opname' && canManageWarehouseTopology && (
        <div className="space-y-4">
          {renderStocktakeImport && (
            <div className={`${cardClass} p-2 flex flex-wrap items-center justify-between gap-2`}>
              <div className="inline-flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpnameWorkspaceMode('standard_import')}
                  className={`${tabButtonBase} ${
                    opnameWorkspaceMode === 'standard_import' ? tabButtonActive : tabButtonInactive
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Standard Reconciliation, Blind Count &amp; Bulk CSV Import
                </button>
                <button
                  type="button"
                  onClick={() => setOpnameWorkspaceMode('rack_blind')}
                  className={`${tabButtonBase} ${
                    opnameWorkspaceMode === 'rack_blind' ? tabButtonActive : tabButtonInactive
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Rack-Level Blind Opname (Per-Rack)
                </button>
              </div>
            </div>
          )}

          {renderStocktakeImport && opnameWorkspaceMode === 'standard_import' ? (
            renderStocktakeImport()
          ) : (
            <RackBlindOpnamePanel
              theme={theme}
              activeStaffSession={activeStaffSession}
              storeOutlets={storeOutlets}
              selectedOutletFilter={selectedOutletFilter}
              inventory={inventory}
              batches={batches}
              onRefreshAll={async () => {
                if (onRefreshData) await onRefreshData();
              }}
              onShowToast={onShowToast}
            />
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 5: WAREHOUSE REPACKING (BREAK-BULK) & BUNDLING / HAMPERS */}
      {/* ===================================================================== */}
      {viewMode === 'repack_bundle' && canManageWarehouseTopology && (
        <RepackBundlePanel
          theme={theme}
          selectedStore={selectedOutletFilter}
          inventoryTiers={allTiers}
          batches={batches}
          racks={warehouseRacks}
          onCompleted={async () => {
            if (onRefreshData) await onRefreshData();
            apiClient
              .getWarehouseRacks(selectedOutletFilter)
              .then((res) => setWarehouseRacks(res.racks || []))
              .catch(() => {});
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* ===================================================================== */}
      {/* VIEW 6: RETURNABLE PACKAGING / KRAT & GALON DEPOSIT LEDGER */}
      {/* ===================================================================== */}
      {viewMode === 'returnables' && canManageWarehouseTopology && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`${cardClass} p-4`}>
              <div className={`text-xs font-medium ${textMuted}`}>Total Issued Containers</div>
              <div className={`text-xl font-bold mt-1 font-mono ${textTitle}`}>
                {returnableSummary?.totalIssuedUnits ?? 0} units
              </div>
              <div className={`text-[11px] mt-0.5 ${textMuted}`}>Segregated from COA #1040 Merchandise</div>
            </div>
            <div className={`${cardClass} p-4`}>
              <div className={`text-xs font-medium ${textMuted}`}>Outstanding / Unreturned</div>
              <div className="text-xl font-bold mt-1 font-mono text-amber-600 dark:text-amber-400">
                {returnableSummary?.totalOutstandingUnits ?? 0} units
              </div>
              <div className={`text-[11px] mt-0.5 ${textMuted}`}>
                Returned: {returnableSummary?.totalReturnedUnits ?? 0} units
              </div>
            </div>
            <div className={`${cardClass} p-4`}>
              <div className={`text-xs font-medium ${textMuted}`}>Customer Deposit Liability (#2150)</div>
              <div className="text-xl font-bold mt-1 font-mono text-[#0F4C3A] dark:text-emerald-400">
                {formatIDR(returnableSummary?.customerDepositLiabilityIDR ?? 0)}
              </div>
              <div className={`text-[11px] mt-0.5 ${textMuted}`}>Krat/Galon on loan to HORECA/B2B</div>
            </div>
            <div className={`${cardClass} p-4`}>
              <div className={`text-xs font-medium ${textMuted}`}>Supplier Deposit Receivable (#1120)</div>
              <div className="text-xl font-bold mt-1 font-mono text-indigo-600 dark:text-indigo-400">
                {formatIDR(returnableSummary?.supplierDepositAssetIDR ?? 0)}
              </div>
              <div className={`text-[11px] mt-0.5 ${textMuted}`}>Supplier crates/cylinders held in store</div>
            </div>
          </div>

          <div className={`${cardClass} p-5 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className={`text-sm font-bold ${textTitle}`}>
                  Issue Returnable Container &amp; Book Security Deposit (COA #2150 / #1120)
                </h3>
                <p className={`text-xs ${textMuted}`}>
                  Tracks reusable crates, 19L mineral water galon, LPG cylinders, and wooden pallets cleanly off-inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={loadReturnables}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/90 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                {isLoadingReturnables ? 'Refreshing...' : 'Refresh Ledger'}
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!retCounterparty.trim() || retQtyIssued <= 0) {
                  onShowToast('Missing Container Details', 'Enter counterparty name and positive issued quantity.');
                  return;
                }
                setIsSubmittingReturnable(true);
                try {
                  const labelMap: Record<string, string> = {
                    KRAT_PLASTIK_BUAH: 'Krat Plastik Buah/Sayur',
                    GALON_AIR_19L: 'Galon Air Mineral 19L',
                    TABUNG_GAS_LPG_12KG: 'Tabung Gas LPG 12kg',
                    PALLET_KAYU_B2B: 'Pallet Kayu B2B',
                  };
                  const res = await apiClient.postReturnableContainer({
                    action: 'ISSUE',
                    storeId: selectedOutletFilter === 'CONSOLIDATED' ? 'store-jkt-senopati' : selectedOutletFilter,
                    direction: retDirection,
                    containerType: retContainerType,
                    containerLabel: labelMap[retContainerType] || retContainerType,
                    counterpartyName: retCounterparty.trim(),
                    qtyIssued: retQtyIssued,
                    depositPerUnitIDR: retDepositPerUnit,
                    referenceDoc: retRefDoc.trim() || undefined,
                    settlementAccountCode: retSettlementAccount,
                  });
                  onShowToast('Returnable Deposit Recorded', res.message);
                  setRetCounterparty('');
                  setRetRefDoc('');
                  await loadReturnables();
                  if (onRefreshData) await onRefreshData();
                } catch (err: unknown) {
                  onShowToast('Returnable Issue Failed', err instanceof Error ? err.message : String(err));
                } finally {
                  setIsSubmittingReturnable(false);
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
            >
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Direction</label>
                <select
                  value={retDirection}
                  onChange={(e) => setRetDirection(e.target.value as ReturnableDirection)}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs ${inputClass}`}
                >
                  <option value="OUT_TO_CUSTOMER">Out to B2B/HORECA Customer (#2150)</option>
                  <option value="IN_FROM_SUPPLIER">Held from Supplier (#1120)</option>
                </select>
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Container Type</label>
                <select
                  value={retContainerType}
                  onChange={(e) => setRetContainerType(e.target.value)}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs ${inputClass}`}
                >
                  <option value="KRAT_PLASTIK_BUAH">Krat Plastik Buah/Sayur</option>
                  <option value="GALON_AIR_19L">Galon Air Mineral 19L</option>
                  <option value="TABUNG_GAS_LPG_12KG">Tabung Gas LPG 12kg</option>
                  <option value="PALLET_KAYU_B2B">Pallet Kayu B2B</option>
                </select>
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Counterparty Name</label>
                <input
                  type="text"
                  value={retCounterparty}
                  onChange={(e) => setRetCounterparty(e.target.value)}
                  placeholder="e.g. Hotel Mulia Senayan"
                  className={`w-full px-2.5 py-2 rounded-lg text-xs ${inputClass}`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Qty Issued</label>
                <input
                  type="number"
                  min={1}
                  value={retQtyIssued}
                  onChange={(e) => setRetQtyIssued(Math.max(1, Number(e.target.value) || 1))}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs font-mono ${inputClass}`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Deposit / Unit (IDR)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={retDepositPerUnit}
                  onChange={(e) => setRetDepositPerUnit(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs font-mono ${inputClass}`}
                />
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={retSettlementAccount}
                  onChange={(e) => setRetSettlementAccount(e.target.value as '1010' | '1020' | '1200')}
                  className={`w-24 px-2 py-2 rounded-lg text-xs font-mono ${inputClass}`}
                  title="Cash/Bank/AR Counter Account"
                >
                  <option value="1010">1010 Kas</option>
                  <option value="1020">1020 BCA</option>
                  <option value="1200">1200 AR</option>
                </select>
                <button
                  type="submit"
                  disabled={isSubmittingReturnable}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-[#164E29] hover:bg-[#0F4C3A] dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50 text-white transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReturnable ? 'Saving...' : 'Issue Deposit'}
                </button>
              </div>
            </form>
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={tableHeaderClass}>
                  <tr>
                    <th className="py-3 px-4">Ref / Store</th>
                    <th className="py-3 px-4">Container &amp; Direction</th>
                    <th className="py-3 px-4">Counterparty</th>
                    <th className="py-3 px-4">Issued / Returned</th>
                    <th className="py-3 px-4">Deposit Held</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Return Units</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/80'}`}>
                  {returnableRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`py-8 text-center text-xs ${textMuted}`}>
                        No returnable container movements recorded yet.
                      </td>
                    </tr>
                  ) : (
                    returnableRecords.map((rec) => {
                      const outstanding = Math.max(0, rec.qtyIssued - rec.qtyReturned);
                      const returnInput = retPartialReturnMap[rec.id] ?? outstanding;
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{rec.id}</div>
                            <div className={`text-[11px] ${textMuted}`}>{rec.storeName}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold">{rec.containerLabel}</div>
                            <div className={`text-[10px] font-mono ${textMuted}`}>
                              {rec.direction === 'OUT_TO_CUSTOMER' ? 'Out to Customer (#2150)' : 'In from Supplier (#1120)'}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium">{rec.counterpartyName}</td>
                          <td className="py-3 px-4 font-mono">
                            <span className="font-bold">{rec.qtyIssued}</span> issued ·{' '}
                            <span className="text-emerald-600 dark:text-emerald-400">{rec.qtyReturned}</span> returned
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold">{formatIDR(rec.depositHeldIDR)}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                rec.status === 'RETURNED'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : rec.status === 'PARTIAL_RETURNED'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {outstanding > 0 ? (
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={outstanding}
                                  value={returnInput}
                                  onChange={(e) =>
                                    setRetPartialReturnMap((prev) => ({
                                      ...prev,
                                      [rec.id]: Math.max(1, Math.min(outstanding, Number(e.target.value) || 1)),
                                    }))
                                  }
                                  className={`w-16 px-2 py-1 rounded-md text-xs font-mono ${inputClass}`}
                                />
                                <button
                                  type="button"
                                  disabled={isSubmittingReturnable}
                                  onClick={async () => {
                                    setIsSubmittingReturnable(true);
                                    try {
                                      const res = await apiClient.postReturnableContainer({
                                        action: 'RETURN',
                                        id: rec.id,
                                        qtyReturned: returnInput,
                                      });
                                      onShowToast('Containers Returned', res.message);
                                      await loadReturnables();
                                      if (onRefreshData) await onRefreshData();
                                    } catch (err: unknown) {
                                      onShowToast('Return Failed', err instanceof Error ? err.message : String(err));
                                    } finally {
                                      setIsSubmittingReturnable(false);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-[#164E29] hover:bg-[#0F4C3A] dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50 text-white text-[11px] font-semibold transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                                >
                                  Return
                                </button>
                              </div>
                            ) : (
                              <span className={`text-[11px] font-mono ${textMuted}`}>Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: FEFO / FIFO REMOVAL STRATEGY CONFIGURATION */}
      {/* ===================================================================== */}
      {showStrategyModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center overflow-y-auto p-4 gm-backdrop-fade">
          <div className={`${modalClass} max-w-2xl w-full p-6 space-y-4 my-auto gm-modal-pop`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
              <div>
                <h3 className={`text-base font-bold ${textTitle}`}>
                  GroceMatrix™ Removal Strategy Rules (FEFO vs. FIFO)
                </h3>
                <p className={`text-xs ${textMuted}`}>
                  Controls batch picking order across POS Checkout, B2C Picker, B2B Wholesale Dispatch, and FEFO Allocator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStrategyModal(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-900 text-slate-300'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
                const activeStrat: RemovalStrategyType =
                  removalStrategies?.categoryStrategies?.[catKey] ||
                  (catKey.includes('pantry') || catKey.includes('oil') || catKey.includes('noodle') || catKey.includes('beverage') || catKey.includes('household')
                    ? 'FIFO'
                    : 'FEFO');
                return (
                  <div
                    key={catKey}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090A0F] border-slate-800/80'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`text-xs font-bold ${textTitle} truncate`}>{catLabel}</div>
                      <div className={`text-[10px] font-mono ${textMuted}`}>{catKey}</div>
                    </div>
                    <select
                      disabled={savingStrategy || !canManageWarehouseTopology}
                      value={activeStrat}
                      onChange={(e) =>
                        handleCategoryStrategyChange(catKey, e.target.value as RemovalStrategyType)
                      }
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed ${inputClass}`}
                    >
                      <option value="FEFO">FEFO (Earliest Expiry)</option>
                      <option value="FIFO">FIFO (First Received)</option>
                    </select>
                  </div>
                );
              })}
            </div>

            {removalStrategies && Object.keys(removalStrategies.skuOverrides || {}).length > 0 && (
              <div className={`p-3 rounded-xl border text-xs ${subCardClass}`}>
                <div className="font-semibold mb-1.5">Active SKU-Level Overrides</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(removalStrategies.skuOverrides).map(([sku, strat]) => (
                    <span
                      key={sku}
                      className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-[#0F4C3A]/10 text-[#0F4C3A] border border-[#0F4C3A]/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25"
                    >
                      {sku}: {strat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowStrategyModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-[#164E29] hover:bg-[#0F4C3A] dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50 text-white rounded-xl transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}

      {/* ===================================================================== */}
      {/* MODAL 2: B2B vs. B2C MEDIA, PACKAGING & MULTI-UOM INSPECTOR */}
      {/* ===================================================================== */}
      {mediaInspector && (() => {
        const profile = getEnterpriseSkuProfile(
          mediaInspector.sku,
          mediaInspector.category,
          mediaInspector.unit
        );
        const skuLots = batches.filter((b) => b.sku === mediaInspector.sku);
        const multiUom = formatMultiUomStock(mediaInspector.physicalStock, profile.uomConversion);

        return createPortal(
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center overflow-y-auto p-4 gm-backdrop-fade">
            <div className={`${modalClass} max-w-3xl w-full p-6 space-y-5 my-auto gm-modal-pop`}>
              <div className={`flex items-start justify-between gap-3 border-b pb-3 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {mediaInspector.sku}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-300">
                      Channel: {profile.salesChannel === 'BOTH' ? 'B2C Retail + B2B Wholesale' : profile.salesChannel}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300">
                      {mediaInspector.strategy} Removal
                    </span>
                  </div>
                  <h3 className={`text-base font-bold ${textTitle} mt-1`}>
                    {mediaInspector.productName}
                  </h3>
                  <p className={`text-xs ${textMuted}`}>
                    {mediaInspector.storeName} · Bin: <span className="font-mono">{mediaInspector.binLocation}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMediaInspector(null)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Strict B2C vs B2B Visual & Packaging Differentiation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* B2C Retail Card */}
                <div className={`${subCardClass} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                      B2C Consumer Storefront Asset
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {formatIDR(mediaInspector.sellingPrice)} / {profile.uomConversion.baseUnitLabel}
                    </span>
                  </div>
                  {renderThumbnail(
                    profile.b2cImageUrl,
                    `${mediaInspector.productName} B2C Retail`,
                    `${mediaInspector.sku}-b2c`,
                    'w-full h-40 rounded-xl'
                  )}
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className={`text-[10px] uppercase font-semibold ${textMuted} block`}>
                        Retail Packaging Spec
                      </span>
                      <span className={`font-medium ${textTitle}`}>{profile.retailPackagingSpec}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800/80 font-mono text-[11px]">
                      <span className={textMuted}>Retail Base UoM:</span>
                      <span className={`font-bold ${textTitle}`}>{multiUom.baseSummary}</span>
                    </div>
                  </div>
                </div>

                {/* B2B Wholesale Card */}
                <div className={`${subCardClass} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      B2B Wholesale Master Carton / Pallet
                    </span>
                    <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      {profile.uomConversion.unitsPerCarton}x {profile.uomConversion.baseUnitLabel} / {profile.uomConversion.wholesaleUnitLabel}
                    </span>
                  </div>
                  {renderThumbnail(
                    profile.b2bImageUrl,
                    `${mediaInspector.productName} B2B Wholesale`,
                    `${mediaInspector.sku}-b2b`,
                    'w-full h-40 rounded-xl'
                  )}
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className={`text-[10px] uppercase font-semibold ${textMuted} block`}>
                        Wholesale Carton &amp; Pallet Spec
                      </span>
                      <span className={`font-medium ${textTitle}`}>{profile.wholesalePackagingSpec}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80 font-mono text-[10px]">
                      <div>
                        <span className={textMuted}>Outer GTIN:</span>{' '}
                        <strong className={textTitle}>{profile.outerBoxBarcode}</strong>
                      </div>
                      <div>
                        <span className={textMuted}>Gross Wt:</span>{' '}
                        <strong className={textTitle}>{profile.grossWeightKg} kg</strong>
                      </div>
                      <div className="col-span-2">
                        <span className={textMuted}>Pallet Ti-Hi:</span>{' '}
                        <strong className={textTitle}>{profile.palletDimensions}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lot / Batch Breakdown for this SKU */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-bold ${textTitle}`}>
                    Active Lot / Batch Allocation Queue ({mediaInspector.strategy} Order)
                  </span>
                  <span className={`font-mono text-[11px] ${textMuted}`}>
                    {skuLots.length} Tracked Lots
                  </span>
                </div>
                {skuLots.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className={tableHeaderClass}>
                          <th className="py-2 px-3">Lot #</th>
                          <th className="py-2 px-3">Received</th>
                          <th className="py-2 px-3">Expiry</th>
                          <th className="py-2 px-3 text-right">Stock</th>
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-slate-800/80'}`}>
                        {skuLots
                          .slice()
                          .sort((a, b) =>
                            mediaInspector.strategy === 'FIFO'
                              ? new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()
                              : new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
                          )
                          .map((lot) => (
                            <tr key={lot.batchId}>
                              <td className="py-2 px-3 font-bold">{lot.lotNumber}</td>
                              <td className={`py-2 px-3 ${textMuted}`}>{lot.receivedDate.split('T')[0]}</td>
                              <td className={`py-2 px-3 ${textMuted}`}>{lot.expiryDate.split('T')[0]}</td>
                              <td className="py-2 px-3 text-right font-bold">{lot.currentStock}</td>
                              <td className="py-2 px-3 text-right uppercase text-[10px]">{lot.status.replace(/_/g, ' ')}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={`text-xs ${textMuted} p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-800/80`}>
                    Single-lot dry/wholesale bulk stock managed under {mediaInspector.strategy} valuation.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setMediaInspector(null)}
                  className="px-4 py-2 text-xs font-semibold bg-[#164E29] hover:bg-[#0F4C3A] dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50 text-white rounded-xl transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Additive EAN-13 Bulk Scale Barcode & Permendag Shelf Label Generator */}
      <BarcodeShelfLabelModal
        theme={theme}
        isOpen={showBarcodeLabelModal}
        onClose={() => setShowBarcodeLabelModal(false)}
        products={inventory.map((it) => {
          const isWeighted = ['kg', 'g', 'gram'].includes((it.unit || '').toLowerCase());
          return {
            sku: it.sku,
            productName: it.name || it.productName || it.sku,
            category: String(it.category),
            unit: it.unit,
            sellingPrice: it.sellingPrice,
            pricePerKg: isWeighted ? it.sellingPrice : it.sellingPrice * 2,
            isWeighted,
            priceUpdatedAt: it.priceUpdatedAt,
            wholesaleTiers: it.wholesaleTiers,
            halalStatus: it.halalStatus,
            bpjphCertNumber: it.bpjphCertNumber,
          };
        })}
        onShowToast={onShowToast}
      />

      {/* 1-Click Flash Sale / Clearance Generator Modal */}
      <FlashSaleClearanceModal
        isOpen={Boolean(flashSaleTargetBatch)}
        onClose={() => setFlashSaleTargetBatch(null)}
        theme={theme}
        batch={flashSaleTargetBatch}
        inventory={inventory}
        racks={warehouseRacks}
        onCompleted={async () => {
          if (onRefreshData) await onRefreshData();
        }}
        onShowToast={onShowToast}
      />

      {/* Bidirectional Inbound Supply-Chain Traceability Modal (PR -> PO -> GR -> Lot -> Vendor Bill) */}
      {traceabilityTarget && (
        <ItemTraceabilityModal
          theme={theme}
          sku={traceabilityTarget.sku}
          productName={traceabilityTarget.productName}
          onClose={() => setTraceabilityTarget(null)}
          onNavigateToDocument={onNavigateToDocument}
        />
      )}

      {/* Internal Store Consumable Issuance Modal (COA #1050 -> #5040) */}
      {consumableIssueTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[105] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto gm-backdrop-fade"
            onClick={() => setConsumableIssueTarget(null)}
          >
            <div
              className={`w-full max-w-md rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 my-auto gm-modal-pop ${
                isLight ? 'bg-white border-gray-200 text-slate-900' : 'bg-[#12141C] border-slate-800/80 text-slate-100'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-200 dark:border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <PackageMinus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Issue Internal Store Consumable</h3>
                    <p className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                      {consumableIssueTarget.sku} · {consumableIssueTarget.storeName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConsumableIssueTarget(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmConsumableIssuance} className="space-y-3.5 text-xs">
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-[#090A0F] border-slate-800/80'}`}>
                  <div className="font-bold">{consumableIssueTarget.productName}</div>
                  <div className="font-mono text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                    Available ATP: <strong className="text-[#0F4C3A] dark:text-emerald-400">{consumableIssueTarget.availableStock} {consumableIssueTarget.unit}</strong> · Unit Cost: {formatIDR(consumableIssueTarget.unitCost)}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    Quantity to Issue ({consumableIssueTarget.unit})
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    max={consumableIssueTarget.availableStock}
                    step="any"
                    required
                    value={issueQty}
                    onChange={(e) => setIssueQty(Math.max(0, Number(e.target.value) || 0))}
                    className={`w-full px-3 py-2 rounded-xl border font-mono font-bold ${
                      isLight ? 'bg-white border-gray-300 text-slate-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Receiving Department / Cost Center</label>
                  <input
                    type="text"
                    required
                    value={issueDepartment}
                    onChange={(e) => setIssueDepartment(e.target.value)}
                    placeholder="e.g. POS Frontline, Cold-Chain Packaging"
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300 text-slate-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Usage Purpose</label>
                  <input
                    type="text"
                    required
                    value={issuePurpose}
                    onChange={(e) => setIssuePurpose(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isLight ? 'bg-white border-gray-300 text-slate-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
                    }`}
                  />
                </div>

                <div className={`p-3 rounded-xl border text-[11px] font-mono ${isLight ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-950/25 border-amber-800/50 text-amber-200'}`}>
                  GL Posting: DR #5040 Store Supplies Expense ({formatIDR(Math.round((issueQty || 0) * consumableIssueTarget.unitCost))}) / CR #1050 Store Supplies Asset
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setConsumableIssueTarget(null)}
                    className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-800/80 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingConsumable}
                    className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-50 text-white font-bold cursor-pointer"
                  >
                    {isSubmittingConsumable ? 'Issuing & Posting GL...' : 'Confirm Internal Issuance'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

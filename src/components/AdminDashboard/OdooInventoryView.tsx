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
} from '../../types/index.ts';
import type { AdminDashboardTab } from './AdminSidebar';
import { formatIDR } from '../../utils/formatters';
import { canSessionViewValuation, normalizeEnterpriseRole } from '../../utils/rbac';
import {
  formatMultiUomStock,
  getOdooSkuProfile,
  resolveEffectiveRemovalStrategy,
  resolveLotAndFefoForTier,
} from '../../utils/inventoryOdooHelper';
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
  Upload,
  Warehouse,
  X,
} from 'lucide-react';
import { BarcodeShelfLabelModal } from './BarcodeShelfLabelModal';
import { SkuImportModal } from './SkuImportModal';
import { WarehouseRackSetupPanel } from './WarehouseRackSetupPanel';
import { RackBlindOpnamePanel } from './RackBlindOpnamePanel';

interface OdooInventoryViewProps {
  theme: 'light' | 'dark';
  activeStaffSession?: StaffShiftSession | null;
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
  onAuditSku: (sku: string) => void;
  onEditTier: (tier: StoreInventoryStock) => void;
  onRefreshData?: () => Promise<void> | void;
  onShowToast: (title: string, message: string) => void;
}

type InventoryViewMode = 'kanban' | 'list' | 'racks' | 'blind_opname';
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

export const OdooInventoryView: React.FC<OdooInventoryViewProps> = ({
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
  onAuditSku,
  onEditTier,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const canViewValuation = canSessionViewValuation(activeStaffSession);
  const canonicalRole = activeStaffSession ? normalizeEnterpriseRole(activeStaffSession.userRole) : 'super_admin';
  const canManageWarehouseTopology =
    canonicalRole === 'warehouse' ||
    canonicalRole === 'store_manager' ||
    canonicalRole === 'coo' ||
    canonicalRole === 'super_admin';
  const [viewMode, setViewMode] = useState<InventoryViewMode>('kanban');
  const [hubFilter, setHubFilter] = useState<HubScope>('ALL');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<'ALL' | RemovalStrategyType>('ALL');
  const [includeB2BCatalogRows, setIncludeB2BCatalogRows] = useState<boolean>(true);
  const [showStrategyModal, setShowStrategyModal] = useState<boolean>(false);
  const [showBarcodeLabelModal, setShowBarcodeLabelModal] = useState<boolean>(false);
  const [showSkuImportModal, setShowSkuImportModal] = useState<boolean>(false);
  const [savingStrategy, setSavingStrategy] = useState<boolean>(false);
  const [mediaInspector, setMediaInspector] = useState<MediaInspectorTarget | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const cardClass = isLight
    ? 'bg-white border border-slate-200 shadow-sm text-slate-900 rounded-2xl'
    : 'bg-zinc-900/90 border border-zinc-800 text-zinc-100 rounded-2xl';
  const subCardClass = isLight
    ? 'bg-slate-50/80 border border-slate-200 text-slate-900 rounded-xl'
    : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl';
  const textTitle = isLight ? 'text-slate-900' : 'text-zinc-100';
  const textMuted = isLight ? 'text-slate-500' : 'text-zinc-400';
  const tableHeaderClass = isLight
    ? 'border-b border-slate-200 bg-slate-50/90 text-slate-600 font-semibold uppercase text-[10px] tracking-wider'
    : 'border-b border-zinc-800 bg-zinc-900/70 text-zinc-300 font-semibold uppercase text-[10px] tracking-wider';
  const inputClass = isLight
    ? 'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0F4C3A] focus:ring-1 focus:ring-[#0F4C3A]'
    : 'bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500';
  const modalClass = isLight
    ? 'bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl'
    : 'bg-zinc-950 border border-zinc-800 text-zinc-100 shadow-2xl rounded-2xl';

  // Aggregate summary metrics across retail tiers + B2B catalog
  const summaryMetrics = useMemo(() => {
    const retailValuation = allTiers.reduce(
      (sum, t) => sum + (t.physicalStock || 0) * (t.unitCost || 0),
      0
    );
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
        const profile = getOdooSkuProfile(row.sku, row.category, row.unit, row.image);
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
        };
      })
      .filter((entry) => {
        if (channelFilter !== 'ALL') {
          if (channelFilter === 'B2C' && entry.profile.salesChannel === 'B2B') return false;
          if (channelFilter === 'B2B' && entry.profile.salesChannel === 'B2C') return false;
          if (channelFilter === 'BOTH' && entry.profile.salesChannel !== 'BOTH') return false;
        }
        if (strategyFilter !== 'ALL' && entry.strategy !== strategyFilter) return false;
        return true;
      });
  }, [filteredTiers, wholesaleQuantRows, removalStrategies, batches, warehouseBins, channelFilter, strategyFilter]);

  // Compute live operational counts per Warehouse Hub for Odoo Kanban Cards
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

      return {
        hub,
        skuCount: hubTiers.length + (hub.id === 'CDC' ? wholesaleProducts.length : 0),
        totalUnits:
          hubTiers.reduce((s, t) => s + t.physicalStock, 0) +
          (hub.id === 'CDC'
            ? wholesaleProducts.reduce((s, p) => s + p.currentStockBaseUnits, 0)
            : 0),
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
          isLight ? 'border-slate-200 bg-slate-100' : 'border-zinc-700 bg-zinc-800'
        }`}
      />
    );
  };

  return (
    <div className="space-y-5">
      {/* Odoo Inventory Operations Command Header + View Switcher */}
      <div className={`${cardClass} p-4 sm:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#0F4C3A] text-white">
                Odoo Inventory Standard
              </span>
              <span className={`text-xs font-medium ${textMuted}`}>
                Multi-Warehouse Operations · B2B/B2C Catalog Split · FEFO/FIFO Engine
              </span>
            </div>
            <h2 className={`text-base sm:text-lg font-bold tracking-tight ${textTitle}`}>
              Warehouse Operations, Stock Quants &amp; Lot Traceability
            </h2>
          </div>

          {/* Top-Right Compact View Switcher + Removal Strategy Config */}
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`inline-flex items-center p-1 rounded-xl border ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-950 border-zinc-800'
              }`}
              role="tablist"
              aria-label="Inventory view switcher"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'kanban'}
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-300 hover:text-white'
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#0F4C3A] text-white shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-300 hover:text-white'
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      viewMode === 'racks'
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Warehouse className="w-3.5 h-3.5" />
                    Warehouse Rack &amp; FEFO/FIFO Setup
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'blind_opname'}
                    onClick={() => setViewMode('blind_opname')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      viewMode === 'blind_opname'
                        ? 'bg-[#0F4C3A] text-white shadow-xs'
                        : isLight
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Rack Blind Opname
                  </button>
                </>
              )}
            </div>

            {canManageWarehouseTopology && (
              <button
                type="button"
                onClick={() => setShowSkuImportModal(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-[#0F4C3A] dark:text-emerald-400" />
                Import SKU (CSV)
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowStrategyModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 text-[#0F4C3A] dark:text-emerald-400" />
              FEFO / FIFO Rules
            </button>

            <button
              type="button"
              onClick={() => setShowBarcodeLabelModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <Barcode className="w-3.5 h-3.5" />
              Barcode &amp; Shelf Labels
            </button>
          </div>
        </div>

        {/* Valuation & Traceability KPI Strip (Max 4 metrics, crisp tabular numerals) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
          <div className={`${subCardClass} p-3`}>
            <span className={`text-[11px] font-medium ${textMuted} block`}>
              {canViewValuation ? 'Asset Valuation (COA #1040)' : 'Active Tracked Quants'}
            </span>
            <span className={`text-sm sm:text-base font-bold font-mono tabular-nums ${textTitle} mt-0.5 block`}>
              {canViewValuation
                ? formatIDR(summaryMetrics.totalValuationIDR)
                : `${enrichedListRows.length} Stock Quants`}
            </span>
          </div>

          <div className={`${subCardClass} p-3`}>
            <span className={`text-[11px] font-medium ${textMuted} block`}>
              On-Hand Quants (B2C + B2B)
            </span>
            <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-[#0F4C3A] dark:text-emerald-400 mt-0.5 block">
              {summaryMetrics.totalPhysicalBaseUnits.toLocaleString('id-ID')} Base Units
            </span>
          </div>

          <div className={`${subCardClass} p-3`}>
            <span className={`text-[11px] font-medium ${textMuted} block`}>
              Reserved / Locked Picks
            </span>
            <span className={`text-sm sm:text-base font-bold font-mono tabular-nums ${textTitle} mt-0.5 block`}>
              {summaryMetrics.totalReserved.toLocaleString('id-ID')} Units
            </span>
          </div>

          <div className={`${subCardClass} p-3`}>
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

      {/* ===================================================================== */}
      {/* VIEW 1: ODOO-STYLE KANBAN OPERATIONS DASHBOARD */}
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    hubFilter === tab.id
                      ? 'bg-[#0F4C3A] border-[#0F4C3A] text-white'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="text-xs font-semibold text-[#0F4C3A] dark:text-emerald-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Inspect Granular Stock Quants &amp; Lots →
            </button>
          </div>

          {/* Hub Sections */}
          {hubKanbanCards.map(({ hub, skuCount, totalUnits, operations }) => (
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
                      <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {hub.code}
                      </span>
                    </div>
                    <p className={`text-[11px] ${textMuted}`}>{hub.subtitle}</p>
                  </div>
                </div>
                <div className={`text-xs font-mono tabular-nums ${textMuted}`}>
                  <strong className={textTitle}>{skuCount}</strong> Active SKUs ·{' '}
                  <strong className={textTitle}>{totalUnits.toLocaleString('id-ID')}</strong> Units On Hand
                </div>
              </div>

              {/* 6 Odoo Operation Cards Grid */}
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
                                  : 'bg-zinc-950/60 border-zinc-800'
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
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${op.barColor}`}
                              style={{ width: `${op.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Primary + Secondary Action Footer */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => onNavigateTab(op.targetTab)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-all whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {op.primaryLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateTab(op.secondaryAction.tab)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            isLight
                              ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                          }`}
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
                value={selectedOutletFilter}
                onChange={(e) => onOutletFilterChange(e.target.value)}
                className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
              >
                <option value="ALL">All Store Outlets</option>
                {storeOutlets && storeOutlets.length > 0 ? (
                  storeOutlets.map((st) => (
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

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
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

          {/* Odoo Stock Quants & Lot Ledger Table */}
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
                <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-zinc-800'}`}>
                  {enrichedListRows.map(({ row, safeReserved, safeAvailable, profile, strategy, lotInfo, uomBreakdown, availableUom, totalValuation }) => {
                    const isLowStock = !row.isWholesaleRow && 'minimumThreshold' in row && safeAvailable <= row.minimumThreshold;
                    const displayThumb =
                      profile.salesChannel === 'B2B' ? profile.b2bImageUrl : profile.b2cImageUrl;

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isLight ? 'hover:bg-slate-50/80' : 'hover:bg-zinc-800/40'
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
                              </div>
                              <div className={`font-bold ${textTitle} text-xs line-clamp-1 mt-0.5`}>
                                {row.productName}
                              </div>
                              <div className={`text-[10px] ${textMuted} line-clamp-1`}>
                                {profile.salesChannel === 'B2B'
                                  ? profile.wholesalePackagingSpec
                                  : profile.retailPackagingSpec}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Warehouse & Bin Location */}
                        <td className="py-3 px-3.5 min-w-[170px]">
                          <div className={`font-semibold ${isLight ? 'text-slate-800' : 'text-zinc-200'} text-xs`}>
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
                          <div className="font-mono text-[11px] font-semibold text-slate-800 dark:text-zinc-200">
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
                                : 'bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                            }`}
                          >
                            {lotInfo.statusLabel}
                          </span>
                        </td>

                        {/* 4. Removal Strategy (FEFO / FIFO Toggle) */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={savingStrategy}
                            onClick={() => handleToggleRowStrategy(row.sku, strategy)}
                            title="Click to toggle FEFO / FIFO picking priority"
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono border transition-all cursor-pointer whitespace-nowrap ${
                              strategy === 'FEFO'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-[#0F4C3A] dark:text-emerald-300 hover:bg-emerald-500/20'
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
                            <div className="flex items-center justify-between gap-2 text-[10px] pt-0.5 border-t border-slate-100 dark:border-zinc-800">
                              <span className={textMuted}>
                                Res: <strong>{safeReserved}</strong> · Inc:{' '}
                                <strong className="text-sky-600 dark:text-sky-400">+{row.incomingStock}</strong>
                              </span>
                              <span
                                className={`font-bold whitespace-nowrap ${
                                  isLowStock || lotInfo.isQuarantined
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
                              className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-all inline-flex items-center gap-1 cursor-pointer ${
                                isLight
                                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                              }`}
                              title="Inspect B2B vs B2C Media, Packaging & Multi-UoM"
                            >
                              <Eye className="w-3 h-3" />
                              B2B/B2C
                            </button>

                            {!row.isWholesaleRow && row.sourceTier && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onAuditSku(row.sku)}
                                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all border cursor-pointer ${
                                    isLight
                                      ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                      : 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600'
                                  }`}
                                >
                                  Audit Count
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEditTier(row.sourceTier!)}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-[#0F4C3A]/10 text-[#0F4C3A] dark:text-emerald-300 border border-[#0F4C3A]/20 hover:bg-[#0F4C3A]/20 rounded-lg transition-all cursor-pointer"
                                >
                                  Edit Notes
                                </button>
                              </>
                            )}
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

      {/* ===================================================================== */}
      {/* VIEW 4: RACK-LEVEL BLIND STOCK OPNAME (CYCLE COUNT) */}
      {/* ===================================================================== */}
      {viewMode === 'blind_opname' && canManageWarehouseTopology && (
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

      {/* ===================================================================== */}
      {/* MODAL 1: FEFO / FIFO REMOVAL STRATEGY CONFIGURATION */}
      {/* ===================================================================== */}
      {showStrategyModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center overflow-y-auto p-4">
          <div className={`${modalClass} max-w-2xl w-full p-6 space-y-4 my-auto`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <div>
                <h3 className={`text-base font-bold ${textTitle}`}>
                  Odoo Removal Strategy Rules (FEFO vs. FIFO)
                </h3>
                <p className={`text-xs ${textMuted}`}>
                  Controls batch picking order across POS Checkout, B2C Picker, B2B Wholesale Dispatch, and FEFO Allocator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStrategyModal(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-zinc-800 text-zinc-300'
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
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`text-xs font-bold ${textTitle} truncate`}>{catLabel}</div>
                      <div className={`text-[10px] font-mono ${textMuted}`}>{catKey}</div>
                    </div>
                    <select
                      disabled={savingStrategy}
                      value={activeStrat}
                      onChange={(e) =>
                        handleCategoryStrategyChange(catKey, e.target.value as RemovalStrategyType)
                      }
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg ${inputClass}`}
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

            <div className={`flex justify-end pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <button
                type="button"
                onClick={() => setShowStrategyModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl transition-all cursor-pointer"
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
        const profile = getOdooSkuProfile(
          mediaInspector.sku,
          mediaInspector.category,
          mediaInspector.unit
        );
        const skuLots = batches.filter((b) => b.sku === mediaInspector.sku);
        const multiUom = formatMultiUomStock(mediaInspector.physicalStock, profile.uomConversion);

        return createPortal(
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center overflow-y-auto p-4">
            <div className={`${modalClass} max-w-3xl w-full p-6 space-y-5 my-auto`}>
              <div className={`flex items-start justify-between gap-3 border-b pb-3 ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
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
                    isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-zinc-800 text-zinc-300'
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
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-zinc-800 font-mono text-[11px]">
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
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-zinc-800 font-mono text-[10px]">
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
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
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
                      <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-zinc-800'}`}>
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
                  <p className={`text-xs ${textMuted} p-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700`}>
                    Single-lot dry/wholesale bulk stock managed under {mediaInspector.strategy} valuation.
                  </p>
                )}
              </div>

              <div className={`flex justify-end pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
                <button
                  type="button"
                  onClick={() => setMediaInspector(null)}
                  className="px-4 py-2 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl transition-all cursor-pointer"
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
          };
        })}
        onShowToast={onShowToast}
      />

      {/* Additive Bulk SKU & Initial Batch CSV Importer */}
      <SkuImportModal
        theme={theme}
        isOpen={showSkuImportModal}
        onClose={() => setShowSkuImportModal(false)}
        activeStaffSession={activeStaffSession}
        storeOutlets={storeOutlets}
        onImported={async () => {
          if (onRefreshData) await onRefreshData();
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};

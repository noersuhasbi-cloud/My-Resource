import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import type {
  InventoryBatch,
  InventoryItem,
  StaffShiftSession,
  WarehouseRackConfig,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { FlashSaleClearanceModal } from './FlashSaleClearanceModal';

export type FefoZoneTier = 'SAFE' | 'WARNING' | 'CRITICAL';

interface FefoHeatmapRackVisualizerProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  batches: InventoryBatch[];
  racks?: WarehouseRackConfig[];
  inventory?: InventoryItem[];
  activeStaffSession?: StaffShiftSession | null;
  onRefreshData: () => Promise<void> | void;
  onShowToast: (title: string, message: string) => void;
}

const classifyFefoTier = (daysUntilExpiry: number): FefoZoneTier => {
  if (daysUntilExpiry <= 2) return 'CRITICAL';
  if (daysUntilExpiry <= 7) return 'WARNING';
  return 'SAFE';
};

const formatExpiryCountdown = (daysUntilExpiry: number): string => {
  if (daysUntilExpiry < 0) return `Expired ${Math.abs(daysUntilExpiry)}d`;
  if (daysUntilExpiry === 0) return 'Expired Hari Ini';
  if (daysUntilExpiry === 1) return '1 Hari Lagi';
  return `${daysUntilExpiry} Hari Lagi`;
};

const mapBatchStorageZoneToRackZone = (
  zone: InventoryBatch['storageZone']
): WarehouseRackConfig['storageZone'] => {
  if (zone === 'cold_chilled') return 'Chilled Walk-In (2°C–4°C)';
  if (zone === 'freezer') return 'Deep Freeze (-20°C)';
  return 'Ambient Dry';
};

export const FefoHeatmapRackVisualizer: React.FC<FefoHeatmapRackVisualizerProps> = ({
  theme,
  selectedStore,
  batches: propBatches,
  racks: propRacks,
  inventory = [],
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const [localRacks, setLocalRacks] = useState<WarehouseRackConfig[]>(propRacks || []);
  const [localBatches, setLocalBatches] = useState<InventoryBatch[]>(propBatches || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Filters
  const [tierFilter, setTierFilter] = useState<'ALL' | FefoZoneTier>('ALL');
  const [rackFilter, setRackFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Interactive Overlay State (supports both hover & tap/pin on mobile/desktop)
  const [hoveredBatchId, setHoveredBatchId] = useState<string | null>(null);
  const [pinnedBatchId, setPinnedBatchId] = useState<string | null>(null);
  const [busyBatchId, setBusyBatchId] = useState<string | null>(null);
  const [flashSaleBatchIds, setFlashSaleBatchIds] = useState<Set<string>>(new Set());
  const [flashSaleModalBatch, setFlashSaleModalBatch] = useState<InventoryBatch | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalBatches(propBatches);
  }, [propBatches]);

  useEffect(() => {
    if (propRacks && propRacks.length > 0) {
      setLocalRacks(propRacks);
    }
  }, [propRacks]);

  const onShowToastRef = useRef(onShowToast);
  onShowToastRef.current = onShowToast;

  const loadVisualizerData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const targetStore =
        selectedStore && selectedStore !== 'CONSOLIDATED' && selectedStore !== 'ALL'
          ? selectedStore
          : undefined;
      const [rackRes, batchRes] = await Promise.all([
        apiClient.getWarehouseRacks(targetStore),
        apiClient.getInventoryBatches(targetStore || 'ALL'),
      ]);
      setLocalRacks(rackRes.racks || []);
      setLocalBatches(batchRes || []);
    } catch (err: unknown) {
      onShowToastRef.current(
        'FEFO Visualizer Error',
        err instanceof Error ? err.message : 'Gagal memuat peta rak FEFO.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    void loadVisualizerData();
  }, [loadVisualizerData]);

  // Active batches with positive stock
  const activeBatches = useMemo(() => {
    return localBatches
      .filter((b) => {
        if (b.currentStock <= 0) return false;
        if (b.status === 'depleted' || b.status === 'recalled') return false;
        if (
          selectedStore &&
          selectedStore !== 'CONSOLIDATED' &&
          selectedStore !== 'ALL' &&
          b.storeId !== selectedStore
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [localBatches, selectedStore]);

  // Owner Summary Header Metrics (3-second audit)
  const summary = useMemo(() => {
    let safeCount = 0;
    let safeUnits = 0;
    let warningCount = 0;
    let warningUnits = 0;
    let criticalCount = 0;
    let criticalUnits = 0;
    let criticalLossIDR = 0;
    let warningValueIDR = 0;

    for (const b of activeBatches) {
      const tier = classifyFefoTier(b.daysUntilExpiry);
      const val = Math.round(b.currentStock * b.unitCost);
      if (tier === 'SAFE') {
        safeCount += 1;
        safeUnits += b.currentStock;
      } else if (tier === 'WARNING') {
        warningCount += 1;
        warningUnits += b.currentStock;
        warningValueIDR += val;
      } else {
        criticalCount += 1;
        criticalUnits += b.currentStock;
        criticalLossIDR += val;
      }
    }

    return {
      totalBatches: activeBatches.length,
      safeCount,
      safeUnits,
      warningCount,
      warningUnits,
      warningValueIDR,
      criticalCount,
      criticalUnits,
      criticalLossIDR,
    };
  }, [activeBatches]);

  // Filtered batches for grid cells
  const filteredBatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeBatches.filter((b) => {
      const tier = classifyFefoTier(b.daysUntilExpiry);
      if (tierFilter !== 'ALL' && tier !== tierFilter) return false;
      const resolvedRack = b.rackBinCode || `${b.storeId.slice(0, 6).toUpperCase()}-UNASSIGNED`;
      if (rackFilter !== 'ALL' && resolvedRack !== rackFilter) return false;
      if (q) {
        const hay = `${b.productName} ${b.sku} ${b.lotNumber} ${b.batchId} ${resolvedRack}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeBatches, tierFilter, rackFilter, searchQuery]);

  // Group warehouse racks and attach FEFO-sorted shelf cells
  const rackColumns = useMemo(() => {
    const rackMap = new Map<
      string,
      {
        rackBinCode: string;
        storeId: string;
        storeName: string;
        storageZone: string;
        rackHalalZone: string;
        rotationPolicy: string;
        maxCapacity: number;
        currentOccupancy: number;
        batches: InventoryBatch[];
      }
    >();

    for (const r of localRacks) {
      if (
        selectedStore &&
        selectedStore !== 'CONSOLIDATED' &&
        selectedStore !== 'ALL' &&
        r.storeId !== selectedStore
      ) {
        continue;
      }
      if (rackFilter !== 'ALL' && r.rackBinCode !== rackFilter) continue;
      rackMap.set(`${r.storeId}::${r.rackBinCode}`, {
        rackBinCode: r.rackBinCode,
        storeId: r.storeId,
        storeName: r.storeName,
        storageZone: r.storageZone,
        rackHalalZone: r.rackHalalZone || 'HALAL_DEDICATED',
        rotationPolicy: r.rotationPolicy,
        maxCapacity: r.maxCapacity,
        currentOccupancy: r.currentOccupancy,
        batches: [],
      });
    }

    for (const b of filteredBatches) {
      const binCode = b.rackBinCode || `${b.storeId.slice(0, 6).toUpperCase()}-STAGE-01`;
      const key = `${b.storeId}::${binCode}`;
      if (!rackMap.has(key)) {
        rackMap.set(key, {
          rackBinCode: binCode,
          storeId: b.storeId,
          storeName: b.storeName,
          storageZone: mapBatchStorageZoneToRackZone(b.storageZone),
          rackHalalZone: 'HALAL_DEDICATED',
          rotationPolicy: b.rotationStrategy === 'FIFO' ? 'STRICT_FIFO' : 'STRICT_FEFO',
          maxCapacity: Math.max(100, b.initialQuantity * 2),
          currentOccupancy: b.currentStock,
          batches: [],
        });
      }
      rackMap.get(key)!.batches.push(b);
    }

    const list = Array.from(rackMap.values());
    // When filtering by tier/search, keep racks that actually have matching cells, or all racks when unfiltered
    const visible =
      tierFilter !== 'ALL' || searchQuery.trim()
        ? list.filter((r) => r.batches.length > 0)
        : list;

    return visible.sort((a, b) => {
      const aCrit = a.batches.filter((x) => classifyFefoTier(x.daysUntilExpiry) === 'CRITICAL').length;
      const bCrit = b.batches.filter((x) => classifyFefoTier(x.daysUntilExpiry) === 'CRITICAL').length;
      if (bCrit !== aCrit) return bCrit - aCrit;
      if (b.batches.length !== a.batches.length) return b.batches.length - a.batches.length;
      return a.rackBinCode.localeCompare(b.rackBinCode);
    });
  }, [localRacks, filteredBatches, selectedStore, rackFilter, tierFilter, searchQuery]);

  const rackFilterOptions = useMemo(() => {
    const codes = new Set<string>();
    localRacks.forEach((r) => codes.add(r.rackBinCode));
    activeBatches.forEach((b) => {
      if (b.rackBinCode) codes.add(b.rackBinCode);
    });
    return Array.from(codes).sort();
  }, [localRacks, activeBatches]);

  const openOverlay = (batchId: string) => {
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    setHoveredBatchId(batchId);
  };

  const scheduleCloseOverlay = (batchId: string) => {
    if (pinnedBatchId === batchId) return;
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
    }
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setHoveredBatchId((prev) => (prev === batchId ? null : prev));
    }, 160);
  };

  // Action 2: 1-Click Move to Front Rack ("Pindah ke Rak Depan")
  const handleMoveToFrontRack = async (batch: InventoryBatch) => {
    setBusyBatchId(batch.batchId);
    try {
      const invItem = inventory.find((i) => i.sku === batch.sku);
      const isNonHalal = invItem?.halalStatus === 'NON_HALAL';
      const targetHalalZone = isNonHalal ? 'NON_HALAL_SEGREGATED' : 'HALAL_DEDICATED';
      const desiredStorageZone = mapBatchStorageZoneToRackZone(batch.storageZone);
      const storeRacks = localRacks.filter((r) => r.storeId === batch.storeId);

      // Prefer an existing front/display rack in matching store + Halal zone + thermal zone (different from current)
      const isFrontNamed = (code: string, notes?: string) =>
        /FRONT|DISP|R01|B01/i.test(code) || /front|display|primary|depan/i.test(notes || '');

      let destinationRack =
        storeRacks.find(
          (r) =>
            r.rackBinCode !== batch.rackBinCode &&
            r.storageZone === desiredStorageZone &&
            (isNonHalal ? r.rackHalalZone === 'NON_HALAL_SEGREGATED' : r.rackHalalZone !== 'NON_HALAL_SEGREGATED') &&
            isFrontNamed(r.rackBinCode, r.notes)
        ) ||
        storeRacks.find(
          (r) =>
            r.rackBinCode !== batch.rackBinCode &&
            (isNonHalal ? r.rackHalalZone === 'NON_HALAL_SEGREGATED' : r.rackHalalZone !== 'NON_HALAL_SEGREGATED') &&
            r.storageZone !== 'Quarantine Hold Cage' &&
            isFrontNamed(r.rackBinCode, r.notes)
        );

      // If batch is already on the sole R01 rack or no distinct front display rack exists yet, provision dedicated Front Display Rack
      if (!destinationRack) {
        const prefix = batch.storeId.replace('store-', '').split('-').pop()?.toUpperCase().slice(0, 3) || 'STR';
        const zoneCode =
          batch.storageZone === 'cold_chilled'
            ? 'CHL'
            : batch.storageZone === 'freezer'
            ? 'FRZ'
            : 'AMB';
        const frontRackCode = `${prefix}-${zoneCode}-FRONT-01`;
        const alreadyExists = storeRacks.find((r) => r.rackBinCode === frontRackCode);
        if (alreadyExists) {
          destinationRack = alreadyExists;
        } else {
          const saved = await apiClient.saveWarehouseRack({
            rackBinCode: frontRackCode,
            storeId: batch.storeId,
            storageZone: desiredStorageZone,
            rotationPolicy: 'STRICT_FEFO',
            maxCapacity: 250,
            rackHalalZone: targetHalalZone,
            notes: 'Rak Depan Prioritas FEFO (Display Clearance & Quick-Pick)',
          });
          destinationRack = saved.rack;
        }
      }

      const moveRes = await apiClient.assignSkuBatchToRack({
        storeId: batch.storeId,
        sku: batch.sku,
        rackBinCode: destinationRack.rackBinCode,
        rotationStrategy: 'FEFO',
        batchId: batch.batchId,
      });

      onShowToast(
        'Rotasi Rak Depan Berhasil',
        `${batch.productName} (${batch.lotNumber}) dipindahkan ke ${moveRes.rack.rackBinCode} dengan prioritas FEFO.`
      );
      await loadVisualizerData();
      await onRefreshData();
    } catch (err: unknown) {
      onShowToast(
        'Gagal Pindah Rak',
        err instanceof Error ? err.message : 'Gagal memindahkan batch ke Rak Depan.'
      );
    } finally {
      setBusyBatchId(null);
      setPinnedBatchId(null);
      setHoveredBatchId(null);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl p-4 sm:p-5 border transition-colors bg-slate-50 dark:bg-[#090A0F] border-slate-200 dark:border-slate-800/80 text-slate-900 dark:text-slate-100">
      {/* 1. OWNER SUMMARY HEADER (3-SECOND AUDIT BAR) */}
      <div className="rounded-xl p-4 border bg-white dark:bg-[#12141C] border-slate-200 dark:border-slate-800/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide bg-[#164E29] text-white dark:bg-emerald-950 dark:text-emerald-400 dark:border dark:border-emerald-700/70">
                <Layers className="w-3.5 h-3.5 text-emerald-300 dark:text-emerald-400" />
                FEFO Rack Heatmap
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Pemantauan Kesegaran Rak &amp; Audit Risiko Waste 3-Detik
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-1.5 text-slate-900 dark:text-slate-100">
              Live Color-Coded FEFO Matrix &amp; Rack Visualizer
            </h3>
          </div>

          {/* 3-Second Owner Audit Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setTierFilter((prev) => (prev === 'SAFE' ? 'ALL' : 'SAFE'))}
              className={`text-left px-3.5 py-2 rounded-xl border transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                tierFilter === 'SAFE' ? 'ring-2 ring-[#164E29]' : ''
              } bg-[#D1FAE5] border-[#A7F3D0] text-[#065F46]`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aman (&gt; 7 Hari)
                </span>
                <span className="font-mono tabular-nums">{summary.safeCount} lot</span>
              </div>
              <div className="text-xs font-extrabold font-mono tabular-nums mt-0.5">
                {summary.safeUnits.toLocaleString('id-ID')} unit siap jual
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTierFilter((prev) => (prev === 'WARNING' ? 'ALL' : 'WARNING'))}
              className={`text-left px-3.5 py-2 rounded-xl border transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                tierFilter === 'WARNING' ? 'ring-2 ring-[#92400E]' : ''
              } bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Waspada (3–7 Hari)
                </span>
                <span className="font-mono tabular-nums">{summary.warningCount} lot</span>
              </div>
              <div className="text-xs font-extrabold font-mono tabular-nums mt-0.5">
                {summary.warningUnits.toLocaleString('id-ID')} unit · {formatIDR(summary.warningValueIDR)}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTierFilter((prev) => (prev === 'CRITICAL' ? 'ALL' : 'CRITICAL'))}
              className={`text-left px-3.5 py-2 rounded-xl border transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                tierFilter === 'CRITICAL' ? 'ring-2 ring-[#991B1B]' : ''
              } bg-[#FEE2E2] border-[#FECACA] text-[#991B1B]`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Kritis (≤ 2 Hari / Exp)
                </span>
                <span className="font-mono tabular-nums">{summary.criticalCount} lot</span>
              </div>
              <div className="text-xs font-extrabold font-mono tabular-nums mt-0.5">
                Risiko Waste: {formatIDR(summary.criticalLossIDR)}
              </div>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-3.5 pt-3 border-t ${
            isLight ? 'border-slate-100' : 'border-slate-800/80'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari item, SKU, lot, atau kode rak..."
                className={`pl-8 pr-3 py-1.5 rounded-lg text-xs border w-60 focus:outline-none focus:border-[#164E29] ${
                  isLight
                    ? 'bg-[#F8FAFC] border-slate-200 text-[#1E293B]'
                    : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
                }`}
              />
            </div>

            <select
              value={rackFilter}
              onChange={(e) => setRackFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:border-[#164E29] ${
                isLight
                  ? 'bg-[#F8FAFC] border-slate-200 text-[#1E293B]'
                  : 'bg-[#090A0F] border-slate-800/80 text-slate-100'
              }`}
            >
              <option value="ALL">Semua Rak Gudang ({rackFilterOptions.length})</option>
              {rackFilterOptions.map((code) => (
                <option key={code} value={code}>
                  Rak {code}
                </option>
              ))}
            </select>

            {tierFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setTierFilter('ALL')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#164E29] text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
                Reset Filter Zona
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
              Ketuk atau arahkan kursor pada sel <strong className="text-[#991B1B] dark:text-rose-400">Merah (Kritis)</strong> untuk aksi cepat 1-klik
            </span>
            <button
              type="button"
              onClick={() => void loadVisualizerData()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#090A0F] text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/90 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#164E29] dark:text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
              Sinkronkan Rak
            </button>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE 2D/3D-STYLED RACK HEATMAP GRID */}
      {rackColumns.length === 0 ? (
        <div className="rounded-xl p-10 text-center border bg-white dark:bg-[#12141C] border-slate-200 dark:border-slate-800/80">
          <Boxes className="w-9 h-9 mx-auto text-[#164E29] dark:text-emerald-400 opacity-75 mb-2" />
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Tidak ada batch pada filter rak ini</div>
          <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
            Ubah filter status kedaluwarsa atau pilih semua rak untuk melihat matriks stok aktif.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rackColumns.map((rack) => {
            const utilPct =
              rack.maxCapacity > 0
                ? Math.min(100, Math.round((rack.currentOccupancy / rack.maxCapacity) * 100))
                : 0;
            const rackCritCount = rack.batches.filter(
              (b) => classifyFefoTier(b.daysUntilExpiry) === 'CRITICAL'
            ).length;

            return (
              <div
                key={`${rack.storeId}::${rack.rackBinCode}`}
                className="rounded-xl border border-b-4 transition-all flex flex-col bg-white dark:bg-[#12141C] border-slate-200 dark:border-slate-800/80 border-b-slate-300 dark:border-b-slate-700/80 shadow-xs"
              >
                {/* 3D-Styled Isometric Rack Bay Header */}
                <div className="px-3.5 py-3 border-b rounded-t-xl flex items-start justify-between gap-2 bg-slate-50/90 dark:bg-[#090A0F] border-slate-200 dark:border-slate-800/80">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-extrabold tracking-tight text-[#164E29] dark:text-[#22C55E]">
                        {rack.rackBinCode}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        · {rack.rotationPolicy === 'STRICT_FIFO' ? 'FIFO' : 'FEFO'}
                      </span>
                      {rack.rackHalalZone === 'NON_HALAL_SEGREGATED' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B]">
                          NON-HALAL
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 flex items-center gap-1 truncate ${
                        isLight ? 'text-slate-600' : 'text-slate-300'
                      }`}
                    >
                      <Thermometer className="w-3 h-3 shrink-0 text-[#164E29] dark:text-[#22C55E]" />
                      <span className="truncate">{rack.storageZone}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-mono font-bold tabular-nums">
                      {rack.batches.length} batch · {utilPct}% isi
                    </div>
                    {rackCritCount > 0 ? (
                      <div className="text-[10px] font-bold text-[#991B1B] bg-[#FEE2E2] px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        {rackCritCount} Kritis
                      </div>
                    ) : (
                      <div className="text-[10px] font-medium text-[#065F46] dark:text-emerald-400 mt-0.5">
                        {rack.storeName.replace('GroceMart ', '')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rack Occupancy Meter */}
                <div className="h-1 w-full bg-slate-200 dark:bg-[#090A0F] overflow-hidden">
                  <div
                    className="h-full bg-[#164E29] dark:bg-[#22C55E] transition-all duration-300"
                    style={{ width: `${utilPct}%` }}
                  />
                </div>

                {/* Shelf Grid Cells (2-column rack bay slots) */}
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1 content-start">
                  {rack.batches.length === 0 ? (
                    <div
                      className={`sm:col-span-2 py-6 rounded-lg border border-dashed text-center text-xs ${
                        isLight
                          ? 'border-slate-200 text-slate-400 bg-[#F8FAFC]'
                          : 'border-slate-800/80 text-slate-400 bg-[#090A0F]'
                      }`}
                    >
                      Slot Rak Kosong (Siap Putaway)
                    </div>
                  ) : (
                    rack.batches.map((batch) => {
                      const tier = classifyFefoTier(batch.daysUntilExpiry);
                      const isOverlayVisible =
                        hoveredBatchId === batch.batchId || pinnedBatchId === batch.batchId;
                      const isBusy = busyBatchId === batch.batchId;
                      const activeDiscount =
                        batch.markdownDiscountPercent ||
                        (flashSaleBatchIds.has(batch.batchId) ? 50 : 0);

                      const semanticCellClasses =
                        tier === 'CRITICAL'
                          ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5] motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]'
                          : tier === 'WARNING'
                          ? 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]'
                          : 'bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]';

                      const tierBadgeLabel =
                        tier === 'CRITICAL' ? 'CRITICAL' : tier === 'WARNING' ? 'WARNING' : 'SAFE';

                      return (
                        <div
                          key={batch.batchId}
                          className="relative"
                          onMouseEnter={() => {
                            if (tier === 'CRITICAL') openOverlay(batch.batchId);
                          }}
                          onMouseLeave={() => {
                            if (tier === 'CRITICAL') scheduleCloseOverlay(batch.batchId);
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setPinnedBatchId((prev) =>
                                prev === batch.batchId ? null : batch.batchId
                              )
                            }
                            className={`w-full text-left p-2.5 rounded-lg border border-b-2 transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#164E29] ${semanticCellClasses}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-extrabold tracking-wider uppercase">
                                {tierBadgeLabel}
                              </span>
                              <span className="text-[10px] font-mono font-bold tabular-nums">
                                {formatExpiryCountdown(batch.daysUntilExpiry)}
                              </span>
                            </div>

                            <div className="text-xs font-bold leading-snug line-clamp-2 min-h-[2rem]">
                              {batch.productName}
                            </div>

                            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono opacity-90">
                              <span className="truncate max-w-[95px]">{batch.lotNumber}</span>
                              <span className="font-bold tabular-nums">{batch.currentStock} pcs</span>
                            </div>

                            <div className="mt-1 pt-1 border-t border-current/15 flex items-center justify-between text-[10px] font-mono">
                              <span className="tabular-nums">
                                {formatIDR(batch.currentStock * batch.unitCost)}
                              </span>
                              {activeDiscount > 0 && (
                                <span className="px-1 py-0.2 rounded bg-[#164E29] text-white font-bold">
                                  -{activeDiscount}% POS
                                </span>
                              )}
                            </div>
                          </button>

                          {/* 3. ACTIONABLE 1-CLICK OVERLAY CARD (CRITICAL & INSPECTED CELLS) */}
                          {isOverlayVisible && (
                            <div
                              onMouseEnter={() => openOverlay(batch.batchId)}
                              onMouseLeave={() => scheduleCloseOverlay(batch.batchId)}
                              className={`absolute z-30 left-0 right-0 sm:w-72 sm:left-1/2 sm:-translate-x-1/2 bottom-full mb-2 p-3 rounded-xl border shadow-xl ${
                                isLight
                                  ? 'bg-[#FFFFFF] border-slate-200 text-[#1E293B]'
                                  : 'bg-[#12141C] border-slate-800/80 text-slate-100'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                        tier === 'CRITICAL'
                                          ? 'bg-[#FEE2E2] text-[#991B1B]'
                                          : tier === 'WARNING'
                                          ? 'bg-[#FEF3C7] text-[#92400E]'
                                          : 'bg-[#D1FAE5] text-[#065F46]'
                                      }`}
                                    >
                                      {formatExpiryCountdown(batch.daysUntilExpiry)}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                      {batch.batchId}
                                    </span>
                                  </div>
                                  <div className="text-xs font-bold mt-1 truncate">
                                    {batch.productName}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                    {batch.lotNumber} · {batch.currentStock} pcs ({formatIDR(batch.currentStock * batch.unitCost)})
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPinnedBatchId(null);
                                    setHoveredBatchId(null);
                                  }}
                                  aria-label="Tutup aksi batch"
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="mt-2.5 flex flex-col gap-1.5">
                                {(tier === 'CRITICAL' || tier === 'WARNING') && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPinnedBatchId(null);
                                      setHoveredBatchId(null);
                                      setFlashSaleModalBatch(batch);
                                    }}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-900/20 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                  >
                                    <Zap className="w-3.5 h-3.5" />
                                    {isBusy ? 'Memproses...' : '⚡ Obrar Kilat 50%'}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleMoveToFrontRack(batch);
                                  }}
                                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#090A0F] text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/90 transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-[#164E29] dark:text-emerald-400" />
                                  {isBusy ? 'Memindahkan...' : '🔄 Pindah ke Rak Depan'}
                                </button>
                              </div>

                              <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  Rak: {rack.rackBinCode}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-[#22C55E]" />
                                  FEFO Aktif
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FlashSaleClearanceModal
        isOpen={Boolean(flashSaleModalBatch)}
        onClose={() => setFlashSaleModalBatch(null)}
        theme={theme}
        batch={flashSaleModalBatch}
        inventory={inventory}
        racks={localRacks}
        onCompleted={async () => {
          if (flashSaleModalBatch) {
            setFlashSaleBatchIds((prev) => new Set([...prev, flashSaleModalBatch.batchId]));
          }
          await loadVisualizerData();
          await onRefreshData();
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};

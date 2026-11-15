import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  TrendingUp,
  Warehouse,
} from 'lucide-react';
import type {
  InventoryBatch,
  OmzetAnalyticsReport,
  StoreOutletSchedule,
} from '../../types/index.ts';
import type { AdminDashboardTab } from './AdminSidebar';
import { formatIDR } from '../../utils/formatters';

interface ExecutiveStockTickerProps {
  selectedStore: string;
  omzetData: OmzetAnalyticsReport | null;
  batches: InventoryBatch[];
  storeOutlets: StoreOutletSchedule[];
  lowStockCount: number;
  totalStockCount: number;
  onNavigateTab: (tab: AdminDashboardTab) => void;
}

export const ExecutiveStockTicker: React.FC<ExecutiveStockTickerProps> = ({
  selectedStore,
  omzetData,
  batches,
  storeOutlets,
  lowStockCount,
  totalStockCount,
  onNavigateTab,
}) => {
  const tickerMetrics = useMemo(() => {
    const isConsolidated = !selectedStore || selectedStore === 'CONSOLIDATED' || selectedStore === 'ALL';

    // 1. Live Daily Turnover (scoped by store if filtered)
    const storeSlice = !isConsolidated
      ? omzetData?.storeBreakdown?.find((s) => s.storeId === selectedStore)
      : undefined;
    const mtdOmzet = storeSlice
      ? storeSlice.omzet
      : omzetData?.totalRevenueMTD || 0;
    const dailyTurnoverIDR = Math.round(mtdOmzet / 30);
    const dodGrowth = omzetData?.dodGrowthPercent ?? 0;

    // 2. Live Waste / Shrinkage Risk across active batches
    const scopedBatches = batches.filter((b) => {
      if (b.currentStock <= 0 || b.status === 'depleted' || b.status === 'recalled') return false;
      if (!isConsolidated && b.storeId !== selectedStore) return false;
      return true;
    });

    const criticalBatches = scopedBatches.filter((b) => b.daysUntilExpiry <= 2);
    const warningBatches = scopedBatches.filter(
      (b) => b.daysUntilExpiry > 2 && b.daysUntilExpiry <= 5
    );
    const wasteRiskIDR = criticalBatches.reduce(
      (sum, b) => sum + Math.round(b.currentStock * b.unitCost),
      0
    );
    const activeDiscountCount = scopedBatches.filter(
      (b) => (b.markdownDiscountPercent || 0) > 0
    ).length;

    // 3. Live Warehouse & Hub Operational Status
    const scopedOutlets = isConsolidated
      ? storeOutlets
      : storeOutlets.filter((o) => o.storeId === selectedStore);
    const openOutlets = scopedOutlets.filter(
      (o) => !o.isEmergencyClosed && !o.isHolidayMode
    ).length;
    const totalOutlets = scopedOutlets.length;

    return {
      dailyTurnoverIDR,
      dodGrowth,
      criticalCount: criticalBatches.length,
      warningCount: warningBatches.length,
      wasteRiskIDR,
      activeDiscountCount,
      openOutlets,
      totalOutlets,
      activeBatchesCount: scopedBatches.length,
    };
  }, [selectedStore, omzetData, batches, storeOutlets]);

  const wasteBadgeClass =
    tickerMetrics.criticalCount > 0
      ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800/60'
      : tickerMetrics.warningCount > 0
      ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800/60'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700/60';

  return (
    <div
      className="w-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-b border-emerald-200/80 dark:border-emerald-800/50 transition-colors"
      aria-label="Executive Stock Ticker"
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-xs">
        {/* Ticker Identity + Total Daily Turnover */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-extrabold tracking-tight text-[#164E29] dark:text-[#22C55E]">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Executive Ticker</span>
          </span>

          <span className="text-emerald-400 dark:text-emerald-700" aria-hidden="true">
            |
          </span>

          <div className="inline-flex items-center gap-1.5">
            <span className="opacity-80 font-medium">Total Daily Turnover:</span>
            <strong className="font-mono tabular-nums font-bold text-[#164E29] dark:text-emerald-100">
              {formatIDR(tickerMetrics.dailyTurnoverIDR)}/hari
            </strong>
            <span className="inline-flex items-center text-[11px] font-mono font-bold text-emerald-700 dark:text-[#22C55E]">
              <ArrowUpRight className="w-3 h-3" />
              {tickerMetrics.dodGrowth >= 0 ? `+${tickerMetrics.dodGrowth}%` : `${tickerMetrics.dodGrowth}%`} DoD
            </span>
          </div>
        </div>

        {/* Potential Waste Risk + Warehouse Status */}
        <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
          <button
            type="button"
            onClick={() => onNavigateTab('fefo')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] font-semibold transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] hover:opacity-95 cursor-pointer ${wasteBadgeClass}`}
            title="Klik untuk membuka FEFO & Obrar Kilat 50%"
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>Potensi Risiko Waste:</span>
            <strong className="font-mono tabular-nums">
              {formatIDR(tickerMetrics.wasteRiskIDR)}
            </strong>
            <span className="font-mono opacity-85">
              ({tickerMetrics.criticalCount} kritis · {tickerMetrics.warningCount} waspada)
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('inventory')}
            className="inline-flex items-center gap-2 text-[11px] font-medium hover:underline transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            title="Buka Multi-Warehouse & Stock Matrix"
          >
            <Warehouse className="w-3.5 h-3.5 text-[#164E29] dark:text-[#22C55E] shrink-0" />
            <span>
              Warehouse:{' '}
              <strong className="font-mono tabular-nums">
                {tickerMetrics.openOutlets}/{tickerMetrics.totalOutlets || 5} Hub Aktif
              </strong>
            </span>
            <span className="opacity-60" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Boxes className="w-3 h-3 text-[#164E29] dark:text-[#22C55E]" />
              {totalStockCount.toLocaleString('id-ID')} unit ({tickerMetrics.activeBatchesCount} lot)
            </span>
            {lowStockCount > 0 && (
              <>
                <span className="opacity-60" aria-hidden="true">·</span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  {lowStockCount} low stock
                </span>
              </>
            )}
            {tickerMetrics.activeDiscountCount > 0 && (
              <>
                <span className="opacity-60" aria-hidden="true">·</span>
                <span className="font-semibold text-[#164E29] dark:text-[#22C55E]">
                  {tickerMetrics.activeDiscountCount} promo aktif
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

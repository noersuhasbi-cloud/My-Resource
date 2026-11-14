import React from 'react';
import type { OmzetAnalyticsReport } from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import {
  TrendingUp,
  Package,
  QrCode,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  ChevronRight,
  Building2,
  Users,
  Receipt,
  CalendarClock,
  ShieldAlert,
  Coins,
} from 'lucide-react';

interface ExecutiveOverviewTabProps {
  omzetData: OmzetAnalyticsReport | null;
  inventoryMetrics: {
    lowStockCount: number;
    totalStockCount: number;
    totalValuationWAC: number;
  };
  onNavigateToInventory?: () => void;
}

export const ExecutiveOverviewTab: React.FC<ExecutiveOverviewTabProps> = ({
  omzetData,
  inventoryMetrics,
  onNavigateToInventory,
}) => {
  const cardClass =
    'bg-white dark:bg-zinc-900/90 border border-gray-200/90 dark:border-zinc-800 shadow-[0_4px_12px_rgba(0,0,0,0.03)] text-gray-900 dark:text-zinc-100 rounded-2xl';
  const subCardClass =
    'bg-white dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 rounded-xl shadow-xs';
  const textTitle = 'text-gray-900 dark:text-white';
  const textMuted = 'text-gray-500 dark:text-zinc-300';
  const tableHeaderClass =
    'border-b border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/50 text-gray-500 dark:text-zinc-300 font-semibold uppercase text-[10px]';

  return (
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
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-500/20">
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
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                {(omzetData?.storeBreakdown || []).map((store) => (
                  <tr key={store.storeId} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
                    <td className={`py-3 px-3 font-semibold ${textTitle}`}>
                      {store.storeName}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-zinc-300">{store.city}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-zinc-300">{store.orderCount}</td>
                    <td className="py-3 px-3 font-mono font-semibold text-[#0F4C3A] dark:text-emerald-400">
                      {formatIDR(store.omzet)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
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
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
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
                <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
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

          <div className="pt-2 border-t border-slate-200 dark:border-zinc-700/60">
            <div className="p-3 bg-emerald-50/80 dark:bg-zinc-800/80 border border-emerald-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-300 rounded-xl text-xs flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400 shrink-0 mt-0.5" />
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

      {/* B2B Wholesale Commercial Performance & Liquidity Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. B2B vs B2C Commercial Revenue Split */}
        <div className={`${cardClass} p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className={`text-base font-bold ${textTitle}`}>Commercial Revenue Split</h2>
              </div>
              <p className={`text-xs ${textMuted} mt-0.5`}>B2B Wholesale vs B2C Retail Groceries</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
              Dual Channel
            </span>
          </div>

          {/* Stacked Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all"
                style={{ width: `${omzetData?.b2bVsB2cSplit?.b2cSharePercent ?? 54.4}%` }}
                title={`B2C: ${omzetData?.b2bVsB2cSplit?.b2cSharePercent ?? 54.4}%`}
              />
              <div
                className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all"
                style={{ width: `${omzetData?.b2bVsB2cSplit?.b2bSharePercent ?? 45.6}%` }}
                title={`B2B: ${omzetData?.b2bVsB2cSplit?.b2bSharePercent ?? 45.6}%`}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                B2C: {omzetData?.b2bVsB2cSplit?.b2cSharePercent ?? 54.4}%
              </span>
              <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                B2B: {omzetData?.b2bVsB2cSplit?.b2bSharePercent ?? 45.6}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className={`${subCardClass} p-3`}>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-300 uppercase">B2C Retail</div>
              <div className={`text-sm font-bold font-mono ${textTitle} mt-0.5`}>
                {formatIDR(omzetData?.b2bVsB2cSplit?.b2cRevenue ?? 211250000)}
              </div>
              <div className={`text-[10px] ${textMuted} mt-1`}>
                {omzetData?.b2bVsB2cSplit?.b2cOrders ?? 1269} consumer baskets
              </div>
            </div>

            <div className={`${subCardClass} p-3`}>
              <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">B2B Wholesale</div>
              <div className={`text-sm font-bold font-mono text-indigo-700 dark:text-indigo-400 mt-0.5`}>
                {formatIDR(omzetData?.b2bVsB2cSplit?.b2bRevenue ?? 177250000)}
              </div>
              <div className={`text-[10px] ${textMuted} mt-1`}>
                {omzetData?.b2bVsB2cSplit?.b2bOrdersCount ?? 42} bulk deliveries
              </div>
            </div>
          </div>
        </div>

        {/* 2. Wholesale Accounts Receivable (AR) Aging */}
        <div className={`${cardClass} p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h2 className={`text-base font-bold ${textTitle}`}>Wholesale AR Aging</h2>
              </div>
              <p className={`text-xs ${textMuted} mt-0.5`}>COA #1200 Credit Terms Aging Matrix</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
              {omzetData?.arAgingSummary?.overdueAccountsCount ?? 1} Overdue
            </span>
          </div>

          <div>
            <div className={`text-xs ${textMuted}`}>Total Wholesale Outstanding AR:</div>
            <div className={`text-xl font-bold font-mono ${textTitle} mt-0.5`}>
              {formatIDR(omzetData?.arAgingSummary?.totalArIDR ?? 67500000)}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">Current (0 - 30 Days)</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {formatIDR(omzetData?.arAgingSummary?.currentIDR ?? 32500000)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40">
              <span className="font-semibold text-amber-800 dark:text-amber-300">31 - 60 Days Aging</span>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                {formatIDR(omzetData?.arAgingSummary?.days31to60IDR ?? 0)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-800/40">
              <span className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                Overdue (&gt; 60 Days / Locked)
              </span>
              <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
                {formatIDR(omzetData?.arAgingSummary?.overdue60PlusIDR ?? 35000000)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Informal Landed Cost / "Kuli Bongkar" Absorption */}
        <div className={`${cardClass} p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className={`text-base font-bold ${textTitle}`}>Informal Labor Landed Cost</h2>
              </div>
              <p className={`text-xs ${textMuted} mt-0.5`}>Kuli Bongkar &amp; Pasar Retribusi Absorption</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              Asset Capitalized
            </span>
          </div>

          <div>
            <div className={`text-xs ${textMuted}`}>Total Informal Costs Capitalized to Inventory (#1040):</div>
            <div className={`text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5`}>
              {formatIDR(omzetData?.informalLandedCostSummary?.totalAbsorbedIDR ?? 1450000)}
            </div>
          </div>

          <div className={`${subCardClass} p-3 text-xs space-y-2`}>
            <div className="flex justify-between items-center">
              <span className={textMuted}>Petty Cash Vouchers (#1015):</span>
              <span className={`font-mono font-bold ${textTitle}`}>
                {omzetData?.informalLandedCostSummary?.voucherCount ?? 6} signed vouchers
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={textMuted}>Non-Faktur Tax Leakage:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                0% (Fully absorbed in WAC)
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] text-slate-600 dark:text-zinc-300">
            Mandatory internal expense voucher signed by Warehouse Supervisor &amp; Driver capitalizes un-invoiced terminal porters directly into product FIFO/Moving Avg unit cost.
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
          {onNavigateToInventory && (
            <button
              onClick={onNavigateToInventory}
              className="text-xs text-[#0F4C3A] dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              View Inventory Matrix
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {(omzetData?.topSkus || []).map((sku, idx) => (
            <div key={`${sku.sku}-${idx}`} className={`${subCardClass} p-3.5 space-y-1.5`}>
              <span className={`text-[10px] font-mono ${textMuted}`}>{sku.sku}</span>
              <h3 className={`text-xs font-bold ${textTitle} line-clamp-1`}>{sku.productName}</h3>
              <p className={`text-[11px] ${textMuted}`}>{sku.unitsSold} units sold</p>
              <p className="text-xs font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">{formatIDR(sku.revenue)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

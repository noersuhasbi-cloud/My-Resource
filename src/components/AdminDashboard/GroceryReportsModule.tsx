import React, { useState, useEffect } from 'react';
import type {
  GroceryMetricsReport,
  InventoryBatch,
} from '../../types/index.ts';
import { formatIDR } from '../../utils/formatters';
import { apiClient } from '../../services/apiClient';
import {
  TrendingUp,
  Clock,
  Trash2,
  Scan,
  Printer,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Percent,
  RefreshCw,
  Building2,
} from 'lucide-react';

interface GroceryReportsModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  onShowToast: (title: string, message: string) => void;
}

export const GroceryReportsModule: React.FC<GroceryReportsModuleProps> = ({
  theme,
  selectedStore,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // Sub-tabs: 'all' | 'fifo' | 'waste' | 'fulfillment'
  const [activeTab, setActiveTab] = useState<'all' | 'fifo' | 'waste' | 'fulfillment'>('all');
  const [reportData, setReportData] = useState<GroceryMetricsReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getGroceryMetrics(selectedStore);
      setReportData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Reports Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [selectedStore]);

  const handlePrint = () => {
    window.print();
  };

  const cardClass = `rounded-2xl border transition-all ${
    isLight
      ? 'bg-white border-gray-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.03)]'
      : 'bg-stone-900/90 border-stone-800 shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
  }`;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className={`${cardClass} p-5 sm:p-6 space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0F4C3A] text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Grocery Intelligence &amp; Analytics
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                  Real-Time ERP Sync
                </span>
              </div>
              <h1 className={`text-xl font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                Perishables, Waste &amp; Fulfillment Intelligence Reports
              </h1>
              <p className={`text-xs mt-0.5 max-w-2xl ${isLight ? 'text-gray-600' : 'text-stone-400'}`}>
                Deep grocery analytics tracking FEFO batch aging, natural moisture evaporation vs preparation loss, and store-level picker fulfillment SLAs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMetrics}
              disabled={isLoading}
              className={`p-2 rounded-xl border text-xs transition-all ${
                isLight ? 'hover:bg-gray-100 border-gray-300' : 'hover:bg-stone-800 border-stone-700'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border bg-white dark:bg-stone-800 border-gray-300 dark:border-stone-700 shadow-2xs hover:bg-gray-50 dark:hover:bg-stone-700 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-stone-800 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-stone-400 hover:bg-stone-800'
            }`}
          >
            Consolidated Executive Summary
          </button>
          <button
            onClick={() => setActiveTab('fifo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'fifo'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-stone-400 hover:bg-stone-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>FIFO &amp; Batch Expiry</span>
          </button>
          <button
            onClick={() => setActiveTab('waste')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'waste'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-stone-400 hover:bg-stone-800'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Waste &amp; Shrinkage Decomposition</span>
          </button>
          <button
            onClick={() => setActiveTab('fulfillment')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'fulfillment'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-stone-400 hover:bg-stone-800'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Picker &amp; Fulfillment SLA</span>
          </button>
        </div>
      </div>

      {reportData && (
        <div className="space-y-6">
          {/* SECTION 1: FIFO & BATCH EXPIRY INTELLIGENCE */}
          {(activeTab === 'all' || activeTab === 'fifo') && (
            <div className={`${cardClass} p-5 sm:p-6 space-y-5`}>
              <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-base">FIFO Expiry Risk &amp; Batch Aging Distribution</h3>
                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                      Active perishables aging profile with VIVO (Near-Expiry Markdown) revenue recovery
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-gray-400 block">At-Risk Value (&lt;7 Days):</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {formatIDR(reportData.fifoExpiryMetrics.atRiskInventoryValueIDR)}
                  </span>
                </div>
              </div>

              {/* Aging Buckets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {reportData.fifoExpiryMetrics.agingBuckets.map((b, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border space-y-1.5 ${
                      idx === 0
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                        : idx === 1
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                        : isLight
                        ? 'bg-gray-50/80 border-gray-200 text-gray-900'
                        : 'bg-stone-800/60 border-stone-700 text-white'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                      {b.bucket}
                    </span>
                    <div className="text-xl font-mono font-bold">
                      {b.units} <span className="text-xs font-normal">units</span>
                    </div>
                    <div className="text-xs font-mono font-semibold opacity-90">
                      {formatIDR(b.valueIDR)}
                    </div>
                  </div>
                ))}
              </div>

              {/* VIVO Recovery Banner */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-900 dark:text-emerald-300">
                      VIVO Near-Expiry Clearance Recovery Active:
                    </span>
                    <p className="text-emerald-800 dark:text-emerald-200 text-[11px] mt-0.5">
                      {reportData.fifoExpiryMetrics.vivoDiscountSoldUnits} units liquidated via 25% near-expiry automated discount, recovering{' '}
                      <strong>{formatIDR(reportData.fifoExpiryMetrics.vivoRevenueRecoveredIDR)}</strong> in margin that would otherwise be dumped to waste.
                    </p>
                  </div>
                </div>

                <div className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300 self-start sm:self-auto whitespace-nowrap">
                  Turnover: {reportData.fifoExpiryMetrics.batchTurnoverRateDays} Days
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: WASTE & SHRINKAGE DECOMPOSITION */}
          {(activeTab === 'all' || activeTab === 'waste') && (
            <div className={`${cardClass} p-5 sm:p-6 space-y-5`}>
              <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <div>
                    <h3 className="font-bold text-base">Grocery Shrinkage &amp; Moisture Loss Decomposition</h3>
                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                      Segregating natural cellular transpiration evaporation vs handling &amp; spoilage scrap
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-gray-400 block">Shrink-to-Sales Ratio:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {reportData.wasteShrinkageMetrics.shrinkToSalesRatioPercent}% (Target &lt; 2.5%)
                  </span>
                </div>
              </div>

              {/* Cause Breakdown Bars */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-sans">
                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-stone-700 bg-gray-50/50 dark:bg-stone-800/40">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Natural Moisture Loss</span>
                  <span className="font-mono font-bold text-base text-gray-900 dark:text-white">
                    {formatIDR(reportData.wasteShrinkageMetrics.naturalMoistureLossIDR)}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">Produce weight loss audit</span>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-stone-700 bg-gray-50/50 dark:bg-stone-800/40">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Trim, Wash &amp; Prep</span>
                  <span className="font-mono font-bold text-base text-gray-900 dark:text-white">
                    {formatIDR(reportData.wasteShrinkageMetrics.prepAndWashLossIDR)}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">Culinary prep &amp; outer leaves</span>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-stone-700 bg-gray-50/50 dark:bg-stone-800/40">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">In-Store Handling Damage</span>
                  <span className="font-mono font-bold text-base text-gray-900 dark:text-white">
                    {formatIDR(reportData.wasteShrinkageMetrics.handlingDamageLossIDR)}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">Customer dropped / bruised</span>
                </div>

                <div className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20">
                  <span className="text-[10px] text-rose-500 font-bold block uppercase">Expired / Spoilage Scrap</span>
                  <span className="font-mono font-bold text-base text-rose-600 dark:text-rose-400">
                    {formatIDR(reportData.wasteShrinkageMetrics.expiredSpoilageLossIDR)}
                  </span>
                  <span className="text-[10px] text-rose-700 dark:text-rose-300 block mt-0.5">Non-recoverable scrap</span>
                </div>
              </div>

              {/* Department Breakdown */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold">Shrinkage Allocation by Grocery Department:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {reportData.wasteShrinkageMetrics.departmentBreakdown.map((dept, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-gray-200 dark:border-stone-700 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold">{dept.department}</span>
                        <span className="font-mono font-bold">{formatIDR(dept.lossIDR)} ({dept.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${dept.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: FULFILLMENT & PICKER SLA METRICS */}
          {(activeTab === 'all' || activeTab === 'fulfillment') && (
            <div className={`${cardClass} p-5 sm:p-6 space-y-5`}>
              <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <Scan className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <h3 className="font-bold text-base">Storefront Fulfillment &amp; Picker SLA Benchmarks</h3>
                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                      Catch-weight balance accuracy, substitution acceptance, and pick speed
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-mono">
                  SLA Grade A+
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-stone-700">
                  <span className="text-[11px] text-gray-500 block">Average Pick Time</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                    {reportData.fulfillmentMetrics.averagePickTimeMinutes} <span className="text-xs">mins</span>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Target &lt; 6.0 mins</span>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-stone-700">
                  <span className="text-[11px] text-gray-500 block">Catch-Weight Accuracy</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-blue-600 dark:text-blue-400">
                    {reportData.fulfillmentMetrics.catchWeightAccuracyPercent}%
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Within ±5% target tolerance</span>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-stone-700">
                  <span className="text-[11px] text-gray-500 block">Substitutions Accepted</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-indigo-600 dark:text-indigo-400">
                    {reportData.fulfillmentMetrics.substitutionsAcceptedPercent}%
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Customer WhatsApp approval</span>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-stone-700">
                  <span className="text-[11px] text-gray-500 block">Click &amp; Collect Rate</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-teal-600 dark:text-teal-400">
                    {reportData.fulfillmentMetrics.clickAndCollectFulfillmentRatePercent}%
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Ready within 15 min window</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

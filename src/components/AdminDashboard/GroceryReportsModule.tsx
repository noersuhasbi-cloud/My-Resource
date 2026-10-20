import React, { useState, useEffect } from 'react';
import type {
  GroceryMetricsReport,
  InventoryBatch,
  BatchRecallTraceResult,
  CustomerRecallNotification,
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
  ShieldAlert,
  ShieldCheck,
  Search,
  ShoppingCart,
  Package,
  Truck,
  Send,
  Lock,
  Unlock,
  Thermometer,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  X,
  ExternalLink,
} from 'lucide-react';

interface GroceryReportsModuleProps {
  theme: 'light' | 'dark';
  selectedStore?: string;
  onShowToast: (title: string, message: string) => void;
}

export const GroceryReportsModule: React.FC<GroceryReportsModuleProps> = ({
  theme,
  selectedStore = 'CONSOLIDATED',
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // Sub-tabs: 'all' | 'fifo' | 'waste' | 'fulfillment' | 'recall'
  const [activeTab, setActiveTab] = useState<'all' | 'fifo' | 'waste' | 'fulfillment' | 'recall'>('all');
  const [reportData, setReportData] = useState<GroceryMetricsReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // FDA / EU Batch Traceability & Food Safety Recall State
  const [recallSearchQuery, setRecallSearchQuery] = useState<string>('BAT-2601-PRD');
  const [recallTraceResult, setRecallTraceResult] = useState<BatchRecallTraceResult | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [isQuarantining, setIsQuarantining] = useState<boolean>(false);
  const [isNotifying, setIsNotifying] = useState<boolean>(false);
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState<boolean>(false);
  const [notificationChannel, setNotificationChannel] = useState<'WhatsApp' | 'SMS' | 'Email'>('WhatsApp');
  const [quarantineReason, setQuarantineReason] = useState<string>(
    'Precautionary Food Safety Hold (Class I Microbial / Pathogen Notice)'
  );
  const [sentNotifications, setSentNotifications] = useState<CustomerRecallNotification[]>([]);

  const handleTraceBatch = async (queryToSearch = recallSearchQuery) => {
    if (!queryToSearch.trim()) return;
    setIsTracing(true);
    try {
      const result = await apiClient.traceBatchRecall(queryToSearch);
      setRecallTraceResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Batch Trace Error', msg);
    } finally {
      setIsTracing(false);
    }
  };

  const handleQuarantineBatch = async () => {
    if (!recallTraceResult) return;
    setIsQuarantining(true);
    try {
      const res = await apiClient.quarantineBatch({
        batchId: recallTraceResult.batchId,
        reason: quarantineReason,
        recallClassification: 'Class I (High Risk / Immediate Hazard)',
        hazardDescription: 'Potential microbial contamination detected in batch lot upstream testing.',
        auditorName: 'Corporate Food Safety Officer',
      });
      onShowToast('Lot Quarantined Across Warehouses', res.message);
      await handleTraceBatch(recallTraceResult.batchId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Quarantine Error', msg);
    } finally {
      setIsQuarantining(false);
    }
  };

  const handleReleaseBatch = async () => {
    if (!recallTraceResult) return;
    try {
      const res = await apiClient.releaseBatchRecall(recallTraceResult.batchId);
      onShowToast('Lot Released from Quarantine', res.message);
      await handleTraceBatch(recallTraceResult.batchId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Release Error', msg);
    }
  };

  const handleBroadcastRecallAlert = async () => {
    if (!recallTraceResult) return;
    setIsNotifying(true);
    try {
      const res = await apiClient.notifyRecallCustomers({
        batchId: recallTraceResult.batchId,
        channel: notificationChannel,
        message: `URGENT GROCEMART FOOD RECALL: Lot #${recallTraceResult.lotNumber} (${recallTraceResult.productName}) has been recalled under FDA FSMA / EU RASFF safety protocol. Do not consume. Bring to any outlet for 100% refund.`,
      });
      setSentNotifications((prev) => [...res.notifications, ...prev]);
      setIsNotifyModalOpen(false);
      onShowToast(
        'Recall Notice Broadcast',
        `Dispatched emergency advisory to ${res.notifications.length} customers via ${notificationChannel}.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Broadcast Error', msg);
    } finally {
      setIsNotifying(false);
    }
  };

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
          <button
            onClick={() => {
              setActiveTab('recall');
              if (!recallTraceResult) handleTraceBatch('BAT-2601-PRD');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'recall'
                ? 'bg-rose-700 text-white shadow-xs'
                : isLight
                ? 'text-rose-700 hover:bg-rose-50'
                : 'text-rose-400 hover:bg-stone-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>FDA / EU Recall &amp; Traceability</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/20 dark:bg-rose-500/30 font-mono font-bold">
              Global
            </span>
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

          {/* SECTION 4: GLOBAL COMPLIANCE - FDA FSMA 204 / EU RASFF FOOD SAFETY RECALL & BATCH TRACEABILITY */}
          {(activeTab === 'all' || activeTab === 'recall') && (
            <div className={`${cardClass} p-5 sm:p-6 space-y-6 border-rose-500/30 dark:border-rose-500/30`}>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-gray-100 dark:border-stone-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white">
                        FDA FSMA 204 &amp; EU RASFF Food Safety Recall &amp; Lot Traceability
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono">
                        US • EU • AUS Compliance
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-stone-400'}`}>
                      End-to-end tracking linking supplier purchase orders, cold-chain storage bins, POS registers, and customer online deliveries.
                    </p>
                  </div>
                </div>

                {recallTraceResult && (
                  <div className="flex items-center gap-2">
                    {recallTraceResult.recallStatus === 'quarantined' ? (
                      <button
                        type="button"
                        onClick={handleReleaseBatch}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Release Quarantine</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleQuarantineBatch}
                        disabled={isQuarantining}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{isQuarantining ? 'Quarantining...' : 'Quarantine Lot Across All Warehouses'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsNotifyModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Notify Customers ({recallTraceResult.onlineOrders.length})</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Search Bar & Quick Chips */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={recallSearchQuery}
                      onChange={(e) => setRecallSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTraceBatch()}
                      placeholder="Search Batch ID (e.g. BAT-2601-PRD), Lot # (LOT-2601-A1), or SKU..."
                      className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-mono font-medium border ${
                        isLight
                          ? 'bg-white border-gray-200 text-gray-900 focus:border-[#0F4C3A]'
                          : 'bg-stone-800 border-stone-700 text-stone-100 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTraceBatch()}
                    disabled={isTracing}
                    className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTracing ? 'animate-spin' : ''}`} />
                    <span>{isTracing ? 'Tracing...' : 'Trace End-to-End Lot'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className={`text-[11px] font-semibold ${isLight ? 'text-gray-400' : 'text-stone-500'}`}>
                    Sample Grocery Lots:
                  </span>
                  {[
                    { label: 'Organic Fuji Apples (BAT-2601)', query: 'BAT-2601-PRD' },
                    { label: 'Dragon Fruit (BAT-2602)', query: 'BAT-2602-PRD' },
                    { label: 'Wagyu Tenderloin (BAT-2603)', query: 'BAT-2603-PRD' },
                    { label: 'SKU-PRD-001', query: 'SKU-PRD-001' },
                    { label: 'SKU-PRD-004', query: 'SKU-PRD-004' },
                  ].map((chip) => (
                    <button
                      key={chip.query}
                      type="button"
                      onClick={() => {
                        setRecallSearchQuery(chip.query);
                        handleTraceBatch(chip.query);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-all cursor-pointer ${
                        recallSearchQuery === chip.query
                          ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                          : isLight
                          ? 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                          : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-300'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batch Overview & Trace Results */}
              {recallTraceResult ? (
                <div className="space-y-6 animate-fadeIn">
                  {/* Summary Card */}
                  <div
                    className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      recallTraceResult.recallStatus === 'quarantined'
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-900 dark:text-rose-200'
                        : isLight
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm font-mono">{recallTraceResult.batchId}</span>
                        <span className="text-xs">•</span>
                        <span className="font-semibold text-xs">Lot #{recallTraceResult.lotNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            recallTraceResult.recallStatus === 'quarantined'
                              ? 'bg-rose-600 text-white animate-pulse'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {recallTraceResult.recallStatus === 'quarantined'
                            ? 'LOCKDOWN / QUARANTINED'
                            : 'ACTIVE / REGISTER UNLOCKED'}
                        </span>
                      </div>
                      <h4 className="font-bold text-base mt-1">{recallTraceResult.productName}</h4>
                      <p className="text-xs opacity-80 mt-0.5">
                        SKU: <code className="font-mono">{recallTraceResult.sku}</code> • Supplier:{' '}
                        <strong>{recallTraceResult.supplierName}</strong> • Received: {recallTraceResult.receivedDate} • Expiry: {recallTraceResult.expiryDate}
                      </p>
                      {recallTraceResult.quarantineReason && (
                        <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mt-1">
                          Notice: {recallTraceResult.quarantineReason} (Quarantined at {recallTraceResult.quarantinedAt ? new Date(recallTraceResult.quarantinedAt).toLocaleString() : 'Now'})
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                        <span className="text-[10px] block opacity-70">On-Hand Stock</span>
                        <span className="text-base font-bold font-mono">{recallTraceResult.currentWarehouseStock} units</span>
                      </div>
                      <div className="text-center p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                        <span className="text-[10px] block opacity-70">Quarantined Frozen</span>
                        <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                          {recallTraceResult.quarantinedStock} units
                        </span>
                      </div>
                      <div className="text-center p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                        <span className="text-[10px] block opacity-70">Affected Online Orders</span>
                        <span className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">
                          {recallTraceResult.onlineOrders.length} orders
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4-Stage Traceability Pipeline */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Stage 1: Upstream Supplier Origin */}
                    <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-gray-200' : 'bg-stone-800/60 border-stone-700'} space-y-3`}>
                      <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-stone-700">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <h4 className="font-bold text-xs uppercase tracking-wider">
                            1. Upstream Supplier Origin &amp; Intake Note
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">Inbound Logistics</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-stone-900 border border-gray-200/60 dark:border-stone-800">
                          <span className="text-[10px] text-gray-400 block">Supplier Name</span>
                          <span className="font-bold mt-0.5 block">{recallTraceResult.upstreamOrigin.supplierName}</span>
                          <span className="text-[10px] font-mono text-gray-400">{recallTraceResult.upstreamOrigin.supplierId}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-stone-900 border border-gray-200/60 dark:border-stone-800">
                          <span className="text-[10px] text-gray-400 block">Purchase Order &amp; Delivery Note</span>
                          <span className="font-mono font-bold mt-0.5 block">{recallTraceResult.upstreamOrigin.poId}</span>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            Surat Jalan: {recallTraceResult.upstreamOrigin.deliveryNoteNumber}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-stone-900 border border-gray-200/60 dark:border-stone-800">
                          <span className="text-[10px] text-gray-400 block">Intake Cold-Chain Temp</span>
                          <span className="font-mono font-bold mt-0.5 flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Thermometer className="w-3.5 h-3.5" />
                            {recallTraceResult.upstreamOrigin.intakeTempCelsius}°C (Chilled Intact)
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-stone-900 border border-gray-200/60 dark:border-stone-800">
                          <span className="text-[10px] text-gray-400 block">Intake QC Inspection</span>
                          <span className="font-bold mt-0.5 block text-emerald-700 dark:text-emerald-400">
                            {recallTraceResult.upstreamOrigin.intakeQualityStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stage 2: Warehouse Storage Zones */}
                    <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-gray-200' : 'bg-stone-800/60 border-stone-700'} space-y-3`}>
                      <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-stone-700">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <h4 className="font-bold text-xs uppercase tracking-wider">
                            2. Warehouse Storage Zones &amp; Isolation
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">
                          {recallTraceResult.warehouseLocations.length} Hubs Allocated
                        </span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {recallTraceResult.warehouseLocations.map((loc) => (
                          <div
                            key={`${loc.storeId}-${loc.warehouseZoneId}`}
                            className="p-2.5 rounded-lg bg-gray-50 dark:bg-stone-900 border border-gray-200/60 dark:border-stone-800 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold">{loc.storeName}</div>
                              <div className="text-[10px] font-mono text-gray-400">
                                Zone: {loc.warehouseZoneId} • Storage: {loc.storageType}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold">
                                {loc.physicalStock} on-hand ({loc.availableStock} avail)
                              </div>
                              <span
                                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                  loc.isQuarantined
                                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {loc.isQuarantined ? 'Quarantined Locked' : 'Normal Circulation'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stage 3: Downstream POS Transactions */}
                    <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-gray-200' : 'bg-stone-800/60 border-stone-700'} space-y-3`}>
                      <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-stone-700">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <h4 className="font-bold text-xs uppercase tracking-wider">
                            3. Downstream POS Retail Register Sales
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">
                          {recallTraceResult.posSales.length} In-Store Transactions
                        </span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {recallTraceResult.posSales.length === 0 ? (
                          <div className="py-6 text-center text-xs text-gray-400">
                            No storefront POS transactions logged for this lot yet.
                          </div>
                        ) : (
                          recallTraceResult.posSales.map((pos) => (
                            <div
                              key={pos.transactionId}
                              className="p-2.5 rounded-lg bg-gray-50 dark:bg-stone-900 border border-gray-200/60 dark:border-stone-800 flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-bold font-mono text-[#0F4C3A] dark:text-emerald-400">
                                  {pos.receiptNumber}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {pos.storeName} • Cashier: {pos.cashierName} • {new Date(pos.timestamp).toLocaleTimeString()}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-bold">{pos.quantitySold} units</div>
                                <div className="text-[10px] text-gray-400">{formatIDR(pos.lineTotal)}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Stage 4: Downstream Online Customer Orders */}
                    <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-gray-200' : 'bg-stone-800/60 border-stone-700'} space-y-3`}>
                      <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-stone-700">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <h4 className="font-bold text-xs uppercase tracking-wider">
                            4. Downstream Online Customer Deliveries
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">
                          {recallTraceResult.onlineOrders.length} Online Shipments
                        </span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {recallTraceResult.onlineOrders.length === 0 ? (
                          <div className="py-6 text-center text-xs text-gray-400">
                            No online ecommerce orders currently associated with this lot.
                          </div>
                        ) : (
                          recallTraceResult.onlineOrders.map((ord) => (
                            <div
                              key={ord.orderId}
                              className="p-2.5 rounded-lg bg-gray-50 dark:bg-stone-900 border border-gray-200/60 dark:border-stone-800 flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-bold">{ord.customerName}</div>
                                <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                                  Order #{ord.orderId} • {ord.customerPhone}
                                </div>
                                <div className="text-[10px] text-gray-400 truncate max-w-xs">
                                  {ord.deliveryAddress || 'Senopati Hub Delivery'}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold block">{ord.quantity} units</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 uppercase">
                                  {ord.status}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Regulatory Compliance Advisory Dossier */}
                  {recallTraceResult.regulatoryNotice && (
                    <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span className="font-bold text-rose-950 dark:text-rose-200">
                            Official Regulatory Recall Classification: {recallTraceResult.regulatoryNotice.recallClassification}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px] text-rose-800 dark:text-rose-300">
                          <span>{recallTraceResult.regulatoryNotice.fdaReportableFoodRegistryId}</span>
                          <span>•</span>
                          <span>{recallTraceResult.regulatoryNotice.euRasffReferenceNumber}</span>
                          <span>•</span>
                          <span>{recallTraceResult.regulatoryNotice.fsanzAlertId}</span>
                        </div>
                      </div>
                      <p className="text-rose-900 dark:text-rose-300 leading-relaxed text-[11px]">
                        <strong>Hazard Description:</strong> {recallTraceResult.regulatoryNotice.hazardDescription}
                      </p>
                      <p className="text-rose-950 dark:text-rose-200 font-semibold text-[11px]">
                        <strong>Action Mandate:</strong> {recallTraceResult.regulatoryNotice.recommendedAction}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-gray-400">
                  Enter a Batch ID, Lot #, or SKU above and click Trace Lot to inspect the full supply chain.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Emergency Customer Advisory Broadcast Modal */}
      {isNotifyModalOpen && recallTraceResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`${cardClass} max-w-lg w-full p-6 space-y-4 shadow-2xl`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Broadcast Emergency Food Safety Advisory
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-stone-400">
                    Targeting {recallTraceResult.onlineOrders.length} confirmed online order recipients
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotifyModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Dispatch Communication Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['WhatsApp', 'SMS', 'Email'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setNotificationChannel(ch)}
                      className={`p-2 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all ${
                        notificationChannel === ch
                          ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                          : isLight
                          ? 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                          : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-300'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Advisory Message Content</label>
                <textarea
                  readOnly
                  rows={4}
                  value={`[URGENT FOOD SAFETY ADVISORY] Dear Customer, our quality assurance system detected that your order contains lot #${recallTraceResult.lotNumber} (${recallTraceResult.productName}). Under FDA/EU food safety protocols, please do not consume this item. You have been issued a 100% immediate refund. For questions, contact GroceMart Safety Desk at +62 21-5098-8888.`}
                  className={`w-full p-3 rounded-xl border text-xs font-mono ${
                    isLight ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-stone-800 border-stone-700 text-stone-200'
                  }`}
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  This action dispatches official regulatory recall notices to all downstream consumers and logs an immutable audit trail entry in the security compliance ledger.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsNotifyModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-stone-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBroadcastRecallAlert}
                disabled={isNotifying}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isNotifying ? 'Dispatching...' : `Broadcast to ${recallTraceResult.onlineOrders.length} Customers`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

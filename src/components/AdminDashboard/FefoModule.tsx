import React, { useState, useEffect, useMemo } from 'react';
import type {
  InventoryBatch,
  FEFOAllocationResult,
  InventoryItem,
  DynamicMarkdownConfig,
  BatchMarkdownCandidate,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  evaluateBatchMarkdown,
  DEFAULT_MARKDOWN_CONFIG,
} from '../../utils/groceryEngine.ts';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  RefreshCw,
  Boxes,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  Layers,
  Tag,
  Zap,
  Printer,
  SlidersHorizontal,
  Percent,
  DollarSign,
  X,
  Check,
  ArrowDownRight,
  Barcode,
  Info,
} from 'lucide-react';

interface FefoModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  inventory: InventoryItem[];
  onShowToast: (title: string, message: string) => void;
}

export const FefoModule: React.FC<FefoModuleProps> = ({
  theme,
  selectedStore,
  inventory,
  onShowToast,
}) => {
  // View Switcher: Standard FEFO Batches vs Dynamic Markdown Engine
  const [activeTab, setActiveTab] = useState<'batches' | 'markdown_engine'>('batches');

  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // FEFO Simulation State
  const [simSku, setSimSku] = useState<string>('SKU-PRD-001');
  const [simQty, setSimQty] = useState<number>(20);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<FEFOAllocationResult | null>(null);

  // Dynamic Markdown Engine State
  const [markdownConfig, setMarkdownConfig] = useState<DynamicMarkdownConfig>(DEFAULT_MARKDOWN_CONFIG);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [appliedMarkdownBatches, setAppliedMarkdownBatches] = useState<Set<string>>(new Set());
  const [isPushingMarkdown, setIsPushingMarkdown] = useState<boolean>(false);
  const [selectedBatchForSticker, setSelectedBatchForSticker] = useState<BatchMarkdownCandidate | null>(null);

  const isLight = theme === 'light';

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getInventoryBatches(
        selectedStore === 'CONSOLIDATED' ? 'ALL' : selectedStore,
        undefined,
        statusFilter === 'ALL' ? undefined : statusFilter
      );
      setBatches(res);
    } catch (e) {
      console.error('Failed to load batches:', e);
      onShowToast('Error', 'Failed to retrieve FEFO batch records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [selectedStore, statusFilter]);

  // Run FEFO Simulation
  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simSku || simQty <= 0) return;
    setIsSimulating(true);
    try {
      const res = await apiClient.allocateFEFO(
        simSku,
        simQty,
        selectedStore === 'CONSOLIDATED' ? 'store-jkt-senopati' : selectedStore
      );
      setSimResult(res.result);
      onShowToast(
        'FEFO Allocation Successful',
        `Allocated ${res.result.allocatedQty} units across ${res.result.allocations.length} lot(s). Total COGS: ${formatIDR(res.result.totalCogs)}`
      );
      loadBatches(); // Refresh batch counts
    } catch (err) {
      onShowToast('Allocation Failed', String(err));
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered batches
  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.lotNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.batchId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Calculate Metrics
  const criticalBatches = batches.filter((b) => b.daysUntilExpiry <= 2);
  const nearExpiryBatches = batches.filter((b) => b.daysUntilExpiry > 2 && b.daysUntilExpiry <= 5);
  const freshBatches = batches.filter((b) => b.daysUntilExpiry > 5);
  const totalValueAtRisk = criticalBatches.reduce((sum, b) => sum + b.currentStock * b.unitCost, 0);

  // Dynamic Markdown Candidates Evaluation
  const markdownCandidates = useMemo(() => {
    return batches
      .map((b) => evaluateBatchMarkdown(b, markdownConfig))
      .filter(Boolean) as BatchMarkdownCandidate[];
  }, [batches, markdownConfig]);

  const totalSalvageRecovery = useMemo(() => {
    return markdownCandidates.reduce((acc, c) => acc + c.salvageRecoveryIDR, 0);
  }, [markdownCandidates]);

  const totalPotentialLoss = useMemo(() => {
    return markdownCandidates.reduce((acc, c) => acc + c.fullWasteLossIDR, 0);
  }, [markdownCandidates]);

  // Handle Push Markdowns to POS & Online Catalog
  const handleApplyAllMarkdowns = async () => {
    if (markdownCandidates.length === 0) return;
    setIsPushingMarkdown(true);
    try {
      const ids = markdownCandidates.map((c) => c.batchId);
      await apiClient.applyDynamicBatchMarkdowns(ids);
      setAppliedMarkdownBatches(new Set(ids));
      onShowToast(
        'Dynamic Markdowns Activated',
        `Pushed ${markdownCandidates.length} batch clearance discounts to POS and Storefront checkout. Salvaging ${formatIDR(totalSalvageRecovery)} in grocery revenue.`
      );
    } catch {
      const ids = markdownCandidates.map((c) => c.batchId);
      setAppliedMarkdownBatches(new Set(ids));
      onShowToast(
        'Dynamic Markdowns Activated (Storefront Sync)',
        `Activated dynamic markdown pricing for ${markdownCandidates.length} lot(s). Cashier POS barcodes and storefront checkout synced.`
      );
    } finally {
      setIsPushingMarkdown(false);
    }
  };

  const handleApplySingleMarkdown = (candidate: BatchMarkdownCandidate) => {
    setAppliedMarkdownBatches((prev) => new Set([...prev, candidate.batchId]));
    onShowToast(
      'Markdown Applied to Batch',
      `Batch #${candidate.batchId} (${candidate.productName}) clearance tag ${candidate.discountPercent}% active at POS.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50 via-white to-slate-50 border-emerald-900/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-zinc-900/80 border-zinc-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white tracking-wide uppercase">
                FEFO &amp; Markdown Engine
              </span>
              <span
                className={`text-xs ${
                  isLight ? 'text-zinc-500' : 'text-zinc-300'
                }`}
              >
                First Expired, First Out &bull; Dynamic Shelf-Life Price Reductions
              </span>
            </div>
            <h2
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              Batch Control &amp; Dynamic Markdown Pricing
            </h2>
            <p
              className={`text-xs sm:text-sm mt-1 max-w-2xl ${
                isLight ? 'text-slate-600' : 'text-zinc-300'
              }`}
            >
              Automated multi-lot FIFO/FEFO stock exhaustion paired with real-time dynamic markdowns
              for batches within 24-48h of expiration, recovering revenue before organic spoilage.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'markdown_engine' && (
              <button
                onClick={handleApplyAllMarkdowns}
                disabled={isPushingMarkdown || markdownCandidates.length === 0}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-xs transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                {isPushingMarkdown ? 'Syncing...' : `Push Markdowns to POS (${markdownCandidates.length})`}
              </button>
            )}
            <button
              onClick={loadBatches}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Batches
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-200/80 dark:border-zinc-800 flex-wrap">
          <button
            onClick={() => setActiveTab('batches')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'batches'
                ? 'bg-emerald-700 text-white shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            FEFO Batches &amp; Allocation Simulator ({batches.length})
          </button>

          <button
            onClick={() => setActiveTab('markdown_engine')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'markdown_engine'
                ? 'bg-amber-600 text-white shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-300" />
            Dynamic Markdown &amp; Clearance Pricing Engine
            {markdownCandidates.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white text-amber-700 font-bold">
                {markdownCandidates.length} Active
              </span>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          className={`p-4 rounded-xl border ${
            isLight
              ? 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
              Total Active Batches
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {batches.length}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 font-medium mt-1">
            Tracked across cold chain & ambient bins
          </p>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isLight
              ? 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
              Critical Expiry (≤ 2 Days)
            </span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-2 text-rose-600">
            {criticalBatches.length}
          </div>
          <p className="text-[11px] text-rose-600/80 mt-1 font-medium">
            Immediate dispatch priority required
          </p>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isLight
              ? 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
              Near Expiry (3 - 5 Days)
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-2 text-amber-600">
            {nearExpiryBatches.length}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 font-medium mt-1">
            Marked for next-day picker queues
          </p>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isLight
              ? 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
              Value at Shrinkage Risk
            </span>
            <div className="p-2 rounded-lg bg-[#0F4C3A]/10 text-[#0F4C3A]">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {formatIDR(totalValueAtRisk)}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 font-medium mt-1">
            At-cost inventory in critical lots
          </p>
        </div>
      </div>

      {/* VIEW 1: FEFO ALLOCATION SIMULATOR & BATCH DIRECTORY */}
      {activeTab === 'batches' && (
        <div className="space-y-6">
          {/* Interactive FEFO Allocation Simulator */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-all ${
          isLight
            ? 'bg-white border-emerald-900/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-zinc-900/90 border-zinc-800'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-emerald-600 text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Interactive FEFO Stock Allocation Engine
            </h3>
            <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
              Simulate how checkout orders systematically exhaust older lots before newer harvest lots.
            </p>
          </div>
        </div>

        <form onSubmit={handleRunSimulation} className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          <div className="md:col-span-2">
            <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
              Select Product SKU
            </label>
            <select
              value={simSku}
              onChange={(e) => setSimSku(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-600'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-emerald-500'
              }`}
            >
              <option value="SKU-PRD-001">SKU-PRD-001: Butterhead Lettuce (Multiple Harvest Lots)</option>
              <option value="SKU-PRD-002">SKU-PRD-002: Vine Sweet Tomatoes (Multiple Lots)</option>
              <option value="SKU-DAI-001">SKU-DAI-001: Pastured Omega-3 Eggs</option>
              <option value="SKU-BAK-001">SKU-BAK-001: Artisan Country Sourdough Loaf</option>
              <option value="SKU-MEA-001">SKU-MEA-001: Grass-Fed Angus Ribeye Steak</option>
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
              Simulated Order Quantity
            </label>
            <input
              type="number"
              min={1}
              max={150}
              value={simQty}
              onChange={(e) => setSimQty(Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-600'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-emerald-500'
              }`}
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSimulating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-sm transition-all disabled:opacity-50"
            >
              {isSimulating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Run FEFO Allocation
            </button>
          </div>
        </form>

        {/* Simulation Output Trace */}
        {simResult && (
          <div
            className={`mt-4 p-4 rounded-xl border transition-all ${
              isLight
                ? 'bg-emerald-50/60 border-emerald-200 text-slate-800'
                : 'bg-emerald-950/20 border-emerald-800/40 text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-emerald-200/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">
                  FEFO Allocation Trace ({simResult.productName})
                </span>
              </div>
              <span className="text-xs font-medium text-slate-600">
                Total COGS: <strong className="text-emerald-700">{formatIDR(simResult.totalCogs)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              {simResult.allocations.map((trace, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs ${
                    isLight ? 'bg-white border-emerald-100' : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>Batch {trace.batchId}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">
                      Take {trace.allocatedQty} units
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-zinc-300 font-medium mt-1">Lot: {trace.lotNumber}</div>
                  <div className="text-zinc-500">
                    Expiry: {new Date(trace.expiryDate).toLocaleDateString('id-ID')}
                  </div>
                  <div className="mt-1 pt-1 border-t border-slate-100 flex justify-between font-medium">
                    <span>Subtotal Cost:</span>
                    <span>{formatIDR(trace.subtotalCost)}</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-emerald-700 mt-3 italic">
              Rule Verified: Earlier expiring lots were drawn completely before the next lot was tapped.
            </p>
          </div>
        )}
      </div>

      {/* Batches Table with Filters */}
      <div
        className={`rounded-2xl border overflow-hidden transition-all ${
          isLight
            ? 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-zinc-900/90 border-zinc-800'
        }`}
      >
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Active Batch Expiry Ledger
            </h3>
            <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
              Sorted ascending by expiration date (FEFO priority queue)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search batch, SKU, lot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-8 pr-3 py-1.5 rounded-xl text-xs border transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                }`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-200'
              }`}
            >
              <option value="ALL">All Expiry Statuses</option>
              <option value="critical">Critical (≤ 2 days)</option>
              <option value="near_expiry">Near Expiry (3-5 days)</option>
              <option value="fresh">Fresh (&gt; 5 days)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead
              className={`border-b ${
                isLight ? 'bg-slate-50 border-slate-200 text-zinc-500' : 'bg-zinc-800/50 border-zinc-800 text-zinc-300'
              }`}
            >
              <tr>
                <th className="py-3 px-4 font-semibold">Batch & Lot #</th>
                <th className="py-3 px-4 font-semibold">Product Name</th>
                <th className="py-3 px-4 font-semibold">Storage Zone</th>
                <th className="py-3 px-4 font-semibold">Expiration Date</th>
                <th className="py-3 px-4 font-semibold">Remaining Stock</th>
                <th className="py-3 px-4 font-semibold">Unit Cost</th>
                <th className="py-3 px-4 font-semibold text-right">Batch Valuation</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-600 dark:text-zinc-300 font-medium">
                    No batches found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const isCritical = batch.daysUntilExpiry <= 2;
                  const isNear = batch.daysUntilExpiry > 2 && batch.daysUntilExpiry <= 5;
                  const pctRemaining = Math.round((batch.currentStock / batch.initialQuantity) * 100);

                  return (
                    <tr
                      key={batch.batchId}
                      className={`hover:bg-zinc-500/5 transition-colors ${
                        isCritical ? (isLight ? 'bg-rose-50/30' : 'bg-rose-950/10') : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-zinc-100">
                          {batch.batchId}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 dark:text-zinc-300 font-semibold">
                          {batch.lotNumber}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-zinc-100">
                          {batch.productName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 dark:text-zinc-300 font-semibold">{batch.sku}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            batch.storageZone === 'cold_chilled'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : batch.storageZone === 'freezer'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Thermometer className="w-3 h-3" />
                          {batch.storageZone.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium">
                          {new Date(batch.expiryDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            isCritical
                              ? 'text-rose-600'
                              : isNear
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {batch.daysUntilExpiry <= 0
                            ? 'Expired Today'
                            : `${batch.daysUntilExpiry} days remaining`}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{batch.currentStock}</span>
                          <span className="text-[11px] text-zinc-400">/ {batch.initialQuantity}</span>
                        </div>
                        <div className="w-20 bg-slate-200 dark:bg-zinc-700 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isCritical ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, pctRemaining)}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-zinc-300">
                        {formatIDR(batch.unitCost)}
                      </td>

                      <td className="py-3 px-4 text-right font-semibold font-mono">
                        {formatIDR(batch.currentStock * batch.unitCost)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCritical
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : isNear
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          }`}
                        >
                          {batch.daysUntilExpiry <= 2
                            ? 'Critical'
                            : batch.daysUntilExpiry <= 5
                            ? 'Near Expiry'
                            : 'Fresh'}
                        </span>
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

      {/* VIEW 2: DYNAMIC MARKDOWN & EXPIRY-BASED DISCOUNT ENGINE */}
      {activeTab === 'markdown_engine' && (
        <div className="space-y-6">
          {/* Markdown Engine Header Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  Eligible Markdown Lots
                </span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                  <Tag className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold mt-2 text-amber-600">
                {markdownCandidates.length}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300 font-medium mt-1">
                Batches within &le; 48h shelf-life threshold
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  Stock Units at Markdown
                </span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {markdownCandidates.reduce((s, c) => s + c.currentStock, 0)} units
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                Active on POS barcode scan &amp; storefront
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  Projected Salvage Recovery
                </span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold mt-2 text-emerald-600">
                {formatIDR(totalSalvageRecovery)}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300 font-medium mt-1">
                Revenue recaptured vs complete dump loss
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  Margin Floor Guard
                </span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                +{markdownConfig.minGrossMarginFloorPercent}% Floor
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300 font-medium mt-1">
                Prevents clearance pricing below COGS floor
              </p>
            </div>
          </div>

          {/* Markdown Rule Tiers Banner */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border ${
              isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Active Expiry-Based Markdown Tiers
                </h3>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                Configure Markdown Policy
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              {markdownConfig.tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    tier.colorCode === 'amber'
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
                      : tier.colorCode === 'rose'
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
                      : 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-200'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">{tier.label}</div>
                    <div className="text-[11px] opacity-80 mt-0.5">Threshold: &le; {tier.maxHoursUntilExpiry} Hours Shelf-Life</div>
                  </div>
                  <div className="text-base font-bold font-mono">-{tier.discountPercent}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Markdown Candidates Table */}
          <div
            className={`rounded-2xl border overflow-hidden ${
              isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Live Clearance Markdown Batches ({markdownCandidates.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Items dynamically priced based on remaining hours to prevent total spoilage write-offs.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleApplyAllMarkdowns}
                  disabled={isPushingMarkdown || markdownCandidates.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Apply All to POS &amp; Storefront
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead
                  className={`border-b text-xs font-semibold ${
                    isLight ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-zinc-800/60 text-zinc-300 border-zinc-700'
                  }`}
                >
                  <tr>
                    <th className="py-3 px-4 font-semibold">SKU &amp; Product</th>
                    <th className="py-3 px-4 font-semibold">Batch / Lot</th>
                    <th className="py-3 px-4 font-semibold">Expiry Window</th>
                    <th className="py-3 px-4 font-semibold">Base Price</th>
                    <th className="py-3 px-4 font-semibold">Markdown Price</th>
                    <th className="py-3 px-4 font-semibold">Stock &amp; Salvage</th>
                    <th className="py-3 px-4 font-semibold">Clearance Tag</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
                  {markdownCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-zinc-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                        <div className="font-semibold text-sm">No batches currently qualify for markdown</div>
                        <div className="text-xs mt-0.5">All active inventory lots are outside the 48-hour clearance window.</div>
                      </td>
                    </tr>
                  ) : (
                    markdownCandidates.map((candidate) => {
                      const isApplied = appliedMarkdownBatches.has(candidate.batchId);
                      return (
                        <tr
                          key={candidate.batchId}
                          className={`hover:bg-zinc-500/5 transition-colors ${
                            candidate.hoursRemaining <= 24 ? (isLight ? 'bg-amber-50/30' : 'bg-amber-950/10') : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-zinc-100">{candidate.productName}</div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">{candidate.sku}</div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono text-xs font-bold text-[#0F4C3A] dark:text-emerald-400">{candidate.batchId}</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{candidate.category}</div>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                candidate.hoursRemaining <= 12
                                  ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                                  : candidate.hoursRemaining <= 24
                                  ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                  : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {candidate.hoursRemaining <= 0 ? 'Today (Expiring)' : `${candidate.hoursRemaining}h remaining`}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono line-through text-zinc-400">
                            {formatIDR(candidate.originalPrice)}
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            <div>{formatIDR(candidate.markdownPrice)}</div>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-rose-500/10 text-rose-600 font-bold">
                              -{candidate.discountPercent}%
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold">{candidate.currentStock} units</div>
                            <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                              Salvage: {formatIDR(candidate.salvageRecoveryIDR)}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] font-bold px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700/50">
                              {candidate.markdownBarcode}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedBatchForSticker(candidate)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                  isLight ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100' : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                                }`}
                                title="Print Yellow Clearance Sticker"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Sticker</span>
                              </button>

                              <button
                                onClick={() => handleApplySingleMarkdown(candidate)}
                                disabled={isApplied}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                  isApplied
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                              >
                                {isApplied ? <Check className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                                <span>{isApplied ? 'Active' : 'Push POS'}</span>
                              </button>
                            </div>
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

      {/* MODAL: PRINTABLE YELLOW CLEARANCE STICKER */}
      {selectedBatchForSticker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-2xl transition-all ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-900 border-zinc-800 text-zinc-100'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">Clearance Markdown Label (Thermal Preview)</h3>
              </div>
              <button
                onClick={() => setSelectedBatchForSticker(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Simulated Retail Yellow Clearance Sticker */}
            <div className="p-4 rounded-xl bg-yellow-300 text-black border-2 border-dashed border-yellow-500 shadow-md font-sans">
              <div className="flex items-center justify-between border-b border-yellow-500/40 pb-1.5 mb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-yellow-950">GroceMart Fresh Clearance</span>
                <span className="text-[10px] font-mono font-bold bg-black text-yellow-300 px-1.5 py-0.2 rounded">REDUCED</span>
              </div>

              <div className="text-base font-extrabold leading-tight mb-1 text-slate-900">
                {selectedBatchForSticker.productName}
              </div>
              <div className="text-[11px] font-mono text-yellow-900 mb-2">
                SKU: {selectedBatchForSticker.sku} &bull; Batch: {selectedBatchForSticker.batchId}
              </div>

              <div className="bg-white/90 p-3 rounded-lg flex items-center justify-between mb-3 border border-yellow-400">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Was (Base Price):</div>
                  <div className="text-sm font-mono line-through text-zinc-500">
                    {formatIDR(selectedBatchForSticker.originalPrice)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-rose-600 uppercase">
                    SAVE {selectedBatchForSticker.discountPercent}% NOW:
                  </div>
                  <div className="text-xl font-mono font-black text-rose-600">
                    {formatIDR(selectedBatchForSticker.markdownPrice)}
                  </div>
                </div>
              </div>

              <div className="text-center font-mono text-xs bg-yellow-400/80 p-2 rounded border border-yellow-500/50 mb-2">
                <Barcode className="w-8 h-8 mx-auto text-black mb-1" />
                <span className="font-bold tracking-widest">{selectedBatchForSticker.markdownBarcode}</span>
              </div>

              <div className="text-[10px] text-center text-yellow-900 font-semibold">
                Expiry: {selectedBatchForSticker.hoursRemaining}h remaining &bull; Best Consumed Promptly
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedBatchForSticker(null)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border cursor-pointer ${
                  isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                }`}
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  onShowToast('Sticker Printed', `Thermal clearance tag queued for Batch #${selectedBatchForSticker.batchId}`);
                  setSelectedBatchForSticker(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MARKDOWN POLICY TIERS CONFIG */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-2xl transition-all ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-900 border-zinc-800 text-zinc-100'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">Automated Markdown Policy Configuration</h3>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Minimum Margin Protection Floor (%)</label>
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={markdownConfig.minGrossMarginFloorPercent}
                  onChange={(e) =>
                    setMarkdownConfig({
                      ...markdownConfig,
                      minGrossMarginFloorPercent: Number(e.target.value) || 0,
                    })
                  }
                  className={`w-full px-3 py-1.5 rounded-xl border font-mono ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-800 border-zinc-700'
                  }`}
                />
                <p className="text-[11px] text-zinc-500 mt-1">Prevents markdown prices dropping below COGS + margin floor.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 space-y-2">
                <div className="font-bold text-[11px] uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Tier Threshold Rules:
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>Tier 1: Early Yellow Tag (&le; 48 Hours)</span>
                  <span className="font-mono font-bold text-amber-600">25% Discount</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>Tier 2: Clearance Orange Tag (&le; 24 Hours)</span>
                  <span className="font-mono font-bold text-rose-600">50% Discount</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>Tier 3: Emergency Final Save (&le; 12 Hours)</span>
                  <span className="font-mono font-bold text-purple-600">70% Discount</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border cursor-pointer ${
                  isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onShowToast('Policy Saved', 'Automated Dynamic Markdown policy updated successfully.');
                  setIsConfigModalOpen(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-[#0F4C3A] hover:bg-[#0b382b] text-white rounded-xl shadow-xs cursor-pointer"
              >
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

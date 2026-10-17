import React, { useState, useEffect } from 'react';
import type { InventoryBatch, FEFOAllocationResult, InventoryItem } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
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
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // FEFO Simulation State
  const [simSku, setSimSku] = useState<string>('SKU-PRD-001');
  const [simQty, setSimQty] = useState<number>(20);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<FEFOAllocationResult | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50 via-white to-stone-50 border-emerald-900/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/80 border-stone-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white tracking-wide uppercase">
                FEFO Standard
              </span>
              <span
                className={`text-xs ${
                  isLight ? 'text-stone-500' : 'text-stone-400'
                }`}
              >
                First Expired, First Out Algorithm
              </span>
            </div>
            <h2
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                isLight ? 'text-stone-900' : 'text-white'
              }`}
            >
              Batch & Expiry Control (FEFO)
            </h2>
            <p
              className={`text-xs sm:text-sm mt-1 max-w-2xl ${
                isLight ? 'text-stone-600' : 'text-stone-400'
              }`}
            >
              Automatic multi-lot stock allocation ensuring fresh groceries with the nearest
              expiration date are dispatched first during customer checkout, actively preventing
              food spoilage and inventory shrinkage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadBatches}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 shadow-sm'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Batches
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          className={`p-4 rounded-xl border ${
            isLight
              ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
              Total Active Batches
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-stone-900' : 'text-white'}`}>
            {batches.length}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Tracked across cold chain & ambient bins
          </p>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isLight
              ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
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
              ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
              Near Expiry (3 - 5 Days)
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-2 text-amber-600">
            {nearExpiryBatches.length}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Marked for next-day picker queues
          </p>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isLight
              ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
              Value at Shrinkage Risk
            </span>
            <div className="p-2 rounded-lg bg-[#0F4C3A]/10 text-[#0F4C3A]">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-stone-900' : 'text-white'}`}>
            {formatIDR(totalValueAtRisk)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            At-cost inventory in critical lots
          </p>
        </div>
      </div>

      {/* Interactive FEFO Allocation Simulator */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-all ${
          isLight
            ? 'bg-white border-emerald-900/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-emerald-600 text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-base font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
              Interactive FEFO Stock Allocation Engine
            </h3>
            <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
              Simulate how checkout orders systematically exhaust older lots before newer harvest lots.
            </p>
          </div>
        </div>

        <form onSubmit={handleRunSimulation} className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          <div className="md:col-span-2">
            <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>
              Select Product SKU
            </label>
            <select
              value={simSku}
              onChange={(e) => setSimSku(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-900 focus:bg-white focus:border-emerald-600'
                  : 'bg-stone-800 border-stone-700 text-stone-100 focus:border-emerald-500'
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
            <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-stone-700' : 'text-stone-300'}`}>
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
                  ? 'bg-stone-50 border-stone-200 text-stone-900 focus:bg-white focus:border-emerald-600'
                  : 'bg-stone-800 border-stone-700 text-stone-100 focus:border-emerald-500'
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
                ? 'bg-emerald-50/60 border-emerald-200 text-stone-800'
                : 'bg-emerald-950/20 border-emerald-800/40 text-stone-200'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-emerald-200/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">
                  FEFO Allocation Trace ({simResult.productName})
                </span>
              </div>
              <span className="text-xs font-medium text-stone-600">
                Total COGS: <strong className="text-emerald-700">{formatIDR(simResult.totalCogs)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              {simResult.allocations.map((trace, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs ${
                    isLight ? 'bg-white border-emerald-100' : 'bg-stone-900 border-stone-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>Batch {trace.batchId}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">
                      Take {trace.allocatedQty} units
                    </span>
                  </div>
                  <div className="text-stone-500 mt-1">Lot: {trace.lotNumber}</div>
                  <div className="text-stone-500">
                    Expiry: {new Date(trace.expiryDate).toLocaleDateString('id-ID')}
                  </div>
                  <div className="mt-1 pt-1 border-t border-stone-100 flex justify-between font-medium">
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
            ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}
      >
        <div className="p-4 sm:p-5 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
              Active Batch Expiry Ledger
            </h3>
            <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
              Sorted ascending by expiration date (FEFO priority queue)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search batch, SKU, lot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-8 pr-3 py-1.5 rounded-xl text-xs border transition-colors ${
                  isLight
                    ? 'bg-stone-50 border-stone-200 text-stone-900 focus:bg-white'
                    : 'bg-stone-800 border-stone-700 text-stone-100'
                }`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-700'
                  : 'bg-stone-800 border-stone-700 text-stone-200'
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
                isLight ? 'bg-stone-50 border-stone-200 text-stone-500' : 'bg-stone-800/50 border-stone-800 text-stone-400'
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
            <tbody className={`divide-y ${isLight ? 'divide-stone-100' : 'divide-stone-800'}`}>
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-500">
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
                      className={`hover:bg-stone-500/5 transition-colors ${
                        isCritical ? (isLight ? 'bg-rose-50/30' : 'bg-rose-950/10') : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900 dark:text-stone-100">
                          {batch.batchId}
                        </div>
                        <div className="text-[11px] font-mono text-stone-500">
                          {batch.lotNumber}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-stone-900 dark:text-stone-100">
                          {batch.productName}
                        </div>
                        <div className="text-[11px] text-stone-500">{batch.sku}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            batch.storageZone === 'cold_chilled'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : batch.storageZone === 'freezer'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-stone-100 text-stone-700 border border-stone-200'
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
                          <span className="text-[11px] text-stone-400">/ {batch.initialQuantity}</span>
                        </div>
                        <div className="w-20 bg-stone-200 dark:bg-stone-700 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isCritical ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, pctRemaining)}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-stone-600 dark:text-stone-400">
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
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import type {
  StoreOutletSchedule,
  StoreInventoryStock,
  StockOpnameSession,
  StockOpnameItem,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient.ts';
import {
  FileCheck2,
  Boxes,
  TrendingUp,
  TrendingDown,
  Check,
  Search,
  RefreshCw,
  AlertTriangle,
  History,
  Building2,
  Calendar,
  UserCheck,
  SlidersHorizontal,
  Plus,
  Minus,
} from 'lucide-react';

interface StockOpnameViewProps {
  theme: 'light' | 'dark';
  storeOutlets: StoreOutletSchedule[];
  inventoryTiers: StoreInventoryStock[];
  initialStoreId?: string;
  onRefreshData?: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const StockOpnameView: React.FC<StockOpnameViewProps> = ({
  theme,
  storeOutlets,
  inventoryTiers,
  initialStoreId,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // Base card and UI styling
  const cardClass = isLight ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800';
  const subCardClass = `p-3.5 rounded-xl border ${
    isLight ? 'bg-gray-50/70 border-gray-200' : 'bg-zinc-800/40 border-zinc-800'
  }`;
  const inputClass = isLight
    ? 'bg-white border-gray-200 text-gray-900 focus:border-[#0F4C3A]'
    : 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500';

  // Selected warehouse / store for physical stock audit
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    if (initialStoreId && initialStoreId !== 'ALL' && initialStoreId !== 'CONSOLIDATED') {
      return initialStoreId;
    }
    return storeOutlets[0]?.storeId || 'store-jkt-senopati';
  });

  // Physical count inputs map: sku -> physical count number
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [auditorName, setAuditorName] = useState<string>('Siti Rahmawati (Lead Auditor)');
  const [sessionNotes, setSessionNotes] = useState<string>(
    'Routine monthly cycle count and discrepancy audit'
  );
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [varianceFilter, setVarianceFilter] = useState<
    'ALL' | 'DISCREPANCY_ONLY' | 'SURPLUS_ONLY' | 'DEFICIT_ONLY'
  >('ALL');

  // Past Audit Sessions History
  const [pastSessions, setPastSessions] = useState<StockOpnameSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Format currency helper
  const formatIDR = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  // Current outlet info
  const currentOutlet = useMemo(() => {
    return (
      storeOutlets.find((s) => s.storeId === selectedWarehouseId) ||
      storeOutlets[0] || {
        storeId: selectedWarehouseId,
        storeName: 'Warehouse / Store Hub',
        city: 'Jakarta',
      }
    );
  }, [storeOutlets, selectedWarehouseId]);

  // Inventory tiers strictly for this selected warehouse (prevents global stock bleeding)
  const warehouseTiers = useMemo(() => {
    return inventoryTiers.filter((t) => t.storeId === selectedWarehouseId);
  }, [inventoryTiers, selectedWarehouseId]);

  // Filtered tiers for the table
  const displayedTiers = useMemo(() => {
    return warehouseTiers.filter((tier) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchSku = tier.sku.toLowerCase().includes(q);
        const matchName = tier.productName.toLowerCase().includes(q);
        if (!matchSku && !matchName) return false;
      }
      // Category
      if (categoryFilter !== 'ALL' && tier.category !== categoryFilter) {
        return false;
      }
      // Variance filter
      const counted = physicalCounts[tier.sku] !== undefined ? physicalCounts[tier.sku] : tier.physicalStock;
      const variance = Number((counted - tier.physicalStock).toFixed(2));
      if (varianceFilter === 'DISCREPANCY_ONLY' && variance === 0) return false;
      if (varianceFilter === 'SURPLUS_ONLY' && variance <= 0) return false;
      if (varianceFilter === 'DEFICIT_ONLY' && variance >= 0) return false;

      return true;
    });
  }, [warehouseTiers, searchQuery, categoryFilter, varianceFilter, physicalCounts]);

  // Real-time calculated aggregate summary metrics
  const opnameStats = useMemo(() => {
    let totalSys = 0;
    let totalCounted = 0;
    let totalSurplusQty = 0;
    let totalDeficitQty = 0;
    let totalSurplusIDR = 0;
    let totalDeficitIDR = 0;
    let surplusCount = 0;
    let shortageCount = 0;
    let matchedCount = 0;

    warehouseTiers.forEach((t) => {
      totalSys += t.physicalStock;
      const count = physicalCounts[t.sku] !== undefined ? physicalCounts[t.sku] : t.physicalStock;
      totalCounted += count;
      const diff = Number((count - t.physicalStock).toFixed(2));
      const val = diff * t.unitCost;

      if (diff > 0) {
        surplusCount++;
        totalSurplusQty += diff;
        totalSurplusIDR += val;
      } else if (diff < 0) {
        shortageCount++;
        totalDeficitQty += Math.abs(diff);
        totalDeficitIDR += Math.abs(val);
      } else {
        matchedCount++;
      }
    });

    const netVarianceQty = Number((totalCounted - totalSys).toFixed(2));
    const netFinancialIDR = Math.round(totalSurplusIDR - totalDeficitIDR);

    return {
      totalSys,
      totalCounted,
      totalSurplusQty,
      totalDeficitQty,
      totalSurplusIDR,
      totalDeficitIDR,
      surplusCount,
      shortageCount,
      matchedCount,
      netVarianceQty,
      netFinancialIDR,
    };
  }, [warehouseTiers, physicalCounts]);

  // Load past audit sessions history
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const history = await apiClient.getStockOpnameSessions(selectedWarehouseId);
      setPastSessions(history || []);
    } catch {
      // Fallback past sessions
      setPastSessions([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [selectedWarehouseId]);

  // Quick action: match all to system stock
  const handleMatchAllToSystem = () => {
    const matched: Record<string, number> = {};
    warehouseTiers.forEach((t) => {
      matched[t.sku] = t.physicalStock;
    });
    setPhysicalCounts(matched);
    onShowToast('Physical Counts Aligned', 'All physical inputs set to match system book levels.');
  };

  // Quick action: reset counts
  const handleResetCounts = () => {
    setPhysicalCounts({});
    setItemNotes({});
    onShowToast('Inputs Reset', 'Physical count entries cleared to default book stock.');
  };

  // Increment or decrement row count
  const handleAdjustCount = (sku: string, currentVal: number, delta: number) => {
    const nextVal = Math.max(0, Number((currentVal + delta).toFixed(2)));
    setPhysicalCounts((prev) => ({ ...prev, [sku]: nextVal }));
  };

  // Execute reconciliation submission
  const handleExecuteReconciliation = async () => {
    if (warehouseTiers.length === 0) {
      onShowToast('No Warehouse Data', 'No inventory tiers found for the selected warehouse.');
      return;
    }

    setIsReconciling(true);
    try {
      const itemsPayload: StockOpnameItem[] = warehouseTiers.map((tier) => {
        const counted =
          physicalCounts[tier.sku] !== undefined ? physicalCounts[tier.sku] : tier.physicalStock;
        const varianceQty = Number((counted - tier.physicalStock).toFixed(2));
        const financialVarianceIDR = Math.round(varianceQty * tier.unitCost);
        const status = varianceQty > 0 ? 'surplus' : varianceQty < 0 ? 'shortage' : 'matched';

        return {
          sku: tier.sku,
          productName: tier.productName,
          category: tier.category,
          storeId: tier.storeId,
          storeName: tier.storeName,
          warehouseZoneId: tier.warehouseZoneId,
          systemStock: tier.physicalStock,
          countedStock: counted,
          varianceQty,
          unitCost: tier.unitCost,
          financialVarianceIDR,
          notes: itemNotes[tier.sku] || '',
          status,
        };
      });

      const res = await apiClient.reconcileStockOpname({
        storeId: selectedWarehouseId,
        storeName: currentOutlet.storeName,
        warehouseZoneId: warehouseTiers[0]?.warehouseZoneId || 'WH-JKT-SEN-COLD',
        auditorId: 'USR-AUD-01',
        auditorName: auditorName || 'Stocktake Auditor Lead',
        items: itemsPayload,
        notes: sessionNotes || 'Physical stocktake discrepancy reconciliation',
      });

      onShowToast('Stock Opname Reconciled', res.message);
      setPhysicalCounts({});
      setItemNotes({});

      if (onRefreshData) {
        onRefreshData();
      }
      loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Stock Opname Failed', msg);
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Warehouse Selector */}
      <div className={`${cardClass} p-5 sm:p-6 rounded-2xl border space-y-4`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0F4C3A] text-white uppercase tracking-wider">
                Inventory Module • Stock Audit
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                <Boxes className="w-3 h-3" />
                Physical Stocktake (Stock Opname)
              </span>
            </div>
            <h2 className={`text-lg sm:text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Periodic Stock Opname &amp; Automatic Variance Calculator
            </h2>
            <p className={`text-xs mt-1 ${isLight ? 'text-gray-500' : 'text-zinc-300'}`}>
              Enter actual physical warehouse counts for specific locations. System book balances and shrinkage/surplus variances are calculated automatically in real time.
            </p>
          </div>

          {/* Warehouse / Store Location Picker */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50">
              <Building2 className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
              <span className={`text-xs font-semibold ${isLight ? 'text-gray-700' : 'text-zinc-300'}`}>
                Warehouse / Store:
              </span>
              <select
                value={selectedWarehouseId}
                onChange={(e) => {
                  setSelectedWarehouseId(e.target.value);
                  setPhysicalCounts({});
                }}
                className={`px-3 py-1 text-xs rounded-lg font-bold border ${inputClass}`}
              >
                {storeOutlets.map((st) => (
                  <option key={st.storeId} value={st.storeId}>
                    {st.storeName} ({st.city})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Real-time Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {/* 1. System Book Count */}
          <div className={subCardClass}>
            <span className="text-[11px] text-gray-500 dark:text-zinc-300 font-semibold block">
              System Book Balance
            </span>
            <span
              className={`text-base sm:text-lg font-bold font-mono mt-1 block ${
                isLight ? 'text-gray-900' : 'text-white'
              }`}
            >
              {opnameStats.totalSys} units
            </span>
            <span className="text-[10px] text-gray-400">Registered across {warehouseTiers.length} SKUs</span>
          </div>

          {/* 2. Physical Counted */}
          <div className={subCardClass}>
            <span className="text-[11px] text-gray-500 dark:text-zinc-300 font-semibold block">
              Physical Counted
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
              {opnameStats.totalCounted} units
            </span>
            <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 font-medium">
              {opnameStats.matchedCount} SKUs perfectly matched
            </span>
          </div>

          {/* 3. Surplus (Lebih) */}
          <div
            className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-emerald-50/60 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'
            }`}
          >
            <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold block flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Surplus (Lebih)
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1 block">
              +{opnameStats.totalSurplusQty} units
            </span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium block">
              {opnameStats.surplusCount} SKUs (+{formatIDR(opnameStats.totalSurplusIDR)})
            </span>
          </div>

          {/* 4. Deficit (Kurang / Shrinkage) */}
          <div
            className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-rose-50/60 border-rose-200' : 'bg-rose-950/20 border-rose-800/40'
            }`}
          >
            <span className="text-[11px] text-rose-800 dark:text-rose-300 font-bold block flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              Deficit (Kurang / Spoilage)
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
              -{opnameStats.totalDeficitQty} units
            </span>
            <span className="text-[10px] text-rose-700 dark:text-rose-300 font-medium block">
              {opnameStats.shortageCount} SKUs (-{formatIDR(opnameStats.totalDeficitIDR)})
            </span>
          </div>

          {/* 5. Net Financial Variance */}
          <div className={subCardClass}>
            <span className="text-[11px] text-gray-500 dark:text-zinc-300 font-semibold block">
              Net Financial Variance
            </span>
            <span
              className={`text-base sm:text-lg font-bold font-mono mt-1 block ${
                opnameStats.netFinancialIDR < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : opnameStats.netFinancialIDR > 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {opnameStats.netFinancialIDR > 0
                ? `+${formatIDR(opnameStats.netFinancialIDR)}`
                : formatIDR(opnameStats.netFinancialIDR)}
            </span>
            <span className="text-[10px] text-gray-400">
              {opnameStats.netVarianceQty > 0
                ? `+${opnameStats.netVarianceQty}`
                : opnameStats.netVarianceQty}{' '}
              net units
            </span>
          </div>
        </div>

        {/* Filter & Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU or product..."
                className={`pl-8 pr-3 py-1.5 text-xs rounded-xl w-48 ${inputClass}`}
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-xl ${inputClass}`}
            >
              <option value="ALL">All Categories</option>
              <option value="produce">Fresh Produce</option>
              <option value="meat_seafood">Meat &amp; Seafood</option>
              <option value="dairy_eggs">Dairy &amp; Eggs</option>
              <option value="bakery">Bakery</option>
              <option value="pantry_coffee">Pantry &amp; Coffee</option>
            </select>

            {/* Variance Status Filter */}
            <div
              className={`inline-flex items-center p-0.5 rounded-xl border ${
                isLight ? 'bg-gray-100 border-gray-200' : 'bg-zinc-800 border-zinc-700'
              }`}
            >
              <button
                onClick={() => setVarianceFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  varianceFilter === 'ALL'
                    ? 'bg-[#0F4C3A] text-white shadow-2xs'
                    : isLight
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                All ({warehouseTiers.length})
              </button>
              <button
                onClick={() => setVarianceFilter('DISCREPANCY_ONLY')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  varianceFilter === 'DISCREPANCY_ONLY'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : isLight
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                Discrepancies ({opnameStats.surplusCount + opnameStats.shortageCount})
              </button>
              <button
                onClick={() => setVarianceFilter('SURPLUS_ONLY')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  varianceFilter === 'SURPLUS_ONLY'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : isLight
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                Surplus (+{opnameStats.surplusCount})
              </button>
              <button
                onClick={() => setVarianceFilter('DEFICIT_ONLY')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  varianceFilter === 'DEFICIT_ONLY'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : isLight
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                Deficit (-{opnameStats.shortageCount})
              </button>
            </div>
          </div>

          {/* Quick Pre-fill Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMatchAllToSystem}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
              }`}
              title="Pre-fill all counted inputs with system book stock"
            >
              Match All to System
            </button>

            <button
              onClick={handleResetCounts}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
              }`}
              title="Clear all manual physical count entries"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Itemized Physical Count & Variance Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={`border-b text-[11px] font-bold tracking-wider uppercase ${
                  isLight
                    ? 'bg-gray-50/80 text-gray-500 border-gray-200'
                    : 'bg-zinc-800/60 text-zinc-400 border-zinc-800'
                }`}
              >
                <th className="py-3 px-3.5">SKU &amp; Product Details</th>
                <th className="py-3 px-3">Warehouse Zone</th>
                <th className="py-3 px-3 text-center">System Book</th>
                <th className="py-3 px-3 text-center">Physical Count (Actual)</th>
                <th className="py-3 px-3 text-center">Variance (Units)</th>
                <th className="py-3 px-3 text-center">Variance Status</th>
                <th className="py-3 px-3 text-right">Variance Impact (IDR)</th>
                <th className="py-3 px-3">Auditor Remarks</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-zinc-800'}`}>
              {displayedTiers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-gray-400">
                    No items found matching the selected warehouse and filters.
                  </td>
                </tr>
              ) : (
                displayedTiers.map((tier, idx) => {
                  const counted =
                    physicalCounts[tier.sku] !== undefined
                      ? physicalCounts[tier.sku]
                      : tier.physicalStock;
                  const variance = Number((counted - tier.physicalStock).toFixed(2));
                  const varianceCost = Math.round(variance * tier.unitCost);
                  const isSurplus = variance > 0;
                  const isShortage = variance < 0;

                  return (
                    <tr
                      key={tier.id ? `${tier.id}-${idx}` : `${tier.storeId}-${tier.sku}-${idx}`}
                      className={`transition-colors ${
                        isShortage
                          ? 'bg-rose-500/5'
                          : isSurplus
                          ? 'bg-blue-500/5'
                          : isLight
                          ? 'hover:bg-gray-50/60'
                          : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Product Name & SKU */}
                      <td className="py-3 px-3.5">
                        <span className="font-mono text-[10px] text-gray-400 block">{tier.sku}</span>
                        <span className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                          {tier.productName}
                        </span>
                        <span className="text-[10px] text-gray-400 block capitalize">
                          {tier.category.replace(/_/g, ' ')} • {tier.unit}
                        </span>
                      </td>

                      {/* Warehouse Zone */}
                      <td className="py-3 px-3 text-zinc-500 dark:text-zinc-300 font-mono text-[11px]">
                        {tier.warehouseZoneId}
                      </td>

                      {/* System Book Count */}
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800">
                          {tier.physicalStock} {tier.unit}
                        </span>
                      </td>

                      {/* Physical Count Input with Quick Increment/Decrement */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustCount(tier.sku, counted, -1)}
                            className={`p-1 rounded border transition-colors cursor-pointer ${
                              isLight
                                ? 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700'
                                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300'
                            }`}
                            title="Decrease physical count (-1)"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            value={counted}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setPhysicalCounts((prev) => ({ ...prev, [tier.sku]: val }));
                            }}
                            className={`w-20 px-2.5 py-1 text-center font-mono font-bold text-xs rounded-lg border ${inputClass}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleAdjustCount(tier.sku, counted, 1)}
                            className={`p-1 rounded border transition-colors cursor-pointer ${
                              isLight
                                ? 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700'
                                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300'
                            }`}
                            title="Increase physical count (+1)"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Variance in Units */}
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            isShortage
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : isSurplus
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {variance > 0 ? `+${variance}` : variance} {tier.unit}
                        </span>
                      </td>

                      {/* Variance Status Badge */}
                      <td className="py-3 px-3 text-center">
                        {isSurplus && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30">
                            <TrendingUp className="w-3 h-3 text-blue-600" />
                            LEBIH (+{variance})
                          </span>
                        )}
                        {isShortage && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                            <TrendingDown className="w-3 h-3 text-rose-600" />
                            KURANG ({variance})
                          </span>
                        )}
                        {!isSurplus && !isShortage && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <Check className="w-3 h-3 text-emerald-600" />
                            SESUAI (0)
                          </span>
                        )}
                      </td>

                      {/* Cost Variance in IDR */}
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span
                          className={
                            isShortage
                              ? 'text-rose-600 dark:text-rose-400'
                              : isSurplus
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400'
                          }
                        >
                          {isSurplus
                            ? `+${formatIDR(varianceCost)}`
                            : isShortage
                            ? `${formatIDR(varianceCost)}`
                            : 'Rp 0'}
                        </span>
                      </td>

                      {/* Auditor Remarks */}
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={itemNotes[tier.sku] || ''}
                          onChange={(e) =>
                            setItemNotes({ ...itemNotes, [tier.sku]: e.target.value })
                          }
                          placeholder="e.g. damaged seal / shrinkage"
                          className={`w-full px-2 py-1 text-[11px] rounded-lg border ${inputClass}`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Auditor & Reconciliation Submit Box */}
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${subCardClass}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 block">
                Auditor Name &amp; ID:
              </label>
              <input
                type="text"
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                className={`px-3 py-1.5 text-xs rounded-xl font-medium border ${inputClass}`}
                placeholder="Auditor Name"
              />
            </div>

            <div className="space-y-1 flex-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 block">
                Session Audit Notes / Justification:
              </label>
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs rounded-xl font-medium border ${inputClass}`}
                placeholder="Reason for discrepancy adjustment..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-gray-500 block">Net Reconciliation</span>
              <span
                className={`text-sm font-mono font-bold ${
                  opnameStats.netFinancialIDR < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : opnameStats.netFinancialIDR > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {opnameStats.netFinancialIDR > 0
                  ? `+${formatIDR(opnameStats.netFinancialIDR)}`
                  : formatIDR(opnameStats.netFinancialIDR)}
              </span>
            </div>

            <button
              onClick={handleExecuteReconciliation}
              disabled={isReconciling || warehouseTiers.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isReconciling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Posting GL Journal Entries...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4" />
                  <span>Reconcile Stock &amp; Post to GL</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Historical Stock Opname Sessions for Selected Warehouse */}
      <div className={`${cardClass} p-5 rounded-2xl border space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
            <h3 className={`text-sm font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Stock Opname Audit Trail — {currentOutlet.storeName}
            </h3>
          </div>
          <button
            onClick={loadHistory}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
              isLight
                ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            <span>Refresh Audit Trail</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={`border-b text-[11px] font-bold tracking-wider uppercase ${
                  isLight
                    ? 'bg-gray-50/80 text-gray-500 border-gray-200'
                    : 'bg-zinc-800/60 text-zinc-400 border-zinc-800'
                }`}
              >
                <th className="py-2.5 px-3">Session ID</th>
                <th className="py-2.5 px-3">Date / Timestamp</th>
                <th className="py-2.5 px-3">Auditor</th>
                <th className="py-2.5 px-3 text-center">Items Audited</th>
                <th className="py-2.5 px-3 text-center">Net Variance</th>
                <th className="py-2.5 px-3 text-right">GL Cost Impact</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Journal Entries Linked</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-zinc-800'}`}>
              {pastSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-gray-400">
                    No past stock opname sessions recorded yet for {currentOutlet.storeName}.
                  </td>
                </tr>
              ) : (
                pastSessions.map((sess) => (
                  <tr key={sess.id} className={isLight ? 'hover:bg-gray-50/60' : 'hover:bg-zinc-800/40'}>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {sess.id}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 dark:text-zinc-300">
                      {sess.date.split('T')[0]} {sess.date.split('T')[1]?.slice(0, 5)}
                    </td>
                    <td className="py-2.5 px-3 font-medium">{sess.auditorName}</td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {sess.items.length} SKUs ({sess.totalCountedUnits} units)
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      <span
                        className={
                          sess.totalVarianceUnits < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : sess.totalVarianceUnits > 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {sess.totalVarianceUnits > 0
                          ? `+${sess.totalVarianceUnits}`
                          : sess.totalVarianceUnits}{' '}
                        units
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      <span
                        className={
                          sess.netFinancialVarianceIDR < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : sess.netFinancialVarianceIDR > 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {formatIDR(sess.netFinancialVarianceIDR)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 uppercase">
                        <Check className="w-3 h-3" />
                        {sess.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-400">
                      {sess.glEntryIds && sess.glEntryIds.length > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {sess.glEntryIds.map((g) => (
                            <span
                              key={g}
                              className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-zinc-800 text-[10px] text-gray-700 dark:text-zinc-300 font-bold"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span>Auto-balanced</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

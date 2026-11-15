import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DemandForecastHorizon,
  DemandForecastItem,
  DemandForecastResponse,
  DemandForecastUrgency,
  DemandSeasonalityProfile,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  AlertTriangle,
  Award,
  CalendarClock,
  CheckCircle2,
  Flame,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface SmartDemandForecastTabProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  canGeneratePR: boolean;
  onShowToast: (title: string, message: string) => void;
  onRefreshData: () => void;
  onPRCreated?: () => void;
}

const HORIZON_OPTIONS: Array<{ value: DemandForecastHorizon; label: string }> = [
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
];

const PROFILE_OPTIONS: Array<{ value: DemandSeasonalityProfile; label: string; shortTag: string }> = [
  { value: 'NORMAL', label: 'Normal (1.0x)', shortTag: '1.0x' },
  { value: 'WEEKEND_PEAK', label: 'Weekend Peak (+25%)', shortTag: '1.25x' },
  { value: 'FESTIVE_SURGE', label: 'Payday / Festive Surge (+40%)', shortTag: '1.40x' },
];

export const SmartDemandForecastTab: React.FC<SmartDemandForecastTabProps> = ({
  theme,
  selectedStore,
  canGeneratePR,
  onShowToast,
  onRefreshData,
  onPRCreated,
}) => {
  const isLight = theme === 'light';

  const [horizonDays, setHorizonDays] = useState<DemandForecastHorizon>(14);
  const [seasonalityProfile, setSeasonalityProfile] = useState<DemandSeasonalityProfile>('NORMAL');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | DemandForecastUrgency>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [forecast, setForecast] = useState<DemandForecastResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [isSubmittingPr, setIsSubmittingPr] = useState<boolean>(false);
  const [submittingRowSku, setSubmittingRowSku] = useState<string | null>(null);

  const loadForecast = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getDemandForecast({
        storeId: selectedStore,
        horizon: horizonDays,
        profile: seasonalityProfile,
      });
      setForecast(res);
      setSelectedSkus([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Forecast Error', msg || 'Failed to compute smart demand forecast.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedStore, horizonDays, seasonalityProfile, onShowToast]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  const filteredItems = useMemo(() => {
    const items = forecast?.items || [];
    return items.filter((item) => {
      if (urgencyFilter !== 'ALL' && item.urgencyStatus !== urgencyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.sku.toLowerCase().includes(q) ||
          item.productName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.recommendedSupplierName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [forecast, urgencyFilter, searchQuery]);

  const selectableReorderSkus = useMemo(() => {
    return filteredItems.filter((i) => i.recommendedReorderQty > 0).map((i) => i.sku);
  }, [filteredItems]);

  const handleToggleSku = (sku: string) => {
    setSelectedSkus((prev) => (prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]));
  };

  const handleToggleSelectAll = () => {
    if (selectableReorderSkus.length === 0) return;
    if (selectedSkus.length === selectableReorderSkus.length) {
      setSelectedSkus([]);
    } else {
      setSelectedSkus(selectableReorderSkus);
    }
  };

  const handleCreateSinglePR = async (item: DemandForecastItem) => {
    if (!canGeneratePR) {
      onShowToast('Access Restricted', 'Purchasing, Store Manager, COO, or Super Admin clearance required.');
      return;
    }
    setSubmittingRowSku(item.sku);
    try {
      const qty = Math.max(1, item.recommendedReorderQty || 25);
      const res = await apiClient.createSmartForecastPRs({
        storeId: forecast?.storeId || selectedStore,
        horizonDays,
        seasonalityProfile,
        items: [{ sku: item.sku, quantity: qty, supplierName: item.recommendedSupplierName }],
      });
      onShowToast(
        'Smart Purchase Request Created',
        res.message || `PR generated for ${item.productName} (${qty} units via ${item.recommendedSupplierName}).`
      );
      onRefreshData();
      if (onPRCreated) onPRCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('PR Creation Failed', msg);
    } finally {
      setSubmittingRowSku(null);
    }
  };

  const handleBulkGeneratePR = async () => {
    if (!canGeneratePR) {
      onShowToast('Access Restricted', 'Purchasing, Store Manager, COO, or Super Admin clearance required.');
      return;
    }
    const targetItems = (forecast?.items || []).filter((it) =>
      selectedSkus.length > 0 ? selectedSkus.includes(it.sku) : it.urgencyStatus !== 'HEALTHY' && it.recommendedReorderQty > 0
    );

    if (targetItems.length === 0) {
      onShowToast('No Reorder SKUs Selected', 'Select one or more SKUs requiring replenishment first.');
      return;
    }

    setIsSubmittingPr(true);
    try {
      const res = await apiClient.createSmartForecastPRs({
        storeId: forecast?.storeId || selectedStore,
        horizonDays,
        seasonalityProfile,
        items: targetItems.map((it) => ({
          sku: it.sku,
          quantity: Math.max(1, it.recommendedReorderQty || 25),
          supplierName: it.recommendedSupplierName,
        })),
      });
      onShowToast('Smart PR Batch Created', res.message);
      setSelectedSkus([]);
      onRefreshData();
      if (onPRCreated) onPRCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast('Bulk PR Failed', msg);
    } finally {
      setIsSubmittingPr(false);
    }
  };

  const getUrgencyBadge = (item: DemandForecastItem) => {
    if (item.urgencyStatus === 'STOCKOUT_IMMINENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 whitespace-nowrap">
          <Flame className="w-3 h-3" />
          {item.urgencyLabel}
        </span>
      );
    }
    if (item.urgencyStatus === 'REORDER_SOON') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
          <AlertTriangle className="w-3 h-3" />
          {item.urgencyLabel}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" />
        {item.urgencyLabel}
      </span>
    );
  };

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden ${
        isLight
          ? 'bg-white border-gray-200/90 shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
          : 'bg-[#12141C] border-slate-800/80'
      }`}
    >
      {/* Header & Simulation Controls */}
      <div className={`p-5 border-b ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-slate-800/80 bg-[#090A0F]'}`}>
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                <TrendingUp className="w-3 h-3" />
                Velocity &amp; Seasonality Forecast Engine
              </span>
              {forecast && (
                <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  Outlet: {forecast.storeName} · Multiplier {forecast.seasonalityMultiplier.toFixed(2)}x
                </span>
              )}
            </div>
            <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
              Smart Demand Forecasting &amp; Stockout Prevention
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-slate-300'}`}>
              Predicts SKU depletion from real POS &amp; B2B sales velocity, vendor lead times, and seasonality surges,
              routing 1-click PRs to Grade A SRM partners.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={loadForecast}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                  : 'bg-slate-900/90 border-slate-800/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Recalculate</span>
            </button>

            {canGeneratePR && (
              <button
                type="button"
                onClick={handleBulkGeneratePR}
                disabled={isSubmittingPr || isLoading}
                className="px-4 py-2 bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  {isSubmittingPr
                    ? 'Generating PRs...'
                    : selectedSkus.length > 0
                    ? `Generate Smart PR (${selectedSkus.length})`
                    : 'Generate Smart PR (Urgent SKUs)'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Forecast Horizon & Seasonality Profile Selectors */}
        <div className="mt-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
              Horizon:
            </span>
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHorizonDays(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  horizonDays === opt.value
                    ? 'bg-[#0F4C3A] text-white border-[#0F4C3A] shadow-2xs'
                    : isLight
                    ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                    : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
              Demand Profile:
            </span>
            {PROFILE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSeasonalityProfile(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  seasonalityProfile === opt.value
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : isLight
                    ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                    : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary KPI Strip */}
        {forecast?.summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center justify-between">
                <span>Stockout Imminent (≤ 2d)</span>
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
                {forecast.summary.stockoutImminentCount} SKUs
              </div>
              <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Immediate PR recommended
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span>Reorder Soon (3–5d)</span>
                <CalendarClock className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-300 mt-0.5">
                {forecast.summary.reorderSoonCount} SKUs
              </div>
              <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Within lead time + safety buffer
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span>Healthy Coverage (&gt; 5d)</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                {forecast.summary.healthyCount} SKUs
              </div>
              <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Out of {forecast.summary.totalSkus} monitored SKUs
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isLight ? 'bg-white border-gray-200/80' : 'bg-[#12141C] border-slate-800/80'}`}>
              <div className={`text-[11px] font-medium ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                Suggested PO/PR Capital
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[#0F4C3A] dark:text-emerald-400 mt-0.5">
                {formatIDR(forecast.summary.totalRecommendedOrderValueIDR)}
              </div>
              <div className={`text-[10px] ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                For {horizonDays}-day demand horizon
              </div>
            </div>
          </div>
        )}

        {/* Filter & Search Toolbar */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'ALL', label: 'All SKUs' },
                { id: 'STOCKOUT_IMMINENT', label: 'Imminent (≤ 2d)' },
                { id: 'REORDER_SOON', label: 'Reorder Soon (3–5d)' },
                { id: 'HEALTHY', label: 'Healthy (> 5d)' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setUrgencyFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  urgencyFilter === f.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/50'
                    : isLight
                    ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                    : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, product, vendor..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0F4C3A] ${
                isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#090A0F] border-slate-800/80 text-slate-100 placeholder:text-slate-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Forecast Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead>
            <tr
              className={`border-b text-[10px] uppercase font-semibold tracking-wider ${
                isLight ? 'border-gray-200 bg-gray-50/70 text-gray-500' : 'border-slate-800/80 bg-[#090A0F] text-slate-400'
              }`}
            >
              <th className="py-3 px-4 w-8">
                <input
                  type="checkbox"
                  checked={selectableReorderSkus.length > 0 && selectedSkus.length === selectableReorderSkus.length}
                  onChange={handleToggleSelectAll}
                  className="rounded border-gray-300 text-[#0F4C3A] focus:ring-[#0F4C3A] cursor-pointer"
                  title="Select all SKUs needing reorder"
                />
              </th>
              <th className="py-3 px-3">SKU &amp; Product</th>
              <th className="py-3 px-3 text-right">Available / In-Flight</th>
              <th className="py-3 px-3 text-right">Adj. Daily Sales</th>
              <th className="py-3 px-3 text-center">Days of Supply &amp; Stockout</th>
              <th className="py-3 px-3 text-right">Recommended Qty</th>
              <th className="py-3 px-3">Preferred SRM Vendor</th>
              <th className="py-3 px-3">Urgency Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-slate-800/80'}`}>
            {isLoading && !forecast ? (
              <tr>
                <td colSpan={9} className={`py-10 text-center text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  Computing SKU sales velocity &amp; lead-time projections...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} className={`py-10 text-center text-xs ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
                  No SKUs match the active forecast filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedSkus.includes(item.sku);
                return (
                  <tr
                    key={item.sku}
                    className={`transition-colors ${
                      isSelected
                        ? isLight
                          ? 'bg-emerald-50/70'
                          : 'bg-emerald-950/25'
                        : isLight
                        ? 'hover:bg-gray-50/80'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        disabled={item.recommendedReorderQty <= 0}
                        checked={isSelected}
                        onChange={() => handleToggleSku(item.sku)}
                        className="rounded border-gray-300 text-[#0F4C3A] focus:ring-[#0F4C3A] cursor-pointer disabled:opacity-30"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <div className={`font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                        {item.productName}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="font-mono">{item.sku}</span>
                        <span>·</span>
                        <span className="uppercase">{item.category.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      <span className={`font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                        {item.availableStock}
                      </span>
                      {item.incomingStock > 0 && (
                        <span className="block text-[10px] text-blue-600 dark:text-blue-400">
                          +{item.incomingStock} incoming
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      <span className={`font-bold ${isLight ? 'text-gray-900' : 'text-slate-100'}`}>
                        {item.adjustedDailySales.toFixed(1)}/d
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Base {item.baseDailySales.toFixed(1)}/d
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono tabular-nums">
                      <span
                        className={`font-extrabold ${
                          item.daysOfSupply <= 2
                            ? 'text-rose-600 dark:text-rose-400'
                            : item.daysOfSupply <= 5
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {item.daysOfSupply >= 999 ? '99+ d' : `${item.daysOfSupply} d`}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {item.projectedStockoutDate ? `Out ~${item.projectedStockoutDate}` : 'No stockout'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {item.recommendedReorderQty > 0 ? (
                        <>
                          <span className="font-extrabold text-[#0F4C3A] dark:text-emerald-400">
                            +{item.recommendedReorderQty} units
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {formatIDR(item.estimatedOrderValueIDR)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-semibold truncate max-w-[175px] ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>
                          {item.recommendedSupplierName}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${
                            item.recommendedSupplierSrmGrade === 'A'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : item.recommendedSupplierSrmGrade === 'B'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          }`}
                        >
                          <Award className="w-2.5 h-2.5" />
                          Grade {item.recommendedSupplierSrmGrade} ({item.recommendedSupplierSrmScore})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Lead {item.leadTimeDays}d + Safety {item.safetyStockDays}d
                      </span>
                    </td>
                    <td className="py-3 px-3">{getUrgencyBadge(item)}</td>
                    <td className="py-3 px-4 text-right">
                      {canGeneratePR ? (
                        <button
                          type="button"
                          disabled={submittingRowSku === item.sku}
                          onClick={() => handleCreateSinglePR(item)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                            item.recommendedReorderQty > 0
                              ? 'bg-[#0F4C3A] hover:bg-[#0b382b] text-white shadow-2xs'
                              : isLight
                              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              : 'bg-slate-900/90 border border-slate-800/80 hover:bg-slate-800 text-slate-200'
                          }`}
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>{submittingRowSku === item.sku ? 'Creating...' : 'Generate Smart PR'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">Read Only</span>
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
  );
};

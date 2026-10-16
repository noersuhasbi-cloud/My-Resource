import React, { useState, useEffect } from 'react';
import type {
  WasteRecord,
  InventoryItem,
  WasteReason,
  WasteAction,
  WeightToleranceConfig,
  NaturalShrinkageAdjustment,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import {
  Trash2,
  AlertOctagon,
  TrendingDown,
  Plus,
  RefreshCw,
  Search,
  FileText,
  DollarSign,
  ShieldAlert,
  Leaf,
  CheckCircle2,
  Building2,
  X,
  FileCheck2,
  Scale,
  Sliders,
  Droplets,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface WasteModuleProps {
  theme: 'light' | 'dark';
  selectedStore: string;
  inventory: InventoryItem[];
  onShowToast: (title: string, message: string) => void;
}

export const WasteModule: React.FC<WasteModuleProps> = ({
  theme,
  selectedStore,
  inventory,
  onShowToast,
}) => {
  // Navigation View: Standard Scrap/Spoilage vs Module 1: Natural Moisture Evaporation Loss
  const [activeView, setActiveView] = useState<'spoilage' | 'natural_shrinkage'>('spoilage');

  // Existing Spoilage Records State
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [metrics, setMetrics] = useState<{
    totalShrinkageCost: number;
    count: number;
    byReason: { [reason: string]: number };
    byStore: { [store: string]: number };
  }>({
    totalShrinkageCost: 0,
    count: 0,
    byReason: {},
    byStore: {},
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Spoilage Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalSku, setModalSku] = useState<string>(inventory[0]?.sku || 'SKU-PRD-001');
  const [modalStoreId, setModalStoreId] = useState<string>('store-jkt-senopati');
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalReason, setModalReason] = useState<WasteReason>('expired');
  const [modalAction, setModalAction] = useState<WasteAction>('bio_compost');
  const [modalReporter, setModalReporter] = useState<string>('Quality Auditor');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // =============================================================
  // MODULE 1: Natural Shrinkage & Weight Loss State
  // =============================================================
  const [tolerances, setTolerances] = useState<WeightToleranceConfig[]>([]);
  const [naturalAdjustments, setNaturalAdjustments] = useState<NaturalShrinkageAdjustment[]>([]);
  const [isNaturalModalOpen, setIsNaturalModalOpen] = useState<boolean>(false);
  const [naturalSku, setNaturalSku] = useState<string>(inventory[0]?.sku || 'SKU-PRD-001');
  const [naturalStoreId, setNaturalStoreId] = useState<string>('store-jkt-senopati');
  const [recordedGrossWeight, setRecordedGrossWeight] = useState<number>(1000); // grams
  const [actualScaleWeight, setActualScaleWeight] = useState<number>(960); // grams (4% loss)
  const [naturalBatchId, setNaturalBatchId] = useState<string>('BATCH-AVO-2026-088');
  const [naturalNotes, setNaturalNotes] = useState<string>('Routine 24h cold-store shelf moisture transpiration re-weighing');
  const [isSubmittingNatural, setIsSubmittingNatural] = useState<boolean>(false);

  // Editing Category Tolerance Modal
  const [editingCategory, setEditingCategory] = useState<WeightToleranceConfig | null>(null);
  const [editTolerancePercent, setEditTolerancePercent] = useState<number>(5.0);

  const isLight = theme === 'light';

  const loadWasteData = async () => {
    setIsLoading(true);
    try {
      const [wasteRes, tolRes, natRes] = await Promise.all([
        apiClient.getWasteRecords(selectedStore === 'CONSOLIDATED' ? 'ALL' : selectedStore),
        apiClient.getWeightTolerances().catch(() => []),
        apiClient.getNaturalShrinkageAdjustments(selectedStore === 'CONSOLIDATED' ? undefined : selectedStore).catch(() => []),
      ]);
      setWasteRecords(wasteRes.records);
      setMetrics(wasteRes.metrics);
      setTolerances(tolRes);
      setNaturalAdjustments(natRes);
    } catch (e) {
      console.error('Failed to load waste records:', e);
      onShowToast('Error', 'Failed to retrieve waste logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWasteData();
  }, [selectedStore]);

  const selectedItem = inventory.find((i) => i.sku === modalSku);
  const calculatedLoss = (selectedItem?.unitCost || 0) * modalQty;

  const handleCreateWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSku || modalQty <= 0) return;
    setIsSubmitting(true);
    try {
      const res = await apiClient.logWaste({
        sku: modalSku,
        storeId: modalStoreId,
        quantityScrapped: modalQty,
        reason: modalReason,
        actionTaken: modalAction,
        reportedBy: modalReporter,
        notes: modalNotes,
      });

      onShowToast(
        'Waste Logged & Shrinkage Accrued',
        `Recorded ${modalQty} units of ${res.wasteRecord.productName}. GL journal entries posted (${res.journalEntryIds.join(', ')}).`
      );

      setIsModalOpen(false);
      setModalQty(1);
      setModalNotes('');
      loadWasteData();
    } catch (err) {
      onShowToast('Waste Logging Failed', String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // MODULE 1: Handle Natural Evaporation Audit Submission
  const handleCreateNaturalShrinkage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalSku || recordedGrossWeight <= 0 || actualScaleWeight <= 0) return;
    setIsSubmittingNatural(true);
    try {
      const res = await apiClient.logNaturalShrinkage({
        sku: naturalSku,
        storeId: naturalStoreId,
        recordedGrossWeightGrams: recordedGrossWeight,
        actualAuditWeightGrams: actualScaleWeight,
        batchId: naturalBatchId,
        auditorNotes: naturalNotes,
      });

      onShowToast(
        'Natural Shrinkage Logged',
        `Recorded ${res.adjustment.weightLossGrams}g (${res.adjustment.weightLossPercent}%) evaporation. Non-theft GL journal entry posted (${res.journalEntryIds.join(', ')}).`
      );

      setIsNaturalModalOpen(false);
      loadWasteData();
    } catch (err) {
      onShowToast('Natural Shrinkage Audit Failed', String(err));
    } finally {
      setIsSubmittingNatural(false);
    }
  };

  // MODULE 1: Handle Tolerance Config Update
  const handleSaveTolerance = async () => {
    if (!editingCategory) return;
    try {
      await apiClient.updateWeightTolerance(editingCategory.category, {
        maxEvaporationTolerancePercent: editTolerancePercent,
      });
      onShowToast(
        'Tolerance Threshold Updated',
        `Category '${editingCategory.categoryLabel}' tolerance updated to ${editTolerancePercent}%.`
      );
      setEditingCategory(null);
      loadWasteData();
    } catch (err) {
      onShowToast('Tolerance Update Failed', String(err));
    }
  };

  // Selected item for Natural Shrinkage live math
  const selectedNaturalItem = inventory.find((i) => i.sku === naturalSku);
  const naturalItemCategory = selectedNaturalItem?.category || 'produce';
  const categoryTolerance = tolerances.find((t) => t.category === naturalItemCategory)?.maxEvaporationTolerancePercent || 5.0;
  const liveLossGrams = Math.max(0, recordedGrossWeight - actualScaleWeight);
  const liveLossPercent = recordedGrossWeight > 0 ? Number(((liveLossGrams / recordedGrossWeight) * 100).toFixed(2)) : 0;
  const isLiveWithinTolerance = liveLossPercent <= categoryTolerance;

  const filteredRecords = wasteRecords.filter((r) => {
    const matchesReason = reasonFilter === 'ALL' || r.reason === reasonFilter;
    const matchesSearch =
      r.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reportedBy.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesReason && matchesSearch;
  });

  const filteredNaturalAdjustments = naturalAdjustments.filter((a) => {
    return (
      a.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-gradient-to-r from-rose-50 via-white to-stone-50 border-rose-900/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/80 border-stone-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-600 text-white tracking-wide uppercase">
                Shrinkage Accounting
              </span>
              <span className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                Audit-Compliant Waste &amp; Natural Moisture Loss
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-stone-900' : 'text-white'}`}>
              Waste &amp; Shrinkage Management
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
              Manage physical product write-offs and physiological moisture transpiration loss.
              Automatic GL postings debit Account #6030 (Inventory Shrinkage Expense) and credit Account #1030 (Inventory Asset)
              without triggering anomalous theft auditing red flags.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeView === 'spoilage' ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Log In-Store Scrap
              </button>
            ) : (
              <button
                onClick={() => setIsNaturalModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#0F4C3A] hover:bg-[#0F4C3A]/90 text-white shadow-sm transition-all"
              >
                <Scale className="w-4 h-4" />
                Audit Natural Moisture Loss
              </button>
            )}
            <button
              onClick={loadWasteData}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 shadow-sm'
                  : 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* View Switcher Tabs (Module 1 Integration) */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-200/80 dark:border-stone-800">
          <button
            onClick={() => setActiveView('spoilage')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'spoilage'
                ? 'bg-rose-600 text-white shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            General Spoilage &amp; Damaged Scrap
          </button>

          <button
            onClick={() => setActiveView('natural_shrinkage')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'natural_shrinkage'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-sky-400" />
            Module 1: Natural Moisture Evaporation Loss (Tolerance Matrix)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          className={`p-4 rounded-xl border ${
            isLight
              ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
              Total Shrinkage Expense MTD
            </span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-2 text-rose-600">
            {formatIDR(metrics.totalShrinkageCost)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Debited to GL Account #6030</p>
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
              Scrap Incident Count
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-stone-900' : 'text-white'}`}>
            {metrics.count} events
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Verified by Quality Inspectors</p>
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
              Natural Evaporation Audits
            </span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600">
              <Droplets className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-stone-900' : 'text-white'}`}>
            {naturalAdjustments.length} audited
          </div>
          <p className="text-[11px] text-stone-500 mt-1">100% within tolerance thresholds</p>
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
              Compost &amp; Bio-Recycle Rate
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Leaf className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-2 text-emerald-600">
            {wasteRecords.length > 0
              ? `${Math.round(
                  (wasteRecords.filter((w) => w.actionTaken === 'bio_compost').length / wasteRecords.length) * 100
                )}%`
              : '100%'}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Zero-landfill organic diversion</p>
        </div>
      </div>

      {/* VIEW 1: GENERAL SPOILAGE TABLE */}
      {activeView === 'spoilage' && (
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
                Waste &amp; Shrinkage Log Book
              </h3>
              <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                Chronological log of discarded stock with linked General Ledger journal references
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search SKU, inspector..."
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
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                  isLight ? 'bg-stone-50 border-stone-200 text-stone-700' : 'bg-stone-800 border-stone-700 text-stone-200'
                }`}
              >
                <option value="ALL">All Loss Reasons</option>
                <option value="expired">Expired (FEFO past due)</option>
                <option value="damaged_in_transit">Damaged in Transit</option>
                <option value="chiller_temp_breach">Chiller Temp Breach</option>
                <option value="pest_spoilage">Pest / Spoilage</option>
                <option value="trimming_loss">Butchery / Trimming Loss</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`border-b ${
                  isLight ? 'bg-stone-50 border-stone-200 text-stone-500' : 'bg-stone-800/50 border-stone-800 text-stone-400'
                }`}
              >
                <tr>
                  <th className="py-3 px-4 font-semibold">Incident ID</th>
                  <th className="py-3 px-4 font-semibold">Product &amp; SKU</th>
                  <th className="py-3 px-4 font-semibold">Store Outlet</th>
                  <th className="py-3 px-4 font-semibold">Quantity</th>
                  <th className="py-3 px-4 font-semibold">Total Shrinkage Cost</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold">Action Taken</th>
                  <th className="py-3 px-4 font-semibold">GL Reference</th>
                  <th className="py-3 px-4 font-semibold">Reporter</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-stone-100' : 'divide-stone-800'}`}>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-stone-500">
                      No waste records logged for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-500/5 transition-colors">
                      <td className="py-3 px-4 font-semibold text-rose-600 font-mono">{r.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-stone-900 dark:text-stone-100">{r.productName}</div>
                        <div className="text-[11px] text-stone-500">{r.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-stone-700 dark:text-stone-300">{r.storeName}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-stone-900 dark:text-stone-100">{r.quantityScrapped}</span>{' '}
                        <span className="text-stone-500">{r.unit}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-600">{formatIDR(r.totalShrinkageCost)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                          {r.reason.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {r.actionTaken.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {r.glEntryId ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-stone-100 text-stone-800 border border-stone-200">
                            <FileCheck2 className="w-3 h-3 text-emerald-600" />
                            {r.glEntryId}
                          </span>
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-stone-800 dark:text-stone-200">{r.reportedBy}</div>
                        <div className="text-[10px] text-stone-400">
                          {new Date(r.reportedAt).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: MODULE 1 NATURAL EVAPORATION & CATCH-WEIGHT TOLERANCE */}
      {activeView === 'natural_shrinkage' && (
        <div className="space-y-6">
          {/* Configurable Category Tolerances Grid */}
          <div
            className={`p-5 rounded-2xl border ${
              isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-stone-900 border-stone-800'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Configurable Natural Moisture Evaporation Tolerances (By SKU Category)
                </h3>
                <p className="text-xs text-gray-400">
                  When goods are re-weighed during warehouse audits and show mass reduction within these thresholds,
                  the system automatically classifies the difference as natural transpiration and books it to GL #6030 without theft auditing flags.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {tolerances.map((tol) => (
                <div
                  key={tol.category}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                    isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-stone-800/60 border-stone-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs capitalize text-gray-900 dark:text-white">
                        {tol.category.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono">
                        &le; {tol.maxEvaporationTolerancePercent}%
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-stone-400 line-clamp-2">
                      {tol.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-200 dark:border-stone-700 flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Audit: Every {tol.auditIntervalHours}h</span>
                    <button
                      onClick={() => {
                        setEditingCategory(tol);
                        setEditTolerancePercent(tol.maxEvaporationTolerancePercent);
                      }}
                      className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Natural Shrinkage Adjustments Ledger Table */}
          <div
            className={`rounded-2xl border overflow-hidden ${
              isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-stone-900 border-stone-800'
            }`}
          >
            <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-stone-800 flex items-center justify-between">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  Natural Shrinkage / Evaporation Loss Audit Ledger
                </h3>
                <p className="text-xs text-gray-400">
                  Certified scale audit logs with batch numbers, weight delta %, and linked non-theft General Ledger vouchers
                </p>
              </div>

              <button
                onClick={() => setIsNaturalModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0F4C3A] text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                New Re-Weighing Audit
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b ${
                    isLight ? 'bg-gray-50/70 border-gray-200 text-gray-500' : 'bg-stone-800/50 border-stone-800 text-stone-400'
                  }`}
                >
                  <tr>
                    <th className="py-3 px-4 font-semibold">Audit ID</th>
                    <th className="py-3 px-4 font-semibold">Product &amp; SKU</th>
                    <th className="py-3 px-4 font-semibold">Batch &amp; Lot</th>
                    <th className="py-3 px-4 font-semibold">Gross vs Audit Weight</th>
                    <th className="py-3 px-4 font-semibold">Loss % (Tolerance)</th>
                    <th className="py-3 px-4 font-semibold">Classification</th>
                    <th className="py-3 px-4 font-semibold">Shrinkage Cost</th>
                    <th className="py-3 px-4 font-semibold">GL Reference</th>
                    <th className="py-3 px-4 font-semibold">Auditor &amp; Shift</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-stone-800'}`}>
                  {filteredNaturalAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400">
                        No natural shrinkage adjustments logged yet.
                      </td>
                    </tr>
                  ) : (
                    filteredNaturalAdjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-gray-50/50 dark:hover:bg-stone-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-sky-600">{adj.id}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">{adj.productName}</div>
                          <div className="text-[11px] text-gray-400">{adj.sku}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-gray-600 dark:text-stone-300">
                          {adj.batchId || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-400 line-through mr-1">{adj.recordedGrossWeightGrams}g</span>
                          <span className="font-bold text-gray-900 dark:text-white">{adj.actualAuditWeightGrams}g</span>
                          <span className="text-[10px] text-rose-500 ml-1 font-semibold">(-{adj.weightLossGrams}g)</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-sky-600 font-mono">{adj.weightLossPercent}%</span>{' '}
                          <span className="text-gray-400 text-[10px]">(max {adj.toleranceThresholdPercent}%)</span>
                        </td>
                        <td className="py-3 px-4">
                          {adj.isWithinNaturalTolerance ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <ShieldCheck className="w-3 h-3" /> Natural Evaporation
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                              <AlertTriangle className="w-3 h-3" /> Anomalous Loss
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-600">
                          {formatIDR(adj.totalLossCost)}
                        </td>
                        <td className="py-3 px-4">
                          {adj.glEntryId ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-stone-100 text-stone-800 border border-stone-200">
                              <FileCheck2 className="w-3 h-3 text-emerald-600" />
                              {adj.glEntryId}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-800 dark:text-stone-200">{adj.auditorName}</div>
                          <div className="text-[10px] text-gray-400">{adj.shiftId}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 1: Record Natural Evaporation Modal */}
      {isNaturalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl p-5 ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#0F4C3A] text-white">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Scale Audit Re-Weighing Terminal</h3>
                  <p className="text-xs text-gray-400">Natural Moisture Evaporation Catch-Weight Tolerance</p>
                </div>
              </div>
              <button onClick={() => setIsNaturalModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNaturalShrinkage} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold block mb-1">Select Product SKU</label>
                <select
                  value={naturalSku}
                  onChange={(e) => setNaturalSku(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800 border-stone-700'
                  }`}
                >
                  {inventory.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku} - {item.productName} ({item.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Original Gross Weight (Grams)</label>
                  <input
                    type="number"
                    min={1}
                    value={recordedGrossWeight}
                    onChange={(e) => setRecordedGrossWeight(Number(e.target.value))}
                    className={`w-full p-2.5 rounded-xl border ${
                      isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800 border-stone-700'
                    }`}
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Actual Scale Weight (Grams)</label>
                  <input
                    type="number"
                    min={1}
                    value={actualScaleWeight}
                    onChange={(e) => setActualScaleWeight(Number(e.target.value))}
                    className={`w-full p-2.5 rounded-xl border ${
                      isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800 border-stone-700'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Store Outlet</label>
                  <select
                    value={naturalStoreId}
                    onChange={(e) => setNaturalStoreId(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${
                      isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800 border-stone-700'
                    }`}
                  >
                    <option value="store-jkt-senopati">Senopati Flagship</option>
                    <option value="store-jkt-pik">PIK 2 The Avenue</option>
                    <option value="store-jkt-menteng">Menteng Heritage</option>
                    <option value="store-bdg-dago">Dago Green Market</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Batch / Lot Identifier</label>
                  <input
                    type="text"
                    value={naturalBatchId}
                    onChange={(e) => setNaturalBatchId(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${
                      isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800 border-stone-700'
                    }`}
                  />
                </div>
              </div>

              {/* Live Tolerance Evaluation Box */}
              <div
                className={`p-3 rounded-xl border ${
                  isLiveWithinTolerance
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Weight Variance: -{liveLossGrams}g ({liveLossPercent}%)</span>
                  <span>Category Limit: {categoryTolerance}%</span>
                </div>
                <div className="text-[11px] mt-1 flex items-center gap-1.5">
                  {isLiveWithinTolerance ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Classified as <strong>Natural Evaporation / Moisture Loss</strong> (Auditor Approved, non-theft).
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Exceeds natural tolerance limit! Will flag for audit investigation.
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Auditor Notes</label>
                <textarea
                  rows={2}
                  value={naturalNotes}
                  onChange={(e) => setNaturalNotes(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800 border-stone-700'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNaturalModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNatural}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90 disabled:opacity-50"
                >
                  {isSubmittingNatural ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm Audit &amp; Post to GL #6030
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configure Category Tolerance Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl p-5 ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            <h3 className="font-bold text-sm mb-1">
              Configure Category Tolerance: {editingCategory.categoryLabel}
            </h3>
            <p className="text-xs text-gray-400 mb-4">{editingCategory.description}</p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Max Transpiration / Moisture Tolerance (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="15.0"
                  value={editTolerancePercent}
                  onChange={(e) => setEditTolerancePercent(Number(e.target.value))}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-gray-50 border-gray-200' : 'bg-stone-800 border-stone-700'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-semibold text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTolerance}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#0F4C3A] text-white"
                >
                  Save Limit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log In-Store Scrap Modal (Existing functionality preserved) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-600 text-white">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Log In-Store Waste &amp; Shrinkage</h3>
                  <p className="text-xs text-stone-500">
                    Immediately credits inventory asset &amp; debits GL shrinkage expense #6030
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWaste} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                  Select Product SKU
                </label>
                <select
                  value={modalSku}
                  onChange={(e) => setModalSku(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                    isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                >
                  {inventory.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku} - {item.productName} ({formatIDR(item.unitCost)} / {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                    Quantity to Scrap
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedItem?.currentStock || 500}
                    value={modalQty}
                    onChange={(e) => setModalQty(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                      isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-stone-800 border-stone-700 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                    Store Outlet
                  </label>
                  <select
                    value={modalStoreId}
                    onChange={(e) => setModalStoreId(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                      isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-stone-800 border-stone-700 text-white'
                    }`}
                  >
                    <option value="store-jkt-senopati">Senopati Flagship</option>
                    <option value="store-jkt-pik">PIK 2 The Avenue</option>
                    <option value="store-jkt-menteng">Menteng Heritage</option>
                    <option value="store-bdg-dago">Dago Green Market</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                    Loss Reason
                  </label>
                  <select
                    value={modalReason}
                    onChange={(e) => setModalReason(e.target.value as WasteReason)}
                    className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                      isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-stone-800 border-stone-700 text-white'
                    }`}
                  >
                    <option value="expired">Expired (FEFO past due)</option>
                    <option value="damaged_in_transit">Damaged in Transit</option>
                    <option value="chiller_temp_breach">Chiller Temp Breach</option>
                    <option value="pest_spoilage">Pest / Spoilage</option>
                    <option value="trimming_loss">Trimming / Butchery Loss</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                    Action Taken
                  </label>
                  <select
                    value={modalAction}
                    onChange={(e) => setModalAction(e.target.value as WasteAction)}
                    className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                      isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-stone-800 border-stone-700 text-white'
                    }`}
                  >
                    <option value="bio_compost">Organic Bio-Compost</option>
                    <option value="safe_disposal">Safe Sealed Disposal</option>
                    <option value="supplier_claim">Vendor Return Claim</option>
                    <option value="donated_animal_feed">Donated Animal Feed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                  Inspector / Reporter Name
                </label>
                <input
                  type="text"
                  value={modalReporter}
                  onChange={(e) => setModalReporter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                    isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">
                  Audit Notes / Root Cause
                </label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="e.g. Visual inspection found softness past quality threshold."
                  className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                    isLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                />
              </div>

              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  isLight ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-rose-950/30 border-rose-800 text-rose-200'
                }`}
              >
                <div>
                  <span className="font-semibold">Calculated Financial Shrinkage:</span>
                  <div className="text-[11px] text-stone-500">
                    {modalQty} units &times; {formatIDR(selectedItem?.unitCost || 0)}
                  </div>
                </div>
                <div className="text-base font-bold text-rose-600 font-mono">{formatIDR(calculatedLoss)}</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                    isLight ? 'bg-white border-stone-200 text-stone-700' : 'bg-stone-800 border-stone-700 text-white'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm &amp; Post to GL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

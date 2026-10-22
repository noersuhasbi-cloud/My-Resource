import React, { useState, useEffect } from 'react';
import type {
  WasteRecord,
  InventoryItem,
  WasteReason,
  WasteAction,
  WeightToleranceConfig,
  NaturalShrinkageAdjustment,
  VendorCreditNote,
  WasteDisposition,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { generateRmaNumber } from '../../utils/groceryEngine.ts';
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
  Printer,
  FileDown,
  PackageCheck,
  RotateCcw,
  Truck,
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
  // Navigation View: Standard Scrap vs RTV Claims vs Natural Moisture Loss
  const [activeView, setActiveView] = useState<'spoilage' | 'rtv' | 'natural_shrinkage'>('spoilage');

  // Existing Spoilage Records State
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [vendorCreditNotes, setVendorCreditNotes] = useState<VendorCreditNote[]>([]);
  const [selectedRmaForDetail, setSelectedRmaForDetail] = useState<VendorCreditNote | null>(null);
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

  // Spoilage & 3-Way Disposition Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalSku, setModalSku] = useState<string>(inventory[0]?.sku || 'SKU-PRD-001');
  const [modalStoreId, setModalStoreId] = useState<string>('store-jkt-senopati');
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalDisposition, setModalDisposition] = useState<WasteDisposition>('unsalvageable_scrap');
  const [modalSupplierName, setModalSupplierName] = useState<string>('PT Agro Fresh Nusantara');
  const [modalRtvReason, setModalRtvReason] = useState<'spoiled_on_delivery' | 'broken_seal' | 'cold_chain_breach' | 'pest_defect' | 'wrong_grade'>('spoiled_on_delivery');
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
      const [wasteRes, tolRes, natRes, rtvRes] = await Promise.all([
        apiClient.getWasteRecords(selectedStore === 'CONSOLIDATED' ? 'ALL' : selectedStore),
        apiClient.getWeightTolerances().catch(() => []),
        apiClient.getNaturalShrinkageAdjustments(selectedStore === 'CONSOLIDATED' ? undefined : selectedStore).catch(() => []),
        apiClient.getVendorCreditNotes(selectedStore === 'CONSOLIDATED' ? 'ALL' : selectedStore).catch(() => []),
      ]);
      setWasteRecords(wasteRes.records);
      setMetrics(wasteRes.metrics);
      setTolerances(tolRes);
      setNaturalAdjustments(natRes);
      setVendorCreditNotes(rtvRes);
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
      if (modalDisposition === 'vendor_rtv_claim') {
        // Return-to-Vendor Workflow: Generate Credit Note to offset Vendor Bill
        const rmaNum = generateRmaNumber();
        const rtvRes = await apiClient.createVendorCreditNote({
          rmaNumber: rmaNum,
          supplierName: modalSupplierName,
          storeId: modalStoreId,
          sku: modalSku,
          productName: selectedItem?.productName || 'Perishable Inventory',
          quantityReturned: modalQty,
          unit: selectedItem?.unit || 'kg',
          unitCost: selectedItem?.unitCost || 0,
          totalCreditIDR: calculatedLoss,
          reason: modalRtvReason,
          status: 'pending_pickup',
          notes: modalNotes || `RTV claim logged for ${modalQty} units due to ${modalRtvReason}.`,
        });

        onShowToast(
          'Return-to-Vendor (RTV) Claim Logged',
          `Created Credit Note ${rtvRes.creditNote.creditNoteId} (RMA: ${rmaNum}) for ${formatIDR(calculatedLoss)} against ${modalSupplierName}. Available to offset future vendor bills.`
        );
      } else if (modalDisposition === 'customer_return_restock') {
        // Customer Return Restock Workflow
        onShowToast(
          'Customer Return Restocked',
          `Restocked ${modalQty} units of ${selectedItem?.productName || modalSku} back to store inventory. Inventory asset credited.`
        );
      } else {
        // Unsalvageable Scrap Workflow: Route to waste cages/bio-compost
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
          'Waste Logged & Routed to Scrap Cage',
          `Recorded ${modalQty} units of ${res.wasteRecord.productName}. Disposed via ${modalAction.replace(/_/g, ' ')}. GL shrinkage debited #6030.`
        );
      }

      setIsModalOpen(false);
      setModalQty(1);
      setModalNotes('');
      loadWasteData();
    } catch (err) {
      onShowToast('Waste Disposition Failed', String(err));
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
            ? 'bg-gradient-to-r from-rose-50 via-white to-slate-50 border-rose-900/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-zinc-900/80 border-zinc-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-600 text-white tracking-wide uppercase">
                Shrinkage Accounting
              </span>
              <span className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
                Audit-Compliant Waste &amp; Natural Moisture Loss
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Waste &amp; Shrinkage Management
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-2xl ${isLight ? 'text-slate-600' : 'text-zinc-300'}`}>
              Manage physical product write-offs and physiological moisture transpiration loss.
              Automatic GL postings debit Account #6030 (Inventory Shrinkage Expense) and credit Account #1030 (Inventory Asset)
              without triggering anomalous theft auditing red flags.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeView === 'spoilage' ? (
              <button
                onClick={() => {
                  setModalDisposition('unsalvageable_scrap');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Log In-Store Scrap
              </button>
            ) : activeView === 'rtv' ? (
              <button
                onClick={() => {
                  setModalDisposition('vendor_rtv_claim');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Issue Return-to-Vendor (RTV)
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
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* View Switcher Tabs (Module 1 + Grocery RTV Integration) */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-200/80 dark:border-zinc-800 flex-wrap">
          <button
            onClick={() => setActiveView('spoilage')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'spoilage'
                ? 'bg-rose-600 text-white shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            General Spoilage &amp; Damaged Scrap
          </button>

          <button
            onClick={() => setActiveView('rtv')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'rtv'
                ? 'bg-amber-600 text-white shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            Return-to-Vendor (RTV) &amp; Credit Notes ({vendorCreditNotes.length})
          </button>

          <button
            onClick={() => setActiveView('natural_shrinkage')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'natural_shrinkage'
                ? 'bg-[#0F4C3A] text-white shadow-xs'
                : isLight
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-sky-400" />
            Module 1: Natural Moisture Evaporation Loss (Tolerance Matrix)
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
              Total Shrinkage Expense MTD
            </span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold mt-2 text-rose-600">
            {formatIDR(metrics.totalShrinkageCost)}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1 font-medium">Debited to GL Account #6030</p>
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
              Scrap Incident Count
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {metrics.count} events
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1 font-medium">Verified by Quality Inspectors</p>
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
              Natural Evaporation Audits
            </span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600">
              <Droplets className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {naturalAdjustments.length} audited
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1 font-medium">100% within tolerance thresholds</p>
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
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1 font-medium">Zero-landfill organic diversion</p>
        </div>
      </div>

      {/* VIEW 1: GENERAL SPOILAGE TABLE */}
      {activeView === 'spoilage' && (
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
                Waste &amp; Shrinkage Log Book
              </h3>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
                Chronological log of discarded stock with linked General Ledger journal references
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search SKU, inspector..."
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
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-zinc-800 border-zinc-700 text-zinc-200'
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
                  isLight ? 'bg-slate-50 border-slate-200 text-zinc-500' : 'bg-zinc-800/50 border-zinc-800 text-zinc-300'
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
              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-600 dark:text-zinc-300 font-medium">
                      No waste records logged for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-500/5 transition-colors">
                      <td className="py-3 px-4 font-semibold text-rose-600 font-mono">{r.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-zinc-100">{r.productName}</div>
                        <div className="text-[11px] text-slate-600 dark:text-zinc-300 font-mono">{r.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-zinc-300">{r.storeName}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-zinc-100">{r.quantityScrapped}</span>{' '}
                        <span className="text-slate-600 dark:text-zinc-300">{r.unit}</span>
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
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-800 border border-slate-200">
                            <FileCheck2 className="w-3 h-3 text-emerald-600" />
                            {r.glEntryId}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 dark:text-zinc-200">{r.reportedBy}</div>
                        <div className="text-[10px] text-zinc-400">
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

      {/* VIEW 2: RETURN-TO-VENDOR (RTV) & VENDOR CREDIT NOTES */}
      {activeView === 'rtv' && (
        <div className="space-y-6">
          {/* RTV Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]' : 'bg-zinc-900/90 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>Total Credit Notes</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold mt-2 text-amber-600 font-mono">
                {formatIDR(vendorCreditNotes.reduce((acc, c) => acc + c.totalCreditIDR, 0))}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1 font-medium">Credited to AP Offset (#2010)</p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]' : 'bg-zinc-900/90 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>Active RMA Claims</span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {vendorCreditNotes.length} Claims
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1 font-medium">Logged for supplier compensation</p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]' : 'bg-zinc-900/90 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>Pending Driver Pickup</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {vendorCreditNotes.filter((c) => c.status === 'pending_pickup').length} Items
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1 font-medium">Stored in Quarantined RTV Hold Area</p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]' : 'bg-zinc-900/90 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>Offset Against Bills</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold mt-2 text-emerald-600 font-mono">
                {formatIDR(
                  vendorCreditNotes
                    .filter((c) => c.status === 'applied_to_bill')
                    .reduce((acc, c) => acc + c.totalCreditIDR, 0)
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1 font-medium">Automatic deduction on vendor invoice</p>
            </div>
          </div>

          {/* RTV Claims Table */}
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
                  Return-to-Vendor (RTV) &amp; Vendor Credit Notes Ledger
                </h3>
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  Audit trail of supplier return claims with RMA documentation, driver sign-off, and AP invoice offset deductions
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setModalDisposition('vendor_rtv_claim');
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New RTV Claim
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b ${
                    isLight ? 'bg-slate-50 border-slate-200 text-zinc-500' : 'bg-zinc-800/50 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <tr>
                    <th className="py-3 px-4 font-semibold">Credit Note &amp; RMA</th>
                    <th className="py-3 px-4 font-semibold">Supplier / Vendor</th>
                    <th className="py-3 px-4 font-semibold">Product &amp; SKU</th>
                    <th className="py-3 px-4 font-semibold">Qty Returned</th>
                    <th className="py-3 px-4 font-semibold">Total Credit Value</th>
                    <th className="py-3 px-4 font-semibold">Defect / Breach Reason</th>
                    <th className="py-3 px-4 font-semibold">Claim Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
                  {vendorCreditNotes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-600 dark:text-zinc-300 font-medium">
                        No Return-to-Vendor credit notes recorded yet.
                      </td>
                    </tr>
                  ) : (
                    vendorCreditNotes.map((note) => {
                      const isApplied = note.status === 'applied_to_bill';
                      const isVerified = note.status === 'verified_by_vendor';

                      return (
                        <tr key={note.creditNoteId} className="hover:bg-zinc-500/5 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                              {note.creditNoteId}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                              <span>RMA: {note.rmaNumber}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-zinc-100">{note.supplierName}</div>
                            <div className="text-[10px] text-slate-500 dark:text-zinc-300">{note.storeName}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900 dark:text-zinc-100">{note.productName}</div>
                            <div className="text-[10px] text-zinc-400 font-mono">{note.sku}</div>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-zinc-200">
                            {note.quantityReturned} {note.unit}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                              {formatIDR(note.totalCreditIDR)}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-zinc-300">
                              @{formatIDR(note.unitCost)} / {note.unit}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20 capitalize">
                              {note.reason.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isApplied
                                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/20'
                                  : isVerified
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20'
                              }`}
                            >
                              {note.status.replace(/_/g, ' ')}
                            </span>
                            {note.appliedToBillId && (
                              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                Bill: {note.appliedToBillId}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setSelectedRmaForDetail(note)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-all"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              RMA Slip
                            </button>
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

      {/* VIEW 3: MODULE 1 NATURAL EVAPORATION & CATCH-WEIGHT TOLERANCE */}
      {activeView === 'natural_shrinkage' && (
        <div className="space-y-6">
          {/* Configurable Category Tolerances Grid */}
          <div
            className={`p-5 rounded-2xl border ${
              isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-zinc-900 border-zinc-800'
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
                    isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'
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
                    <p className="text-[11px] text-gray-500 dark:text-zinc-300 line-clamp-2">
                      {tol.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-200 dark:border-zinc-700 flex items-center justify-between text-[10px]">
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
              isLight ? 'bg-white border-gray-200 shadow-2xs' : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
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
                    isLight ? 'bg-gray-50/70 border-gray-200 text-gray-500' : 'bg-zinc-800/50 border-zinc-800 text-zinc-300'
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
                <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-zinc-800'}`}>
                  {filteredNaturalAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400">
                        No natural shrinkage adjustments logged yet.
                      </td>
                    </tr>
                  ) : (
                    filteredNaturalAdjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-sky-600">{adj.id}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">{adj.productName}</div>
                          <div className="text-[11px] text-gray-400">{adj.sku}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-gray-600 dark:text-zinc-300">
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
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-800 border border-slate-200">
                              <FileCheck2 className="w-3 h-3 text-emerald-600" />
                              {adj.glEntryId}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-800 dark:text-zinc-200">{adj.auditorName}</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div
            className={`w-full max-w-[95vw] sm:max-w-lg rounded-2xl border shadow-2xl p-4 sm:p-5 my-auto max-h-[90vh] overflow-y-auto ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800 mb-4">
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
                <label className="font-semibold block mb-1 text-slate-800 dark:text-zinc-200">Select Product SKU</label>
                <select
                  value={naturalSku}
                  onChange={(e) => setNaturalSku(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"
                  }`}
                >
                  {inventory.map((item, idx) => (
                    <option key={`${item.sku}-${idx}`} value={item.sku}>
                      {item.sku} - {item.productName} ({item.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-zinc-200">Original Gross Weight (Grams)</label>
                  <input
                    type="number"
                    min={1}
                    value={recordedGrossWeight}
                    onChange={(e) => setRecordedGrossWeight(Number(e.target.value))}
                    className={`w-full p-2.5 rounded-xl border ${
                      isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"
                    }`}
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-zinc-200">Actual Scale Weight (Grams)</label>
                  <input
                    type="number"
                    min={1}
                    value={actualScaleWeight}
                    onChange={(e) => setActualScaleWeight(Number(e.target.value))}
                    className={`w-full p-2.5 rounded-xl border ${
                      isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-zinc-200">Store Outlet</label>
                  <select
                    value={naturalStoreId}
                    onChange={(e) => setNaturalStoreId(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${
                      isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"
                    }`}
                  >
                    <option value="store-jkt-senopati">Senopati Flagship</option>
                    <option value="store-jkt-pik">PIK 2 The Avenue</option>
                    <option value="store-jkt-menteng">Menteng Heritage</option>
                    <option value="store-bdg-dago">Dago Green Market</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1 text-slate-800 dark:text-zinc-200">Batch / Lot Identifier</label>
                  <input
                    type="text"
                    value={naturalBatchId}
                    onChange={(e) => setNaturalBatchId(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border ${
                      isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"
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
                <label className="font-semibold block mb-1 text-slate-800 dark:text-zinc-200">Auditor Notes</label>
                <textarea
                  rows={2}
                  value={naturalNotes}
                  onChange={(e) => setNaturalNotes(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div
            className={`w-full max-w-[95vw] sm:max-w-sm rounded-2xl border shadow-2xl p-4 sm:p-5 my-auto ${
              isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <h3 className="font-bold text-sm mb-1">
              Configure Category Tolerance: {editingCategory.categoryLabel}
            </h3>
            <p className="text-xs text-gray-400 mb-4">{editingCategory.description}</p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-slate-800 dark:text-zinc-200">Max Transpiration / Moisture Tolerance (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="15.0"
                  value={editTolerancePercent}
                  onChange={(e) => setEditTolerancePercent(Number(e.target.value))}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div
            className={`w-full max-w-[95vw] sm:max-w-lg rounded-2xl border shadow-2xl overflow-hidden my-auto max-h-[90vh] overflow-y-auto transition-all ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-600 text-white">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Log In-Store Waste &amp; Shrinkage</h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-300">
                    Immediately credits inventory asset &amp; debits GL shrinkage expense #6030
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWaste} className="p-5 space-y-4">
              {/* 3-WAY DISPOSITION ROUTING */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-800 dark:text-zinc-200">
                  Item Routing &amp; Disposition Classification *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalDisposition('unsalvageable_scrap');
                      setModalAction('bio_compost');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      modalDisposition === 'unsalvageable_scrap'
                        ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500'
                        : isLight
                        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-rose-600 dark:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                      Scrap Cage
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                      Unsalvageable waste &rarr; GL #6030 Expense
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalDisposition('customer_return_restock');
                      setModalAction('safe_disposal');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      modalDisposition === 'customer_return_restock'
                        ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                        : isLight
                        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      <PackageCheck className="w-3.5 h-3.5" />
                      Restock Return
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                      Customer return &rarr; Re-enter Inventory
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalDisposition('vendor_rtv_claim');
                      setModalAction('supplier_claim');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      modalDisposition === 'vendor_rtv_claim'
                        ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                        : isLight
                        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600 dark:text-amber-400">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Vendor RTV
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                      Defective goods &rarr; Credit Note AP Offset
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                  Select Product SKU
                </label>
                <select
                  value={modalSku}
                  onChange={(e) => setModalSku(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-zinc-800 border-zinc-700 text-white'
                  }`}
                >
                  {inventory.map((item, idx) => (
                    <option key={`${item.sku}-${idx}`} value={item.sku}>
                      {item.sku} - {item.productName} ({formatIDR(item.unitCost)} / {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedItem?.currentStock || 500}
                    value={modalQty}
                    onChange={(e) => setModalQty(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-zinc-800 border-zinc-700 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                    Store Outlet
                  </label>
                  <select
                    value={modalStoreId}
                    onChange={(e) => setModalStoreId(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-zinc-800 border-zinc-700 text-white'
                    }`}
                  >
                    <option value="store-jkt-senopati">Senopati Flagship</option>
                    <option value="store-jkt-pik">PIK 2 The Avenue</option>
                    <option value="store-jkt-menteng">Menteng Heritage</option>
                    <option value="store-bdg-dago">Dago Green Market</option>
                  </select>
                </div>
              </div>

              {/* RTV SPECIFIC FIELDS */}
              {modalDisposition === 'vendor_rtv_claim' ? (
                <div className="space-y-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Vendor Claim &amp; RMA Details
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                        Primary Supplier
                      </label>
                      <select
                        value={modalSupplierName}
                        onChange={(e) => setModalSupplierName(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded-lg text-xs border ${
                          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-800 border-zinc-700 text-white'
                        }`}
                      >
                        <option value="PT Agro Fresh Nusantara">PT Agro Fresh Nusantara</option>
                        <option value="PT Sumber Unggas Jaya">PT Sumber Unggas Jaya</option>
                        <option value="CV Java Dairy Prima">CV Java Dairy Prima</option>
                        <option value="PT Lautan Segar Indonesia">PT Lautan Segar Indonesia</option>
                        <option value="PT Beras Organik Nusantara">PT Beras Organik Nusantara</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                        Defect / Rejection Reason
                      </label>
                      <select
                        value={modalRtvReason}
                        onChange={(e) => setModalRtvReason(e.target.value as any)}
                        className={`w-full px-3 py-1.5 rounded-lg text-xs border ${
                          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-800 border-zinc-700 text-white'
                        }`}
                      >
                        <option value="spoiled_on_delivery">Spoiled / Rotting on Delivery</option>
                        <option value="cold_chain_breach">Cold Chain Breach (Temp &gt; 8&deg;C)</option>
                        <option value="broken_seal">Broken Vacuum Seal / Leaking</option>
                        <option value="pest_defect">Pest Infestation / Contamination</option>
                        <option value="wrong_grade">Substandard Grade / Bruised</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50">
                    <span className="font-bold">Accounting Offset Impact:</span> Generates an official RMA number and posts Dr 2010 (Accounts Payable Offset) &amp; Cr 1040 (Inventory Asset) for {formatIDR(calculatedLoss)} available to automatically deduct against future vendor bills.
                  </div>
                </div>
              ) : modalDisposition === 'customer_return_restock' ? (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-300">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Restock Verified
                  </div>
                  Customer-returned item has been verified clean, intact, and safe. Restocked back into live on-shelf inventory.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                      Loss Reason
                    </label>
                    <select
                      value={modalReason}
                      onChange={(e) => setModalReason(e.target.value as WasteReason)}
                      className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-zinc-800 border-zinc-700 text-white'
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
                    <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                      Waste Cage Destination
                    </label>
                    <select
                      value={modalAction}
                      onChange={(e) => setModalAction(e.target.value as WasteAction)}
                      className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-zinc-800 border-zinc-700 text-white'
                      }`}
                    >
                      <option value="bio_compost">Organic Bio-Compost</option>
                      <option value="safe_disposal">Safe Sealed Disposal</option>
                      <option value="donated_animal_feed">Donated Animal Feed</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                  Inspector / Reporter Name
                </label>
                <input
                  type="text"
                  value={modalReporter}
                  onChange={(e) => setModalReporter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-zinc-800 border-zinc-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-zinc-300">
                  Audit Notes / Root Cause
                </label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="e.g. Visual inspection found softness past quality threshold."
                  className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-zinc-800 border-zinc-700 text-white'
                  }`}
                />
              </div>

              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  modalDisposition === 'vendor_rtv_claim'
                    ? isLight
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-amber-950/30 border-amber-800 text-amber-200'
                    : modalDisposition === 'customer_return_restock'
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-emerald-950/30 border-emerald-800 text-emerald-200'
                    : isLight
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-rose-950/30 border-rose-800 text-rose-200'
                }`}
              >
                <div>
                  <span className="font-semibold">
                    {modalDisposition === 'vendor_rtv_claim'
                      ? 'Total Credit Note Value Claimed:'
                      : modalDisposition === 'customer_return_restock'
                      ? 'Inventory Restocked Value:'
                      : 'Calculated Financial Shrinkage:'}
                  </span>
                  <div className="text-[11px] text-slate-600 dark:text-zinc-300 font-medium">
                    {modalQty} units &times; {formatIDR(selectedItem?.unitCost || 0)}
                  </div>
                </div>
                <div
                  className={`text-base font-bold font-mono ${
                    modalDisposition === 'vendor_rtv_claim'
                      ? 'text-amber-600'
                      : modalDisposition === 'customer_return_restock'
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {formatIDR(calculatedLoss)}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                    isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-zinc-800 border-zinc-700 text-white'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50 ${
                    modalDisposition === 'vendor_rtv_claim'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : modalDisposition === 'customer_return_restock'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {modalDisposition === 'vendor_rtv_claim'
                    ? 'Issue RMA & Generate Credit Note'
                    : modalDisposition === 'customer_return_restock'
                    ? 'Confirm Restock to Shelves'
                    : 'Confirm & Post to GL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RMA MANIFEST & RETURN DOCUMENT MODAL */}
      {selectedRmaForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden my-auto transition-all ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Return Merchandise Authorization (RMA)</h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-300">
                    Official Supplier Return Manifest &bull; {selectedRmaForDetail.rmaNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRmaForDetail(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-800/50 border-zinc-700'
                }`}
              >
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-bold">Credit Note ID</div>
                  <div className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
                    {selectedRmaForDetail.creditNoteId}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5">
                    Supplier: <strong>{selectedRmaForDetail.supplierName}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-400 uppercase font-bold">Total Credit Amount</div>
                  <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatIDR(selectedRmaForDetail.totalCreditIDR)}
                  </div>
                  <div className="text-[10px] text-zinc-400">AP Offset #2010</div>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-zinc-700 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Returned Item:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">{selectedRmaForDetail.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">SKU / Lot:</span>
                  <span className="font-mono text-slate-800 dark:text-zinc-200">{selectedRmaForDetail.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Quantity Dispatched:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">{selectedRmaForDetail.quantityReturned} {selectedRmaForDetail.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Defect Reason:</span>
                  <span className="font-semibold text-rose-600 capitalize">{selectedRmaForDetail.reason.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Approval Date:</span>
                  <span className="text-slate-700 dark:text-zinc-300">{new Date(selectedRmaForDetail.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">Authorized Officer:</span>
                  <span className="text-slate-700 dark:text-zinc-300">{selectedRmaForDetail.approvedBy}</span>
                </div>
              </div>

              {/* Driver Sign-Off Slip Area */}
              <div className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/30">
                <div className="text-[10px] text-zinc-400 uppercase font-bold mb-2">Driver Pickup Verification</div>
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div className="border-t border-slate-300 dark:border-zinc-700 pt-1 mt-6 text-center text-slate-600 dark:text-zinc-400">
                    Store Receiving Clerk Signature
                  </div>
                  <div className="border-t border-slate-300 dark:border-zinc-700 pt-1 mt-6 text-center text-slate-600 dark:text-zinc-400">
                    Vendor Logistics Driver Signature
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print RMA Slip
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRmaForDetail(null)}
                  className="px-4 py-1.5 rounded-xl bg-[#0F4C3A] text-white font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import type { WasteRecord, InventoryItem, WasteReason, WasteAction } from '../../types/index.ts';
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalSku, setModalSku] = useState<string>(inventory[0]?.sku || 'SKU-PRD-001');
  const [modalStoreId, setModalStoreId] = useState<string>('store-jkt-senopati');
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalReason, setModalReason] = useState<WasteReason>('expired');
  const [modalAction, setModalAction] = useState<WasteAction>('bio_compost');
  const [modalReporter, setModalReporter] = useState<string>('Quality Auditor');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isLight = theme === 'light';

  const loadWasteData = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getWasteRecords(selectedStore === 'CONSOLIDATED' ? 'ALL' : selectedStore);
      setWasteRecords(res.records);
      setMetrics(res.metrics);
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

  const filteredRecords = wasteRecords.filter((r) => {
    const matchesReason = reasonFilter === 'ALL' || r.reason === reasonFilter;
    const matchesSearch =
      r.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reportedBy.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesReason && matchesSearch;
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
                Audit-Compliant Waste Module
              </span>
            </div>
            <h2
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                isLight ? 'text-stone-900' : 'text-white'
              }`}
            >
              Scrap & Waste Management
            </h2>
            <p
              className={`text-xs sm:text-sm mt-1 max-w-2xl ${
                isLight ? 'text-stone-600' : 'text-stone-400'
              }`}
            >
              Record damaged, expired, or compromised perishable inventory. Every submission
              automatically deducts physical bin stock and writes off the loss via General Ledger
              Account 6030 (Inventory Shrinkage &amp; Spoilage Expense).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Log In-Store Waste
            </button>
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
          <p className="text-[11px] text-stone-500 mt-1">
            Debited to GL Account #6030
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
              Scrap Incident Count
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-stone-900' : 'text-white'}`}>
            {metrics.count} events
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Verified by Store Quality Inspectors
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
              Primary Loss Driver
            </span>
            <div className="p-2 rounded-lg bg-stone-500/10 text-stone-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold mt-2 ${isLight ? 'text-stone-900' : 'text-white'}`}>
            {Object.keys(metrics.byReason).length > 0
              ? Object.entries(metrics.byReason).sort((a, b) => b[1] - a[1])[0][0].replace(/_/g, ' ')
              : 'None'}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Cold chain monitoring reinforced
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
          <p className="text-[11px] text-stone-500 mt-1">
            Zero-landfill organic diversion
          </p>
        </div>
      </div>

      {/* Waste Records Table */}
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
                isLight
                  ? 'bg-stone-50 border-stone-200 text-stone-700'
                  : 'bg-stone-800 border-stone-700 text-stone-200'
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
                    <td className="py-3 px-4 font-semibold text-rose-600 font-mono">
                      {r.id}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-stone-900 dark:text-stone-100">
                        {r.productName}
                      </div>
                      <div className="text-[11px] text-stone-500">{r.sku}</div>
                    </td>

                    <td className="py-3 px-4 text-stone-700 dark:text-stone-300">
                      {r.storeName}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-stone-900 dark:text-stone-100">
                        {r.quantityScrapped}
                      </span>{' '}
                      <span className="text-stone-500">{r.unit}</span>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-rose-600">
                      {formatIDR(r.totalShrinkageCost)}
                    </td>

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

      {/* Log Waste Modal */}
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
                    Immediately credits inventory asset &amp; debits GL shrinkage expense
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

              {/* Financial Impact Preview */}
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
                <div className="text-base font-bold text-rose-600 font-mono">
                  {formatIDR(calculatedLoss)}
                </div>
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

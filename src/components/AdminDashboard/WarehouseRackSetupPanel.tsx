import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  Edit3,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Warehouse,
} from 'lucide-react';
import type {
  InventoryBatch,
  InventoryItem,
  RackRotationPolicy,
  RemovalStrategyType,
  StaffShiftSession,
  StoreOutletSchedule,
  WarehouseRackConfig,
  WarehouseRackStorageZone,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { isBranchScopedRole } from '../../utils/rbac';

interface WarehouseRackSetupPanelProps {
  theme: 'light' | 'dark';
  activeStaffSession?: StaffShiftSession | null;
  storeOutlets: StoreOutletSchedule[];
  selectedOutletFilter: string;
  inventory: InventoryItem[];
  batches: InventoryBatch[];
  onRefreshAll: () => Promise<void> | void;
  onShowToast: (title: string, message: string) => void;
}

const STORAGE_ZONES: WarehouseRackStorageZone[] = [
  'Ambient Dry',
  'Chilled Walk-In (2°C–4°C)',
  'Deep Freeze (-20°C)',
  'Quarantine Hold Cage',
];

export const WarehouseRackSetupPanel: React.FC<WarehouseRackSetupPanelProps> = ({
  theme,
  activeStaffSession,
  storeOutlets,
  selectedOutletFilter,
  inventory,
  batches,
  onRefreshAll,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const branchScoped = isBranchScopedRole(activeStaffSession?.userRole);
  const lockedBranchId =
    branchScoped && activeStaffSession?.assignedBranchId && activeStaffSession.assignedBranchId !== 'ALL'
      ? activeStaffSession.assignedBranchId
      : branchScoped && activeStaffSession?.storeId && activeStaffSession.storeId !== 'ALL'
      ? activeStaffSession.storeId
      : null;

  const [outletId, setOutletId] = useState<string>(
    lockedBranchId ||
      (selectedOutletFilter && selectedOutletFilter !== 'ALL' && selectedOutletFilter !== 'CONSOLIDATED'
        ? selectedOutletFilter
        : 'store-jkt-senopati')
  );

  useEffect(() => {
    if (lockedBranchId) {
      setOutletId(lockedBranchId);
    } else if (selectedOutletFilter && selectedOutletFilter !== 'ALL' && selectedOutletFilter !== 'CONSOLIDATED') {
      setOutletId(selectedOutletFilter);
    }
  }, [lockedBranchId, selectedOutletFilter]);

  const [racks, setRacks] = useState<WarehouseRackConfig[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSavingRack, setIsSavingRack] = useState<boolean>(false);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Rack Form State
  const [editingRackId, setEditingRackId] = useState<string | undefined>(undefined);
  const [rackBinCode, setRackBinCode] = useState<string>('');
  const [storageZone, setStorageZone] = useState<WarehouseRackStorageZone>('Chilled Walk-In (2°C–4°C)');
  const [rotationPolicy, setRotationPolicy] = useState<RackRotationPolicy>('STRICT_FEFO');
  const [maxCapacity, setMaxCapacity] = useState<number>(250);
  const [rackNotes, setRackNotes] = useState<string>('');

  // SKU / Batch Assignment State
  const [assignSku, setAssignSku] = useState<string>(inventory[0]?.sku || 'SKU-PRD-001');
  const [assignBatchId, setAssignBatchId] = useState<string>('');
  const [assignRackCode, setAssignRackCode] = useState<string>('');
  const [assignStrategy, setAssignStrategy] = useState<RemovalStrategyType>('FEFO');

  const loadRacks = async (targetStore: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.getWarehouseRacks(targetStore);
      const list = res.racks || [];
      setRacks(list);
      if (list.length > 0 && !list.some((r) => r.rackBinCode === assignRackCode)) {
        setAssignRackCode(list[0].rackBinCode);
      }
    } catch (err: any) {
      onShowToast('Rack Load Failed', err?.message || 'Unable to load warehouse racks.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRacks(outletId);
  }, [outletId]);

  const outletBatches = useMemo(
    () => batches.filter((b) => b.storeId === outletId && b.sku === assignSku),
    [batches, outletId, assignSku]
  );

  const summary = useMemo(() => {
    const totalRacks = racks.length;
    const totalCap = racks.reduce((s, r) => s + (r.maxCapacity || 0), 0);
    const totalOcc = racks.reduce((s, r) => s + (r.currentOccupancy || 0), 0);
    const fefoCount = racks.filter((r) => r.rotationPolicy === 'STRICT_FEFO').length;
    const fifoCount = racks.filter((r) => r.rotationPolicy === 'STRICT_FIFO').length;
    return {
      totalRacks,
      totalCap,
      totalOcc,
      utilPct: totalCap > 0 ? Math.min(100, Math.round((totalOcc / totalCap) * 100)) : 0,
      fefoCount,
      fifoCount,
    };
  }, [racks]);

  const handleSaveRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rackBinCode.trim()) return;
    setIsSavingRack(true);
    try {
      const res = await apiClient.saveWarehouseRack({
        id: editingRackId,
        rackBinCode: rackBinCode.trim().toUpperCase(),
        storeId: outletId,
        storageZone,
        rotationPolicy,
        maxCapacity,
        notes: rackNotes,
      });
      setRacks(res.racks || []);
      setEditingRackId(undefined);
      setRackBinCode('');
      setRackNotes('');
      onShowToast('Rack Configuration Saved', res.message);
      await onRefreshAll();
    } catch (err: any) {
      onShowToast('Rack Save Failed', err?.message || 'Unable to save rack configuration.');
    } finally {
      setIsSavingRack(false);
    }
  };

  const handleAssignSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignSku || !assignRackCode) return;
    setIsAssigning(true);
    try {
      const res = await apiClient.assignSkuBatchToRack({
        storeId: outletId,
        sku: assignSku,
        rackBinCode: assignRackCode,
        rotationStrategy: assignStrategy,
        batchId: assignBatchId || undefined,
      });
      onShowToast('Rack & Rotation Updated', res.message);
      await Promise.all([loadRacks(outletId), onRefreshAll()]);
    } catch (err: any) {
      onShowToast('Assignment Failed', err?.message || 'Unable to assign SKU/batch to rack.');
    } finally {
      setIsAssigning(false);
    }
  };

  const cardClass = isLight
    ? 'bg-white border border-slate-200 rounded-2xl shadow-xs'
    : 'bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xs';
  const subCardClass = isLight
    ? 'bg-slate-50 border border-slate-200 rounded-xl'
    : 'bg-zinc-950 border border-zinc-800 rounded-xl';
  const inputClass = `w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900'
      : 'bg-zinc-950 border-zinc-700 text-zinc-100'
  }`;
  const textTitle = isLight ? 'text-slate-900' : 'text-zinc-100';
  const textMuted = isLight ? 'text-slate-500' : 'text-zinc-400';

  return (
    <div className="space-y-4">
      {/* Outlet Selector & Capacity Strip */}
      <div className={`${cardClass} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className={`text-sm sm:text-base font-bold ${textTitle} flex items-center gap-2`}>
              <Warehouse className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
              Per-Outlet Warehouse, Zone &amp; Rack/Bin Topology
            </h3>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Configure storage racks, temperature zones, capacities, and strict FEFO / FIFO batch deduction priority.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {lockedBranchId && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30">
                <Lock className="w-3 h-3" />
                Branch Locked
              </span>
            )}
            <select
              value={outletId}
              disabled={Boolean(lockedBranchId)}
              onChange={(e) => setOutletId(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-zinc-950 border-zinc-700 text-zinc-100'
              } disabled:opacity-75`}
            >
              {storeOutlets.map((s) => (
                <option key={s.storeId} value={s.storeId}>
                  {s.storeName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadRacks(outletId)}
              className={`p-2 rounded-xl border cursor-pointer ${
                isLight ? 'border-slate-300 hover:bg-slate-50' : 'border-zinc-700 hover:bg-zinc-800'
              }`}
              title="Refresh racks"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`${subCardClass} p-3`}>
            <span className={`text-[11px] ${textMuted} block`}>Active Racks / Bins</span>
            <span className={`text-base font-bold font-mono ${textTitle}`}>{summary.totalRacks} Racks</span>
          </div>
          <div className={`${subCardClass} p-3`}>
            <span className={`text-[11px] ${textMuted} block`}>Live Occupancy</span>
            <span className="text-base font-bold font-mono text-[#0F4C3A] dark:text-emerald-400">
              {summary.totalOcc.toLocaleString('id-ID')} / {summary.totalCap.toLocaleString('id-ID')} ({summary.utilPct}%)
            </span>
          </div>
          <div className={`${subCardClass} p-3`}>
            <span className={`text-[11px] ${textMuted} block`}>Strict FEFO Racks</span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {summary.fefoCount} Zones
            </span>
          </div>
          <div className={`${subCardClass} p-3`}>
            <span className={`text-[11px] ${textMuted} block`}>Strict FIFO Racks</span>
            <span className="text-base font-bold font-mono text-sky-600 dark:text-sky-400">
              {summary.fifoCount} Zones
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column Configurator: Add/Edit Rack + SKU-to-Rack & FEFO/FIFO Assignment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form onSubmit={handleSaveRack} className={`${cardClass} p-4 sm:p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <h4 className={`text-xs sm:text-sm font-bold ${textTitle} flex items-center gap-1.5`}>
              <Plus className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
              {editingRackId ? 'Edit Rack / Bin Topology' : 'Create / Update Rack & Bin'}
            </h4>
            {editingRackId && (
              <button
                type="button"
                onClick={() => {
                  setEditingRackId(undefined);
                  setRackBinCode('');
                  setRackNotes('');
                }}
                className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Clear Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Rack / Bin Code</label>
              <input
                type="text"
                required
                value={rackBinCode}
                onChange={(e) => setRackBinCode(e.target.value)}
                placeholder="e.g. SEN-CHL-R01-B02"
                className={`${inputClass} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Storage Zone</label>
              <select
                value={storageZone}
                onChange={(e) => setStorageZone(e.target.value as WarehouseRackStorageZone)}
                className={inputClass}
              >
                {STORAGE_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Default Rotation Policy</label>
              <select
                value={rotationPolicy}
                onChange={(e) => setRotationPolicy(e.target.value as RackRotationPolicy)}
                className={inputClass}
              >
                <option value="STRICT_FEFO">STRICT_FEFO (Earliest Expiry First)</option>
                <option value="STRICT_FIFO">STRICT_FIFO (Earliest Received First)</option>
              </select>
            </div>
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Max Capacity (Units)</label>
              <input
                type="number"
                min={1}
                required
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Math.max(1, Number(e.target.value)))}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Handling / Zone Notes</label>
            <input
              type="text"
              value={rackNotes}
              onChange={(e) => setRackNotes(e.target.value)}
              placeholder="e.g. HACCP cold-chain aisle 2, shelf height 1.8m"
              className={inputClass}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingRack}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSavingRack ? 'Saving...' : editingRackId ? 'Update Rack/Bin' : 'Save Rack/Bin'}
            </button>
          </div>
        </form>

        <form onSubmit={handleAssignSku} className={`${cardClass} p-4 sm:p-5 space-y-3`}>
          <h4 className={`text-xs sm:text-sm font-bold ${textTitle} flex items-center gap-1.5`}>
            <ArrowRightLeft className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
            SKU-to-Rack Assignment &amp; Live FEFO/FIFO Override
          </h4>
          <p className={`text-[11px] ${textMuted}`}>
            Immediately updates lot rack location and POS / B2B deduction order (<code className="font-mono">deductBatchesByStrategy</code>) for this outlet.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Target SKU</label>
              <select
                value={assignSku}
                onChange={(e) => {
                  setAssignSku(e.target.value);
                  setAssignBatchId('');
                }}
                className={inputClass}
              >
                {inventory.map((it) => (
                  <option key={it.sku} value={it.sku}>
                    {it.sku} — {it.name || it.productName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Specific Batch (Optional)</label>
              <select
                value={assignBatchId}
                onChange={(e) => setAssignBatchId(e.target.value)}
                className={inputClass}
              >
                <option value="">All active batches for SKU at outlet</option>
                {outletBatches.map((b) => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.lotNumber} ({b.currentStock} u · Exp {b.expiryDate.split('T')[0]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Target Rack / Bin Code</label>
              <select
                value={assignRackCode}
                onChange={(e) => setAssignRackCode(e.target.value)}
                className={`${inputClass} font-mono`}
              >
                {racks.map((r) => (
                  <option key={r.id} value={r.rackBinCode}>
                    {r.rackBinCode} ({r.storageZone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>SKU Rotation Strategy</label>
              <div className="grid grid-cols-2 gap-2">
                {(['FEFO', 'FIFO'] as RemovalStrategyType[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAssignStrategy(mode)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      assignStrategy === mode
                        ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                        : isLight
                        ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isAssigning || racks.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <Layers className="w-3.5 h-3.5" />
              {isAssigning ? 'Assigning...' : 'Assign SKU & Apply Strategy'}
            </button>
          </div>
        </form>
      </div>

      {/* Rack Directory Table */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={isLight ? 'bg-slate-50 text-slate-600 border-b border-slate-200' : 'bg-zinc-950 text-zinc-400 border-b border-zinc-800'}>
              <tr>
                <th className="py-2.5 px-3 font-semibold">Rack / Bin Code</th>
                <th className="py-2.5 px-3 font-semibold">Storage Zone</th>
                <th className="py-2.5 px-3 font-semibold">Rotation Policy</th>
                <th className="py-2.5 px-3 font-semibold">Occupancy</th>
                <th className="py-2.5 px-3 font-semibold">Assigned SKUs</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
              {racks.map((rack) => {
                const pct =
                  rack.maxCapacity > 0
                    ? Math.min(100, Math.round((rack.currentOccupancy / rack.maxCapacity) * 100))
                    : 0;
                return (
                  <tr key={rack.id} className={isLight ? 'hover:bg-slate-50/70' : 'hover:bg-zinc-800/40'}>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {rack.rackBinCode}
                    </td>
                    <td className={`py-2.5 px-3 ${textTitle}`}>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                          rack.storageZone.includes('Quarantine')
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
                            : rack.storageZone.includes('Freeze')
                            ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30'
                            : rack.storageZone.includes('Chilled')
                            ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30'
                        }`}
                      >
                        {rack.storageZone}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          rack.rotationPolicy === 'STRICT_FEFO'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                        }`}
                      >
                        {rack.rotationPolicy}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 min-w-[160px]">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className={textTitle}>
                          {rack.currentOccupancy} / {rack.maxCapacity}
                        </span>
                        <span className={pct >= 90 ? 'text-rose-600 font-bold' : textMuted}>{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-[#0F4C3A] dark:bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className={`py-2.5 px-3 font-mono text-[11px] ${textMuted}`}>
                      {rack.assignedSkus.length > 0 ? rack.assignedSkus.join(', ') : 'Empty Bin'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRackId(rack.id);
                          setRackBinCode(rack.rackBinCode);
                          setStorageZone(rack.storageZone);
                          setRotationPolicy(rack.rotationPolicy);
                          setMaxCapacity(rack.maxCapacity);
                          setRackNotes(rack.notes || '');
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                          isLight
                            ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {racks.length === 0 && (
                <tr>
                  <td colSpan={6} className={`py-8 text-center text-xs ${textMuted}`}>
                    No racks configured for this outlet yet. Use the form above to add a Rack / Bin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

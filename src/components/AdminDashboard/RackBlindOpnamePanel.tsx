import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  EyeOff,
  Lock,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import type {
  InventoryBatch,
  InventoryItem,
  RackStocktakeCommitResponse,
  RackStocktakePendingSubmission,
  StaffShiftSession,
  StoreOutletSchedule,
  WarehouseRackConfig,
  WarehouseRackStorageZone,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { usePrint } from '../../context/PrintContext';
import { formatIDR } from '../../utils/formatters';
import {
  canSessionViewValuation,
  isBranchScopedRole,
  normalizeEnterpriseRole,
} from '../../utils/rbac';

interface RackBlindOpnamePanelProps {
  theme: 'light' | 'dark';
  activeStaffSession?: StaffShiftSession | null;
  storeOutlets: StoreOutletSchedule[];
  selectedOutletFilter: string;
  inventory: InventoryItem[];
  batches: InventoryBatch[];
  onRefreshAll: () => Promise<void> | void;
  onShowToast: (title: string, message: string) => void;
}

export const RackBlindOpnamePanel: React.FC<RackBlindOpnamePanelProps> = ({
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
  const { triggerPrint } = usePrint();
  const canViewValuation = canSessionViewValuation(activeStaffSession);
  const canonicalRole = normalizeEnterpriseRole(activeStaffSession?.userRole);
  const isSupervisorRole =
    canonicalRole === 'store_manager' || canonicalRole === 'coo' || canonicalRole === 'super_admin';
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
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [rackFilter, setRackFilter] = useState<string>('ALL');
  const [racks, setRacks] = useState<WarehouseRackConfig[]>([]);
  const [submissions, setSubmissions] = useState<RackStocktakePendingSubmission[]>([]);
  const [countsByBatch, setCountsByBatch] = useState<Record<string, string>>({});
  const [notesByBatch, setNotesByBatch] = useState<Record<string, string>>({});
  const [tolerancePercent, setTolerancePercent] = useState<number>(5);
  const [toleranceValueIDR, setToleranceValueIDR] = useState<number>(500000);
  const [supervisorAuthorizeNow, setSupervisorAuthorizeNow] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<RackStocktakeCommitResponse | null>(null);

  useEffect(() => {
    if (lockedBranchId) {
      setOutletId(lockedBranchId);
    } else if (selectedOutletFilter && selectedOutletFilter !== 'ALL' && selectedOutletFilter !== 'CONSOLIDATED') {
      setOutletId(selectedOutletFilter);
    }
  }, [lockedBranchId, selectedOutletFilter]);

  const loadContextData = async (targetStore: string) => {
    try {
      const [rackRes, subRes] = await Promise.all([
        apiClient.getWarehouseRacks(targetStore),
        apiClient.getRackStocktakeSubmissions(targetStore),
      ]);
      setRacks(rackRes.racks || []);
      setSubmissions(subRes || []);
    } catch {
      // silent fallback
    }
  };

  useEffect(() => {
    void loadContextData(outletId);
  }, [outletId]);

  const rackByCode = useMemo(() => {
    const map: Record<string, WarehouseRackConfig> = {};
    racks.forEach((r) => {
      map[r.rackBinCode] = r;
    });
    return map;
  }, [racks]);

  const invBySku = useMemo(() => {
    const map: Record<string, InventoryItem> = {};
    inventory.forEach((i) => {
      map[i.sku] = i;
    });
    return map;
  }, [inventory]);

  const filteredRacks = useMemo(() => {
    if (zoneFilter === 'ALL') return racks;
    return racks.filter((r) => r.storageZone === zoneFilter);
  }, [racks, zoneFilter]);

  const scopedBatches = useMemo(() => {
    return batches
      .filter((b) => {
        if (b.storeId !== outletId) return false;
        const bRack = b.rackBinCode || 'UNASSIGNED';
        if (rackFilter !== 'ALL' && bRack !== rackFilter) return false;
        if (zoneFilter !== 'ALL') {
          const rackZone: WarehouseRackStorageZone | undefined = rackByCode[bRack]?.storageZone;
          if (rackZone) {
            if (rackZone !== zoneFilter) return false;
          } else {
            const inferred =
              b.storageZone === 'freezer'
                ? 'Deep Freeze (-20°C)'
                : b.storageZone === 'cold_chilled'
                ? 'Chilled Walk-In (2°C–4°C)'
                : 'Ambient Dry';
            if (inferred !== zoneFilter) return false;
          }
        }
        return b.status !== 'depleted';
      })
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [batches, outletId, rackFilter, zoneFilter, rackByCode]);

  const outletName =
    storeOutlets.find((s) => s.storeId === outletId)?.storeName || 'GroceMart Flagship';

  const handlePrintBlindSheet = () => {
    const selectedRackObj = rackFilter !== 'ALL' ? rackByCode[rackFilter] : undefined;
    triggerPrint({
      type: 'blind_count_sheet',
      format: 'a4',
      sheetTitle: `Blind Opname Sheet — ${rackFilter}`,
      storeId: outletId,
      storeName: outletName,
      storageZone: zoneFilter === 'ALL' ? selectedRackObj?.storageZone || 'ALL ZONES' : zoneFilter,
      rackBinCode: rackFilter,
      rotationPolicy: selectedRackObj?.rotationPolicy || 'FEFO / FIFO',
      preparedBy: activeStaffSession?.userName || 'Warehouse Auditor',
      items: scopedBatches.map((b) => ({
        sku: b.sku,
        productName: b.productName,
        rackBinCode: b.rackBinCode || 'UNASSIGNED',
        lotNumber: b.lotNumber,
        expiryDate: b.expiryDate,
        uom: invBySku[b.sku]?.unit || 'pcs',
        statusLabel:
          b.status === 'quarantined' || b.status === 'recalled' || b.status === 'expired'
            ? `LOCKED (${b.status.toUpperCase()})`
            : undefined,
      })),
    });
  };

  const enteredLinesCount = scopedBatches.filter(
    (b) => countsByBatch[b.batchId] !== undefined && countsByBatch[b.batchId] !== ''
  ).length;

  const handleCommitStocktake = async () => {
    const payloadCounts = scopedBatches
      .filter((b) => countsByBatch[b.batchId] !== undefined && countsByBatch[b.batchId] !== '')
      .map((b) => ({
        batchId: b.batchId,
        sku: b.sku,
        lotNumber: b.lotNumber,
        rackBinCode: b.rackBinCode || 'UNASSIGNED',
        physicalCount: Math.max(0, Number(countsByBatch[b.batchId])),
        notes: notesByBatch[b.batchId] || undefined,
      }));

    if (payloadCounts.length === 0) {
      onShowToast('No Counts Entered', 'Enter at least one physical count before committing.');
      return;
    }

    setIsCommitting(true);
    try {
      const res = await apiClient.commitRackStocktake({
        storeId: outletId,
        storageZone: zoneFilter,
        rackBinCode: rackFilter,
        counts: payloadCounts,
        tolerancePercent,
        toleranceValueIDR,
        supervisorAuthorized: isSupervisorRole ? supervisorAuthorizeNow : false,
      });
      setLastResult(res);
      setCountsByBatch({});
      setNotesByBatch({});
      onShowToast(
        res.routedToApproval ? 'Routed to Approval Matrix' : 'Rack Opname Committed',
        res.message
      );
      await Promise.all([loadContextData(outletId), onRefreshAll()]);
    } catch (err: any) {
      onShowToast('Stocktake Commit Blocked', err?.message || 'Unable to commit stocktake.');
    } finally {
      setIsCommitting(false);
    }
  };

  const cardClass = isLight
    ? 'bg-white border border-slate-200 rounded-2xl shadow-xs'
    : 'bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xs';
  const inputClass = `px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C3A] ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900'
      : 'bg-zinc-950 border-zinc-700 text-zinc-100'
  }`;
  const textTitle = isLight ? 'text-slate-900' : 'text-zinc-100';
  const textMuted = isLight ? 'text-slate-500' : 'text-zinc-400';

  return (
    <div className="space-y-4">
      {/* Blind Opname Scope Filter & A4 Print Controls */}
      <div className={`${cardClass} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-sm sm:text-base font-bold ${textTitle} flex items-center gap-2`}>
                <ClipboardCheck className="w-4 h-4 text-[#0F4C3A] dark:text-emerald-400" />
                Rack-Scoped Blind Stock Opname (Cycle Count)
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30">
                <EyeOff className="w-3 h-3" />
                System On-Hand Masked
              </span>
            </div>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Print blind count sheets by Rack/Bin, enter physical counts, and reconcile FEFO/FIFO batch variances with automatic GL &amp; Approval Matrix governance.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrintBlindSheet}
            disabled={scopedBatches.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-50 text-white transition-all cursor-pointer shadow-xs shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Blind Count Sheet (A4)
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>
              Outlet {lockedBranchId && '(Locked)'}
            </label>
            <select
              value={outletId}
              disabled={Boolean(lockedBranchId)}
              onChange={(e) => {
                setOutletId(e.target.value);
                setRackFilter('ALL');
              }}
              className={`${inputClass} w-full disabled:opacity-75`}
            >
              {storeOutlets.map((s) => (
                <option key={s.storeId} value={s.storeId}>
                  {s.storeName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Storage Zone</label>
            <select
              value={zoneFilter}
              onChange={(e) => {
                setZoneFilter(e.target.value);
                setRackFilter('ALL');
              }}
              className={`${inputClass} w-full`}
            >
              <option value="ALL">All Storage Zones</option>
              <option value="Ambient Dry">Ambient Dry</option>
              <option value="Chilled Walk-In (2°C–4°C)">Chilled Walk-In (2°C–4°C)</option>
              <option value="Deep Freeze (-20°C)">Deep Freeze (-20°C)</option>
              <option value="Quarantine Hold Cage">Quarantine Hold Cage</option>
            </select>
          </div>

          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Rack / Bin Code</label>
            <select
              value={rackFilter}
              onChange={(e) => setRackFilter(e.target.value)}
              className={`${inputClass} w-full font-mono`}
            >
              <option value="ALL">All Racks / Bins</option>
              {filteredRacks.map((r) => (
                <option key={r.id} value={r.rackBinCode}>
                  {r.rackBinCode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Tolerance (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={tolerancePercent}
              onChange={(e) => setTolerancePercent(Math.max(0, Number(e.target.value)))}
              className={`${inputClass} w-full font-mono`}
            />
          </div>

          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${textMuted}`}>Approval Threshold (IDR)</label>
            <input
              type="number"
              min={0}
              step={50000}
              value={toleranceValueIDR}
              onChange={(e) => setToleranceValueIDR(Math.max(0, Number(e.target.value)))}
              className={`${inputClass} w-full font-mono`}
            />
          </div>
        </div>
      </div>

      {/* Commit Feedback Banner */}
      {lastResult && (
        <div
          className={`p-4 rounded-2xl border space-y-2 ${
            lastResult.routedToApproval
              ? isLight
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-amber-950/30 border-amber-800 text-amber-200'
              : isLight
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-emerald-950/30 border-emerald-800 text-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              {lastResult.routedToApproval ? (
                <ShieldAlert className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{lastResult.message}</span>
            </div>
            <span className="font-mono text-[11px] font-bold">
              {lastResult.submission.sheetNumber}
              {lastResult.approvalRequestId ? ` · ${lastResult.approvalRequestId}` : ''}
            </span>
          </div>
          {canViewValuation && (
            <div className="text-xs font-mono flex flex-wrap gap-4">
              <span>Surplus: +{formatIDR(lastResult.submission.totalSurplusValueIDR)}</span>
              <span>Shortage: -{formatIDR(lastResult.submission.totalShortageValueIDR)}</span>
              <span>Net Variance: {formatIDR(lastResult.submission.netVarianceValueIDR)}</span>
              {lastResult.glVoucherIds.length > 0 && (
                <span>GL Vouchers: {lastResult.glVoucherIds.join(', ')}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Blind Count Entry Table */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={isLight ? 'bg-slate-50 text-slate-600 border-b border-slate-200' : 'bg-zinc-950 text-zinc-400 border-b border-zinc-800'}>
              <tr>
                <th className="py-2.5 px-3 font-semibold">SKU &amp; Product</th>
                <th className="py-2.5 px-3 font-semibold">Rack / Bin</th>
                <th className="py-2.5 px-3 font-semibold">Lot / Batch #</th>
                <th className="py-2.5 px-3 font-semibold">Expiry Date</th>
                <th className="py-2.5 px-3 font-semibold">System On-Hand</th>
                <th className="py-2.5 px-3 font-semibold w-36">Physical Count</th>
                <th className="py-2.5 px-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
              {scopedBatches.map((batch) => {
                const isLocked =
                  batch.status === 'quarantined' || batch.status === 'recalled' || batch.status === 'expired';
                return (
                  <tr key={batch.batchId} className={isLight ? 'hover:bg-slate-50/70' : 'hover:bg-zinc-800/40'}>
                    <td className="py-2.5 px-3">
                      <div className={`font-bold ${textTitle}`}>{batch.productName}</div>
                      <div className={`font-mono text-[10px] ${textMuted}`}>
                        {batch.sku} · {invBySku[batch.sku]?.unit || 'pcs'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {batch.rackBinCode || 'UNASSIGNED'}
                    </td>
                    <td className={`py-2.5 px-3 font-mono ${textTitle}`}>{batch.lotNumber}</td>
                    <td className={`py-2.5 px-3 font-mono ${textMuted}`}>
                      {batch.expiryDate.split('T')[0]}
                    </td>
                    <td className="py-2.5 px-3">
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30">
                          <Lock className="w-3 h-3" />
                          {batch.status.toUpperCase()} LOCKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                          <EyeOff className="w-3 h-3" />
                          BLIND MASKED
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min={0}
                        step="1"
                        disabled={isLocked}
                        value={countsByBatch[batch.batchId] ?? ''}
                        onChange={(e) =>
                          setCountsByBatch((prev) => ({ ...prev, [batch.batchId]: e.target.value }))
                        }
                        placeholder={isLocked ? 'Locked' : 'Enter qty...'}
                        className={`${inputClass} w-28 font-mono disabled:opacity-50`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={notesByBatch[batch.batchId] ?? ''}
                        onChange={(e) =>
                          setNotesByBatch((prev) => ({ ...prev, [batch.batchId]: e.target.value }))
                        }
                        placeholder="Optional remark"
                        className={`${inputClass} w-full disabled:opacity-50`}
                      />
                    </td>
                  </tr>
                );
              })}
              {scopedBatches.length === 0 && (
                <tr>
                  <td colSpan={7} className={`py-8 text-center text-xs ${textMuted}`}>
                    No active batches found in this Outlet / Zone / Rack selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`p-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-zinc-800 bg-zinc-950/70'}`}>
          <div className="space-y-1">
            <span className={`text-xs font-semibold ${textTitle} block`}>
              {enteredLinesCount} of {scopedBatches.length} batches counted
            </span>
            {isSupervisorRole ? (
              <label className="inline-flex items-center gap-2 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={supervisorAuthorizeNow}
                  onChange={(e) => setSupervisorAuthorizeNow(e.target.checked)}
                  className="rounded border-slate-300 text-[#0F4C3A] focus:ring-[#0F4C3A]"
                />
                <span className={textMuted}>
                  Direct Supervisor Override (commit over-threshold variance immediately without Approval Matrix queue)
                </span>
              </label>
            ) : (
              <span className={`text-[11px] ${textMuted} flex items-center gap-1`}>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Variances exceeding {tolerancePercent}% or {formatIDR(toleranceValueIDR)} automatically route to Approval Matrix.
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={isCommitting || enteredLinesCount === 0}
            onClick={handleCommitStocktake}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-50 text-white transition-all cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isCommitting ? 'Reconciling...' : 'Commit Rack Blind Stock Opname'}
          </button>
        </div>
      </div>

      {/* Recent Submissions Audit Log */}
      {submissions.length > 0 && (
        <div className={`${cardClass} p-4 space-y-3`}>
          <h4 className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>
            Recent Rack Blind Opname Submissions
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className={isLight ? 'text-slate-500 border-b border-slate-200' : 'text-zinc-400 border-b border-zinc-800'}>
                  <th className="py-1.5 px-2">Sheet #</th>
                  <th className="py-1.5 px-2">Rack / Bin</th>
                  <th className="py-1.5 px-2">Submitted By</th>
                  <th className="py-1.5 px-2">Status</th>
                  {canViewValuation && <th className="py-1.5 px-2 text-right">Net Variance</th>}
                  <th className="py-1.5 px-2 text-right">GL / Approval Ref</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
                {submissions.slice(0, 6).map((sub) => (
                  <tr key={sub.id}>
                    <td className={`py-2 px-2 font-bold ${textTitle}`}>{sub.sheetNumber}</td>
                    <td className="py-2 px-2 text-[#0F4C3A] dark:text-emerald-400">{sub.rackBinCode}</td>
                    <td className={`py-2 px-2 ${textMuted}`}>{sub.submittedBy}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sub.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                            : sub.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    {canViewValuation && (
                      <td className={`py-2 px-2 text-right font-bold ${textTitle}`}>
                        {formatIDR(sub.netVarianceValueIDR)}
                      </td>
                    )}
                    <td className={`py-2 px-2 text-right ${textMuted}`}>
                      {sub.glVoucherIds.length > 0
                        ? sub.glVoucherIds.join(', ')
                        : sub.approvalRequestId || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

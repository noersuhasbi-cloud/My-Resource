import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  EyeOff,
  FileCheck2,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { BlindOpnameSheet } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';

interface BlindOpnamePanelProps {
  theme: 'light' | 'dark';
  selectedStoreId: string;
  onRefreshData?: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const BlindOpnamePanel: React.FC<BlindOpnamePanelProps> = ({
  theme,
  selectedStoreId,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const [sheets, setSheets] = useState<BlindOpnameSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>('');
  const [warehouseHub, setWarehouseHub] = useState<'CDC' | 'DARK_STORE' | 'RETAIL_FRONT'>('CDC');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [countsDraft, setCountsDraft] = useState<Record<string, { qty: string; lot: string; notes: string }>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActioning, setIsActioning] = useState<boolean>(false);

  const loadSheets = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getBlindOpnameSheets(selectedStoreId);
      setSheets(data);
      if (data.length > 0 && (!activeSheetId || !data.some((d) => d.id === activeSheetId))) {
        setActiveSheetId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load blind opname sheets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSheets();
  }, [selectedStoreId]);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) || sheets[0] || null;

  useEffect(() => {
    if (!activeSheet) return;
    const nextDraft: Record<string, { qty: string; lot: string; notes: string }> = {};
    activeSheet.items.forEach((it) => {
      nextDraft[it.sku] = {
        qty: it.countedQty !== null && it.countedQty !== undefined ? String(it.countedQty) : '',
        lot: it.countedLotNumber || it.expectedLotNumber || '',
        notes: it.notes || '',
      };
    });
    setCountsDraft(nextDraft);
  }, [activeSheet?.id, activeSheet?.status]);

  const handleGenerate = async () => {
    setIsActioning(true);
    try {
      const res = await apiClient.generateBlindOpnameSheet({
        warehouseHub,
        storeId: selectedStoreId,
        zoneFilter,
      });
      onShowToast('Blind Sheet Generated', res.message);
      await loadSheets();
      setActiveSheetId(res.sheet.id);
    } catch (err: any) {
      onShowToast('Generation Failed', err.message || 'Could not generate blind count sheet');
    } finally {
      setIsActioning(false);
    }
  };

  const handleSubmitCount = async () => {
    if (!activeSheet) return;
    const missing = activeSheet.items.some((it) => {
      const val = countsDraft[it.sku]?.qty;
      return val === undefined || val === '' || Number.isNaN(Number(val));
    });
    if (missing) {
      onShowToast('Incomplete Physical Count', 'Enter physical quantities for all listed SKUs before submitting.');
      return;
    }

    setIsActioning(true);
    try {
      const counts = activeSheet.items.map((it) => ({
        sku: it.sku,
        countedQty: Math.max(0, Number(countsDraft[it.sku]?.qty ?? 0)),
        countedLotNumber: countsDraft[it.sku]?.lot || it.expectedLotNumber,
        notes: countsDraft[it.sku]?.notes || '',
      }));
      const res = await apiClient.submitBlindOpnameCounts(activeSheet.id, { counts });
      onShowToast('Submitted for Supervisor Audit', res.message);
      await loadSheets();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      onShowToast('Submission Error', err.message || 'Failed to submit physical counts');
    } finally {
      setIsActioning(false);
    }
  };

  const handleSupervisorApprove = async (action: 'APPROVED' | 'REJECTED') => {
    if (!activeSheet) return;
    setIsActioning(true);
    try {
      const res = await apiClient.approveBlindOpnameSheet(
        activeSheet.id,
        action,
        action === 'APPROVED'
          ? 'Supervisor approved variance and synchronized GL COA #5210'
          : 'Re-count requested by Supervisor'
      );
      onShowToast(
        action === 'APPROVED' ? 'Opname Approved & GL Posted' : 'Opname Rejected',
        res.message
      );
      await loadSheets();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      onShowToast('Approval Error', err.message || 'Failed to process approval');
    } finally {
      setIsActioning(false);
    }
  };

  const cardClass = `rounded-2xl border p-5 sm:p-6 space-y-5 ${
    isLight ? 'bg-white border-gray-200/90 shadow-xs' : 'bg-zinc-900/90 border-zinc-800'
  }`;

  const inputClass = `rounded-xl border px-3 py-1.5 text-xs focus:outline-none focus:border-[#0F4C3A] ${
    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-white'
  }`;

  return (
    <div className="space-y-5">
      {/* Generator Bar */}
      <div className={cardClass}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
                <EyeOff className="w-3 h-3" />
                Anti-Fraud Blind Mode
              </span>
              <span className="text-xs font-mono text-gray-500 dark:text-zinc-400">
                COA #5210 Variance Auto-Sync
              </span>
            </div>
            <h3 className={`text-base font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
              Stock Opname Fisik Buta &amp; Audit Selisih (Blind Cycle Count)
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
              System On-Hand quantities are strictly concealed from counters until physical quantities and Lot/Batch codes are submitted for Supervisor reconciliation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={warehouseHub}
              onChange={(e) => setWarehouseHub(e.target.value as any)}
              className={`font-semibold ${inputClass}`}
            >
              <option value="CDC">Central Distribution Center (CDC)</option>
              <option value="DARK_STORE">Dark Store (PIK 2)</option>
              <option value="RETAIL_FRONT">Retail Fronts</option>
            </select>

            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className={`font-mono ${inputClass}`}
            >
              <option value="ALL">All Warehouse Zones</option>
              <option value="WH-JKT-SEN-COLD">Cold Chiller (2-4°C)</option>
              <option value="WH-JKT-SEN-FRZ">Deep Freezer (-18°C)</option>
              <option value="WH-JKT-SEN-AMB">Dry Ambient Racks</option>
            </select>

            <button
              type="button"
              disabled={isActioning}
              onClick={handleGenerate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate Blind Sheet</span>
            </button>
          </div>
        </div>

        {/* Sheet Selector Chips */}
        {sheets.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100 dark:border-zinc-800">
            <span className="text-[11px] font-bold uppercase text-gray-500 dark:text-zinc-400">
              Active Count Sheets:
            </span>
            {sheets.map((sh) => (
              <button
                key={sh.id}
                type="button"
                onClick={() => setActiveSheetId(sh.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSheet?.id === sh.id
                    ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                    : isLight
                    ? 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <span>{sh.sheetNumber}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-sans ${
                    sh.status === 'COUNTING'
                      ? 'bg-amber-500/20 text-amber-200'
                      : sh.status === 'PENDING_APPROVAL'
                      ? 'bg-blue-500/20 text-blue-200'
                      : 'bg-emerald-500/20 text-emerald-200'
                  }`}
                >
                  {sh.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Blind Sheet Workspace */}
      {isLoading ? (
        <div className={`${cardClass} text-center py-8 text-xs text-gray-500`}>
          Loading blind opname sheets...
        </div>
      ) : activeSheet ? (
        <div className={cardClass}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <h4 className={`text-sm font-bold font-mono ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  {activeSheet.sheetNumber} · {activeSheet.storeName}
                </h4>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeSheet.status === 'COUNTING'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : activeSheet.status === 'PENDING_APPROVAL'
                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                      : activeSheet.status === 'APPROVED'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {activeSheet.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                {activeSheet.status === 'COUNTING'
                  ? 'Counter Input Mode: System On-Hand quantities are strictly hidden. Enter actual shelf counts & batch codes.'
                  : `Supervisor Audit Mode: Approval Ref ${activeSheet.approvalRequestId || '-'} · Net Financial Variance: ${formatIDR(activeSheet.netVarianceValueIDR)}`}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {activeSheet.status === 'COUNTING' && (
                <button
                  type="button"
                  disabled={isActioning}
                  onClick={handleSubmitCount}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isActioning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                  <span>Submit Blind Count for Audit</span>
                </button>
              )}

              {activeSheet.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    type="button"
                    disabled={isActioning}
                    onClick={() => handleSupervisorApprove('REJECTED')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                  >
                    Reject (Re-Count)
                  </button>
                  <button
                    type="button"
                    disabled={isActioning}
                    onClick={() => handleSupervisorApprove('APPROVED')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Supervisor Approve &amp; Post COA #5210</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Supervisor Variance Summary (ONLY visible after COUNTING is submitted) */}
          {activeSheet.status !== 'COUNTING' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'}`}>
                <span className="font-sans text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Selisih Lebih (Surplus)
                </span>
                <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300 block mt-1">
                  +{formatIDR(activeSheet.totalSurplusValueIDR)}
                </span>
              </div>

              <div className={`p-3 rounded-xl border ${isLight ? 'bg-rose-50/70 border-rose-200' : 'bg-rose-950/20 border-rose-800/40'}`}>
                <span className="font-sans text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Selisih Kurang (Shrinkage)
                </span>
                <span className="text-base font-extrabold text-rose-700 dark:text-rose-300 block mt-1">
                  -{formatIDR(activeSheet.totalShortageValueIDR)}
                </span>
              </div>

              <div className={`p-3 rounded-xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'}`}>
                <span className="font-sans text-[11px] font-bold text-gray-600 dark:text-zinc-300 flex items-center gap-1">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Net GL Impact (COA #5210)
                </span>
                <span className="text-base font-extrabold block mt-1">
                  {formatIDR(activeSheet.netVarianceValueIDR)}
                </span>
                {activeSheet.glVoucherIds.length > 0 && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Posted: {activeSheet.glVoucherIds.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr
                  className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                    isLight ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-zinc-800/60 text-zinc-400 border-zinc-800'
                  }`}
                >
                  <th className="py-3 px-3.5">SKU &amp; Product</th>
                  <th className="py-3 px-3">Bin Location</th>
                  <th className="py-3 px-3">Lot / Batch Code</th>
                  <th className="py-3 px-3 text-center">Physical Count</th>
                  {activeSheet.status !== 'COUNTING' ? (
                    <>
                      <th className="py-3 px-3 text-center">System Book Qty</th>
                      <th className="py-3 px-3 text-center">Variance</th>
                      <th className="py-3 px-3 text-right">Financial Variance</th>
                    </>
                  ) : (
                    <th className="py-3 px-3 text-center">System Book Qty</th>
                  )}
                  <th className="py-3 px-3">Counter Notes</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-zinc-800'}`}>
                {activeSheet.items.map((line) => {
                  const draft = countsDraft[line.sku] || { qty: '', lot: line.countedLotNumber, notes: '' };
                  const isCounting = activeSheet.status === 'COUNTING';
                  return (
                    <tr key={line.sku} className={isLight ? 'hover:bg-gray-50/70' : 'hover:bg-zinc-800/40'}>
                      <td className="py-3 px-3.5">
                        <span className="font-mono text-[10px] text-gray-400 block">{line.sku}</span>
                        <span className="font-semibold">{line.productName}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">{line.binLocation}</td>
                      <td className="py-3 px-3">
                        {isCounting ? (
                          <input
                            type="text"
                            value={draft.lot}
                            onChange={(e) =>
                              setCountsDraft((prev) => ({
                                ...prev,
                                [line.sku]: { ...draft, lot: e.target.value },
                              }))
                            }
                            className={`w-32 font-mono ${inputClass}`}
                          />
                        ) : (
                          <span className="font-mono text-[11px]">{line.countedLotNumber}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isCounting ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="Enter qty"
                            value={draft.qty}
                            onChange={(e) =>
                              setCountsDraft((prev) => ({
                                ...prev,
                                [line.sku]: { ...draft, qty: e.target.value },
                              }))
                            }
                            className={`w-24 text-center font-mono font-bold ${inputClass}`}
                          />
                        ) : (
                          <span className="font-mono font-bold">
                            {line.countedQty} {line.unit}
                          </span>
                        )}
                      </td>

                      {isCounting ? (
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border border-zinc-500/20 text-[10px] font-semibold">
                            <EyeOff className="w-3 h-3" />
                            HIDDEN (BLIND)
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="py-3 px-3 text-center font-mono">
                            {line.systemQty} {line.unit}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                (line.varianceQty || 0) < 0
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                  : (line.varianceQty || 0) > 0
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-gray-500/10 text-gray-600 dark:text-zinc-400'
                              }`}
                            >
                              {(line.varianceQty || 0) > 0 ? `+${line.varianceQty}` : line.varianceQty}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold tabular-nums">
                            {formatIDR(line.varianceValueIDR || 0)}
                          </td>
                        </>
                      )}

                      <td className="py-3 px-3">
                        {isCounting ? (
                          <input
                            type="text"
                            value={draft.notes}
                            placeholder="Condition / seal note..."
                            onChange={(e) =>
                              setCountsDraft((prev) => ({
                                ...prev,
                                [line.sku]: { ...draft, notes: e.target.value },
                              }))
                            }
                            className={`w-40 ${inputClass}`}
                          />
                        ) : (
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400">{line.notes || '-'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
};

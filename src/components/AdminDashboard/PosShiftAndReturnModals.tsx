import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Printer,
  RotateCcw,
  ShieldCheck,
  X,
  Lock,
} from 'lucide-react';
import type {
  POSTransactionReceipt,
  PosRegisterShiftSession,
  PosShiftDenominationCount,
  RmaDisposition,
  RmaRefundMethod,
  SafeDropRecord,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { usePrint } from '../../context/PrintContext';

const IDR_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 100];

interface PosShiftModalProps {
  theme: 'light' | 'dark';
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  cashierName: string;
  activeShift: PosRegisterShiftSession | null;
  shiftHistory: PosRegisterShiftSession[];
  onShiftUpdated: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const PosShiftModal: React.FC<PosShiftModalProps> = ({
  theme,
  isOpen,
  onClose,
  storeId,
  storeName,
  cashierName,
  activeShift,
  shiftHistory,
  onShiftUpdated,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const { triggerPrint } = usePrint();
  const [openingFloatIDR, setOpeningFloatIDR] = useState<number>(500000);
  const [registerId, setRegisterId] = useState<string>('REG-04');
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({
    100000: 5,
    50000: 0,
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    100: 0,
  });
  const [countedQrisBatchIDR, setCountedQrisBatchIDR] = useState<number>(0);
  const [countedEdcBatchIDR, setCountedEdcBatchIDR] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [finalizedZReport, setFinalizedZReport] = useState<PosRegisterShiftSession | null>(null);

  const countedCashTotal = useMemo(() => {
    return IDR_DENOMINATIONS.reduce(
      (sum, denom) => sum + denom * (Math.max(0, denomCounts[denom] || 0)),
      0
    );
  }, [denomCounts]);

  if (!isOpen) return null;

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiClient.openPosShift({
        storeId,
        storeName,
        registerId,
        openingFloatIDR,
        cashierName,
      });
      onShowToast('Register Shift Opened', res.message);
      setFinalizedZReport(null);
      onShiftUpdated();
      onClose();
    } catch (err: any) {
      onShowToast('Open Shift Error', err.message || 'Failed to open shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShiftBlind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    setIsSubmitting(true);
    try {
      const denominations: PosShiftDenominationCount[] = IDR_DENOMINATIONS.map((denom) => {
        const count = Math.max(0, denomCounts[denom] || 0);
        return {
          denomination: denom,
          count,
          subtotalIDR: denom * count,
        };
      });
      const res = await apiClient.closePosShift({
        shiftId: activeShift.id,
        storeId,
        denominations,
        countedQrisBatchIDR,
        countedEdcBatchIDR,
        notes: closingNotes,
      });
      setFinalizedZReport(res.shift);
      onShowToast('Z-Report Finalized', res.message);
      onShiftUpdated();
    } catch (err: any) {
      onShowToast('Close Shift Error', err.message || 'Failed to finalize Z-Report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-3xl rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-5 my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto ${
          isLight
            ? 'bg-white border-gray-200 text-slate-900'
            : 'bg-zinc-900 border-zinc-800 text-zinc-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-[#0F4C3A] dark:text-emerald-400">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                POS Shift Control &amp; Blind Z-Report
              </span>
              <h3 className="text-base sm:text-lg font-bold">
                {finalizedZReport
                  ? `Z-Report Finalized · ${finalizedZReport.zReportNumber}`
                  : activeShift
                  ? `Close Shift & Blind Cash Count (${activeShift.id})`
                  : 'Open Cashier Shift (Modal Awal Laci)'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STATE 1: FINALIZED Z-REPORT REVEALING VARIANCE */}
        {finalizedZReport && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{finalizedZReport.zReportNumber} · Shift Closed &amp; Reconciled</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5">
                  Cashier: {finalizedZReport.cashierName} · Register {finalizedZReport.registerId} ·{' '}
                  {finalizedZReport.transactionCount} Transactions
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  triggerPrint({
                    type: 'pos_zreport',
                    format: 'thermal80',
                    shift: finalizedZReport,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F4C3A] text-white font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Z-Report
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono tabular-nums">
              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'}`}>
                <span className="text-[10px] font-sans font-semibold text-gray-500 dark:text-zinc-400 block">
                  Expected Cash in Drawer
                </span>
                <span className="text-base font-bold block mt-1">
                  {formatIDR(finalizedZReport.expectedTotalCashInDrawerIDR)}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-zinc-400 block">
                  Float {formatIDR(finalizedZReport.openingFloatIDR)} + Sales {formatIDR(finalizedZReport.expectedCashSalesIDR)}
                  {(finalizedZReport.safeDropsTotalIDR || 0) > 0
                    ? ` − Safe Drops ${formatIDR(finalizedZReport.safeDropsTotalIDR || 0)}`
                    : ''}
                </span>
              </div>

              <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'}`}>
                <span className="text-[10px] font-sans font-semibold text-gray-500 dark:text-zinc-400 block">
                  Blind Counted Cash
                </span>
                <span className="text-base font-bold text-blue-600 dark:text-blue-400 block mt-1">
                  {formatIDR(finalizedZReport.countedCashIDR || 0)}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                  QRIS: {formatIDR(finalizedZReport.countedQrisBatchIDR || 0)} · EDC: {formatIDR(finalizedZReport.countedEdcBatchIDR || 0)}
                </span>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  (finalizedZReport.cashVarianceIDR || 0) === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-rose-500/10 border-rose-500/30'
                }`}
              >
                <span className="text-[10px] font-sans font-semibold text-gray-500 dark:text-zinc-300 block">
                  Cash Over/Short (Selisih Kasir)
                </span>
                <span
                  className={`text-base font-extrabold block mt-1 ${
                    (finalizedZReport.cashVarianceIDR || 0) === 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {(finalizedZReport.cashVarianceIDR || 0) > 0 ? '+' : ''}
                  {formatIDR(finalizedZReport.cashVarianceIDR || 0)}
                </span>
                <span className="text-[10px] text-gray-600 dark:text-zinc-300">
                  {(finalizedZReport.cashVarianceIDR || 0) !== 0
                    ? `Posted to COA #5220 (${finalizedZReport.varianceGlVoucherIds?.join(', ')})`
                    : 'Balanced — Zero GL variance needed'}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setFinalizedZReport(null);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-[#0F4C3A] text-white font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: OPEN NEW SHIFT */}
        {!finalizedZReport && !activeShift && (
          <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
            <div
              className={`p-3.5 rounded-xl border ${
                isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Declare Opening Petty Cash Float (Modal Awal Laci)</span>
              </div>
              <p className="text-[11px] mt-0.5">
                Cashier must declare the starting cash drawer float before settling cash transactions so end-of-shift Z-Report variance (COA #5220) is tracked accurately.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">Store Hub</label>
                <input
                  type="text"
                  readOnly
                  value={storeName}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800 border-zinc-700'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Register Terminal ID</label>
                <input
                  type="text"
                  value={registerId}
                  onChange={(e) => setRegisterId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border font-mono ${
                    isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Opening Cash Float (IDR)</label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={openingFloatIDR}
                  onChange={(e) => setOpeningFloatIDR(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border font-mono font-bold ${
                    isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-zinc-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-bold cursor-pointer"
              >
                {isSubmitting ? 'Opening Shift...' : 'Open Shift & Start Register'}
              </button>
            </div>
          </form>
        )}

        {/* STATE 3: CLOSE ACTIVE SHIFT WITH BLIND DENOMINATION COUNT */}
        {!finalizedZReport && activeShift && (
          <form onSubmit={handleCloseShiftBlind} className="space-y-4 text-xs">
            <div
              className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                isLight ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-blue-950/30 border-blue-800/50 text-blue-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>
                  <strong>Blind Close Mode Active:</strong> System expected cash &amp; settlement totals remain hidden until you submit physical counts.
                </span>
              </div>
              <span className="font-mono font-bold">
                Txns Logged: {activeShift.transactionCount}
                {(activeShift.safeDropsTotalIDR || 0) > 0
                  ? ` · Safe Drops: ${formatIDR(activeShift.safeDropsTotalIDR || 0)}`
                  : ''}
              </span>
            </div>

            {/* Indonesian Rupiah Denomination Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {IDR_DENOMINATIONS.map((denom) => {
                const count = denomCounts[denom] || 0;
                return (
                  <div
                    key={denom}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'
                    }`}
                  >
                    <div>
                      <span className="font-mono font-bold block">
                        Rp {denom.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500 dark:text-zinc-400">
                        {formatIDR(denom * count)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={count}
                      onChange={(e) =>
                        setDenomCounts((prev) => ({
                          ...prev,
                          [denom]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className={`w-16 px-2 py-1 text-center font-mono font-bold rounded-lg border ${
                        isLight ? 'bg-white border-gray-300' : 'bg-zinc-900 border-zinc-700'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* EDC & QRIS Batch Totals + Counted Cash Sum */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'}`}>
                <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                  Physical Cash Counted
                </span>
                <span className="text-lg font-black font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
                  {formatIDR(countedCashTotal)}
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">QRIS Batch Total (IDR)</label>
                <input
                  type="number"
                  min={0}
                  value={countedQrisBatchIDR}
                  onChange={(e) => setCountedQrisBatchIDR(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border font-mono font-bold ${
                    isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">EDC Card Settlement Batch (IDR)</label>
                <input
                  type="number"
                  min={0}
                  value={countedEdcBatchIDR}
                  onChange={(e) => setCountedEdcBatchIDR(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-xl border font-mono font-bold ${
                    isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Cashier Handover / Variance Notes</label>
              <input
                type="text"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="e.g. Verified physical cash drawer + EDC BCA batch slip #04"
                className={`w-full px-3 py-2 rounded-xl border ${
                  isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                }`}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-zinc-700 font-semibold cursor-pointer"
              >
                Keep Shift Open
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Generating Z-Report...' : 'Close Shift & Generate Blind Z-Report'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Recent Closed Shifts History */}
        {shiftHistory.filter((s) => s.status === 'CLOSED').length > 0 && (
          <div className="pt-3 border-t border-gray-200 dark:border-zinc-800 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Z-Report Archive</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {shiftHistory
                .filter((s) => s.status === 'CLOSED')
                .slice(0, 5)
                .map((shf) => (
                  <div
                    key={shf.id}
                    className={`px-3 py-2 rounded-lg border flex items-center justify-between text-[11px] font-mono ${
                      isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/40 border-zinc-800'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{shf.zReportNumber || shf.id}</span>
                      <span className="font-sans text-gray-500 dark:text-zinc-400 ml-2">
                        {shf.cashierName} · {shf.transactionCount} txns
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>Counted: {formatIDR(shf.countedCashIDR || 0)}</span>
                      <span
                        className={`font-bold ${
                          (shf.cashVarianceIDR || 0) === 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        Var: {formatIDR(shf.cashVarianceIDR || 0)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// ============================================================================
// POS QUICK CUSTOMER RMA / NOTA RETUR MODAL
// ============================================================================
interface PosRmaQuickModalProps {
  theme: 'light' | 'dark';
  receipt: POSTransactionReceipt | null;
  onClose: () => void;
  onCompleted: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const PosRmaQuickModal: React.FC<PosRmaQuickModalProps> = ({
  theme,
  receipt,
  onClose,
  onCompleted,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const [selectedSkus, setSelectedSkus] = useState<Record<string, boolean>>({});
  const [dispositions, setDispositions] = useState<Record<string, RmaDisposition>>({});
  const [refundMethod, setRefundMethod] = useState<RmaRefundMethod>('CASH');
  const [customerNpwpOrNik, setCustomerNpwpOrNik] = useState<string>('');
  const [reason, setReason] = useState<string>('Damaged / Customer Return at Register');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (receipt) {
      setSelectedSkus({});
      setDispositions({});
      setCustomerNpwpOrNik('');
      setReason('Damaged / Customer Return at Register');
    }
  }, [receipt?.receiptNumber]);

  if (!receipt) return null;

  const toggleSku = (sku: string) => {
    setSelectedSkus((prev) => ({ ...prev, [sku]: !(prev[sku] ?? true) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenItems = receipt.items.filter((it) => selectedSkus[it.sku] ?? true);
    if (chosenItems.length === 0) {
      onShowToast('Select Items', 'Choose at least one line item to return.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiClient.createComplianceRma({
        sourceChannel: 'POS',
        sourceReferenceId: receipt.receiptNumber,
        storeId: receipt.storeId,
        storeName: receipt.storeName,
        customerName: 'POS Walk-in Customer',
        customerNpwpOrNik: customerNpwpOrNik.trim() || undefined,
        refundMethod,
        items: chosenItems.map((it) => ({
          sku: it.sku,
          productName: it.name,
          category: it.category,
          quantity: it.quantity,
          unitPriceIDR: it.unitPrice,
          unitCostIDR: it.unitCost,
          disposition: dispositions[it.sku] || 'RESTOCK_ATP',
          lotNumber: it.lotNumber,
          reason,
        })),
        notes: `POS Receipt Return (${receipt.receiptNumber})`,
      });
      onShowToast('Nota Retur Issued', res.message);
      onCompleted();
      onClose();
    } catch (err: any) {
      onShowToast('RMA Error', err.message || 'Failed to issue Nota Retur');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto ${
          isLight
            ? 'bg-white border-gray-200 text-slate-900'
            : 'bg-zinc-900 border-zinc-800 text-zinc-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="text-base font-bold">Process Return / RMA &amp; Nota Retur</h3>
              <p className="text-[11px] font-mono text-gray-500 dark:text-zinc-400">
                Receipt #{receipt.receiptNumber} · DJP PPN Keluaran Auto-Adjustment
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {receipt.items.map((item) => {
              const checked = selectedSkus[item.sku] ?? true;
              const disp = dispositions[item.sku] || 'RESTOCK_ATP';
              return (
                <div
                  key={item.sku}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/60 border-zinc-700'
                  }`}
                >
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSku(item.sku)}
                      className="w-4 h-4 rounded accent-[#0F4C3A]"
                    />
                    <div>
                      <span className="font-bold block">{item.name}</span>
                      <span className="font-mono text-[10px] text-gray-500 dark:text-zinc-400">
                        {item.quantity} {item.unit} · {formatIDR(item.lineTotal)}
                      </span>
                    </div>
                  </label>

                  <select
                    value={disp}
                    onChange={(e) =>
                      setDispositions((prev) => ({
                        ...prev,
                        [item.sku]: e.target.value as RmaDisposition,
                      }))
                    }
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold ${
                      isLight ? 'bg-white border-gray-300' : 'bg-zinc-900 border-zinc-700'
                    }`}
                  >
                    <option value="RESTOCK_ATP">Good Condition (Restock ATP)</option>
                    <option value="SCRAP_QUARANTINE">Damaged/Expired (Scrap Quarantine)</option>
                  </select>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Refund Settlement</label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as RmaRefundMethod)}
                className={`w-full px-3 py-2 rounded-xl border font-semibold ${
                  isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                }`}
              >
                <option value="CASH">Cash Drawer Refund (#1010)</option>
                <option value="STORE_CREDIT">Store Credit Voucher (#2020)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Buyer NIK / NPWP (Optional Nota Retur)</label>
              <input
                type="text"
                value={customerNpwpOrNik}
                onChange={(e) => setCustomerNpwpOrNik(e.target.value)}
                placeholder="16-digit NIK/NPWP for DJP Nota Retur"
                className={`w-full px-3 py-2 rounded-xl border font-mono ${
                  isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Return Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border ${
                isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
              }`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-zinc-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
            >
              {isSubmitting ? 'Issuing Credit Note...' : 'Issue Nota Retur & Update Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

// ============================================================================
// POS CASHIER SAFE DROP (SETOR BRANKAS) MODAL
// ============================================================================
interface PosSafeDropModalProps {
  theme: 'light' | 'dark';
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  activeShift: PosRegisterShiftSession | null;
  onSafeDropCompleted: (updatedShift: PosRegisterShiftSession, safeDrop: SafeDropRecord) => void;
  onShowToast: (title: string, message: string) => void;
}

export const PosSafeDropModal: React.FC<PosSafeDropModalProps> = ({
  theme,
  isOpen,
  onClose,
  storeId,
  storeName,
  activeShift,
  onSafeDropCompleted,
  onShowToast,
}) => {
  const isLight = theme === 'light';
  const { triggerPrint } = usePrint();
  const [amountIDR, setAmountIDR] = useState<number>(1000000);
  const [supervisorName, setSupervisorName] = useState<string>('Store Manager / Head Cashier');
  const [sealBagNumber, setSealBagNumber] = useState<string>(`BAG-${Date.now().toString().slice(-5)}`);
  const [notes, setNotes] = useState<string>('Mid-shift drawer cash skim to back-office vault');
  const [recentDrops, setRecentDrops] = useState<SafeDropRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const drawerBalance = activeShift?.expectedTotalCashInDrawerIDR ?? 0;

  useEffect(() => {
    if (!isOpen) return;
    setSealBagNumber(`BAG-${Date.now().toString().slice(-5)}`);
    if (drawerBalance > 0 && amountIDR > drawerBalance) {
      setAmountIDR(Math.max(100000, Math.floor(drawerBalance / 100000) * 100000));
    }
    apiClient
      .getPosSafeDrops(storeId, activeShift?.id)
      .then(setRecentDrops)
      .catch(() => {});
  }, [isOpen, storeId, activeShift?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) {
      onShowToast('No Active Shift', 'Please open a POS Register Shift before executing a Safe Drop.');
      return;
    }
    if (amountIDR <= 0 || amountIDR > drawerBalance) {
      onShowToast(
        'Invalid Safe Drop Amount',
        `Safe drop amount (${formatIDR(amountIDR)}) must be > 0 and <= current drawer balance (${formatIDR(drawerBalance)}).`
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiClient.createPosSafeDrop({
        storeId,
        shiftId: activeShift.id,
        amountIDR,
        supervisorName,
        sealBagNumber,
        notes,
      });
      onShowToast('Safe Drop Recorded', res.message);
      onSafeDropCompleted(res.shift, res.safeDrop);
      onClose();
      triggerPrint({
        type: 'pos_safe_drop',
        format: 'thermal80',
        safeDrop: res.safeDrop,
      });
    } catch (err: any) {
      onShowToast('Safe Drop Failed', err?.message || 'Unable to execute safe drop');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative max-h-[calc(100vh-2rem)] overflow-y-auto ${
          isLight
            ? 'bg-white border-gray-200 text-slate-900'
            : 'bg-zinc-900 border-zinc-800 text-zinc-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                POS Treasury · COA #1011 → #1010
              </span>
              <h3 className="text-base font-bold">Cashier Safe Drop (Setor Brankas)</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`p-3.5 rounded-xl border grid grid-cols-2 gap-3 text-xs font-mono ${
            drawerBalance >= 5000000
              ? 'bg-amber-500/10 border-amber-500/30'
              : isLight
              ? 'bg-gray-50 border-gray-200'
              : 'bg-zinc-800/60 border-zinc-700'
          }`}
        >
          <div>
            <span className="text-[10px] font-sans opacity-75 block">Current Drawer Cash (#1011)</span>
            <span className="text-sm font-bold text-[#0F4C3A] dark:text-emerald-400">
              {formatIDR(drawerBalance)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-sans opacity-75 block">Shift Safe Drops So Far</span>
            <span className="text-sm font-bold">
              {formatIDR(activeShift?.safeDropsTotalIDR || 0)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold mb-1">Safe Drop Amount (IDR)</label>
            <input
              type="number"
              min={10000}
              max={Math.max(10000, drawerBalance)}
              step={50000}
              value={amountIDR}
              onChange={(e) => setAmountIDR(Math.max(0, Number(e.target.value) || 0))}
              className={`w-full px-3 py-2 rounded-xl border font-mono text-sm font-bold ${
                isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
              }`}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[500000, 1000000, 2000000, 5000000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={preset > drawerBalance}
                  onClick={() => setAmountIDR(preset)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer disabled:opacity-40 ${
                    isLight ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  {formatIDR(preset)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Receiving Supervisor / Witness</label>
              <input
                type="text"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border ${
                  isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                }`}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tamper-Evident Seal Bag #</label>
              <input
                type="text"
                value={sealBagNumber}
                onChange={(e) => setSealBagNumber(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border font-mono ${
                  isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border ${
                isLight ? 'bg-white border-gray-300' : 'bg-zinc-800 border-zinc-700'
              }`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-zinc-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !activeShift || amountIDR <= 0 || amountIDR > drawerBalance}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] text-white font-bold cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording Drop...' : 'Confirm Safe Drop & Print Slip'}</span>
            </button>
          </div>
        </form>

        {recentDrops.length > 0 && (
          <div className="pt-3 border-t border-gray-200 dark:border-zinc-800 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Shift Safe Drop Audit History ({storeName})
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {recentDrops.slice(0, 4).map((sd) => (
                <div
                  key={sd.id}
                  className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-[11px] font-mono ${
                    isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/40 border-zinc-800'
                  }`}
                >
                  <span>
                    {sd.slipNumber} · {sd.sealBagNumber || 'Vault'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {formatIDR(sd.amountIDR)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        triggerPrint({
                          type: 'pos_safe_drop',
                          format: 'thermal80',
                          safeDrop: sd,
                        })
                      }
                      className="text-[10px] underline cursor-pointer"
                    >
                      Reprint
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

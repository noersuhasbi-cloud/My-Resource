import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react';
import type { ComplianceRecallTraceResponse } from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';
import { DocumentDispatchModal } from './DocumentDispatchModal';

interface BatchRecallTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  initialLotNumber?: string;
  onShowToast?: (title: string, message: string) => void;
  onRecallExecuted?: () => void;
}

export const BatchRecallTraceModal: React.FC<BatchRecallTraceModalProps> = ({
  isOpen,
  onClose,
  theme,
  initialLotNumber = '',
  onShowToast,
  onRecallExecuted,
}) => {
  const isLight = theme === 'light';
  const [lotQuery, setLotQuery] = useState(initialLotNumber);
  const [trace, setTrace] = useState<ComplianceRecallTraceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [reason, setReason] = useState('BPOM / HACCP Food Safety Batch Recall Freeze');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dispatchChannel, setDispatchChannel] = useState<'email' | 'whatsapp' | 'both' | null>(null);

  const loadTrace = async (targetLot: string) => {
    const clean = targetLot.trim();
    if (!clean) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.getComplianceRecallTrace(clean);
      setTrace(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to trace batch lot.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialLotNumber) {
      setLotQuery(initialLotNumber);
      loadTrace(initialLotNumber);
    }
  }, [isOpen, initialLotNumber]);

  const handleExecuteRecall = async () => {
    if (!trace?.lotNumber) return;
    setExecuting(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.executeComplianceRecall(trace.lotNumber, reason);
      setTrace(res.trace);
      onShowToast?.('BPOM Batch Recall Locked', res.message);
      onRecallExecuted?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to execute batch recall freeze.');
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="BPOM HACCP Batch Recall Traceability"
    >
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-zinc-900 border-zinc-800 text-zinc-100'
        }`}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isLight ? 'bg-rose-50/70 border-stone-200' : 'bg-rose-950/20 border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">
                1-Click BPOM / HACCP Batch Recall Traceability
              </h3>
              <p className={`text-xs truncate ${isLight ? 'text-stone-500' : 'text-zinc-400'}`}>
                Live upstream PO/GR/QC lineage &amp; downstream B2B/POS/Transfer impact freeze
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isLight ? 'border-stone-200 hover:bg-stone-100 text-stone-600' : 'border-zinc-700 hover:bg-zinc-800 text-zinc-300'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={lotQuery}
                onChange={(e) => setLotQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadTrace(lotQuery)}
                placeholder="Enter Lot Number or Batch ID (e.g. LOT-2603-A)..."
                className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs font-mono ${
                  isLight ? 'bg-stone-50 border-stone-300 text-stone-900' : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                }`}
              />
            </div>
            <button
              type="button"
              onClick={() => loadTrace(lotQuery)}
              disabled={loading || !lotQuery.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Trace Lot Lineage</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {trace && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  trace.isQuarantined
                    ? 'border-rose-500/40 bg-rose-500/10'
                    : isLight
                    ? 'border-stone-200 bg-stone-50'
                    : 'border-zinc-800 bg-zinc-950/60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm">{trace.lotNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        trace.isQuarantined
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                      }`}
                    >
                      {trace.isQuarantined ? 'QUARANTINED & SALES LOCKED' : 'ACTIVE LOT'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold mt-1">
                    {trace.sku || 'Unknown SKU'} — {trace.productName}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${isLight ? 'text-stone-500' : 'text-zinc-400'}`}>
                    Remaining across {trace.currentHoldings.length} batch record(s):{' '}
                    <span className="font-bold">{trace.totalRemainingUnits} units</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatchChannel('both')}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      isLight
                        ? 'border-stone-300 bg-white hover:bg-stone-50 text-stone-700'
                        : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-sky-500" />
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Dispatch Recall Alert</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRecall}
                    disabled={executing || trace.isQuarantined}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {trace.isQuarantined ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>
                      {trace.isQuarantined
                        ? 'All Lots Frozen'
                        : executing
                        ? 'Freezing...'
                        : 'Quarantine & Freeze All Remaining Lots'}
                    </span>
                  </button>
                </div>
              </div>

              {!trace.isQuarantined && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1 opacity-75">
                    BPOM / HACCP Recall Audit Reason
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-xl border text-xs ${
                      isLight ? 'bg-white border-stone-300' : 'bg-zinc-950 border-zinc-700'
                    }`}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upstream Origin */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${isLight ? 'border-stone-200 bg-white' : 'border-zinc-800 bg-zinc-950/40'}`}>
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Upstream Origin (PO / GR / QC)</span>
                  </h4>
                  <div className="text-[11px] space-y-1">
                    <div>
                      <span className="opacity-70">Suppliers:</span>{' '}
                      <span className="font-semibold">{trace.origin.supplierNames.join(', ') || 'Direct Seed'}</span>
                    </div>
                    <div>
                      <span className="opacity-70">PO Numbers:</span>{' '}
                      <span className="font-mono font-semibold">{trace.origin.poNumbers.join(', ') || 'None'}</span>
                    </div>
                    <div>
                      <span className="opacity-70">Goods Receipts:</span>{' '}
                      {trace.origin.goodsReceipts.length === 0 ? (
                        <span>None linked</span>
                      ) : (
                        trace.origin.goodsReceipts.map((g) => (
                          <div key={g.id} className="font-mono text-[10px] pl-2 border-l border-emerald-500/40 mt-1">
                            {g.id} (PO {g.poId}) • {g.qtyReceived} u @ {g.storeName}
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      <span className="opacity-70">QC Inspections:</span>{' '}
                      {trace.origin.qcInspections.length === 0 ? (
                        <span>None logged</span>
                      ) : (
                        trace.origin.qcInspections.map((q) => (
                          <div key={q.id} className="font-mono text-[10px] pl-2 border-l border-amber-500/40 mt-1">
                            {q.id} • {q.disposition} ({q.temperatureCelsius}°C) by {q.inspectorName}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Current Holdings */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${isLight ? 'border-stone-200 bg-white' : 'border-zinc-800 bg-zinc-950/40'}`}>
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-sky-500" />
                    <span>Live Outlet &amp; Rack Holdings ({trace.currentHoldings.length})</span>
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {trace.currentHoldings.length === 0 ? (
                      <p className="text-[11px] opacity-60">No active batch records found.</p>
                    ) : (
                      trace.currentHoldings.map((h) => (
                        <div
                          key={h.batchId}
                          className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                            isLight ? 'border-stone-200 bg-stone-50' : 'border-zinc-800 bg-zinc-900'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{h.storeName}</div>
                            <div className="font-mono text-[10px] opacity-75">
                              {h.batchId} • Bin {h.rackBinCode}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold">{h.currentStock} u</div>
                            <div className="text-[10px] uppercase font-bold text-rose-500">{h.status}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Downstream Customer & Transfer Exposure */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${isLight ? 'border-stone-200 bg-white' : 'border-zinc-800 bg-zinc-950/40'}`}>
                <h4 className="text-xs font-bold">Downstream Customer &amp; Branch Exposure</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className={`p-2.5 rounded-lg border ${isLight ? 'border-stone-200 bg-stone-50' : 'border-zinc-800 bg-zinc-900'}`}>
                    <div className="opacity-70">B2B Wholesale Orders</div>
                    <div className="text-base font-black font-mono">{trace.downstreamImpact.b2bOrders.length}</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${isLight ? 'border-stone-200 bg-stone-50' : 'border-zinc-800 bg-zinc-900'}`}>
                    <div className="opacity-70">POS Retail Receipts</div>
                    <div className="text-base font-black font-mono">{trace.downstreamImpact.posReceipts.length}</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${isLight ? 'border-stone-200 bg-stone-50' : 'border-zinc-800 bg-zinc-900'}`}>
                    <div className="opacity-70">B2C Online Orders</div>
                    <div className="text-base font-black font-mono">{trace.downstreamImpact.b2cOrders.length}</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${isLight ? 'border-stone-200 bg-stone-50' : 'border-zinc-800 bg-zinc-900'}`}>
                    <div className="opacity-70">Branch Transfers</div>
                    <div className="text-base font-black font-mono">{trace.downstreamImpact.transfers.length}</div>
                  </div>
                </div>

                {(trace.downstreamImpact.b2bOrders.length > 0 ||
                  trace.downstreamImpact.posReceipts.length > 0 ||
                  trace.downstreamImpact.transfers.length > 0) && (
                  <div className="space-y-1 pt-1 max-h-36 overflow-y-auto text-[11px] font-mono">
                    {trace.downstreamImpact.b2bOrders.map((o) => (
                      <div key={o.orderId} className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                        B2B {o.orderId} • {o.companyName} ({o.qty} units) • {o.status}
                      </div>
                    ))}
                    {trace.downstreamImpact.posReceipts.map((r) => (
                      <div key={r.receiptNumber} className="px-2 py-1 rounded bg-sky-500/10 border border-sky-500/20">
                        POS {r.receiptNumber} • {r.storeName} ({r.qty} units, {formatIDR(r.totalIDR)})
                      </div>
                    ))}
                    {trace.downstreamImpact.transfers.map((t) => (
                      <div key={t.transferId} className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                        TRF {t.transferId} • {t.fromStoreName} → {t.toStoreName} ({t.qty} u, {t.status})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {dispatchChannel && trace && (
        <DocumentDispatchModal
          isOpen={true}
          onClose={() => setDispatchChannel(null)}
          theme={theme}
          initialChannel={dispatchChannel}
          docType="RECALL_ALERT"
          docId={trace.lotNumber}
          docNumber={trace.lotNumber}
          docSummary={`${trace.sku} — ${trace.productName} (${trace.totalRemainingUnits} units)`}
          defaultRecipientName="BPOM & Branch QA Coordinators"
          onShowToast={onShowToast}
        />
      )}
    </div>,
    document.body
  );
};

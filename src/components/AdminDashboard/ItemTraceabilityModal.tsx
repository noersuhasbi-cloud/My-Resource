import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  GitBranch,
  FileText,
  ShoppingCart,
  PackageCheck,
  Boxes,
  Receipt,
  ArrowRight,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type {
  CrossDocumentNavTarget,
  ItemInboundTraceabilityResponse,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';

interface ItemTraceabilityModalProps {
  theme: 'light' | 'dark';
  sku: string;
  productName?: string;
  onClose: () => void;
  onNavigateToDocument?: (nav: CrossDocumentNavTarget) => void;
}

function getStatusPillClass(statusRaw: string, isLight: boolean): string {
  const s = String(statusRaw || '').toUpperCase();
  if (
    s.includes('APPROVED') ||
    s.includes('COMPLETED') ||
    s.includes('PAID') ||
    s.includes('PASSED') ||
    s.includes('FRESH') ||
    s.includes('MATCHED') ||
    s === 'ACTIVE'
  ) {
    return isLight
      ? 'bg-emerald-50 text-[#0F4C3A] border-emerald-200/90'
      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
  }
  if (
    s.includes('PARTIAL') ||
    s.includes('PENDING') ||
    s.includes('SENT') ||
    s.includes('NEAR_EXPIRY') ||
    s.includes('UNPAID')
  ) {
    return isLight
      ? 'bg-amber-50 text-amber-800 border-amber-200/90'
      : 'bg-amber-950/50 text-amber-300 border-amber-800/60';
  }
  if (
    s.includes('REJECT') ||
    s.includes('VOID') ||
    s.includes('EXPIRED') ||
    s.includes('CRITICAL') ||
    s.includes('VARIANCE') ||
    s.includes('CANCEL') ||
    s.includes('QUARANTIN')
  ) {
    return isLight
      ? 'bg-rose-50 text-rose-700 border-rose-200/90'
      : 'bg-rose-950/50 text-rose-300 border-rose-800/60';
  }
  return isLight
    ? 'bg-[#EEF2F0] text-[#13221B] border-[#D5DFD9]'
    : 'bg-slate-900 text-slate-300 border-slate-700/80';
}

function formatShortDate(iso?: string): string {
  if (!iso) return '—';
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

export const ItemTraceabilityModal: React.FC<ItemTraceabilityModalProps> = ({
  theme,
  sku,
  productName,
  onClose,
  onNavigateToDocument,
}) => {
  const isLight = theme === 'light';
  const [data, setData] = useState<ItemInboundTraceabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTraceability = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.getItemTraceability(sku);
      setData(res);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load inbound supply-chain lineage.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTraceability();
  }, [sku]);

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleJump = (nav: CrossDocumentNavTarget) => {
    if (!onNavigateToDocument) return;
    onClose();
    onNavigateToDocument(nav);
  };

  // Smoked Sage-Stone Light Mode & Obsidian Dark Mode tokens
  const surfaceClass = isLight
    ? 'bg-[#F7F9F8] border-[#D7E0DB] text-[#13221B]'
    : 'bg-[#12141C] border-slate-800/90 text-[#ECFDF5]';
  const headerClass = isLight
    ? 'bg-[#EEF2F0] border-[#D7E0DB]'
    : 'bg-[#090A0F] border-slate-800/90';
  const cardClass = isLight
    ? 'bg-white border-[#DDE5E0] text-[#13221B]'
    : 'bg-[#090A0F] border-slate-800/80 text-[#ECFDF5]';
  const mutedText = isLight ? 'text-[#4B6156]' : 'text-slate-400';
  const chipButtonClass = (tone: 'emerald' | 'sky' | 'amber' | 'indigo') => {
    if (tone === 'emerald') {
      return isLight
        ? 'bg-emerald-50 text-[#0F4C3A] border-emerald-200 hover:bg-emerald-100'
        : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/70';
    }
    if (tone === 'sky') {
      return isLight
        ? 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
        : 'bg-sky-950/60 text-sky-300 border-sky-800/60 hover:bg-sky-900/70';
    }
    if (tone === 'amber') {
      return isLight
        ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
        : 'bg-amber-950/50 text-amber-300 border-amber-800/60 hover:bg-amber-900/60';
    }
    return isLight
      ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
      : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60 hover:bg-indigo-900/70';
  };

  if (typeof document === 'undefined') return null;

  const stages = [
    {
      key: 'pr',
      label: 'Purchase Req',
      short: 'PR',
      count: data?.summary.prCount ?? 0,
      icon: FileText,
    },
    {
      key: 'po',
      label: 'Purchase Order',
      short: 'PO',
      count: data?.summary.poCount ?? 0,
      icon: ShoppingCart,
    },
    {
      key: 'gr',
      label: 'Goods Receipt',
      short: 'GR',
      count: data?.summary.grCount ?? 0,
      icon: PackageCheck,
    },
    {
      key: 'lot',
      label: 'Lot & Rack',
      short: 'LOT',
      count: data?.summary.lotCount ?? 0,
      icon: Boxes,
    },
    {
      key: 'bill',
      label: data?.financialDataMasked ? 'Vendor Bill (Locked)' : 'Vendor Bill',
      short: 'BILL',
      count: data?.financialDataMasked ? null : data?.summary.vendorBillCount ?? 0,
      icon: data?.financialDataMasked ? Lock : Receipt,
    },
  ];

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-sm overflow-y-auto"
    >
      <div
        className={`w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col ${surfaceClass}`}
      >
        {/* Modal Header */}
        <div className={`px-5 py-4 border-b flex items-start sm:items-center justify-between gap-4 shrink-0 ${headerClass}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide bg-[#0F4C3A] text-white">
                <GitBranch className="w-3.5 h-3.5" />
                Inbound Traceability
              </span>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md border ${
                  isLight
                    ? 'bg-white border-[#D5DFD9] text-[#0F4C3A]'
                    : 'bg-[#12141C] border-slate-700/80 text-emerald-300'
                }`}
              >
                {data?.sku || sku}
              </span>
              {data?.financialDataMasked && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                    isLight
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-amber-950/50 border-amber-800/60 text-amber-300'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  Physical Lineage Only (Financial Masked)
                </span>
              )}
            </div>
            <h3 className={`text-base sm:text-lg font-bold mt-1.5 leading-snug ${isLight ? 'text-[#13221B]' : 'text-[#ECFDF5]'}`}>
              {data?.productName || productName || sku}
            </h3>
            <p className={`text-xs mt-0.5 ${mutedText}`}>
              End-to-end bidirectional genealogy: Purchase Requisition &rarr; Purchase Order &rarr; Goods Receipt &rarr; Lot/Rack &rarr; Vendor Bill
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadTraceability}
              disabled={isLoading}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-[#D5DFD9] text-[#13221B] hover:bg-[#E8EFEA]'
                  : 'bg-[#12141C] border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
              title="Refresh Lineage"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-[#D5DFD9] text-[#13221B] hover:bg-[#E8EFEA]'
                  : 'bg-[#12141C] border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
              aria-label="Close traceability modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-[#0F4C3A] dark:text-emerald-400" />
              <p className={`text-xs font-medium ${mutedText}`}>
                Resolving inbound supply-chain genealogy for {sku}...
              </p>
            </div>
          ) : errorMessage ? (
            <div
              className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
                isLight
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
              }`}
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : data ? (
            <>
              {/* Visual Pipeline Stepper */}
              <div className={`p-4 rounded-2xl border ${cardClass}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 flex-1">
                    {stages.map((st, idx) => {
                      const Icon = st.icon;
                      const active = st.count !== null && st.count > 0;
                      return (
                        <div key={st.key} className="flex items-center gap-2">
                          <div
                            className={`flex-1 p-3 rounded-xl border transition-colors ${
                              active
                                ? isLight
                                  ? 'bg-[#EEF5F1] border-[#BFD4C8]'
                                  : 'bg-emerald-950/35 border-emerald-800/50'
                                : isLight
                                ? 'bg-[#F7F9F8] border-[#E3EAE6]'
                                : 'bg-[#12141C] border-slate-800/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider ${
                                  active
                                    ? 'text-[#0F4C3A] dark:text-emerald-300'
                                    : mutedText
                                }`}
                              >
                                {st.short}
                              </span>
                              <Icon
                                className={`w-3.5 h-3.5 ${
                                  active
                                    ? 'text-[#0F4C3A] dark:text-emerald-400'
                                    : mutedText
                                }`}
                              />
                            </div>
                            <div
                              className={`text-lg font-bold font-mono tabular-nums mt-1 ${
                                isLight ? 'text-[#13221B]' : 'text-[#ECFDF5]'
                              }`}
                            >
                              {st.count === null ? '—' : st.count}
                            </div>
                            <div className={`text-[11px] truncate ${mutedText}`}>{st.label}</div>
                          </div>
                          {idx < stages.length - 1 && (
                            <ArrowRight
                              className={`hidden sm:block w-3.5 h-3.5 shrink-0 ${mutedText}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Physical Stock Strip */}
                <div
                  className={`mt-3.5 pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${
                    isLight ? 'border-[#E3EAE6]' : 'border-slate-800/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-4 tabular-nums">
                    <span>
                      <span className={mutedText}>On-Hand Stock: </span>
                      <strong className="font-mono">
                        {data.summary.totalOnHandStock.toLocaleString('id-ID')} {data.unit || 'pcs'}
                      </strong>
                    </span>
                    <span>
                      <span className={mutedText}>Incoming PO: </span>
                      <strong className="font-mono text-sky-700 dark:text-sky-400">
                        +{data.summary.totalIncomingStock.toLocaleString('id-ID')} {data.unit || 'pcs'}
                      </strong>
                    </span>
                    <span>
                      <span className={mutedText}>Cumulative GR Received: </span>
                      <strong className="font-mono text-[#0F4C3A] dark:text-emerald-400">
                        {data.summary.totalReceivedQty.toLocaleString('id-ID')} {data.unit || 'pcs'}
                      </strong>
                    </span>
                  </div>
                  <span className={`text-[11px] font-mono ${mutedText}`}>
                    Click any document pill to jump directly to source record
                  </span>
                </div>
              </div>

              {/* 5-Stage Breathable Lineage Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* STAGE 1: PURCHASE REQUISITIONS (PR) */}
                <section className={`rounded-2xl border p-4 space-y-3 ${cardClass}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-[#0F4C3A] dark:text-emerald-400">
                      <FileText className="w-4 h-4" />
                      1. Purchase Requisitions (PR)
                    </h4>
                    <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                      {data.prs.length} record(s)
                    </span>
                  </div>
                  {data.prs.length === 0 ? (
                    <p className={`text-xs py-3 ${mutedText}`}>
                      No Purchase Requisition records linked directly to this SKU.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.prs.map((pr) => (
                        <div
                          key={pr.id}
                          className={`p-3.5 rounded-xl border space-y-2 ${
                            isLight
                              ? 'bg-[#F7F9F8] border-[#DFE7E2]'
                              : 'bg-[#12141C] border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleJump({ target: 'pr', documentId: pr.id })}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-xs font-bold transition-colors cursor-pointer ${chipButtonClass('amber')}`}
                            >
                              <span>{pr.id}</span>
                              {onNavigateToDocument && <ExternalLink className="w-3 h-3" />}
                            </button>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getStatusPillClass(
                                pr.status,
                                isLight
                              )}`}
                            >
                              {pr.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                            <span className={mutedText}>
                              By <strong className={isLight ? 'text-[#13221B]' : 'text-[#ECFDF5]'}>{pr.requestedBy}</strong> ·{' '}
                              {formatShortDate(pr.createdAt)}
                            </span>
                            <span className="font-mono font-semibold">
                              Qty: {pr.suggestedQuantity} {data.unit || 'pcs'}
                              {!data.financialDataMasked && typeof pr.totalEstimatedCost === 'number'
                                ? ` · ${formatIDR(pr.totalEstimatedCost)}`
                                : ''}
                            </span>
                          </div>
                          {pr.linkedPoIds.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className={`text-[10px] font-semibold uppercase ${mutedText}`}>
                                Issued PO:
                              </span>
                              {pr.linkedPoIds.map((poId) => (
                                <button
                                  key={poId}
                                  type="button"
                                  onClick={() => handleJump({ target: 'po', documentId: poId })}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold transition-colors cursor-pointer ${chipButtonClass('sky')}`}
                                >
                                  {poId}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* STAGE 2: PURCHASE ORDERS (PO) */}
                <section className={`rounded-2xl border p-4 space-y-3 ${cardClass}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-sky-700 dark:text-sky-400">
                      <ShoppingCart className="w-4 h-4" />
                      2. Purchase Orders (PO)
                    </h4>
                    <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                      {data.pos.length} record(s)
                    </span>
                  </div>
                  {data.pos.length === 0 ? (
                    <p className={`text-xs py-3 ${mutedText}`}>
                      No Purchase Orders found for this SKU.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.pos.map((po) => (
                        <div
                          key={po.id}
                          className={`p-3.5 rounded-xl border space-y-2 ${
                            isLight
                              ? 'bg-[#F7F9F8] border-[#DFE7E2]'
                              : 'bg-[#12141C] border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleJump({ target: 'po', documentId: po.id })}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-xs font-bold transition-colors cursor-pointer ${chipButtonClass('sky')}`}
                            >
                              <span>{po.id}</span>
                              {onNavigateToDocument && <ExternalLink className="w-3 h-3" />}
                            </button>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getStatusPillClass(
                                po.status,
                                isLight
                              )}`}
                            >
                              {po.status}
                            </span>
                          </div>
                          <div className="text-xs font-semibold leading-snug">
                            {po.supplierName}{' '}
                            <span className={`font-normal ${mutedText}`}>({po.storeName})</span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                            <span className="font-mono">
                              Received{' '}
                              <strong className="text-[#0F4C3A] dark:text-emerald-400">
                                {po.receivedQuantity}
                              </strong>{' '}
                              / {po.orderedQuantity} {data.unit || 'pcs'}
                              {po.remainingBackorder > 0 ? ` (BO: ${po.remainingBackorder})` : ''}
                            </span>
                            {!data.financialDataMasked && typeof po.totalCost === 'number' && (
                              <span className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-300">
                                {formatIDR(po.totalCost)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {po.sourcePrId && (
                              <button
                                type="button"
                                onClick={() => handleJump({ target: 'pr', documentId: po.sourcePrId! })}
                                className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-pointer ${chipButtonClass('amber')}`}
                              >
                                PR: {po.sourcePrId}
                              </button>
                            )}
                            {po.linkedGrIds.map((gid) => (
                              <button
                                key={gid}
                                type="button"
                                onClick={() => handleJump({ target: 'gr', documentId: gid })}
                                className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-pointer ${chipButtonClass('emerald')}`}
                              >
                                {gid}
                              </button>
                            ))}
                            {!data.financialDataMasked &&
                              po.linkedVendorBillIds.map((bid) => (
                                <button
                                  key={bid}
                                  type="button"
                                  onClick={() => handleJump({ target: 'vendor_bill', documentId: bid })}
                                  className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-pointer ${chipButtonClass('indigo')}`}
                                >
                                  {bid}
                                </button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* STAGE 3: GOODS RECEIPTS (GR) */}
                <section className={`rounded-2xl border p-4 space-y-3 ${cardClass}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-[#0F4C3A] dark:text-emerald-400">
                      <PackageCheck className="w-4 h-4" />
                      3. Goods Receipts (GR / Dock Inward)
                    </h4>
                    <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                      {data.grs.length} delivery(s)
                    </span>
                  </div>
                  {data.grs.length === 0 ? (
                    <p className={`text-xs py-3 ${mutedText}`}>
                      No Goods Receipt records logged yet for this SKU.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.grs.map((gr) => (
                        <div
                          key={gr.id}
                          className={`p-3.5 rounded-xl border space-y-2 ${
                            isLight
                              ? 'bg-[#F7F9F8] border-[#DFE7E2]'
                              : 'bg-[#12141C] border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleJump({ target: 'gr', documentId: gr.id })}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-xs font-bold transition-colors cursor-pointer ${chipButtonClass('emerald')}`}
                            >
                              <span>{gr.id}</span>
                              {onNavigateToDocument && <ExternalLink className="w-3 h-3" />}
                            </button>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getStatusPillClass(
                                  gr.isPartial ? 'PARTIAL' : 'COMPLETED',
                                  isLight
                                )}`}
                              >
                                {gr.isPartial ? 'Partial GR' : 'Full GR'}
                              </span>
                              {gr.qcStatus && (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getStatusPillClass(
                                    gr.qcStatus,
                                    isLight
                                  )}`}
                                >
                                  QC: {gr.qcStatus}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                            <span className={mutedText}>
                              SJ: <strong className="font-mono">{gr.deliveryNoteNumber}</strong> ·{' '}
                              {formatShortDate(gr.receivedAt)}
                            </span>
                            <span className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                              +{gr.quantityReceived} {data.unit || 'pcs'}
                            </span>
                          </div>
                          <div className={`text-[11px] flex flex-wrap items-center justify-between gap-2 ${mutedText}`}>
                            <span>
                              Lot: <strong className="font-mono">{gr.batchNumber}</strong> · {gr.qualityCondition}
                            </span>
                            <span>By {gr.receivedBy}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {gr.sourcePoId && (
                              <button
                                type="button"
                                onClick={() => handleJump({ target: 'po', documentId: gr.sourcePoId! })}
                                className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-pointer ${chipButtonClass('sky')}`}
                              >
                                {gr.sourcePoId}
                              </button>
                            )}
                            {!data.financialDataMasked &&
                              gr.linkedVendorBillIds.map((bid) => (
                                <button
                                  key={bid}
                                  type="button"
                                  onClick={() => handleJump({ target: 'vendor_bill', documentId: bid })}
                                  className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-pointer ${chipButtonClass('indigo')}`}
                                >
                                  {bid}
                                </button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* STAGE 4: LOTS / BATCHES & WAREHOUSE RACKS */}
                <section className={`rounded-2xl border p-4 space-y-3 ${cardClass}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-teal-700 dark:text-teal-400">
                      <Boxes className="w-4 h-4" />
                      4. Lots / Batches &amp; Rack Topology
                    </h4>
                    <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                      {data.lotsAndRacks.length} batch(es)
                    </span>
                  </div>
                  {data.lotsAndRacks.length === 0 ? (
                    <p className={`text-xs py-3 ${mutedText}`}>
                      No active FEFO batches assigned to racks for this SKU.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {data.lotsAndRacks.map((lot) => (
                        <div
                          key={lot.batchId}
                          className={`p-3.5 rounded-xl border space-y-2 ${
                            isLight
                              ? 'bg-[#F7F9F8] border-[#DFE7E2]'
                              : 'bg-[#12141C] border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold">
                              {lot.lotNumber}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                                  isLight
                                    ? 'bg-white border-[#D5DFD9] text-[#13221B]'
                                    : 'bg-[#090A0F] border-slate-700 text-slate-200'
                                }`}
                              >
                                <MapPin className="w-3 h-3 text-[#0F4C3A] dark:text-emerald-400" />
                                {lot.rackBinCode}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getStatusPillClass(
                                  lot.status,
                                  isLight
                                )}`}
                              >
                                {lot.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                            <span className={mutedText}>
                              {lot.storeName} · Exp: <strong className="font-mono">{formatShortDate(lot.expiryDate)}</strong>
                            </span>
                            <span className="font-mono font-bold">
                              {lot.currentStock} / {lot.initialQuantity} {data.unit || 'pcs'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {lot.sourcePoNumber && (
                              <button
                                type="button"
                                onClick={() => handleJump({ target: 'po', documentId: lot.sourcePoNumber! })}
                                className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-pointer ${chipButtonClass('sky')}`}
                              >
                                {lot.sourcePoNumber}
                              </button>
                            )}
                            {lot.sourceGrId && (
                              <button
                                type="button"
                                onClick={() => handleJump({ target: 'gr', documentId: lot.sourceGrId! })}
                                className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-pointer ${chipButtonClass('emerald')}`}
                              >
                                {lot.sourceGrId}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* STAGE 5: VENDOR BILLS (AP) — FULL WIDTH WITH RBAC MASKING */}
              <section className={`rounded-2xl border p-4 space-y-3 ${cardClass}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                    {data.financialDataMasked ? <Lock className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                    5. Vendor Bills &amp; Accounts Payable (3-Way Match)
                  </h4>
                  {!data.financialDataMasked && (
                    <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                      {data.vendorBills.length} bill(s)
                    </span>
                  )}
                </div>

                {data.financialDataMasked ? (
                  <div
                    className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
                      isLight
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                    }`}
                  >
                    <Lock className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="font-bold">Financial &amp; Vendor Bill Lineage Restricted by RBAC Policy</div>
                      <div className="opacity-85 mt-0.5">
                        Your role is scoped to physical warehouse operations (GR, Lot, Rack &amp; Stock Quantity). Unit cost, PO value, and AP Vendor Bills are masked server-side.
                      </div>
                    </div>
                  </div>
                ) : data.vendorBills.length === 0 ? (
                  <p className={`text-xs py-2 ${mutedText}`}>
                    No Vendor Bills linked to this SKU yet. Create a Vendor Bill from an approved/received Purchase Order to complete 3-Way Match lineage.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.vendorBills.map((bill) => (
                      <div
                        key={bill.id}
                        className={`p-3.5 rounded-xl border space-y-2 ${
                          isLight
                            ? 'bg-[#F7F9F8] border-[#DFE7E2]'
                            : 'bg-[#12141C] border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleJump({ target: 'vendor_bill', documentId: bill.id })}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-xs font-bold transition-colors cursor-pointer ${chipButtonClass('indigo')}`}
                          >
                            <span>{bill.id}</span>
                            {onNavigateToDocument && <ExternalLink className="w-3 h-3" />}
                          </button>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getStatusPillClass(
                                bill.status,
                                isLight
                              )}`}
                            >
                              {bill.status}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getStatusPillClass(
                                bill.paymentStatus,
                                isLight
                              )}`}
                            >
                              {bill.paymentStatus}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                          <span className={mutedText}>
                            Inv: <strong className="font-mono">{bill.billNumber}</strong> · Due {formatShortDate(bill.dueDate)}
                          </span>
                          <span className="font-mono font-bold text-[#0F4C3A] dark:text-emerald-300">
                            {typeof bill.grandTotalIDR === 'number' ? formatIDR(bill.grandTotalIDR) : '—'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {bill.sourcePoId && (
                            <button
                              type="button"
                              onClick={() => handleJump({ target: 'po', documentId: bill.sourcePoId! })}
                              className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-pointer ${chipButtonClass('sky')}`}
                            >
                              {bill.sourcePoId}
                            </button>
                          )}
                          {bill.linkedGrIds.map((gid) => (
                            <button
                              key={gid}
                              type="button"
                              onClick={() => handleJump({ target: 'gr', documentId: gid })}
                              className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold cursor-pointer ${chipButtonClass('emerald')}`}
                            >
                              {gid}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

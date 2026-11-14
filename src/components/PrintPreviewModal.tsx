import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Printer, Receipt, Tag, X, ZoomIn, ZoomOut } from 'lucide-react';
import { usePrint, type PrintFormat, type PrintPayload } from '../context/PrintContext';
import { renderPrintDocument } from './UniversalPrintPortal';

type ZoomLevel = 75 | 100 | 125 | 150;

const ZOOM_CLASS_MAP: Record<ZoomLevel, string> = {
  75: 'scale-75 origin-top',
  100: 'scale-100 origin-top',
  125: 'scale-110 sm:scale-125 origin-top',
  150: 'scale-125 sm:scale-150 origin-top',
};

function getDocumentMeta(payload: PrintPayload): {
  title: string;
  formatLabel: string;
  dimensionsLabel: string;
} {
  const formatMeta: Record<PrintFormat, { formatLabel: string; dimensionsLabel: string }> = {
    a4: { formatLabel: 'A4 Portrait', dimensionsLabel: '210 × 297 mm • 14mm margin' },
    thermal80: { formatLabel: '80mm Thermal Roll', dimensionsLabel: '80mm width • 3mm margin' },
    label50x30: { formatLabel: '50 × 30 mm Label', dimensionsLabel: '50 × 30 mm • 1.5mm margin' },
  };

  const base = formatMeta[payload.format];

  switch (payload.type) {
    case 'pos_receipt':
      return { ...base, title: `POS Thermal Receipt — ${payload.receipt.receiptNumber}` };
    case 'pos_zreport':
      return {
        ...base,
        title: `POS Shift Z-Report — ${payload.shift.zReportNumber || payload.shift.id}`,
      };
    case 'b2c_receipt':
      return { ...base, title: `Customer Order Receipt — ${payload.order.id}` };
    case 'clearance_sticker':
      return { ...base, title: `FEFO Clearance Sticker — ${payload.candidate.batchId}` };
    case 'barcode_shelf_label':
      return { ...base, title: `Barcode & Shelf-Edge Label — ${payload.ean13Code}` };
    case 'logistics_doc':
      return {
        ...base,
        title: `Logistics Document — ${payload.activeTab.replace(/_/g, ' ').toUpperCase()}`,
      };
    case 'b2b_invoice':
      return { ...base, title: `Faktur Penjualan Grosir — ${payload.order.id}` };
    case 'bilyet_giro_slip':
      return { ...base, title: `Bukti Warkat Bilyet Giro — ${payload.giro.giroNumber}` };
    case 'waste_rma_slip':
      return { ...base, title: `Vendor Return (RMA) Slip — ${payload.rma.rmaNumber}` };
    case 'vendor_bill':
      return { ...base, title: `Vendor Bill Audit Voucher — ${payload.bill.billNumber}` };
    case 'nota_retur_customer':
      return { ...base, title: `Nota Retur Penjualan — ${payload.rma.notaReturNumber}` };
    case 'nota_retur_vendor':
      return { ...base, title: `Nota Retur Pembelian — ${payload.rtv.debitNoteNumber}` };
    case 'executive_report':
      return { ...base, title: 'Executive Performance Report' };
    case 'accounting_statement':
      return {
        ...base,
        title: `Financial Statement — ${payload.subTab.replace(/_/g, ' ').toUpperCase()}`,
      };
    case 'quotation':
      return {
        ...base,
        title: `${payload.quotation.isProForma ? 'Pro Forma Invoice' : 'Commercial Quotation'} — ${payload.quotation.quotationNumber}`,
      };
    case 'grocery_analytics':
      return { ...base, title: 'Grocery Intelligence & Analytics Report' };
    default:
      return { ...base, title: 'Document Print Preview' };
  }
}

export const PrintPreviewModal: React.FC = () => {
  const { activePrintPayload, isPreviewOpen, invoiceTracking, executePrint, clearPrint } = usePrint();
  const [zoom, setZoom] = useState<ZoomLevel>(100);

  // Set helpful default zoom per paper format whenever a new document preview opens
  useEffect(() => {
    if (!isPreviewOpen || !activePrintPayload) return;
    if (activePrintPayload.format === 'label50x30') {
      setZoom(150);
    } else {
      setZoom(100);
    }
  }, [isPreviewOpen, activePrintPayload]);

  // Close preview on Escape key
  useEffect(() => {
    if (!isPreviewOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearPrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen, clearPrint]);

  const previewTimestamp = useMemo(
    () =>
      new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [activePrintPayload]
  );

  if (!isPreviewOpen || !activePrintPayload || typeof document === 'undefined') {
    return null;
  }

  const meta = getDocumentMeta(activePrintPayload);
  const FormatIcon =
    activePrintPayload.format === 'thermal80'
      ? Receipt
      : activePrintPayload.format === 'label50x30'
      ? Tag
      : FileText;

  const zoomOptions: ZoomLevel[] = [75, 100, 125, 150];
  const currentZoomIndex = zoomOptions.indexOf(zoom);

  const paperFrameClass =
    activePrintPayload.format === 'a4'
      ? 'w-full max-w-[210mm] min-h-[260mm] bg-white text-slate-900 p-6 sm:p-[14mm] rounded-sm shadow-[0_18px_48px_rgba(0,0,0,0.32)] border border-stone-300'
      : activePrintPayload.format === 'thermal80'
      ? 'w-[80mm] max-w-full bg-white text-black px-3 py-4 rounded-sm shadow-[0_14px_38px_rgba(0,0,0,0.32)] border-y-4 border-dashed border-stone-300'
      : 'bg-white text-black p-4 rounded-xl shadow-[0_14px_38px_rgba(0,0,0,0.32)] border border-stone-300 [&_.print-page-label50x30]:w-[50mm] [&_.print-page-label50x30]:min-h-[30mm] [&_.print-page-label50x30]:p-1.5 [&_.print-page-label50x30]:border [&_.print-page-label50x30]:border-dashed [&_.print-page-label50x30]:border-slate-400 [&_.print-page-label50x30]:rounded [&_.print-page-label50x30]:mb-3 [&_.print-page-label50x30:last-child]:mb-0';

  return createPortal(
    <div
      className="fixed inset-0 z-[220] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 lg:p-6 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Print Preview"
    >
      <div className="w-full max-w-6xl h-[92vh] bg-stone-100 dark:bg-zinc-900 rounded-2xl border border-stone-300 dark:border-zinc-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Control Bar */}
        <div className="px-4 sm:px-5 py-3 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0F4C3A]/10 dark:bg-emerald-500/15 text-[#0F4C3A] dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FormatIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-stone-900 dark:text-zinc-100 truncate">
                  {meta.title}
                </h2>
                <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25">
                  {meta.formatLabel}
                </span>
              </div>
              <p className="text-[11px] font-mono text-stone-500 dark:text-zinc-400">
                Print Preview • {meta.dimensionsLabel} • Pure White Output
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Zoom Controls */}
            <div className="inline-flex items-center rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 p-0.5">
              <button
                type="button"
                onClick={() =>
                  currentZoomIndex > 0 && setZoom(zoomOptions[currentZoomIndex - 1])
                }
                disabled={currentZoomIndex <= 0}
                className="p-1.5 rounded-lg text-stone-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer transition-colors"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[11px] font-mono font-bold text-stone-700 dark:text-zinc-200 tabular-nums">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() =>
                  currentZoomIndex < zoomOptions.length - 1 &&
                  setZoom(zoomOptions[currentZoomIndex + 1])
                }
                disabled={currentZoomIndex >= zoomOptions.length - 1}
                className="p-1.5 rounded-lg text-stone-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer transition-colors"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={clearPrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-700 text-xs font-semibold text-stone-700 dark:text-zinc-200 cursor-pointer transition-all"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>

            <button
              type="button"
              onClick={executePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document</span>
            </button>
          </div>
        </div>

        {/* Paper Preview Stage */}
        <div className="flex-1 overflow-auto overscroll-contain bg-stone-200/95 dark:bg-zinc-950 p-4 sm:p-8">
          <div className={`w-fit mx-auto pb-10 transition-transform duration-150 ${ZOOM_CLASS_MAP[zoom]}`}>
            <div className={paperFrameClass}>
              {renderPrintDocument(activePrintPayload, {
                printedAt: previewTimestamp,
                isPreview: true,
                invoiceTracking,
              })}
            </div>
          </div>
        </div>

        {/* Bottom Verification Hint */}
        <div className="px-4 sm:px-5 py-2 bg-white dark:bg-zinc-900 border-t border-stone-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-zinc-400 shrink-0">
          <span>
            Verify layout, page breaks, and paper format above before sending to your printer or PDF exporter.
          </span>
          <span className="hidden sm:inline font-mono">Esc to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

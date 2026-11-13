import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode2,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type {
  CoretaxExportRow,
  CustomerRmaRecord,
  RmaDisposition,
  RmaRefundMethod,
  RmaSourceChannel,
  VendorRtvDebitNote,
} from '../../types/index.ts';
import { apiClient } from '../../services/apiClient';
import { formatIDR } from '../../utils/formatters';

interface ComplianceAccountingPanelsProps {
  theme: 'light' | 'dark';
  mode: 'rma_rtv' | 'coretax_djp';
  selectedStore: string;
  onRefreshData: () => void;
  onShowToast: (title: string, message: string) => void;
}

export const ComplianceAccountingPanels: React.FC<ComplianceAccountingPanelsProps> = ({
  theme,
  mode,
  selectedStore,
  onRefreshData,
  onShowToast,
}) => {
  const isLight = theme === 'light';

  // Module 1: RMA & RTV state
  const [rmaList, setRmaList] = useState<CustomerRmaRecord[]>([]);
  const [rtvList, setRtvList] = useState<VendorRtvDebitNote[]>([]);
  const [rmaSources, setRmaSources] = useState<{
    posReceipts: any[];
    b2cOrders: any[];
    b2bOrders: any[];
  }>({ posReceipts: [], b2cOrders: [], b2bOrders: [] });

  const [sourceChannel, setSourceChannel] = useState<RmaSourceChannel>('B2B');
  const [selectedSourceRef, setSelectedSourceRef] = useState<string>('');
  const [disposition, setDisposition] = useState<RmaDisposition>('RESTOCK_ATP');
  const [refundMethod, setRefundMethod] = useState<RmaRefundMethod>('AR_REDUCTION');
  const [rmaReason, setRmaReason] = useState<string>('Damaged carton / short-dated delivery return');
  const [isCreatingRma, setIsCreatingRma] = useState<boolean>(false);

  // RTV form
  const [rtvSku, setRtvSku] = useState<string>('SKU-PRD-002');
  const [rtvSupplier, setRtvSupplier] = useState<string>('PT Lembang Agro Sejahtera');
  const [rtvQty, setRtvQty] = useState<number>(5);
  const [rtvLot, setRtvLot] = useState<string>('BAT-202611-QC');
  const [rtvReason, setRtvReason] = useState<string>('QC Rejected on Receiving Dock (Cold Chain Breach)');
  const [isCreatingRtv, setIsCreatingRtv] = useState<boolean>(false);

  // Module 5: Coretax state
  const [coretaxData, setCoretaxData] = useState<{
    generatedAt: string;
    summary: {
      totalRows: number;
      totalPpnKeluaranIDR: number;
      totalNotaReturPpnIDR: number;
      b2bMissingNpwpCount: number;
    };
    rows: CoretaxExportRow[];
    csvContent: string;
    xmlContent: string;
  } | null>(null);
  const [isLoadingCoretax, setIsLoadingCoretax] = useState<boolean>(false);
  const [npwpVerifyInput, setNpwpVerifyInput] = useState<string>('013084492007000');
  const [npwpCheckRes, setNpwpCheckRes] = useState<any>(null);

  const loadRmaRtvData = async () => {
    try {
      const [rmas, rtvs, sources] = await Promise.all([
        apiClient.getComplianceRmaList(selectedStore),
        apiClient.getComplianceRtvList(selectedStore),
        apiClient.getComplianceRmaSources(),
      ]);
      setRmaList(rmas);
      setRtvList(rtvs);
      setRmaSources(sources);
      if (!selectedSourceRef) {
        const defaultRef =
          sources.b2bOrders[0]?.referenceId ||
          sources.posReceipts[0]?.referenceId ||
          sources.b2cOrders[0]?.referenceId ||
          '';
        setSelectedSourceRef(defaultRef);
      }
    } catch (err) {
      console.error('Failed to load RMA/RTV records:', err);
    }
  };

  const loadCoretax = async () => {
    setIsLoadingCoretax(true);
    try {
      const data = await apiClient.getCoretaxExport();
      setCoretaxData(data);
    } catch (err) {
      console.error('Failed to load Coretax export:', err);
    } finally {
      setIsLoadingCoretax(false);
    }
  };

  useEffect(() => {
    if (mode === 'rma_rtv') loadRmaRtvData();
    if (mode === 'coretax_djp') loadCoretax();
  }, [mode, selectedStore]);

  const activeSourceList =
    sourceChannel === 'B2B'
      ? rmaSources.b2bOrders
      : sourceChannel === 'B2C'
      ? rmaSources.b2cOrders
      : rmaSources.posReceipts;

  const selectedOrderObj =
    activeSourceList.find((s) => s.referenceId === selectedSourceRef) || activeSourceList[0];

  const handleSubmitRma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderObj || !selectedOrderObj.items?.length) {
      onShowToast('No Order Selected', 'Select a POS receipt, B2C order, or B2B order first.');
      return;
    }
    setIsCreatingRma(true);
    try {
      const firstItem = selectedOrderObj.items[0];
      const res = await apiClient.createComplianceRma({
        sourceChannel,
        sourceReferenceId: selectedOrderObj.referenceId,
        storeId: selectedOrderObj.storeId,
        storeName: selectedOrderObj.storeName,
        customerId: selectedOrderObj.customerId,
        customerName: selectedOrderObj.customerName,
        customerNpwpOrNik: selectedOrderObj.customerNpwpOrNik,
        refundMethod: sourceChannel === 'B2B' ? 'AR_REDUCTION' : refundMethod,
        items: [
          {
            sku: firstItem.sku,
            productName: firstItem.productName,
            category: firstItem.category,
            quantity: 1,
            unitPriceIDR: firstItem.unitPriceIDR,
            unitCostIDR: firstItem.unitCostIDR,
            disposition,
            lotNumber: firstItem.lotNumber,
            reason: rmaReason,
          },
        ],
        notes: rmaReason,
      });
      onShowToast('Nota Retur Credit Note Issued', res.message);
      await loadRmaRtvData();
      onRefreshData();
    } catch (err: any) {
      onShowToast('RMA Error', err.message || 'Failed to create RMA');
    } finally {
      setIsCreatingRma(false);
    }
  };

  const handleSubmitRtv = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingRtv(true);
    try {
      const res = await apiClient.createComplianceRtv({
        sku: rtvSku,
        supplierName: rtvSupplier,
        storeId: selectedStore === 'CONSOLIDATED' ? 'store-jkt-senopati' : selectedStore,
        lotNumber: rtvLot,
        quantityReturned: rtvQty,
        reason: rtvReason,
      });
      onShowToast('Vendor Debit Note Issued', res.message);
      await loadRmaRtvData();
      onRefreshData();
    } catch (err: any) {
      onShowToast('RTV Error', err.message || 'Failed to create RTV Debit Note');
    } finally {
      setIsCreatingRtv(false);
    }
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('DJP File Downloaded', `Generated ${filename} for Coretax / e-Faktur upload.`);
  };

  const cardClass = `rounded-2xl border p-5 sm:p-6 space-y-4 ${
    isLight ? 'bg-white border-gray-200/90 shadow-xs' : 'bg-zinc-900/90 border-zinc-800'
  }`;

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border ${
    isLight ? 'bg-white border-gray-300 text-gray-900' : 'bg-zinc-800 border-zinc-700 text-white'
  }`;

  if (mode === 'rma_rtv') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer RMA / Nota Retur Penjualan Form */}
          <form onSubmit={handleSubmitRma} className={cardClass}>
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <RotateCcw className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold">
                  Customer Sales Return (RMA &amp; Nota Retur Penjualan)
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                  Restock ATP vs Scrap Quarantine · Reverses Revenue (#4010/#4020), AR (#1200), &amp; PPN Keluaran (#2025)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Order Channel</label>
                <select
                  value={sourceChannel}
                  onChange={(e) => {
                    const ch = e.target.value as RmaSourceChannel;
                    setSourceChannel(ch);
                    const list =
                      ch === 'B2B'
                        ? rmaSources.b2bOrders
                        : ch === 'B2C'
                        ? rmaSources.b2cOrders
                        : rmaSources.posReceipts;
                    setSelectedSourceRef(list[0]?.referenceId || '');
                  }}
                  className={inputClass}
                >
                  <option value="B2B">B2B Wholesale Order (AR #1200)</option>
                  <option value="POS">POS Register Receipt</option>
                  <option value="B2C">B2C Storefront Order</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Source Receipt / Order</label>
                <select
                  value={selectedOrderObj?.referenceId || ''}
                  onChange={(e) => setSelectedSourceRef(e.target.value)}
                  className={`font-mono ${inputClass}`}
                >
                  {activeSourceList.length === 0 ? (
                    <option value="">No records found</option>
                  ) : (
                    activeSourceList.map((s) => (
                      <option key={s.referenceId} value={s.referenceId}>
                        {s.referenceId} · {s.customerName} ({formatIDR(s.totalAmountIDR)})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Mandatory Disposition</label>
                <select
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value as RmaDisposition)}
                  className={inputClass}
                >
                  <option value="RESTOCK_ATP">Good Condition (Restock Available ATP)</option>
                  <option value="SCRAP_QUARANTINE">Damaged/Expired (Scrap Quarantine)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Settlement / Credit Note</label>
                <select
                  value={sourceChannel === 'B2B' ? 'AR_REDUCTION' : refundMethod}
                  disabled={sourceChannel === 'B2B'}
                  onChange={(e) => setRefundMethod(e.target.value as RmaRefundMethod)}
                  className={inputClass}
                >
                  <option value="AR_REDUCTION">Reduce B2B AR (#1200)</option>
                  <option value="CASH">Cash Refund (#1010)</option>
                  <option value="STORE_CREDIT">Store Credit Voucher (#2020)</option>
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold mb-1">Return Reason &amp; QC Note</label>
              <input
                type="text"
                value={rmaReason}
                onChange={(e) => setRmaReason(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isCreatingRma || !selectedOrderObj}
              className="w-full py-2.5 rounded-xl bg-[#0F4C3A] hover:bg-[#0b382b] disabled:opacity-50 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingRma ? 'Issuing Nota Retur...' : 'Issue Credit Note (Nota Retur Penjualan)'}</span>
            </button>
          </form>

          {/* Return-to-Vendor / RTV Debit Note Form */}
          <form onSubmit={handleSubmitRtv} className={cardClass}>
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <Truck className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <div>
                <h3 className="text-sm font-bold">
                  Return-to-Vendor (RTV &amp; Nota Retur Pembelian)
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                  Deducts Inventory (#1040), reduces Vendor AP (#2010), &amp; reverses PPN Masukan (#2026)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">SKU / Rejected Batch</label>
                <input
                  type="text"
                  value={rtvSku}
                  onChange={(e) => setRtvSku(e.target.value)}
                  className={`font-mono ${inputClass}`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={rtvSupplier}
                  onChange={(e) => setRtvSupplier(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Quantity Returned</label>
                <input
                  type="number"
                  min={1}
                  value={rtvQty}
                  onChange={(e) => setRtvQty(Math.max(1, Number(e.target.value) || 1))}
                  className={`font-mono font-bold ${inputClass}`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Lot / Batch Number</label>
                <input
                  type="text"
                  value={rtvLot}
                  onChange={(e) => setRtvLot(e.target.value)}
                  className={`font-mono ${inputClass}`}
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold mb-1">QC Rejection / Damage Reason</label>
              <input
                type="text"
                value={rtvReason}
                onChange={(e) => setRtvReason(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isCreatingRtv}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingRtv ? 'Generating Debit Note...' : 'Issue Vendor Debit Note (Nota Retur Pembelian)'}</span>
            </button>
          </form>
        </div>

        {/* Ledgers: Customer Credit Notes & Vendor Debit Notes */}
        <div className={cardClass}>
          <h4 className="text-sm font-bold">Customer Credit Notes (Nota Retur Penjualan) — {rmaList.length}</h4>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className={`border-b text-[10px] font-bold uppercase ${isLight ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-zinc-800/60 text-zinc-400 border-zinc-800'}`}>
                <tr>
                  <th className="py-2.5 px-3">Nota Retur #</th>
                  <th className="py-2.5 px-3">Channel / Source</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Disposition</th>
                  <th className="py-2.5 px-3 text-right">PPN Adjusted</th>
                  <th className="py-2.5 px-3 text-right">Total Credit Note</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-zinc-800'}`}>
                {rmaList.map((rma) => (
                  <tr key={rma.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0F4C3A] dark:text-emerald-400">
                      {rma.notaReturNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {rma.sourceChannel} · {rma.sourceReferenceId}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{rma.customerName}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rma.items[0]?.disposition === 'RESTOCK_ATP'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {rma.items[0]?.disposition === 'RESTOCK_ATP' ? 'RESTOCK ATP' : 'SCRAP QUARANTINE'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatIDR(rma.ppnReversedIDR)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                      {formatIDR(rma.totalCreditNoteIDR)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="text-sm font-bold pt-2">Vendor Debit Notes (Nota Retur Pembelian / RTV) — {rtvList.length}</h4>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className={`border-b text-[10px] font-bold uppercase ${isLight ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-zinc-800/60 text-zinc-400 border-zinc-800'}`}>
                <tr>
                  <th className="py-2.5 px-3">Debit Note #</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">SKU &amp; Lot</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">PPN Masukan Reversed</th>
                  <th className="py-2.5 px-3 text-right">Total AP Debit</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-zinc-800'}`}>
                {rtvList.map((rtv) => (
                  <tr key={rtv.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {rtv.debitNoteNumber}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{rtv.supplierName}</td>
                    <td className="py-2.5 px-3 font-mono">
                      {rtv.sku} · {rtv.lotNumber}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {rtv.quantityReturned} {rtv.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatIDR(rtv.ppnMasukanReversedIDR)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                      {formatIDR(rtv.totalDebitNoteIDR)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // MODE: CORETAX / E-FAKTUR DJP EXPORT
  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-[#0F4C3A] text-white text-[10px] font-bold uppercase">
                DJP Coretax / e-Faktur 4.0
              </span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                B2B Faktur Pajak · B2C Digunggung · Nota Retur Compliance
              </span>
            </div>
            <h3 className="text-base font-bold mt-1">
              Indonesian VAT Ledger &amp; DJP Coretax CSV/XML Export
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={loadCoretax}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCoretax ? 'animate-spin' : ''}`} />
              <span>Recompile</span>
            </button>
            <button
              type="button"
              disabled={!coretaxData}
              onClick={() =>
                coretaxData &&
                downloadFile(
                  coretaxData.csvContent,
                  `Coretax_eFaktur_DJP_${new Date().toISOString().slice(0, 10)}.csv`,
                  'text/csv;charset=utf-8;'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Generate Coretax CSV</span>
            </button>
            <button
              type="button"
              disabled={!coretaxData}
              onClick={() =>
                coretaxData &&
                downloadFile(
                  coretaxData.xmlContent,
                  `Coretax_TaxInvoiceBulk_${new Date().toISOString().slice(0, 10)}.xml`,
                  'application/xml;charset=utf-8;'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Generate Coretax XML</span>
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        {coretaxData && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
            <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/50 border-zinc-800'}`}>
              <span className="font-sans text-[11px] text-gray-500 dark:text-zinc-400 block">
                Compiled Tax Documents
              </span>
              <span className="text-lg font-extrabold block mt-1">{coretaxData.summary.totalRows}</span>
            </div>
            <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/50 border-zinc-800'}`}>
              <span className="font-sans text-[11px] text-gray-500 dark:text-zinc-400 block">
                Net PPN Keluaran (VAT Out)
              </span>
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">
                {formatIDR(coretaxData.summary.totalPpnKeluaranIDR)}
              </span>
            </div>
            <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/50 border-zinc-800'}`}>
              <span className="font-sans text-[11px] text-gray-500 dark:text-zinc-400 block">
                Nota Retur PPN Deducted
              </span>
              <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400 block mt-1">
                -{formatIDR(coretaxData.summary.totalNotaReturPpnIDR)}
              </span>
            </div>
            <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/50 border-zinc-800'}`}>
              <span className="font-sans text-[11px] text-gray-500 dark:text-zinc-400 block">
                B2B Missing NPWP/NIK
              </span>
              <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400 block mt-1">
                {coretaxData.summary.b2bMissingNpwpCount}
              </span>
            </div>
          </div>
        )}

        {/* Inline 16-Digit NPWP / NIK Validator Bar */}
        <div
          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
            isLight ? 'bg-gray-50 border-gray-200' : 'bg-zinc-800/40 border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-2 flex-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <input
              type="text"
              value={npwpVerifyInput}
              onChange={(e) => setNpwpVerifyInput(e.target.value)}
              placeholder="Validate 16-digit NIK/NPWP before Faktur Pajak..."
              className={`max-w-xs font-mono ${inputClass}`}
            />
            <button
              type="button"
              onClick={async () => {
                const res = await apiClient.validateNpwpOrNik(npwpVerifyInput);
                setNpwpCheckRes(res);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#0F4C3A] text-white font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              Verify 16-Digit NPWP/NIK
            </button>
          </div>
          {npwpCheckRes && (
            <span
              className={`font-mono text-[11px] font-bold flex items-center gap-1 ${
                npwpCheckRes.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {npwpCheckRes.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {npwpCheckRes.valid ? `${npwpCheckRes.type}: ${npwpCheckRes.formatted}` : npwpCheckRes.error}
            </span>
          )}
        </div>

        {/* Compiled e-Faktur / Coretax Preview Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className={`border-b text-[10px] font-bold uppercase ${isLight ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-zinc-800/60 text-zinc-400 border-zinc-800'}`}>
              <tr>
                <th className="py-2.5 px-3">Type &amp; Kode</th>
                <th className="py-2.5 px-3">Faktur / Nota #</th>
                <th className="py-2.5 px-3">Counterparty &amp; NPWP/NIK</th>
                <th className="py-2.5 px-3 text-right">DPP (IDR)</th>
                <th className="py-2.5 px-3 text-right">PPN (IDR)</th>
                <th className="py-2.5 px-3 text-right">Total (IDR)</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-100' : 'divide-zinc-800'}`}>
              {(coretaxData?.rows || []).map((row) => (
                <tr key={row.rowId} className={isLight ? 'hover:bg-gray-50/70' : 'hover:bg-zinc-800/40'}>
                  <td className="py-2.5 px-3">
                    <span className="font-mono font-bold block text-[11px]">{row.documentType}</span>
                    <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                      Kode {row.kodeTransaksi} · {row.taxClassification}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">{row.documentNumber}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold">{row.counterpartyName}</div>
                    <div className="font-mono text-[10px] text-gray-500 dark:text-zinc-400">
                      TIN: {row.npwpOrNik}{' '}
                      {row.isNpwpValid ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">· VALID</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">· Digunggung</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatIDR(row.dppIDR)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">{formatIDR(row.ppnIDR)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">{formatIDR(row.totalIDR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
